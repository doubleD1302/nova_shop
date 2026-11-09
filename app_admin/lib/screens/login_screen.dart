import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../config/api_config.dart';
import 'admin_dashboard_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _usernameController = TextEditingController(text: 'demo_admin_guest');
  final _passwordController = TextEditingController(text: 'DemoAdmin2026');
  bool _isLoading = false;
  bool _showPassword = false;
  String? _errorMessage;
  String _demoUsername = 'demo_admin_guest';
  String _demoPassword = 'DemoAdmin2026';
  String _serverStatus = 'Đang kết nối máy chủ...';

  @override
  void initState() {
    super.initState();
    _initBackendAndDemo();
  }

  Future<void> _initBackendAndDemo() async {
    final detected = await ApiConfig.autoDetectBaseUrl();
    final accounts = await AuthService().fetchDemoAccounts();
    if (!mounted) return;
    setState(() {
      _serverStatus = 'Máy chủ: $detected';
      for (final acc in accounts) {
        if (acc['role'] == 'admin') {
          _demoUsername = acc['username']?.toString() ?? _demoUsername;
          _demoPassword = acc['password']?.toString() ?? _demoPassword;
          _usernameController.text = _demoUsername;
          _passwordController.text = _demoPassword;
          break;
        }
      }
    });
  }

  Future<void> _handleLogin() async {
    final username = _usernameController.text.trim();
    final password = _passwordController.text;

    if (username.isEmpty || password.isEmpty) {
      setState(() => _errorMessage = 'Vui lòng nhập tài khoản và mật khẩu quản trị.');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final res = await AuthService().login(username, password);

    if (!mounted) return;

    if (res.success) {
      final user = AuthService().currentUser;
      if (user != null && user.role != 'admin') {
        await AuthService().logout();
        setState(() {
          _isLoading = false;
          _errorMessage = 'Tài khoản này có vai trò "${user.role}", không có quyền Quản trị viên (Admin). Vui lòng đăng nhập đúng tài khoản Admin.';
        });
        return;
      }

      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const AdminDashboardScreen()),
      );
    } else {
      setState(() {
        _isLoading = false;
        _errorMessage = res.message.isNotEmpty ? res.message : 'Tài khoản hoặc mật khẩu không chính xác.';
      });
    }
  }

  void _showServerDialog() {
    final ctrl = TextEditingController(text: ApiConfig.baseUrl);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cấu hình máy chủ API', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Wrap(
              spacing: 6,
              children: [
                ActionChip(
                  label: const Text('USB 127.0.0.1', style: TextStyle(fontSize: 11)),
                  onPressed: () => ctrl.text = ApiConfig.usbLoopbackUrl,
                ),
                ActionChip(
                  label: const Text('LAN Wi-Fi', style: TextStyle(fontSize: 11)),
                  onPressed: () => ctrl.text = ApiConfig.lanHostUrl,
                ),
                ActionChip(
                  label: const Text('Render Cloud', style: TextStyle(fontSize: 11)),
                  onPressed: () => ctrl.text = ApiConfig.productionUrl,
                ),
              ],
            ),
            const SizedBox(height: 10),
            TextField(
              controller: ctrl,
              decoration: const InputDecoration(border: OutlineInputBorder(), isDense: true),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              ApiConfig.resetBaseUrl();
              Navigator.pop(ctx);
              _initBackendAndDemo();
            },
            child: const Text('Tự động dò'),
          ),
          ElevatedButton(
            onPressed: () {
              if (ctrl.text.trim().isNotEmpty) {
                ApiConfig.setBaseUrl(ctrl.text.trim());
              }
              Navigator.pop(ctx);
              _initBackendAndDemo();
            },
            child: const Text('Lưu'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    const primaryColor = Color(0xFFC62828);

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 28),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFFC62828), Color(0xFFB71C1C)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: primaryColor.withValues(alpha: 0.3),
                        blurRadius: 12,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: const Center(
                    child: Icon(Icons.shield_rounded, color: Colors.white, size: 44),
                  ),
                ),
                const SizedBox(height: 18),
                const Text(
                  'ShopNova Admin',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF212121),
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Cổng Điều Hành Quản Trị Hệ Thống (Dữ liệu thật)',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 12, color: Color(0xFF757575)),
                ),
                const SizedBox(height: 8),
                InkWell(
                  onTap: _showServerDialog,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.dns_outlined, size: 14, color: primaryColor),
                      const SizedBox(width: 4),
                      Text(_serverStatus, style: const TextStyle(fontSize: 11, color: primaryColor, fontWeight: FontWeight.w600)),
                      const SizedBox(width: 4),
                      const Icon(Icons.settings_outlined, size: 14, color: primaryColor),
                    ],
                  ),
                ),
                const SizedBox(height: 22),

                if (_errorMessage != null)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    margin: const EdgeInsets.only(bottom: 18),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFEBEE),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFFFCDD2)),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.error_outline, color: primaryColor, size: 20),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            _errorMessage!,
                            style: const TextStyle(color: primaryColor, fontSize: 12),
                          ),
                        ),
                      ],
                    ),
                  ),

                TextField(
                  controller: _usernameController,
                  decoration: InputDecoration(
                    labelText: 'Tài khoản quản trị viên *',
                    prefixIcon: const Icon(Icons.person_outline),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
                const SizedBox(height: 14),

                TextField(
                  controller: _passwordController,
                  obscureText: !_showPassword,
                  decoration: InputDecoration(
                    labelText: 'Mật khẩu *',
                    prefixIcon: const Icon(Icons.lock_outline),
                    suffixIcon: IconButton(
                      icon: Icon(_showPassword ? Icons.visibility_off : Icons.visibility),
                      onPressed: () => setState(() => _showPassword = !_showPassword),
                    ),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
                const SizedBox(height: 22),

                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
                    onPressed: _isLoading ? null : _handleLogin,
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
                            'ĐĂNG NHẬP QUẢN TRỊ THỰC TẾ',
                            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                          ),
                  ),
                ),
                const SizedBox(height: 20),

                // GỢI Ý TÀI KHOẢN THỰC TẾ ĐỒNG BỘ TỪ /api/v1/auth/demo-accounts
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF5F5F5),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFFE0E0E0)),
                  ),
                  child: Column(
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.verified_user_rounded, size: 16, color: Colors.green),
                          SizedBox(width: 6),
                          Text('Tài khoản Quản Trị Viên thực tế trên Database:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11)),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              '$_demoUsername / $_demoPassword',
                              style: const TextStyle(fontFamily: 'monospace', fontSize: 11.5, fontWeight: FontWeight.bold),
                            ),
                          ),
                          TextButton(
                            onPressed: () {
                              _usernameController.text = _demoUsername;
                              _passwordController.text = _demoPassword;
                            },
                            child: const Text('Tự động điền', style: TextStyle(fontSize: 11)),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
