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
}
