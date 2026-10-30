import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../models/category_item.dart';
import '../models/product.dart';
import '../models/banner_item.dart';
import '../models/flash_sale_item.dart';
import '../data/website_data.dart';
import '../utils/product_image_resolver.dart';
import 'api_client.dart';
import 'api_config.dart';

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
  Future<List<CategoryItem>> getCategories({bool mergeWebsiteData = true}) async {
    List<CategoryItem> apiCategories = [];
    try {
      final res = await _client.get(
        Uri.parse(ApiConfig.categoriesUrl),
        headers: {'Accept': 'application/json'},
      ).timeout(const Duration(seconds: 5));

      if (res.statusCode == 200) {
        final Map<String, dynamic> body = jsonDecode(res.body);
        if (body['success'] == true && body['data'] is List) {
          final list = body['data'] as List;
          apiCategories = list.map((e) => CategoryItem.fromJson(e as Map<String, dynamic>)).toList();
        }
      }
    } catch (_) {}

    if (mergeWebsiteData) {
      // Hợp nhất để luôn hiển thị đầy đủ 12 ngành hàng, ưu tiên dữ liệu từ API
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
    if (response.success && response.data is List) {
      return (response.data as List).whereType<Map<String, dynamic>>().toList();
    }
    return [];
  }

  /// Lấy danh sách sản phẩm từ Backend API (Ưu tiên kết hợp dữ liệu thực từ MySQL và danh mục website)
  Future<List<Product>> getProducts({
    String? categoryId,
    bool? isFlashSale,
    bool? isFeatured,
    String? filterTab,
    bool mergeWebsiteData = true,
  }) async {
    List<Product> allProducts = [];

    try {
      final uri = Uri.parse(ApiConfig.productsUrl).replace(queryParameters: {
        if (categoryId != null && categoryId.isNotEmpty) 'categoryId': categoryId,
        if (isFlashSale != null) 'is_flash_sale': isFlashSale ? '1' : '0',
        if (isFeatured != null) 'is_featured': isFeatured ? '1' : '0',
        'limit': '100',
      });

      final res = await _client.get(
        uri,
        headers: {'Accept': 'application/json'},
      ).timeout(const Duration(seconds: 5));

      if (res.statusCode == 200) {
        final Map<String, dynamic> body = jsonDecode(res.body);
        if (body['success'] == true && body['data'] is List) {
          final list = body['data'] as List;
          allProducts = list.map((e) => Product.fromJson(e as Map<String, dynamic>)).toList();
        }
      }
    } catch (_) {}

    final productMap = <String, Product>{};
    if (mergeWebsiteData) {
      for (final p in WebsiteData.products) {
        productMap[p.id] = p;
      }
    }
    for (final p in allProducts) {
      // Giữ lại ảnh sắc nét nếu API trả về sản phẩm không có ảnh
      if (productMap.containsKey(p.id) && (p.imageUrl.isEmpty || !p.imageUrl.startsWith('http'))) {
        productMap[p.id] = p.copyWith(imageUrl: productMap[p.id]!.imageUrl);
      } else {
        productMap[p.id] = p;
      }
    }

    var result = productMap.values.toList();

    // Lọc theo danh mục với bộ so khớp thông minh
    if (categoryId != null && categoryId.isNotEmpty) {
      result = result.where((p) => matchesCategory(p, categoryId)).toList();
    }

    // Lọc theo Flash Sale
    if (isFlashSale == true) {
      result = result.where((p) => p.isFlashSale).toList();
    }

    // Lọc theo tab
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
  /// GET /api/v1/products?page=1&limit=24&categoryId=...&q=...&sort=...
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
    final queryParams = <String, String>{
      'page': page.toString(),
      'limit': limit.toString(),
    };

    if (categoryId != null && categoryId.isNotEmpty) queryParams['categoryId'] = categoryId;
    if (shopId != null && shopId.isNotEmpty) queryParams['shopId'] = shopId;
    if (q != null && q.trim().isNotEmpty) queryParams['q'] = q.trim();
    if (sort != null && sort.isNotEmpty) queryParams['sort'] = sort;
    if (minPrice != null && minPrice >= 0) queryParams['minPrice'] = minPrice.toInt().toString();
    if (maxPrice != null && maxPrice > 0) queryParams['maxPrice'] = maxPrice.toInt().toString();
    if (province != null && province.isNotEmpty) queryParams['province'] = province;
    if (mall == true) queryParams['mall'] = 'true';
    if (freeship == true) queryParams['freeship'] = 'true';

    final response = await _apiClient.get('/api/v1/products', queryParams: queryParams);

    if (response.success && response.data is List) {
      final list = (response.data as List)
          .whereType<Map<String, dynamic>>()
          .map((item) => Product.fromJson(item))
          .toList();

      return ProductListResult(
        products: list,
        page: (response.meta?['page'] as num?)?.toInt() ?? page,
        limit: (response.meta?['limit'] as num?)?.toInt() ?? limit,
        total: (response.meta?['total'] as num?)?.toInt() ?? list.length,
        totalPages: (response.meta?['totalPages'] as num?)?.toInt() ?? 1,
      );
    }

    return ProductListResult(products: [], page: page, limit: limit, total: 0, totalPages: 0);
  }

  /// Lấy danh sách banner khuyến mãi (kết hợp banner website)
  Future<List<BannerItem>> getBanners() async {
    try {
      final res = await _client.get(
        Uri.parse(ApiConfig.bannersUrl),
        headers: {'Accept': 'application/json'},
      ).timeout(const Duration(seconds: 5));

      if (res.statusCode == 200) {
        final Map<String, dynamic> body = jsonDecode(res.body);
        if (body['success'] == true && body['data'] is List) {
          final list = body['data'] as List;
          final apiBanners = list.map((e) => BannerItem.fromJson(e as Map<String, dynamic>)).toList();
          if (apiBanners.isNotEmpty) {
            return apiBanners;
          }
        }
      }
    } catch (_) {}
    return WebsiteData.banners;
  }

  /// Lấy danh sách sản phẩm Flash Sale từ Backend API
  Future<List<FlashSaleItem>> getFlashSaleItems() async {
    try {
      // 1. Ưu tiên lấy từ API Backend /api/v1/products/featured
      final featured = await getFeaturedHomeData();
      final flashList = featured['flashSale'];
      if (flashList is List && flashList.isNotEmpty) {
        return flashList.map((item) {
          final m = item as Map<String, dynamic>;
          final num price = num.tryParse(m['price']?.toString() ?? '') ?? 0;
          final num origPrice = num.tryParse(m['originalPrice']?.toString() ?? '') ?? price;
          final num discount = num.tryParse(m['discount']?.toString() ?? '') ??
              (origPrice > price && origPrice > 0 ? (((origPrice - price) / origPrice) * 100).round() : 0);
          final stock = num.tryParse(m['stock']?.toString() ?? '') ?? 50;

          final itemId = m['id']?.toString() ?? '';
          final itemName = m['name']?.toString() ?? 'Sản phẩm Flash Sale';
          final rawImg = m['imageUrl']?.toString() ?? '';
          final resolvedImg = ProductImageResolver.resolve(
            id: itemId,
            imageUrl: rawImg,
            name: itemName,
          );

          return FlashSaleItem(
            id: itemId,
            name: itemName,
            imageUrl: resolvedImg,
            price: price.toDouble(),
            discount: discount.toInt(),
            soldPercentage: 0.65,
            soldLabel: stock <= 10 ? 'SẮP CHÁY HÀNG' : 'ĐÃ BÁN 65%',
            emoji: '⚡',
          );
        }).toList();
      }

      // 2. Dự phòng lấy từ getProducts(isFlashSale: true)
      final products = await getProducts(isFlashSale: true);
      if (products.isNotEmpty) {
        return products.take(6).map((p) {
          return FlashSaleItem(
            id: p.id,
            name: p.name,
            imageUrl: p.effectiveImageUrl,
            price: p.price,
            discount: p.discount > 0 ? p.discount : 35,
            soldPercentage: p.soldPercent / 100.0,
            soldLabel: p.soldPercent >= 90 ? 'SẮP CHÁY HÀNG' : 'ĐÃ BÁN ${p.soldPercent}%',
            emoji: p.emoji,
          );
        }).toList();
      }
    } catch (e) {
      debugPrint('[CatalogService] getFlashSaleItems error: $e');
    }
    return WebsiteData.flashSales;
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

    // Fallback: Tìm trong danh mục dữ liệu chuẩn WebsiteData.products
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
        if (body['success'] == true && body['data'] is List) {
          final apiShops = List<Map<String, dynamic>>.from(body['data']);
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
  /// GET /api/v1/products/featured
  Future<Map<String, dynamic>> getFeaturedHomeData() async {
    final response = await _apiClient.get('/api/v1/products/featured');
    if (response.success && response.data is Map<String, dynamic>) {
      return response.data as Map<String, dynamic>;
    }
    return {'flashSale': [], 'featuredProducts': []};
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

    // 1. Khớp trực tiếp ID hoặc Tên
    if (pCatId == target || pCatName == target) return true;

    // 2. Bộ từ điển ánh xạ ngành hàng: slug <-> ID <-> tên đầy đủ <-> từ khóa nhận diện
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

    // Tìm canonical key cho target
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

    // 3. So khớp substring tên ngành hàng
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

    // 1. Thử gọi API Backend nếu có từ khóa q HOẶC có categoryId
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

    // 2. Dự phòng: Tìm kiếm trong WebsiteData.products
    if (results.isEmpty) {
      final all = WebsiteData.products;
      if (q.isEmpty) {
        results = List<Product>.from(all);
        isExact = true;
      } else {
        // Tìm khớp chính xác theo tên, danh mục, mô tả, shop
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
          // Tách từ khóa và tìm kiếm mờ (fuzzy search)
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
            // Không tìm thấy sản phẩm nào khớp: Gợi ý các sản phẩm phổ biến / hot nhất
            results = List<Product>.from(all)..sort((a, b) => b.rating.compareTo(a.rating));
            results = results.take(16).toList();
            isExact = false;
          }
        }
      }
    }

    // 3. Áp dụng bộ lọc Mall / Freeship / Category
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

    // 4. Sắp xếp kết quả
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
