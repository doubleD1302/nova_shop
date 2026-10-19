class UserModel {
  final String id;
  final String username;
  final String fullName;
  final String? email;
  final String? phone;
  final String? avatarUrl;
  final String role;
  final String status;
  final String? shopId;

  const UserModel({
    required this.id,
    required this.username,
    required this.fullName,
    this.email,
    this.phone,
    this.avatarUrl,
    required this.role,
    required this.status,
    this.shopId,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id']?.toString() ?? '',
      username: json['username'] as String? ?? '',
      fullName: (json['fullName'] ?? json['full_name'] ?? '') as String,
      email: json['email'] as String?,
      phone: json['phone'] as String?,
      avatarUrl: (json['avatarUrl'] ?? json['avatar_url']) as String?,
      role: json['role'] as String? ?? 'buyer',
      status: json['status'] as String? ?? 'active',
      shopId: json['shopId']?.toString() ?? json['shop_id']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'username': username,
    'fullName': fullName,
    'email': email,
    'phone': phone,
    'avatarUrl': avatarUrl,
    'role': role,
    'status': status,
    'shopId': shopId,
  };

  UserModel copyWith({
    String? id,
    String? username,
    String? fullName,
    String? email,
    String? phone,
    String? avatarUrl,
    String? role,
    String? status,
    String? shopId,
  }) {
    return UserModel(
      id: id ?? this.id,
      username: username ?? this.username,
      fullName: fullName ?? this.fullName,
      email: email ?? this.email,
      phone: phone ?? this.phone,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      role: role ?? this.role,
      status: status ?? this.status,
      shopId: shopId ?? this.shopId,
    );
  }
}
