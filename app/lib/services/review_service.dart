import 'api_client.dart';

/// Dữ liệu một đánh giá sản phẩm
class ProductReview {
  final String id;
  final String orderItemId;
  final String productId;
  final int rating;
  final String comment;
  final String reviewerName;
  final String? reviewerAvatar;
  final List<String> images;
  final String? sellerReply;
  final DateTime? repliedAt;
  final DateTime? createdAt;

  ProductReview({
    required this.id,
    required this.orderItemId,
    required this.productId,
    required this.rating,
    required this.comment,
    required this.reviewerName,
    this.reviewerAvatar,
    required this.images,
    this.sellerReply,
    this.repliedAt,
    this.createdAt,
  });

  factory ProductReview.fromJson(Map<String, dynamic> json) {
    final user = json['user'] as Map<String, dynamic>? ?? {};
    final imagesList = (json['images'] as List?)?.map((e) => e.toString()).toList() ?? [];

    return ProductReview(
      id: json['id']?.toString() ?? '',
      orderItemId: json['orderItemId']?.toString() ?? '',
      productId: json['productId']?.toString() ?? '',
      rating: (json['rating'] as num?)?.toInt() ?? 5,
      comment: json['comment']?.toString() ?? '',
      reviewerName: user['fullName']?.toString() ?? 'Người mua ẩn danh',
      reviewerAvatar: user['avatarUrl']?.toString(),
      images: imagesList,
      sellerReply: json['sellerReply']?.toString(),
      repliedAt: json['repliedAt'] != null ? DateTime.tryParse(json['repliedAt'].toString()) : null,
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt'].toString()) : null,
    );
  }
}

/// Kết quả phân trang danh sách đánh giá
class ProductReviewResult {
  final double averageRating;
  final int totalReviews;
  final List<ProductReview> reviews;

  ProductReviewResult({
    required this.averageRating,
    required this.totalReviews,
    required this.reviews,
  });
}

/// Service tương tác với Review API của ShopNova Backend
class ReviewService {
  static final ReviewService _instance = ReviewService._internal();
  factory ReviewService() => _instance;
  ReviewService._internal();

  final ApiClient _client = ApiClient();

  /// Lấy danh sách đánh giá của sản phẩm
  /// GET /api/v1/products/:productId/reviews
  Future<ProductReviewResult> getReviews(String productId, {int page = 1, int limit = 10}) async {
    final response = await _client.get(
      '/api/v1/products/$productId/reviews',
      queryParams: {'page': page.toString(), 'limit': limit.toString()},
    );

    if (response.success && response.data is Map<String, dynamic>) {
      final map = response.data as Map<String, dynamic>;
      final rawList = map['reviews'] as List? ?? [];
      final reviews = rawList
          .whereType<Map<String, dynamic>>()
          .map((item) => ProductReview.fromJson(item))
          .toList();

      return ProductReviewResult(
        averageRating: (map['averageRating'] as num?)?.toDouble() ?? 5.0,
        totalReviews: (map['totalReviews'] as num?)?.toInt() ?? reviews.length,
        reviews: reviews,
      );
    }

    return ProductReviewResult(averageRating: 5.0, totalReviews: 0, reviews: []);
  }

  /// Gửi đánh giá cho sản phẩm đã nhận hàng
  /// POST /api/v1/reviews
  Future<ApiResponse> createReview({
    required String orderItemId,
    required int rating,
    required String comment,
    List<String> images = const [],
  }) async {
    return await _client.post(
      '/api/v1/reviews',
      body: {
        'orderItemId': orderItemId,
        'rating': rating,
        'comment': comment,
        'images': images,
      },
    );
  }
}
