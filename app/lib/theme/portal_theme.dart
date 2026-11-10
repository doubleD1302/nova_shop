import 'package:flutter/material.dart';
import 'app_colors.dart';

/// Bảng màu và ThemeData dùng chung cho Kênh Người Bán (SellerTheme) và Cổng Quản Trị (AdminTheme)
/// Kế thừa trực tiếp từ AppColors để đồng bộ 100% với Website và Chế độ Người mua trong cùng 1 ứng dụng.
class SellerTheme {
  static const Color background = AppColors.background;
  static const Color card = AppColors.surface;
  static const Color surfaceSubtle = AppColors.surfaceAlt;
  static const Color border = AppColors.border;
  static const Color primary = AppColors.primaryDark;
  static const Color primaryHover = AppColors.primary;
  static const Color textPrimary = AppColors.textPrimary;
  static const Color textSecondary = AppColors.textSecondary;
  static const Color success = Color(0xFF547653);
  static const Color successBg = Color(0xFFEDF4ED);
  static const Color warning = Color(0xFFB45309);
  static const Color warningBg = Color(0xFFFEF3C7);
  static const Color danger = Color(0xFFBE123C);
  static const Color dangerBg = Color(0xFFFFE4E6);
  static const Color info = Color(0xFF1D4ED8);
  static const Color infoBg = Color(0xFFEFF6FF);

  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      scaffoldBackgroundColor: background,
      primaryColor: primary,
      colorScheme: ColorScheme.fromSeed(
        seedColor: primary,
        primary: primary,
        surface: card,
        onSurface: textPrimary,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: card,
        foregroundColor: textPrimary,
        elevation: 0,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
      ),
      cardTheme: CardThemeData(
        color: card,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: border, width: 1),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primary,
          foregroundColor: Colors.white,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: primary,
          side: const BorderSide(color: border, width: 1),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          textStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: card,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: border, width: 1),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: border, width: 1),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: primaryHover, width: 2),
        ),
        labelStyle: const TextStyle(color: textSecondary, fontSize: 13),
        hintStyle: const TextStyle(color: textSecondary, fontSize: 13),
      ),
    );
  }
}

class AdminTheme {
  static const Color background = AppColors.background;
  static const Color card = AppColors.surface;
  static const Color surfaceSubtle = AppColors.surfaceAlt;
  static const Color border = AppColors.border;
  static const Color primary = AppColors.primaryDark;
  static const Color primaryHover = AppColors.primary;
  static const Color textPrimary = AppColors.textPrimary;
  static const Color textSecondary = AppColors.textSecondary;
  static const Color success = Color(0xFF547653);
  static const Color successBg = Color(0xFFEDF4ED);
  static const Color warning = Color(0xFFB45309);
  static const Color warningBg = Color(0xFFFEF3C7);
  static const Color danger = Color(0xFFBE123C);
  static const Color dangerBg = Color(0xFFFFE4E6);
  static const Color info = Color(0xFF1D4ED8);
  static const Color infoBg = Color(0xFFEFF6FF);

  static ThemeData get lightTheme => SellerTheme.lightTheme;
}
