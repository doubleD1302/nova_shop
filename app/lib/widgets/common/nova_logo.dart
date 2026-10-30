import 'package:flutter/material.dart';
import '../../theme/app_colors.dart';

/// Logo thương hiệu NovaShop chính thức
/// Đồng bộ 100% với website https://novashop-web-delta.vercel.app/
class NovaLogo extends StatelessWidget {
  final double size;
  final double fontSize;
  final bool showText;
  final String? subtitle;
  final VoidCallback? onTap;

  const NovaLogo({
    super.key,
    this.size = 34,
    this.fontSize = 20,
    this.showText = true,
    this.subtitle,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    Widget content = Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        // Hình ảnh logo NovaShop chính thức
        ClipRRect(
          borderRadius: BorderRadius.circular(size * 0.22),
          child: Image.asset(
            'assets/images/logo.png',
            width: size,
            height: size,
            fit: BoxFit.contain,
            errorBuilder: (context, error, stackTrace) {
              return Container(
                width: size,
                height: size,
                decoration: BoxDecoration(
                  color: AppColors.surfaceAlt,
                  borderRadius: BorderRadius.circular(size * 0.22),
                  border: Border.all(color: AppColors.border, width: 0.8),
                ),
                child: Center(
                  child: Icon(
                    Icons.storefront_rounded,
                    color: AppColors.primary,
                    size: size * 0.65,
                  ),
                ),
              );
            },
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
                        color: AppColors.textPrimary,
                        fontSize: fontSize,
                        fontWeight: FontWeight.w900,
                        letterSpacing: -0.4,
                      ),
                    ),
                    TextSpan(
                      text: 'Shop',
                      style: TextStyle(
                        color: AppColors.primary,
                        fontSize: fontSize,
                        fontWeight: FontWeight.w900,
                        letterSpacing: -0.4,
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
                    color: AppColors.textSecondary,
                    fontSize: 10.5,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.2,
                  ),
                ),
              ],
            ],
          ),
        ],
      ],
    );

    if (onTap != null) {
      return InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: content,
      );
    }

    return content;
  }
}
