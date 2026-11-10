import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../config/api_config.dart';
import '../theme/admin_theme.dart';
import '../widgets/nova_logo.dart';
import 'admin_dashboard_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoading = false;
  bool _showPassword = false;
  String? _errorMessage;
  String _serverStatus = 'Đang kết nối máy chủ...';

  @override
  void initState() {
    super.initState();
    _initBackend();
  }

  @override
  void dispose() {
    _usernameController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _initBackend() async {
    final detected = await ApiConfig.autoDetectBaseUrl();
    if (!mounted) return;
    setState(() {
      _serverStatus = 'Máy chủ: $detected';
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
          _errorMessage =
              'Tài khoản này có vai trò "${user.role}", không có quyền Quản trị viên (Admin). Vui lòng đăng nhập đúng tài khoản Admin.';
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
        _errorMessage =
            res.message.isNotEmpty ? res.message : 'Tài khoản hoặc mật khẩu không chính xác.';
      });
    }
  }

  void _showServerDialog() {
    final ctrl = TextEditingController(text: ApiConfig.baseUrl);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AdminTheme.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text(
          'Cấu hình máy chủ API',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AdminTheme.textPrimary),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                ActionChip(
                  backgroundColor: AdminTheme.surfaceSubtle,
                  label: const Text('USB 127.0.0.1', style: TextStyle(fontSize: 11, color: AdminTheme.textPrimary)),
                  onPressed: () => ctrl.text = ApiConfig.usbLoopbackUrl,
                ),
                ActionChip(
                  backgroundColor: AdminTheme.surfaceSubtle,
                  label: const Text('LAN Wi-Fi', style: TextStyle(fontSize: 11, color: AdminTheme.textPrimary)),
                  onPressed: () => ctrl.text = ApiConfig.lanHostUrl,
                ),
                ActionChip(
                  backgroundColor: AdminTheme.surfaceSubtle,
                  label: const Text('Render Cloud', style: TextStyle(fontSize: 11, color: AdminTheme.textPrimary)),
                  onPressed: () => ctrl.text = ApiConfig.productionUrl,
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              controller: ctrl,
              style: const TextStyle(fontSize: 13, color: AdminTheme.textPrimary),
              decoration: const InputDecoration(isDense: true),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              ApiConfig.resetBaseUrl();
              Navigator.pop(ctx);
              _initBackend();
            },
            child: const Text('Tự động dò', style: TextStyle(color: AdminTheme.textSecondary)),
          ),
          ElevatedButton(
            onPressed: () {
              if (ctrl.text.trim().isNotEmpty) {
                ApiConfig.setBaseUrl(ctrl.text.trim());
              }
              Navigator.pop(ctx);
              _initBackend();
            },
            child: const Text('Lưu'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AdminTheme.background,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Card(
                color: AdminTheme.card,
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(20),
                  side: const BorderSide(color: AdminTheme.border, width: 1),
                ),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 28),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      // Official NovaShop Admin Logo
                      const NovaLogo(size: 68, fontSize: 24, subtitle: 'Cổng Quản Trị'),
                      const SizedBox(height: 12),

                      // Brand Name
                      const Text(
                        'ShopNova Admin',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: AdminTheme.primaryHover,
                          letterSpacing: -0.2,
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Cổng Điều Hành Quản Trị Hệ Thống',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AdminTheme.textPrimary),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Quản trị toàn diện người dùng, gian hàng, sản phẩm và dòng tiền sàn',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 12, color: AdminTheme.textSecondary),
                      ),
                      const SizedBox(height: 10),

                      // Server Status Chip
                      InkWell(
                        onTap: _showServerDialog,
                        borderRadius: BorderRadius.circular(20),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: AdminTheme.surfaceSubtle,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: AdminTheme.border),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.dns_outlined, size: 13, color: AdminTheme.primary),
                              const SizedBox(width: 5),
                              Text(
                                _serverStatus,
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: AdminTheme.primary,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              const SizedBox(width: 4),
                              const Icon(Icons.tune_rounded, size: 12, color: AdminTheme.primary),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),

                      if (_errorMessage != null)
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(12),
                          margin: const EdgeInsets.only(bottom: 16),
                          decoration: BoxDecoration(
                            color: AdminTheme.dangerBg,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: AdminTheme.danger.withValues(alpha: 0.3)),
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Icon(Icons.error_outline, color: AdminTheme.danger, size: 18),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  _errorMessage!,
                                  style: const TextStyle(color: AdminTheme.danger, fontSize: 12),
                                ),
                              ),
                            ],
                          ),
                        ),

                      TextField(
                        controller: _usernameController,
                        style: const TextStyle(fontSize: 13, color: AdminTheme.textPrimary),
                        decoration: const InputDecoration(
                          labelText: 'Tài khoản quản trị viên *',
                          hintText: 'Nhập tên đăng nhập quản trị',
                          prefixIcon: Icon(Icons.person_outline, size: 20, color: AdminTheme.textSecondary),
                        ),
                      ),
                      const SizedBox(height: 14),

                      TextField(
                        controller: _passwordController,
                        obscureText: !_showPassword,
                        style: const TextStyle(fontSize: 13, color: AdminTheme.textPrimary),
                        decoration: InputDecoration(
                          labelText: 'Mật khẩu *',
                          hintText: 'Nhập mật khẩu quản trị',
                          prefixIcon: const Icon(Icons.lock_outline, size: 20, color: AdminTheme.textSecondary),
                          suffixIcon: IconButton(
                            icon: Icon(
                              _showPassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                              size: 20,
                              color: AdminTheme.textSecondary,
                            ),
                            onPressed: () => setState(() => _showPassword = !_showPassword),
                          ),
                        ),
                      ),
                      const SizedBox(height: 22),

                      SizedBox(
                        width: double.infinity,
                        height: 48,
                        child: ElevatedButton(
                          onPressed: _isLoading ? null : _handleLogin,
                          child: _isLoading
                              ? const SizedBox(
                                  width: 22,
                                  height: 22,
                                  child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                                )
                              : const Text(
                                  'ĐĂNG NHẬP HỆ THỐNG',
                                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, letterSpacing: 0.3),
                                ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
