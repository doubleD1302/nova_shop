/// Model đại diện cho địa chỉ nhận hàng của người dùng
class Address {
  final String id;
  final String userId;
  final String recipientName;
  final String phone;
  final String province;
  final String? district;
  final String? ward;
  final String detail;
  final bool isDefault;
  final String? createdAt;
  final String? updatedAt;

  Address({
    required this.id,
    required this.userId,
    required this.recipientName,
    required this.phone,
    required this.province,
    this.district,
    this.ward,
    required this.detail,
    this.isDefault = false,
    this.createdAt,
    this.updatedAt,
  });

  factory Address.fromJson(Map<String, dynamic> json) {
    return Address(
      id: json['id']?.toString() ?? '',
      userId: json['userId']?.toString() ?? '',
      recipientName: json['recipientName'] as String? ?? '',
      phone: json['phone'] as String? ?? '',
      province: json['province'] as String? ?? '',
      district: json['district'] as String?,
      ward: json['ward'] as String?,
      detail: json['detail'] as String? ?? '',
      isDefault: json['isDefault'] as bool? ?? false,
      createdAt: json['createdAt'] as String?,
      updatedAt: json['updatedAt'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'userId': userId,
      'recipientName': recipientName,
      'phone': phone,
      'province': province,
      'district': district,
      'ward': ward,
      'detail': detail,
      'isDefault': isDefault,
    };
  }

  /// Trả về chuỗi địa chỉ đầy đủ để hiển thị lên UI
  String get fullAddress {
    final parts = [
      detail,
      if (ward != null && ward!.isNotEmpty) ward,
      if (district != null && district!.isNotEmpty) district,
      province,
    ];
    return parts.where((p) => p != null && p.isNotEmpty).join(', ');
  }
}
