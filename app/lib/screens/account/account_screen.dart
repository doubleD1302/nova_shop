import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shopnova/screens/orders/orders_screen.dart';
import 'package:shopnova/screens/auth/login_screen.dart' as shopnova_auth;
import 'package:shopnova/services/auth_service.dart';
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

  // Địa chỉ nhận hàng lưu tạm
  String _receiverName = '';
  String _receiverPhone = '';
  String _receiverAddress = 'Số 123 Đường Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh';

  @override
  void initState() {
    super.initState();
    _loadUserStats();
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
        backgroundColor: Colors.black87,
        duration: const Duration(seconds: 2),
      ),
    );
  }

  // DIALOG CHỈNH SỬA HỒ SƠ (CẬP NHẬT BACKEND API)
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
                          icon: const Icon(Icons.close),
                          onPressed: () => Navigator.pop(ctx),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: nameController,
                      decoration: InputDecoration(
                        labelText: 'Họ và tên',
                        prefixIcon: const Icon(Icons.person_outline),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: phoneController,
                      keyboardType: TextInputType.phone,
                      decoration: InputDecoration(
                        labelText: 'Số điện thoại',
                        prefixIcon: const Icon(Icons.phone_outlined),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: emailController,
                      keyboardType: TextInputType.emailAddress,
                      decoration: InputDecoration(
                        labelText: 'Email',
                        prefixIcon: const Icon(Icons.email_outlined),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: avatarController,
                      decoration: InputDecoration(
                        labelText: 'URL ảnh đại diện (Tùy chọn)',
                        prefixIcon: const Icon(Icons.image_outlined),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                    const SizedBox(height: 20),
                    SizedBox(
                      width: double.infinity,
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
                                        backgroundColor: Colors.green,
                                      ),
                                    );
                                    setState(() {});
                                  } else {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        content: Text(auth.lastError ?? 'Cập nhật hồ sơ thất bại.'),
                                        backgroundColor: Colors.red,
                                      ),
                                    );
                                  }
                                }
                              },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: primaryColor,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
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

  // DIALOG ĐỔI MẬT KHẨU (KẾT NỐI BACKEND API)
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
                  Icon(Icons.lock_reset, color: Color(0xFFEE4D2D)),
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
                        border: const OutlineInputBorder(),
                        suffixIcon: IconButton(
                          icon: Icon(obscureCurrent ? Icons.visibility_off : Icons.visibility, size: 20),
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
                        border: const OutlineInputBorder(),
                        suffixIcon: IconButton(
                          icon: Icon(obscureNew ? Icons.visibility_off : Icons.visibility, size: 20),
                          onPressed: () => setDialogState(() => obscureNew = !obscureNew),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: confirmPassController,
                      obscureText: obscureNew,
                      decoration: const InputDecoration(
                        labelText: 'Xác nhận mật khẩu mới',
                        border: OutlineInputBorder(),
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
                                  backgroundColor: Colors.green,
                                ),
                              );
                            } else {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(auth.lastError ?? 'Đổi mật khẩu thất bại.'),
                                  backgroundColor: Colors.red,
                                ),
                              );
                            }
                          }
                        },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: primaryColor,
                    foregroundColor: Colors.white,
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

  // DIALOG ĐỊA CHỈ NHẬN HÀNG
  void _showAddressDialog() {
    final nameCtrl = TextEditingController(text: _receiverName.isNotEmpty ? _receiverName : (AuthService().currentUser?.fullName ?? ''));
    final phoneCtrl = TextEditingController(text: _receiverPhone.isNotEmpty ? _receiverPhone : (AuthService().currentUser?.phone ?? ''));
    final addressCtrl = TextEditingController(text: _receiverAddress);

    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Row(
            children: [
              Icon(Icons.location_on_outlined, color: Color(0xFFEE4D2D)),
              SizedBox(width: 8),
              Text('Địa chỉ giao hàng mặc định', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: nameCtrl,
                  decoration: const InputDecoration(labelText: 'Người nhận', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: phoneCtrl,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(labelText: 'Số điện thoại', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: addressCtrl,
                  maxLines: 3,
                  decoration: const InputDecoration(labelText: 'Địa chỉ nhận hàng chi tiết', border: OutlineInputBorder()),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Hủy', style: TextStyle(color: Colors.grey)),
            ),
            ElevatedButton(
              onPressed: () {
                setState(() {
                  _receiverName = nameCtrl.text.trim();
                  _receiverPhone = phoneCtrl.text.trim();
                  _receiverAddress = addressCtrl.text.trim();
                });
                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Đã lưu địa chỉ giao hàng mặc định thành công!'),
                    backgroundColor: Colors.green,
                  ),
                );
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: primaryColor,
                foregroundColor: Colors.white,
              ),
              child: const Text('Lưu địa chỉ'),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F5),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0.5,
        leadingWidth: 140,
        leading: const Padding(
          padding: EdgeInsets.only(left: 14),
          child: Row(
            children: [
              Icon(Icons.shopping_bag, color: Color(0xFFEE4D2D)),
              SizedBox(width: 6),
              Text('ShopNova', style: TextStyle(color: Color(0xFFEE4D2D), fontWeight: FontWeight.bold, fontSize: 16)),
            ],
          ),
        ),
        title: const Text(
          'Tài khoản của tôi',
          style: TextStyle(color: Colors.black87, fontSize: 16, fontWeight: FontWeight.bold),
        ),
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
                style: TextStyle(color: Colors.grey, fontSize: 11),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  // PHẦN HEADER THÔNG TIN HỒ SƠ
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
            borderRadius: BorderRadius.circular(12),
            boxShadow: [
              BoxStyles.subtleShadow,
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
                        backgroundColor: isLoggedIn ? primaryColor : Colors.grey.shade400,
                        backgroundImage: (isLoggedIn && user.avatarUrl != null && user.avatarUrl!.isNotEmpty)
                            ? NetworkImage(user.avatarUrl!)
                            : null,
                        child: (isLoggedIn && user.avatarUrl != null && user.avatarUrl!.isNotEmpty)
                            ? null
                            : Icon(
                                isLoggedIn ? Icons.person : Icons.person_outline,
                                size: 40,
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
                            child: const Icon(Icons.verified, color: Colors.blue, size: 16),
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
                          style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: isLoggedIn ? const Color(0xFFFFF0EC) : Colors.grey[100],
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    isLoggedIn ? Icons.stars : Icons.lock_outline,
                                    color: isLoggedIn ? primaryColor : Colors.grey,
                                    size: 12,
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    isLoggedIn
                                        ? (user.role == 'seller' ? 'Người bán hàng' : 'Thành viên ShopNova')
                                        : 'Chưa đăng nhập',
                                    style: TextStyle(
                                      color: isLoggedIn ? primaryColor : Colors.grey[700],
                                      fontSize: 10,
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
                            style: const TextStyle(color: Colors.grey, fontSize: 11),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              const Divider(height: 1),
              const SizedBox(height: 8),
              if (isLoggedIn)
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _showEditProfileDialog,
                        icon: const Icon(Icons.edit_outlined, size: 16),
                        label: const Text('Chỉnh sửa hồ sơ', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.black87,
                          side: BorderSide(color: Colors.grey.shade300),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          padding: const EdgeInsets.symmetric(vertical: 8),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _showChangePasswordDialog,
                        icon: const Icon(Icons.lock_reset, size: 16),
                        label: const Text('Đổi mật khẩu', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.black87,
                          side: BorderSide(color: Colors.grey.shade300),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          padding: const EdgeInsets.symmetric(vertical: 8),
                        ),
                      ),
                    ),
                  ],
                )
              else
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () {
                      Navigator.push(context, MaterialPageRoute(builder: (_) => const shopnova_auth.LoginScreen()));
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: primaryColor,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    child: const Text('Đăng nhập hoặc Đăng ký', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  // THANH 4 THẺ THỐNG KÊ TÀI KHOẢN
  Widget _buildStatsBar(BuildContext context) {
    final orderCount = _backendStats?['orderCount'] ?? 0;
    final totalSpent = _backendStats?['totalSpent'] ?? 0;
    final voucherCount = _backendStats?['voucherCount'] ?? 4;

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [BoxStyles.subtleShadow],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _buildStatItem(
            icon: Icons.receipt_long,
            count: '$orderCount',
            label: 'Đơn mua',
            color: Colors.blue,
            onTap: () {
              Navigator.push(context, MaterialPageRoute(builder: (_) => const OrdersScreen(initialTabIndex: 0)));
            },
          ),
          _buildStatItem(
            icon: Icons.account_balance_wallet_outlined,
            count: _formatVnd(totalSpent),
            label: 'Đã chi tiêu',
            color: primaryColor,
            isAmount: true,
          ),
          _buildStatItem(
            icon: Icons.confirmation_number_outlined,
            count: '$voucherCount',
            label: 'Ví voucher',
            color: Colors.amber.shade800,
          ),
          _buildStatItem(
            icon: Icons.favorite_border,
            count: '5',
            label: 'Shop theo dõi',
            color: Colors.pink,
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
            Icon(icon, color: color, size: 22),
            const SizedBox(height: 4),
            Text(
              count,
              style: TextStyle(
                fontSize: isAmount ? 12 : 14,
                fontWeight: FontWeight.bold,
                color: Colors.black87,
              ),
            ),
            const SizedBox(height: 2),
            Text(label, style: const TextStyle(fontSize: 10, color: Colors.grey)),
          ],
        ),
      ),
    );
  }

  // PHẦN THEO DÕI ĐƠN MUA
  Widget _buildMyOrdersSection(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [BoxStyles.subtleShadow],
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Row(
                children: [
                  Icon(Icons.assignment_outlined, color: Color(0xFFEE4D2D), size: 18),
                  SizedBox(width: 6),
                  Text('Đơn Mua Của Tôi', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
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
                  children: [
                    const Text('Xem tất cả đơn hàng', style: TextStyle(color: Colors.grey, fontSize: 12)),
                    const SizedBox(width: 4),
                    Icon(Icons.chevron_right, size: 16, color: Colors.grey[400]),
                  ],
                ),
              )
            ],
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _buildOrderIcon(context, Icons.schedule, 'Chờ xác nhận', 0),
              _buildOrderIcon(context, Icons.inventory_2_outlined, 'Chờ lấy hàng', 1),
              _buildOrderIcon(context, Icons.local_shipping_outlined, 'Đang giao', 2),
              _buildOrderIcon(context, Icons.rate_review_outlined, 'Đánh giá', 3),
              _buildOrderIcon(context, Icons.replay, 'Trả hàng', 4),
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
            decoration: BoxDecoration(color: const Color(0xFFFFF0EC), shape: BoxShape.circle),
            child: Icon(icon, color: primaryColor, size: 22),
          ),
          const SizedBox(height: 6),
          Text(
            label,
            style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.normal, color: Colors.black87),
            textAlign: TextAlign.center,
          )
        ],
      ),
    );
  }

  // PHẦN VÍ VOUCHER & KHUYẾN MÃI
  Widget _buildVouchersSection(BuildContext context) {
    final vouchers = [
      {
        'code': 'FREESHIPMAX',
        'title': 'Miễn phí vận chuyển toàn quốc',
        'desc': 'Giảm 30K phí vận chuyển',
        'minSpend': 'Đơn từ 99.000 ₫',
        'color': Colors.teal,
      },
      {
        'code': 'CHAOBANMOI',
        'title': 'Ưu đãi chào mừng thành viên mới',
        'desc': 'Giảm 15% tối đa 50K',
        'minSpend': 'Mọi đơn hàng',
        'color': Colors.amber.shade900,
      },
      {
        'code': 'NOVAMEGA50',
        'title': 'Mã giảm giá Mega Sale',
        'desc': 'Giảm ngay 50.000 ₫',
        'minSpend': 'Đơn từ 350.000 ₫',
        'color': Colors.red.shade700,
      },
    ];

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [BoxStyles.subtleShadow],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Icon(Icons.confirmation_number_outlined, color: Color(0xFFEE4D2D), size: 18),
                  SizedBox(width: 6),
                  Text('Ví Voucher & Ưu Đãi', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                ],
              ),
              Text('3 voucher sẵn có', style: TextStyle(color: Colors.grey, fontSize: 11)),
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
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFAFAFA),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.grey.shade200),
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
                              color: col.withOpacity(0.1),
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
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
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
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.black87),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      Text(
                        v['minSpend'] as String,
                        style: const TextStyle(fontSize: 10, color: Colors.grey),
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

  // PHẦN CÀI ĐẶT TÀI KHOẢN VÀ BẢO MẬT
  Widget _buildAccountSettingsSection(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(12),
      clipBehavior: Clip.antiAlias,
      elevation: 0.5,
      child: Column(
        children: [
          _buildSettingsTile(
            icon: Icons.location_on_outlined,
            title: 'Địa chỉ nhận hàng',
            subtitle: _receiverAddress,
            onTap: _showAddressDialog,
          ),
          const Divider(height: 1, indent: 52),
          _buildSettingsTile(
            icon: Icons.lock_outline,
            title: 'Đổi mật khẩu tài khoản',
            subtitle: 'Cập nhật mật khẩu bảo mật',
            onTap: _showChangePasswordDialog,
          ),
          const Divider(height: 1, indent: 52),
          SwitchListTile(
            secondary: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(color: Colors.grey.shade100, shape: BoxShape.circle),
              child: const Icon(Icons.notifications_none, size: 20, color: Colors.black87),
            ),
            title: const Text('Thông báo ưu đãi & đơn hàng', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
            subtitle: const Text('Nhận tin tức flash sale và tiến độ vận chuyển', style: TextStyle(fontSize: 11, color: Colors.grey)),
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
          const Divider(height: 1, indent: 52),
          SwitchListTile(
            secondary: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(color: Colors.grey.shade100, shape: BoxShape.circle),
              child: const Icon(Icons.shield_outlined, size: 20, color: Colors.black87),
            ),
            title: const Text('Bảo mật tài khoản 2 lớp', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
            subtitle: const Text('Tăng cường bảo vệ tài khoản khi đăng nhập', style: TextStyle(fontSize: 11, color: Colors.grey)),
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
        decoration: BoxDecoration(color: Colors.grey.shade100, shape: BoxShape.circle),
        child: Icon(icon, size: 20, color: Colors.black87),
      ),
      title: Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
      subtitle: Text(subtitle, style: const TextStyle(fontSize: 11, color: Colors.grey), maxLines: 1, overflow: TextOverflow.ellipsis),
      trailing: const Icon(Icons.chevron_right, size: 18, color: Colors.grey),
      onTap: onTap,
    );
  }

  // PHẦN CẤU HÌNH MÁY CHỦ BACKEND API
  Widget _buildServerConfigSection(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [BoxStyles.subtleShadow],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Row(
                children: [
                  Icon(Icons.dns_outlined, color: Colors.blue, size: 18),
                  SizedBox(width: 8),
                  Text('Máy Chủ Backend API', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: Colors.green.shade50,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Colors.green.shade200),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.check_circle, color: Colors.green, size: 11),
                    SizedBox(width: 4),
                    Text('Đang kết nối', style: TextStyle(color: Colors.green, fontSize: 10, fontWeight: FontWeight.bold)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          SelectableText(
            ApiConfig.baseUrl,
            style: const TextStyle(fontSize: 11, color: Colors.black87, fontFamily: 'monospace'),
          ),
        ],
      ),
    );
  }

  // NÚT ĐĂNG XUẤT TÀI KHOẢN
  Widget _buildLogoutButton(BuildContext context) {
    final auth = AuthService();
    return AnimatedBuilder(
      animation: auth,
      builder: (context, _) {
        if (!auth.isAuthenticated) {
          return const SizedBox.shrink();
        }
        return SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: () {
              showDialog(
                context: context,
                builder: (ctx) => AlertDialog(
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
            icon: const Icon(Icons.logout, color: Color(0xFFEE4D2D), size: 18),
            label: const Text('Đăng xuất tài khoản', style: TextStyle(color: Color(0xFFEE4D2D), fontWeight: FontWeight.bold)),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.white,
              elevation: 0,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
          ),
        );
      },
    );
  }
}

class BoxStyles {
  static final subtleShadow = BoxShadow(
    color: Colors.black.withOpacity(0.04),
    spreadRadius: 1,
    blurRadius: 4,
    offset: const Offset(0, 1),
  );
}
