import 'package:flutter/material.dart';
import '../../theme/app_colors.dart';
import '../../services/auth_service.dart';
import '../main_screen.dart';
import 'login_screen.dart' as shopnova_auth;
import 'otp_screen.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({Key? key}) : super(key: key);

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final TextEditingController _fullNameController = TextEditingController();
  final TextEditingController _phoneController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  bool _obscurePassword = true;
  bool _agreeTerms = true;
  bool _isLoading = false;
  String _password = "";

  @override
  void dispose() {
    _fullNameController.dispose();
    _phoneController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleRegister() async {
    final fullName = _fullNameController.text.trim();
    final phone = _phoneController.text.trim().replaceAll(RegExp(r'\s+'), '');
    final password = _passwordController.text;

    if (fullName.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vui lòng nhập họ và tên của bạn.')),
      );
      return;
    }

    if (phone.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vui lòng nhập số điện thoại hoặc tên đăng nhập.')),
      );
      return;
    }

    if (password.length < 6) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Mật khẩu phải có ít nhất 6 ký tự.')),
      );
      return;
    }

    if (!_agreeTerms) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Bạn cần đồng ý với Điều khoản dịch vụ & Chính sách bảo mật.')),
      );
      return;
    }

    setState(() => _isLoading = true);

    // Dùng số điện thoại hoặc username đã chuẩn hóa
    final username = phone.toLowerCase();
    final authService = AuthService();
    final success = await authService.register(
      username: username,
      password: password,
      fullName: fullName,
      phone: phone,
      role: 'buyer',
    );

    if (!mounted) return;
    setState(() => _isLoading = false);

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Đăng ký thành công! Chào mừng ${authService.currentUser?.fullName ?? fullName}'),
          backgroundColor: Colors.green,
        ),
      );
      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(builder: (_) => const MainScreen()),
        (route) => false,
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(authService.lastError ?? 'Đăng ký không thành công.'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  @override
  Widget _buildAppBar() {
    return Container(
      padding: EdgeInsets.only(top: MediaQuery.of(context).padding.top),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.9),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 1),
          )
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                GestureDetector(
                  onTap: () => Navigator.pop(context),
                  child: const Icon(Icons.arrow_back_ios_new, size: 24, color: Colors.black87),
                ),
                const SizedBox(width: 8),
                const Icon(Icons.shopping_bag, color: AppColors.primary, size: 28),
                const SizedBox(width: 4),
                const Text(
                  'ShopNova',
                  style: TextStyle(color: AppColors.primary, fontSize: 18, fontWeight: FontWeight.bold, letterSpacing: -0.5),
                ),
              ],
            ),
            Row(
              children: [
                const Icon(Icons.help_outline, color: Colors.grey, size: 24),
                const SizedBox(width: 12),
                Container(
                  width: 32, height: 32,
                  decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
                  child: const Icon(Icons.person, color: Colors.white, size: 18),
                )
              ],
            )
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[50], // surface color
      body: Column(
        children: [
          _buildAppBar(),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.only(bottom: 32),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _buildHeader(),
                  _buildPromoBanner(),
                  _buildTabs(),
                  _buildRegisterForm(),
                  _buildSocialLogin(),
                  _buildFooter(),
                ],
              ),
            ),
          )
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Text(
                'Tạo tài khoản mới ',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.black87),
              ),
              Text('✨', style: TextStyle(fontSize: 20)),
            ],
          ),
          const SizedBox(height: 4),
          RichText(
            text: const TextSpan(
              style: TextStyle(color: Colors.grey, fontSize: 14, height: 1.4),
              children: [
                TextSpan(text: 'Đăng ký nhận ngay gói Voucher '),
                TextSpan(text: '500.000đ ', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold)),
                TextSpan(text: 'dành riêng cho bạn!'),
              ]
            ),
          )
        ],
      ),
    );
  }

  Widget _buildPromoBanner() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [AppColors.primary, Color(0xFFD63C1E)]),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.1), blurRadius: 4, offset: const Offset(0, 2))
        ]
      ),
      child: Row(
        children: [
          Container(
            width: 48, height: 48,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.redeem, color: Colors.white, size: 28),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.25), borderRadius: BorderRadius.circular(4)),
                      child: const Text('QUÀ CHÀO BẠN MỚI', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                    ),
                    const SizedBox(width: 4),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(color: Colors.greenAccent[400], borderRadius: BorderRadius.circular(4)),
                      child: const Text('Hot', style: TextStyle(color: Colors.black87, fontSize: 10, fontWeight: FontWeight.bold)),
                    )
                  ],
                ),
                const SizedBox(height: 4),
                const Text('Voucher Quà Tặng 500k', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                const Text('Freeship 0đ + Giảm 50K đơn đầu', style: TextStyle(color: Colors.white70, fontSize: 12)),
              ],
            ),
          ),
          Column(
            children: [
              Container(
                width: 32, height: 32,
                decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                child: const Center(child: Text('50K', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 12))),
              ),
              const SizedBox(height: 2),
              const Text('Tiết kiệm', style: TextStyle(color: Colors.white70, fontSize: 10)),
            ],
          )
        ],
      ),
    );
  }

  Widget _buildTabs() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Container(
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(
          color: Colors.blue[50]?.withValues(alpha: 0.5),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Expanded(
              child: GestureDetector(
                onTap: () => Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const shopnova_auth.LoginScreen())),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  child: const Center(
                    child: Text('Đăng Nhập', style: TextStyle(color: Colors.grey, fontSize: 14)),
                  ),
                ),
              ),
            ),
            Expanded(
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(8),
                  boxShadow: [
                    BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 2, offset: const Offset(0, 1))
                  ],
                ),
                child: const Center(
                  child: Text('Đăng Ký', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 14)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRegisterForm() {
    bool hasLen = _password.length >= 8;
    bool hasMix = _password.contains(RegExp(r'[a-zA-Z]')) && _password.contains(RegExp(r'[0-9]'));
    bool hasSpecial = _password.contains(RegExp(r'[^a-zA-Z0-9]'));

    int strength = 0;
    if (_password.isNotEmpty) {
      if (!hasLen || !hasMix) strength = 1;
      else if (hasLen && hasMix && !hasSpecial) strength = 2;
      else strength = 3;
    }

    String strengthLabel = "Chưa nhập";
    Color strengthColor = Colors.grey;
    if (strength == 1) { strengthLabel = "Yếu"; strengthColor = Colors.red; }
    else if (strength == 2) { strengthLabel = "Trung bình"; strengthColor = Colors.orange; }
    else if (strength == 3) { strengthLabel = "Mạnh"; strengthColor = Colors.green; }

    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Họ và tên', style: TextStyle(color: Colors.black87, fontSize: 14, fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.grey[200]!)
            ),
            child: TextField(
              controller: _fullNameController,
              decoration: const InputDecoration(
                hintText: 'Nhập họ và tên của bạn',
                hintStyle: TextStyle(color: Colors.grey),
                prefixIcon: Icon(Icons.person, color: Colors.grey),
                border: InputBorder.none,
                contentPadding: EdgeInsets.symmetric(vertical: 14),
              ),
            ),
          ),
          const SizedBox(height: 16),
          const Text('Số điện thoại / Tên đăng nhập', style: TextStyle(color: Colors.black87, fontSize: 14, fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.grey[200]!)
            ),
            child: Row(
              children: [
                const SizedBox(width: 12),
                const Text('🇻🇳', style: TextStyle(fontSize: 16)),
                const SizedBox(width: 6),
                const Text('+84', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                Container(width: 1, height: 16, color: Colors.grey[300], margin: const EdgeInsets.symmetric(horizontal: 8)),
                Expanded(
                  child: TextField(
                    controller: _phoneController,
                    keyboardType: TextInputType.text,
                    decoration: const InputDecoration(
                      hintText: '0912345678 hoặc username',
                      hintStyle: TextStyle(color: Colors.grey),
                      border: InputBorder.none,
                      contentPadding: EdgeInsets.symmetric(vertical: 14),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Mật khẩu', style: TextStyle(color: Colors.black87, fontSize: 14, fontWeight: FontWeight.w600)),
              Text('Ít nhất 8 ký tự', style: TextStyle(color: Colors.grey[500], fontSize: 12)),
            ],
          ),
          const SizedBox(height: 6),
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.grey[200]!)
            ),
            child: TextField(
              controller: _passwordController,
              obscureText: _obscurePassword,
              onChanged: (val) {
                setState(() { _password = val; });
              },
              decoration: InputDecoration(
                hintText: 'Tạo mật khẩu an toàn',
                hintStyle: const TextStyle(color: Colors.grey),
                prefixIcon: const Icon(Icons.lock, color: Colors.grey),
                suffixIcon: GestureDetector(
                  onTap: () { setState(() { _obscurePassword = !_obscurePassword; }); },
                  child: Icon(_obscurePassword ? Icons.visibility_off : Icons.visibility, color: Colors.grey),
                ),
                border: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(vertical: 14),
              ),
            ),
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Độ mạnh mật khẩu:', style: TextStyle(color: Colors.grey[600], fontSize: 12)),
              Text(strengthLabel, style: TextStyle(color: strengthColor, fontSize: 12, fontWeight: FontWeight.bold)),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Expanded(child: Container(height: 4, decoration: BoxDecoration(color: strength >= 1 ? strengthColor : Colors.grey[300], borderRadius: BorderRadius.circular(2)))),
              const SizedBox(width: 6),
              Expanded(child: Container(height: 4, decoration: BoxDecoration(color: strength >= 2 ? strengthColor : Colors.grey[300], borderRadius: BorderRadius.circular(2)))),
              const SizedBox(width: 6),
              Expanded(child: Container(height: 4, decoration: BoxDecoration(color: strength >= 3 ? strengthColor : Colors.grey[300], borderRadius: BorderRadius.circular(2)))),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Icon(hasLen ? Icons.check_circle : Icons.radio_button_unchecked, size: 14, color: hasLen ? Colors.green : Colors.grey),
              const SizedBox(width: 4),
              Text('Tối thiểu 8 ký tự', style: TextStyle(color: hasLen ? Colors.black87 : Colors.grey, fontSize: 12)),
              const SizedBox(width: 16),
              Icon(hasMix ? Icons.check_circle : Icons.radio_button_unchecked, size: 14, color: hasMix ? Colors.green : Colors.grey),
              const SizedBox(width: 4),
              Text('Gồm chữ & số', style: TextStyle(color: hasMix ? Colors.black87 : Colors.grey, fontSize: 12)),
            ],
          ),
          const SizedBox(height: 16),
          RichText(
            text: const TextSpan(
              style: TextStyle(color: Colors.black87, fontSize: 14, fontWeight: FontWeight.w600),
              children: [
                TextSpan(text: 'Mã giới thiệu '),
                TextSpan(text: '(Không bắt buộc)', style: TextStyle(color: Colors.grey, fontWeight: FontWeight.normal, fontSize: 12)),
              ]
            ),
          ),
          const SizedBox(height: 6),
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.grey[200]!)
            ),
            child: Row(
              children: [
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 12),
                  child: Icon(Icons.loyalty, color: Colors.grey),
                ),
                const Expanded(
                  child: TextField(
                    decoration: InputDecoration(
                      hintText: 'Nhập mã nhận thêm 20.000 Nova Coins',
                      hintStyle: TextStyle(color: Colors.grey, fontSize: 13),
                      border: InputBorder.none,
                      contentPadding: EdgeInsets.symmetric(vertical: 14),
                    ),
                  ),
                ),
                Container(
                  margin: const EdgeInsets.only(right: 8),
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                  decoration: BoxDecoration(color: Colors.blue[50], borderRadius: BorderRadius.circular(6)),
                  child: Row(
                    children: [
                      Icon(Icons.monetization_on, color: AppColors.primary, size: 14),
                      const SizedBox(width: 2),
                      const Text('+20k', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 10)),
                    ],
                  ),
                )
              ],
            ),
          ),
          const SizedBox(height: 16),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                width: 24, height: 24,
                child: Checkbox(
                  value: _agreeTerms,
                  onChanged: (val) { setState(() { _agreeTerms = val ?? true; }); },
                  activeColor: AppColors.primary,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: RichText(
                  text: const TextSpan(
                    style: TextStyle(color: Colors.grey, fontSize: 12, height: 1.4),
                    children: [
                      TextSpan(text: 'Tôi đồng ý với '),
                      TextSpan(text: 'Điều khoản dịch vụ', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold)),
                      TextSpan(text: ' và '),
                      TextSpan(text: 'Chính sách bảo mật', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold)),
                      TextSpan(text: ' của ShopNova.'),
                    ]
                  ),
                ),
              )
            ],
          ),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: _isLoading ? null : _handleRegister,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              minimumSize: const Size(double.infinity, 50),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              elevation: 2,
            ),
            child: _isLoading
                ? const SizedBox(
                    width: 24,
                    height: 24,
                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                  )
                : const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text('Đăng Ký Tài Khoản & Nhận Quà', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                      SizedBox(width: 8),
                      Icon(Icons.arrow_forward, size: 20),
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildSocialLogin() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(child: Container(height: 1, color: Colors.grey[300])),
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 12),
                child: Text('Hoặc đăng ký bằng', style: TextStyle(color: Colors.grey, fontSize: 12)),
              ),
              Expanded(child: Container(height: 1, color: Colors.grey[300])),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _buildSocialButton(
                  icon: const Text('G', style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold, fontSize: 20)),
                  label: 'Google',
                )
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildSocialButton(
                  icon: const Icon(Icons.apple, color: Colors.black, size: 24),
                  label: 'Apple',
                )
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildSocialButton(
                  icon: const Icon(Icons.facebook, color: Colors.blue, size: 24),
                  label: 'Facebook',
                )
              ),
            ],
          )
        ],
      ),
    );
  }

  Widget _buildSocialButton({required Widget icon, required String label}) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 4, offset: const Offset(0, 2))
        ]
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          icon,
          const SizedBox(width: 6),
          Text(label, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.black87)),
        ],
      ),
    );
  }

  Widget _buildFooter() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Text('Đã có tài khoản? ', style: TextStyle(color: Colors.grey, fontSize: 14)),
          GestureDetector(
            onTap: () => Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const shopnova_auth.LoginScreen())),
            child: const Text('Đăng nhập ngay', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 14)),
          ),
        ],
      ),
    );
  }
}
