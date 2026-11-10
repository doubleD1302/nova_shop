import 'package:flutter/material.dart';
import '../../services/auth_service.dart';
import '../../theme/app_colors.dart';
import 'seller_hub_screen.dart';

const List<String> kVietnamProvinces = [
  'TP. Hồ Chí Minh', 'Hà Nội', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ',
  'An Giang', 'Bà Rịa - Vũng Tàu', 'Bắc Giang', 'Bắc Kạn', 'Bạc Liêu',
  'Bắc Ninh', 'Bến Tre', 'Bình Định', 'Bình Dương', 'Bình Phước',
  'Bình Thuận', 'Cà Mau', 'Cao Bằng', 'Đắk Lắk', 'Đắk Nông',
  'Điện Biên', 'Đồng Nai', 'Đồng Tháp', 'Gia Lai', 'Hà Giang',
  'Hà Nam', 'Hà Tĩnh', 'Hải Dương', 'Hậu Giang', 'Hòa Bình',
  'Hưng Yên', 'Khánh Hòa', 'Kiên Giang', 'Kon Tum', 'Lai Châu',
  'Lâm Đồng', 'Lạng Sơn', 'Lào Cai', 'Long An', 'Nam Định',
  'Nghệ An', 'Ninh Bình', 'Ninh Thuận', 'Phú Thọ', 'Phú Yên',
  'Quảng Bình', 'Quảng Nam', 'Quảng Ngãi', 'Quảng Ninh', 'Quảng Trị',
  'Sóc Trăng', 'Sơn La', 'Tây Ninh', 'Thái Bình', 'Thái Nguyên',
  'Thanh Hóa', 'Thừa Thiên Huế', 'Tiền Giang', 'Trà Vinh', 'Tuyên Quang',
  'Vĩnh Long', 'Vĩnh Phúc', 'Yên Bái',
];

/// Màn hình Đăng Ký Kênh Người Bán ShopNova chuẩn Shopee Seller Centre:
/// 1. Màn hình Chào mừng (Welcome)
/// 2. Stepper 5 bước: Thông tin Shop -> Cài đặt vận chuyển -> Thông tin định danh -> Thông tin thuế -> Hoàn tất
class SellerRegisterScreen extends StatefulWidget {
  const SellerRegisterScreen({super.key});

  @override
  State<SellerRegisterScreen> createState() => _SellerRegisterScreenState();
}

class _SellerRegisterScreenState extends State<SellerRegisterScreen> {
  final AuthService _authService = AuthService();

  // currentStep: 0 = Màn hình Welcome, 1..5 = Các bước Stepper
  int _currentStep = 0;
  bool _submitting = false;
  String? _errorMessage;

  // Controllers Bước 1: Thông tin Shop
  final TextEditingController _shopNameController = TextEditingController();
  final TextEditingController _shopTaglineController = TextEditingController();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _phoneController = TextEditingController();

  // Controllers tài khoản (nếu chưa đăng nhập)
  final TextEditingController _fullNameController = TextEditingController();
  final TextEditingController _usernameController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  final TextEditingController _confirmPasswordController = TextEditingController();
  bool _showPassword = false;
  bool _showConfirmPassword = false;

  // Địa chỉ lấy hàng
  String _pickupAddress = '';
  String _selectedProvince = 'TP. Hồ Chí Minh';

  // Bước 2: Cài đặt vận chuyển
  bool _shippingNhanh = true;
  bool _shippingTietKiem = true;
  bool _shippingHoaToc = false;

  // Bước 3: Thông tin định danh
  String _businessType = 'personal'; // 'personal' | 'household' | 'enterprise'
  final TextEditingController _ownerNameController = TextEditingController();
  final TextEditingController _idCardController = TextEditingController();

  // Bước 4: Thông tin thuế
  final TextEditingController _taxCodeController = TextEditingController();
  final TextEditingController _invoiceEmailController = TextEditingController();
  bool _agreeTerms = true;

  @override
  void initState() {
    super.initState();
    final user = _authService.currentUser;
    if (user != null) {
      if (user.email != null && user.email!.isNotEmpty) {
        _emailController.text = user.email!;
        _invoiceEmailController.text = user.email!;
      }
      if (user.phone != null && user.phone!.isNotEmpty) {
        _phoneController.text = user.phone!.replaceAll('+84', '');
      }
      _fullNameController.text = user.fullName;
      _ownerNameController.text = user.fullName;
    }
  }

  @override
  void dispose() {
    _shopNameController.dispose();
    _shopTaglineController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _fullNameController.dispose();
    _usernameController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _ownerNameController.dispose();
    _idCardController.dispose();
    _taxCodeController.dispose();
    _invoiceEmailController.dispose();
    super.dispose();
  }

  bool _isValidEmail(String email) {
    return RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email.trim());
  }

  void _showAddressModal() {
    String modalProvince = _selectedProvince;
    final detailController = TextEditingController(
      text: _pickupAddress.contains(',')
          ? _pickupAddress.substring(0, _pickupAddress.lastIndexOf(',')).trim()
          : _pickupAddress,
    );

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Container(
          decoration: const BoxDecoration(
            color: Color(0xFFFFFCF7),
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Địa chỉ lấy hàng của Shop',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF49352D)),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, color: Color(0xFF8B7566)),
                    onPressed: () => Navigator.pop(ctx),
                  ),
                ],
              ),
              const Divider(color: Color(0xFFE6D5C2)),
              const SizedBox(height: 12),
              const Text('Tỉnh / Thành phố', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold, color: Color(0xFF49352D))),
              const SizedBox(height: 6),
              DropdownButtonFormField<String>(
                value: modalProvince,
                decoration: const InputDecoration(contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 12)),
                items: kVietnamProvinces.map((p) => DropdownMenuItem(value: p, child: Text(p, style: const TextStyle(fontSize: 13)))).toList(),
                onChanged: (val) {
                  if (val != null) setModalState(() => modalProvince = val);
                },
              ),
              const SizedBox(height: 14),
              const Text('Địa chỉ chi tiết (Số nhà, tên đường, phường/xã)', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold, color: Color(0xFF49352D))),
              const SizedBox(height: 6),
              TextField(
                controller: detailController,
                maxLines: 3,
                decoration: const InputDecoration(
                  hintText: 'Ví dụ: 123 Đường Nguyễn Huệ, Phường Bến Nghé, Quận 1...',
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                height: 46,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFEE4D2D),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  onPressed: () {
                    final detail = detailController.text.trim();
                    if (detail.isEmpty) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Vui lòng nhập địa chỉ chi tiết.'), backgroundColor: Colors.red),
                      );
                      return;
                    }
                    setState(() {
                      _selectedProvince = modalProvince;
                      _pickupAddress = '$detail, $modalProvince';
                      _errorMessage = null;
                    });
                    Navigator.pop(ctx);
                  },
                  child: const Text('Lưu địa chỉ lấy hàng', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _handleNextStep() async {
    setState(() => _errorMessage = null);

    // Validate Bước 1: Thông tin Shop
    if (_currentStep == 1) {
      final name = _shopNameController.text.trim();
      if (name.isEmpty) {
        setState(() => _errorMessage = 'Vui lòng nhập Tên Shop (bắt buộc).');
        return;
      }
      if (name.length < 3 || name.length > 30) {
        setState(() => _errorMessage = 'Tên Shop phải có độ dài từ 3 đến 30 ký tự.');
        return;
      }
      if (_pickupAddress.isEmpty) {
        setState(() => _errorMessage = 'Vui lòng bấm "+ Thêm địa chỉ" để thiết lập địa chỉ lấy hàng của Shop.');
        return;
      }
      final email = _emailController.text.trim();
      if (email.isEmpty || !_isValidEmail(email)) {
        setState(() => _errorMessage = 'Vui lòng nhập email hợp lệ để nhận thông báo đơn hàng.');
        return;
      }
      final phone = _phoneController.text.trim();
      if (phone.isEmpty || !RegExp(r'^[+()\d .-]{8,20}$').hasMatch(phone)) {
        setState(() => _errorMessage = 'Vui lòng nhập số điện thoại liên hệ hợp lệ.');
        return;
      }

      final user = _authService.currentUser;
      if (user == null) {
        final fullName = _fullNameController.text.trim();
        final username = _usernameController.text.trim().toLowerCase();
        final password = _passwordController.text;
        final confirm = _confirmPasswordController.text;

        if (fullName.isEmpty || username.isEmpty || password.isEmpty) {
          setState(() => _errorMessage = 'Vui lòng điền họ tên, tên đăng nhập và mật khẩu tài khoản người bán.');
          return;
        }
        if (!RegExp(r'^[a-z0-9_]{3,50}$').hasMatch(username)) {
          setState(() => _errorMessage = 'Tên đăng nhập phải từ 3–50 ký tự (chữ cái, chữ số hoặc dấu gạch dưới).');
          return;
        }
        if (password.length < 8) {
          setState(() => _errorMessage = 'Mật khẩu phải có ít nhất 8 ký tự.');
          return;
        }
        if (password != confirm) {
          setState(() => _errorMessage = 'Mật khẩu nhập lại không khớp.');
          return;
        }
      }

      setState(() => _currentStep = 2);
      return;
    }

    // Validate Bước 2: Cài đặt vận chuyển
    if (_currentStep == 2) {
      if (!_shippingNhanh && !_shippingTietKiem && !_shippingHoaToc) {
        setState(() => _errorMessage = 'Vui lòng kích hoạt ít nhất 1 phương thức vận chuyển cho Shop.');
        return;
      }
      setState(() => _currentStep = 3);
      return;
    }

    // Validate Bước 3: Thông tin định danh
    if (_currentStep == 3) {
      final owner = _ownerNameController.text.trim();
      if (owner.isEmpty) {
        setState(() => _errorMessage = 'Vui lòng nhập họ và tên chủ sở hữu / người đại diện.');
        return;
      }
      final idCard = _idCardController.text.trim();
      if (idCard.isEmpty || !RegExp(r'^\d{9,12}$').hasMatch(idCard)) {
        setState(() => _errorMessage = 'Số CMND / CCCD hợp lệ phải có từ 9 đến 12 chữ số.');
        return;
      }
      setState(() => _currentStep = 4);
      return;
    }

    // Validate Bước 4: Thông tin thuế & Gửi duyệt
    if (_currentStep == 4) {
      if (!_agreeTerms) {
        setState(() => _errorMessage = 'Bạn cần đồng ý với Quy chế hoạt động sàn TMĐT NovaShop để tiếp tục.');
        return;
      }

      final taxCode = _taxCodeController.text.trim();
      if (taxCode.isNotEmpty && !RegExp(r'^\d{10}(?:-\d{3})?$').hasMatch(taxCode)) {
        setState(() => _errorMessage = 'Mã số thuế không hợp lệ.');
        return;
      }

      final invoiceEmail = _invoiceEmailController.text.trim();
      if (invoiceEmail.isNotEmpty && !_isValidEmail(invoiceEmail)) {
        setState(() => _errorMessage = 'Email nhận hóa đơn không hợp lệ.');
        return;
      }

      final shippingMethods = [
        if (_shippingNhanh) 'nhanh',
        if (_shippingTietKiem) 'tietkiem',
        if (_shippingHoaToc) 'hoatoc',
      ];

      final phone = _phoneController.text.trim();
      final fullPhone = phone.startsWith('+84') ? phone : (phone.startsWith('0') ? '+84${phone.substring(1)}' : '+84$phone');

      final sellerProfile = {
        'pickupAddress': _pickupAddress,
        'province': _selectedProvince,
        'contactEmail': _emailController.text.trim().toLowerCase(),
        'contactPhone': fullPhone,
        'shippingMethods': shippingMethods,
        'businessType': _businessType,
        'ownerName': _ownerNameController.text.trim(),
        'idCard': _idCardController.text.trim(),
        if (taxCode.isNotEmpty) 'taxCode': taxCode,
        if (invoiceEmail.isNotEmpty) 'invoiceEmail': invoiceEmail.toLowerCase(),
        'agreeTerms': true,
      };

      setState(() {
        _submitting = true;
        _errorMessage = null;
      });

      final user = _authService.currentUser;
      final shopName = _shopNameController.text.trim();
      final shopTagline = _shopTaglineController.text.trim();

      bool success = false;
      if (user != null) {
        success = await _authService.registerSellerShop(
          shopName: shopName,
          tagline: shopTagline.isNotEmpty ? shopTagline : null,
          sellerProfile: sellerProfile,
        );
      } else {
        success = await _authService.register(
          username: _usernameController.text.trim().toLowerCase(),
          password: _passwordController.text,
          fullName: _fullNameController.text.trim(),
          email: _emailController.text.trim().toLowerCase(),
          phone: fullPhone,
          role: 'seller',
          shopName: shopName,
          shopTagline: shopTagline.isNotEmpty ? shopTagline : null,
          sellerProfile: sellerProfile,
        );
      }

      if (!mounted) return;
      setState(() => _submitting = false);

      if (success) {
        setState(() => _currentStep = 5);
      } else {
        setState(() {
          _errorMessage = _authService.lastError ?? 'Đăng ký gian hàng thất bại. Vui lòng kiểm tra lại.';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_currentStep == 0) {
      return _buildWelcomeScreen();
    }

    return Scaffold(
      backgroundColor: const Color(0xFFFBF3E8),
      appBar: AppBar(
        title: const Text('Đăng Ký Kênh Người Bán', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF49352D))),
        backgroundColor: const Color(0xFFFFFCF7),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF49352D)),
          onPressed: () {
            if (_currentStep > 1) {
              setState(() => _currentStep--);
            } else {
              setState(() => _currentStep = 0);
            }
          },
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Stepper Header 5 bước
            _buildStepperHeader(),

            // Nội dung theo bước
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (_errorMessage != null) ...[
                      _buildErrorBanner(_errorMessage!),
                      const SizedBox(height: 16),
                    ],

                    if (_currentStep == 1) _buildStep1ShopInfo(),
                    if (_currentStep == 2) _buildStep2Shipping(),
                    if (_currentStep == 3) _buildStep3Identity(),
                    if (_currentStep == 4) _buildStep4Tax(),
                    if (_currentStep == 5) _buildStep5Completed(),

                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ),

            // Navigation bar dưới cùng
            if (_currentStep >= 1 && _currentStep <= 4)
              _buildBottomNavigationBar(),
          ],
        ),
      ),
    );
  }

  // =========================================================================
  // GIAO DIỆN 0: MÀN HÌNH CHÀO MỪNG (THEO ẢNH MINH HỌA SHOPEE WELCOME)
  // =========================================================================
  Widget _buildWelcomeScreen() {
    return Scaffold(
      backgroundColor: const Color(0xFFFBF3E8),
      appBar: AppBar(
        backgroundColor: const Color(0xFFFFFCF7),
        elevation: 0,
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(color: const Color(0xFFEE4D2D), borderRadius: BorderRadius.circular(6)),
              child: const Icon(Icons.shopping_bag_outlined, size: 16, color: Colors.white),
            ),
            const SizedBox(width: 8),
            const Text('ShopNova Seller', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF49352D))),
          ],
        ),
        centerTitle: true,
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Container(
              constraints: const BoxConstraints(maxWidth: 500),
              decoration: BoxDecoration(
                color: const Color(0xFFFFFCF7),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: const Color(0xFFE6D5C2)),
                boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 10, offset: Offset(0, 4))],
              ),
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 36),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 120,
                    height: 120,
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFEFE7),
                      shape: BoxShape.circle,
                      border: Border.all(color: const Color(0xFFBD6E49).withOpacity(0.3), width: 2),
                    ),
                    child: const Center(
                      child: Icon(Icons.storefront_rounded, size: 64, color: Color(0xFFBD6E49)),
                    ),
                  ),
                  const SizedBox(height: 24),

                  const Text(
                    'Chào mừng đến với\nKênh Người Bán NovaShop!',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 21, fontWeight: FontWeight.bold, color: Color(0xFF49352D), height: 1.3),
                  ),
                  const SizedBox(height: 12),

                  const Text(
                    'Vui lòng cung cấp thông tin để thành lập tài khoản người bán trên NovaShop.',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 13.5, color: Color(0xFF8B7566), height: 1.4),
                  ),
                  const SizedBox(height: 32),

                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton(
                      onPressed: () => setState(() => _currentStep = 1),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFEE4D2D),
                        foregroundColor: Colors.white,
                        elevation: 2,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: const Text('Bắt đầu đăng ký', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                    ),
                  ),
                  const SizedBox(height: 16),

                  TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('← Quay lại trang trước', style: TextStyle(fontSize: 13, color: Color(0xFF8B7566))),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  // =========================================================================
  // THANH STEPPER TRÊN ĐẦU
  // =========================================================================
  Widget _buildStepperHeader() {
    final steps = [
      {'id': 1, 'title': 'Thông tin'},
      {'id': 2, 'title': 'Vận chuyển'},
      {'id': 3, 'title': 'Định danh'},
      {'id': 4, 'title': 'Thuế'},
      {'id': 5, 'title': 'Hoàn tất'},
    ];

    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFFFFFCF7),
        border: Border(bottom: BorderSide(color: Color(0xFFE6D5C2))),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: steps.map((st) {
          final id = st['id'] as int;
          final isCurrent = _currentStep == id;
          final isCompleted = _currentStep > id;

          Color badgeColor;
          Widget badgeContent;
          if (isCompleted) {
            badgeColor = const Color(0xFFEE4D2D);
            badgeContent = const Icon(Icons.check, size: 12, color: Colors.white);
          } else if (isCurrent) {
            badgeColor = const Color(0xFFEE4D2D);
            badgeContent = Text('$id', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.white));
          } else {
            badgeColor = const Color(0xFFE6D5C2);
            badgeContent = Text('$id', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF8B7566)));
          }

          return Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  color: badgeColor,
                  shape: BoxShape.circle,
                  boxShadow: isCurrent ? [BoxShadow(color: const Color(0xFFEE4D2D).withOpacity(0.3), blurRadius: 6)] : null,
                ),
                child: Center(child: badgeContent),
              ),
              const SizedBox(height: 4),
              Text(
                st['title'] as String,
                style: TextStyle(
                  fontSize: 10.5,
                  fontWeight: isCurrent ? FontWeight.bold : FontWeight.w500,
                  color: isCurrent ? const Color(0xFFEE4D2D) : (isCompleted ? const Color(0xFF49352D) : const Color(0xFF8B7566)),
                ),
              ),
            ],
          );
        }).toList(),
      ),
    );
  }

  Widget _buildErrorBanner(String message) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFFDE8E8),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFF8B4B4)),
      ),
      padding: const EdgeInsets.all(12),
      child: Row(
        children: [
          const Icon(Icons.error_outline, color: Colors.red, size: 18),
          const SizedBox(width: 8),
          Expanded(child: Text(message, style: const TextStyle(fontSize: 12.5, color: Colors.red, fontWeight: FontWeight.w500))),
        ],
      ),
    );
  }

  // =========================================================================
  // BƯỚC 1: THÔNG TIN SHOP
  // =========================================================================
  Widget _buildStep1ShopInfo() {
    final user = _authService.currentUser;

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFFFFCF7),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE6D5C2)),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Thông tin cơ bản Shop', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF49352D))),
          const SizedBox(height: 12),

          TextField(
            controller: _shopNameController,
            maxLength: 30,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              labelText: 'Tên Shop *',
              hintText: 'Nhập tên gian hàng...',
              counterText: '${_shopNameController.text.length}/30',
            ),
          ),
          const SizedBox(height: 12),

          TextField(
            controller: _shopTaglineController,
            maxLength: 100,
            decoration: const InputDecoration(
              labelText: 'Slogan gian hàng',
              hintText: 'Ví dụ: Hàng chính hãng, Giao hàng siêu tốc...',
            ),
          ),
          const SizedBox(height: 12),

          const Text('Địa chỉ lấy hàng *', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold, color: Color(0xFF49352D))),
          const SizedBox(height: 6),
          if (_pickupAddress.isNotEmpty)
            Container(
              decoration: BoxDecoration(
                color: const Color(0xFFFBF3E8),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE6D5C2)),
              ),
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  const Icon(Icons.location_on_outlined, color: Color(0xFFEE4D2D), size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(_pickupAddress, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: Color(0xFF49352D))),
                  ),
                  TextButton(
                    onPressed: _showAddressModal,
                    child: const Text('Thay đổi', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFFEE4D2D))),
                  ),
                ],
              ),
            )
          else
            OutlinedButton.icon(
              onPressed: _showAddressModal,
              icon: const Icon(Icons.add_location_alt_outlined, size: 18),
              label: const Text('+ Thêm địa chỉ lấy hàng'),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: Color(0xFFEE4D2D), style: BorderStyle.solid),
                foregroundColor: const Color(0xFFEE4D2D),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              ),
            ),
          const SizedBox(height: 14),

          TextField(
            controller: _emailController,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(
              labelText: 'Email liên hệ nhận đơn *',
              hintText: 'email@example.com',
            ),
          ),
          const SizedBox(height: 12),

          TextField(
            controller: _phoneController,
            keyboardType: TextInputType.phone,
            decoration: const InputDecoration(
              labelText: 'Số điện thoại *',
              hintText: '0901234567',
              prefixText: '+84 ',
            ),
          ),

          if (user == null) ...[
            const SizedBox(height: 20),
            Container(
              decoration: BoxDecoration(
                color: const Color(0xFFFFEFE7).withOpacity(0.5),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFEE4D2D).withOpacity(0.4)),
              ),
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.person_add_alt_1_outlined, color: Color(0xFFEE4D2D), size: 18),
                      SizedBox(width: 8),
                      Text('Thiết lập tài khoản người bán', style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.bold, color: Color(0xFF49352D))),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _fullNameController,
                    decoration: const InputDecoration(labelText: 'Họ và tên chủ sở hữu *', hintText: 'Nguyễn Văn A'),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _usernameController,
                    decoration: const InputDecoration(labelText: 'Tên đăng nhập *', hintText: 'seller_username'),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _passwordController,
                    obscureText: !_showPassword,
                    decoration: InputDecoration(
                      labelText: 'Mật khẩu *',
                      hintText: 'Tối thiểu 8 ký tự',
                      suffixIcon: IconButton(
                        icon: Icon(_showPassword ? Icons.visibility_off : Icons.visibility, size: 18),
                        onPressed: () => setState(() => _showPassword = !_showPassword),
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _confirmPasswordController,
                    obscureText: !_showConfirmPassword,
                    decoration: InputDecoration(
                      labelText: 'Nhập lại mật khẩu *',
                      suffixIcon: IconButton(
                        icon: Icon(_showConfirmPassword ? Icons.visibility_off : Icons.visibility, size: 18),
                        onPressed: () => setState(() => _showConfirmPassword = !_showConfirmPassword),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  // =========================================================================
  // BƯỚC 2: CÀI ĐẶT VẬN CHUYỂN
  // =========================================================================
  Widget _buildStep2Shipping() {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFFFFCF7),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE6D5C2)),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            decoration: BoxDecoration(
              color: const Color(0xFFFBF3E8),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE6D5C2)),
            ),
            padding: const EdgeInsets.all(12),
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.local_shipping_outlined, color: Color(0xFFEE4D2D), size: 18),
                    SizedBox(width: 8),
                    Text('Phương thức vận chuyển đối tác', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF49352D))),
                  ],
                ),
                SizedBox(height: 4),
                Text(
                  'Lựa chọn các đơn vị vận chuyển đối tác để giao sản phẩm của bạn tới khách hàng trên toàn quốc.',
                  style: TextStyle(fontSize: 11.5, color: Color(0xFF8B7566)),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          _buildShippingMethodTile(
            title: '⚡ Vận chuyển Nhanh',
            badge: 'Khuyên dùng',
            subtitle: 'Giao Hàng Nhanh (GHN), Viettel Post, SPX Express. Thời gian giao 1–3 ngày làm việc.',
            value: _shippingNhanh,
            onChanged: (val) => setState(() => _shippingNhanh = val),
          ),
          const SizedBox(height: 10),

          _buildShippingMethodTile(
            title: '📦 Vận chuyển Tiết Kiệm',
            subtitle: 'Giao Hàng Tiết Kiệm (GHTK), VNPost Bưu Điện. Tối ưu chi phí ship cho người mua.',
            value: _shippingTietKiem,
            onChanged: (val) => setState(() => _shippingTietKiem = val),
          ),
          const SizedBox(height: 10),

          _buildShippingMethodTile(
            title: '🚀 Vận chuyển Hỏa Tốc',
            subtitle: 'Ahamove, GrabExpress. Giao siêu tốc trong 1–2 giờ (nội thành cùng tỉnh/thành phố).',
            value: _shippingHoaToc,
            onChanged: (val) => setState(() => _shippingHoaToc = val),
          ),
          const SizedBox(height: 16),

          const Text('Tỉnh / Thành phố kho gửi hàng:', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF49352D))),
          const SizedBox(height: 6),
          DropdownButtonFormField<String>(
            value: _selectedProvince,
            decoration: const InputDecoration(contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 12)),
            items: kVietnamProvinces.map((p) => DropdownMenuItem(value: p, child: Text(p, style: const TextStyle(fontSize: 13)))).toList(),
            onChanged: (val) {
              if (val != null) setState(() => _selectedProvince = val);
            },
          ),
        ],
      ),
    );
  }

  Widget _buildShippingMethodTile({
    required String title,
    String? badge,
    required String subtitle,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFFFFCF7),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: value ? const Color(0xFFEE4D2D) : const Color(0xFFE6D5C2)),
      ),
      child: Material(
        color: Colors.transparent,
        child: CheckboxListTile(
          activeColor: const Color(0xFFEE4D2D),
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          title: Row(
            children: [
              Text(title, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.bold, color: Color(0xFF49352D))),
              if (badge != null) ...[
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(color: Colors.green.shade100, borderRadius: BorderRadius.circular(6)),
                  child: Text(badge, style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.bold, color: Colors.green.shade800)),
                ),
              ],
            ],
          ),
          subtitle: Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(subtitle, style: const TextStyle(fontSize: 11.5, color: Color(0xFF8B7566))),
          ),
          value: value,
          onChanged: (v) => onChanged(v ?? false),
        ),
      ),
    );
  }

  // =========================================================================
  // BƯỚC 3: THÔNG TIN ĐỊNH DANH
  // =========================================================================
  Widget _buildStep3Identity() {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFFFFCF7),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE6D5C2)),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Loại hình kinh doanh *', style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.bold, color: Color(0xFF49352D))),
          const SizedBox(height: 10),

          Row(
            children: [
              _buildBusinessTypeButton('personal', 'Cá nhân'),
              const SizedBox(width: 8),
              _buildBusinessTypeButton('household', 'Hộ kinh doanh'),
              const SizedBox(width: 8),
              _buildBusinessTypeButton('enterprise', 'Doanh nghiệp'),
            ],
          ),
          const SizedBox(height: 16),

          TextField(
            controller: _ownerNameController,
            decoration: const InputDecoration(
              labelText: 'Họ và tên chủ sở hữu / Người đại diện *',
              hintText: 'Họ tên đúng trên CMND/CCCD...',
            ),
          ),
          const SizedBox(height: 12),

          TextField(
            controller: _idCardController,
            keyboardType: TextInputType.number,
            maxLength: 12,
            decoration: const InputDecoration(
              labelText: 'Số CMND / CCCD / Hộ chiếu (9–12 số) *',
              hintText: 'Ví dụ: 001201012345',
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBusinessTypeButton(String type, String label) {
    final isSelected = _businessType == type;
    return Expanded(
      child: InkWell(
        onTap: () => setState(() => _businessType = type),
        borderRadius: BorderRadius.circular(10),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: isSelected ? const Color(0xFFFFEFE7) : const Color(0xFFFFFCF7),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: isSelected ? const Color(0xFFEE4D2D) : const Color(0xFFE6D5C2)),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: isSelected ? const Color(0xFFEE4D2D) : const Color(0xFF8B7566),
            ),
          ),
        ),
      ),
    );
  }

  // =========================================================================
  // BƯỚC 4: THÔNG TIN THUẾ
  // =========================================================================
  Widget _buildStep4Tax() {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFFFFCF7),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE6D5C2)),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            decoration: BoxDecoration(
              color: const Color(0xFFFBF3E8),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE6D5C2)),
            ),
            padding: const EdgeInsets.all(12),
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Khai báo mã số thuế', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF49352D))),
                SizedBox(height: 4),
                Text(
                  'Theo quy định của Tổng cục Thuế đối với người bán hàng trên sàn TMĐT. Nếu bạn là cá nhân chưa có MST, có thể cập nhật sau.',
                  style: TextStyle(fontSize: 11.5, color: Color(0xFF8B7566)),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          TextField(
            controller: _taxCodeController,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(
              labelText: 'Mã số thuế cá nhân / hộ kinh doanh (tùy chọn)',
              hintText: 'Ví dụ: 8012345678',
            ),
          ),
          const SizedBox(height: 12),

          TextField(
            controller: _invoiceEmailController,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(
              labelText: 'Email nhận hóa đơn và thông báo thuế',
              hintText: 'email@example.com',
            ),
          ),
          const SizedBox(height: 14),

          Material(
            color: Colors.transparent,
            child: CheckboxListTile(
              activeColor: const Color(0xFFEE4D2D),
              contentPadding: EdgeInsets.zero,
              value: _agreeTerms,
              onChanged: (val) => setState(() => _agreeTerms = val ?? false),
              title: const Text(
                'Tôi cam kết mọi thông tin khai báo trên là chính xác, không vi phạm bản quyền thương hiệu và đồng ý tuân thủ Quy chế hoạt động sàn TMĐT NovaShop.',
                style: TextStyle(fontSize: 12, height: 1.35, color: Color(0xFF49352D)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // =========================================================================
  // BƯỚC 5: HOÀN TẤT & CHỜ DUYỆT
  // =========================================================================
  Widget _buildStep5Completed() {
    final shopName = _shopNameController.text.trim();

    return Center(
      child: Container(
        decoration: BoxDecoration(
          color: const Color(0xFFFFFCF7),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0xFFE6D5C2)),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: Colors.green.shade100,
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.check, size: 48, color: Colors.green.shade700),
            ),
            const SizedBox(height: 20),

            const Text(
              'Đăng ký mở gian hàng thành công!',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 19, fontWeight: FontWeight.bold, color: Color(0xFF49352D)),
            ),
            const SizedBox(height: 8),

            Text(
              'Hồ sơ gian hàng "$shopName" của bạn đã được khởi tạo và gửi lên Ban Quản Trị NovaShop.',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 13, color: Color(0xFF8B7566)),
            ),
            const SizedBox(height: 18),

            Container(
              decoration: BoxDecoration(
                color: Colors.amber.shade50,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.amber.shade200),
              ),
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.hourglass_bottom_rounded, color: Colors.amber.shade900, size: 16),
                      const SizedBox(width: 6),
                      Text('Trạng thái: Chờ phê duyệt (Pending)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12.5, color: Colors.amber.shade900)),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Ban Quản Trị sẽ xét duyệt hồ sơ trong thời gian sớm nhất. Bạn có thể truy cập trực tiếp Kênh Người Bán ngay trong ứng dụng để thiết lập gian hàng và đăng bán sản phẩm.',
                    style: TextStyle(fontSize: 11.5, color: Colors.amber.shade900),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            SizedBox(
              width: double.infinity,
              height: 46,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.pushReplacement(
                    context,
                    MaterialPageRoute(builder: (_) => const SellerHubScreen()),
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFEE4D2D),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text('Vào Kênh Người Bán Ngay', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // =========================================================================
  // THANH ĐIỀU HƯỚNG DƯỚI CÙNG
  // =========================================================================
  Widget _buildBottomNavigationBar() {
    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFFFFFCF7),
        border: Border(top: BorderSide(color: Color(0xFFE6D5C2))),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          OutlinedButton(
            onPressed: _submitting
                ? null
                : () {
                    if (_currentStep > 1) {
                      setState(() => _currentStep--);
                    } else {
                      setState(() => _currentStep = 0);
                    }
                  },
            style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
              side: const BorderSide(color: Color(0xFFE6D5C2)),
            ),
            child: Text(
              _currentStep > 1 ? 'Quay lại' : 'Hủy',
              style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF8B7566)),
            ),
          ),
          ElevatedButton(
            onPressed: _submitting ? null : _handleNextStep,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFEE4D2D),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 10),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: _submitting
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : Text(
                    _currentStep == 4 ? 'Hoàn tất & Gửi duyệt' : 'Tiếp theo',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
          ),
        ],
      ),
    );
  }
}
