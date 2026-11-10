import 'package:flutter/material.dart';
import '../../theme/app_colors.dart';
import '../../services/auth_service.dart';
import '../../widgets/common/nova_logo.dart';
import '../main_screen.dart';
import '../seller/seller_register_screen.dart';
import 'login_screen.dart' as shopnova_auth;

/// Màn hình Đăng ký tài khoản dành cho Người Mua (Buyer), đồng bộ với Website src/pages/RegisterPage.jsx.
/// Người dùng muốn mở gian hàng được điều hướng sang màn hình Đăng Ký Kênh Người Bán (`SellerRegisterScreen`).
class RegisterScreen extends StatefulWidget {
  final String initialRole;
  const RegisterScreen({Key? key, this.initialRole = 'buyer'}) : super(key: key);

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final TextEditingController _fullNameController = TextEditingController();
  final TextEditingController _usernameController = TextEditingController();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _phoneController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  final TextEditingController _confirmPasswordController = TextEditingController();

  bool _obscurePassword = true;
  bool _obscureConfirm = true;
  bool _agreeTerms = true;
  bool _isLoading = false;
  String _password = '';

  @override
  void initState() {
    super.initState();
    // Nếu được mở với initialRole == 'seller', tự động điều hướng sang Kênh Người Bán như Website
    if (widget.initialRole == 'seller') {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const SellerRegisterScreen()),
        );
      });
    }
  }

  @override
  void dispose() {
    _fullNameController.dispose();
    _usernameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  bool _isValidEmail(String email) {
    return RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email.trim());
  }

  Future<void> _handleRegister() async {
    final fullName = _fullNameController.text.trim();
    final username = _usernameController.text.trim().toLowerCase();
    final email = _emailController.text.trim().toLowerCase();
    final phone = _phoneController.text.trim().replaceAll(RegExp(r'\s+'), '');
    final password = _passwordController.text;
    final confirm = _confirmPasswordController.text;

    if (fullName.isEmpty || username.isEmpty || password.isEmpty) {
      _showError('Vui lòng nhập họ tên, tên đăng nhập và mật khẩu.');
      return;
    }
    if (fullName.length > 120 || !RegExp(r'^[a-z0-9_]{3,50}$').hasMatch(username)) {
      _showError('Tên cần tối đa 120 ký tự; tên đăng nhập phải có 3–50 chữ cái, chữ số hoặc dấu gạch dưới.');
      return;
    }

    if (email.isEmpty || !_isValidEmail(email)) {
      _showError('Vui lòng nhập email đúng định dạng.');
      return;
    }

    if (password.length < 8) {
      _showError('Mật khẩu phải có ít nhất 8 ký tự.');
      return;
    }
    if (password.length > 72) {
      _showError('Mật khẩu không được dài quá 72 byte.');
      return;
    }
    if (password != confirm) {
      _showError('Mật khẩu nhập lại không khớp.');
      return;
    }

    if (phone.isNotEmpty && !RegExp(r'^[+()\d .-]{8,20}$').hasMatch(phone)) {
      _showError('Số điện thoại chỉ được chứa chữ số và ký tự +, khoảng trắng, dấu ngoặc hoặc dấu gạch ngang.');
      return;
    }

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
      role: 'buyer',
    );

    if (!mounted) return;
    setState(() => _isLoading = false);

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Đăng ký tài khoản thành công! Chào mừng bạn đến với NovaShop.'),
          backgroundColor: Color(0xFF00BFA5),
        ),
      );

      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(builder: (_) => const MainScreen()),
        (route) => false,
      );
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
              const SnackBar(content: Text('Vui lòng liên hệ hỗ trợ để được hướng dẫn đăng ký tài khoản.')),
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
            _buildTabs(),
            _buildRegisterForm(),
            _buildFooter(),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return const Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Đăng Ký Tài Khoản',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
          ),
          SizedBox(height: 4),
          Text(
            'Tạo tài khoản người mua để khám phá hàng ngàn sản phẩm và đặt hàng tiện lợi.',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 13, height: 1.4),
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
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text('Đăng Ký', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.w700, fontSize: 15)),
                    SizedBox(width: 6),
                    SizedBox(
                      width: 6,
                      height: 6,
                      child: DecoratedBox(
                        decoration: BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
                      ),
                    ),
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
          _buildInputField(
            label: 'Họ và tên',
            controller: _fullNameController,
            hintText: 'Nhập họ và tên đầy đủ',
            icon: Icons.badge_outlined,
          ),
          const SizedBox(height: 14),
          _buildInputField(
            label: 'Tên đăng nhập (Username)',
            controller: _usernameController,
            hintText: 'Nhập tên đăng nhập (3–50 ký tự)',
            icon: Icons.person_outline_rounded,
          ),
          const SizedBox(height: 14),
          _buildInputField(
            label: 'Địa chỉ Email (Bắt buộc)',
            controller: _emailController,
            hintText: 'Nhập địa chỉ email',
            icon: Icons.email_outlined,
            keyboardType: TextInputType.emailAddress,
          ),
          const SizedBox(height: 14),
          _buildInputField(
            label: 'Số điện thoại',
            controller: _phoneController,
            hintText: 'Nhập số điện thoại',
            icon: Icons.phone_outlined,
            isRequired: false,
            keyboardType: TextInputType.phone,
          ),
          const SizedBox(height: 14),
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
              Icon(
                hasLen ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded,
                size: 14,
                color: hasLen ? const Color(0xFF00BFA5) : const Color(0xFF8F90A6),
              ),
              const SizedBox(width: 4),
              Text('Tối thiểu 8 ký tự', style: TextStyle(color: hasLen ? const Color(0xFF1E2022) : const Color(0xFF8F90A6), fontSize: 12)),
              const SizedBox(width: 16),
              Icon(
                hasMix ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded,
                size: 14,
                color: hasMix ? const Color(0xFF00BFA5) : const Color(0xFF8F90A6),
              ),
              const SizedBox(width: 4),
              Text('Gồm chữ & số', style: TextStyle(color: hasMix ? const Color(0xFF1E2022) : const Color(0xFF8F90A6), fontSize: 12)),
            ],
          ),
          const SizedBox(height: 14),
          _buildInputField(
            label: 'Nhập lại mật khẩu',
            controller: _confirmPasswordController,
            hintText: 'Nhập lại mật khẩu',
            icon: Icons.lock_clock_outlined,
            isPassword: true,
            obscureText: _obscureConfirm,
            onToggleObscure: () => setState(() => _obscureConfirm = !_obscureConfirm),
          ),
          const SizedBox(height: 14),
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
                  activeColor: AppColors.primary,
                ),
              ),
              const SizedBox(width: 8),
              const Expanded(
                child: Text.rich(
                  TextSpan(
                    style: TextStyle(color: Color(0xFF555770), fontSize: 12, height: 1.4),
                    children: [
                      TextSpan(text: 'Tôi đồng ý với '),
                      TextSpan(text: 'Điều khoản dịch vụ', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold)),
                      TextSpan(text: ' và '),
                      TextSpan(text: 'Chính sách bảo mật', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold)),
                      TextSpan(text: ' của ShopNova.'),
                    ],
                  ),
                ),
              )
            ],
          ),
          const SizedBox(height: 18),
          Container(
            width: double.infinity,
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [AppColors.primary, AppColors.earth]),
              borderRadius: BorderRadius.circular(12),
              boxShadow: [
                BoxShadow(
                  color: AppColors.primary.withValues(alpha: 0.3),
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
                  : const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text('Đăng Ký Tài Khoản', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                        SizedBox(width: 8),
                        Icon(Icons.arrow_forward_rounded, size: 20),
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
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Column(
        children: [
          Row(
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
          const SizedBox(height: 16),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              children: [
                const Text(
                  'Bạn là đối tác bán hàng?',
                  style: TextStyle(color: AppColors.textSecondary, fontSize: 12.5),
                ),
                const SizedBox(height: 6),
                InkWell(
                  borderRadius: BorderRadius.circular(8),
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const SellerRegisterScreen()),
                    );
                  },
                  child: const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.storefront_outlined, size: 17, color: AppColors.primary),
                        SizedBox(width: 6),
                        Text(
                          'Đăng ký mở gian hàng tại Kênh Người Bán',
                          style: TextStyle(
                            color: AppColors.primary,
                            fontWeight: FontWeight.w700,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
