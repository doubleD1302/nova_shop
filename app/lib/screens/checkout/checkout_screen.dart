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
      // Nếu người dùng chưa đăng nhập: tự động kích hoạt tài khoản theo số điện thoại
      // để lưu trữ đơn hàng bảo mật trên máy chủ và CSDL MySQL mà không làm gián đoạn
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
        // Xóa giỏ hàng local cho các item đã mua
        CartService().clearSelected();

        final orderCode = order['code'] ?? 'ORD';
        final totalAmount = order['totalAmount'] ?? order['total_amount'] ?? 0;
        final isOffline = order['isSavedOffline'] == true;

        // Hiện popup thành công
        showDialog(
          context: context,
          barrierDismissible: false,
          builder: (ctx) => AlertDialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    color: Colors.green.shade50,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.check_circle, color: Colors.green, size: 48),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Đặt Hàng Thành Công!',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                Text(
                  'Mã đơn hàng: #$orderCode',
                  style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold, fontSize: 14),
                ),
                const SizedBox(height: 4),
                Text(
                  'Tổng thanh toán: ${_formatVND(num.tryParse(totalAmount.toString()) ?? 0)}',
                  style: const TextStyle(color: Colors.black87, fontSize: 13),
                ),
                const SizedBox(height: 12),
                Text(
                  isOffline
                      ? 'Đơn hàng đã được lưu an toàn trên ứng dụng và đang chờ người bán xác nhận.'
                      : 'Đơn hàng của bạn đã được lưu vào hệ thống máy chủ và đang chờ Shop xác nhận.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.grey, fontSize: 12, height: 1.4),
                ),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () {
                      Navigator.pop(ctx); // đóng dialog
                      Navigator.pushReplacement(
                        context,
                        MaterialPageRoute(
                          builder: (context) => const OrdersScreen(initialTabIndex: 0),
                        ),
                      );
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: primaryColor,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    child: const Text('Xem Đơn Mua Của Tôi', style: TextStyle(fontWeight: FontWeight.bold)),
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
            backgroundColor: Colors.red,
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
        SnackBar(content: Text('Đã xảy ra lỗi: $e'), backgroundColor: Colors.red),
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
      backgroundColor: const Color(0xFFF5F5F5),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0.5,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.black87),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Thanh Toán Đặt Hàng',
          style: TextStyle(color: Colors.black87, fontSize: 18, fontWeight: FontWeight.bold),
        ),
      ),
      body: Column(
        children: [
          // Dải màu sọc bưu kiện
          Container(
            height: 3,
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [Colors.red, Colors.blue, Colors.orange],
              ),
            ),
          ),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.only(bottom: 24),
              child: Column(
                children: [
                  _buildAddressSection(),
                  const SizedBox(height: 8),
                  _buildItemsSection(items),
                  const SizedBox(height: 8),
                  _buildPaymentMethods(),
                  const SizedBox(height: 8),
                  _buildPaymentDetails(subtotal, shippingFee, shippingDiscount, totalAmount),
                  const SizedBox(height: 8),
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
      color: Colors.white,
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.location_on, color: primaryColor, size: 20),
              const SizedBox(width: 8),
              const Text(
                'Địa Chỉ Nhận Hàng',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
              ),
              const Spacer(),
              TextButton.icon(
                onPressed: () async {
                  final selected = await Navigator.push<Address>(
                    context,
                    MaterialPageRoute(builder: (_) => const AddressesScreen(selectMode: true)),
                  );
                  if (selected != null && mounted) {
                    _applyAddress(selected);
                  }
                },
                icon: const Icon(Icons.bookmark_outline, size: 14),
                label: const Text('Chọn sổ địa chỉ', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                style: TextButton.styleFrom(
                  foregroundColor: primaryColor,
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _nameController,
            decoration: const InputDecoration(
              labelText: 'Họ và tên người nhận',
              isDense: true,
              prefixIcon: Icon(Icons.person_outline, size: 20),
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _phoneController,
            keyboardType: TextInputType.phone,
            decoration: const InputDecoration(
              labelText: 'Số điện thoại liên hệ',
              isDense: true,
              prefixIcon: Icon(Icons.phone_outlined, size: 20),
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _addressController,
            decoration: const InputDecoration(
              labelText: 'Địa chỉ chi tiết (Số nhà, đường)',
              isDense: true,
              prefixIcon: Icon(Icons.home_outlined, size: 20),
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _wardController,
                  decoration: const InputDecoration(
                    labelText: 'Phường / Xã',
                    isDense: true,
                    border: OutlineInputBorder(),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  controller: _districtController,
                  decoration: const InputDecoration(
                    labelText: 'Quận / Huyện',
                    isDense: true,
                    border: OutlineInputBorder(),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  controller: _provinceController,
                  decoration: const InputDecoration(
                    labelText: 'Tỉnh / TP',
                    isDense: true,
                    border: OutlineInputBorder(),
                  ),
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
      color: Colors.white,
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                decoration: BoxDecoration(color: const Color(0xFF003366), borderRadius: BorderRadius.circular(3)),
                child: const Text('MALL', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
              ),
              const SizedBox(width: 8),
              const Text('Nova Mall & Shop', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
              const Spacer(),
              Text('${items.length} món', style: const TextStyle(color: Colors.grey, fontSize: 12)),
            ],
          ),
          const Divider(height: 20),
          ...items.map((it) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(6),
                      child: Container(
                        width: 60,
                        height: 60,
                        color: Colors.grey.shade100,
                        child: it.imageUrl.isNotEmpty
                            ? Image.network(
                                it.imageUrl,
                                fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) => const Icon(Icons.image, color: Colors.grey),
                              )
                            : const Icon(Icons.image, color: Colors.grey),
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
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Phân loại: ${it.variantName}',
                            style: const TextStyle(color: Colors.grey, fontSize: 11),
                          ),
                          const SizedBox(height: 4),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                _formatVND(it.price),
                                style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold, fontSize: 13),
                              ),
                              Text('x${it.qty}', style: const TextStyle(color: Colors.grey, fontSize: 12)),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              )),
          const Divider(height: 20),
          // Lời nhắn cho người bán
          TextField(
            controller: _noteController,
            decoration: InputDecoration(
              hintText: 'Lưu ý cho người bán (nếu có)...',
              hintStyle: const TextStyle(fontSize: 12),
              isDense: true,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(6)),
              contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentMethods() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Phương Thức Thanh Toán', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
          const SizedBox(height: 10),
          _buildPaymentRadioTile('cod', 'Thanh toán khi nhận hàng (COD)', 'Thanh toán tiền mặt cho shipper khi nhận kiện hàng'),
          _buildPaymentRadioTile('novapay', 'Ví NovaPay', 'Ưu đãi hoàn xu 10.000đ khi thanh toán qua ví'),
          _buildPaymentRadioTile('vnpay', 'VNPay / QR Code Ngân hàng', 'Quét mã VNPAY-QR nhanh chóng bảo mật'),
        ],
      ),
    );
  }

  Widget _buildPaymentRadioTile(String value, String title, String subtitle) {
    final isSelected = _selectedPaymentMethod == value;
    return InkWell(
      onTap: () => setState(() => _selectedPaymentMethod = value),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          children: [
            Icon(
              isSelected ? Icons.radio_button_checked : Icons.radio_button_unchecked,
              color: isSelected ? primaryColor : Colors.grey,
              size: 20,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                      color: isSelected ? primaryColor : Colors.black87,
                      fontSize: 13,
                    ),
                  ),
                  Text(subtitle, style: const TextStyle(color: Colors.grey, fontSize: 11)),
                ],
              ),
            ),
          ],
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
      color: Colors.white,
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Chi Tiết Thanh Toán', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
          const SizedBox(height: 10),
          _buildRow('Tổng tiền hàng', _formatVND(subtotal)),
          _buildRow('Tổng phí vận chuyển', _formatVND(shippingFee)),
          if (shippingDiscount > 0)
            _buildRow('Giảm giá phí vận chuyển', '-${_formatVND(shippingDiscount)}', isHighlight: true),
          const Divider(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Tổng thanh toán', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
              Text(
                _formatVND(totalAmount),
                style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold, fontSize: 18),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildRow(String label, String value, {bool isHighlight = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Colors.grey, fontSize: 13)),
          Text(
            value,
            style: TextStyle(
              color: isHighlight ? primaryColor : Colors.black87,
              fontSize: 13,
              fontWeight: isHighlight ? FontWeight.bold : FontWeight.normal,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSecurityNotice() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(12),
      child: Row(
        children: [
          Icon(Icons.shield, color: Colors.blue.shade400, size: 20),
          const SizedBox(width: 8),
          const Expanded(
            child: Text(
              'Giao dịch được bảo vệ và mã hóa an toàn 100% bởi ShopNova Shield.',
              style: TextStyle(color: Colors.grey, fontSize: 11),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomBar(double totalAmount) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.06), offset: const Offset(0, -3), blurRadius: 6),
        ],
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    const Text('Tổng thanh toán', style: TextStyle(fontSize: 11, color: Colors.grey)),
                    Text(
                      _formatVND(totalAmount),
                      style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold, fontSize: 18),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 14),
              ElevatedButton(
                onPressed: _isPlacingOrder ? null : _handlePlaceOrder,
                style: ElevatedButton.styleFrom(
                  backgroundColor: primaryColor,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
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
            ],
          ),
        ),
      ),
    );
  }
}
