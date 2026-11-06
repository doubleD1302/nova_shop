import 'package:intl/intl.dart';

class Voucher {
  final dynamic id;
  final String code;
  final String name;
  final double discountAmount;
  final double minSubtotal;
  final DateTime? startsAt;
  final DateTime? endsAt;
  final DateTime? savedAt;
  final int? usageLimit;
  final int? usedCount;
  final bool isActive;
  final String status; // 'available', 'used', 'expired', 'upcoming', 'exhausted', 'inactive'

  Voucher({
    required this.id,
    required this.code,
    required this.name,
    required this.discountAmount,
    required this.minSubtotal,
    this.startsAt,
    this.endsAt,
    this.savedAt,
    this.usageLimit,
    this.usedCount,
    this.isActive = true,
    this.status = 'available',
  });

  factory Voucher.fromJson(Map<String, dynamic> json) {
    final statusStr = (json['status'] ?? 'available').toString();
    return Voucher(
      id: json['id'],
      code: (json['code'] ?? '').toString().toUpperCase(),
      name: (json['name'] ?? '').toString(),
      discountAmount: double.tryParse(json['discountAmount']?.toString() ?? json['discount_amount']?.toString() ?? '0') ?? 0,
      minSubtotal: double.tryParse(json['minSubtotal']?.toString() ?? json['min_subtotal']?.toString() ?? '0') ?? 0,
      startsAt: json['startsAt'] != null ? DateTime.tryParse(json['startsAt'].toString()) : null,
      endsAt: json['endsAt'] != null ? DateTime.tryParse(json['endsAt'].toString()) : null,
      savedAt: json['savedAt'] != null ? DateTime.tryParse(json['savedAt'].toString()) : null,
      usageLimit: json['usageLimit'] is int ? json['usageLimit'] : int.tryParse(json['usageLimit']?.toString() ?? ''),
      usedCount: json['usedCount'] is int ? json['usedCount'] : int.tryParse(json['usedCount']?.toString() ?? ''),
      isActive: json['isActive'] == null || json['isActive'] == true || json['is_active'] == 1,
      status: statusStr,
    );
  }

  bool get isAvailable => status == 'available';
  bool get isUsed => status == 'used';
  bool get isExpired => status == 'expired';

  String get discountFormatted {
    final currency = NumberFormat.currency(locale: 'vi_VN', symbol: '₫', decimalDigits: 0);
    return 'Giảm ${currency.format(discountAmount)}';
  }

  String get minSubtotalFormatted {
    final currency = NumberFormat.currency(locale: 'vi_VN', symbol: '₫', decimalDigits: 0);
    return 'Đơn tối thiểu ${currency.format(minSubtotal)}';
  }

  String get statusLabel {
    switch (status) {
      case 'available':
        return 'Sẵn sàng dùng';
      case 'used':
        return 'Đã sử dụng';
      case 'expired':
        return 'Đã hết hạn';
      case 'upcoming':
        return 'Chưa bắt đầu';
      case 'exhausted':
        return 'Hết lượt toàn sàn';
      default:
        return 'Hết hạn';
    }
  }
}
