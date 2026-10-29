import 'package:flutter/material.dart';

class CategoryItem {
  final String id;
  final String name;
  final IconData icon;
  final Color? backgroundColor;

  const CategoryItem({
    required this.id,
    required this.name,
    required this.icon,
    this.backgroundColor,
  });
}
