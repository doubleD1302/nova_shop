import 'dart:async';
import 'package:flutter/material.dart';
import 'package:shopnova/models/flash_sale_item.dart';
import 'package:shopnova/theme/app_colors.dart';
import 'package:shopnova/widgets/home/flash_sale_item_card.dart';

class FlashSaleSection extends StatefulWidget {
  final List<FlashSaleItem> items;

  const FlashSaleSection({super.key, required this.items});

  @override
  State<FlashSaleSection> createState() => _FlashSaleSectionState();
}

class _FlashSaleSectionState extends State<FlashSaleSection> {
  late Timer _timer;
  Duration _timeLeft = const Duration(hours: 1, minutes: 5, seconds: 6);

  @override
  void initState() {
    super.initState();
    _startTimer();
  }

  void _startTimer() {
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_timeLeft.inSeconds > 0) {
        setState(() {
          _timeLeft -= const Duration(seconds: 1);
        });
      } else {
        _timer.cancel();
      }
    });
  }

  @override
  void dispose() {
    _timer.cancel();
    super.dispose();
  }

  Widget _buildTimeBox(String time) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 2),
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2.5),
      decoration: BoxDecoration(
        color: AppColors.textPrimary,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        time,
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
    final hours = _timeLeft.inHours.toString().padLeft(2, '0');
    final minutes = (_timeLeft.inMinutes % 60).toString().padLeft(2, '0');
    final seconds = (_timeLeft.inSeconds % 60).toString().padLeft(2, '0');

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border, width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: AppColors.surfaceAlt,
                  shape: BoxShape.circle,
                  border: Border.all(color: AppColors.border, width: 0.8),
                ),
                child: const Icon(Icons.local_fire_department, color: AppColors.flashSaleRed, size: 18),
              ),
              const SizedBox(width: 6),
              const Text(
                'FLASH SALE',
                style: TextStyle(
                  color: AppColors.flashSaleRed,
                  fontWeight: FontWeight.w900,
                  fontSize: 15,
                  letterSpacing: 0.2,
                ),
              ),
              const SizedBox(width: 8),
              _buildTimeBox(hours),
              const Text(':', style: TextStyle(fontWeight: FontWeight.w900, color: AppColors.textPrimary)),
              _buildTimeBox(minutes),
              const Text(':', style: TextStyle(fontWeight: FontWeight.w900, color: AppColors.textPrimary)),
              _buildTimeBox(seconds),
              const Spacer(),
              Text(
                'Xem tất cả >',
                style: TextStyle(
                  color: AppColors.primary,
                  fontSize: 12.5,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 190,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: widget.items.length,
              separatorBuilder: (context, index) => const SizedBox(width: 10),
              itemBuilder: (context, index) {
                return FlashSaleItemCard(item: widget.items[index]);
              },
            ),
          ),
        ],
      ),
    );
  }
}
