import 'dart:async';
import 'package:flutter/material.dart';
import '../../theme/app_colors.dart';

enum FlashSaleTimerStyle {
  compact, // Hiển thị 'HH:mm:ss' trong khung bo tròn (cho Chi tiết sản phẩm, Banner)
  boxed,   // Hiển thị [HH] : [mm] : [ss] (cho Trang chủ Flash Sale)
}

/// Widget đếm ngược Flash Sale theo thời gian thực (Real-time Wall Clock)
class FlashSaleCountdownWidget extends StatefulWidget {
  final FlashSaleTimerStyle style;

  const FlashSaleCountdownWidget({
    super.key,
    this.style = FlashSaleTimerStyle.compact,
  });

  @override
  State<FlashSaleCountdownWidget> createState() => _FlashSaleCountdownWidgetState();

  /// Tính toán số giây còn lại đến khi kết thúc khung giờ Flash Sale hiện tại.
  /// Khung giờ diễn ra theo phiên 2 tiếng: 0h, 2h, 4h, 6h, 8h, 10h, 12h, 14h, 16h, 18h, 20h, 22h.
  static Duration getRemainingTime() {
    final now = DateTime.now();
    final currentHour = now.hour;
    final nextHour = currentHour + (2 - (currentHour % 2));
    final nextSession = DateTime(now.year, now.month, now.day, nextHour, 0, 0);
    final diff = nextSession.difference(now);
    return diff.isNegative ? Duration.zero : diff;
  }
}

class _FlashSaleCountdownWidgetState extends State<FlashSaleCountdownWidget> {
  Timer? _timer;
  late Duration _remaining;

  @override
  void initState() {
    super.initState();
    _remaining = FlashSaleCountdownWidget.getRemainingTime();
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      setState(() {
        _remaining = FlashSaleCountdownWidget.getRemainingTime();
      });
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Widget _buildTimeBox(String text) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 2),
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2.5),
      decoration: BoxDecoration(
        color: AppColors.textPrimary,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        text,
        style: const TextStyle(
          color: AppColors.surface,
          fontSize: 11.5,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final hours = _remaining.inHours.toString().padLeft(2, '0');
    final minutes = (_remaining.inMinutes % 60).toString().padLeft(2, '0');
    final seconds = (_remaining.inSeconds % 60).toString().padLeft(2, '0');

    if (widget.style == FlashSaleTimerStyle.compact) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2.5),
        decoration: BoxDecoration(
          color: Colors.black.withOpacity(0.65),
          borderRadius: BorderRadius.circular(4),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.timer_outlined, color: Colors.yellowAccent, size: 12),
            const SizedBox(width: 3),
            Text(
              '$hours:$minutes:$seconds',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 11.5,
                fontWeight: FontWeight.w900,
                letterSpacing: 0.5,
              ),
            ),
          ],
        ),
      );
    }

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _buildTimeBox(hours),
        const Text(':', style: TextStyle(fontWeight: FontWeight.w900, color: AppColors.textPrimary)),
        _buildTimeBox(minutes),
        const Text(':', style: TextStyle(fontWeight: FontWeight.w900, color: AppColors.textPrimary)),
        _buildTimeBox(seconds),
      ],
    );
  }
}

