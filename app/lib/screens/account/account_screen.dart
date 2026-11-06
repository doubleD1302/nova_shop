import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shopnova/screens/orders/orders_screen.dart';
import 'package:shopnova/screens/auth/login_screen.dart' as shopnova_auth;
import 'package:shopnova/screens/account/addresses_screen.dart';
import 'package:shopnova/screens/account/favorites_screen.dart';
import 'package:shopnova/screens/seller/seller_register_screen.dart';
import 'package:shopnova/screens/wallet/deposit_screen.dart';
import 'package:shopnova/services/auth_service.dart';
import 'package:shopnova/services/cart_service.dart';
import 'package:shopnova/services/upload_service.dart';
import 'package:shopnova/config/api_config.dart';
import 'package:shopnova/theme/app_colors.dart';
import 'package:shopnova/models/voucher.dart';
import 'package:shopnova/services/voucher_service.dart';

class AccountScreen extends StatefulWidget {
  const AccountScreen({super.key});

  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> {
  final Color primaryColor = AppColors.primary;
  Map<String, dynamic>? _backendStats;
  bool _notificationEnabled = true;
  bool _twoFactorEnabled = false;

  String _receiverName = '';
  String _receiverPhone = '';
  String _receiverAddress = 'Số 123 Đường Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh';
  bool _isCheckingServer = false;
  Map<String, dynamic>? _serverStatus;
  List<Voucher> _apiVouchers = [];
  Set<String> _savedVouchers = {};

  @override
  void initState() {
    super.initState();
    AuthService().addListener(_onAuthChanged);
    AuthService().restoreSession().then((_) {
      if (mounted) {
        _loadUserStats();
        setState(() {});
      }
    });
    _loadUserStats();
    _checkServerStatus();
    _loadVouchers();
  }

  Future<void> _loadVouchers() async {
    final list = await VoucherService().getActiveVouchers();
    final saved = await VoucherService().getSavedVoucherCodes();
    final walletList = await VoucherService().getWalletVouchers();
    final allSaved = Set<String>.from(saved);
    for (final v in walletList) {
      allSaved.add(v.code);
    }
    if (mounted) {
      setState(() {
        _apiVouchers = list;
        _savedVouchers = allSaved;
      });
    }
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
    String? previewAvatarUrl = user.avatarUrl;
    bool shouldClearAvatar = false;
    bool isUploadingAvatar = false;
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
            final hasAvatar = !shouldClearAvatar && (previewAvatarUrl != null && previewAvatarUrl!.isNotEmpty);

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

                    // Khu vực Avatar: Xem trước, Tải từ máy và Xóa ảnh
                    Center(
                      child: Column(
                        children: [
                          Stack(
                            alignment: Alignment.center,
                            children: [
                              CircleAvatar(
                                radius: 44,
                                backgroundColor: const Color(0xFFF0F2F5),
                                backgroundImage: hasAvatar
                                    ? NetworkImage(ApiConfig.resolveImageUrl(previewAvatarUrl))
                                    : null,
                                child: hasAvatar
                                    ? null
                                    : const Icon(Icons.person_rounded, size: 48, color: Color(0xFF90949C)),
                              ),
                              if (isUploadingAvatar)
                                Container(
                                  width: 88,
                                  height: 88,
                                  decoration: BoxDecoration(
                                    color: Colors.black45,
                                    shape: BoxShape.circle,
                                  ),
                                  child: const Center(
                                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                                  ),
                                ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              OutlinedButton.icon(
                                onPressed: (isUploadingAvatar || isSaving)
                                    ? null
                                    : () async {
                                        setModalState(() => isUploadingAvatar = true);
                                        final result = await UploadService().pickAndUploadImage(purpose: 'avatar');
                                        setModalState(() => isUploadingAvatar = false);

                                        if (result != null) {
                                          if (result.success && result.url != null) {
                                            setModalState(() {
                                              previewAvatarUrl = result.url;
                                              avatarController.text = result.url!;
                                              shouldClearAvatar = false;
                                            });
                                            if (mounted) {
                                              ScaffoldMessenger.of(context).showSnackBar(
                                                const SnackBar(
                                                  content: Text('Đã tải ảnh đại diện thành công!'),
                                                  backgroundColor: Color(0xFF00BFA5),
                                                ),
                                              );
                                            }
                                          } else {
                                            if (mounted) {
                                              ScaffoldMessenger.of(context).showSnackBar(
                                                SnackBar(
                                                  content: Text(result.error ?? 'Tải ảnh thất bại.'),
                                                  backgroundColor: const Color(0xFFD0011B),
                                                ),
                                              );
                                            }
                                          }
                                        }
                                      },
                                icon: const Icon(Icons.photo_camera_rounded, size: 18),
                                label: const Text('Chọn ảnh từ máy', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: AppColors.primary,
                                  side: const BorderSide(color: AppColors.primary),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                ),
                              ),
                              if (hasAvatar || avatarController.text.trim().isNotEmpty) ...[
                                const SizedBox(width: 10),
                                TextButton.icon(
                                  onPressed: (isUploadingAvatar || isSaving)
                                      ? null
                                      : () {
                                          setModalState(() {
                                            shouldClearAvatar = true;
                                            previewAvatarUrl = null;
                                            avatarController.clear();
                                          });
                                          ScaffoldMessenger.of(context).showSnackBar(
                                            const SnackBar(
                                              content: Text('Đã chọn xóa ảnh đại diện. Nhấn "Lưu thay đổi" để áp dụng.'),
                                            ),
                                          );
                                        },
                                  icon: const Icon(Icons.delete_outline_rounded, size: 18, color: Color(0xFFD0011B)),
                                  label: const Text('Xóa ảnh', style: TextStyle(color: Color(0xFFD0011B), fontSize: 13, fontWeight: FontWeight.bold)),
                                ),
                              ],
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

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
                      onChanged: (val) {
                        setModalState(() {
                          previewAvatarUrl = val.trim();
                          shouldClearAvatar = false;
                        });
                      },
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
                          colors: [AppColors.primary, AppColors.earth],
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

                                final initialAvatar = user.avatarUrl ?? '';
                                final currentAvatarInput = avatarController.text.trim();
                                bool ok = false;

                                if (shouldClearAvatar) {
                                  ok = await auth.updateProfile(
                                    fullName: name,
                                    phone: phoneController.text.trim(),
                                    email: emailController.text.trim(),
                                    clearAvatar: true,
                                  );
                                } else if (currentAvatarInput.isNotEmpty && currentAvatarInput != initialAvatar) {
                                  ok = await auth.updateProfile(
                                    fullName: name,
                                    phone: phoneController.text.trim(),
                                    email: emailController.text.trim(),
                                    avatarUrl: currentAvatarInput,
                                  );
                                } else {
                                  // Giữ nguyên ảnh đại diện trên máy chủ
                                  ok = await auth.updateProfile(
                                    fullName: name,
                                    phone: phoneController.text.trim(),
                                    email: emailController.text.trim(),
                                  );
                                }

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
                  Icon(Icons.lock_reset_rounded, color: AppColors.primary),
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
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: AppColors.border, height: 1),
        ),
        leadingWidth: 150,
        leading: Padding(
          padding: const EdgeInsets.only(left: 14),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(5),
                decoration: BoxDecoration(
                  color: AppColors.surfaceAlt,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.border, width: 0.8),
                ),
                child: const Icon(Icons.person_rounded, color: AppColors.primary, size: 18),
              ),
              const SizedBox(width: 8),
              RichText(
                text: const TextSpan(
                  children: [
                    TextSpan(
                      text: 'Nova',
                      style: TextStyle(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w900,
                        fontSize: 16,
                      ),
                    ),
                    TextSpan(
                      text: 'Shop',
                      style: TextStyle(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w900,
                        fontSize: 16,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        title: const Text(
          'Tài Khoản Của Tôi',
          style: TextStyle(color: AppColors.textPrimary, fontSize: 16, fontWeight: FontWeight.w700),
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
              _buildSellerPartnerBanner(context),
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
                            ? NetworkImage(ApiConfig.resolveImageUrl(user.avatarUrl))
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
                                color: isLoggedIn ? AppColors.surfaceAlt : const Color(0xFFF0F1F5),
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
                      colors: [AppColors.primary, AppColors.earth],
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

  Widget _buildSellerPartnerBanner(BuildContext context) {
    final auth = AuthService();
    return AnimatedBuilder(
      animation: auth,
      builder: (context, _) {
        final user = auth.currentUser;
        final isSeller = auth.isAuthenticated && user?.isSeller == true;

        if (isSeller) {
          return Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(14),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.1),
                  blurRadius: 8,
                  offset: const Offset(0, 3),
                ),
              ],
            ),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF00BFA5), Color(0xFF00897B)],
                    ),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.storefront_rounded, color: Colors.white, size: 24),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(
                            'Kênh Người Bán Của Bạn',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 13.5,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          SizedBox(width: 6),
                          Icon(Icons.verified_rounded, color: Color(0xFF00BFA5), size: 15),
                        ],
                      ),
                      SizedBox(height: 2),
                      Text(
                        'Quản lý đơn hàng, thêm sản phẩm và xem doanh thu',
                        style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                      ),
                    ],
                  ),
                ),
                ElevatedButton(
                  onPressed: _showSellerAppNoticeDialog,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF00BFA5),
                    foregroundColor: Colors.white,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: const Text('Quản Lý Shop', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          );
        }

        // Người dùng chưa là Seller (Buyer hoặc Khách)
        return Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [AppColors.surfaceAlt, AppColors.surface],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.border),
            boxShadow: [
              BoxShadow(
                color: AppColors.primary.withValues(alpha: 0.08),
                blurRadius: 10,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [AppColors.primary, AppColors.earth],
                      ),
                      borderRadius: BorderRadius.circular(12),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.primary.withValues(alpha: 0.3),
                          blurRadius: 6,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: const Icon(Icons.rocket_launch_rounded, color: Colors.white, size: 22),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Text(
                              'Bán Hàng Cùng ShopNova',
                              style: TextStyle(
                                color: Color(0xFF1E2022),
                                fontSize: 13.5,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                              decoration: const BoxDecoration(
                                color: AppColors.primary,
                                borderRadius: BorderRadius.all(Radius.circular(4)),
                              ),
                              child: const Text(
                                '0đ PHÍ',
                                style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w900),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 3),
                        const Text(
                          'Mở gian hàng miễn phí, tiếp cận hàng triệu khách hàng toàn quốc',
                          style: TextStyle(color: Color(0xFF6E7191), fontSize: 11),
                          maxLines: 2,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _showSellerAppNoticeDialog,
                      icon: const Icon(Icons.storefront_outlined, size: 15),
                      label: const Text('Quản Lý Shop', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.primary,
                        side: const BorderSide(color: AppColors.primary),
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const SellerRegisterScreen()),
                        );
                      },
                      icon: const Icon(Icons.how_to_reg_outlined, size: 15),
                      label: const Text('Đăng Ký Mở Shop', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  void _showVouchersModal() {
    final codeInputController = TextEditingController();
    bool isSavingCode = false;

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) {
          final vouchers = _apiVouchers.isNotEmpty
              ? _apiVouchers
              : [
                  Voucher(id: 1, code: 'NOVA20K', name: 'Giảm 20.000₫ cho đơn từ 200k', discountAmount: 20000, minSubtotal: 200000),
                  Voucher(id: 2, code: 'FREESHIPMAX', name: 'Giảm 30.000₫ phí vận chuyển đơn từ 99k', discountAmount: 30000, minSubtotal: 99000),
                  Voucher(id: 3, code: 'CHAOBANMOI', name: 'Giảm 50.000₫ cho đơn từ 150k', discountAmount: 50000, minSubtotal: 150000),
                  Voucher(id: 4, code: 'NOVAMEGA50', name: 'Giảm 50.000₫ cho đơn từ 350k', discountAmount: 50000, minSubtotal: 350000),
                ];

          return Container(
            constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.8),
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
                      Row(
                        children: const [
                          Icon(Icons.confirmation_number_outlined, color: AppColors.primary),
                          SizedBox(width: 8),
                          Text('Ví Voucher Của Tôi', style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: const Color(0xFFE8F5E9),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: const Color(0xFFC8E6C9)),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.check_circle, color: Color(0xFF2E7D32), size: 13),
                            SizedBox(width: 4),
                            Text('API Wallet Live', style: TextStyle(color: Color(0xFF2E7D32), fontSize: 11, fontWeight: FontWeight.bold)),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  // Ô nhập mã lưu vào ví
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF9FAFB),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFE5E7EB)),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: codeInputController,
                            textCapitalization: TextCapitalization.characters,
                            decoration: const InputDecoration(
                              hintText: 'Nhập mã giảm giá (VD: NOVA20K)',
                              hintStyle: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)),
                              isDense: true,
                              contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                              border: InputBorder.none,
                            ),
                          ),
                        ),
                        ElevatedButton(
                          onPressed: isSavingCode
                              ? null
                              : () async {
                                  final code = codeInputController.text.trim().toUpperCase();
                                  if (code.isEmpty) return;
                                  setModalState(() => isSavingCode = true);
                                  final res = await VoucherService().saveVoucherToWallet(code);
                                  setModalState(() {
                                    isSavingCode = false;
                                    if (res['success'] == true) {
                                      _savedVouchers.add(code);
                                      codeInputController.clear();
                                    }
                                  });
                                  setState(() {
                                    if (res['success'] == true) {
                                      _savedVouchers.add(code);
                                    }
                                  });
                                  if (mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        content: Text(res['message']?.toString() ?? 'Đã lưu voucher vào ví.'),
                                        backgroundColor: res['success'] == true ? const Color(0xFF16A34A) : Colors.red,
                                        duration: const Duration(seconds: 2),
                                      ),
                                    );
                                  }
                                },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: primaryColor,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                            minimumSize: const Size(0, 34),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                          child: isSavingCode
                              ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                              : const Text('Lưu vào ví', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  ...vouchers.map((v) {
                    final isSaved = _savedVouchers.contains(v.code);
                    return Container(
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
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: AppColors.primary.withOpacity(0.1),
                                        borderRadius: BorderRadius.circular(4),
                                      ),
                                      child: Text(
                                        v.code,
                                        style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.primary, fontSize: 11),
                                      ),
                                    ),
                                    const SizedBox(width: 6),
                                    Expanded(
                                      child: Text(
                                        v.discountFormatted,
                                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF1E2022)),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  v.name,
                                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: Color(0xFF2B2B2B)),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  v.minSubtotalFormatted,
                                  style: const TextStyle(fontSize: 11, color: Color(0xFF8F90A6)),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          ElevatedButton(
                            onPressed: () async {
                              final res = await VoucherService().saveVoucherToWallet(v.code);
                              setModalState(() {
                                _savedVouchers.add(v.code);
                              });
                              setState(() {
                                _savedVouchers.add(v.code);
                              });
                              _copyToClipboard(v.code);
                              if (mounted && res['message'] != null) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text(res['message'].toString()),
                                    backgroundColor: const Color(0xFF1E2022),
                                    duration: const Duration(seconds: 2),
                                  ),
                                );
                              }
                            },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: isSaved ? const Color(0xFFE8F5E9) : primaryColor,
                              foregroundColor: isSaved ? const Color(0xFF2E7D32) : Colors.white,
                              elevation: isSaved ? 0 : 1,
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                              minimumSize: const Size(0, 32),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(6),
                                side: isSaved ? const BorderSide(color: Color(0xFF81C784)) : BorderSide.none,
                              ),
                            ),
                            child: Text(
                              isSaved ? 'Đã lưu ✓' : 'Lưu mã',
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                            ),
                          ),
                        ],
                      ),
                    );
                  }),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  void _showSellerAppNoticeDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(Icons.storefront_rounded, color: Color(0xFF00796B), size: 24),
            SizedBox(width: 8),
            Text('Kênh Người Bán ShopNova', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Tính năng quản lý shop, xử lý đơn hàng và đăng sản phẩm đã được chuyển sang ứng dụng riêng biệt:',
              style: TextStyle(fontSize: 13, color: Color(0xFF555770)),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFE0F2F1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Row(
                children: [
                  Icon(Icons.check_circle_rounded, color: Color(0xFF00796B), size: 20),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text('Ứng dụng: ShopNova Seller', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF004D40))),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            const Text(
              'Vui lòng tải hoặc mở ứng dụng ShopNova Seller trên thiết bị để đăng nhập và quản lý gian hàng của bạn.',
              style: TextStyle(fontSize: 12, color: Color(0xFF8F90A6)),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const SellerRegisterScreen()),
              );
            },
            child: const Text('Đăng ký mở shop mới', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx),
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF00796B), foregroundColor: Colors.white),
            child: const Text('Đã hiểu'),
          ),
        ],
      ),
    );
  }

  Widget _buildStatsBar(BuildContext context) {
    final orderCount = _backendStats?['orderCount'] ?? 0;
    final totalSpent = _backendStats?['totalSpent'] ?? 0;
    final voucherCount = _backendStats?['voucherCount'] ?? (_apiVouchers.isNotEmpty ? _apiVouchers.length : 4);

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
                  Icon(Icons.assignment_outlined, color: AppColors.primary, size: 18),
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
            decoration: const BoxDecoration(color: AppColors.surfaceAlt, shape: BoxShape.circle),
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
    final vouchers = _apiVouchers.isNotEmpty
        ? _apiVouchers
        : [
            Voucher(id: 1, code: 'NOVA20K', name: 'Giảm 20.000₫ cho đơn từ 200k', discountAmount: 20000, minSubtotal: 200000),
            Voucher(id: 2, code: 'FREESHIPMAX', name: 'Giảm 30.000₫ phí vận chuyển đơn từ 99k', discountAmount: 30000, minSubtotal: 99000),
            Voucher(id: 3, code: 'CHAOBANMOI', name: 'Giảm 50.000₫ cho đơn từ 150k', discountAmount: 50000, minSubtotal: 150000),
            Voucher(id: 4, code: 'NOVAMEGA50', name: 'Giảm 50.000₫ cho đơn từ 350k', discountAmount: 50000, minSubtotal: 350000),
          ];

    final colors = [
      const Color(0xFF00BFA5),
      const Color(0xFFD97706),
      const Color(0xFFD0011B),
      const Color(0xFF1E88E5),
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
                  Icon(Icons.confirmation_number_outlined, color: AppColors.primary, size: 18),
                  SizedBox(width: 6),
                  Text('Ví Voucher & Ưu Đãi', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF1E2022))),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0xFFE8F5E9),
                  borderRadius: BorderRadius.circular(4),
                  border: Border.all(color: const Color(0xFFC8E6C9)),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.bolt, color: Color(0xFF2E7D32), size: 12),
                    SizedBox(width: 2),
                    Text('API Đang hoạt động', style: TextStyle(color: Color(0xFF2E7D32), fontSize: 10, fontWeight: FontWeight.bold)),
                  ],
                ),
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
                final col = colors[idx % colors.length];
                final isSaved = _savedVouchers.contains(v.code);
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
                              v.code,
                              style: TextStyle(color: col, fontWeight: FontWeight.bold, fontSize: 10),
                            ),
                          ),
                          GestureDetector(
                            onTap: () async {
                              await VoucherService().saveVoucher(v.code);
                              setState(() {
                                _savedVouchers.add(v.code);
                              });
                              _copyToClipboard(v.code);
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: isSaved ? const Color(0xFFE8F5E9) : primaryColor,
                                borderRadius: BorderRadius.circular(4),
                                border: isSaved ? Border.all(color: const Color(0xFF81C784)) : null,
                              ),
                              child: Text(
                                isSaved ? 'Đã lưu ✓' : 'Lưu mã',
                                style: TextStyle(
                                  color: isSaved ? const Color(0xFF2E7D32) : Colors.white,
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                      Text(
                        v.discountFormatted,
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Color(0xFF1E2022)),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      Text(
                        '${v.name} • ${v.minSubtotalFormatted}',
                        style: const TextStyle(fontSize: 10, color: Color(0xFF8F90A6)),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
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
              icon: Icons.add_business_rounded,
              title: 'Đăng Ký Đối Tác Bán Hàng',
              subtitle: 'Mở gian hàng 0đ, tiếp cận triệu khách hàng toàn quốc',
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const SellerRegisterScreen()),
                );
              },
            ),
            const Divider(height: 1, indent: 52, color: Color(0xFFEEEEF0)),
            _buildSettingsTile(
              icon: Icons.storefront_rounded,
              title: 'Quản Lý Shop (App Seller)',
              subtitle: 'Mở ứng dụng ShopNova Seller để quản lý kho và đơn bán',
              onTap: _showSellerAppNoticeDialog,
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

  Future<void> _checkServerStatus({bool showToast = false}) async {
    if (!mounted) return;
    setState(() {
      _isCheckingServer = true;
    });

    final status = await AuthService().checkFullConnectionStatus();
    if (!mounted) return;

    setState(() {
      _isCheckingServer = false;
      _serverStatus = status;
    });

    if (showToast) {
      final isSuccess = status['isReady'] == true;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              Icon(
                isSuccess ? Icons.check_circle_rounded : Icons.warning_amber_rounded,
                color: Colors.white,
                size: 20,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  isSuccess
                      ? 'Kết nối máy chủ thành công! (${status['latencyMs']} ms)'
                      : 'Cảnh báo kết nối: ${status['message']}',
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
                ),
              ),
            ],
          ),
          backgroundColor: isSuccess ? const Color(0xFF16A34A) : const Color(0xFFD97706),
          duration: const Duration(seconds: 3),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
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
          title: Row(
            children: const [
              Icon(Icons.dns_rounded, color: Color(0xFF2563EB), size: 22),
              SizedBox(width: 8),
              Text('Cấu hình Backend API', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Chọn cấu hình máy chủ hoặc nhập URL tùy chỉnh:',
                style: TextStyle(fontSize: 12, color: Color(0xFF555770)),
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
                    label: const Text('Wi-Fi LAN', style: TextStyle(fontSize: 11)),
                    onPressed: () {
                      setDialogState(() {
                        controller.text = ApiConfig.lanHostUrl;
                      });
                    },
                  ),
                  ActionChip(
                    avatar: const Icon(Icons.usb_rounded, size: 16, color: Colors.orange),
                    label: const Text('USB Debug', style: TextStyle(fontSize: 11)),
                    onPressed: () {
                      setDialogState(() {
                        controller.text = ApiConfig.usbLoopbackUrl;
                      });
                    },
                  ),
                  ActionChip(
                    avatar: const Icon(Icons.computer_rounded, size: 16, color: Colors.grey),
                    label: const Text('Máy ảo 10.0.2.2', style: TextStyle(fontSize: 11)),
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
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  isDense: true,
                  hintText: 'https://novashop-api-952u.onrender.com',
                ),
                style: const TextStyle(fontSize: 12, fontFamily: 'monospace'),
              ),
              const SizedBox(height: 8),
              const Text(
                '💡 Render Cloud là máy chủ trực tuyến, cho phép truy cập độc lập không cần máy tính.',
                style: TextStyle(fontSize: 11, color: Color(0xFF8F90A6), height: 1.3),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () {
                ApiConfig.resetBaseUrl();
                Navigator.pop(ctx);
                _checkServerStatus(showToast: true);
              },
              child: const Text('Mặc định', style: TextStyle(color: Colors.grey)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF2563EB),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              onPressed: () {
                if (controller.text.trim().isNotEmpty) {
                  ApiConfig.setBaseUrl(controller.text.trim());
                }
                Navigator.pop(ctx);
                _checkServerStatus(showToast: true);
              },
              child: const Text('Lưu & Kiểm tra', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildServerConfigSection(BuildContext context) {
    final status = _serverStatus;
    final isOnline = status?['isOnline'] == true;
    final isReady = status?['isReady'] == true;
    final latency = status?['latencyMs'];

    Color badgeBg;
    Color badgeBorder;
    Color badgeText;
    IconData badgeIcon;
    String badgeLabel;

    if (_isCheckingServer) {
      badgeBg = const Color(0xFFEFF6FF);
      badgeBorder = const Color(0xFFBFDBFE);
      badgeText = const Color(0xFF1D4ED8);
      badgeIcon = Icons.hourglass_top_rounded;
      badgeLabel = 'Đang kiểm tra...';
    } else if (status == null) {
      badgeBg = const Color(0xFFF3F4F6);
      badgeBorder = const Color(0xFFE5E7EB);
      badgeText = const Color(0xFF4B5563);
      badgeIcon = Icons.help_outline_rounded;
      badgeLabel = 'Chưa kiểm tra';
    } else if (isReady) {
      badgeBg = const Color(0xFFF0FDF4);
      badgeBorder = const Color(0xFFBBF7D0);
      badgeText = const Color(0xFF15803D);
      badgeIcon = Icons.check_circle_rounded;
      badgeLabel = latency != null ? 'Đã kết nối ($latency ms)' : 'Đã kết nối';
    } else if (isOnline) {
      badgeBg = const Color(0xFFFFFBEB);
      badgeBorder = const Color(0xFFFDE68A);
      badgeText = const Color(0xFFB45309);
      badgeIcon = Icons.warning_amber_rounded;
      badgeLabel = 'CSDL ngắt kết nối';
    } else {
      badgeBg = const Color(0xFFFEF2F2);
      badgeBorder = const Color(0xFFFECACA);
      badgeText = const Color(0xFFB91C1C);
      badgeIcon = Icons.cancel_rounded;
      badgeLabel = 'Mất kết nối';
    }

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
                  Icon(Icons.dns_rounded, color: Color(0xFF2563EB), size: 18),
                  SizedBox(width: 8),
                  Text('Máy Chủ & Cơ Sở Dữ Liệu', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF1E2022))),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: badgeBg,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: badgeBorder),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (_isCheckingServer)
                      const SizedBox(
                        width: 10,
                        height: 10,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF1D4ED8)),
                      )
                    else
                      Icon(badgeIcon, color: badgeText, size: 12),
                    const SizedBox(width: 4),
                    Text(badgeLabel, style: TextStyle(color: badgeText, fontSize: 10, fontWeight: FontWeight.bold)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Row(
              children: [
                const Icon(Icons.link_rounded, size: 14, color: Color(0xFF64748B)),
                const SizedBox(width: 6),
                Expanded(
                  child: SelectableText(
                    ApiConfig.baseUrl,
                    style: const TextStyle(fontSize: 11, color: Color(0xFF334155), fontFamily: 'monospace'),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          // 3 trạng thái chi tiết của Backend, Data API, CSDL MySQL
          Row(
            children: [
              Expanded(
                child: _buildServiceStatusChip(
                  label: 'Backend API',
                  status: status?['backend'] ?? (_isCheckingServer ? 'Kiểm tra...' : '---'),
                  isOk: isOnline,
                  icon: Icons.code_rounded,
                ),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: _buildServiceStatusChip(
                  label: 'Data API',
                  status: status?['dataApi'] ?? (_isCheckingServer ? 'Kiểm tra...' : '---'),
                  isOk: isReady,
                  icon: Icons.hub_rounded,
                ),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: _buildServiceStatusChip(
                  label: 'CSDL MySQL',
                  status: status?['database'] ?? (_isCheckingServer ? 'Kiểm tra...' : '---'),
                  isOk: isReady,
                  icon: Icons.storage_rounded,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          // Nút bấm thao tác: Kiểm tra kết nối lại & Đổi máy chủ
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    side: const BorderSide(color: Color(0xFFCBD5E1)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  icon: _isCheckingServer
                      ? const SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF2563EB)),
                        )
                      : const Icon(Icons.refresh_rounded, size: 16, color: Color(0xFF2563EB)),
                  label: const Text('Kiểm tra lại', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF2563EB))),
                  onPressed: _isCheckingServer ? null : () => _checkServerStatus(showToast: true),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    side: const BorderSide(color: Color(0xFFCBD5E1)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  icon: const Icon(Icons.settings_outlined, size: 16, color: Color(0xFF475569)),
                  label: const Text('Đổi máy chủ', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF475569))),
                  onPressed: _showChangeServerDialog,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildServiceStatusChip({
    required String label,
    required String status,
    required bool isOk,
    required IconData icon,
  }) {
    final color = isOk ? const Color(0xFF16A34A) : const Color(0xFFDC2626);
    final bgColor = isOk ? const Color(0xFFF0FDF4) : const Color(0xFFFEF2F2);
    final borderColor = isOk ? const Color(0xFFBBF7D0) : const Color(0xFFFECACA);

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 6),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: borderColor),
      ),
      child: Column(
        children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(height: 3),
          Text(label, style: const TextStyle(fontSize: 10, color: Color(0xFF64748B), fontWeight: FontWeight.w500)),
          const SizedBox(height: 2),
          Text(
            status,
            style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: color),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
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
            icon: const Icon(Icons.logout_rounded, color: AppColors.primary, size: 18),
            label: const Text('Đăng xuất tài khoản', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold)),
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
