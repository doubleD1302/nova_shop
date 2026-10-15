class User {
  final String id;
  final String username;
  final String fullName;
  final String? email;
  final String? phone;
  final String? avatarUrl;
  final String role;
  final String? shopId;

  const User({
    required this.id,
    required this.username,
    required this.fullName,
    this.email,
    this.phone,
    this.avatarUrl,
    required this.role,
    this.shopId,
  });

  bool get isSeller => role == 'seller';
  bool get isBuyer => role == 'buyer';

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id']?.toString() ?? '',
      username: json['username']?.toString() ?? '',
      fullName: json['fullName']?.toString() ?? json['username']?.toString() ?? '',
      email: json['email']?.toString(),
      phone: json['phone']?.toString(),
      avatarUrl: json['avatarUrl']?.toString(),
      role: json['role']?.toString() ?? 'buyer',
      shopId: json['shopId']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'username': username,
      'fullName': fullName,
      'email': email,
      'phone': phone,
      'avatarUrl': avatarUrl,
      'role': role,
      'shopId': shopId,
    };
  }
}
