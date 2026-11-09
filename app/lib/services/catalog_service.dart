import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../models/category_item.dart';
import '../models/product.dart';
import '../models/banner_item.dart';
import '../models/flash_sale_item.dart';
import '../data/website_data.dart';
import '../utils/product_image_resolver.dart';
import '../utils/flash_sale_rotator.dart';
import 'api_client.dart';
import '../config/api_config.dart';

/// Kết quả phân trang danh sách sản phẩm
class ProductListResult {
  final List<Product> products;
  final int page;
  final int limit;
  final int total;
  final int totalPages;

  const ProductListResult({
    required this.products,
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
  });
}

class CatalogService {
  List<dynamic> _extractList(dynamic data, String preferredKey) {
    if (data is List) return data;
    if (data is Map) {
      if (data[preferredKey] is List) return data[preferredKey] as List;
      for (final v in data.values) {
        if (v is List) return v;
      }
    }
    return [];
  }
  static final CatalogService _instance = CatalogService._internal();
  factory CatalogService({http.Client? client}) {
    if (client != null) {
      return CatalogService._internal(client: client);
    }
    return _instance;
  }

  final http.Client _client;
  final ApiClient _apiClient = ApiClient();

  CatalogService._internal({http.Client? client}) : _client = client ?? http.Client();

  /// Lấy danh sách danh mục sản phẩm từ Backend API (kết hợp đầy đủ 12 ngành hàng giao diện)
  Future<List<CategoryItem>> getCategories({bool mergeWebsiteData = false}) async {
    List<CategoryItem> apiCategories = [];
    try {
      final res = await _client.get(
        Uri.parse(ApiConfig.categoriesUrl),
        headers: {'Accept': 'application/json'},
      ).timeout(const Duration(seconds: 5));

      if (res.statusCode == 200) {
        final Map<String, dynamic> body = jsonDecode(res.body);
        if (body['success'] == true && body['data'] != null) {
          final list = _extractList(body['data'], 'categories');
          apiCategories = list.map((e) => CategoryItem.fromJson(e as Map<String, dynamic>)).toList();
        }
      }
    } catch (_) {}

    if (apiCategories.isNotEmpty && !mergeWebsiteData) return apiCategories;
    if (mergeWebsiteData) {
      final categoryMap = <String, CategoryItem>{};
      for (final c in WebsiteData.categories) {
        categoryMap[c.slug ?? c.id] = c;
      }
      for (final c in apiCategories) {
        categoryMap[c.slug ?? c.id] = c;
      }
      return categoryMap.values.toList();
    }

    return apiCategories.isNotEmpty ? apiCategories : WebsiteData.categories;
  }

  /// Lấy danh sách ngành hàng/danh mục dạng thô từ Backend
  /// GET /api/v1/categories
  Future<List<Map<String, dynamic>>> getRawCategories() async {
    final response = await _apiClient.get('/api/v1/categories');
    if (response.success && response.data != null) {
      final list = _extractList(response.data, 'categories');
      return list.whereType<Map<String, dynamic>>().toList();
    }
    return [];
  }

  /// Lấy danh sách sản phẩm từ Backend API
  Future<List<Product>> getProducts({
    String? categoryId,
    bool? isFlashSale,
    bool? isFeatured,
    String? filterTab,
    bool mergeWebsiteData = false,
  }) async {
    List<Product> allProducts = [];

    try {
      final uri = Uri.parse(ApiConfig.productsUrl).replace(queryParameters: {
        if (categoryId != null && categoryId.isNotEmpty) 'categoryId': categoryId,
        if (isFlashSale != null && isFlashSale) 'flash': '1',
        'limit': '100',
      });

      final res = await _client.get(
        uri,
        headers: {'Accept': 'application/json'},
      ).timeout(const Duration(seconds: 5));

      if (res.statusCode == 200) {
        final Map<String, dynamic> body = jsonDecode(res.body);
        if (body['success'] == true && body['data'] != null) {
          final list = _extractList(body['data'], 'products');
          allProducts = list.map((e) => Product.fromJson(e as Map<String, dynamic>)).toList();
        }
      }
    } catch (_) {}

    List<Product> result;
    if (allProducts.isNotEmpty) {
      if (mergeWebsiteData) {
        final productMap = <String, Product>{};
        for (final p in WebsiteData.products) productMap[p.id] = p;
        for (final p in allProducts) productMap[p.id] = p;
        result = productMap.values.toList();
      } else {
        result = allProducts;
      }
    } else {
      result = List<Product>.from(WebsiteData.products);
    }

    if (categoryId != null && categoryId.isNotEmpty) {
      result = result.where((p) => matchesCategory(p, categoryId)).toList();
    }

    if (isFlashSale == true) {
      result = result.where((p) => p.isFlashSale).toList();
    }

    if (isFeatured == true) {
      final feat = result.where((p) => p.isFeatured).toList();
      if (feat.isNotEmpty) result = feat;
    }

    if (filterTab != null && filterTab.isNotEmpty) {
      if (filterTab == 'popular') {
        result = List<Product>.from(result)..sort((a, b) => b.rating.compareTo(a.rating));
      } else if (filterTab == 'newest') {
        result = result.reversed.toList();
      } else if (filterTab == 'hot_deal') {
        result = result.where((p) => p.discount >= 40).toList();
      } else if (filterTab == 'outlet') {
        result = List<Product>.from(result)..sort((a, b) => a.price.compareTo(b.price));
      }
    }

    return result;
  }

  /// Lấy danh sách sản phẩm công khai kèm phân trang và bộ lọc
  /// GET /api/v1/products?offset=0&limit=24&categoryId=...&q=...&sort=...
  Future<ProductListResult> getProductsPaginated({
    int page = 1,
    int limit = 24,
    String? categoryId,
    String? shopId,
    String? q,
    String? sort,
    double? minPrice,
    double? maxPrice,
    String? province,
    bool? mall,
    bool? freeship,
  }) async {
    final safePage = page > 0 ? page : 1;
    final offset = (safePage - 1) * limit;
    final queryParams = <String, String>{
      'offset': offset.toString(),
      'limit': limit.toString(),
    };

    if (categoryId != null && categoryId.isNotEmpty) queryParams['categoryId'] = categoryId;
    if (shopId != null && shopId.isNotEmpty) queryParams['shopId'] = shopId;
    if (q != null && q.trim().isNotEmpty) queryParams['q'] = q.trim();
    if (sort != null && sort.isNotEmpty) queryParams['sort'] = sort;
    if (minPrice != null && minPrice >= 0) queryParams['minPrice'] = minPrice.toInt().toString();
    if (maxPrice != null && maxPrice > 0) queryParams['maxPrice'] = maxPrice.toInt().toString();
    if (province != null && province.isNotEmpty) queryParams['location'] = province;
    if (mall == true) queryParams['mall'] = '1';
    if (freeship == true) queryParams['freeship'] = '1';

    final response = await _apiClient.get('/api/v1/products', queryParams: queryParams);

    if (response.success && response.data != null) {
      final list = _extractList(response.data, 'products')
          .whereType<Map<String, dynamic>>()
          .map((item) => Product.fromJson(item))
          .toList();

      int total = list.length;
      if (response.data is Map && response.data['total'] is num) {
        total = (response.data['total'] as num).toInt();
      } else if (response.meta?['total'] is num) {
        total = (response.meta!['total'] as num).toInt();
      }

      return ProductListResult(
        products: list,
        page: (response.meta?['page'] as num?)?.toInt() ?? page,
        limit: (response.meta?['limit'] as num?)?.toInt() ?? limit,
        total: total,
        totalPages: (total / (limit > 0 ? limit : 1)).ceil(),
      );
    }

    return ProductListResult(products: [], page: page, limit: limit, total: 0, totalPages: 0);
  }

  /// Lấy danh sách banner khuyến mãi chuẩn của sàn ShopNova
  Future<List<BannerItem>> getBanners() async {
    return WebsiteData.banners;
  }

  /// Lấy danh sách sản phẩm Flash Sale xoay tua thông minh theo khung giờ & sự kiện
  Future<List<FlashSaleItem>> getFlashSaleItems() async {
    try {
      final apiProducts = await getProducts();
      if (apiProducts.isNotEmpty) {
        return FlashSaleRotator.rotateItems(apiProducts: apiProducts, count: 6);
      }
    } catch (e) {
      debugPrint('[CatalogService] getFlashSaleItems error: $e');
    }
    return FlashSaleRotator.rotateItems(count: 6);
  }

  /// Lấy chi tiết sản phẩm từ Backend API (kèm fallback thông minh theo WebsiteData)
  Future<Product?> getProductDetail(String id) async {
    try {
      final res = await _client.get(
        Uri.parse('${ApiConfig.productsUrl}/$id'),
        headers: {'Accept': 'application/json'},
      ).timeout(const Duration(seconds: 5));

      if (res.statusCode == 200) {
        final Map<String, dynamic> body = jsonDecode(res.body);
        if (body['success'] == true && body['data'] is Map) {
          return Product.fromJson(body['data'] as Map<String, dynamic>);
        }
      }
    } catch (_) {}

    try {
      final cleanId = id.trim().toLowerCase();
      final p = WebsiteData.products.firstWhere(
        (prod) => prod.id.toLowerCase() == cleanId || prod.id.replaceAll('p', '') == cleanId.replaceAll('p', ''),
      );
      return p;
    } catch (_) {}

    return null;
  }

  /// Lấy danh sách gian hàng từ Backend API
  Future<List<Map<String, dynamic>>> getShops({bool mergeWebsiteData = false}) async {
    try {
      final res = await _client.get(
        Uri.parse(ApiConfig.shopsUrl),
        headers: {'Accept': 'application/json'},
      ).timeout(const Duration(seconds: 5));

      if (res.statusCode == 200) {
        final Map<String, dynamic> body = jsonDecode(res.body);
        if (body['success'] == true && body['data'] != null) {
          final list = _extractList(body['data'], 'shops');
          final apiShops = list.whereType<Map<String, dynamic>>().toList();
          if (apiShops.isNotEmpty) return apiShops;
        }
      }
    } catch (_) {}

    return mergeWebsiteData ? WebsiteData.shops.map((s) => {
      'id': s.id,
      'name': s.name,
      'isMall': s.isMall,
      'rating': s.rating,
      'followers': s.followers,
      'location': s.location,
      'tagline': s.tagline,
      'emoji': s.emoji,
    }).toList() : [];
  }

  /// Lấy dữ liệu sản phẩm nổi bật & Flash Sale cho trang chủ
  Future<Map<String, dynamic>> getFeaturedHomeData() async {
    try {
      final flashSale = await getProducts(isFlashSale: true);
      final all = await getProducts();
      final featured = all.where((p) => p.isFeatured).toList();
      return {
        'flashSale': flashSale.map((p) => p.toJson()).toList(),
        'featuredProducts': (featured.isNotEmpty ? featured : all).map((p) => p.toJson()).toList(),
      };
    } catch (_) {
      return {'flashSale': [], 'featuredProducts': []};
    }
  }

  /// Lấy 8 tiện ích nhanh (QuickLinks) như trên Website
  List<QuickLinkItem> getQuickLinks() {
    return WebsiteData.quickLinks;
  }

  /// Lấy 4 cam kết chất lượng như trên Website
  List<CommitmentItem> getCommitments() {
    return WebsiteData.commitments;
  }

  /// So khớp sản phẩm với ngành hàng / danh mục một cách thông minh và linh hoạt
  static bool matchesCategory(Product p, String categoryTarget) {
    final target = categoryTarget.trim().toLowerCase();
    if (target.isEmpty) return true;

    final pCatId = p.categoryId.trim().toLowerCase();
    final pCatName = p.categoryName.trim().toLowerCase();

    if (pCatId == target || pCatName == target) return true;

    final Map<String, List<String>> aliases = {
      'thoi-trang-nam': [
        'thoi-trang-nam', 'thoi trang nam', 'thoitrangnam', 'nam', 'ao nam', 'quan nam', '1'
      ],
      'thoi-trang-nu': [
        'thoi-trang-nu', 'thoi trang nu', 'thoitrangnu', 'nu', 'áo nữ', 'váy', 'đầm', 'túi xách', '2'
      ],
      'dien-thoai': [
        'dien-thoai', 'điện thoại & phụ kiện', 'điện thoại và phụ kiện', 'điện thoại', 'phụ kiện',
        'dienthoai', 'tai nghe', 'sạc', 'cáp', 'pin dự phòng', '3'
      ],
      'may-tinh': [
        'may-tinh', 'máy tính & laptop', 'máy tính và laptop', 'máy tính', 'laptop', 'maytinh',
        'bàn phím', 'chuột', 'màn hình', 'pc', '4'
      ],
      'thiet-bi-gia-dung': [
        'thiet-bi-gia-dung', 'thiết bị gia dụng', 'gia dụng', 'thietbigiadung', 'gia-dung',
        'robot hút bụi', 'nồi chiên', 'ấm đun', 'máy lọc không khí', '5'
      ],
      'sac-dep': [
        'sac-dep', 'sắc đẹp & chăm sóc da', 'sắc đẹp và chăm sóc da', 'sắc đẹp', 'chăm sóc da',
        'mỹ phẩm', 'sacdep', 'son', 'serum', 'tẩy trang', 'sữa rửa mặt', '6'
      ],
      'nha-cua': [
        'nha-cua', 'nhà cửa & đời sống', 'nhà cửa và đời sống', 'nhà cửa', 'đời sống',
        'nhacua', 'chảo', 'nồi', 'gối', 'đèn', 'kệ', 'nến', 'thảm', 'dép', 'ghế', '7'
      ],
      'me-be': [
        'me-be', 'mẹ & bé yêu', 'mẹ & bé', 'mẹ và bé yêu', 'mẹ và bé', 'mebe',
        'xe đẩy', 'bỉm', 'tã', 'ghế ăn dặm', '8'
      ],
      'bach-hoa': [
        'bach-hoa', 'bách hóa online', 'bách hóa', 'bachhoa', 'thực phẩm', 'cà phê', 'trà', 'tiêu dùng', '9'
      ],
      'the-thao': [
        'the-thao', 'thể thao & du lịch', 'thể thao và du lịch', 'thể thao', 'thethao',
        'xe đạp', 'bóng đá', 'du lịch', '10'
      ],
      'o-to-xe-may': [
        'o-to-xe-may', 'ô tô & xe máy', 'ô tô và xe máy', 'ô tô', 'xe máy', 'otoxemay',
        'mũ bảo hiểm', 'bơm lốp', 'phụ tùng', '11'
      ],
      'may-anh': [
        'may-anh', 'máy ảnh & máy quay', 'máy ảnh và máy quay', 'máy ảnh', 'máy quay',
        'mayanh', 'camera', 'ống kính', '12'
      ],
    };

    String? matchedCanonicalKey;
    for (final entry in aliases.entries) {
      if (entry.key == target || entry.value.any((alias) => alias == target || target.contains(alias) || alias.contains(target))) {
        matchedCanonicalKey = entry.key;
        break;
      }
    }

    if (matchedCanonicalKey != null) {
      if (pCatId == matchedCanonicalKey) return true;
      final group = aliases[matchedCanonicalKey]!;
      if (group.any((a) => pCatId == a || pCatName == a || pCatName.contains(a))) {
        return true;
      }
    }

    if (pCatName.contains(target) || target.contains(pCatName)) return true;

    return false;
  }

  /// Tìm kiếm sản phẩm thông minh và lấy danh sách sản phẩm liên quan
  Future<SearchResult> searchProducts(
    String query, {
    String? sort,
    bool? mall,
    bool? freeship,
    String? categoryId,
  }) async {
    final q = query.trim().toLowerCase();
    List<Product> results = [];
    bool isExact = true;

    if (q.isNotEmpty || (categoryId != null && categoryId.isNotEmpty)) {
      try {
        final apiResult = await getProductsPaginated(
          q: q.isNotEmpty ? query.trim() : null,
          sort: sort,
          mall: mall,
          freeship: freeship,
          categoryId: categoryId,
          limit: 60,
        );
        if (apiResult.products.isNotEmpty) {
          results = apiResult.products;
          isExact = true;
        }
      } catch (_) {}
    }

    if (results.isEmpty) {
      final all = WebsiteData.products;
      if (q.isEmpty) {
        results = List<Product>.from(all);
        isExact = true;
      } else {
        final exact = all.where((p) {
          final name = p.name.toLowerCase();
          final cat = p.categoryName.toLowerCase();
          final desc = p.description.toLowerCase();
          final shop = p.shopName.toLowerCase();
          return name.contains(q) || cat.contains(q) || desc.contains(q) || shop.contains(q);
        }).toList();

        if (exact.isNotEmpty) {
          results = exact;
          isExact = true;
        } else {
          final words = q.split(RegExp(r'\s+')).where((w) => w.length >= 2).toList();
          final fuzzy = all.where((p) {
            final name = p.name.toLowerCase();
            final cat = p.categoryName.toLowerCase();
            final desc = p.description.toLowerCase();
            return words.any((w) => name.contains(w) || cat.contains(w) || desc.contains(w));
          }).toList();

          if (fuzzy.isNotEmpty) {
            results = fuzzy;
            isExact = true;
          } else {
            results = List<Product>.from(all)..sort((a, b) => b.rating.compareTo(a.rating));
            results = results.take(16).toList();
            isExact = false;
          }
        }
      }
    }

    if (mall == true) {
      results = results.where((p) => p.badges.any((b) => b.toUpperCase().contains('MALL'))).toList();
    }
    if (freeship == true) {
      results = results.where((p) => p.badges.any((b) => b.toUpperCase().contains('FREESHIP'))).toList();
    }
    if (categoryId != null && categoryId.isNotEmpty) {
      final categoryFiltered = results.where((p) => matchesCategory(p, categoryId)).toList();
      if (categoryFiltered.isNotEmpty || q.isEmpty) {
        results = categoryFiltered;
      }
    }

    if (sort == 'price_asc') {
      results.sort((a, b) => a.price.compareTo(b.price));
    } else if (sort == 'price_desc') {
      results.sort((a, b) => b.price.compareTo(a.price));
    } else if (sort == 'rating') {
      results.sort((a, b) => b.rating.compareTo(a.rating));
    } else if (sort == 'popular') {
      results.sort((a, b) => b.soldPercent.compareTo(a.soldPercent));
    } else if (sort == 'newest') {
      results = results.reversed.toList();
    }

    return SearchResult(
      products: results,
      isExactMatch: isExact,
      query: query,
    );
  }

  /// Lấy danh sách định nghĩa thuộc tính ngành hàng từ Backend
  /// GET /api/v1/categories/:categorySlug/attributes
  Future<Map<String, dynamic>?> getCategoryAttributes(String categorySlug) async {
    try {
      final res = await _apiClient.get('/api/v1/categories/$categorySlug/attributes');
      if (res.success && res.data is Map<String, dynamic>) {
        return res.data as Map<String, dynamic>;
      }
    } catch (e) {
      debugPrint('[CatalogService] getCategoryAttributes error: $e');
    }
    return null;
  }

  /// Lấy giá trị thông số ngành hàng của một sản phẩm cụ thể
  /// GET /api/v1/products/:id/category-attributes
  Future<Map<String, dynamic>?> getProductCategoryAttributes(dynamic productId) async {
    try {
      final res = await _apiClient.get('/api/v1/products/$productId/category-attributes');
      if (res.success && res.data is Map<String, dynamic>) {
        return res.data as Map<String, dynamic>;
      }
    } catch (e) {
      debugPrint('[CatalogService] getProductCategoryAttributes error: $e');
    }
    return null;
  }
}

/// Kết quả tìm kiếm sản phẩm kèm metadata phân loại
class SearchResult {
  final List<Product> products;
  final bool isExactMatch;
  final String query;

  const SearchResult({
    required this.products,
    required this.isExactMatch,
    required this.query,
  });
}
