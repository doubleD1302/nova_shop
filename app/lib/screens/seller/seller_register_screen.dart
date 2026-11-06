import 'package:flutter/material.dart';
import '../../services/auth_service.dart';
import '../../services/upload_service.dart';
import '../auth/login_screen.dart';
import 'seller_hub_screen.dart';
import '../../theme/app_colors.dart';

/// Màn hình Đăng Ký Đối Tác Bán Hàng / Mở Gian Hàng ShopNova
/// Quy trình 3 bước chuẩn:
/// - Bước 1: Khởi tạo tài khoản, ngân hàng đối soát & KYC (Registration & KYC)
/// - Bước 2: Thiết lập hồ sơ & Cấu hình gian hàng tại Seller Center (Store Profile Setup)
/// - Bước 3: Kiểm duyệt từ Admin Sàn ShopNova (Admin Approval & Moderation)
class SellerRegisterScreen extends StatefulWidget {
  const SellerRegisterScreen({super.key});

  @override
  State<SellerRegisterScreen> createState() => _SellerRegisterScreenState();
}

class _SellerRegisterScreenState extends State<SellerRegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final AuthService _authService = AuthService();

  // Controllers thông tin cơ bản
  final TextEditingController _shopNameController = TextEditingController();
  final TextEditingController _taglineController = TextEditingController();
  final TextEditingController _fullNameController = TextEditingController();
  final TextEditingController _phoneController = TextEditingController();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();

  // Thông tin ngân hàng đối soát doanh thu (Bước 1)
  final TextEditingController _bankNameController = TextEditingController(text: 'Vietcombank');
  final TextEditingController _bankAccountNumberController = TextEditingController();
  final TextEditingController _bankAccountOwnerController = TextEditingController();

  // KYC (CCCD/CMND mặt trước & mặt sau - UploadService purpose: 'shop')
  String? _idCardFrontUrl;
  String? _idCardBackUrl;
  bool _isUploadingFront = false;
  bool _isUploadingBack = false;

  String _selectedProvince = 'TP. Hồ Chí Minh';
  String _selectedCategory = 'dien-thoai';
  bool _agreeTerms = true;
  bool _isLoading = false;
  bool _obscurePassword = true;

  final List<String> _provinces = [
    'TP. Hồ Chí Minh',
    'Hà Nội',
    'Đà Nẵng',
    'Cần Thơ',
    'Hải Phòng',
    'Bình Dương',
    'Đồng Nai',
    'Khánh Hòa',
    'Quảng Ninh',
    'Bắc Ninh',
    'Thừa Thiên Huế',
    'Nghệ An',
    'Lâm Đồng',
    'Tiền Giang',
    'Toàn quốc',
  ];

  final List<Map<String, String>> _categories = [
    {'id': 'dien-thoai', 'name': 'Điện thoại & Phụ kiện', 'icon': '📱'},
    {'id': 'may-tinh', 'name': 'Máy tính & Laptop', 'icon': '💻'},
    {'id': 'thiet-bi-gia-dung', 'name': 'Thiết bị gia dụng', 'icon': '🔌'},
    {'id': 'thoi-trang-nam', 'name': 'Thời trang nam', 'icon': '👕'},
    {'id': 'thoi-trang-nu', 'name': 'Thời trang nữ', 'icon': '👗'},
    {'id': 'sac-dep', 'name': 'Sắc đẹp & Mỹ phẩm', 'icon': '💄'},
    {'id': 'nha-cua', 'name': 'Nhà cửa & Đời sống', 'icon': '🏡'},
    {'id': 'me-be', 'name': 'Mẹ & Bé yêu', 'icon': '🍼'},
    {'id': 'the-thao', 'name': 'Thể thao & Du lịch', 'icon': '⚽'},
    {'id': 'o-to-xe-may', 'name': 'Ô tô & Xe máy', 'icon': '🏍️'},
    {'id': 'may-anh', 'name': 'Máy ảnh & Quay phim', 'icon': '📷'},
    {'id': 'bach-hoa', 'name': 'Bách hóa Online', 'icon': '🛒'},
  ];

  @override
  void initState() {
    super.initState();
    final user = _authService.currentUser;
    if (user != null) {
      _fullNameController.text = user.fullName;
      if (user.phone != null && user.phone!.isNotEmpty) {
        _phoneController.text = user.phone!;
      }
      if (user.email != null && user.email!.isNotEmpty) {
        _emailController.text = user.email!;
      }
      _shopNameController.text = '${user.fullName} Store';
      _bankAccountOwnerController.text = user.fullName.toUpperCase();
    }
  }

  @override
  void dispose() {
    _shopNameController.dispose();
    _taglineController.dispose();
    _fullNameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _bankNameController.dispose();
    _bankAccountNumberController.dispose();
    _bankAccountOwnerController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    if (!_agreeTerms) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Vui lòng đồng ý với Điều khoản đối tác bán hàng của ShopNova.'),
          backgroundColor: Color(0xFFD0011B),
        ),
      );
      return;
    }

    setState(() => _isLoading = true);

    final shopName = _shopNameController.text.trim();
    final tagline = _taglineController.text.trim();
    final province = _selectedProvince;

    final user = _authService.currentUser;
    bool success = false;

    if (user != null) {
      // 1. Người dùng đã đăng nhập -> Nâng cấp tài khoản lên Seller
      success = await _authService.registerSellerShop(
        shopName: shopName,
        province: province,
        tagline: tagline.isNotEmpty ? tagline : 'Cung cấp sản phẩm chính hãng chất lượng cao',
      );
    } else {
      // 2. Người dùng mới -> Đăng ký tài khoản Seller mới
      final fullName = _fullNameController.text.trim();
      final phone = _phoneController.text.trim().replaceAll(RegExp(r'\s+'), '');
      final password = _passwordController.text;

      success = await _authService.register(
        username: phone.toLowerCase(),
        password: password,
        fullName: fullName,
        phone: phone,
        role: 'seller',
        shopName: shopName,
      );
    }

    if (!mounted) return;
    setState(() => _isLoading = false);

    if (success) {
      _showSuccessDialog(shopName);
    } else {
      final error = _authService.lastError ?? 'Đăng ký gian hàng thất bại. Vui lòng thử lại.';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error),
          backgroundColor: const Color(0xFFD0011B),
        ),
      );
    }
  }

  void _showSuccessDialog(String shopName) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        contentPadding: const EdgeInsets.fromLTRB(24, 28, 24, 20),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 76,
              height: 76,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF00BFA5), Color(0xFF00897B)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF00BFA5).withValues(alpha: 0.35),
                    blurRadius: 16,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: const Icon(Icons.storefront_rounded, color: Colors.white, size: 42),
            ),
            const SizedBox(height: 18),
            const Text(
              'CHÚC MỪNG BẠN!',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w900,
                color: Color(0xFF1E2022),
                letterSpacing: 0.3,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Gian hàng "$shopName" đã được khởi tạo thành công trên hệ sinh thái ShopNova.',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 13, color: Color(0xFF555770), height: 1.4),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFFF7F7F8),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFE2E2E6)),
              ),
              child: const Row(
                children: [
                  Icon(Icons.verified_rounded, color: AppColors.primary, size: 18),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Hồ sơ đang ở trạng thái Chờ Duyệt. Bạn có thể vào Kênh Người Bán để cấu hình logo, banner và địa chỉ kho.',
                      style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: Color(0xFF28293D)),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              height: 46,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.pop(ctx);
                  Navigator.pushReplacement(
                    context,
                    MaterialPageRoute(builder: (_) => const SellerHubScreen()),
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text('Vào Kênh Người Bán Ngay', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
                    SizedBox(width: 6),
                    Icon(Icons.arrow_forward_rounded, size: 18),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = _authService.currentUser;
    final isLoggedIn = user != null;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text(
          'Đăng Ký Đối Tác Bán Hàng',
          style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: Colors.white),
        ),
        elevation: 0,
        backgroundColor: AppColors.primary,
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [AppColors.primary, AppColors.earth],
              begin: Alignment.centerLeft,
              end: Alignment.centerRight,
            ),
          ),
        ),
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // 1. HERO HEADER
            Container(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [AppColors.primary, AppColors.earth],
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                ),
                borderRadius: BorderRadius.vertical(bottom: Radius.circular(24)),
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: Colors.white.withValues(alpha: 0.3)),
                        ),
                        child: const Icon(Icons.rocket_launch_rounded, color: Colors.white, size: 32),
                      ),
                      const SizedBox(width: 14),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Khởi Nghiệp Bán Hàng 0đ',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 18,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                            SizedBox(height: 4),
                            Text(
                              'Tiếp cận hơn 5 triệu người mua sắm tích cực trên ShopNova ngay hôm nay.',
                              style: TextStyle(color: Colors.white, fontSize: 12.5, height: 1.3),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 14),

            // 2. 4 ĐẶC QUYỀN ĐỐI TÁC SHOPNOVA
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'ĐẶC QUYỀN DÀNH CHO BẠN',
                    style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF6E7191),
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: _buildPerkCard(
                          icon: Icons.money_off_csred_rounded,
                          color: const Color(0xFF00BFA5),
                          title: '0đ Phí mở shop',
                          desc: 'Không đặt cọc, không phí duy trì hàng tháng',
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _buildPerkCard(
                          icon: Icons.local_shipping_rounded,
                          color: const Color(0xFF2979FF),
                          title: 'Freeship Xtra',
                          desc: 'Hỗ trợ trợ giá ship toàn quốc cho khách hàng',
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: _buildPerkCard(
                          icon: Icons.auto_awesome_rounded,
                          color: const Color(0xFFFF9100),
                          title: 'Nova AI Bán Hàng',
                          desc: 'Tự động gợi ý giá, mô tả sản phẩm thông minh',
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _buildPerkCard(
                          icon: Icons.flash_on_rounded,
                          color: AppColors.primary,
                          title: 'Khung Giờ Flash',
                          desc: 'Ưu tiên đẩy sản phẩm vào khung giờ chớp nhoáng',
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // QUY TRÌNH 3 BƯỚC ĐỐI TÁC BÁN HÀNG
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFEEEEF0)),
                  boxShadow: const [
                    BoxShadow(color: Color(0x06000000), blurRadius: 6, offset: Offset(0, 2)),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'QUY TRÌNH 3 BƯỚC MỞ GIAN HÀNG',
                      style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold, color: AppColors.primary),
                    ),
                    const SizedBox(height: 10),
                    _buildProcessStep(
                      step: '1',
                      title: 'Khởi tạo tài khoản & Định danh KYC',
                      desc: 'Cung cấp tên shop, email, mật khẩu & tài khoản ngân hàng chính chủ nhận doanh thu',
                      isCurrent: true,
                    ),
                    _buildProcessStep(
                      step: '2',
                      title: 'Thiết lập hồ sơ & Cấu hình gian hàng',
                      desc: 'Cập nhật logo, ảnh bìa banner, địa chỉ kho lấy hàng mặc định tại Seller Center',
                      isCurrent: false,
                    ),
                    _buildProcessStep(
                      step: '3',
                      title: 'Kiểm duyệt từ Admin sàn ShopNova',
                      desc: 'Admin phê duyệt trạng thái "Đang hoạt động" để shop chính thức đăng bán sản phẩm',
                      isCurrent: false,
                      isLast: true,
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 16),

            // 3. FORM ĐĂNG KÝ
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.04),
                      blurRadius: 10,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 4,
                            height: 18,
                            decoration: BoxDecoration(
                              color: AppColors.primary,
                              borderRadius: BorderRadius.circular(2),
                            ),
                          ),
                          const SizedBox(width: 8),
                          const Text(
                            'Thông Tin Gian Hàng Của Bạn',
                            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Color(0xFF1E2022)),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Vui lòng điền thông tin chính xác để tối ưu khả năng tìm kiếm của khách hàng.',
                        style: TextStyle(fontSize: 12, color: Color(0xFF8F90A6)),
                      ),
                      const SizedBox(height: 16),

                      // Tài khoản đang liên kết
                      if (isLoggedIn) ...[
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          decoration: BoxDecoration(
                            color: AppColors.surfaceAlt,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: AppColors.border),
                          ),
                          child: Row(
                            children: [
                              const CircleAvatar(
                                radius: 16,
                                backgroundColor: AppColors.primary,
                                child: Icon(Icons.person, color: Colors.white, size: 18),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      user.fullName,
                                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF1E2022)),
                                    ),
                                    Text(
                                      'Tài khoản: @${user.username} (${user.role == 'seller' ? 'Đã là Người bán' : 'Thành viên nâng cấp'})',
                                      style: const TextStyle(fontSize: 11, color: Color(0xFF555770)),
                                    ),
                                  ],
                                ),
                              ),
                              const Icon(Icons.check_circle_rounded, color: Color(0xFF00BFA5), size: 20),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
                      ],

                      // 1. Tên gian hàng
                      _buildFieldLabel('Tên Gian Hàng / Shop Name *'),
                      TextFormField(
                        controller: _shopNameController,
                        decoration: _inputDecoration(
                          hint: 'VD: NovaAudio Official, Gia Dụng 24h...',
                          prefixIcon: Icons.store_rounded,
                        ),
                        validator: (val) {
                          if (val == null || val.trim().isEmpty) return 'Vui lòng nhập tên gian hàng của bạn.';
                          if (val.trim().length < 3) return 'Tên gian hàng tối thiểu 3 ký tự.';
                          return null;
                        },
                      ),
                      const SizedBox(height: 14),

                      // 2. Tỉnh / Thành phố kho hàng
                      _buildFieldLabel('Tỉnh / Thành Phố Kho Hàng *'),
                      DropdownButtonFormField<String>(
                        initialValue: _selectedProvince,
                        decoration: _inputDecoration(
                          prefixIcon: Icons.location_on_rounded,
                        ),
                        items: _provinces.map((p) {
                          return DropdownMenuItem(value: p, child: Text(p, style: const TextStyle(fontSize: 13.5)));
                        }).toList(),
                        onChanged: (val) {
                          if (val != null) setState(() => _selectedProvince = val);
                        },
                      ),
                      const SizedBox(height: 14),

                      // 3. Khẩu hiệu / Giới thiệu
                      _buildFieldLabel('Khẩu Hiệu / Giới Thiệu Ngắn'),
                      TextFormField(
                        controller: _taglineController,
                        maxLines: 2,
                        decoration: _inputDecoration(
                          hint: 'VD: Chuyên đồ công nghệ chính hãng 100%, bảo hành 12 tháng, giao hàng 2h.',
                          prefixIcon: Icons.format_quote_rounded,
                        ),
                      ),
                      const SizedBox(height: 14),

                      // 4. Ngành hàng chủ lực
                      _buildFieldLabel('Ngành Hàng Kinh Doanh Chính'),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: _categories.map((cat) {
                          final isSelected = _selectedCategory == cat['id'];
                          return InkWell(
                            borderRadius: BorderRadius.circular(20),
                            onTap: () => setState(() => _selectedCategory = cat['id']!),
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 180),
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                              decoration: BoxDecoration(
                                color: isSelected ? AppColors.surfaceAlt : const Color(0xFFF7F7F8),
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(
                                  color: isSelected ? AppColors.primary : const Color(0xFFE2E2E6),
                                  width: isSelected ? 1.5 : 1.0,
                                ),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(cat['icon']!, style: const TextStyle(fontSize: 13)),
                                  const SizedBox(width: 5),
                                  Text(
                                    cat['name']!,
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                                      color: isSelected ? AppColors.primary : const Color(0xFF333333),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        }).toList(),
                      ),

                      // 5. Nếu chưa đăng nhập: Yêu cầu tạo tài khoản mới
                      if (!isLoggedIn) ...[
                        const SizedBox(height: 20),
                        const Divider(height: 1, color: Color(0xFFEEEEF0)),
                        const SizedBox(height: 16),
                        Row(
                          children: [
                            Container(
                              width: 4,
                              height: 18,
                              decoration: BoxDecoration(
                                color: const Color(0xFF2979FF),
                                borderRadius: BorderRadius.circular(2),
                              ),
                            ),
                            const SizedBox(width: 8),
                            const Text(
                              'Thông Tin Tài Khoản Đối Tác Mới',
                              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Color(0xFF1E2022)),
                            ),
                          ],
                        ),
                        const SizedBox(height: 14),

                        _buildFieldLabel('Họ và Tên Chủ Shop *'),
                        TextFormField(
                          controller: _fullNameController,
                          decoration: _inputDecoration(
                            hint: 'VD: Nguyễn Văn A',
                            prefixIcon: Icons.badge_rounded,
                          ),
                          validator: (val) {
                            if (val == null || val.trim().isEmpty) return 'Vui lòng nhập họ và tên.';
                            return null;
                          },
                        ),
                        const SizedBox(height: 14),

                        _buildFieldLabel('Số Điện Thoại / Tên Đăng Nhập *'),
                        TextFormField(
                          controller: _phoneController,
                          keyboardType: TextInputType.phone,
                          decoration: _inputDecoration(
                            hint: 'VD: 0987654321',
                            prefixIcon: Icons.phone_android_rounded,
                          ),
                          validator: (val) {
                            if (val == null || val.trim().isEmpty) return 'Vui lòng nhập số điện thoại.';
                            final clean = val.replaceAll(RegExp(r'\D'), '');
                            if (clean.length < 9) return 'Số điện thoại không hợp lệ.';
                            return null;
                          },
                        ),
                        const SizedBox(height: 14),

                        _buildFieldLabel('Mật Khẩu Đăng Nhập *'),
                        TextFormField(
                          controller: _passwordController,
                          obscureText: _obscurePassword,
                          decoration: _inputDecoration(
                            hint: 'Tối thiểu 6 ký tự bảo mật',
                            prefixIcon: Icons.lock_rounded,
                            suffixIcon: IconButton(
                              icon: Icon(
                                _obscurePassword ? Icons.visibility_off : Icons.visibility,
                                color: const Color(0xFF8F90A6),
                                size: 20,
                              ),
                              onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                            ),
                          ),
                          validator: (val) {
                            if (val == null || val.length < 6) return 'Mật khẩu phải có ít nhất 6 ký tự.';
                            return null;
                          },
                        ),
                        const SizedBox(height: 10),

                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Text('Đã có tài khoản ShopNova? ', style: TextStyle(fontSize: 12.5, color: Color(0xFF555770))),
                            InkWell(
                              onTap: () async {
                                await Navigator.push(context, MaterialPageRoute(builder: (_) => const LoginScreen()));
                                setState(() {});
                              },
                              child: const Text(
                                'Đăng nhập ngay',
                                style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold, color: AppColors.primary),
                              ),
                            ),
                          ],
                        ),
                      ],

                      // Email liên hệ & đối soát
                      const SizedBox(height: 16),
                      _buildFieldLabel('Email Liên Hệ Đối Soát & Nhận Đơn'),
                      TextFormField(
                        controller: _emailController,
                        keyboardType: TextInputType.emailAddress,
                        decoration: _inputDecoration(
                          hint: 'VD: seller@shopnova.vn (Tùy chọn)',
                          prefixIcon: Icons.email_outlined,
                        ),
                      ),

                      // THÔNG TIN TÀI KHOẢN NGÂN HÀNG (BƯỚC 1)
                      const SizedBox(height: 20),
                      const Divider(height: 1, color: Color(0xFFEEEEF0)),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          Container(
                            width: 4,
                            height: 18,
                            decoration: BoxDecoration(
                              color: const Color(0xFF00BFA5),
                              borderRadius: BorderRadius.circular(2),
                            ),
                          ),
                          const SizedBox(width: 8),
                          const Text(
                            'Tài Khoản Ngân Hàng Nhận Doanh Thu',
                            style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800, color: Color(0xFF1E2022)),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Thông tin tài khoản chính chủ để ShopNova thực hiện đối soát và chuyển tiền bán hàng.',
                        style: TextStyle(fontSize: 11.5, color: Color(0xFF8F90A6)),
                      ),
                      const SizedBox(height: 14),

                      _buildFieldLabel('Ngân Hàng Thụ Hưởng *'),
                      TextFormField(
                        controller: _bankNameController,
                        decoration: _inputDecoration(
                          hint: 'VD: Vietcombank, MB Bank, Techcombank, ACB...',
                          prefixIcon: Icons.account_balance_rounded,
                        ),
                      ),
                      const SizedBox(height: 12),

                      _buildFieldLabel('Số Tài Khoản Ngân Hàng *'),
                      TextFormField(
                        controller: _bankAccountNumberController,
                        keyboardType: TextInputType.number,
                        decoration: _inputDecoration(
                          hint: 'VD: 0123456789 (STK chính chủ)',
                          prefixIcon: Icons.credit_card_rounded,
                        ),
                      ),
                      const SizedBox(height: 12),

                      _buildFieldLabel('Tên Chủ Tài Khoản (Viết hoa không dấu) *'),
                      TextFormField(
                        controller: _bankAccountOwnerController,
                        textCapitalization: TextCapitalization.characters,
                        decoration: _inputDecoration(
                          hint: 'VD: NGUYEN VAN A',
                          prefixIcon: Icons.person_pin_rounded,
                        ),
                      ),

                      // XÁC THỰC ĐỊNH DANH KYC (CCCD / CMND)
                      const SizedBox(height: 20),
                      const Divider(height: 1, color: Color(0xFFEEEEF0)),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          Container(
                            width: 4,
                            height: 18,
                            decoration: BoxDecoration(
                              color: const Color(0xFFFF9100),
                              borderRadius: BorderRadius.circular(2),
                            ),
                          ),
                          const SizedBox(width: 8),
                          const Text(
                            'Xác Thực Định Danh Điện Tử (KYC - Tùy Chọn)',
                            style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800, color: Color(0xFF1E2022)),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Tải ảnh chụp CCCD/CMND 2 mặt để gian hàng được cấp huy hiệu Uy Tín và ưu tiên duyệt nhanh.',
                        style: TextStyle(fontSize: 11.5, color: Color(0xFF8F90A6)),
                      ),
                      const SizedBox(height: 12),

                      Row(
                        children: [
                          Expanded(
                            child: _buildKycUploadCard(
                              title: 'Mặt trước CCCD',
                              imageUrl: _idCardFrontUrl,
                              isLoading: _isUploadingFront,
                              onTap: () async {
                                setState(() => _isUploadingFront = true);
                                final res = await UploadService().pickAndUploadImage(purpose: 'shop');
                                setState(() {
                                  _isUploadingFront = false;
                                  if (res != null && res.success && res.url != null) {
                                    _idCardFrontUrl = res.url;
                                  } else if (res != null && res.error != null && mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(content: Text(res.error!), backgroundColor: const Color(0xFFD0011B)),
                                    );
                                  }
                                });
                              },
                              onRemove: () => setState(() => _idCardFrontUrl = null),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: _buildKycUploadCard(
                              title: 'Mặt sau CCCD',
                              imageUrl: _idCardBackUrl,
                              isLoading: _isUploadingBack,
                              onTap: () async {
                                setState(() => _isUploadingBack = true);
                                final res = await UploadService().pickAndUploadImage(purpose: 'shop');
                                setState(() {
                                  _isUploadingBack = false;
                                  if (res != null && res.success && res.url != null) {
                                    _idCardBackUrl = res.url;
                                  } else if (res != null && res.error != null && mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(content: Text(res.error!), backgroundColor: const Color(0xFFD0011B)),
                                    );
                                  }
                                });
                              },
                              onRemove: () => setState(() => _idCardBackUrl = null),
                            ),
                          ),
                        ],
                      ),

                      const SizedBox(height: 20),

                      // Cam kết điều khoản
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          SizedBox(
                            width: 24,
                            height: 24,
                            child: Checkbox(
                              value: _agreeTerms,
                              activeColor: AppColors.primary,
                              onChanged: (val) => setState(() => _agreeTerms = val ?? false),
                            ),
                          ),
                          const SizedBox(width: 8),
                          const Expanded(
                            child: Text(
                              'Tôi cam kết bán sản phẩm chính hãng, đầy đủ hóa đơn chứng từ và tuân thủ Quy chế hoạt động & Chính sách đối tác bán hàng của ShopNova.',
                              style: TextStyle(fontSize: 11.5, color: Color(0xFF555770), height: 1.35),
                            ),
                          ),
                        ],
                      ),

                      const SizedBox(height: 24),

                      // Nút Submit
                      Container(
                        width: double.infinity,
                        height: 50,
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [AppColors.primary, AppColors.earth],
                            begin: Alignment.centerLeft,
                            end: Alignment.centerRight,
                          ),
                          borderRadius: BorderRadius.circular(12),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.primary.withValues(alpha: 0.35),
                              blurRadius: 10,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: ElevatedButton(
                          onPressed: _isLoading ? null : _handleSubmit,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.transparent,
                            shadowColor: Colors.transparent,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          child: _isLoading
                              ? const SizedBox(
                                  width: 22,
                                  height: 22,
                                  child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                                )
                              : const Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(Icons.storefront_rounded, size: 20),
                                    SizedBox(width: 8),
                                    Text(
                                      'Hoàn Tất Đăng Ký Mở Gian Hàng',
                                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                                    ),
                                  ],
                                ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),

            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _buildFieldLabel(String label) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text(
        label,
        style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold, color: Color(0xFF28293D)),
      ),
    );
  }

  InputDecoration _inputDecoration({String? hint, IconData? prefixIcon, Widget? suffixIcon}) {
    return InputDecoration(
      hintText: hint,
      hintStyle: const TextStyle(fontSize: 13, color: Color(0xFFB0B0C0)),
      prefixIcon: prefixIcon != null ? Icon(prefixIcon, color: const Color(0xFF8F90A6), size: 19) : null,
      suffixIcon: suffixIcon,
      filled: true,
      fillColor: const Color(0xFFFAFAFB),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFFE2E2E6)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFFE2E2E6)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
      ),
    );
  }

  Widget _buildPerkCard({
    required IconData icon,
    required Color color,
    required String title,
    required String desc,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFEEEEF0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(height: 8),
          Text(
            title,
            style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: Color(0xFF1E2022)),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 2),
          Text(
            desc,
            style: const TextStyle(fontSize: 11, color: Color(0xFF6E7191), height: 1.25),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  Widget _buildProcessStep({
    required String step,
    required String title,
    required String desc,
    required bool isCurrent,
    bool isLast = false,
  }) {
    return Padding(
      padding: EdgeInsets.only(bottom: isLast ? 0 : 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 24,
            height: 24,
            decoration: BoxDecoration(
              color: isCurrent ? AppColors.primary : const Color(0xFFF0F1F5),
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: Text(
              step,
              style: TextStyle(
                color: isCurrent ? Colors.white : const Color(0xFF555770),
                fontWeight: FontWeight.bold,
                fontSize: 12,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Bước $step: $title',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: isCurrent ? FontWeight.bold : FontWeight.w600,
                    color: isCurrent ? AppColors.primary : const Color(0xFF1E2022),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  desc,
                  style: const TextStyle(fontSize: 11.5, color: Color(0xFF6E7191), height: 1.3),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildKycUploadCard({
    required String title,
    required String? imageUrl,
    required bool isLoading,
    required VoidCallback onTap,
    required VoidCallback onRemove,
  }) {
    final hasImage = imageUrl != null && imageUrl.isNotEmpty;
    return Container(
      height: 110,
      decoration: BoxDecoration(
        color: const Color(0xFFFAFAFB),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: hasImage ? const Color(0xFF00BFA5) : const Color(0xFFE2E2E6),
          width: hasImage ? 1.5 : 1,
        ),
      ),
      child: hasImage
          ? Stack(
              fit: StackFit.expand,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(9),
                  child: Image.network(
                    imageUrl,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => const Center(
                      child: Icon(Icons.credit_card_rounded, color: Colors.grey),
                    ),
                  ),
                ),
                Positioned(
                  top: 4,
                  right: 4,
                  child: InkWell(
                    onTap: onRemove,
                    child: Container(
                      padding: const EdgeInsets.all(3),
                      decoration: const BoxDecoration(color: Colors.black54, shape: BoxShape.circle),
                      child: const Icon(Icons.close_rounded, size: 14, color: Colors.white),
                    ),
                  ),
                ),
                Positioned(
                  bottom: 4,
                  left: 6,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(4)),
                    child: Text(title, style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                  ),
                ),
              ],
            )
          : InkWell(
              onTap: isLoading ? null : onTap,
              borderRadius: BorderRadius.circular(10),
              child: Center(
                child: isLoading
                    ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary))
                    : Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.add_a_photo_outlined, size: 24, color: Color(0xFF8F90A6)),
                          const SizedBox(height: 6),
                          Text(
                            title,
                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF555770)),
                          ),
                          const SizedBox(height: 2),
                          const Text(
                            'Tối đa 5MB (JPG/PNG)',
                            style: TextStyle(fontSize: 9.5, color: Color(0xFF8F90A6)),
                          ),
                        ],
                      ),
              ),
            ),
    );
  }
}
