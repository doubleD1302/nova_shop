import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../models/category_item.dart';
import '../models/product.dart';
import '../models/banner_item.dart';
import '../models/flash_sale_item.dart';
import '../data/website_data.dart';
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
  final bool _hasCustomClient;
  final ApiClient _apiClient = ApiClient();

  CatalogService._internal({http.Client? client})
      : _client = client ?? http.Client(),
        _hasCustomClient = client != null;

  /// Lấy danh sách danh mục sản phẩm trực tiếp từ Backend API (không dùng dữ liệu tĩnh)
  Future<List<CategoryItem>> getCategories({bool mergeWebsiteData = false}) async {
    try {
      final res = await _client.get(
        Uri.parse(ApiConfig.categoriesUrl),
        headers: {'Accept': 'application/json'},
      ).timeout(const Duration(seconds: 8));

      if (res.statusCode == 200) {
        final Map<String, dynamic> body = jsonDecode(res.body);
        if (body['success'] == true && body['data'] != null) {
          final list = _extractList(body['data'], 'categories');
          return list
              .whereType<Map<String, dynamic>>()
              .map((e) => CategoryItem.fromJson(e))
              .toList();
        }
      }
    } catch (e) {
      debugPrint('[CatalogService] getCategories error: $e');
    }
    return [];
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

  /// Lấy danh sách sản phẩm trực tiếp từ Backend API (không dùng dữ liệu tĩnh)
  Future<List<Product>> getProducts({
    String? categoryId,
    bool? isFlashSale,
    bool? isFeatured,
    String? filterTab,
    bool mergeWebsiteData = false,
  }) async {
    List<Product> result = [];

    try {
      final uri = Uri.parse(ApiConfig.productsUrl).replace(queryParameters: {
        if (categoryId != null && categoryId.isNotEmpty) 'categoryId': categoryId,
        if (isFlashSale == true) 'flash': '1',
        'limit': '100',
      });

      final res = await _client.get(
        uri,
        headers: {'Accept': 'application/json'},
      ).timeout(const Duration(seconds: 8));

      if (res.statusCode == 200) {
        final Map<String, dynamic> body = jsonDecode(res.body);
        if (body['success'] == true && body['data'] != null) {
          final list = _extractList(body['data'], 'products');
          result = list
              .whereType<Map<String, dynamic>>()
              .map((e) => Product.fromJson(e))
              .toList();
        }
      }
    } catch (e) {
      debugPrint('[CatalogService] getProducts error: $e');
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
        result = result.where((p) => p.discount > 0).toList();
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

    dynamic responseData;
    Map<String, dynamic>? responseMeta;
    bool isSuccess = false;

    if (_hasCustomClient) {
      try {
        final uri = Uri.parse(ApiConfig.productsUrl).replace(queryParameters: queryParams);
        final res = await _client.get(uri, headers: {'Accept': 'application/json'}).timeout(const Duration(seconds: 8));
        if (res.statusCode == 200) {
          final body = jsonDecode(res.body);
          if (body is Map<String, dynamic> && body['success'] == true) {
            isSuccess = true;
            responseData = body['data'];
            if (body['meta'] is Map<String, dynamic>) {
              responseMeta = body['meta'] as Map<String, dynamic>;
            }
          }
        }
      } catch (e) {
        debugPrint('[CatalogService] getProductsPaginated error: $e');
      }
    } else {
      final response = await _apiClient.get('/api/v1/products', queryParams: queryParams);
      isSuccess = response.success;
      responseData = response.data;
      responseMeta = response.meta;
    }

    if (isSuccess && responseData != null) {
      final list = _extractList(responseData, 'products')
          .whereType<Map<String, dynamic>>()
          .map((item) => Product.fromJson(item))
          .toList();

      int total = list.length;
      if (responseData is Map && responseData['total'] is num) {
        total = (responseData['total'] as num).toInt();
      } else if (responseMeta?['total'] is num) {
        total = (responseMeta!['total'] as num).toInt();
      }

      return ProductListResult(
        products: list,
        page: (responseMeta?['page'] as num?)?.toInt() ?? page,
        limit: (responseMeta?['limit'] as num?)?.toInt() ?? limit,
        total: total,
        totalPages: (total / (limit > 0 ? limit : 1)).ceil(),
      );
    }

    return ProductListResult(products: [], page: page, limit: limit, total: 0, totalPages: 0);
  }

  /// Lấy danh sách banner điều hướng giao diện chuẩn của Website
  Future<List<BannerItem>> getBanners() async {
    return WebsiteData.banners;
  }

  /// Lấy danh sách sản phẩm Flash Sale từ sản phẩm thật trên Backend API
  Future<List<FlashSaleItem>> getFlashSaleItems() async {
    try {
      final apiProducts = await getProducts();
      if (apiProducts.isNotEmpty) {
        return FlashSaleRotator.rotateItems(apiProducts: apiProducts, count: 6);
      }
    } catch (e) {
      debugPrint('[CatalogService] getFlashSaleItems error: $e');
    }
    return [];
  }

  /// Lấy chi tiết sản phẩm trực tiếp từ Backend API (không fallback dữ liệu tĩnh)
  Future<Product?> getProductDetail(String id) async {
    try {
      final res = await _client.get(
        Uri.parse('${ApiConfig.productsUrl}/$id'),
        headers: {'Accept': 'application/json'},
      ).timeout(const Duration(seconds: 8));

      if (res.statusCode == 200) {
        final Map<String, dynamic> body = jsonDecode(res.body);
        if (body['success'] == true && body['data'] is Map) {
          return Product.fromJson(body['data'] as Map<String, dynamic>);
        }
      }
    } catch (e) {
      debugPrint('[CatalogService] getProductDetail error: $e');
    }
    return null;
  }

  /// Lấy danh sách gian hàng trực tiếp từ Backend API
  Future<List<Map<String, dynamic>>> getShops({bool mergeWebsiteData = false}) async {
    try {
      final res = await _client.get(
        Uri.parse(ApiConfig.shopsUrl),
        headers: {'Accept': 'application/json'},
      ).timeout(const Duration(seconds: 8));

      if (res.statusCode == 200) {
        final Map<String, dynamic> body = jsonDecode(res.body);
        if (body['success'] == true && body['data'] != null) {
          final list = _extractList(body['data'], 'shops');
          return list.whereType<Map<String, dynamic>>().toList();
        }
      }
    } catch (e) {
      debugPrint('[CatalogService] getShops error: $e');
    }
    return [];
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

  /// Lấy 4 thông tin sàn (Commitments) như trên Website
  List<CommitmentItem> getCommitments() {
    return WebsiteData.commitments;
  }

  /// So khớp sản phẩm với ngành hàng / danh mục
  static bool matchesCategory(Product p, String categoryTarget) {
    final target = categoryTarget.trim().toLowerCase();
    if (target.isEmpty) return true;

    final pCatId = p.categoryId.trim().toLowerCase();
    final pCatName = p.categoryName.trim().toLowerCase();

    if (pCatId == target || pCatName == target) return true;
    if (pCatName.contains(target) || target.contains(pCatName)) return true;

    return false;
  }

  /// Tìm kiếm sản phẩm trực tiếp qua Backend API (không fallback dữ liệu tĩnh)
  Future<SearchResult> searchProducts(
    String query, {
    String? sort,
    bool? mall,
    bool? freeship,
    String? categoryId,
  }) async {
    final q = query.trim();
    try {
      final apiResult = await getProductsPaginated(
        q: q.isNotEmpty ? q : null,
        sort: sort,
        mall: mall,
        freeship: freeship,
        categoryId: categoryId,
        limit: 60,
      );

      return SearchResult(
        products: apiResult.products,
        isExactMatch: true,
        query: query,
      );
    } catch (e) {
      debugPrint('[CatalogService] searchProducts error: $e');
      return SearchResult(products: [], isExactMatch: true, query: query);
    }
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
