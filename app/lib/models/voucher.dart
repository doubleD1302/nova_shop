import 'package:intl/intl.dart';

class Voucher {
  final dynamic id;
  final String code;
  final String name;
  final double discountAmount;
  final double minSubtotal;
  final DateTime? startsAt;
  final DateTime? endsAt;
  final int? usageLimit;
  final int? usedCount;
  final bool isActive;

  Voucher({
    required this.id,
    required this.code,
    required this.name,
    required this.discountAmount,
    required this.minSubtotal,
    this.startsAt,
    this.endsAt,
    this.usageLimit,
    this.usedCount,
    this.isActive = true,
  });

  factory Voucher.fromJson(Map<String, dynamic> json) {
    return Voucher(
      id: json['id'],
      code: (json['code'] ?? '').toString().toUpperCase(),
      name: (json['name'] ?? '').toString(),
      discountAmount: double.tryParse(json['discountAmount']?.toString() ?? json['discount_amount']?.toString() ?? '0') ?? 0,
      minSubtotal: double.tryParse(json['minSubtotal']?.toString() ?? json['min_subtotal']?.toString() ?? '0') ?? 0,
      startsAt: json['startsAt'] != null ? DateTime.tryParse(json['startsAt'].toString()) : null,
      endsAt: json['endsAt'] != null ? DateTime.tryParse(json['endsAt'].toString()) : null,
      usageLimit: json['usageLimit'] is int ? json['usageLimit'] : int.tryParse(json['usageLimit']?.toString() ?? ''),
      usedCount: json['usedCount'] is int ? json['usedCount'] : int.tryParse(json['usedCount']?.toString() ?? ''),
      isActive: json['isActive'] == null || json['isActive'] == true || json['is_active'] == 1,
    );
  }

  String get discountFormatted {
    final currency = NumberFormat.currency(locale: 'vi_VN', symbol: '₫', decimalDigits: 0);
    return 'Giảm ${currency.format(discountAmount)}';
  }

  String get minSubtotalFormatted {
    final currency = NumberFormat.currency(locale: 'vi_VN', symbol: '₫', decimalDigits: 0);
    return 'Đơn tối thiểu ${currency.format(minSubtotal)}';
  }
}

