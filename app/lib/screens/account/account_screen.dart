import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shopnova/screens/orders/orders_screen.dart';
import 'package:shopnova/screens/auth/login_screen.dart' as shopnova_auth;
import 'package:shopnova/screens/account/addresses_screen.dart';
import 'package:shopnova/screens/account/favorites_screen.dart';
import 'package:shopnova/screens/seller/seller_hub_screen.dart';
import 'package:shopnova/screens/wallet/deposit_screen.dart';
import 'package:shopnova/services/auth_service.dart';
import 'package:shopnova/services/cart_service.dart';
import 'package:shopnova/services/api_config.dart';

class AccountScreen extends StatefulWidget {
  const AccountScreen({super.key});

  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> {
  final Color primaryColor = const Color(0xFFEE4D2D);
  Map<String, dynamic>? _backendStats;
  bool _notificationEnabled = true;
  bool _twoFactorEnabled = false;

  String _receiverName = '';
  String _receiverPhone = '';
  String _receiverAddress = 'Số 123 Đường Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh';

  @override
  void initState() {
    super.initState();
    AuthService().addListener(_onAuthChanged);
    _loadUserStats();
  }

  @override
  void dispose() {
    AuthService().removeListener(_onAuthChanged);
    super.dispose();
  }

  void _onAuthChanged() {
    if (mounted) {
      _loadUserStats();
      CartService().fetchCart();
      setState(() {});
    }
  }

  Future<void> _loadUserStats() async {
    final auth = AuthService();
    if (auth.isAuthenticated) {
      final stats = await auth.fetchUserStats();
      if (mounted && stats != null) {
        setState(() {
          _backendStats = stats;
        });
      }
    } else {
      if (mounted) {
        setState(() {
          _backendStats = null;
        });
      }
    }
  }

  String _formatVnd(num amount) {
    final str = amount.toInt().toString();
    final reg = RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))');
    return '${str.replaceAllMapped(reg, (m) => '${m[1]}.')} ₫';
  }

  void _copyToClipboard(String code) {
    Clipboard.setData(ClipboardData(text: code));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Đã sao chép mã voucher "$code" vào bộ nhớ tạm!'),
        backgroundColor: const Color(0xFF1E2022),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  void _showEditProfileDialog() {
    final auth = AuthService();
    final user = auth.currentUser;
    if (user == null) return;

    final nameController = TextEditingController(text: user.fullName);
    final phoneController = TextEditingController(text: user.phone ?? '');
    final emailController = TextEditingController(text: user.email ?? '');
    final avatarController = TextEditingController(text: user.avatarUrl ?? '');
    bool isSaving = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setModalState) {
            return Padding(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 20,
                bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Chỉnh sửa hồ sơ cá nhân',
                          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                        ),
                        IconButton(
                          icon: const Icon(Icons.close_rounded),
                          onPressed: () => Navigator.pop(ctx),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    TextField(
                      controller: nameController,
                      decoration: InputDecoration(
                        labelText: 'Họ và tên',
                        prefixIcon: const Icon(Icons.person_outline_rounded),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: phoneController,
                      keyboardType: TextInputType.phone,
                      decoration: InputDecoration(
                        labelText: 'Số điện thoại',
                        prefixIcon: const Icon(Icons.phone_outlined),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: emailController,
                      keyboardType: TextInputType.emailAddress,
                      decoration: InputDecoration(
                        labelText: 'Email',
                        prefixIcon: const Icon(Icons.email_outlined),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: avatarController,
                      decoration: InputDecoration(
                        labelText: 'URL ảnh đại diện (Tùy chọn)',
                        prefixIcon: const Icon(Icons.image_outlined),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                    const SizedBox(height: 20),
                    Container(
                      width: double.infinity,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFFEE4D2D), Color(0xFFFF5224)],
                        ),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: ElevatedButton(
                        onPressed: isSaving
                            ? null
                            : () async {
                                final name = nameController.text.trim();
                                if (name.isEmpty) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(content: Text('Họ và tên không được để trống.')),
                                  );
                                  return;
                                }

                                setModalState(() => isSaving = true);
                                final ok = await auth.updateProfile(
                                  fullName: name,
                                  phone: phoneController.text.trim(),
                                  email: emailController.text.trim(),
                                  avatarUrl: avatarController.text.trim().isNotEmpty
                                      ? avatarController.text.trim()
                                      : null,
                                );
                                setModalState(() => isSaving = false);

                                if (mounted) {
                                  Navigator.pop(ctx);
                                  if (ok) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(
                                        content: Text('Cập nhật hồ sơ tài khoản thành công!'),
                                        backgroundColor: Color(0xFF00BFA5),
                                      ),
                                    );
                                    setState(() {});
                                  } else {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        content: Text(auth.lastError ?? 'Cập nhật hồ sơ thất bại.'),
                                        backgroundColor: const Color(0xFFD0011B),
                                      ),
                                    );
                                  }
                                }
                              },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.transparent,
                          shadowColor: Colors.transparent,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        child: isSaving
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                              )
                            : const Text('Lưu thay đổi', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  void _showChangePasswordDialog() {
    final auth = AuthService();
    if (!auth.isAuthenticated) return;

    final currentPassController = TextEditingController();
    final newPassController = TextEditingController();
    final confirmPassController = TextEditingController();
    bool obscureCurrent = true;
    bool obscureNew = true;
    bool isSaving = false;

    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setDialogState) {
            return AlertDialog(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              title: const Row(
                children: [
                  Icon(Icons.lock_reset_rounded, color: Color(0xFFEE4D2D)),
                  SizedBox(width: 8),
                  Text('Đổi mật khẩu', style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
                ],
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextField(
                      controller: currentPassController,
                      obscureText: obscureCurrent,
                      decoration: InputDecoration(
                        labelText: 'Mật khẩu hiện tại',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                        suffixIcon: IconButton(
                          icon: Icon(obscureCurrent ? Icons.visibility_off_outlined : Icons.visibility_outlined, size: 20),
                          onPressed: () => setDialogState(() => obscureCurrent = !obscureCurrent),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: newPassController,
                      obscureText: obscureNew,
                      decoration: InputDecoration(
                        labelText: 'Mật khẩu mới (ít nhất 6 ký tự)',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                        suffixIcon: IconButton(
                          icon: Icon(obscureNew ? Icons.visibility_off_outlined : Icons.visibility_outlined, size: 20),
                          onPressed: () => setDialogState(() => obscureNew = !obscureNew),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: confirmPassController,
                      obscureText: obscureNew,
                      decoration: InputDecoration(
                        labelText: 'Xác nhận mật khẩu mới',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: isSaving ? null : () => Navigator.pop(ctx),
                  child: const Text('Hủy', style: TextStyle(color: Colors.grey)),
                ),
                ElevatedButton(
                  onPressed: isSaving
                      ? null
                      : () async {
                          final currentP = currentPassController.text;
                          final newP = newPassController.text;
                          final confirmP = confirmPassController.text;

                          if (currentP.isEmpty) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Vui lòng nhập mật khẩu hiện tại.')),
                            );
                            return;
                          }
                          if (newP.length < 6) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Mật khẩu mới phải có từ 6 ký tự trở lên.')),
                            );
                            return;
                          }
                          if (newP != confirmP) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Xác nhận mật khẩu mới không trùng khớp.')),
                            );
                            return;
                          }

                          setDialogState(() => isSaving = true);
                          final ok = await auth.changePassword(
                            currentPassword: currentP,
                            newPassword: newP,
                          );
                          setDialogState(() => isSaving = false);

                          if (mounted) {
                            Navigator.pop(ctx);
                            if (ok) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Đổi mật khẩu thành công!'),
                                  backgroundColor: Color(0xFF00BFA5),
                                ),
                              );
                            } else {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(auth.lastError ?? 'Đổi mật khẩu thất bại.'),
                                  backgroundColor: const Color(0xFFD0011B),
                                ),
                              );
                            }
                          }
                        },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: primaryColor,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  child: isSaving
                      ? const SizedBox(
                          height: 16,
                          width: 16,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                        )
                      : const Text('Xác nhận'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF6F7F9),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: const Color(0xFFEEEEF0), height: 1),
        ),
        leadingWidth: 140,
        leading: Padding(
          padding: const EdgeInsets.only(left: 14),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(5),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF0EC),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.person_rounded, color: Color(0xFFEE4D2D), size: 18),
              ),
              const SizedBox(width: 8),
              const Text('ShopNova', style: TextStyle(color: Color(0xFFEE4D2D), fontWeight: FontWeight.w800, fontSize: 16)),
            ],
          ),
        ),
        title: const Text(
          'Tài Khoản Của Tôi',
          style: TextStyle(color: Color(0xFF1E2022), fontSize: 16, fontWeight: FontWeight.w700),
        ),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            children: [
              _buildProfileSection(context),
              const SizedBox(height: 12),
              _buildStatsBar(context),
              const SizedBox(height: 12),
              _buildMyOrdersSection(context),
              const SizedBox(height: 12),
              _buildVouchersSection(context),
              const SizedBox(height: 12),
              _buildAccountSettingsSection(context),
              const SizedBox(height: 12),
              _buildServerConfigSection(context),
              const SizedBox(height: 16),
              _buildLogoutButton(context),
              const SizedBox(height: 16),
              const Text(
                'ShopNova Mobile App v3.5.0 • Kết nối MySQL & Backend API',
                style: TextStyle(color: Color(0xFF8F90A6), fontSize: 11),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildProfileSection(BuildContext context) {
    final auth = AuthService();
    return AnimatedBuilder(
      animation: auth,
      builder: (context, _) {
        final user = auth.currentUser;
        final isLoggedIn = auth.isAuthenticated && user != null;

        return Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFEEEEF0)),
            boxShadow: const [
              BoxShadow(color: Color(0x06000000), blurRadius: 8, offset: Offset(0, 2)),
            ],
          ),
          child: Column(
            children: [
              Row(
                children: [
                  Stack(
                    children: [
                      CircleAvatar(
                        radius: 32,
                        backgroundColor: isLoggedIn ? primaryColor : const Color(0xFFE2E2E6),
                        backgroundImage: (isLoggedIn && user.avatarUrl != null && user.avatarUrl!.isNotEmpty)
                            ? NetworkImage(user.avatarUrl!)
                            : null,
                        child: (isLoggedIn && user.avatarUrl != null && user.avatarUrl!.isNotEmpty)
                            ? null
                            : Icon(
                                isLoggedIn ? Icons.person_rounded : Icons.person_outline_rounded,
                                size: 38,
                                color: Colors.white,
                              ),
                      ),
                      if (isLoggedIn)
                        Positioned(
                          right: 0,
                          bottom: 0,
                          child: Container(
                            padding: const EdgeInsets.all(2),
                            decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                            child: const Icon(Icons.verified_rounded, color: Color(0xFF00BFA5), size: 16),
                          ),
                        )
                    ],
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          isLoggedIn
                              ? (user.fullName.isNotEmpty ? user.fullName : user.username)
                              : 'Chào mừng bạn đến ShopNova',
                          style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Color(0xFF1E2022)),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: isLoggedIn ? const Color(0xFFFFF0EC) : const Color(0xFFF0F1F5),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    isLoggedIn ? Icons.stars_rounded : Icons.lock_outline_rounded,
                                    color: isLoggedIn ? primaryColor : const Color(0xFF8F90A6),
                                    size: 13,
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    isLoggedIn
                                        ? (user.role == 'seller' ? 'Người bán hàng' : 'Thành viên ShopNova')
                                        : 'Chưa đăng nhập',
                                    style: TextStyle(
                                      color: isLoggedIn ? primaryColor : const Color(0xFF555770),
                                      fontSize: 11,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        if (isLoggedIn) ...[
                          const SizedBox(height: 4),
                          Text(
                            '@${user.username}${user.email != null && user.email!.isNotEmpty ? ' • ${user.email}' : ''}',
                            style: const TextStyle(color: Color(0xFF8F90A6), fontSize: 11),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 12),
                child: Divider(height: 1, color: Color(0xFFEEEEF0)),
              ),
              if (isLoggedIn)
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _showEditProfileDialog,
                        icon: const Icon(Icons.edit_outlined, size: 16),
                        label: const Text('Chỉnh sửa hồ sơ', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFF1E2022),
                          side: const BorderSide(color: Color(0xFFE2E2E6)),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          padding: const EdgeInsets.symmetric(vertical: 8),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _showChangePasswordDialog,
                        icon: const Icon(Icons.lock_reset_rounded, size: 16),
                        label: const Text('Đổi mật khẩu', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFF1E2022),
                          side: const BorderSide(color: Color(0xFFE2E2E6)),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          padding: const EdgeInsets.symmetric(vertical: 8),
                        ),
                      ),
                    ),
                  ],
                )
              else
                Container(
                  width: double.infinity,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFFEE4D2D), Color(0xFFFF5224)],
                    ),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: ElevatedButton(
                    onPressed: () async {
                      await Navigator.push(context, MaterialPageRoute(builder: (_) => const shopnova_auth.LoginScreen()));
                      if (mounted) {
                        _loadUserStats();
                        setState(() {});
                      }
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.transparent,
                      shadowColor: Colors.transparent,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    child: const Text('Đăng nhập hoặc Đăng ký', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  void _showVouchersModal() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.confirmation_number_outlined, color: Color(0xFFEE4D2D)),
                SizedBox(width: 8),
                Text('Ví Voucher Của Tôi', style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
              ],
            ),
            const SizedBox(height: 12),
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF3CD),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFFFEEBA)),
              ),
              child: const Row(
                children: [
                  Icon(Icons.info_outline, color: Color(0xFF856404), size: 18),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Chưa có API kết nối: Tính năng Voucher hiện chưa có API trên hệ thống Backend website. Các mã bên dưới là mã ưu đãi mẫu.',
                      style: TextStyle(color: Color(0xFF856404), fontSize: 11),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 4),
            ...[
              {'code': 'FREESHIPMAX', 'title': 'Giảm 30K phí vận chuyển', 'desc': 'Đơn từ 99.000 ₫'},
              {'code': 'CHAOBANMOI', 'title': 'Giảm 15% tối đa 50K', 'desc': 'Cho mọi đơn hàng đầu tiên'},
              {'code': 'NOVAMEGA50', 'title': 'Giảm ngay 50.000 ₫', 'desc': 'Đơn từ 350.000 ₫'},
            ].map((v) => Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFFAFAFC),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFEEEEF0)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(v['code']!, style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFFEE4D2D))),
                      const SizedBox(height: 2),
                      Text(v['title']!, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                      Text(v['desc']!, style: const TextStyle(fontSize: 11, color: Color(0xFF8F90A6))),
                    ],
                  ),
                  ElevatedButton(
                    onPressed: () {
                      Navigator.pop(ctx);
                      _copyToClipboard(v['code']!);
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: primaryColor,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      minimumSize: const Size(0, 32),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                    ),
                    child: const Text('Lưu mã', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            )),
          ],
        ),
      ),
    );
  }

  Widget _buildStatsBar(BuildContext context) {
    final orderCount = _backendStats?['orderCount'] ?? 0;
    final totalSpent = _backendStats?['totalSpent'] ?? 0;
    final voucherCount = _backendStats?['voucherCount'] ?? 3;

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFEEEEF0)),
        boxShadow: const [
          BoxShadow(color: Color(0x06000000), blurRadius: 8, offset: Offset(0, 2)),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _buildStatItem(
            icon: Icons.receipt_long_rounded,
            count: '$orderCount',
            label: 'Đơn mua',
            color: const Color(0xFF2563EB),
            onTap: () {
              Navigator.push(context, MaterialPageRoute(builder: (_) => const OrdersScreen(initialTabIndex: 0)));
            },
          ),
          _buildStatItem(
            icon: Icons.account_balance_wallet_rounded,
            count: _formatVnd(totalSpent),
            label: 'Đã chi tiêu',
            color: primaryColor,
            isAmount: true,
            onTap: () {
              Navigator.push(context, MaterialPageRoute(builder: (_) => const DepositScreen()));
            },
          ),
          _buildStatItem(
            icon: Icons.confirmation_number_rounded,
            count: '$voucherCount',
            label: 'Ví voucher',
            color: const Color(0xFFD97706),
            onTap: _showVouchersModal,
          ),
          _buildStatItem(
            icon: Icons.favorite_rounded,
            count: '${_backendStats?['favoriteCount'] ?? 'Xem'}',
            label: 'Yêu thích',
            color: const Color(0xFFE11D48),
            onTap: () {
              Navigator.push(context, MaterialPageRoute(builder: (_) => const FavoritesScreen()));
            },
          ),
        ],
      ),
    );
  }

  Widget _buildStatItem({
    required IconData icon,
    required String count,
    required String label,
    required Color color,
    bool isAmount = false,
    VoidCallback? onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(7),
              decoration: BoxDecoration(
                color: color.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(height: 6),
            Text(
              count,
              style: TextStyle(
                fontSize: isAmount ? 12 : 14,
                fontWeight: FontWeight.w700,
                color: const Color(0xFF1E2022),
              ),
            ),
            const SizedBox(height: 2),
            Text(label, style: const TextStyle(fontSize: 10, color: Color(0xFF8F90A6))),
          ],
        ),
      ),
    );
  }

  Widget _buildMyOrdersSection(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFEEEEF0)),
        boxShadow: const [
          BoxShadow(color: Color(0x06000000), blurRadius: 8, offset: Offset(0, 2)),
        ],
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: const [
                  Icon(Icons.assignment_outlined, color: Color(0xFFEE4D2D), size: 18),
                  SizedBox(width: 6),
                  Text('Đơn Mua Của Tôi', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF1E2022))),
                ],
              ),
              GestureDetector(
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (context) => const OrdersScreen(initialTabIndex: 0)),
                  );
                },
                child: Row(
                  children: const [
                    Text('Xem tất cả đơn hàng', style: TextStyle(color: Color(0xFF8F90A6), fontSize: 12)),
                    SizedBox(width: 4),
                    Icon(Icons.chevron_right_rounded, size: 18, color: Color(0xFF8F90A6)),
                  ],
                ),
              )
            ],
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _buildOrderIcon(context, Icons.schedule_rounded, 'Chờ xác nhận', 0),
              _buildOrderIcon(context, Icons.inventory_2_outlined, 'Chờ lấy hàng', 1),
              _buildOrderIcon(context, Icons.local_shipping_outlined, 'Đang giao', 2),
              _buildOrderIcon(context, Icons.rate_review_outlined, 'Đánh giá', 3),
              _buildOrderIcon(context, Icons.replay_rounded, 'Trả hàng', 4),
            ],
          )
        ],
      ),
    );
  }

  Widget _buildOrderIcon(BuildContext context, IconData icon, String label, int tabIndex) {
    return GestureDetector(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(builder: (context) => OrdersScreen(initialTabIndex: tabIndex)),
        );
      },
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(11),
            decoration: const BoxDecoration(color: Color(0xFFFFF0EC), shape: BoxShape.circle),
            child: Icon(icon, color: primaryColor, size: 22),
          ),
          const SizedBox(height: 6),
          Text(
            label,
            style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w500, color: Color(0xFF28293D)),
            textAlign: TextAlign.center,
          )
        ],
      ),
    );
  }

  Widget _buildVouchersSection(BuildContext context) {
    final vouchers = [
      {
        'code': 'FREESHIPMAX',
        'title': 'Miễn phí vận chuyển toàn quốc',
        'desc': 'Giảm 30K phí vận chuyển',
        'minSpend': 'Đơn từ 99.000 ₫',
        'color': const Color(0xFF00BFA5),
      },
      {
        'code': 'CHAOBANMOI',
        'title': 'Ưu đãi chào mừng thành viên mới',
        'desc': 'Giảm 15% tối đa 50K',
        'minSpend': 'Mọi đơn hàng',
        'color': const Color(0xFFD97706),
      },
      {
        'code': 'NOVAMEGA50',
        'title': 'Mã giảm giá Mega Sale',
        'desc': 'Giảm ngay 50.000 ₫',
        'minSpend': 'Đơn từ 350.000 ₫',
        'color': const Color(0xFFD0011B),
      },
    ];

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFEEEEF0)),
        boxShadow: const [
          BoxShadow(color: Color(0x06000000), blurRadius: 8, offset: Offset(0, 2)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: const [
                  Icon(Icons.confirmation_number_outlined, color: Color(0xFFEE4D2D), size: 18),
                  SizedBox(width: 6),
                  Text('Ví Voucher & Ưu Đãi', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF1E2022))),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF3CD),
                  borderRadius: BorderRadius.circular(4),
                  border: Border.all(color: const Color(0xFFFFEEBA)),
                ),
                child: const Text('Chưa có API', style: TextStyle(color: Color(0xFF856404), fontSize: 10, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 115,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: vouchers.length,
              separatorBuilder: (_, __) => const SizedBox(width: 10),
              itemBuilder: (context, idx) {
                final v = vouchers[idx];
                final col = v['color'] as Color;
                return Container(
                  width: 220,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFAFAFC),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFFEEEEF0)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: col.withOpacity(0.12),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              v['code'] as String,
                              style: TextStyle(color: col, fontWeight: FontWeight.bold, fontSize: 10),
                            ),
                          ),
                          GestureDetector(
                            onTap: () => _copyToClipboard(v['code'] as String),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: primaryColor,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: const Text('Lưu mã', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                            ),
                          ),
                        ],
                      ),
                      Text(
                        v['desc'] as String,
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Color(0xFF1E2022)),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      Text(
                        v['minSpend'] as String,
                        style: const TextStyle(fontSize: 10, color: Color(0xFF8F90A6)),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAccountSettingsSection(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFEEEEF0)),
        boxShadow: const [
          BoxShadow(color: Color(0x06000000), blurRadius: 8, offset: Offset(0, 2)),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(14),
        clipBehavior: Clip.antiAlias,
        child: Column(
          children: [
            _buildSettingsTile(
              icon: Icons.location_on_outlined,
              title: 'Sổ địa chỉ nhận hàng',
              subtitle: 'Quản lý danh sách địa chỉ giao hàng',
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const AddressesScreen()),
                );
              },
            ),
            const Divider(height: 1, indent: 52, color: Color(0xFFEEEEF0)),
            _buildSettingsTile(
              icon: Icons.favorite_border_rounded,
              title: 'Sản phẩm yêu thích',
              subtitle: 'Xem và quản lý các sản phẩm đã lưu',
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const FavoritesScreen()),
                );
              },
            ),
            const Divider(height: 1, indent: 52, color: Color(0xFFEEEEF0)),
            _buildSettingsTile(
              icon: Icons.storefront_outlined,
              title: 'Kênh Người Bán',
              subtitle: 'Quản lý cửa hàng, doanh thu và đơn hàng',
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const SellerHubScreen()),
                );
              },
            ),
            const Divider(height: 1, indent: 52, color: Color(0xFFEEEEF0)),
            _buildSettingsTile(
              icon: Icons.lock_outline_rounded,
              title: 'Đổi mật khẩu tài khoản',
              subtitle: 'Cập nhật mật khẩu bảo mật',
              onTap: _showChangePasswordDialog,
            ),
            const Divider(height: 1, indent: 52, color: Color(0xFFEEEEF0)),
            SwitchListTile(
              secondary: Container(
                padding: const EdgeInsets.all(8),
                decoration: const BoxDecoration(color: Color(0xFFF7F7F8), shape: BoxShape.circle),
                child: const Icon(Icons.notifications_none_rounded, size: 20, color: Color(0xFF28293D)),
              ),
              title: const Text('Thông báo ưu đãi & đơn hàng', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF1E2022))),
              subtitle: const Text('Nhận tin tức flash sale và tiến độ vận chuyển', style: TextStyle(fontSize: 11, color: Color(0xFF8F90A6))),
              value: _notificationEnabled,
              activeColor: primaryColor,
              onChanged: (val) {
                setState(() => _notificationEnabled = val);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(val ? 'Đã bật thông báo đẩy ShopNova' : 'Đã tắt thông báo đẩy'),
                    duration: const Duration(seconds: 1),
                  ),
                );
              },
            ),
            const Divider(height: 1, indent: 52, color: Color(0xFFEEEEF0)),
            SwitchListTile(
              secondary: Container(
                padding: const EdgeInsets.all(8),
                decoration: const BoxDecoration(color: Color(0xFFF7F7F8), shape: BoxShape.circle),
                child: const Icon(Icons.shield_outlined, size: 20, color: Color(0xFF28293D)),
              ),
              title: const Text('Bảo mật tài khoản 2 lớp', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF1E2022))),
              subtitle: const Text('Tăng cường bảo vệ tài khoản khi đăng nhập', style: TextStyle(fontSize: 11, color: Color(0xFF8F90A6))),
              value: _twoFactorEnabled,
              activeColor: primaryColor,
              onChanged: (val) {
                setState(() => _twoFactorEnabled = val);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(val ? 'Đã kích hoạt xác thực 2 lớp' : 'Đã tắt xác thực 2 lớp'),
                    duration: const Duration(seconds: 1),
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSettingsTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return ListTile(
      leading: Container(
        padding: const EdgeInsets.all(8),
        decoration: const BoxDecoration(color: Color(0xFFF7F7F8), shape: BoxShape.circle),
        child: Icon(icon, size: 20, color: const Color(0xFF28293D)),
      ),
      title: Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF1E2022))),
      subtitle: Text(subtitle, style: const TextStyle(fontSize: 11, color: Color(0xFF8F90A6)), maxLines: 1, overflow: TextOverflow.ellipsis),
      trailing: const Icon(Icons.chevron_right_rounded, size: 20, color: Color(0xFF8F90A6)),
      onTap: onTap,
    );
  }

  Widget _buildServerConfigSection(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFEEEEF0)),
        boxShadow: const [
          BoxShadow(color: Color(0x06000000), blurRadius: 8, offset: Offset(0, 2)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: const [
                  Icon(Icons.dns_outlined, color: Color(0xFF2563EB), size: 18),
                  SizedBox(width: 8),
                  Text('Máy Chủ Backend API', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF1E2022))),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFF0FDF4),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFBBF7D0)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: const [
                    Icon(Icons.check_circle_rounded, color: Color(0xFF16A34A), size: 12),
                    SizedBox(width: 4),
                    Text('Đang kết nối', style: TextStyle(color: Color(0xFF15803D), fontSize: 10, fontWeight: FontWeight.bold)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          SelectableText(
            ApiConfig.baseUrl,
            style: const TextStyle(fontSize: 11, color: Color(0xFF28293D), fontFamily: 'monospace'),
          ),
        ],
      ),
    );
  }

  Widget _buildLogoutButton(BuildContext context) {
    final auth = AuthService();
    return AnimatedBuilder(
      animation: auth,
      builder: (context, _) {
        if (!auth.isAuthenticated) {
          return const SizedBox.shrink();
        }
        return Container(
          width: double.infinity,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFFFD5CC)),
          ),
          child: ElevatedButton.icon(
            onPressed: () {
              showDialog(
                context: context,
                builder: (ctx) => AlertDialog(
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  title: const Text('Xác nhận đăng xuất', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  content: const Text('Bạn có chắc chắn muốn đăng xuất khỏi tài khoản ShopNova không?'),
                  actions: [
                    TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Hủy', style: TextStyle(color: Colors.grey))),
                    ElevatedButton(
                      onPressed: () {
                        Navigator.pop(ctx);
                        auth.logout();
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Đã đăng xuất tài khoản thành công'),
                            backgroundColor: Colors.black87,
                          ),
                        );
                      },
                      style: ElevatedButton.styleFrom(backgroundColor: primaryColor, foregroundColor: Colors.white),
                      child: const Text('Đăng xuất'),
                    ),
                  ],
                ),
              );
            },
            icon: const Icon(Icons.logout_rounded, color: Color(0xFFEE4D2D), size: 18),
            label: const Text('Đăng xuất tài khoản', style: TextStyle(color: Color(0xFFEE4D2D), fontWeight: FontWeight.bold)),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.transparent,
              shadowColor: Colors.transparent,
              elevation: 0,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
        );
      },
    );
  }
}
