import 'package:flutter/material.dart';

/// Bảng màu chuẩn Terracotta + Cream của ShopNova
/// Đồng bộ 100% với CSS design tokens trên website https://novashop-web-delta.vercel.app/
class AppColors {
  AppColors._();

  // 1. Màu thương hiệu chủ đạo (Terracotta)
  static const Color primary = Color(0xFFBD6E49);
  static const Color primaryDark = Color(0xFFA95532);
  static const Color primaryLight = Color(0xFFC97D58);
  static const Color earth = Color(0xFF80513B);
  static const Color secondary = Color(0xFFF5E7D4);

  // 2. Màu nền & Bề mặt (Warm Cream & Ivory White)
  static const Color background = Color(0xFFFBF3E8);
  static const Color surface = Color(0xFFFFFCF7);
  static const Color surfaceAlt = Color(0xFFF5E7D4);
  static const Color productCard = Color(0xFFF4E6D2);
  static const Color border = Color(0xFFE6D5C2);
  static const Color divider = Color(0xFFE6D5C2);

  // 3. Màu chữ (Ink & Muted Terracotta Brown)
  static const Color textPrimary = Color(0xFF49352D);
  static const Color textSecondary = Color(0xFF8B7566);
  static const Color textHint = Color(0xFFB09F91);

  // 4. Các nhãn trạng thái, khuyến mãi & điểm nhấn
  static const Color starYellow = Color(0xFFE5A83B);
  static const Color flashSaleRed = Color(0xFFB93832);
  static const Color flashSaleYellow = Color(0xFFE5A83B);
  static const Color discountBadge = Color(0xFFB93832);
  static const Color freeshipGreen = Color(0xFF547653);
  static const Color mallTerracotta = Color(0xFFBD6E49);
  static const Color mallBlue = Color(0xFFBD6E49);
  static const Color priceRed = Color(0xFFBD6E49);
  static const Color originalPriceGrey = Color(0xFF8B7566);
  static const Color progressBarBg = Color(0xFFF5E7D4);
  static const Color progressBarFill = Color(0xFFBD6E49);
  static const Color bottomNavInactive = Color(0xFF8B7566);
}
