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
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
      decoration: BoxDecoration(
        color: Colors.black,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        time,
        style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final hours = _timeLeft.inHours.toString().padLeft(2, '0');
    final minutes = (_timeLeft.inMinutes % 60).toString().padLeft(2, '0');
    final seconds = (_timeLeft.inSeconds % 60).toString().padLeft(2, '0');

    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.flash_on, color: Colors.orange, size: 24),
              const SizedBox(width: 4),
              const Text(
                '⚡ FLASH SALE',
                style: TextStyle(
                  color: Colors.red,
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                ),
              ),
              const SizedBox(width: 8),
              _buildTimeBox(hours),
              const Text(':', style: TextStyle(fontWeight: FontWeight.bold)),
              _buildTimeBox(minutes),
              const Text(':', style: TextStyle(fontWeight: FontWeight.bold)),
              _buildTimeBox(seconds),
              const Spacer(),
              Text(
                'Xem tất cả >',
                style: TextStyle(
                  color: AppColors.primary,
                  fontSize: 13,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 180,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: widget.items.length,
              separatorBuilder: (context, index) => const SizedBox(width: 12),
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
