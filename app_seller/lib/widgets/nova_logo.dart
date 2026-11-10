import 'package:flutter/material.dart';
import '../theme/seller_theme.dart';

class NovaLogo extends StatelessWidget {
  final double size;
  final double fontSize;
  final bool showText;
  final String? subtitle;

  const NovaLogo({
    super.key,
    this.size = 38,
    this.fontSize = 20,
    this.showText = true,
    this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        // Ảnh logo NovaShop chính thức từ Website
        ClipRRect(
          borderRadius: BorderRadius.circular(size * 0.24),
          child: Image.asset(
            'assets/images/logo.png',
            width: size,
            height: size,
            fit: BoxFit.contain,
            errorBuilder: (_, __, ___) => Container(
              width: size,
              height: size,
              decoration: BoxDecoration(
                color: SellerTheme.surfaceSubtle,
                borderRadius: BorderRadius.circular(size * 0.24),
                border: Border.all(color: SellerTheme.border),
              ),
              child: Icon(Icons.storefront_rounded, size: size * 0.6, color: SellerTheme.primary),
            ),
          ),
        ),
        if (showText) ...[
          const SizedBox(width: 8),
          Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              RichText(
                text: TextSpan(
                  children: [
                    TextSpan(
                      text: 'Nova',
                      style: TextStyle(
                        fontSize: fontSize,
                        fontWeight: FontWeight.w900,
                        color: SellerTheme.textPrimary,
                        letterSpacing: -0.5,
                      ),
                    ),
                    TextSpan(
                      text: 'Shop',
                      style: TextStyle(
                        fontSize: fontSize,
                        fontWeight: FontWeight.w900,
                        color: SellerTheme.primaryHover,
                        letterSpacing: -0.5,
                      ),
                    ),
                  ],
                ),
              ),
              if (subtitle != null && subtitle!.isNotEmpty) ...[
                const SizedBox(height: 1),
                Text(
                  subtitle!,
                  style: const TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w600,
                    color: SellerTheme.textSecondary,
                  ),
                ),
              ],
            ],
          ),
        ],
      ],
    );
  }
}
