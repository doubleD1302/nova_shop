import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/category_item.dart';
import '../models/product.dart';
import '../models/banner_item.dart';
import '../models/flash_sale_item.dart';
import '../data/website_data.dart';
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

  /// Lấy danh sách danh mục sản phẩm từ Backend API (kết hợp dữ liệu chuẩn của website)
  Future<List<CategoryItem>> getCategories({bool mergeWebsiteData = true}) async {
    try {
      final res = await _client.get(
        Uri.parse(ApiConfig.categoriesUrl),
        headers: {'Accept': 'application/json'},
      ).timeout(const Duration(seconds: 5));

      if (res.statusCode == 200) {
        final Map<String, dynamic> body = jsonDecode(res.body);
        if (body['success'] == true && body['data'] is List) {
          final list = body['data'] as List;
          final apiCategories = list.map((e) => CategoryItem.fromJson(e as Map<String, dynamic>)).toList();
          if (!mergeWebsiteData) return apiCategories;
          if (apiCategories.isNotEmpty) {
            // Hợp nhất dữ liệu danh mục: ưu tiên API nhưng giữ đủ 12 danh mục website
            final merged = List<CategoryItem>.from(apiCategories);
            for (final cat in WebsiteData.categories) {
              if (!merged.any((c) => c.slug == cat.slug || c.id == cat.id)) {
                merged.add(cat);
              }
            }
            return merged;
          }
        }
      }
    } catch (_) {}
    return mergeWebsiteData ? WebsiteData.categories : [];
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

  /// Lấy danh sách sản phẩm từ Backend API (kết hợp trọn vẹn 60 sản phẩm của website)
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
        if (categoryId != null) 'category_id': categoryId,
        if (isFlashSale != null) 'is_flash_sale': isFlashSale ? '1' : '0',
        if (isFeatured != null) 'is_featured': isFeatured ? '1' : '0',
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

    if (!mergeWebsiteData) {
      var result = allProducts;
      if (categoryId != null && categoryId.isNotEmpty) {
        result = result.where((p) => p.categoryId == categoryId || p.categoryName.toLowerCase().contains(categoryId.toLowerCase())).toList();
      }
      if (isFlashSale == true) {
        result = result.where((p) => p.isFlashSale).toList();
      }
      return result;
    }

    // Hợp nhất với danh mục 60 sản phẩm gốc của Website
    final productMap = <String, Product>{};
    for (final p in WebsiteData.products) {
      productMap[p.id] = p;
    }
    for (final p in allProducts) {
      productMap[p.id] = p;
    }
    var result = productMap.values.toList();

    // Lọc theo danh mục
    if (categoryId != null && categoryId.isNotEmpty) {
      result = result.where((p) => p.categoryId == categoryId || p.categoryName.toLowerCase().contains(categoryId.toLowerCase())).toList();
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

  /// Lấy danh sách sản phẩm Flash Sale từ Backend API hoặc Website Data
  Future<List<FlashSaleItem>> getFlashSaleItems() async {
    try {
      final products = await getProducts(isFlashSale: true);
      if (products.isNotEmpty) {
        return products.take(6).map((p) {
          return FlashSaleItem(
            id: p.id,
            name: p.name,
            imageUrl: p.imageUrl,
            price: p.price,
            discount: p.discount > 0 ? p.discount : 35,
            soldPercentage: p.soldPercent / 100.0,
            soldLabel: p.soldPercent >= 90 ? 'SẮP CHÁY HÀNG' : 'ĐÃ BÁN ${p.soldPercent}%',
            emoji: p.emoji,
          );
        }).toList();
      }
    } catch (_) {}
    return WebsiteData.flashSales;
  }

  /// Lấy chi tiết sản phẩm
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

    // Tìm trong dữ liệu Website
    final match = WebsiteData.products.where((p) => p.id == id).toList();
    if (match.isNotEmpty) {
      return match.first;
    }
    return null;
  }

  /// Lấy danh sách gian hàng từ Backend API hoặc Website Data
  Future<List<Map<String, dynamic>>> getShops() async {
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

    return WebsiteData.shops.map((s) => {
      'id': s.id,
      'name': s.name,
      'isMall': s.isMall,
      'rating': s.rating,
      'followers': s.followers,
      'location': s.location,
      'tagline': s.tagline,
      'emoji': s.emoji,
    }).toList();
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
}
