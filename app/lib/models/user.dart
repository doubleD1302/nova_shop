class User {
  final String id;
  final String username;
  final String fullName;
  final String? email;
  final String? phone;
  final String? avatarUrl;
  final String role;
  final String status;
  final String? shopId;

  const User({
    required this.id,
    required this.username,
    required this.fullName,
    this.email,
    this.phone,
    this.avatarUrl,
    required this.role,
    this.status = 'active',
    this.shopId,
  });

  bool get isSeller => role == 'seller';
  bool get isBuyer => role == 'buyer';

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id']?.toString() ?? '',
      username: json['username']?.toString() ?? '',
      fullName: (json['fullName'] ?? json['full_name'] ?? json['username'] ?? '').toString(),
      email: json['email']?.toString(),
      phone: json['phone']?.toString(),
      avatarUrl: (json['avatarUrl'] ?? json['avatar_url'])?.toString(),
      role: json['role']?.toString() ?? 'buyer',
      status: json['status']?.toString() ?? 'active',
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

  User copyWith({
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
    return User(
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

typedef UserModel = User;
