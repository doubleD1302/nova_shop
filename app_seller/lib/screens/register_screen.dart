import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import 'seller_main_screen.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _fullNameController = TextEditingController();
  final _usernameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();
  final _shopNameController = TextEditingController();
  final _shopTaglineController = TextEditingController();

  bool _isLoading = false;
  bool _showPassword = false;
  bool _showConfirm = false;
  bool _agreeTerms = true;
  String? _errorMessage;

  @override
  void dispose() {
    _fullNameController.dispose();
    _usernameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _passwordController.dispose();
    _confirmController.dispose();
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
    final phone = _phoneController.text.trim();
    final password = _passwordController.text;
    final confirm = _confirmController.text;
    final shopName = _shopNameController.text.trim();
    final shopTagline = _shopTaglineController.text.trim();

    if (fullName.isEmpty) {
      setState(() => _errorMessage = 'Vui lòng nhập họ và tên chủ shop.');
      return;
    }
    if (fullName.length > 120) {
      setState(() => _errorMessage = 'Họ và tên tối đa 120 ký tự.');
      return;
    }

    if (username.isEmpty) {
      if (email.contains('@')) {
        username = email.split('@')[0].replaceAll(RegExp(r'[^a-z0-9_]'), '');
        if (username.length < 3) username = 'seller_${DateTime.now().millisecondsSinceEpoch % 100000}';
      } else {
        setState(() => _errorMessage = 'Vui lòng nhập tên tài khoản (3–50 ký tự).');
        return;
      }
    }

    if (!RegExp(r'^[a-z0-9_]{3,50}$').hasMatch(username)) {
      setState(() => _errorMessage = 'Tên tài khoản chỉ gồm chữ cái, số hoặc dấu gạch dưới (3–50 ký tự).');
      return;
    }

    if (email.isEmpty) {
      setState(() => _errorMessage = 'Vui lòng nhập địa chỉ email.');
      return;
    }
    if (!_isValidEmail(email)) {
      setState(() => _errorMessage = 'Email không đúng định dạng.');
      return;
    }

    if (shopName.isEmpty) {
      setState(() => _errorMessage = 'Vui lòng nhập tên gian hàng.');
      return;
    }
    if (shopName.length > 160) {
      setState(() => _errorMessage = 'Tên gian hàng tối đa 160 ký tự.');
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

    if (!_agreeTerms) {
      setState(() => _errorMessage = 'Bạn cần đồng ý với Quy chế & Chính sách bán hàng ShopNova.');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final res = await AuthService().registerSeller(
      username: username,
      password: password,
      fullName: fullName,
      email: email,
      phone: phone.isNotEmpty ? phone : null,
      shopName: shopName,
      shopTagline: shopTagline.isNotEmpty ? shopTagline : null,
    );

    if (!mounted) return;

    if (res.success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Đăng ký gian hàng "$shopName" thành công!'),
          backgroundColor: const Color(0xFF00796B),
        ),
      );
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const SellerMainScreen()),
      );
    } else {
      setState(() {
        _isLoading = false;
        _errorMessage = res.message.isNotEmpty ? res.message : 'Đăng ký gian hàng thất bại.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    const primaryColor = Color(0xFF00796B);

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text('Đăng Ký Đối Tác Người Bán', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF1E293B),
        elevation: 0,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: const Color(0xFFE2E8F0), height: 1),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 60,
                  height: 60,
                  decoration: const BoxDecoration(
                    color: Color(0xFFE0F2F1),
                    shape: BoxShape.circle,
                  ),
                  child: const Center(
                    child: Icon(Icons.storefront_rounded, color: primaryColor, size: 34),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              const Center(
                child: Text(
                  'Mở Gian Hàng ShopNova',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Color(0xFF1E293B)),
                ),
              ),
              const Center(
                child: Text(
                  'Kinh doanh online chuyên nghiệp cùng hàng triệu khách hàng',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                ),
              ),
              const SizedBox(height: 20),

              if (_errorMessage != null)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFEBEE),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFFFFCDD2)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline, color: Colors.red, size: 20),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(_errorMessage!, style: const TextStyle(color: Colors.red, fontSize: 12)),
                      ),
                    ],
                  ),
                ),

              // Thông tin gian hàng
              Container(
                padding: const EdgeInsets.all(14),
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.store_rounded, size: 16, color: primaryColor),
                        SizedBox(width: 6),
                        Text('Thông tin gian hàng', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: primaryColor)),
                      ],
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _shopNameController,
                      decoration: InputDecoration(
                        labelText: 'Tên gian hàng *',
                        hintText: 'VD: Cửa hàng Thời trang Nova',
                        prefixIcon: const Icon(Icons.store_outlined),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                        isDense: true,
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _shopTaglineController,
                      decoration: InputDecoration(
                        labelText: 'Slogan / Khẩu hiệu',
                        hintText: 'VD: Uy tín & Chất lượng',
                        prefixIcon: const Icon(Icons.campaign_outlined),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                        isDense: true,
                      ),
                    ),
                  ],
                ),
              ),

              // Thông tin chủ gian hàng
              TextField(
                controller: _fullNameController,
                decoration: InputDecoration(
                  labelText: 'Họ và tên chủ gian hàng *',
                  prefixIcon: const Icon(Icons.badge_outlined),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  isDense: true,
                ),
              ),
              const SizedBox(height: 14),

              TextField(
                controller: _usernameController,
                decoration: InputDecoration(
                  labelText: 'Tên đăng nhập *',
                  hintText: '3–50 ký tự',
                  prefixIcon: const Icon(Icons.person_outline),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  isDense: true,
                ),
              ),
              const SizedBox(height: 14),

              TextField(
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
                decoration: InputDecoration(
                  labelText: 'Địa chỉ Email *',
                  hintText: 'email@example.com',
                  prefixIcon: const Icon(Icons.email_outlined),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  isDense: true,
                ),
              ),
              const SizedBox(height: 14),

              TextField(
                controller: _phoneController,
                keyboardType: TextInputType.phone,
                decoration: InputDecoration(
                  labelText: 'Số điện thoại',
                  prefixIcon: const Icon(Icons.phone_outlined),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  isDense: true,
                ),
              ),
              const SizedBox(height: 14),

              TextField(
                controller: _passwordController,
                obscureText: !_showPassword,
                decoration: InputDecoration(
                  labelText: 'Mật khẩu (tối thiểu 8 ký tự) *',
                  prefixIcon: const Icon(Icons.lock_outline),
                  suffixIcon: IconButton(
                    icon: Icon(_showPassword ? Icons.visibility_off : Icons.visibility),
                    onPressed: () => setState(() => _showPassword = !_showPassword),
                  ),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  isDense: true,
                ),
              ),
              const SizedBox(height: 14),

              TextField(
                controller: _confirmController,
                obscureText: !_showConfirm,
                decoration: InputDecoration(
                  labelText: 'Nhập lại mật khẩu *',
                  prefixIcon: const Icon(Icons.lock_clock_outlined),
                  suffixIcon: IconButton(
                    icon: Icon(_showConfirm ? Icons.visibility_off : Icons.visibility),
                    onPressed: () => setState(() => _showConfirm = !_showConfirm),
                  ),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  isDense: true,
                ),
              ),
              const SizedBox(height: 14),

              Row(
                children: [
                  Checkbox(
                    value: _agreeTerms,
                    onChanged: (val) => setState(() => _agreeTerms = val ?? true),
                    activeColor: primaryColor,
                  ),
                  const Expanded(
                    child: Text(
                      'Tôi cam kết bán hàng chính hãng và đồng ý với Quy chế hoạt động sàn ShopNova.',
                      style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),

              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _handleRegister,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: primaryColor,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    elevation: 2,
                  ),
                  child: _isLoading
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                        )
                      : const Text(
                          'ĐĂNG KÝ VÀ MỞ GIAN HÀNG',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                        ),
                ),
              ),
              const SizedBox(height: 16),

              Center(
                child: TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Đã có tài khoản Người Bán? Đăng nhập ngay', style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

