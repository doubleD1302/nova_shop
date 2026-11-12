import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// Dùng cùng bản SVG với header và trạng thái trống của Nova trên web.
class NovaMark extends StatelessWidget {
  final double size;

  const NovaMark({super.key, this.size = 28});

  @override
  Widget build(BuildContext context) => SvgPicture.asset(
    'assets/images/nova-mark.svg',
    width: size,
    height: size,
    excludeFromSemantics: true,
  );
}

class NovaNotes extends StatelessWidget {
  final double width;

  const NovaNotes({super.key, this.width = 190});

  @override
  Widget build(BuildContext context) => SvgPicture.asset(
    'assets/images/nova-notes.svg',
    width: width,
    height: width * 164 / 240,
    excludeFromSemantics: true,
  );
}
