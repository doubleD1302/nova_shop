import 'package:flutter/material.dart';
import '../../services/auth_service.dart';
import '../../theme/app_colors.dart';
import '../../widgets/common/nova_logo.dart';
import '../auth/login_screen.dart';

/// Danh sách 63 Tỉnh/Thành phố kèm Vùng miền chuẩn Website src/data/locations.js
const List<Map<String, String>> kVietnamProvincesWithRegion = [
  // ---------------- Miền Bắc ----------------
  {'name': 'Hà Nội', 'region': 'Miền Bắc'},
  {'name': 'Hải Phòng', 'region': 'Miền Bắc'},
  {'name': 'Quảng Ninh', 'region': 'Miền Bắc'},
  {'name': 'Hải Dương', 'region': 'Miền Bắc'},
  {'name': 'Hưng Yên', 'region': 'Miền Bắc'},
  {'name': 'Thái Bình', 'region': 'Miền Bắc'},
  {'name': 'Nam Định', 'region': 'Miền Bắc'},
  {'name': 'Ninh Bình', 'region': 'Miền Bắc'},
  {'name': 'Hà Nam', 'region': 'Miền Bắc'},
  {'name': 'Vĩnh Phúc', 'region': 'Miền Bắc'},
  {'name': 'Bắc Ninh', 'region': 'Miền Bắc'},
  {'name': 'Bắc Giang', 'region': 'Miền Bắc'},
  {'name': 'Thái Nguyên', 'region': 'Miền Bắc'},
  {'name': 'Phú Thọ', 'region': 'Miền Bắc'},
  {'name': 'Tuyên Quang', 'region': 'Miền Bắc'},
  {'name': 'Yên Bái', 'region': 'Miền Bắc'},
  {'name': 'Lào Cai', 'region': 'Miền Bắc'},
  {'name': 'Hà Giang', 'region': 'Miền Bắc'},
  {'name': 'Cao Bằng', 'region': 'Miền Bắc'},
  {'name': 'Bắc Kạn', 'region': 'Miền Bắc'},
  {'name': 'Lạng Sơn', 'region': 'Miền Bắc'},
  {'name': 'Điện Biên', 'region': 'Miền Bắc'},
  {'name': 'Lai Châu', 'region': 'Miền Bắc'},
  {'name': 'Sơn La', 'region': 'Miền Bắc'},
  {'name': 'Hòa Bình', 'region': 'Miền Bắc'},

  // ---------------- Miền Trung ----------------
  {'name': 'Thanh Hóa', 'region': 'Miền Trung'},
  {'name': 'Nghệ An', 'region': 'Miền Trung'},
  {'name': 'Hà Tĩnh', 'region': 'Miền Trung'},
  {'name': 'Quảng Bình', 'region': 'Miền Trung'},
  {'name': 'Quảng Trị', 'region': 'Miền Trung'},
  {'name': 'Thừa Thiên Huế', 'region': 'Miền Trung'},
  {'name': 'Đà Nẵng', 'region': 'Miền Trung'},
  {'name': 'Quảng Nam', 'region': 'Miền Trung'},
  {'name': 'Quảng Ngãi', 'region': 'Miền Trung'},
  {'name': 'Bình Định', 'region': 'Miền Trung'},
  {'name': 'Phú Yên', 'region': 'Miền Trung'},
  {'name': 'Khánh Hòa', 'region': 'Miền Trung'},
  {'name': 'Ninh Thuận', 'region': 'Miền Trung'},
  {'name': 'Bình Thuận', 'region': 'Miền Trung'},
  {'name': 'Kon Tum', 'region': 'Miền Trung'},
  {'name': 'Gia Lai', 'region': 'Miền Trung'},
  {'name': 'Đắk Lắk', 'region': 'Miền Trung'},
  {'name': 'Đắk Nông', 'region': 'Miền Trung'},
  {'name': 'Lâm Đồng', 'region': 'Miền Trung'},

  // ---------------- Miền Nam ----------------
  {'name': 'TP. Hồ Chí Minh', 'region': 'Miền Nam'},
  {'name': 'Bà Rịa - Vũng Tàu', 'region': 'Miền Nam'},
  {'name': 'Bình Dương', 'region': 'Miền Nam'},
  {'name': 'Bình Phước', 'region': 'Miền Nam'},
  {'name': 'Đồng Nai', 'region': 'Miền Nam'},
  {'name': 'Tây Ninh', 'region': 'Miền Nam'},
  {'name': 'Long An', 'region': 'Miền Nam'},
  {'name': 'Tiền Giang', 'region': 'Miền Nam'},
  {'name': 'Bến Tre', 'region': 'Miền Nam'},
  {'name': 'Trà Vinh', 'region': 'Miền Nam'},
  {'name': 'Vĩnh Long', 'region': 'Miền Nam'},
  {'name': 'Đồng Tháp', 'region': 'Miền Nam'},
  {'name': 'An Giang', 'region': 'Miền Nam'},
  {'name': 'Kiên Giang', 'region': 'Miền Nam'},
  {'name': 'Cần Thơ', 'region': 'Miền Nam'},
  {'name': 'Hậu Giang', 'region': 'Miền Nam'},
  {'name': 'Sóc Trăng', 'region': 'Miền Nam'},
  {'name': 'Bạc Liêu', 'region': 'Miền Nam'},
  {'name': 'Cà Mau', 'region': 'Miền Nam'},
];

final List<String> kVietnamProvinces =
    kVietnamProvincesWithRegion.map((e) => e['name']!).toList();

/// Màn hình Đăng Ký Kênh Người Bán ShopNova đồng bộ 100% với Website (SellerRegistrationWizard.jsx)
/// 1. Màn hình Chào mừng (Welcome) & Trạng thái hồ sơ hiện có (nếu đã nộp KYC)
/// 2. Stepper 5 bước: Thông tin Shop -> Cài đặt vận chuyển -> Thông tin định danh -> Thông tin thuế -> Hoàn tất
/// 3. Kết nối đầy đủ API Backend: POST /auth/register, POST /auth/seller-shop,
///    GET/PUT /seller/shop/registration, POST /seller/shop/resubmit
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
  bool _loadingExisting = false;
  String? _errorMessage;

  // Dữ liệu gian hàng & hồ sơ đã đăng ký trước đó (nếu user đã mở shop & đang chờ duyệt / bị từ chối)
  Map<String, dynamic>? _existingShop;
  String? _maskedIdLast4;

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
  String _pickupDetailDraft = '';
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
  bool _agreeTerms = false; // Mặc định false giống Website SellerRegistrationWizard.jsx

  bool get _hasExistingEditableRegistration =>
      _existingShop != null &&
      ['pending', 'rejected'].contains(_existingShop!['status']?.toString());

  bool get _hasActiveExistingShop =>
      _existingShop != null && _existingShop!['status']?.toString() == 'active';

  bool get _hasSuspendedExistingShop =>
      _existingShop != null && _existingShop!['status']?.toString() == 'suspended';

  bool get _isEmailLockedFromUser {
    final email = _authService.currentUser?.email;
    return email != null && email.trim().isNotEmpty;
  }

  @override
  void initState() {
    super.initState();
    _prefillFromUser();
    _loadExistingRegistration();
  }

  void _prefillFromUser() {
    final user = _authService.currentUser;
    if (user != null) {
      if (user.email != null && user.email!.isNotEmpty) {
        _emailController.text = user.email!;
        if (_invoiceEmailController.text.isEmpty) {
          _invoiceEmailController.text = user.email!;
        }
      }
      if (user.phone != null && user.phone!.isNotEmpty) {
        _phoneController.text = user.phone!.replaceFirst(RegExp(r'^\+84'), '');
      }
      _fullNameController.text = user.fullName;
      if (_ownerNameController.text.isEmpty) {
        _ownerNameController.text = user.fullName;
      }
    }
  }

  Future<void> _loadExistingRegistration() async {
    final user = _authService.currentUser;
    if (user == null || (!user.isSeller && (user.shopId == null || user.shopId!.isEmpty))) {
      return;
    }

    setState(() => _loadingExisting = true);
    final shop = await _authService.getSellerShop();
    final reg = await _authService.getSellerRegistration();
    if (!mounted) return;

    setState(() {
      _existingShop = shop;
      _loadingExisting = false;

      if (shop != null) {
        if ((shop['name']?.toString() ?? '').isNotEmpty) {
          _shopNameController.text = shop['name'].toString();
        }
        if ((shop['tagline']?.toString() ?? '').isNotEmpty) {
          _shopTaglineController.text = shop['tagline'].toString();
        }
        final prov = shop['province']?.toString() ?? '';
        if (kVietnamProvinces.contains(prov)) {
          _selectedProvince = prov;
        }
        if ((shop['address']?.toString() ?? '').isNotEmpty) {
          _pickupAddress = shop['address'].toString();
        }
      }

      if (reg != null) {
        final addr = reg['pickupAddress']?.toString() ?? '';
        if (addr.isNotEmpty) _pickupAddress = addr;

        final prov = reg['province']?.toString() ?? '';
        if (kVietnamProvinces.contains(prov)) _selectedProvince = prov;

        final contactEmail = reg['contactEmail']?.toString() ?? '';
        if (contactEmail.isNotEmpty && _emailController.text.isEmpty) {
          _emailController.text = contactEmail;
        }

        final contactPhone = reg['contactPhone']?.toString() ?? '';
        if (contactPhone.isNotEmpty) {
          _phoneController.text = contactPhone.replaceFirst(RegExp(r'^\+84'), '');
        }

        if (reg['shippingMethods'] is List) {
          final methods = (reg['shippingMethods'] as List).map((e) => e.toString()).toList();
          _shippingNhanh = methods.contains('nhanh');
          _shippingTietKiem = methods.contains('tietkiem');
          _shippingHoaToc = methods.contains('hoatoc');
        }

        final bType = reg['businessType']?.toString() ?? '';
        if (['personal', 'household', 'enterprise'].contains(bType)) {
          _businessType = bType;
        }

        final ownerName = reg['ownerName']?.toString() ?? '';
        if (ownerName.isNotEmpty) _ownerNameController.text = ownerName;

        _maskedIdLast4 = reg['identityLast4']?.toString();

        final tax = reg['taxCode']?.toString() ?? '';
        if (tax.isNotEmpty) _taxCodeController.text = tax;

        final invEmail = reg['invoiceEmail']?.toString() ?? '';
        if (invEmail.isNotEmpty) _invoiceEmailController.text = invEmail;
      }
    });
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

  // Modal Thiết lập Địa chỉ lấy hàng (đồng bộ modal của Website)
  void _showAddressModal() {
    String modalProvince = _selectedProvince;
    String initialDetail = _pickupDetailDraft;
    if (initialDetail.isEmpty && _pickupAddress.isNotEmpty) {
      final suffix = ', $_selectedProvince';
      initialDetail = _pickupAddress.endsWith(suffix)
          ? _pickupAddress.substring(0, _pickupAddress.length - suffix.length)
          : _pickupAddress;
    }
    final TextEditingController detailCtrl = TextEditingController(text: initialDetail);

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Dialog(
          backgroundColor: AppColors.surface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
            side: const BorderSide(color: AppColors.border),
          ),
          insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Expanded(
                      child: Text(
                        'Địa chỉ lấy hàng của Shop',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton(
                      icon: const Icon(Icons.close, size: 20, color: AppColors.textSecondary),
                      onPressed: () => Navigator.pop(ctx),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                    ),
                  ],
                ),
                const Divider(color: AppColors.border, height: 22),

                const Text('Tỉnh / Thành phố', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                const SizedBox(height: 6),
                DropdownButtonFormField<String>(
                  initialValue: kVietnamProvinces.contains(modalProvince) ? modalProvince : 'TP. Hồ Chí Minh',
                  isExpanded: true,
                  style: _wizardTextStyle(),
                  decoration: _wizardInputDecoration(),
                  items: kVietnamProvincesWithRegion
                      .map((p) => DropdownMenuItem(
                            value: p['name'],
                            child: Text(p['name']!, style: const TextStyle(fontSize: 13)),
                          ))
                      .toList(),
                  onChanged: (val) {
                    if (val != null) setModalState(() => modalProvince = val);
                  },
                ),
                const SizedBox(height: 14),

                const Text('Địa chỉ chi tiết (Số nhà, tên đường, phường/xã)', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: Color(0xFF49352D))),
                const SizedBox(height: 6),
                TextField(
                  controller: detailCtrl,
                  maxLines: 3,
                  style: _wizardTextStyle(),
                  decoration: _wizardInputDecoration(
                    hintText: 'Ví dụ: 123 Đường Nguyễn Huệ, Phường Bến Nghé, Quận 1...',
                  ),
                ),
                const Divider(color: AppColors.border, height: 24),

                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    OutlinedButton(
                      onPressed: () => Navigator.pop(ctx),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.textSecondary,
                        side: const BorderSide(color: AppColors.border),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      child: const Text('Hủy', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12.5)),
                    ),
                    const SizedBox(width: 10),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFEE4D2D),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      onPressed: () {
                        final detail = detailCtrl.text.trim();
                        if (detail.isEmpty) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Vui lòng nhập địa chỉ chi tiết (số nhà, tên đường, phường/xã).'),
                              backgroundColor: Colors.red,
                            ),
                          );
                          return;
                        }
                        setState(() {
                          _pickupDetailDraft = detail;
                          _selectedProvince = modalProvince;
                          _pickupAddress = '$detail, $modalProvince';
                          _errorMessage = null;
                        });
                        Navigator.pop(ctx);
                      },
                      child: const Text('Lưu địa chỉ', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12.5)),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _formatPhoneForApi(String rawInput) {
    final trimmed = rawInput.trim().replaceFirst(RegExp(r'^\+84'), '').trim();
    if (trimmed.isEmpty) return '';
    if (trimmed.startsWith('0')) return trimmed;
    return '0$trimmed';
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
        setState(() => _errorMessage = 'Vui lòng bấm "+ Thêm" để thiết lập địa chỉ lấy hàng của Shop.');
        return;
      }
      final email = _emailController.text.trim();
      if (email.isEmpty || !_isValidEmail(email)) {
        setState(() => _errorMessage = 'Vui lòng nhập email hợp lệ để nhận thông báo đơn hàng.');
        return;
      }
      final formattedPhone = _formatPhoneForApi(_phoneController.text);
      if (formattedPhone.isEmpty || !RegExp(r'^[+()\d .-]{8,20}$').hasMatch(formattedPhone)) {
        setState(() => _errorMessage = 'Vui lòng nhập số điện thoại hợp lệ.');
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
        if (password.length > 72) {
          setState(() => _errorMessage = 'Mật khẩu tối đa 72 ký tự.');
          return;
        }
        if (password != confirm) {
          setState(() => _errorMessage = 'Mật khẩu nhập lại không khớp.');
          return;
        }
        if (_ownerNameController.text.trim().isEmpty) {
          _ownerNameController.text = fullName;
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
      if (idCard.isEmpty) {
        setState(() => _errorMessage = 'Vui lòng nhập số CMND / CCCD / Hộ chiếu của chủ Shop.');
        return;
      }
      if (!RegExp(r'^\d{9,12}$').hasMatch(idCard)) {
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

      final formattedPhone = _formatPhoneForApi(_phoneController.text);

      // Cấu trúc sellerProfile đồng bộ 100% với SellerRegistrationWizard.jsx & prepareSellerProfile() ở backend
      final sellerProfile = {
        'pickupAddress': _pickupAddress,
        'province': _selectedProvince,
        'contactEmail': _emailController.text.trim().toLowerCase(),
        'contactPhone': formattedPhone,
        'shippingMethods': shippingMethods,
        'businessType': _businessType,
        'ownerName': _ownerNameController.text.trim(),
        'idCard': _idCardController.text.trim(),
        'taxCode': taxCode,
        'invoiceEmail': invoiceEmail.toLowerCase(),
        'agreeTerms': _agreeTerms,
      };

      setState(() {
        _submitting = true;
        _errorMessage = null;
      });

      final user = _authService.currentUser;
      final shopName = _shopNameController.text.trim();
      final shopTagline = _shopTaglineController.text.trim();

      bool success = false;
      String? apiError;

      if (_hasExistingEditableRegistration) {
        // Cập nhật hồ sơ đăng ký hiện có qua PUT /api/v1/seller/shop/registration
        final updateRes = await _authService.updateSellerRegistration(sellerProfile);
        if (updateRes.success) {
          if (_existingShop?['status']?.toString() == 'rejected') {
            final resubmitRes = await _authService.resubmitSellerShop();
            success = resubmitRes.success;
            if (!success) {
              apiError = resubmitRes.message;
            }
          } else {
            success = true;
          }
        } else {
          apiError = updateRes.message;
        }
      } else if (user != null) {
        // User đã đăng nhập: gọi POST /api/v1/auth/seller-shop
        success = await _authService.registerSellerShop(
          shopName: shopName,
          province: _selectedProvince,
          tagline: shopTagline.isNotEmpty ? shopTagline : null,
          sellerProfile: sellerProfile,
        );
        if (!success) apiError = _authService.lastError;
      } else {
        // Khách mới: tạo tài khoản + shop qua POST /api/v1/auth/register (role: seller)
        final fullName = _fullNameController.text.trim().isNotEmpty
            ? _fullNameController.text.trim()
            : _ownerNameController.text.trim();
        success = await _authService.register(
          username: _usernameController.text.trim().toLowerCase(),
          password: _passwordController.text,
          fullName: fullName,
          email: _emailController.text.trim().toLowerCase(),
          phone: formattedPhone,
          role: 'seller',
          shopName: shopName,
          shopTagline: shopTagline.isNotEmpty ? shopTagline : null,
          sellerProfile: sellerProfile,
        );
        if (!success) apiError = _authService.lastError;
      }

      if (!mounted) return;
      setState(() => _submitting = false);

      if (success) {
        await _authService.getSellerShop();
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Đăng ký mở gian hàng thành công! Hồ sơ đang chờ Ban Quản Trị duyệt.'),
            backgroundColor: Color(0xFF00BFA5),
          ),
        );
        setState(() => _currentStep = 5);
      } else {
        setState(() {
          _errorMessage = (apiError != null && apiError.isNotEmpty)
              ? apiError
              : 'Có lỗi xảy ra khi tạo gian hàng. Vui lòng thử lại.';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loadingExisting) {
      return const Scaffold(
        backgroundColor: Color(0xFFFBF3E8),
        body: Center(child: CircularProgressIndicator(color: Color(0xFFEE4D2D))),
      );
    }

    if (_hasActiveExistingShop || _hasSuspendedExistingShop) {
      return _buildExistingShopStatusScreen();
    }

    if (_currentStep == 0) {
      return _buildWelcomeScreen();
    }

    return Scaffold(
      backgroundColor: const Color(0xFFFBF3E8),
      appBar: AppBar(
        toolbarHeight: 48,
        title: const Text('Đăng Ký Kênh Người Bán', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15.5, color: Color(0xFF49352D))),
        backgroundColor: const Color(0xFFFFFCF7),
        elevation: 0,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: const Color(0xFFE6D5C2), height: 1),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF49352D)),
          onPressed: () {
            if (_currentStep > 1 && _currentStep < 5) {
              setState(() => _currentStep--);
            } else if (_currentStep == 1) {
              setState(() => _currentStep = 0);
            } else {
              Navigator.pop(context);
            }
          },
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Stepper Header 5 bước kèm đường nối tiến trình
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

                    if (_hasExistingEditableRegistration && _currentStep < 5) ...[
                      _buildExistingRegistrationNoticeBanner(),
                      const SizedBox(height: 14),
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

  /// Hiển thị khi gian hàng đã hoạt động (active) hoặc tạm khóa (suspended) -> điều hướng qua app ShopNova Seller
  Widget _buildExistingShopStatusScreen() {
    final isSuspended = _hasSuspendedExistingShop;
    final shopName = _existingShop?['name']?.toString() ?? 'Gian hàng của bạn';
    final reason = _existingShop?['suspensionReason']?.toString() ?? 'Vi phạm chính sách sàn.';

    return Scaffold(
      backgroundColor: const Color(0xFFFBF3E8),
      appBar: AppBar(
        backgroundColor: const Color(0xFFFFFCF7),
        elevation: 0,
        title: const NovaLogo(size: 30, fontSize: 17, subtitle: 'Kênh Người Bán'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Container(
            constraints: const BoxConstraints(maxWidth: 460),
            padding: const EdgeInsets.all(28),
            decoration: BoxDecoration(
              color: const Color(0xFFFFFCF7),
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: const Color(0xFFE6D5C2)),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 84,
                  height: 84,
                  decoration: BoxDecoration(
                    color: isSuspended ? Colors.red.shade50 : const Color(0xFFEDF4ED),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    isSuspended ? Icons.block_rounded : Icons.storefront_rounded,
                    size: 44,
                    color: isSuspended ? Colors.red : const Color(0xFF547653),
                  ),
                ),
                const SizedBox(height: 18),
                Text(
                  isSuspended ? 'Gian hàng đang tạm khóa' : 'Gian hàng đã được kích hoạt!',
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 19, fontWeight: FontWeight.bold, color: Color(0xFF49352D)),
                ),
                const SizedBox(height: 8),
                Text(
                  isSuspended
                      ? 'Gian hàng "$shopName" hiện đang tạm khóa.\nLý do: $reason'
                      : 'Tài khoản của bạn đã sở hữu gian hàng "$shopName" trên sàn NovaShop.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 13.5, color: Color(0xFF8B7566), height: 1.45),
                ),
                const SizedBox(height: 18),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE0F2F1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.phone_android_rounded, color: Color(0xFF00796B), size: 22),
                      SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Để đăng bán sản phẩm, xử lý đơn hàng và rút doanh thu, vui lòng mở ứng dụng riêng biệt ShopNova Seller.',
                          style: TextStyle(fontSize: 12, color: Color(0xFF004D40), height: 1.4, fontWeight: FontWeight.w500),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 22),
                SizedBox(
                  width: double.infinity,
                  height: 46,
                  child: ElevatedButton(
                    onPressed: () => Navigator.pop(context),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFEE4D2D),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: const Text('Quay lại Trang Cá Nhân', style: TextStyle(fontWeight: FontWeight.bold)),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildExistingRegistrationNoticeBanner() {
    final isRejected = _existingShop?['status']?.toString() == 'rejected';
    final version = _existingShop?['approvalVersion'] ?? 1;
    final reason = _existingShop?['rejectionReason']?.toString() ?? 'Vui lòng rà soát lại thông tin và CCCD.';

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isRejected ? Colors.red.shade50 : Colors.amber.shade50,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: isRejected ? Colors.red.shade200 : Colors.amber.shade300),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                isRejected ? Icons.cancel_outlined : Icons.hourglass_bottom_rounded,
                size: 18,
                color: isRejected ? Colors.red.shade800 : Colors.amber.shade900,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  isRejected
                      ? 'Hồ sơ bị từ chối kiểm duyệt (v$version)'
                      : 'Hồ sơ đăng ký đang chờ phê duyệt (v$version)',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 13,
                    color: isRejected ? Colors.red.shade900 : Colors.amber.shade900,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            isRejected
                ? 'Lý do: $reason\nBạn có thể chỉnh sửa lại hồ sơ bên dưới và gửi xét duyệt lại.'
                : 'Hồ sơ đã đồng bộ từ máy chủ. Bạn có thể cập nhật chỉnh sửa trong lúc chờ duyệt.',
            style: TextStyle(
              fontSize: 11.5,
              color: isRejected ? Colors.red.shade800 : Colors.amber.shade900,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }

  // =========================================================================
  // GIAO DIỆN 0: MÀN HÌNH CHÀO MỪNG (ĐỒNG BỘ 100% WEBSITE WELCOME)
  // =========================================================================
  Widget _buildWelcomeScreen() {
    final user = _authService.currentUser;

    return Scaffold(
      backgroundColor: const Color(0xFFFBF3E8),
      appBar: AppBar(
        backgroundColor: const Color(0xFFFFFCF7),
        elevation: 0,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: const Color(0xFFE6D5C2), height: 1),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF49352D)),
          onPressed: () => Navigator.pop(context),
        ),
        title: const NovaLogo(size: 30, fontSize: 17, subtitle: 'Kênh Người Bán'),
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
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 34),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (_hasExistingEditableRegistration) ...[
                    _buildExistingRegistrationNoticeBanner(),
                    const SizedBox(height: 20),
                  ],

                  CustomPaint(
                    painter: _DashedRRectPainter(
                      color: const Color(0xFFBD6E49).withValues(alpha: 0.3),
                      radius: 68,
                      dashWidth: 5,
                      dashSpace: 4,
                      strokeWidth: 1.5,
                    ),
                    child: Container(
                      width: 136,
                      height: 136,
                      decoration: const BoxDecoration(
                        color: Color(0xFFFFEFE7),
                        shape: BoxShape.circle,
                      ),
                      child: Center(
                        child: CustomPaint(
                          size: const Size(76, 76),
                          painter: _NovaWelcomeIllustrationPainter(),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),

                  const Text(
                    'Chào mừng đến với Kênh Người Bán NovaShop!',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 21, fontWeight: FontWeight.bold, color: Color(0xFF49352D), height: 1.3),
                  ),
                  const SizedBox(height: 12),

                  const Text(
                    'Vui lòng cung cấp thông tin để thành lập tài khoản người bán trên NovaShop',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 13.5, color: Color(0xFF8B7566), height: 1.4),
                  ),
                  const SizedBox(height: 28),

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
                      child: Text(
                        _hasExistingEditableRegistration ? 'Cập nhật hồ sơ đăng ký' : 'Bắt đầu đăng ký',
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),

                  if (user == null) ...[
                    const SizedBox(height: 14),
                    Wrap(
                      alignment: WrapAlignment.center,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        const Text('Đã có tài khoản người bán? ', style: TextStyle(fontSize: 13, color: Color(0xFF8B7566))),
                        GestureDetector(
                          onTap: () async {
                            await Navigator.push(context, MaterialPageRoute(builder: (_) => const LoginScreen()));
                            if (mounted) {
                              _prefillFromUser();
                              _loadExistingRegistration();
                            }
                          },
                          child: const Text(
                            'Đăng nhập ngay',
                            style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFFBD6E49)),
                          ),
                        ),
                      ],
                    ),
                  ],

                  const SizedBox(height: 12),
                  TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('← Quay lại trang chủ mua sắm', style: TextStyle(fontSize: 12.5, color: Color(0xFF8B7566))),
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
  // THANH STEPPER TRÊN ĐẦU (CÓ ĐƯỜNG TIẾN TRÌNH GIỐNG WEBSITE)
  // =========================================================================
  Widget _buildStepperHeader() {
    final steps = [
      {'id': 1, 'title': 'Thông tin Shop'},
      {'id': 2, 'title': 'Cài đặt vận chuyển'},
      {'id': 3, 'title': 'Thông tin định danh'},
      {'id': 4, 'title': 'Thông tin thuế'},
      {'id': 5, 'title': 'Hoàn tất'},
    ];

    final progressRatio = ((_currentStep.clamp(1, 5) - 1) / (steps.length - 1)).clamp(0.0, 1.0);

    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFFFFFCF7),
        border: Border(bottom: BorderSide(color: Color(0xFFE6D5C2))),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final trackMargin = constraints.maxWidth / (steps.length * 2);
          return Stack(
            alignment: Alignment.topCenter,
            children: [
              // Đường nền xám kem nối giữa các nút
              Positioned(
                top: 10,
                left: trackMargin,
                right: trackMargin,
                child: Container(height: 2, color: const Color(0xFFE6D5C2)),
              ),
              // Đường tiến trình cam #EE4D2D
              Positioned(
                top: 10,
                left: trackMargin,
                right: trackMargin,
                child: FractionallySizedBox(
                  alignment: Alignment.centerLeft,
                  widthFactor: progressRatio,
                  child: Container(height: 2, color: const Color(0xFFEE4D2D)),
                ),
              ),
              Row(
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
                    badgeContent = Text('$id', style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: Colors.white));
                  } else {
                    badgeColor = const Color(0xFFE6D5C2);
                    badgeContent = Text('$id', style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: Color(0xFF8B7566)));
                  }

                  return Expanded(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 22,
                          height: 22,
                          decoration: BoxDecoration(
                            color: badgeColor,
                            shape: BoxShape.circle,
                            boxShadow: isCurrent
                                ? [BoxShadow(color: const Color(0xFFEE4D2D).withValues(alpha: 0.25), blurRadius: 5, spreadRadius: 1)]
                                : null,
                          ),
                          child: Center(child: badgeContent),
                        ),
                        const SizedBox(height: 5),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 2),
                          child: Text(
                            st['title'] as String,
                            textAlign: TextAlign.center,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 9.8,
                              height: 1.2,
                              fontWeight: isCurrent ? FontWeight.bold : FontWeight.w500,
                              color: isCurrent ? const Color(0xFFEE4D2D) : (isCompleted ? const Color(0xFF49352D) : const Color(0xFF8B7566)),
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                }).toList(),
              ),
            ],
          );
        },
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
  Widget _buildFieldLabel(String label, {bool required = false, bool trailingRequired = false, double fontSize = 13}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text.rich(
        TextSpan(
          style: TextStyle(fontSize: fontSize, fontWeight: FontWeight.w600, color: const Color(0xFF49352D)),
          children: [
            if (required)
              const TextSpan(
                text: '* ',
                style: TextStyle(color: Color(0xFFF43F5E), fontWeight: FontWeight.bold),
              ),
            TextSpan(text: label),
            if (trailingRequired)
              const TextSpan(
                text: ' *',
                style: TextStyle(color: Color(0xFFF43F5E), fontWeight: FontWeight.bold),
              ),
          ],
        ),
      ),
    );
  }

  TextStyle _wizardTextStyle({bool disabled = false}) {
    return TextStyle(
      fontSize: 13,
      fontWeight: FontWeight.w500,
      color: disabled ? const Color(0xFF6B7280) : const Color(0xFF49352D),
    );
  }

  InputDecoration _wizardInputDecoration({
    String? hintText,
    bool disabled = false,
    Widget? suffixIcon,
    String? counterText,
  }) {
    const borderSide = BorderSide(color: Color(0xFFE6D5C2), width: 1);
    const focusedSide = BorderSide(color: Color(0xFFEE4D2D), width: 1.5);
    return InputDecoration(
      hintText: hintText,
      hintStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w400, color: Color(0xFF8B7566)),
      counterText: counterText,
      isDense: true,
      filled: true,
      fillColor: disabled ? const Color(0xFFF3F4F6) : const Color(0xFFFFFCF7),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: borderSide),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: borderSide),
      disabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: borderSide),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: focusedSide),
      suffixIcon: suffixIcon,
      suffixIconConstraints: const BoxConstraints(minWidth: 0, minHeight: 0),
    );
  }

  Widget _buildStep1ShopInfo() {
    final user = _authService.currentUser;
    final emailLocked = _isEmailLockedFromUser;
    final shopLocked = _hasExistingEditableRegistration;

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
          _buildFieldLabel('Tên Shop', required: true),
          TextField(
            controller: _shopNameController,
            maxLength: 30,
            enabled: !shopLocked,
            style: _wizardTextStyle(disabled: shopLocked),
            onChanged: (_) => setState(() {}),
            decoration: _wizardInputDecoration(
              hintText: 'Nhập tên Shop của bạn...',
              disabled: shopLocked,
              counterText: '',
              suffixIcon: Padding(
                padding: const EdgeInsets.only(right: 12),
                child: Text(
                  '${_shopNameController.text.length}/30',
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w400, color: Color(0xFF8B7566)),
                ),
              ),
            ),
          ),
          const SizedBox(height: 14),

          _buildFieldLabel('Slogan gian hàng'),
          TextField(
            controller: _shopTaglineController,
            maxLength: 100,
            enabled: !shopLocked,
            style: _wizardTextStyle(disabled: shopLocked),
            decoration: _wizardInputDecoration(
              hintText: 'Ví dụ: Thời trang thiết kế chính hãng, Giao hàng siêu tốc...',
              disabled: shopLocked,
              counterText: '',
            ),
          ),
          const SizedBox(height: 14),

          _buildFieldLabel('Địa chỉ lấy hàng', required: true),
          if (_pickupAddress.isNotEmpty)
            Container(
              decoration: BoxDecoration(
                color: const Color(0xFFFBF3E8),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE6D5C2)),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: Row(
                children: [
                  Expanded(
                    child: Text(_pickupAddress, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: Color(0xFF49352D))),
                  ),
                  TextButton(
                    onPressed: _showAddressModal,
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    child: const Text('Thay đổi', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFFEE4D2D))),
                  ),
                ],
              ),
            )
          else
            InkWell(
              onTap: _showAddressModal,
              borderRadius: BorderRadius.circular(12),
              child: CustomPaint(
                painter: _DashedRRectPainter(
                  color: const Color(0xFFEE4D2D),
                  radius: 12,
                  dashWidth: 5,
                  dashSpace: 4,
                ),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFEFE7),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('+', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFFEE4D2D))),
                      SizedBox(width: 6),
                      Text('Thêm địa chỉ', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFFEE4D2D))),
                    ],
                  ),
                ),
              ),
            ),
          const SizedBox(height: 14),

          _buildFieldLabel('Email', required: true),
          TextField(
            controller: _emailController,
            keyboardType: TextInputType.emailAddress,
            enabled: !emailLocked,
            style: _wizardTextStyle(disabled: emailLocked),
            decoration: _wizardInputDecoration(
              hintText: 'email@example.com',
              disabled: emailLocked,
            ),
          ),
          const SizedBox(height: 14),

          _buildFieldLabel('Số điện thoại', required: true),
          Container(
            height: 44,
            decoration: BoxDecoration(
              color: const Color(0xFFFFFCF7),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE6D5C2)),
            ),
            clipBehavior: Clip.antiAlias,
            child: Row(
              children: [
                Container(
                  height: double.infinity,
                  padding: const EdgeInsets.symmetric(horizontal: 13),
                  alignment: Alignment.center,
                  decoration: const BoxDecoration(
                    color: Color(0xFFFBF3E8),
                    border: Border(right: BorderSide(color: Color(0xFFE6D5C2))),
                  ),
                  child: const Text('+84', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF49352D))),
                ),
                Expanded(
                  child: TextField(
                    controller: _phoneController,
                    keyboardType: TextInputType.phone,
                    style: _wizardTextStyle(),
                    decoration: const InputDecoration(
                      hintText: 'Nhập số điện thoại...',
                      hintStyle: TextStyle(fontSize: 13, fontWeight: FontWeight.w400, color: Color(0xFF8B7566)),
                      isDense: true,
                      border: InputBorder.none,
                      enabledBorder: InputBorder.none,
                      focusedBorder: InputBorder.none,
                      contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 11),
                    ),
                  ),
                ),
              ],
            ),
          ),

          if (user == null) ...[
            const SizedBox(height: 18),
            CustomPaint(
              painter: _DashedRRectPainter(
                color: const Color(0xFFEE4D2D),
                radius: 16,
                dashWidth: 6,
                dashSpace: 4,
              ),
              child: Container(
                decoration: BoxDecoration(
                  color: const Color(0xFFFFEFE7).withValues(alpha: 0.6),
                  borderRadius: BorderRadius.circular(16),
                ),
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.storefront_outlined, color: Color(0xFFEE4D2D), size: 18),
                        SizedBox(width: 8),
                        Expanded(
                          child: Text('Thiết lập tài khoản người bán', style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.bold, color: Color(0xFF49352D))),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),

                    _buildFieldLabel('Họ và tên chủ sở hữu', trailingRequired: true, fontSize: 12),
                    TextField(
                      controller: _fullNameController,
                      style: _wizardTextStyle(),
                      decoration: _wizardInputDecoration(hintText: 'Nguyễn Văn A'),
                    ),
                    const SizedBox(height: 10),

                    _buildFieldLabel('Tên đăng nhập', trailingRequired: true, fontSize: 12),
                    TextField(
                      controller: _usernameController,
                      style: _wizardTextStyle(),
                      decoration: _wizardInputDecoration(hintText: 'seller_username'),
                    ),
                    const SizedBox(height: 10),

                    _buildFieldLabel('Mật khẩu', trailingRequired: true, fontSize: 12),
                    TextField(
                      controller: _passwordController,
                      obscureText: !_showPassword,
                      style: _wizardTextStyle(),
                      decoration: _wizardInputDecoration(
                        hintText: 'Tối thiểu 8 ký tự',
                        suffixIcon: IconButton(
                          padding: const EdgeInsets.symmetric(horizontal: 10),
                          constraints: const BoxConstraints(),
                          icon: Icon(_showPassword ? Icons.visibility_off : Icons.visibility, size: 18, color: const Color(0xFF8B7566)),
                          onPressed: () => setState(() => _showPassword = !_showPassword),
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),

                    _buildFieldLabel('Nhập lại mật khẩu', trailingRequired: true, fontSize: 12),
                    TextField(
                      controller: _confirmPasswordController,
                      obscureText: !_showConfirmPassword,
                      style: _wizardTextStyle(),
                      decoration: _wizardInputDecoration(
                        hintText: 'Khớp với mật khẩu trên',
                        suffixIcon: IconButton(
                          padding: const EdgeInsets.symmetric(horizontal: 10),
                          constraints: const BoxConstraints(),
                          icon: Icon(_showConfirmPassword ? Icons.visibility_off : Icons.visibility, size: 18, color: const Color(0xFF8B7566)),
                          onPressed: () => setState(() => _showConfirmPassword = !_showConfirmPassword),
                        ),
                      ),
                    ),
                  ],
                ),
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
                    Expanded(
                      child: Text('Cài đặt phương thức vận chuyển cho Shop', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF49352D))),
                    ),
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
            subtitle: 'Ahamove, GrabExpress. Giao siêu tốc trong 1–2 giờ (áp dụng nội thành cùng tỉnh/thành phố).',
            value: _shippingHoaToc,
            onChanged: (val) => setState(() => _shippingHoaToc = val),
          ),
          const SizedBox(height: 16),

          const Text('Tỉnh / Thành phố kho gửi hàng:', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF49352D))),
          const SizedBox(height: 6),
          DropdownButtonFormField<String>(
            initialValue: kVietnamProvinces.contains(_selectedProvince) ? _selectedProvince : 'TP. Hồ Chí Minh',
            isExpanded: true,
            style: _wizardTextStyle(),
            decoration: _wizardInputDecoration(),
            items: kVietnamProvincesWithRegion
                .map((p) => DropdownMenuItem(
                      value: p['name'],
                      child: Text('${p['name']} (${p['region']})', style: const TextStyle(fontSize: 13)),
                    ))
                .toList(),
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
          controlAffinity: ListTileControlAffinity.trailing,
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          title: Row(
            children: [
              Flexible(
                child: Text(title, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.bold, color: Color(0xFF49352D))),
              ),
              if (badge != null) ...[
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(color: const Color(0xFFD1FAE5), borderRadius: BorderRadius.circular(20)),
                  child: Text(badge, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF065F46))),
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
          const Text('Loại hình kinh doanh:', style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.bold, color: Color(0xFF49352D))),
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

          _buildFieldLabel('Họ và tên chủ sở hữu / Người đại diện', required: true),
          TextField(
            controller: _ownerNameController,
            style: _wizardTextStyle(),
            decoration: _wizardInputDecoration(
              hintText: 'Họ và tên trên giấy tờ...',
            ),
          ),
          const SizedBox(height: 14),

          _buildFieldLabel('Số CMND / CCCD / Hộ chiếu (9 - 12 chữ số)', required: true),
          TextField(
            controller: _idCardController,
            keyboardType: TextInputType.number,
            maxLength: 12,
            style: _wizardTextStyle(),
            decoration: _wizardInputDecoration(
              counterText: '',
              hintText: _maskedIdLast4 != null && _maskedIdLast4!.isNotEmpty
                  ? 'Đã lưu ******$_maskedIdLast4 (nhập lại đầy đủ 9–12 số)'
                  : 'Ví dụ: 001201012345',
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

          _buildFieldLabel('Mã số thuế cá nhân / hộ kinh doanh (tùy chọn)'),
          TextField(
            controller: _taxCodeController,
            keyboardType: TextInputType.number,
            style: _wizardTextStyle(),
            decoration: _wizardInputDecoration(
              hintText: 'Ví dụ: 8012345678',
            ),
          ),
          const SizedBox(height: 14),

          _buildFieldLabel('Email nhận hóa đơn và thông báo thuế'),
          TextField(
            controller: _invoiceEmailController,
            keyboardType: TextInputType.emailAddress,
            style: _wizardTextStyle(),
            decoration: _wizardInputDecoration(
              hintText: 'email@example.com',
            ),
          ),
          const SizedBox(height: 14),

          Material(
            color: Colors.transparent,
            child: CheckboxListTile(
              activeColor: const Color(0xFFEE4D2D),
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
              value: _agreeTerms,
              onChanged: (val) => setState(() => _agreeTerms = val ?? false),
              title: const Text.rich(
                TextSpan(
                  style: TextStyle(fontSize: 12, height: 1.4, color: Color(0xFF49352D)),
                  children: [
                    TextSpan(text: 'Tôi cam kết mọi thông tin khai báo trên là chính xác, không vi phạm bản quyền thương hiệu và đồng ý tuân thủ '),
                    TextSpan(
                      text: 'Quy chế hoạt động sàn TMĐT NovaShop',
                      style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFFEE4D2D)),
                    ),
                    TextSpan(text: '.'),
                  ],
                ),
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
              decoration: const BoxDecoration(
                color: Color(0xFFD1FAE5),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.check, size: 44, color: Color(0xFF059669)),
            ),
            const SizedBox(height: 20),

            Text(
              _hasExistingEditableRegistration
                  ? 'Cập nhật hồ sơ gian hàng thành công!'
                  : 'Đăng ký mở gian hàng thành công!',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 19, fontWeight: FontWeight.bold, color: Color(0xFF49352D)),
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
                    'Ban Quản Trị sẽ xét duyệt hồ sơ trong thời gian sớm nhất. Bạn đã có thể mở ứng dụng ShopNova Seller để đăng bán và quản lý gian hàng.',
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
                  Navigator.pop(context, true);
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFEE4D2D),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text('Hoàn Tất & Về Trang Cá Nhân', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
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
        color: Color(0xFFFBF3E8),
        border: Border(top: BorderSide(color: Color(0xFFE6D5C2))),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Flexible(
            child: OutlinedButton(
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
                backgroundColor: const Color(0xFFFFFCF7),
                minimumSize: const Size(0, 44),
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                side: const BorderSide(color: Color(0xFFE6D5C2)),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: Text(
                _currentStep > 1 ? 'Quay lại' : 'Hủy',
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  color: _currentStep > 1 ? const Color(0xFF49352D) : const Color(0xFF8B7566),
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Flexible(
            child: ElevatedButton(
              onPressed: _submitting ? null : _handleNextStep,
              style: ElevatedButton.styleFrom(
                minimumSize: const Size(0, 44),
                backgroundColor: const Color(0xFFEE4D2D),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _submitting
                  ? const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        SizedBox(width: 15, height: 15, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)),
                        SizedBox(width: 8),
                        Flexible(
                          child: Text(
                            'Đang gửi hồ sơ...',
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                          ),
                        ),
                      ],
                    )
                  : Text(
                      _currentStep == 4
                          ? (_hasExistingEditableRegistration ? 'Lưu & Gửi duyệt lại' : 'Hoàn tất & Gửi duyệt')
                          : 'Tiếp theo',
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Vẽ viền nét đứt giống nút "+ Thêm địa chỉ" và khối tạo tài khoản trên Website
class _DashedRRectPainter extends CustomPainter {
  final Color color;
  final double radius;
  final double dashWidth;
  final double dashSpace;
  final double strokeWidth;

  _DashedRRectPainter({
    required this.color,
    required this.radius,
    this.dashWidth = 5,
    this.dashSpace = 4,
    this.strokeWidth = 1.2,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = strokeWidth
      ..style = PaintingStyle.stroke;

    final rrect = RRect.fromRectAndRadius(
      Rect.fromLTWH(0, 0, size.width, size.height),
      Radius.circular(radius),
    );
    final path = Path()..addRRect(rrect);

    for (final metric in path.computeMetrics()) {
      double distance = 0;
      while (distance < metric.length) {
        final next = (distance + dashWidth).clamp(0.0, metric.length);
        canvas.drawPath(metric.extractPath(distance, next), paint);
        distance += dashWidth + dashSpace;
      }
    }
  }

  @override
  bool shouldRepaint(covariant _DashedRRectPainter oldDelegate) {
    return oldDelegate.color != color ||
        oldDelegate.radius != radius ||
        oldDelegate.strokeWidth != strokeWidth;
  }
}

/// Vẽ vector SVG Cửa hàng & Hồ sơ đăng ký khớp 100% với SellerRegistrationWizard.jsx
class _NovaWelcomeIllustrationPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final sx = size.width / 64.0;
    final sy = size.height / 64.0;
    canvas.save();
    canvas.scale(sx, sy);

    final creamFill = Paint()..color = const Color(0xFFFFFCF7);
    final peachFill = Paint()..color = const Color(0xFFFFEFE7);
    final primaryFill = Paint()..color = const Color(0xFFBD6E49);
    final darkFill = Paint()..color = const Color(0xFFA95532);

    // Card nền x=12 y=18 w=40 h=32 rx=4
    final cardRRect = RRect.fromRectAndRadius(const Rect.fromLTWH(12, 18, 40, 32), const Radius.circular(4));
    canvas.drawRRect(cardRRect, creamFill);
    canvas.drawRRect(
      cardRRect,
      Paint()
        ..color = const Color(0xFFBD6E49)
        ..strokeWidth = 2.5
        ..style = PaintingStyle.stroke,
    );

    // Đường kẻ nét đứt ngang y=28 (x=12..52)
    final dashPaint = Paint()
      ..color = const Color(0xFFBD6E49)
      ..strokeWidth = 2;
    for (double x = 12; x < 52; x += 4) {
      canvas.drawLine(Offset(x, 28), Offset((x + 2).clamp(12, 52), 28), dashPaint);
    }

    // Các dòng chữ hồ sơ
    final linePaint = Paint()
      ..color = const Color(0xFFBD6E49)
      ..strokeWidth = 2.5
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(const Offset(20, 36), const Offset(36, 36), linePaint);
    canvas.drawLine(const Offset(20, 42), const Offset(28, 42), linePaint);

    // Con dấu tròn cx=44 cy=39 r=4
    canvas.drawCircle(const Offset(44, 39), 4, peachFill);
    canvas.drawCircle(
      const Offset(44, 39),
      4,
      Paint()
        ..color = const Color(0xFFBD6E49)
        ..strokeWidth = 2
        ..style = PaintingStyle.stroke,
    );

    // Mái vòm shop phía trên M8 18 L14 8 H50 L56 18 Z
    final roofPath = Path()
      ..moveTo(8, 18)
      ..lineTo(14, 8)
      ..lineTo(50, 8)
      ..lineTo(56, 18)
      ..close();
    canvas.drawPath(roofPath, primaryFill);

    // 6 vòm kẻ sọc xen kẽ #A95532 và #BD6E49 từ x=8..56
    for (int i = 0; i < 6; i++) {
      final left = 8.0 + i * 8.0;
      final scallop = Path()
        ..moveTo(left, 18)
        ..arcToPoint(Offset(left + 8, 18), radius: const Radius.circular(4), clockwise: false)
        ..close();
      canvas.drawPath(scallop, i.isEven ? darkFill : primaryFill);
    }

    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
