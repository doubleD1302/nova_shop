import 'package:flutter/material.dart';
import '../../theme/app_colors.dart';
import '../../services/auth_service.dart';
import '../../widgets/common/nova_logo.dart';
import '../main_screen.dart';
import '../seller/seller_hub_screen.dart';
import 'login_screen.dart' as shopnova_auth;

class RegisterScreen extends StatefulWidget {
  final String initialRole;
  const RegisterScreen({Key? key, this.initialRole = 'buyer'}) : super(key: key);

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  late String _role;

  final TextEditingController _fullNameController = TextEditingController();
  final TextEditingController _usernameController = TextEditingController();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _phoneController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  final TextEditingController _confirmPasswordController = TextEditingController();

  // Dành riêng cho Người bán (Seller)
  final TextEditingController _shopNameController = TextEditingController();
  final TextEditingController _shopTaglineController = TextEditingController();

  bool _obscurePassword = true;
  bool _obscureConfirm = true;
  bool _agreeTerms = true;
  bool _isLoading = false;
  String _password = '';

  @override
  void initState() {
    super.initState();
    _role = widget.initialRole == 'seller' ? 'seller' : 'buyer';
  }

  @override
  void dispose() {
    _fullNameController.dispose();
    _usernameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _shopNameController.dispose();
    _shopTaglineController.dispose();
    super.dispose();
  }

  bool _isValidEmail(String email) {
    return RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email.trim());
  }

  Future<void> _handleRegister() async {
    final fullName = _fullNameController.text.trim();
    String username = _usernameController.text.trim().toLowerCase();
    final email = _emailController.text.trim().toLowerCase();
    final phone = _phoneController.text.trim().replaceAll(RegExp(r'\s+'), '');
    final password = _passwordController.text;
    final confirm = _confirmPasswordController.text;
    final shopName = _shopNameController.text.trim();
    final shopTagline = _shopTaglineController.text.trim();

    // 1. Kiểm tra họ và tên
    if (fullName.isEmpty) {
      _showError('Vui lòng nhập họ và tên của bạn.');
      return;
    }
    if (fullName.length > 120) {
      _showError('Họ và tên tối đa 120 ký tự.');
      return;
    }

    // 2. Tên đăng nhập (nếu để trống thì tự tạo từ email hoặc số điện thoại)
    if (username.isEmpty) {
      if (email.isNotEmpty && email.contains('@')) {
        username = email.split('@')[0].replaceAll(RegExp(r'[^a-z0-9_]'), '');
        if (username.length < 3) username = 'user_';
      } else if (phone.isNotEmpty) {
        username = 'u_';
      } else {
        _showError('Vui lòng nhập tên đăng nhập (3–50 ký tự).');
        return;
      }
    }

    if (!RegExp(r'^[a-z0-9_]{3,50}$').hasMatch(username)) {
      _showError('Tên đăng nhập phải có 3–50 ký tự chữ cái không dấu, chữ số hoặc gạch dưới (_).');
      return;
    }

    // 3. Email (Bắt buộc theo chuẩn Backend)
    if (email.isEmpty) {
      _showError('Vui lòng nhập địa chỉ email.');
      return;
    }
    if (!_isValidEmail(email)) {
      _showError('Vui lòng nhập email đúng định dạng (ví dụ: ban@example.com).');
      return;
    }

    // 4. Mật khẩu (Ít nhất 8 ký tự theo chuẩn Backend & Website)
    if (password.length < 8) {
      _showError('Mật khẩu phải có ít nhất 8 ký tự.');
      return;
    }
    if (password.length > 72) {
      _showError('Mật khẩu tối đa 72 ký tự.');
      return;
    }
    if (password != confirm) {
      _showError('Mật khẩu nhập lại không khớp. Vui lòng kiểm tra lại.');
      return;
    }

    // 5. Kiểm tra Số điện thoại (nếu có nhập)
    if (phone.isNotEmpty && !RegExp(r'^[+()\d .-]{8,20}$').hasMatch(phone)) {
      _showError('Số điện thoại không hợp lệ (8–20 ký tự số).');
      return;
    }

    // 6. Nếu là Người bán: Kiểm tra tên gian hàng
    if (_role == 'seller') {
      if (shopName.isEmpty) {
        _showError('Người bán cần nhập tên gian hàng.');
        return;
      }
      if (shopName.length > 160) {
        _showError('Tên gian hàng tối đa 160 ký tự.');
        return;
      }
      if (shopTagline.length > 255) {
        _showError('Slogan gian hàng tối đa 255 ký tự.');
        return;
      }
    }

    // 7. Đồng ý điều khoản
    if (!_agreeTerms) {
      _showError('Bạn cần đồng ý với Điều khoản dịch vụ & Chính sách bảo mật.');
      return;
    }

    setState(() => _isLoading = true);

    final authService = AuthService();
    final success = await authService.register(
      username: username,
      password: password,
      fullName: fullName,
      email: email,
      phone: phone.isNotEmpty ? phone : null,
      role: _role,
      shopName: _role == 'seller' ? shopName : null,
      shopTagline: _role == 'seller' ? shopTagline : null,
    );

    if (!mounted) return;
    setState(() => _isLoading = false);

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            _role == 'seller'
                ? 'Đăng ký gian hàng thành công! Chào mừng đối tác '
                : 'Đăng ký thành công! Chào mừng ',
          ),
          backgroundColor: const Color(0xFF00BFA5),
        ),
      );

      if (_role == 'seller') {
        Navigator.pushAndRemoveUntil(
          context,
          MaterialPageRoute(builder: (_) => const SellerHubScreen()),
          (route) => false,
        );
      } else {
        Navigator.pushAndRemoveUntil(
          context,
          MaterialPageRoute(builder: (_) => const MainScreen()),
          (route) => false,
        );
      }
    } else {
      _showError(authService.lastError ?? 'Đăng ký không thành công. Vui lòng thử lại.');
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: const Color(0xFFD0011B),
      ),
    );
  }

  PreferredSizeWidget _buildAppBar() {
    return AppBar(
      backgroundColor: AppColors.surface,
      elevation: 0,
      surfaceTintColor: Colors.transparent,
      bottom: PreferredSize(
        preferredSize: const Size.fromHeight(1),
        child: Container(color: AppColors.border, height: 1),
      ),
      leading: IconButton(
        icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20, color: AppColors.textPrimary),
        onPressed: () => Navigator.maybePop(context),
      ),
      title: const NovaLogo(size: 30, fontSize: 19),
      centerTitle: true,
      actions: [
        IconButton(
          icon: const Icon(Icons.help_outline_rounded, color: AppColors.textSecondary, size: 22),
          onPressed: () {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Tổng đài hỗ trợ đăng ký: 1900 1234 (8:00 - 21:00)')),
            );
          },
        ),
        const SizedBox(width: 4),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: _buildAppBar(),
      body: SingleChildScrollView(
        padding: const EdgeInsets.only(bottom: 32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _buildHeader(),
            _buildRoleSelector(),
            _buildTabs(),
            _buildRegisterForm(),
            _buildFooter(),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                _role == 'seller' ? 'Đăng ký mở Gian Hàng ✨' : 'Tạo tài khoản mới ✨',
                style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
              ),
            ],
          ),
          const SizedBox(height: 4),
          RichText(
            text: TextSpan(
              style: const TextStyle(color: AppColors.textSecondary, fontSize: 13, height: 1.4),
              children: [
                TextSpan(
                  text: _role == 'seller'
                      ? 'Miễn phí mở shop, kết nối hàng triệu khách hàng toàn quốc cùng '
                      : 'Đăng ký nhận ngay gói Voucher ',
                ),
                TextSpan(
                  text: _role == 'seller' ? 'ShopNova Sàn Chuẩn!' : '500.000đ ',
                  style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold),
                ),
                if (_role == 'buyer') const TextSpan(text: 'dành riêng cho bạn!'),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRoleSelector() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: [
          Expanded(
            child: InkWell(
              onTap: () => setState(() => _role = 'buyer'),
              borderRadius: BorderRadius.circular(12),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: _role == 'buyer' ? AppColors.primary.withValues(alpha: 0.1) : AppColors.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: _role == 'buyer' ? AppColors.primary : AppColors.border,
                    width: _role == 'buyer' ? 1.8 : 1,
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      Icons.person_rounded,
                      color: _role == 'buyer' ? AppColors.primary : AppColors.textSecondary,
                      size: 24,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Tôi là Người Mua',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                        color: _role == 'buyer' ? AppColors.primary : AppColors.textPrimary,
                      ),
                    ),
                    const Text('Mua sắm & đặt hàng', style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: InkWell(
              onTap: () => setState(() => _role = 'seller'),
              borderRadius: BorderRadius.circular(12),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: _role == 'seller' ? const Color(0xFF00796B).withValues(alpha: 0.1) : AppColors.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: _role == 'seller' ? const Color(0xFF00796B) : AppColors.border,
                    width: _role == 'seller' ? 1.8 : 1,
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      Icons.storefront_rounded,
                      color: _role == 'seller' ? const Color(0xFF00796B) : AppColors.textSecondary,
                      size: 24,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Tôi là Người Bán',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                        color: _role == 'seller' ? const Color(0xFF00796B) : AppColors.textPrimary,
                      ),
                    ),
                    const Text('Mở gian hàng & bán hàng', style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTabs() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Container(
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(
          color: AppColors.surfaceAlt,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.border, width: 0.8),
        ),
        child: Row(
          children: [
            Expanded(
              child: InkWell(
                borderRadius: BorderRadius.circular(10),
                onTap: () => Navigator.pushReplacement(
                  context,
                  MaterialPageRoute(builder: (_) => const shopnova_auth.LoginScreen()),
                ),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 9),
                  child: const Center(
                    child: Text('Đăng Nhập', style: TextStyle(color: AppColors.textSecondary, fontWeight: FontWeight.w700, fontSize: 15)),
                  ),
                ),
              ),
            ),
            Expanded(
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 9),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.border, width: 0.8),
                  boxShadow: const [
                    BoxShadow(color: Color(0x0C000000), blurRadius: 4, offset: Offset(0, 1))
                  ],
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text('Đăng Ký', style: TextStyle(color: _role == 'seller' ? const Color(0xFF00796B) : AppColors.primary, fontWeight: FontWeight.w700, fontSize: 15)),
                    const SizedBox(width: 6),
                    Container(width: 6, height: 6, decoration: BoxDecoration(color: _role == 'seller' ? const Color(0xFF00796B) : AppColors.primary, shape: BoxShape.circle)),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInputField({
    required String label,
    required TextEditingController controller,
    required String hintText,
    required IconData icon,
    bool isRequired = true,
    TextInputType keyboardType = TextInputType.text,
    bool isPassword = false,
    bool obscureText = false,
    VoidCallback? onToggleObscure,
    ValueChanged<String>? onChanged,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(label, style: const TextStyle(color: AppColors.textPrimary, fontSize: 12, fontWeight: FontWeight.bold)),
            if (isRequired) const Text(' *', style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
          ],
        ),
        const SizedBox(height: 6),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          decoration: BoxDecoration(
            color: AppColors.surfaceAlt,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AppColors.border),
          ),
          child: Row(
            children: [
              Icon(icon, color: AppColors.textSecondary, size: 20),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  controller: controller,
                  keyboardType: keyboardType,
                  obscureText: obscureText,
                  onChanged: onChanged,
                  style: const TextStyle(color: AppColors.textPrimary),
                  decoration: InputDecoration(
                    hintText: hintText,
                    hintStyle: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                    border: InputBorder.none,
                    isDense: true,
                  ),
                ),
              ),
              if (isPassword)
                GestureDetector(
                  onTap: onToggleObscure,
                  child: Icon(
                    obscureText ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                    color: AppColors.textSecondary,
                    size: 20,
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildRegisterForm() {
    bool hasLen = _password.length >= 8;
    bool hasMix = _password.contains(RegExp(r'[a-zA-Z]')) && _password.contains(RegExp(r'[0-9]'));
    bool hasSpecial = _password.contains(RegExp(r'[^a-zA-Z0-9]'));

    int strength = 0;
    if (_password.isNotEmpty) {
      if (!hasLen || !hasMix) {
        strength = 1;
      } else if (hasLen && hasMix && !hasSpecial) {
        strength = 2;
      } else {
        strength = 3;
      }
    }

    String strengthLabel = 'Chưa nhập';
    Color strengthColor = AppColors.textSecondary;
    if (strength == 1) {
      strengthLabel = 'Yếu';
      strengthColor = AppColors.flashSaleRed;
    } else if (strength == 2) {
      strengthLabel = 'Trung bình';
      strengthColor = Colors.orange;
    } else if (strength == 3) {
      strengthLabel = 'Mạnh';
      strengthColor = const Color(0xFF00BFA5);
    }

    final accentColor = _role == 'seller' ? const Color(0xFF00796B) : AppColors.primary;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
        boxShadow: const [
          BoxShadow(color: Color(0x06000000), blurRadius: 10, offset: Offset(0, 3))
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 1. Họ và tên
          _buildInputField(
            label: 'Họ và tên',
            controller: _fullNameController,
            hintText: 'Nhập họ và tên đầy đủ',
            icon: Icons.badge_outlined,
          ),
          const SizedBox(height: 14),

          // 2. Tên đăng nhập
          _buildInputField(
            label: 'Tên đăng nhập (Username)',
            controller: _usernameController,
            hintText: 'VD: nguyen_van_a (3–50 ký tự)',
            icon: Icons.person_outline_rounded,
          ),
          const SizedBox(height: 14),

          // 3. Email (BẮT BUỘC)
          _buildInputField(
            label: 'Địa chỉ Email (Bắt buộc)',
            controller: _emailController,
            hintText: 'email@example.com',
            icon: Icons.email_outlined,
            keyboardType: TextInputType.emailAddress,
          ),
          const SizedBox(height: 14),

          // 4. Số điện thoại (Tùy chọn)
          _buildInputField(
            label: 'Số điện thoại',
            controller: _phoneController,
            hintText: '0912345678',
            icon: Icons.phone_outlined,
            isRequired: false,
            keyboardType: TextInputType.phone,
          ),
          const SizedBox(height: 14),

          // NẾU LÀ NGƯỜI BÁN: Hiển thị thêm thông tin gian hàng
          if (_role == 'seller') ...[
            Container(
              padding: const EdgeInsets.all(12),
              margin: const EdgeInsets.only(bottom: 14),
              decoration: BoxDecoration(
                color: const Color(0xFFE0F2F1),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFB2DFDB)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.storefront_rounded, size: 18, color: Color(0xFF00796B)),
                      SizedBox(width: 6),
                      Text('Thông tin gian hàng của bạn', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF004D40))),
                    ],
                  ),
                  const SizedBox(height: 10),
                  _buildInputField(
                    label: 'Tên Gian Hàng',
                    controller: _shopNameController,
                    hintText: 'VD: Cửa Hàng Thời Trang Nova',
                    icon: Icons.store_rounded,
                  ),
                  const SizedBox(height: 10),
                  _buildInputField(
                    label: 'Slogan / Khẩu hiệu',
                    controller: _shopTaglineController,
                    hintText: 'VD: Uy tín - Chất lượng - Giá tốt',
                    icon: Icons.campaign_outlined,
                    isRequired: false,
                  ),
                ],
              ),
            ),
          ],

          // 5. Mật khẩu
          _buildInputField(
            label: 'Mật khẩu',
            controller: _passwordController,
            hintText: 'Tối thiểu 8 ký tự',
            icon: Icons.lock_outline_rounded,
            isPassword: true,
            obscureText: _obscurePassword,
            onToggleObscure: () => setState(() => _obscurePassword = !_obscurePassword),
            onChanged: (val) => setState(() => _password = val),
          ),
          const SizedBox(height: 6),

          // Thanh đo độ mạnh mật khẩu
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Độ mạnh mật khẩu:', style: TextStyle(color: Color(0xFF8F90A6), fontSize: 12)),
              Text(strengthLabel, style: TextStyle(color: strengthColor, fontSize: 12, fontWeight: FontWeight.bold)),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Expanded(
                child: Container(
                  height: 4,
                  decoration: BoxDecoration(
                    color: strength >= 1 ? strengthColor : const Color(0xFFEEEEF0),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Container(
                  height: 4,
                  decoration: BoxDecoration(
                    color: strength >= 2 ? strengthColor : const Color(0xFFEEEEF0),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Container(
                  height: 4,
                  decoration: BoxDecoration(
                    color: strength >= 3 ? strengthColor : const Color(0xFFEEEEF0),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Icon(hasLen ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded,
                  size: 14, color: hasLen ? const Color(0xFF00BFA5) : const Color(0xFF8F90A6)),
              const SizedBox(width: 4),
              Text('Tối thiểu 8 ký tự', style: TextStyle(color: hasLen ? const Color(0xFF1E2022) : const Color(0xFF8F90A6), fontSize: 12)),
              const SizedBox(width: 16),
              Icon(hasMix ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded,
                  size: 14, color: hasMix ? const Color(0xFF00BFA5) : const Color(0xFF8F90A6)),
              const SizedBox(width: 4),
              Text('Gồm chữ & số', style: TextStyle(color: hasMix ? const Color(0xFF1E2022) : const Color(0xFF8F90A6), fontSize: 12)),
            ],
          ),
          const SizedBox(height: 14),

          // 6. Nhập lại mật khẩu
          _buildInputField(
            label: 'Nhập lại mật khẩu',
            controller: _confirmPasswordController,
            hintText: 'Nhập lại mật khẩu chính xác',
            icon: Icons.lock_clock_outlined,
            isPassword: true,
            obscureText: _obscureConfirm,
            onToggleObscure: () => setState(() => _obscureConfirm = !_obscureConfirm),
          ),
          const SizedBox(height: 14),

          // Điều khoản dịch vụ
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                width: 24,
                height: 24,
                child: Checkbox(
                  value: _agreeTerms,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                  onChanged: (val) => setState(() => _agreeTerms = val ?? true),
                  activeColor: accentColor,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: RichText(
                  text: TextSpan(
                    style: const TextStyle(color: Color(0xFF555770), fontSize: 12, height: 1.4),
                    children: [
                      const TextSpan(text: 'Tôi đồng ý với '),
                      TextSpan(text: 'Điều khoản dịch vụ', style: TextStyle(color: accentColor, fontWeight: FontWeight.bold)),
                      const TextSpan(text: ' và '),
                      TextSpan(text: 'Chính sách bảo mật', style: TextStyle(color: accentColor, fontWeight: FontWeight.bold)),
                      const TextSpan(text: ' của ShopNova.'),
                    ],
                  ),
                ),
              )
            ],
          ),
          const SizedBox(height: 18),

          // Nút bấm Đăng Ký
          Container(
            width: double.infinity,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: _role == 'seller'
                    ? const [Color(0xFF00796B), Color(0xFF004D40)]
                    : const [AppColors.primary, AppColors.earth],
              ),
              borderRadius: BorderRadius.circular(12),
              boxShadow: [
                BoxShadow(
                  color: accentColor.withValues(alpha: 0.3),
                  blurRadius: 8,
                  offset: const Offset(0, 3),
                ),
              ],
            ),
            child: ElevatedButton(
              onPressed: _isLoading ? null : _handleRegister,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.transparent,
                shadowColor: Colors.transparent,
                foregroundColor: Colors.white,
                minimumSize: const Size(double.infinity, 50),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _isLoading
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                    )
                  : Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          _role == 'seller' ? 'Đăng Ký & Mở Gian Hàng' : 'Đăng Ký Tài Khoản & Nhận Quà',
                          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(width: 8),
                        const Icon(Icons.arrow_forward_rounded, size: 20),
                      ],
                    ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFooter() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Text('Đã có tài khoản? ', style: TextStyle(color: Color(0xFF555770), fontSize: 14)),
          GestureDetector(
            onTap: () => Navigator.pushReplacement(
              context,
              MaterialPageRoute(builder: (_) => const shopnova_auth.LoginScreen()),
            ),
            child: const Text('Đăng nhập ngay', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 14)),
          ),
        ],
      ),
    );
  }
}
