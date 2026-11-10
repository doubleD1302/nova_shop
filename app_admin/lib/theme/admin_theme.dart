import 'package:flutter/material.dart';

class AdminTheme {
  // Bảng màu chuẩn ShopNova Quản Trị Hệ Thống (Thống nhất với AdminPage.jsx trên website)
  static const Color background = Color(0xFFFBF3E8);
  static const Color card = Color(0xFFFFFCF7);
  static const Color surfaceSubtle = Color(0xFFF5E7D4);
  static const Color border = Color(0xFFE6D5C2);
  static const Color primary = Color(0xFFA95532); // Terracotta ShopNova
  static const Color primaryHover = Color(0xFFBD6E49);
  static const Color textPrimary = Color(0xFF49352D); // Dark mocha
  static const Color textSecondary = Color(0xFF8B7566); // Warm taupe
  static const Color success = Color(0xFF547653); // Sage green
  static const Color successBg = Color(0xFFEDF4ED);
  static const Color warning = Color(0xFFB45309); // Amber
  static const Color warningBg = Color(0xFFFEF3C7);
  static const Color danger = Color(0xFFBE123C); // Crimson rose
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
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: primary,
          side: const BorderSide(color: border, width: 1),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          textStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12.5),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: card,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
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
