import 'package:flutter/material.dart';

class CategoryItem {
  final String id;
  final String name;
  final IconData icon;
  final Color? backgroundColor;
  final String? imageUrl;
  final String? slug;

  const CategoryItem({
    required this.id,
    required this.name,
    required this.icon,
    this.backgroundColor,
    this.imageUrl,
    this.slug,
  });

  factory CategoryItem.fromJson(Map<String, dynamic> json) {
    final slug = json['slug']?.toString() ?? '';
    final name = json['name']?.toString() ?? '';

    IconData icon = Icons.category_outlined;
    if (slug.contains('thoi-trang-nam')) {
      icon = Icons.checkroom;
    } else if (slug.contains('dien-thoai')) {
      icon = Icons.phone_android;
    } else if (slug.contains('may-tinh')) {
      icon = Icons.laptop_chromebook;
    } else if (slug.contains('gia-dung')) {
      icon = Icons.kitchen;
    } else if (slug.contains('sac-dep')) {
      icon = Icons.spa;
    } else if (slug.contains('thoi-trang-nu')) {
      icon = Icons.woman;
    } else if (slug.contains('nha-cua')) {
      icon = Icons.chair;
    } else if (slug.contains('me-be')) {
      icon = Icons.child_care;
    }

    return CategoryItem(
      id: json['id']?.toString() ?? '',
      name: name,
      icon: icon,
      imageUrl: json['imageUrl']?.toString(),
      slug: slug,
    );
  }
}
