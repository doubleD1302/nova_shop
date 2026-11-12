import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../theme/app_colors.dart';

/// Slug API và alias dùng cùng hình vẽ với CategoryIcon của web.
class CategoryIcon extends StatelessWidget {
  final String slug;
  final double size;

  const CategoryIcon({super.key, required this.slug, this.size = 26});

  static const _assets = {
    'thoi-trang-nam': 'shirt',
    'thoi-trang-nu': 'dress',
    'dien-thoai': 'phone',
    'may-tinh': 'laptop',
    'phu-kien-cong-nghe': 'headphones',
    'dien-tu': 'headphones',
    'giay-dep': 'sneaker',
    'tui-xach': 'handbag',
    'tui-vi': 'handbag',
    'my-pham': 'beauty',
    'sac-dep': 'beauty',
    'nha-cua': 'home',
    'nha-cua-doi-song': 'home',
    'thiet-bi-gia-dung': 'home',
    'me-be': 'baby',
    'bach-hoa': 'basket',
    'the-thao': 'sport',
    'o-to-xe-may': 'car',
    'may-anh': 'camera',
  };

  @override
  Widget build(BuildContext context) => SvgPicture.asset(
    'assets/icons/${_assets[slug] ?? 'grid'}.svg',
    width: size,
    height: size,
    colorFilter: const ColorFilter.mode(AppColors.earth, BlendMode.srcIn),
    excludeFromSemantics: true,
  );
}
