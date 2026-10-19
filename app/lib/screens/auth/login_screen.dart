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
    final isOnline = await AuthService().checkHealth();
    if (!mounted) return;
    setState(() {
      _isCheckingBackend = false;
      _backendOnline = isOnline;
      _backendStatusText = isOnline
          ? 'Backend Online: ${ApiConfig.baseUrl}'
          : 'Chưa kết nối Backend: ${ApiConfig.baseUrl}';
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

    final success = await AuthService().login(username, password);
    if (!mounted) return;

    if (success) {
      final user = AuthService().currentUser;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Đăng nhập thành công! Chào ${user?.fullName ?? user?.username}'),
          backgroundColor: Colors.green,
        ),
      );
      Navigator.pop(context);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(AuthService().lastError ?? 'Đăng nhập không thành công.'),
          backgroundColor: Colors.red,
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
          title: const Text('Cấu hình Backend API'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Chọn hoặc nhập URL Backend máy chủ:',
                style: TextStyle(fontSize: 13),
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  ActionChip(
                    avatar: const Icon(Icons.cloud, size: 16, color: Colors.green),
                    label: const Text('Render Cloud', style: TextStyle(fontSize: 11)),
                    onPressed: () {
                      setDialogState(() {
                        controller.text = ApiConfig.productionUrl;
                      });
                    },
                  ),
                  ActionChip(
                    avatar: const Icon(Icons.wifi, size: 16, color: Colors.blue),
                    label: const Text('Wi-Fi: 192.168.1.11', style: TextStyle(fontSize: 11)),
                    onPressed: () {
                      setDialogState(() {
                        controller.text = ApiConfig.lanHostUrl;
                      });
                    },
                  ),
                  ActionChip(
                    avatar: const Icon(Icons.usb, size: 16, color: Colors.orange),
                    label: const Text('USB: 127.0.0.1', style: TextStyle(fontSize: 11)),
                    onPressed: () {
                      setDialogState(() {
                        controller.text = ApiConfig.usbLoopbackUrl;
                      });
                    },
                  ),
                  ActionChip(
                    avatar: const Icon(Icons.computer, size: 16, color: Colors.grey),
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
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                  isDense: true,
                  hintText: 'https://novashop-api-952u.onrender.com',
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                '💡 Khi không cắm cáp USB (hoặc dùng 4G), hãy chọn Render Cloud để app kết nối online mọi lúc mọi nơi!',
                style: TextStyle(fontSize: 11, color: Colors.grey, height: 1.3),
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
              child: const Text('Mặc định'),
            ),
            ElevatedButton(
              onPressed: () {
                if (controller.text.trim().isNotEmpty) {
                  ApiConfig.setBaseUrl(controller.text.trim());
                }
                Navigator.pop(ctx);
                _checkBackendStatus();
              },
              child: const Text('Lưu & Kết nối'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget _buildAppBar() {
    return Container(
      padding: EdgeInsets.only(top: MediaQuery.of(context).padding.top),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.9),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
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
                  _buildTabs(),
                  _buildLoginForm(),
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
          const Text(
            'Chào mừng trở lại! 👋',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.black87),
          ),
          const SizedBox(height: 4),
          const Text(
            'Đăng nhập tài khoản ShopNova để nhận ưu đãi và mua sắm không giới hạn',
            style: TextStyle(color: Colors.grey, fontSize: 14, height: 1.4),
          ),
          const SizedBox(height: 12),
          // Backend Connection Indicator
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: _backendOnline ? Colors.green.shade50 : Colors.amber.shade50,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: _backendOnline ? Colors.green.shade200 : Colors.amber.shade300,
              ),
            ),
            child: Row(
              children: [
                Icon(
                  _backendOnline ? Icons.check_circle : Icons.warning_amber_rounded,
                  color: _backendOnline ? Colors.green : Colors.amber.shade800,
                  size: 18,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    _isCheckingBackend ? 'Đang kiểm tra kết nối máy chủ...' : _backendStatusText,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: _backendOnline ? Colors.green.shade800 : Colors.amber.shade900,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.settings, size: 18),
                  tooltip: 'Đổi máy chủ',
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                  onPressed: _showChangeServerDialog,
                ),
                const SizedBox(width: 8),
                IconButton(
                  icon: const Icon(Icons.refresh, size: 18),
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
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Container(
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(
          color: Colors.blue[50]?.withOpacity(0.5),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Expanded(
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(8),
                  boxShadow: [
                    BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 2, offset: const Offset(0, 1))
                  ],
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text('Đăng Nhập', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 16)),
                    const SizedBox(width: 6),
                    Container(width: 6, height: 6, decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle)),
                  ],
                ),
              ),
            ),
            Expanded(
              child: GestureDetector(
                onTap: () {
                  Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const RegisterScreen()));
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: const Center(
                    child: Text('Đăng Ký', style: TextStyle(color: Colors.grey, fontWeight: FontWeight.bold, fontSize: 16)),
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
          margin: const EdgeInsets.symmetric(horizontal: 16),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 8, offset: const Offset(0, 2))
            ]
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Tên đăng nhập hoặc Số điện thoại', style: TextStyle(color: Colors.black54, fontSize: 12, fontWeight: FontWeight.bold)),
              const SizedBox(height: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.grey[100],
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.person_outline, color: Colors.grey, size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: _usernameController,
                        decoration: const InputDecoration(
                          hintText: 'Nhập tên đăng nhập hoặc số điện thoại',
                          hintStyle: TextStyle(color: Colors.grey, fontSize: 13),
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
                        child: const Icon(Icons.cancel, color: Colors.grey, size: 18),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Mật khẩu', style: TextStyle(color: Colors.black54, fontSize: 12, fontWeight: FontWeight.bold)),
                  Text('Quên mật khẩu?', style: TextStyle(color: AppColors.primary, fontSize: 12, fontWeight: FontWeight.bold)),
                ],
              ),
              const SizedBox(height: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.grey[100],
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.lock_outline, color: Colors.grey, size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: _passwordController,
                        obscureText: _obscurePassword,
                        decoration: const InputDecoration(
                          hintText: 'Nhập mật khẩu ShopNova',
                          hintStyle: TextStyle(color: Colors.grey, fontSize: 13),
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
                        _obscurePassword ? Icons.visibility_off : Icons.visibility,
                        color: Colors.grey, size: 20
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
                      const SizedBox(width: 4),
                      const Text('Ghi nhớ đăng nhập', style: TextStyle(color: Colors.grey, fontSize: 12)),
                    ],
                  ),
                  Row(
                    children: [
                      const Icon(Icons.sms, color: Colors.green, size: 16),
                      const SizedBox(width: 4),
                      const Text('Đăng nhập OTP / Zalo', style: TextStyle(color: Colors.green, fontWeight: FontWeight.bold, fontSize: 12)),
                    ],
                  )
                ],
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: auth.isLoading ? null : _handleLogin,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  minimumSize: const Size(double.infinity, 50),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  elevation: 2,
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
                    : const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text('Đăng Nhập Ngay', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                          SizedBox(width: 8),
                          Icon(Icons.arrow_forward, size: 20),
                        ],
                      ),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.grey[50],
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 40, height: 40,
                          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8), boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 2)]),
                          child: const Icon(Icons.fingerprint, color: AppColors.primary),
                        ),
                        const SizedBox(width: 12),
                        const Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Face ID / Vân tay', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                            Text('Đăng nhập tức thì chỉ 1 chạm', style: TextStyle(color: Colors.grey, fontSize: 11)),
                          ],
                        )
                      ],
                    ),
                    ElevatedButton(
                      onPressed: () {},
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.red[50],
                        foregroundColor: AppColors.primary,
                        elevation: 0,
                        minimumSize: const Size(0, 32),
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))
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
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(child: Container(height: 1, color: Colors.grey[300])),
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 12),
                child: Text('Hoặc đăng nhập nhanh bằng', style: TextStyle(color: Colors.grey, fontSize: 12)),
              ),
              Expanded(child: Container(height: 1, color: Colors.grey[300])),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _buildSocialButton(
                  child: const Text('G', style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold, fontSize: 20)),
                )
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildSocialButton(
                  child: const Icon(Icons.apple, color: Colors.black, size: 24),
                )
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildSocialButton(
                  child: const Icon(Icons.facebook, color: Colors.blue, size: 24),
                )
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
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 4, offset: const Offset(0, 2))
        ]
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
              const Text('Bạn chưa có tài khoản? ', style: TextStyle(color: Colors.grey, fontSize: 13)),
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
              color: Colors.grey[100],
              borderRadius: BorderRadius.circular(12),
            ),
            child: RichText(
              textAlign: TextAlign.center,
              text: const TextSpan(
                style: TextStyle(color: Colors.grey, fontSize: 11, height: 1.4),
                children: [
                  TextSpan(text: 'Bằng cách đăng nhập, bạn đồng ý với '),
                  TextSpan(text: 'Điều khoản dịch vụ', style: TextStyle(color: Colors.black87, fontWeight: FontWeight.bold)),
                  TextSpan(text: ' và '),
                  TextSpan(text: 'Chính sách bảo mật', style: TextStyle(color: Colors.black87, fontWeight: FontWeight.bold)),
                  TextSpan(text: ' của ShopNova.'),
                ]
              ),
            ),
          )
        ],
      ),
    );
  }
}
