import 'package:flutter/material.dart';

class CategoryItem {
  final String id;
  final String name;
  final IconData icon;
  final Color? backgroundColor;
  final String? imageUrl;
  final String? slug;
  final int productCount;

  const CategoryItem({
    required this.id,
    required this.name,
    required this.icon,
    this.backgroundColor,
    this.imageUrl,
    this.slug,
    this.productCount = 0,
  });

  factory CategoryItem.fromJson(Map<String, dynamic> json) {
    final slug = json['slug']?.toString() ?? '';
    final name = json['name']?.toString() ?? '';
    final countRaw = json['productCount'] ?? json['product_count'];
    final productCount = (countRaw is num)
        ? countRaw.toInt()
        : (int.tryParse(countRaw?.toString() ?? '') ?? 0);

    final key = slug.toLowerCase();
    IconData icon = Icons.category_outlined;
    if (key.contains('thoi-trang-nam')) {
      icon = Icons.checkroom;
    } else if (key.contains('thoi-trang-nu')) {
      icon = Icons.woman;
    } else if (key.contains('dien-thoai')) {
      icon = Icons.phone_android;
    } else if (key.contains('may-tinh')) {
      icon = Icons.laptop_chromebook;
    } else if (key.contains('phu-kien-cong-nghe') || key.contains('cong-nghe')) {
      icon = Icons.headphones;
    } else if (key.contains('gia-dung')) {
      icon = Icons.kitchen;
    } else if (key.contains('sac-dep') || key.contains('my-pham')) {
      icon = Icons.spa;
    } else if (key.contains('nha-cua')) {
      icon = Icons.chair;
    } else if (key.contains('me-be')) {
      icon = Icons.child_care;
    } else if (key.contains('giay')) {
      icon = Icons.ice_skating_outlined;
    } else if (key.contains('tui')) {
      icon = Icons.work_outline;
    } else if (key.contains('bach-hoa')) {
      icon = Icons.shopping_basket_outlined;
    } else if (key.contains('the-thao')) {
      icon = Icons.sports_soccer_outlined;
    } else if (key.contains('dong-ho')) {
      icon = Icons.watch_outlined;
    } else if (key.contains('may-anh')) {
      icon = Icons.camera_alt_outlined;
    } else if (key.contains('o-to') || key.contains('xe')) {
      icon = Icons.directions_car_outlined;
    }

    return CategoryItem(
      id: json['id']?.toString() ?? '',
      name: name,
      icon: icon,
      imageUrl: json['imageUrl']?.toString(),
      slug: slug,
      productCount: productCount,
    );
  }
}
