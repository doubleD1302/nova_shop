/// Model đại diện cho Gian hàng trên sàn ShopNova
class Shop {
  final String id;
  final String name;
  final String slug;
  final String? logoUrl;
  final String? bannerUrl;
  final String? tagline;
  final String? description;
  final String province;
  final String? address;
  final bool isMall;
  final String status; // 'pending' | 'rejected' | 'active' | 'suspended' | 'closed'
  final int approvalVersion;
  final String? rejectionReason;
  final String? suspensionReason;
  final String? ownerId;
  final String? ownerName;
  final double rating;
  final int ratingCount;
  final int followersCount;
  final int productsCount;

  Shop({
    required this.id,
    required this.name,
    required this.slug,
    this.logoUrl,
    this.bannerUrl,
    this.tagline,
    this.description,
    required this.province,
    this.address,
    this.isMall = false,
    this.status = 'active',
    this.approvalVersion = 1,
    this.rejectionReason,
    this.suspensionReason,
    this.ownerId,
    this.ownerName,
    this.rating = 5.0,
    this.ratingCount = 0,
    this.followersCount = 0,
    this.productsCount = 0,
  });

  bool get isPending => status == 'pending';
  bool get isRejected => status == 'rejected';
  bool get isActive => status == 'active';
  bool get isSuspended => status == 'suspended';
  bool get isClosed => status == 'closed';

  factory Shop.fromJson(Map<String, dynamic> json) {
    return Shop(
      id: json['id']?.toString() ?? '',
      name: json['name'] as String? ?? '',
      slug: json['slug'] as String? ?? '',
      logoUrl: json['logoUrl'] as String?,
      bannerUrl: json['bannerUrl'] as String?,
      tagline: json['tagline'] as String?,
      description: json['description'] as String?,
      province: (json['province'] ?? json['location']) as String? ?? '',
      address: (json['address'] ?? json['address_detail']) as String?,
      isMall: (json['isMall'] ?? json['mall']) as bool? ?? false,
      status: json['status'] as String? ?? 'active',
      approvalVersion: (json['approvalVersion'] is num)
          ? (json['approvalVersion'] as num).toInt()
          : (int.tryParse(json['approval_version']?.toString() ?? '1') ?? 1),
      rejectionReason: (json['rejectionReason'] ?? json['rejection_reason']) as String?,
      suspensionReason: (json['suspensionReason'] ?? json['suspension_reason']) as String?,
      ownerId: (json['ownerId'] ?? json['owner_id'])?.toString(),
      ownerName: (json['ownerName'] ?? json['owner_name']) as String?,
      rating: (json['rating'] is num) ? (json['rating'] as num).toDouble() : 5.0,
      ratingCount: (json['ratingCount'] is num) ? (json['ratingCount'] as num).toInt() : 0,
      followersCount: (json['followersCount'] is num)
          ? (json['followersCount'] as num).toInt()
          : ((json['followers'] is num) ? (json['followers'] as num).toInt() : 0),
      productsCount: (json['productsCount'] is num)
          ? (json['productsCount'] as num).toInt()
          : ((json['productCount'] is num) ? (json['productCount'] as num).toInt() : 0),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'slug': slug,
      'logoUrl': logoUrl,
      'bannerUrl': bannerUrl,
      'tagline': tagline,
      'description': description,
      'province': province,
      'address': address,
      'isMall': isMall,
      'status': status,
      'approvalVersion': approvalVersion,
      'rejectionReason': rejectionReason,
      'suspensionReason': suspensionReason,
      'ownerId': ownerId,
      'ownerName': ownerName,
      'rating': rating,
      'ratingCount': ratingCount,
      'followersCount': followersCount,
      'productsCount': productsCount,
    };
  }

  Shop copyWith({
    String? id,
    String? name,
    String? slug,
    String? logoUrl,
    String? bannerUrl,
    String? tagline,
    String? description,
    String? province,
    String? address,
    bool? isMall,
    String? status,
    int? approvalVersion,
    String? rejectionReason,
    String? suspensionReason,
    String? ownerId,
    String? ownerName,
    double? rating,
    int? ratingCount,
    int? followersCount,
    int? productsCount,
  }) {
    return Shop(
      id: id ?? this.id,
      name: name ?? this.name,
      slug: slug ?? this.slug,
      logoUrl: logoUrl ?? this.logoUrl,
      bannerUrl: bannerUrl ?? this.bannerUrl,
      tagline: tagline ?? this.tagline,
      description: description ?? this.description,
      province: province ?? this.province,
      address: address ?? this.address,
      isMall: isMall ?? this.isMall,
      status: status ?? this.status,
      approvalVersion: approvalVersion ?? this.approvalVersion,
      rejectionReason: rejectionReason ?? this.rejectionReason,
      suspensionReason: suspensionReason ?? this.suspensionReason,
      ownerId: ownerId ?? this.ownerId,
      ownerName: ownerName ?? this.ownerName,
      rating: rating ?? this.rating,
      ratingCount: ratingCount ?? this.ratingCount,
      followersCount: followersCount ?? this.followersCount,
      productsCount: productsCount ?? this.productsCount,
    );
  }
}
