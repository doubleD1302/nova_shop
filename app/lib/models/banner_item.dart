import 'package:flutter/material.dart';

class BannerItem {
  final String id;
  final String imageUrl;
  final String title;
  final String subtitle;
  final Color backgroundColor;

  const BannerItem({
    required this.id,
    required this.imageUrl,
    required this.title,
    required this.subtitle,
    required this.backgroundColor,
  });

  factory BannerItem.fromJson(Map<String, dynamic> json) {
    Color bg = const Color(0xFFBD6E49);
    final colorHex = json['backgroundColor']?.toString();
    if (colorHex != null && colorHex.startsWith('#')) {
      final hex = colorHex.replaceFirst('#', '');
      final val = int.tryParse('FF$hex', radix: 16);
      if (val != null) {
        bg = Color(val);
      }
    }

    return BannerItem(
      id: json['id']?.toString() ?? '',
      imageUrl: json['imageUrl']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      subtitle: json['subtitle']?.toString() ?? '',
      backgroundColor: bg,
    );
  }
}
