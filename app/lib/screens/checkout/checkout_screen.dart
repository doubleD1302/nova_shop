import 'package:flutter/material.dart';
import '../../models/cart_item.dart';
import '../../models/address.dart';
import '../../services/address_service.dart';
import '../../services/auth_service.dart';
import '../../services/cart_service.dart';
import '../../services/order_service.dart';
import '../account/addresses_screen.dart';
import '../auth/login_screen.dart' as shopnova_auth;
import '../orders/orders_screen.dart';

class CheckoutScreen extends StatefulWidget {
  final List<CartItemModel>? selectedItems;

  const CheckoutScreen({super.key, this.selectedItems});

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  final Color primaryColor = const Color(0xFFEE4D2D);

  late TextEditingController _nameController;
  late TextEditingController _phoneController;
  late TextEditingController _addressController;
  late TextEditingController _provinceController;
  late TextEditingController _districtController;
  late TextEditingController _wardController;
  late TextEditingController _noteController;

  String _selectedPaymentMethod = 'cod';
  bool _isPlacingOrder = false;

  @override
  void initState() {
    super.initState();
    final user = AuthService().currentUser;
    _nameController = TextEditingController(text: user?.fullName.isNotEmpty == true ? user!.fullName : '');
    _phoneController = TextEditingController(text: user?.phone?.isNotEmpty == true ? user!.phone! : '');
    _addressController = TextEditingController();
    _provinceController = TextEditingController();
    _districtController = TextEditingController();
    _wardController = TextEditingController();
    _noteController = TextEditingController();
    _loadDefaultAddress();
  }

  Future<void> _loadDefaultAddress() async {
    if (!AuthService().isAuthenticated) return;
    try {
      final list = await AddressService().getAddresses();
      if (list.isNotEmpty && mounted) {
        final def = list.firstWhere((a) => a.isDefault, orElse: () => list.first);
        _applyAddress(def);
      }
    } catch (_) {}
  }

  void _applyAddress(Address addr) {
    setState(() {
      _nameController.text = addr.recipientName;
      _phoneController.text = addr.phone;
      _addressController.text = addr.detail;
      if (addr.ward != null && addr.ward!.isNotEmpty) {
        _wardController.text = addr.ward!;
      }
      if (addr.district != null && addr.district!.isNotEmpty) {
        _districtController.text = addr.district!;
      }
      _provinceController.text = addr.province;
    });
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

  InputDecoration _inputDeco(String label, IconData? icon) {
    return InputDecoration(
      labelText: label,
      labelStyle: const TextStyle(color: Color(0xFF8F90A6), fontSize: 13),
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
        borderSide: const BorderSide(color: Color(0xFFEE4D2D), width: 1.5),
      ),
    );
  }

  Future<void> _handlePlaceOrder() async {
    final items = _getItems();
    if (items.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Không có sản phẩm nào được chọn để đặt hàng.')),
      );
      return;
    }

    final recipientName = _nameController.text.trim();
    final recipientPhone = _phoneController.text.trim();

    if (recipientName.isEmpty || recipientPhone.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vui lòng điền họ tên và số điện thoại người nhận.')),
      );
      return;
    }

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
                    color: const Color(0xFFFFF0EC),
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
                      colors: [Color(0xFFEE4D2D), Color(0xFFFF5224)],
                    ),
                    borderRadius: BorderRadius.circular(10),
                    boxShadow: [
                      BoxShadow(
                        color: primaryColor.withOpacity(0.3),
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
    final shippingFee = subtotal >= 1000000 || subtotal == 0 ? 0.0 : 25000.0;
    final shippingDiscount = shippingFee > 0 ? 25000.0 : 0.0;
    final totalAmount = (subtotal + shippingFee - shippingDiscount).clamp(0.0, double.infinity);

    return Scaffold(
      backgroundColor: const Color(0xFFF6F7F9),
      appBar: AppBar(
        backgroundColor: Colors.white,
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
          // Dải màu sọc bưu kiện ShopNova
          Container(
            height: 3.5,
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [Color(0xFFEE4D2D), Color(0xFF00BFA5), Color(0xFFEE4D2D), Color(0xFF28293D)],
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
                  _buildPaymentMethods(),
                  _buildPaymentDetails(subtotal, shippingFee, shippingDiscount, totalAmount),
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
                  color: const Color(0xFFFFF0EC),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.location_on_rounded, color: Color(0xFFEE4D2D), size: 20),
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
                    color: const Color(0xFFFFF0EC),
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
            decoration: _inputDeco('Họ và tên người nhận', Icons.person_outline_rounded),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _phoneController,
            keyboardType: TextInputType.phone,
            decoration: _inputDeco('Số điện thoại liên hệ', Icons.phone_outlined),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _addressController,
            decoration: _inputDeco('Địa chỉ chi tiết (Số nhà, đường)', Icons.home_outlined),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _wardController,
                  decoration: _inputDeco('Phường / Xã', null),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  controller: _districtController,
                  decoration: _inputDeco('Quận / Huyện', null),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  controller: _provinceController,
                  decoration: _inputDeco('Tỉnh / TP', null),
                ),
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
                borderSide: const BorderSide(color: Color(0xFFEE4D2D)),
              ),
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            ),
          ),
        ],
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
                  color: const Color(0xFFFFF0EC),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.payment_rounded, color: Color(0xFFEE4D2D), size: 20),
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
        color: isSelected ? const Color(0xFFFFF7F4) : Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: isSelected ? const Color(0xFFEE4D2D) : const Color(0xFFEEEEF0),
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
    double shippingDiscount,
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
                  color: const Color(0xFFFFF0EC),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.receipt_long_rounded, color: Color(0xFFEE4D2D), size: 20),
              ),
              const SizedBox(width: 8),
              const Text('Chi Tiết Thanh Toán', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF1E2022))),
            ],
          ),
          const SizedBox(height: 12),
          _buildRow('Tổng tiền hàng', _formatVND(subtotal)),
          _buildRow('Tổng phí vận chuyển', _formatVND(shippingFee)),
          if (shippingDiscount > 0)
            _buildRow('Giảm giá phí vận chuyển', '-${_formatVND(shippingDiscount)}', isHighlight: true, highlightColor: const Color(0xFF00BFA5)),
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
      child: Row(
        children: const [
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
                    colors: [Color(0xFFEE4D2D), Color(0xFFFF5224)],
                  ),
                  borderRadius: BorderRadius.circular(10),
                  boxShadow: [
                    BoxShadow(
                      color: primaryColor.withOpacity(0.3),
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
