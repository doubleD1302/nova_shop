import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../models/cart_item.dart';
import '../../models/address.dart';
import '../../services/address_service.dart';
import '../../services/auth_service.dart';
import '../../services/cart_service.dart';
import '../../services/order_service.dart';
import '../account/addresses_screen.dart';
import '../auth/login_screen.dart' as shopnova_auth;
import '../orders/orders_screen.dart';
import '../../theme/app_colors.dart';

class CheckoutScreen extends StatefulWidget {
  final List<CartItemModel>? selectedItems;

  const CheckoutScreen({super.key, this.selectedItems});

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  final Color primaryColor = AppColors.primary;

  late TextEditingController _nameController;
  late TextEditingController _phoneController;
  late TextEditingController _addressController;
  late TextEditingController _provinceController;
  late TextEditingController _districtController;
  late TextEditingController _wardController;
  late TextEditingController _noteController;
  late TextEditingController _voucherController;

  String _selectedPaymentMethod = 'cod';
  String _selectedShippingMethod = 'tietkiem';
  bool _isPlacingOrder = false;

  // Voucher state
  String? _appliedVoucherCode;
  double _appliedVoucherDiscount = 0.0;
  String? _voucherError;

  // Key lưu địa chỉ vào SharedPreferences
  static const String _prefKeyName = 'saved_checkout_name';
  static const String _prefKeyPhone = 'saved_checkout_phone';
  static const String _prefKeyAddress = 'saved_checkout_address';
  static const String _prefKeyProvince = 'saved_checkout_province';
  static const String _prefKeyDistrict = 'saved_checkout_district';
  static const String _prefKeyWard = 'saved_checkout_ward';

  /// Kiểm tra chuỗi có đúng là số điện thoại (chỉ chứa chữ số, không chứa chữ cái như username)
  static bool _isRealPhone(String? str) {
    if (str == null || str.trim().isEmpty) return false;
    final trimmed = str.trim();
    if (RegExp(r'[a-zA-Z]').hasMatch(trimmed)) return false;
    final digits = trimmed.replaceAll(RegExp(r'\D'), '');
    return digits.length >= 9 && digits.length <= 15;
  }

  @override
  void initState() {
    super.initState();
    final user = AuthService().currentUser;
    _nameController = TextEditingController(text: user?.fullName.isNotEmpty == true ? user!.fullName : '');
    // Tuyệt đối không tự động điền username/chữ cái vào ô số điện thoại
    final userPhone = _isRealPhone(user?.phone) ? user!.phone! : '';
    _phoneController = TextEditingController(text: userPhone);
    _addressController = TextEditingController();
    _provinceController = TextEditingController();
    _districtController = TextEditingController();
    _wardController = TextEditingController();
    _noteController = TextEditingController();
    _voucherController = TextEditingController();
    _loadSavedAddress();
  }

  /// Tự động tải địa chỉ đã lưu từ SharedPreferences hoặc AddressService
  Future<void> _loadSavedAddress() async {
    final prefs = await SharedPreferences.getInstance();
    final savedPhone = prefs.getString(_prefKeyPhone);
    final savedName = prefs.getString(_prefKeyName);
    final savedAddress = prefs.getString(_prefKeyAddress);
    final savedProvince = prefs.getString(_prefKeyProvince);
    final savedDistrict = prefs.getString(_prefKeyDistrict);
    final savedWard = prefs.getString(_prefKeyWard);

    // Nếu trước đó từng bị lưu nhầm tên/chữ vào ô SĐT -> Xóa sạch key rác ngay lập tức
    if (savedPhone != null && !_isRealPhone(savedPhone)) {
      await prefs.remove(_prefKeyPhone);
    }

    // 1. Thử tải từ Sổ địa chỉ online nếu đã đăng nhập
    if (AuthService().isAuthenticated) {
      try {
        final list = await AddressService().getAddresses();
        if (list.isNotEmpty && mounted) {
          final def = list.firstWhere((a) => a.isDefault, orElse: () => list.first);
          _applyAddress(def);
          // Nếu có SĐT đã lưu hợp lệ ở máy thì giữ SĐT đó
          if (_isRealPhone(savedPhone) && mounted) {
            setState(() {
              _phoneController.text = savedPhone!;
            });
          }
          return;
        }
      } catch (_) {}
    }

    // 2. Tải địa chỉ người dùng đã nhập lần trước từ bộ nhớ máy (Offline/Guest)
    if (!mounted) return;
    setState(() {
      if (_nameController.text.trim().isEmpty && savedName != null && savedName.isNotEmpty) {
        _nameController.text = savedName;
      }
      if (_isRealPhone(savedPhone)) {
        _phoneController.text = savedPhone!;
      } else if (!_isRealPhone(_phoneController.text)) {
        _phoneController.clear();
      }

      if (_addressController.text.trim().isEmpty && savedAddress != null) {
        _addressController.text = savedAddress;
      }
      if (_provinceController.text.trim().isEmpty) {
        _provinceController.text = (savedProvince != null && savedProvince.isNotEmpty) ? savedProvince : 'TP. Hồ Chí Minh';
      }
      if (_districtController.text.trim().isEmpty) {
        _districtController.text = (savedDistrict != null && savedDistrict.isNotEmpty) ? savedDistrict : 'Quận 1';
      }
      if (_wardController.text.trim().isEmpty) {
        _wardController.text = (savedWard != null && savedWard.isNotEmpty) ? savedWard : 'Phường Bến Nghé';
      }
    });
  }

  /// Lưu địa chỉ người dùng nhập vào SharedPreferences để dùng lại lần sau
  Future<void> _persistAddressLocally() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_prefKeyName, _nameController.text.trim());
      final phone = _phoneController.text.trim();
      // TUYỆT ĐỐI CHỈ LƯU SỐ ĐIỆN THOẠI HỢP LỆ VÀO BỘ NHỚ MÁY
      if (_isRealPhone(phone)) {
        await prefs.setString(_prefKeyPhone, phone);
      } else {
        await prefs.remove(_prefKeyPhone);
      }
      await prefs.setString(_prefKeyAddress, _addressController.text.trim());
      await prefs.setString(_prefKeyProvince, _provinceController.text.trim());
      await prefs.setString(_prefKeyDistrict, _districtController.text.trim());
      await prefs.setString(_prefKeyWard, _wardController.text.trim());
    } catch (_) {}
  }

  void _applyAddress(Address addr) {
    setState(() {
      _nameController.text = addr.recipientName;
      // Chỉ gán SĐT nếu đúng là số điện thoại thực sự (không phải chữ cái/username)
      if (_isRealPhone(addr.phone)) {
        _phoneController.text = addr.phone;
      } else if (!_isRealPhone(_phoneController.text)) {
        _phoneController.clear();
      }
      _addressController.text = addr.detail;
      if (addr.ward != null && addr.ward!.isNotEmpty) {
        _wardController.text = addr.ward!;
      }
      if (addr.district != null && addr.district!.isNotEmpty) {
        _districtController.text = addr.district!;
      }
      _provinceController.text = addr.province;
    });
    _persistAddressLocally();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _addressController.dispose();
    _provinceController.dispose();
    _districtController.dispose();
    _wardController.dispose();
    _noteController.dispose();
    _voucherController.dispose();
    super.dispose();
  }

  List<CartItemModel> _getItems() {
    if (widget.selectedItems != null && widget.selectedItems!.isNotEmpty) {
      return widget.selectedItems!;
    }
    return CartService().items.where((i) => i.selected).toList();
  }

  String _formatVND(num amount) {
    final str = amount.round().toString();
    final reg = RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))');
    return '${str.replaceAllMapped(reg, (Match m) => '${m[1]}.')}₫';
  }

  /// Tính phí vận chuyển thực tế theo phương thức và giá trị đơn hàng
  double _calculateShippingFee(String method, double subtotal) {
    final isFreeShip = subtotal >= 1000000;
    switch (method) {
      case 'nhanh':
        return isFreeShip ? 14000.0 : 32000.0;
      case 'hoatoc':
        return isFreeShip ? 35000.0 : 55000.0;
      case 'tietkiem':
      default:
        return isFreeShip ? 0.0 : 18000.0;
    }
  }

  /// Áp dụng mã giảm giá thực tế (có kiểm tra điều kiện minSpend & mã hợp lệ)
  void _applyVoucherCode(String code, double subtotal, double shippingFee) {
    final cleanCode = code.trim().toUpperCase();
    if (cleanCode.isEmpty) {
      setState(() {
        _voucherError = 'Vui lòng nhập mã giảm giá.';
        _appliedVoucherCode = null;
        _appliedVoucherDiscount = 0.0;
      });
      return;
    }

    // Danh sách mã ưu đãi chuẩn của sàn ShopNova
    if (cleanCode == 'NOVA20K') {
      if (subtotal < 200000) {
        setState(() {
          _voucherError = 'Mã NOVA20K áp dụng cho đơn hàng từ 200.000₫.';
          _appliedVoucherCode = null;
          _appliedVoucherDiscount = 0.0;
        });
        return;
      }
      setState(() {
        _voucherError = null;
        _appliedVoucherCode = cleanCode;
        _appliedVoucherDiscount = 20000.0;
      });
    } else if (cleanCode == 'FREESHIP' || cleanCode == 'FREESHIPMAX') {
      if (subtotal < 99000) {
        setState(() {
          _voucherError = 'Mã $cleanCode chỉ áp dụng cho đơn hàng từ 99.000₫.';
          _appliedVoucherCode = null;
          _appliedVoucherDiscount = 0.0;
        });
        return;
      }
      final shipDiscount = shippingFee.clamp(0.0, 30000.0);
      setState(() {
        _voucherError = null;
        _appliedVoucherCode = cleanCode;
        _appliedVoucherDiscount = shipDiscount > 0 ? shipDiscount : 30000.0;
      });
    } else if (cleanCode == 'CHAOBANMOI' || cleanCode == 'NOVANEW') {
      if (subtotal < 150000) {
        setState(() {
          _voucherError = 'Mã $cleanCode chỉ áp dụng cho đơn hàng từ 150.000₫.';
          _appliedVoucherCode = null;
          _appliedVoucherDiscount = 0.0;
        });
        return;
      }
      final discount = (subtotal * 0.15).clamp(20000.0, 50000.0);
      setState(() {
        _voucherError = null;
        _appliedVoucherCode = cleanCode;
        _appliedVoucherDiscount = discount;
      });
    } else if (cleanCode == 'NOVAMEGA50') {
      if (subtotal < 350000) {
        setState(() {
          _voucherError = 'Mã NOVAMEGA50 chỉ áp dụng cho đơn hàng từ 350.000₫.';
          _appliedVoucherCode = null;
          _appliedVoucherDiscount = 0.0;
        });
        return;
      }
      setState(() {
        _voucherError = null;
        _appliedVoucherCode = cleanCode;
        _appliedVoucherDiscount = 50000.0;
      });
    } else if (cleanCode == 'NOVA50K') {
      if (subtotal < 1500000) {
        setState(() {
          _voucherError = 'Mã NOVA50K chỉ áp dụng cho đơn hàng từ 1.500.000₫.';
          _appliedVoucherCode = null;
          _appliedVoucherDiscount = 0.0;
        });
        return;
      }
      setState(() {
        _voucherError = null;
        _appliedVoucherCode = cleanCode;
        _appliedVoucherDiscount = 50000.0;
      });
    } else {
      _validateVoucherWithBackend(cleanCode, subtotal);
      return;
    }

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Áp dụng mã $cleanCode thành công! Giảm ${_formatVND(_appliedVoucherDiscount)}'),
        backgroundColor: const Color(0xFF00BFA5),
      ),
    );
  }

  Future<void> _validateVoucherWithBackend(String cleanCode, double subtotal) async {
    final rawMethod = _selectedShippingMethod == 'hoatoc'
        ? 'express'
        : (_selectedShippingMethod == 'nhanh' ? 'standard' : 'economy');

    final items = _getItems().map((it) {
      final vId = int.tryParse(it.variantId?.toString() ?? '') ?? 1;
      return {
        'variantId': vId,
        'qty': it.qty,
      };
    }).toList();

    final preview = await OrderService().previewOrder(
      items: items,
      shippingMethod: rawMethod,
      voucherCode: cleanCode,
    );

    if (!mounted) return;

    if (preview != null && preview['discountAmount'] != null && (preview['discountAmount'] as num) > 0) {
      final discount = (preview['discountAmount'] as num).toDouble();
      setState(() {
        _voucherError = null;
        _appliedVoucherCode = cleanCode;
        _appliedVoucherDiscount = discount;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Áp dụng mã ' + cleanCode + ' thành công từ API Backend! Giảm ' + _formatVND(discount)),
          backgroundColor: const Color(0xFF00BFA5),
        ),
      );
    } else {
      setState(() {
        _voucherError = 'Mã giảm giá "' + cleanCode + '" không hợp lệ hoặc chưa đủ điều kiện.';
        _appliedVoucherCode = null;
        _appliedVoucherDiscount = 0.0;
      });
    }
  }

  InputDecoration _inputDeco(String label, IconData? icon, {String? hintText}) {
    return InputDecoration(
      labelText: label,
      hintText: hintText,
      labelStyle: const TextStyle(color: Color(0xFF8F90A6), fontSize: 13),
      hintStyle: const TextStyle(color: Color(0xFFB0B0C0), fontSize: 12),
      isDense: true,
      filled: true,
      fillColor: const Color(0xFFFAFAFC),
      prefixIcon: icon != null ? Icon(icon, size: 18, color: const Color(0xFF8F90A6)) : null,
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFFE2E2E6)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFFE2E2E6)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
      ),
    );
  }

  /// Validate toàn diện tất cả input thông tin giao hàng
  String? _validateDeliveryInfo() {
    final name = _nameController.text.trim();
    final phone = _phoneController.text.trim().replaceAll(RegExp(r'\s+'), '');
    final address = _addressController.text.trim();
    final province = _provinceController.text.trim();

    if (name.isEmpty || name.length < 2) {
      return 'Vui lòng nhập họ và tên người nhận hợp lệ (tối thiểu 2 ký tự).';
    }

    final phoneRegex = RegExp(r'^(0[35789])[0-9]{8}$');
    if (!phoneRegex.hasMatch(phone)) {
      return 'Số điện thoại không hợp lệ. Vui lòng nhập 10 số bắt đầu bằng 03, 05, 07, 08 hoặc 09.';
    }

    if (address.isEmpty || address.length < 5) {
      return 'Vui lòng nhập địa chỉ chi tiết (số nhà, ngõ/ngách, tên đường - tối thiểu 5 ký tự).';
    }

    if (province.isEmpty) {
      return 'Vui lòng nhập Tỉnh / Thành phố nhận hàng.';
    }

    return null;
  }

  Future<void> _handlePlaceOrder() async {
    final items = _getItems();
    if (items.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Không có sản phẩm nào được chọn để đặt hàng.')),
      );
      return;
    }

    // Validate toàn diện input
    final validationError = _validateDeliveryInfo();
    if (validationError != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(validationError), backgroundColor: const Color(0xFFD0011B)),
      );
      return;
    }

    final recipientName = _nameController.text.trim();
    final recipientPhone = _phoneController.text.trim();

    // Lưu địa chỉ này lại cho lần mua tiếp theo
    await _persistAddressLocally();

    setState(() => _isPlacingOrder = true);

    try {
      if (!AuthService().isAuthenticated) {
        final cleanPhone = recipientPhone.replaceAll(RegExp(r'\D'), '');
        final phoneKey = cleanPhone.isNotEmpty ? cleanPhone : DateTime.now().millisecondsSinceEpoch.toString();
        final username = 'u_$phoneKey';
        const defaultPass = 'ShopNova@123';

        bool loggedIn = await AuthService().login(username, defaultPass);
        if (!loggedIn) {
          final registered = await AuthService().register(
            username: username,
            password: defaultPass,
            fullName: recipientName,
            phone: recipientPhone,
          );
          if (!registered) {
            await AuthService().login(username, defaultPass);
          }
        }
      }

      final orderItems = items.map((it) {
        int vId = int.tryParse(it.variantId) ?? int.tryParse(it.productId) ?? 1;
        if (vId <= 0) {
          final m = RegExp(r'\d+').firstMatch(it.variantId) ?? RegExp(r'\d+').firstMatch(it.productId);
          if (m != null) vId = int.tryParse(m.group(0)!) ?? 1;
        }
        final unitPrice = it.price;
        return {
          'variantId': vId,
          'productId': it.productId,
          'qty': it.qty,
          'quantity': it.qty,
          'price': unitPrice,
          'unitPrice': unitPrice,
          'unit_price': unitPrice,
          'lineTotal': unitPrice * it.qty,
          'line_total': unitPrice * it.qty,
          'productName': it.productName,
          'product_name': it.productName,
          'variantName': it.variantName.isNotEmpty ? it.variantName : 'Mặc định',
          'variant_name': it.variantName.isNotEmpty ? it.variantName : 'Mặc định',
          'imageUrl': it.imageUrl,
          'image_url': it.imageUrl,
        };
      }).toList();

      final order = await OrderService().createOrder(
        recipientName: recipientName,
        recipientPhone: recipientPhone,
        province: _provinceController.text.trim().isNotEmpty ? _provinceController.text.trim() : 'TP. Hồ Chí Minh',
        district: _districtController.text.trim().isNotEmpty ? _districtController.text.trim() : 'Quận 1',
        ward: _wardController.text.trim().isNotEmpty ? _wardController.text.trim() : 'Phường Bến Nghé',
        addressDetail: _addressController.text.trim().isNotEmpty ? _addressController.text.trim() : 'Địa chỉ nhận hàng',
        note: _noteController.text.trim().isEmpty ? null : _noteController.text.trim(),
        paymentMethod: _selectedPaymentMethod,
        shippingMethod: _selectedShippingMethod,
        voucherCode: _appliedVoucherCode,
        items: orderItems,
      );

      if (!mounted) return;
      setState(() => _isPlacingOrder = false);

      if (order != null) {
        CartService().clearSelected();

        final orderCode = order['code'] ?? 'ORD';
        final totalAmount = order['totalAmount'] ?? order['total_amount'] ?? 0;
        final isOffline = order['isSavedOffline'] == true;

        showDialog(
          context: context,
          barrierDismissible: false,
          builder: (ctx) => AlertDialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            contentPadding: const EdgeInsets.all(24),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 76,
                  height: 76,
                  decoration: BoxDecoration(
                    color: const Color(0xFFE8F9EE),
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: Colors.green.withOpacity(0.15),
                        blurRadius: 16,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  child: const Icon(Icons.check_circle_rounded, color: Color(0xFF00BFA5), size: 52),
                ),
                const SizedBox(height: 18),
                const Text(
                  'Đặt Hàng Thành Công!',
                  style: TextStyle(fontSize: 19, fontWeight: FontWeight.bold, color: Color(0xFF1E2022)),
                ),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceAlt,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    'Mã đơn hàng: #$orderCode',
                    style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Tổng thanh toán: ${_formatVND(num.tryParse(totalAmount.toString()) ?? 0)}',
                  style: const TextStyle(color: Color(0xFF1E2022), fontSize: 14, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 12),
                Text(
                  isOffline
                      ? 'Đơn hàng đã được lưu an toàn trên ứng dụng và đang chờ người bán xác nhận.'
                      : 'Đơn hàng của bạn đã được ghi nhận trên hệ thống và người bán đang đóng gói chuẩn bị giao.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Color(0xFF8F90A6), fontSize: 12, height: 1.4),
                ),
                const SizedBox(height: 22),
                Container(
                  width: double.infinity,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [AppColors.primary, AppColors.earth],
                    ),
                    borderRadius: BorderRadius.circular(10),
                    boxShadow: [
                      BoxShadow(
                        color: primaryColor.withValues(alpha: 0.3),
                        blurRadius: 8,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  child: ElevatedButton(
                    onPressed: () {
                      Navigator.pop(ctx);
                      Navigator.pushReplacement(
                        context,
                        MaterialPageRoute(
                          builder: (context) => const OrdersScreen(initialTabIndex: 0),
                        ),
                      );
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.transparent,
                      shadowColor: Colors.transparent,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    child: const Text('Xem Đơn Mua Của Tôi', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                  ),
                ),
              ],
            ),
          ),
        );
      } else {
        final errorMsg = OrderService().lastError ?? 'Đặt hàng thất bại. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại!';
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(errorMsg),
            backgroundColor: const Color(0xFFD0011B),
            duration: const Duration(seconds: 4),
            action: SnackBarAction(
              label: 'Đăng nhập',
              textColor: Colors.white,
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const shopnova_auth.LoginScreen()),
                );
              },
            ),
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _isPlacingOrder = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Đã xảy ra lỗi: $e'), backgroundColor: const Color(0xFFD0011B)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final items = _getItems();
    final subtotal = items.fold(0.0, (sum, i) => sum + (i.price * i.qty));
    final shippingFee = _calculateShippingFee(_selectedShippingMethod, subtotal);
    final voucherDiscount = _appliedVoucherDiscount;
    final totalAmount = (subtotal + shippingFee - voucherDiscount).clamp(0.0, double.infinity);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: const Color(0xFFEEEEF0), height: 1),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Color(0xFF1E2022), size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Thanh Toán Đặt Hàng',
          style: TextStyle(color: Color(0xFF1E2022), fontSize: 18, fontWeight: FontWeight.w700),
        ),
      ),
      body: Column(
        children: [
          // Dải màu bưu kiện ShopNova
          Container(
            height: 3.5,
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [AppColors.primary, AppColors.earth, AppColors.primary, AppColors.textPrimary],
              ),
            ),
          ),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Column(
                children: [
                  _buildAddressSection(),
                  _buildItemsSection(items),
                  _buildShippingMethods(subtotal),
                  _buildVoucherSection(subtotal, shippingFee),
                  _buildPaymentMethods(),
                  _buildPaymentDetails(subtotal, shippingFee, voucherDiscount, totalAmount),
                  _buildSecurityNotice(),
                ],
              ),
            ),
          ),
          _buildBottomBar(totalAmount),
        ],
      ),
    );
  }

  Widget _buildAddressSection() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFEEEEF0)),
        boxShadow: const [
          BoxShadow(color: Color(0x06000000), blurRadius: 8, offset: Offset(0, 2)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: AppColors.surfaceAlt,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.location_on_rounded, color: AppColors.primary, size: 20),
              ),
              const SizedBox(width: 8),
              const Text(
                'Địa Chỉ Nhận Hàng',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF1E2022)),
              ),
              const Spacer(),
              InkWell(
                onTap: () async {
                  final selected = await Navigator.push<Address>(
                    context,
                    MaterialPageRoute(builder: (_) => const AddressesScreen(selectMode: true)),
                  );
                  if (selected != null && mounted) {
                    _applyAddress(selected);
                  }
                },
                borderRadius: BorderRadius.circular(6),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceAlt,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.bookmark_border_rounded, size: 14, color: primaryColor),
                      const SizedBox(width: 4),
                      Text('Sổ địa chỉ', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: primaryColor)),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _nameController,
            decoration: _inputDeco('Họ và tên người nhận *', Icons.person_outline_rounded, hintText: 'Ví dụ: Nguyễn Văn A'),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _phoneController,
            keyboardType: TextInputType.phone,
            decoration: _inputDeco('Số điện thoại liên hệ *', Icons.phone_outlined, hintText: 'Ví dụ: 0912345678 (10 chữ số)'),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _addressController,
            decoration: _inputDeco('Địa chỉ chi tiết (Số nhà, tên đường) *', Icons.home_outlined, hintText: 'Ví dụ: 123 Nguyễn Huệ'),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _wardController,
                  decoration: _inputDeco('Phường / Xã', null, hintText: 'Bến Nghé'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  controller: _districtController,
                  decoration: _inputDeco('Quận / Huyện', null, hintText: 'Quận 1'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  controller: _provinceController,
                  decoration: _inputDeco('Tỉnh / TP *', null, hintText: 'TP. Hồ Chí Minh'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          const Row(
            children: [
              Icon(Icons.check_circle_outline_rounded, color: Color(0xFF00BFA5), size: 14),
              SizedBox(width: 4),
              Text(
                'Địa chỉ sẽ được tự động lưu lại cho các lần mua tiếp theo.',
                style: TextStyle(color: Color(0xFF8F90A6), fontSize: 11),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildItemsSection(List<CartItemModel> items) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFEEEEF0)),
        boxShadow: const [
          BoxShadow(color: Color(0x06000000), blurRadius: 8, offset: Offset(0, 2)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(color: const Color(0xFFD0011B), borderRadius: BorderRadius.circular(4)),
                child: const Text('MALL', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
              ),
              const SizedBox(width: 8),
              const Text('Nova Mall & Đối Tác', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF1E2022))),
              const Spacer(),
              Text('${items.length} món', style: const TextStyle(color: Color(0xFF8F90A6), fontSize: 12, fontWeight: FontWeight.w600)),
            ],
          ),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 10),
            child: Divider(height: 1, color: Color(0xFFEEEEF0)),
          ),
          ...items.map((it) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFFEEEEF0)),
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: Container(
                          width: 60,
                          height: 60,
                          color: const Color(0xFFF7F7F8),
                          child: it.imageUrl.isNotEmpty
                              ? Image.network(
                                  it.imageUrl,
                                  fit: BoxFit.cover,
                                  errorBuilder: (_, __, ___) => const Icon(Icons.image_outlined, color: Colors.grey),
                                )
                              : const Icon(Icons.image_outlined, color: Colors.grey),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            it.productName,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF1E2022)),
                          ),
                          const SizedBox(height: 4),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF5F5F7),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              'Phân loại: ${it.variantName}',
                              style: const TextStyle(color: Color(0xFF555770), fontSize: 11),
                            ),
                          ),
                          const SizedBox(height: 6),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                _formatVND(it.price),
                                style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold, fontSize: 13),
                              ),
                              Text('x${it.qty}', style: const TextStyle(color: Color(0xFF8F90A6), fontSize: 12, fontWeight: FontWeight.bold)),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              )),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 10),
            child: Divider(height: 1, color: Color(0xFFEEEEF0)),
          ),
          TextField(
            controller: _noteController,
            decoration: InputDecoration(
              hintText: 'Lưu ý cho người bán (nếu có)...',
              hintStyle: const TextStyle(fontSize: 12, color: Color(0xFF8F90A6)),
              isDense: true,
              filled: true,
              fillColor: const Color(0xFFFAFAFC),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: const BorderSide(color: Color(0xFFE2E2E6)),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: const BorderSide(color: Color(0xFFE2E2E6)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: const BorderSide(color: AppColors.primary),
              ),
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            ),
          ),
        ],
      ),
    );
  }

  /// Phương thức vận chuyển thực tế có trừ tiền
  Widget _buildShippingMethods(double subtotal) {
    final isFreeShip = subtotal >= 1000000;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFEEEEF0)),
        boxShadow: const [
          BoxShadow(color: Color(0x06000000), blurRadius: 8, offset: Offset(0, 2)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: AppColors.surfaceAlt,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.local_shipping_rounded, color: AppColors.primary, size: 20),
              ),
              const SizedBox(width: 8),
              const Text('Phương Thức Vận Chuyển', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF1E2022))),
              const Spacer(),
              if (isFreeShip)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(color: const Color(0xFFE8F9EE), borderRadius: BorderRadius.circular(4)),
                  child: const Text('Freeship Đơn ≥1Tr', style: TextStyle(color: Color(0xFF00BFA5), fontSize: 10.5, fontWeight: FontWeight.bold)),
                ),
            ],
          ),
          const SizedBox(height: 12),
          _buildShippingTile(
            methodKey: 'tietkiem',
            title: 'Giao Tiết Kiệm (Standard)',
            subtitle: 'Nhận hàng sau 3 - 5 ngày làm việc',
            fee: isFreeShip ? 0 : 18000,
            originalFee: 18000,
            isFree: isFreeShip,
            icon: Icons.savings_outlined,
          ),
          _buildShippingTile(
            methodKey: 'nhanh',
            title: 'Giao Hàng Nhanh (Fast)',
            subtitle: 'Nhận hàng sau 1 - 2 ngày làm việc',
            fee: isFreeShip ? 14000 : 32000,
            originalFee: 32000,
            icon: Icons.bolt_rounded,
          ),
          _buildShippingTile(
            methodKey: 'hoatoc',
            title: 'Giao Hỏa Tốc (Express 2H)',
            subtitle: 'Nhận hàng ngay trong 2 giờ tại nội thành',
            fee: isFreeShip ? 35000 : 55000,
            originalFee: 55000,
            icon: Icons.rocket_launch_rounded,
          ),
        ],
      ),
    );
  }

  Widget _buildShippingTile({
    required String methodKey,
    required String title,
    required String subtitle,
    required double fee,
    required double originalFee,
    bool isFree = false,
    required IconData icon,
  }) {
    final isSelected = _selectedShippingMethod == methodKey;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: isSelected ? AppColors.surfaceAlt.withValues(alpha: 0.45) : Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: isSelected ? AppColors.primary : AppColors.border,
          width: isSelected ? 1.5 : 1,
        ),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: () {
          setState(() {
            _selectedShippingMethod = methodKey;
            // Nếu đang dùng mã FREESHIP thì tính lại giảm ship
            if (_appliedVoucherCode == 'FREESHIP') {
              _appliedVoucherDiscount = fee.clamp(0.0, 30000.0);
            }
          });
        },
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            children: [
              Icon(
                isSelected ? Icons.radio_button_checked_rounded : Icons.radio_button_unchecked_rounded,
                color: isSelected ? primaryColor : const Color(0xFF8F90A6),
                size: 20,
              ),
              const SizedBox(width: 10),
              Icon(icon, size: 22, color: isSelected ? primaryColor : const Color(0xFF555770)),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
                        color: isSelected ? primaryColor : const Color(0xFF1E2022),
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(subtitle, style: const TextStyle(color: Color(0xFF8F90A6), fontSize: 11)),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    isFree ? 'Miễn phí' : _formatVND(fee),
                    style: TextStyle(
                      color: isFree ? const Color(0xFF00BFA5) : (isSelected ? primaryColor : const Color(0xFF1E2022)),
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                    ),
                  ),
                  if (fee < originalFee)
                    Text(
                      _formatVND(originalFee),
                      style: const TextStyle(
                        color: Color(0xFF8F90A6),
                        fontSize: 10.5,
                        decoration: TextDecoration.lineThrough,
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Khu vực Mã Giảm Giá Thực Tế (Voucher Validation)
  Widget _buildVoucherSection(double subtotal, double shippingFee) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFEEEEF0)),
        boxShadow: const [
          BoxShadow(color: Color(0x06000000), blurRadius: 8, offset: Offset(0, 2)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: AppColors.surfaceAlt,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.confirmation_num_rounded, color: AppColors.primary, size: 20),
              ),
              const SizedBox(width: 8),
              const Text('ShopNova Voucher / Mã Giảm Giá', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF1E2022))),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _voucherController,
                  textCapitalization: TextCapitalization.characters,
                  decoration: InputDecoration(
                    hintText: 'Nhập mã (NOVA20K, NOVA50K, FREESHIP)...',
                    hintStyle: const TextStyle(fontSize: 12, color: Color(0xFF8F90A6)),
                    isDense: true,
                    filled: true,
                    fillColor: const Color(0xFFFAFAFC),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: Color(0xFFE2E2E6)),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: Color(0xFFE2E2E6)),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: AppColors.primary),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              ElevatedButton(
                onPressed: () => _applyVoucherCode(_voucherController.text, subtotal, shippingFee),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                child: const Text('Áp Dụng', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
              ),
            ],
          ),
          if (_voucherError != null) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.error_outline_rounded, size: 14, color: Color(0xFFD0011B)),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    _voucherError!,
                    style: const TextStyle(color: Color(0xFFD0011B), fontSize: 12, fontWeight: FontWeight.w500),
                  ),
                ),
              ],
            ),
          ],
          if (_appliedVoucherCode != null) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFFE8F9EE),
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: const Color(0xFFBBF7D0)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.check_circle_rounded, color: Color(0xFF00BFA5), size: 16),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      'Đã áp dụng mã $_appliedVoucherCode: -${_formatVND(_appliedVoucherDiscount)}',
                      style: const TextStyle(color: Color(0xFF00897B), fontSize: 12.5, fontWeight: FontWeight.bold),
                    ),
                  ),
                  InkWell(
                    onTap: () {
                      setState(() {
                        _appliedVoucherCode = null;
                        _appliedVoucherDiscount = 0.0;
                        _voucherController.clear();
                      });
                    },
                    child: const Icon(Icons.close_rounded, size: 16, color: Color(0xFF555770)),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 10),
          // Gợi ý nhanh các voucher có sẵn
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              _buildVoucherChip('NOVA20K', 'Giảm 20K đơn 200K', subtotal, shippingFee),
              _buildVoucherChip('FREESHIPMAX', 'Freeship đơn 99K', subtotal, shippingFee),
              _buildVoucherChip('CHAOBANMOI', 'Giảm 50K đơn 150K', subtotal, shippingFee),
              _buildVoucherChip('NOVAMEGA50', 'Giảm 50K đơn 350K', subtotal, shippingFee),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildVoucherChip(String code, String desc, double subtotal, double shippingFee) {
    final isCurrent = _appliedVoucherCode == code;
    return InkWell(
      onTap: () {
        _voucherController.text = code;
        _applyVoucherCode(code, subtotal, shippingFee);
      },
      borderRadius: BorderRadius.circular(6),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: isCurrent ? primaryColor.withValues(alpha: 0.1) : const Color(0xFFF7F7F8),
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: isCurrent ? primaryColor : const Color(0xFFE2E2E6)),
        ),
        child: Text(
          '$code ($desc)',
          style: TextStyle(
            fontSize: 11,
            color: isCurrent ? primaryColor : const Color(0xFF555770),
            fontWeight: isCurrent ? FontWeight.bold : FontWeight.w500,
          ),
        ),
      ),
    );
  }

  Widget _buildPaymentMethods() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFEEEEF0)),
        boxShadow: const [
          BoxShadow(color: Color(0x06000000), blurRadius: 8, offset: Offset(0, 2)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: AppColors.surfaceAlt,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.payment_rounded, color: AppColors.primary, size: 20),
              ),
              const SizedBox(width: 8),
              const Text('Phương Thức Thanh Toán', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF1E2022))),
            ],
          ),
          const SizedBox(height: 12),
          _buildPaymentRadioTile('cod', 'Thanh toán khi nhận hàng (COD)', 'Thanh toán tiền mặt cho shipper khi nhận kiện hàng', Icons.local_atm_rounded),
          _buildPaymentRadioTile('novapay', 'Ví NovaPay', 'Ưu đãi hoàn xu 10.000đ khi thanh toán qua ví ShopNova', Icons.account_balance_wallet_rounded),
          _buildPaymentRadioTile('vnpay', 'VNPay / QR Code Ngân hàng', 'Quét mã VNPAY-QR nhanh chóng bảo mật', Icons.qr_code_scanner_rounded),
        ],
      ),
    );
  }

  Widget _buildPaymentRadioTile(String value, String title, String subtitle, IconData icon) {
    final isSelected = _selectedPaymentMethod == value;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: isSelected ? AppColors.surfaceAlt.withValues(alpha: 0.5) : Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: isSelected ? AppColors.primary : AppColors.border,
          width: isSelected ? 1.5 : 1,
        ),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: () => setState(() => _selectedPaymentMethod = value),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            children: [
              Icon(
                isSelected ? Icons.radio_button_checked_rounded : Icons.radio_button_unchecked_rounded,
                color: isSelected ? primaryColor : const Color(0xFF8F90A6),
                size: 20,
              ),
              const SizedBox(width: 10),
              Icon(icon, size: 20, color: isSelected ? primaryColor : const Color(0xFF555770)),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
                        color: isSelected ? primaryColor : const Color(0xFF1E2022),
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(subtitle, style: const TextStyle(color: Color(0xFF8F90A6), fontSize: 11)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPaymentDetails(
    double subtotal,
    double shippingFee,
    double voucherDiscount,
    double totalAmount,
  ) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFEEEEF0)),
        boxShadow: const [
          BoxShadow(color: Color(0x06000000), blurRadius: 8, offset: Offset(0, 2)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: AppColors.surfaceAlt,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.receipt_long_rounded, color: AppColors.primary, size: 20),
              ),
              const SizedBox(width: 8),
              const Text('Chi Tiết Thanh Toán', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF1E2022))),
            ],
          ),
          const SizedBox(height: 12),
          _buildRow('Tổng tiền hàng', _formatVND(subtotal)),
          _buildRow('Tổng phí vận chuyển thực tế', _formatVND(shippingFee)),
          if (voucherDiscount > 0)
            _buildRow('Giảm giá Voucher ShopNova', '-${_formatVND(voucherDiscount)}', isHighlight: true, highlightColor: const Color(0xFF00BFA5)),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 8),
            child: Divider(height: 1, color: Color(0xFFEEEEF0)),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Tổng thanh toán', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF1E2022))),
              Text(
                _formatVND(totalAmount),
                style: TextStyle(color: primaryColor, fontWeight: FontWeight.w800, fontSize: 19),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildRow(String label, String value, {bool isHighlight = false, Color? highlightColor}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Color(0xFF555770), fontSize: 13)),
          Text(
            value,
            style: TextStyle(
              color: isHighlight ? (highlightColor ?? primaryColor) : const Color(0xFF1E2022),
              fontSize: 13,
              fontWeight: isHighlight ? FontWeight.bold : FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSecurityNotice() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFFF0FDF4),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFBBF7D0)),
      ),
      child: const Row(
        children: [
          Icon(Icons.verified_user_rounded, color: Color(0xFF16A34A), size: 20),
          SizedBox(width: 10),
          Expanded(
            child: Text(
              'Giao dịch được bảo vệ và mã hóa an toàn 100% bởi ShopNova Shield.',
              style: TextStyle(color: Color(0xFF15803D), fontSize: 12, fontWeight: FontWeight.w500),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomBar(double totalAmount) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(color: Color(0x0C000000), offset: Offset(0, -4), blurRadius: 12),
        ],
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Tổng thanh toán', style: TextStyle(fontSize: 11, color: Color(0xFF8F90A6))),
                    Text(
                      _formatVND(totalAmount),
                      style: TextStyle(color: primaryColor, fontWeight: FontWeight.w800, fontSize: 18),
                    ),
                  ],
                ),
              ),
              Container(
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AppColors.primary, AppColors.earth],
                  ),
                  borderRadius: BorderRadius.circular(10),
                  boxShadow: [
                    BoxShadow(
                      color: primaryColor.withValues(alpha: 0.3),
                      blurRadius: 8,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: ElevatedButton(
                  onPressed: _isPlacingOrder ? null : _handlePlaceOrder,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.transparent,
                    shadowColor: Colors.transparent,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  child: _isPlacingOrder
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                        )
                      : const Text(
                          'Đặt Hàng',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
