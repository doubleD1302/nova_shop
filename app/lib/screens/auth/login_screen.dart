import 'package:flutter/material.dart';
import '../../theme/app_colors.dart';
import '../../services/auth_service.dart';
import '../../services/api_config.dart';
import 'register_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({Key? key}) : super(key: key);

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final TextEditingController _usernameController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  bool _obscurePassword = true;
  bool _rememberMe = true;
  bool _isCheckingBackend = false;
  bool _backendOnline = false;
  String _backendStatusText = 'Đang kiểm tra kết nối...';

  @override
  void initState() {
    super.initState();
    _checkBackendStatus();
  }

  @override
  void dispose() {
    _usernameController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _checkBackendStatus() async {
    setState(() {
      _isCheckingBackend = true;
    });
    final status = await AuthService().checkFullConnectionStatus();
    if (!mounted) return;
    final isOnline = status['isOnline'] == true;
    final isReady = status['isReady'] == true;
    setState(() {
      _isCheckingBackend = false;
      _backendOnline = isOnline;
      if (isReady) {
        _backendStatusText = 'Máy chủ & CSDL sẵn sàng (${status['latencyMs']}ms)';
      } else if (isOnline) {
        _backendStatusText = 'Backend online, CSDL ngắt kết nối';
      } else {
        _backendStatusText = 'Không thể kết nối máy chủ API';
      }
    });
  }

  Future<void> _handleLogin() async {
    final username = _usernameController.text.trim();
    final password = _passwordController.text;

    if (username.isEmpty || password.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Vui lòng nhập tên đăng nhập/số điện thoại và mật khẩu'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    final success = await AuthService().login(
      username,
      password,
      rememberMe: _rememberMe,
    );
    if (!mounted) return;

    if (success) {
      final user = AuthService().currentUser;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Đăng nhập thành công! Chào ${user?.fullName ?? user?.username}'),
          backgroundColor: const Color(0xFF00BFA5),
        ),
      );
      Navigator.pop(context);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(AuthService().lastError ?? 'Đăng nhập không thành công.'),
          backgroundColor: const Color(0xFFD0011B),
        ),
      );
    }
  }

  void _showChangeServerDialog() {
    final controller = TextEditingController(text: ApiConfig.baseUrl);
    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text('Cấu hình Backend API', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Chọn hoặc nhập URL máy chủ API:',
                style: TextStyle(fontSize: 13, color: Color(0xFF555770)),
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  ActionChip(
                    avatar: const Icon(Icons.cloud_rounded, size: 16, color: Color(0xFF00BFA5)),
                    label: const Text('Render Cloud', style: TextStyle(fontSize: 11)),
                    onPressed: () {
                      setDialogState(() {
                        controller.text = ApiConfig.productionUrl;
                      });
                    },
                  ),
                  ActionChip(
                    avatar: const Icon(Icons.wifi_rounded, size: 16, color: Colors.blue),
                    label: const Text('Wi-Fi: 192.168.1.11', style: TextStyle(fontSize: 11)),
                    onPressed: () {
                      setDialogState(() {
                        controller.text = ApiConfig.lanHostUrl;
                      });
                    },
                  ),
                  ActionChip(
                    avatar: const Icon(Icons.usb_rounded, size: 16, color: Colors.orange),
                    label: const Text('USB: 127.0.0.1', style: TextStyle(fontSize: 11)),
                    onPressed: () {
                      setDialogState(() {
                        controller.text = ApiConfig.usbLoopbackUrl;
                      });
                    },
                  ),
                  ActionChip(
                    avatar: const Icon(Icons.computer_rounded, size: 16, color: Colors.grey),
                    label: const Text('Máy ảo: 10.0.2.2', style: TextStyle(fontSize: 11)),
                    onPressed: () {
                      setDialogState(() {
                        controller.text = ApiConfig.emulatorUrl;
                      });
                    },
                  ),
                ],
              ),
              const SizedBox(height: 12),
              TextField(
                controller: controller,
                decoration: InputDecoration(
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  isDense: true,
                  hintText: 'https://novashop-api-952u.onrender.com',
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                '💡 Khi không cắm cáp USB (hoặc dùng 4G), hãy chọn Render Cloud để app kết nối online mọi lúc mọi nơi!',
                style: TextStyle(fontSize: 11, color: Color(0xFF8F90A6), height: 1.3),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () {
                ApiConfig.resetBaseUrl();
                Navigator.pop(ctx);
                _checkBackendStatus();
              },
              child: const Text('Mặc định', style: TextStyle(color: Colors.grey)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              onPressed: () {
                if (controller.text.trim().isNotEmpty) {
                  ApiConfig.setBaseUrl(controller.text.trim());
                }
                Navigator.pop(ctx);
                _checkBackendStatus();
              },
              child: const Text('Lưu & Kết nối', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
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
      title: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(5),
            decoration: BoxDecoration(
              color: AppColors.surfaceAlt,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.border, width: 0.8),
            ),
            child: const Icon(Icons.shopping_bag_rounded, color: AppColors.primary, size: 20),
          ),
          const SizedBox(width: 8),
          RichText(
            text: const TextSpan(
              children: [
                TextSpan(
                  text: 'Nova',
                  style: TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 19,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -0.5,
                  ),
                ),
                TextSpan(
                  text: 'Shop',
                  style: TextStyle(
                    color: AppColors.primary,
                    fontSize: 19,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -0.5,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      centerTitle: true,
      actions: [
        IconButton(
          icon: const Icon(Icons.help_outline_rounded, color: AppColors.textSecondary, size: 22),
          onPressed: () {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Trung tâm hỗ trợ ShopNova: 1900 1234 (Miễn phí 24/7)')),
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
            _buildLoginForm(),
            _buildSocialLogin(),
            _buildFooter(),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Chào mừng trở lại! 👋',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
          ),
          const SizedBox(height: 4),
          const Text(
            'Đăng nhập tài khoản ShopNova để nhận ưu đãi và mua sắm không giới hạn',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 13, height: 1.4),
          ),
          const SizedBox(height: 12),
          // Backend Connection Indicator
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: _backendOnline ? const Color(0xFFF0FDF4) : const Color(0xFFFFFBEB),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: _backendOnline ? const Color(0xFFBBF7D0) : const Color(0xFFFDE68A),
              ),
            ),
            child: Row(
              children: [
                Icon(
                  _backendOnline ? Icons.check_circle_rounded : Icons.warning_amber_rounded,
                  color: _backendOnline ? const Color(0xFF16A34A) : const Color(0xFFD97706),
                  size: 18,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    _isCheckingBackend ? 'Đang kiểm tra kết nối máy chủ...' : _backendStatusText,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: _backendOnline ? const Color(0xFF15803D) : const Color(0xFFB45309),
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.settings_outlined, size: 18, color: Color(0xFF555770)),
                  tooltip: 'Đổi máy chủ',
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                  onPressed: _showChangeServerDialog,
                ),
                const SizedBox(width: 8),
                IconButton(
                  icon: const Icon(Icons.refresh_rounded, size: 18, color: Color(0xFF555770)),
                  tooltip: 'Kiểm tra lại',
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                  onPressed: _checkBackendStatus,
                ),
              ],
            ),
          ),
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
          color: AppColors.surfaceAlt,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.border, width: 0.8),
        ),
        child: Row(
          children: [
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
                    const Text('Đăng Nhập', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.w700, fontSize: 15)),
                    const SizedBox(width: 6),
                    Container(width: 6, height: 6, decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle)),
                  ],
                ),
              ),
            ),
            Expanded(
              child: InkWell(
                borderRadius: BorderRadius.circular(10),
                onTap: () {
                  Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const RegisterScreen()));
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 9),
                  child: const Center(
                    child: Text('Đăng Ký', style: TextStyle(color: AppColors.textSecondary, fontWeight: FontWeight.w700, fontSize: 15)),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLoginForm() {
    final auth = AuthService();
    return AnimatedBuilder(
      animation: auth,
      builder: (context, _) {
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
              const Text('Tên đăng nhập hoặc Số điện thoại', style: TextStyle(color: AppColors.textPrimary, fontSize: 12, fontWeight: FontWeight.bold)),
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
                    const Icon(Icons.person_outline_rounded, color: AppColors.textSecondary, size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: _usernameController,
                        decoration: const InputDecoration(
                          hintText: 'Nhập tên đăng nhập hoặc số điện thoại',
                          hintStyle: TextStyle(color: Color(0xFF8F90A6), fontSize: 13),
                          border: InputBorder.none,
                          isDense: true,
                        ),
                      ),
                    ),
                    if (_usernameController.text.isNotEmpty)
                      GestureDetector(
                        onTap: () {
                          setState(() {
                            _usernameController.clear();
                          });
                        },
                        child: const Icon(Icons.cancel_rounded, color: Color(0xFF8F90A6), size: 18),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Mật khẩu', style: TextStyle(color: AppColors.textPrimary, fontSize: 12, fontWeight: FontWeight.bold)),
                  Text('Quên mật khẩu?', style: TextStyle(color: AppColors.primary, fontSize: 12, fontWeight: FontWeight.bold)),
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
                    const Icon(Icons.lock_outline_rounded, color: AppColors.textSecondary, size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: _passwordController,
                        obscureText: _obscurePassword,
                        style: const TextStyle(color: AppColors.textPrimary),
                        decoration: const InputDecoration(
                          hintText: 'Nhập mật khẩu ShopNova',
                          hintStyle: TextStyle(color: AppColors.textSecondary, fontSize: 13),
                          border: InputBorder.none,
                          isDense: true,
                        ),
                      ),
                    ),
                    GestureDetector(
                      onTap: () {
                        setState(() {
                          _obscurePassword = !_obscurePassword;
                        });
                      },
                      child: Icon(
                        _obscurePassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                        color: AppColors.textSecondary, size: 20
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      SizedBox(
                        width: 24, height: 24,
                        child: Checkbox(
                          value: _rememberMe,
                          onChanged: (val) {
                            setState(() { _rememberMe = val ?? true; });
                          },
                          activeColor: AppColors.primary,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                        ),
                      ),
                      const SizedBox(width: 6),
                      const Text('Ghi nhớ đăng nhập', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                    ],
                  ),
                  Row(
                    children: const [
                      Icon(Icons.sms_outlined, color: AppColors.primary, size: 16),
                      SizedBox(width: 4),
                      Text('Đăng nhập OTP / Zalo', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 12)),
                    ],
                  )
                ],
              ),
              const SizedBox(height: 18),
              Container(
                width: double.infinity,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AppColors.primary, AppColors.earth],
                  ),
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
                  onPressed: auth.isLoading ? null : _handleLogin,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.transparent,
                    shadowColor: Colors.transparent,
                    foregroundColor: Colors.white,
                    minimumSize: const Size(double.infinity, 50),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: auth.isLoading
                      ? const SizedBox(
                          height: 22,
                          width: 22,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.5,
                            valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                          ),
                        )
                      : Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: const [
                            Text('Đăng Nhập Ngay', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                            SizedBox(width: 8),
                            Icon(Icons.arrow_forward_rounded, size: 20),
                          ],
                        ),
                ),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.surfaceAlt,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.border),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 38, height: 38,
                          decoration: BoxDecoration(
                            color: AppColors.surface,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: AppColors.border),
                            boxShadow: const [BoxShadow(color: Color(0x06000000), blurRadius: 4)],
                          ),
                          child: const Icon(Icons.fingerprint_rounded, color: AppColors.primary, size: 22),
                        ),
                        const SizedBox(width: 12),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: const [
                            Text('Face ID / Vân tay', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.textPrimary)),
                            Text('Đăng nhập tức thì chỉ 1 chạm', style: TextStyle(color: AppColors.textSecondary, fontSize: 11)),
                          ],
                        )
                      ],
                    ),
                    ElevatedButton(
                      onPressed: () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Đã kích hoạt đăng nhập nhanh bằng Sinh trắc học (Face ID / Vân tay)!'),
                            backgroundColor: AppColors.primary,
                          ),
                        );
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.surface,
                        foregroundColor: AppColors.primary,
                        elevation: 0,
                        minimumSize: const Size(0, 32),
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                          side: const BorderSide(color: AppColors.border),
                        ),
                      ),
                      child: const Text('Kích hoạt', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                    )
                  ],
                ),
              )
            ],
          ),
        );
      },
    );
  }

  Widget _buildSocialLogin() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(child: Container(height: 1, color: const Color(0xFFEEEEF0))),
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 12),
                child: Text('Hoặc đăng nhập nhanh bằng', style: TextStyle(color: Color(0xFF8F90A6), fontSize: 12)),
              ),
              Expanded(child: Container(height: 1, color: const Color(0xFFEEEEF0))),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _buildSocialButton(
                  child: const Text('G', style: TextStyle(color: Color(0xFFEA4335), fontWeight: FontWeight.w900, fontSize: 20)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildSocialButton(
                  child: const Icon(Icons.apple_rounded, color: Colors.black, size: 24),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildSocialButton(
                  child: const Icon(Icons.facebook_rounded, color: Color(0xFF1877F2), size: 24),
                ),
              ),
            ],
          )
        ],
      ),
    );
  }

  Widget _buildSocialButton({required Widget child}) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFEEEEF0)),
        boxShadow: const [
          BoxShadow(color: Color(0x06000000), blurRadius: 6, offset: Offset(0, 2))
        ],
      ),
      child: Center(child: child),
    );
  }

  Widget _buildFooter() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text('Bạn chưa có tài khoản? ', style: TextStyle(color: Color(0xFF555770), fontSize: 13)),
              GestureDetector(
                onTap: () {
                  Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const RegisterScreen()));
                },
                child: const Text('Đăng ký ngay', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 14)),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFF0F1F5),
              borderRadius: BorderRadius.circular(12),
            ),
            child: RichText(
              textAlign: TextAlign.center,
              text: const TextSpan(
                style: TextStyle(color: Color(0xFF8F90A6), fontSize: 11, height: 1.4),
                children: [
                  TextSpan(text: 'Bằng cách đăng nhập, bạn đồng ý với '),
                  TextSpan(text: 'Điều khoản dịch vụ', style: TextStyle(color: Color(0xFF1E2022), fontWeight: FontWeight.bold)),
                  TextSpan(text: ' và '),
                  TextSpan(text: 'Chính sách bảo mật', style: TextStyle(color: Color(0xFF1E2022), fontWeight: FontWeight.bold)),
                  TextSpan(text: ' của ShopNova.'),
                ],
              ),
            ),
          )
        ],
      ),
    );
  }
}
