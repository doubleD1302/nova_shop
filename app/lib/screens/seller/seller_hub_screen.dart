import 'package:flutter/material.dart';
import '../../models/order.dart';
import '../../models/shop.dart';
import '../../services/auth_service.dart';
import '../../services/api_client.dart';
import '../../services/seller_order_service.dart';
import '../../services/seller_product_service.dart';
import '../../services/shop_service.dart';
import '../../services/upload_service.dart';
import '../../config/api_config.dart';
import '../../utils/product_image_resolver.dart';
import 'seller_register_screen.dart';
import '../../theme/app_colors.dart';

/// Màn hình Kênh Người Bán / Seller Hub (Kết nối trực tiếp Backend API)
class SellerHubScreen extends StatefulWidget {
  const SellerHubScreen({super.key});

  @override
  State<SellerHubScreen> createState() => _SellerHubScreenState();
}

class _SellerHubScreenState extends State<SellerHubScreen> with SingleTickerProviderStateMixin {
  final Color primaryColor = AppColors.primary;
  late TabController _tabController;

  final SellerOrderService _orderService = SellerOrderService();
  final SellerProductService _productService = SellerProductService();
  final ShopService _shopService = ShopService();
  final ApiClient _client = ApiClient();

  Map<String, dynamic> _dashboard = {
    'revenue': 0,
    'pendingOrders': 0,
    'totalProducts': 0,
    'lowStockCount': 0,
  };
  bool _isLoadingDashboard = true;

  List<ShopOrder> _orders = [];
  bool _isLoadingOrders = true;
  String _selectedOrderStatus = '';

  List<SellerProductItem> _products = [];
  bool _isLoadingProducts = true;

  // Quản lý thông tin hồ sơ gian hàng
  Shop? _sellerShop;
  bool _isLoadingShop = true;
  bool _isSavingShop = false;
  bool _isResubmittingShop = false;

  final TextEditingController _shopNameCtrl = TextEditingController();
  final TextEditingController _shopTaglineCtrl = TextEditingController();
  final TextEditingController _shopDescCtrl = TextEditingController();
  final TextEditingController _shopProvinceCtrl = TextEditingController();
  final TextEditingController _shopAddressCtrl = TextEditingController();
  String? _shopLogoUrl;
  String? _shopBannerUrl;
  bool _isUploadingLogo = false;
  bool _isUploadingBanner = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    _loadDashboard();
    _loadOrders();
    _loadProducts();
    _loadShopProfile();
  }

  @override
  void dispose() {
    _tabController.dispose();
    _shopNameCtrl.dispose();
    _shopTaglineCtrl.dispose();
    _shopDescCtrl.dispose();
    _shopProvinceCtrl.dispose();
    _shopAddressCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadShopProfile() async {
    setState(() => _isLoadingShop = true);
    final shop = await _shopService.getSellerShop();
    if (mounted) {
      setState(() {
        _sellerShop = shop;
        _isLoadingShop = false;
        if (shop != null) {
          _shopNameCtrl.text = shop.name;
          _shopTaglineCtrl.text = shop.tagline ?? '';
          _shopDescCtrl.text = shop.description ?? '';
          _shopProvinceCtrl.text = shop.province;
          _shopAddressCtrl.text = shop.address ?? '';
          _shopLogoUrl = shop.logoUrl;
          _shopBannerUrl = shop.bannerUrl;
        }
      });
    }
  }

  Future<void> _saveShopProfile() async {
    final name = _shopNameCtrl.text.trim();
    if (name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vui lòng nhập tên gian hàng.')),
      );
      return;
    }

    setState(() => _isSavingShop = true);
    final res = await _shopService.updateSellerShop(
      name: name,
      tagline: _shopTaglineCtrl.text.trim(),
      description: _shopDescCtrl.text.trim(),
      province: _shopProvinceCtrl.text.trim().isNotEmpty
          ? _shopProvinceCtrl.text.trim()
          : (_sellerShop?.province ?? 'TP. Hồ Chí Minh'),
      address: _shopAddressCtrl.text.trim(),
      logoUrl: _shopLogoUrl,
      bannerUrl: _shopBannerUrl,
    );
    setState(() => _isSavingShop = false);

    if (res.success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Cập nhật hồ sơ gian hàng thành công!'),
          backgroundColor: Color(0xFF00BFA5),
        ),
      );
      await _loadShopProfile();
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(res.message.isNotEmpty ? res.message : 'Cập nhật thất bại.'),
          backgroundColor: const Color(0xFFD0011B),
        ),
      );
    }
  }

  Future<void> _resubmitShop() async {
    setState(() => _isResubmittingShop = true);
    final res = await _shopService.resubmitSellerShop();
    setState(() => _isResubmittingShop = false);

    if (res.success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Đã gửi lại hồ sơ gian hàng xét duyệt thành công!'),
          backgroundColor: Color(0xFF00BFA5),
        ),
      );
      await _loadShopProfile();
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(res.message.isNotEmpty ? res.message : 'Gửi lại hồ sơ thất bại.'),
          backgroundColor: const Color(0xFFD0011B),
        ),
      );
    }
  }

  Future<void> _loadDashboard() async {
    setState(() => _isLoadingDashboard = true);
    final response = await _client.get('/api/v1/seller/dashboard');
    if (response.success && response.data is Map<String, dynamic> && mounted) {
      setState(() {
        _dashboard = response.data as Map<String, dynamic>;
        _isLoadingDashboard = false;
      });
    } else if (mounted) {
      setState(() => _isLoadingDashboard = false);
    }
  }

  Future<void> _loadOrders() async {
    setState(() => _isLoadingOrders = true);
    final list = await _orderService.getOrders(
      status: _selectedOrderStatus.isNotEmpty ? _selectedOrderStatus : null,
    );
    if (mounted) {
      setState(() {
        _orders = list;
        _isLoadingOrders = false;
      });
    }
  }

  Future<void> _loadProducts() async {
    setState(() => _isLoadingProducts = true);
    final result = await _productService.getProducts();
    if (mounted) {
      setState(() {
        _products = result;
        _isLoadingProducts = false;
      });
    }
  }

  Future<void> _updateOrderStatus(String shopOrderId, String nextStatus, String label) async {
    final success = await _orderService.updateOrderStatus(shopOrderId, toStatus: nextStatus);
    if (success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Đã chuyển trạng thái đơn sang "$label" thành công!')),
      );
      _loadOrders();
      _loadDashboard();
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Không thể cập nhật trạng thái đơn hàng.')),
      );
    }
  }

  void _showAddProductDialog() {
    // Ràng buộc Bước 3: Chỉ cho phép đăng sản phẩm khi gian hàng đã được Admin sàn phê duyệt "Đang hoạt động"
    if (_sellerShop != null && (_sellerShop!.isPending || _sellerShop!.isRejected)) {
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Row(
            children: [
              Icon(
                _sellerShop!.isPending ? Icons.pending_actions_rounded : Icons.warning_rounded,
                color: _sellerShop!.isPending ? const Color(0xFFD97706) : const Color(0xFFDC2626),
              ),
              const SizedBox(width: 8),
              const Text('Chưa Thể Đăng Sản Phẩm', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            ],
          ),
          content: Text(
            _sellerShop!.isPending
                ? 'Gian hàng "${_sellerShop!.name}" hiện đang ở trạng thái Chờ Kiểm Duyệt. Theo quy định sàn, gian hàng cần được Quản trị viên (Admin) xét duyệt chuyển sang "Đang hoạt động" trước khi đăng bán sản phẩm.'
                : 'Gian hàng bị từ chối duyệt: ${_sellerShop!.rejectionReason ?? 'Chưa đạt chuẩn'}. Vui lòng cập nhật thông tin hồ sơ và gửi lại xét duyệt.',
            style: const TextStyle(fontSize: 13.5, height: 1.4),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Đã hiểu'),
            ),
            if (_sellerShop!.isRejected)
              ElevatedButton(
                onPressed: () {
                  Navigator.pop(ctx);
                  _tabController.animateTo(3);
                },
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.white),
                child: const Text('Sửa hồ sơ shop'),
              ),
          ],
        ),
      );
      return;
    }

    final nameCtrl = TextEditingController();
    final priceCtrl = TextEditingController();
    final stockCtrl = TextEditingController(text: '50');
    final descCtrl = TextEditingController();
    final imageCtrl = TextEditingController();

    // Thuộc tính linh hoạt theo ngành hàng
    String selectedCategory = '1';
    final specCtrl1 = TextEditingController(); // Fashion: Size, Tech: Bộ nhớ, Beauty: Dung tích, Home: Công suất
    final specCtrl2 = TextEditingController(); // Fashion: Màu sắc, Tech: RAM, Beauty: Loại da, Home: Kích thước
    final specCtrl3 = TextEditingController(); // Fashion: Chất liệu, Tech: Bảo hành, Beauty: Hạn dùng, Home: Chất liệu

    bool isSubmitting = false;
    bool isUploadingImage = false;

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
                        const Text('Đăng Sản Phẩm Mới Lên Sàn', style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
                        IconButton(icon: const Icon(Icons.close_rounded), onPressed: () => Navigator.pop(ctx)),
                      ],
                    ),
                    const SizedBox(height: 14),

                    // Chọn ngành hàng sản phẩm
                    DropdownButtonFormField<String>(
                      value: selectedCategory,
                      decoration: InputDecoration(
                        labelText: 'Ngành hàng sản phẩm *',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                      ),
                      items: const [
                        DropdownMenuItem(value: '1', child: Text('👕 Thời trang (Quần áo, Giày dép)')),
                        DropdownMenuItem(value: '2', child: Text('💻 Công nghệ & Thiết bị điện tử')),
                        DropdownMenuItem(value: '3', child: Text('💄 Sắc đẹp & Chăm sóc cá nhân')),
                        DropdownMenuItem(value: '4', child: Text('🏡 Nhà cửa & Đời sống')),
                        DropdownMenuItem(value: '5', child: Text('📦 Ngành hàng tiêu dùng khác')),
                      ],
                      onChanged: (val) {
                        if (val != null) {
                          setModalState(() {
                            selectedCategory = val;
                            specCtrl1.clear();
                            specCtrl2.clear();
                            specCtrl3.clear();
                          });
                        }
                      },
                    ),
                    const SizedBox(height: 12),

                    TextField(
                      controller: nameCtrl,
                      decoration: InputDecoration(
                        labelText: 'Tên sản phẩm *',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: priceCtrl,
                            keyboardType: TextInputType.number,
                            decoration: InputDecoration(
                              labelText: 'Giá bán (VND) *',
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: TextField(
                            controller: stockCtrl,
                            keyboardType: TextInputType.number,
                            decoration: InputDecoration(
                              labelText: 'Số lượng tồn *',
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),

                    // Cụm thuộc tính tùy biến theo ngành hàng đã chọn
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFAFAFC),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFE2E2E6)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: const [
                              Icon(Icons.tune_rounded, size: 16, color: AppColors.primary),
                              SizedBox(width: 6),
                              Text(
                                'Thuộc tính đặc thù ngành hàng (Specs)',
                                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF1E2022)),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          if (selectedCategory == '1') ...[
                            // Thời trang: Kích cỡ, Màu sắc, Chất liệu
                            TextField(
                              controller: specCtrl1,
                              decoration: InputDecoration(
                                labelText: 'Kích cỡ (Size)',
                                hintText: 'Ví dụ: S, M, L, XL, Free size',
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                                isDense: true,
                              ),
                            ),
                            const SizedBox(height: 8),
                            TextField(
                              controller: specCtrl2,
                              decoration: InputDecoration(
                                labelText: 'Màu sắc',
                                hintText: 'Ví dụ: Đen, Trắng, Be, Xanh navy',
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                                isDense: true,
                              ),
                            ),
                            const SizedBox(height: 8),
                            TextField(
                              controller: specCtrl3,
                              decoration: InputDecoration(
                                labelText: 'Chất liệu vải',
                                hintText: 'Ví dụ: Cotton 100%, Denim, Linen',
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                                isDense: true,
                              ),
                            ),
                          ] else if (selectedCategory == '2') ...[
                            // Công nghệ: Dung lượng lưu trữ, RAM, Thời hạn bảo hành
                            TextField(
                              controller: specCtrl1,
                              decoration: InputDecoration(
                                labelText: 'Bộ nhớ lưu trữ (Storage)',
                                hintText: 'Ví dụ: 128GB, 256GB, 512GB',
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                                isDense: true,
                              ),
                            ),
                            const SizedBox(height: 8),
                            TextField(
                              controller: specCtrl2,
                              decoration: InputDecoration(
                                labelText: 'Dung lượng RAM',
                                hintText: 'Ví dụ: 8GB, 16GB, 32GB',
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                                isDense: true,
                              ),
                            ),
                            const SizedBox(height: 8),
                            TextField(
                              controller: specCtrl3,
                              decoration: InputDecoration(
                                labelText: 'Thời hạn bảo hành',
                                hintText: 'Ví dụ: 12 tháng chính hãng, 24 tháng',
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                                isDense: true,
                              ),
                            ),
                          ] else if (selectedCategory == '3') ...[
                            // Sắc đẹp: Dung tích, Loại da, Hạn dùng
                            TextField(
                              controller: specCtrl1,
                              decoration: InputDecoration(
                                labelText: 'Dung tích / Trọng lượng',
                                hintText: 'Ví dụ: 30ml, 50ml, 100g',
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                                isDense: true,
                              ),
                            ),
                            const SizedBox(height: 8),
                            TextField(
                              controller: specCtrl2,
                              decoration: InputDecoration(
                                labelText: 'Loại da phù hợp',
                                hintText: 'Ví dụ: Mọi loại da, Da dầu mụn, Da nhạy cảm',
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                                isDense: true,
                              ),
                            ),
                            const SizedBox(height: 8),
                            TextField(
                              controller: specCtrl3,
                              decoration: InputDecoration(
                                labelText: 'Hạn sử dụng / Xuất xứ',
                                hintText: 'Ví dụ: 3 năm kể từ NSX - Hàn Quốc',
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                                isDense: true,
                              ),
                            ),
                          ] else if (selectedCategory == '4') ...[
                            // Nhà cửa: Công suất, Kích thước, Chất liệu
                            TextField(
                              controller: specCtrl1,
                              decoration: InputDecoration(
                                labelText: 'Công suất tiêu thụ',
                                hintText: 'Ví dụ: 1500W, 220V',
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                                isDense: true,
                              ),
                            ),
                            const SizedBox(height: 8),
                            TextField(
                              controller: specCtrl2,
                              decoration: InputDecoration(
                                labelText: 'Kích thước sản phẩm',
                                hintText: 'Ví dụ: 40 x 30 x 15 cm',
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                                isDense: true,
                              ),
                            ),
                            const SizedBox(height: 8),
                            TextField(
                              controller: specCtrl3,
                              decoration: InputDecoration(
                                labelText: 'Chất liệu cấu thành',
                                hintText: 'Ví dụ: Inox 304, Gỗ sồi, Nhựa ABS',
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                                isDense: true,
                              ),
                            ),
                          ] else ...[
                            // Khác: Thương hiệu, Xuất xứ, Ghi chú thông số
                            TextField(
                              controller: specCtrl1,
                              decoration: InputDecoration(
                                labelText: 'Thương hiệu',
                                hintText: 'Ví dụ: OEM, ShopNova, Chính hãng',
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                                isDense: true,
                              ),
                            ),
                            const SizedBox(height: 8),
                            TextField(
                              controller: specCtrl2,
                              decoration: InputDecoration(
                                labelText: 'Xuất xứ sản phẩm',
                                hintText: 'Ví dụ: Việt Nam, Nhật Bản, Mỹ',
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                                isDense: true,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Tải ảnh sản phẩm (Purpose: "product", tối đa 5 MiB)
                    Row(
                      children: [
                        if (imageCtrl.text.trim().isNotEmpty) ...[
                          ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: Image.network(
                              ApiConfig.resolveImageUrl(imageCtrl.text.trim()),
                              width: 50,
                              height: 50,
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => Container(
                                width: 50,
                                height: 50,
                                color: Colors.grey.shade200,
                                child: const Icon(Icons.broken_image_rounded, size: 24, color: Colors.grey),
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                        ],
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: (isUploadingImage || isSubmitting)
                                ? null
                                : () async {
                                    setModalState(() => isUploadingImage = true);
                                    final result = await UploadService().pickAndUploadImage(purpose: 'product');
                                    setModalState(() => isUploadingImage = false);

                                    if (result != null) {
                                      if (result.success && result.url != null) {
                                        setModalState(() {
                                          imageCtrl.text = result.url!;
                                        });
                                        if (mounted) {
                                          ScaffoldMessenger.of(context).showSnackBar(
                                            const SnackBar(
                                              content: Text('Đã tải ảnh sản phẩm thành công!'),
                                              backgroundColor: Color(0xFF00BFA5),
                                            ),
                                          );
                                        }
                                      } else {
                                        if (mounted) {
                                          ScaffoldMessenger.of(context).showSnackBar(
                                            SnackBar(
                                              content: Text(result.error ?? 'Tải ảnh sản phẩm thất bại.'),
                                              backgroundColor: const Color(0xFFD0011B),
                                            ),
                                          );
                                        }
                                      }
                                    }
                                  },
                            icon: isUploadingImage
                                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary))
                                : const Icon(Icons.add_photo_alternate_rounded, size: 20),
                            label: Text(
                              isUploadingImage ? 'Đang tải ảnh...' : 'Tải ảnh sản phẩm từ máy (Tối đa 5MB)',
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                            ),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: AppColors.primary,
                              side: const BorderSide(color: AppColors.primary),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                              padding: const EdgeInsets.symmetric(vertical: 12),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: imageCtrl,
                      onChanged: (_) => setModalState(() {}),
                      decoration: InputDecoration(
                        labelText: 'Link ảnh sản phẩm (URL hoặc đường dẫn server)',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: descCtrl,
                      maxLines: 3,
                      decoration: InputDecoration(
                        labelText: 'Mô tả chi tiết sản phẩm',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                    const SizedBox(height: 18),
                    Container(
                      width: double.infinity,
                      height: 50,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [AppColors.primary, AppColors.earth],
                        ),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.transparent,
                          shadowColor: Colors.transparent,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        onPressed: isSubmitting
                            ? null
                            : () async {
                                final name = nameCtrl.text.trim();
                                final price = double.tryParse(priceCtrl.text.trim()) ?? 0;
                                final stock = int.tryParse(stockCtrl.text.trim()) ?? 1;

                                if (name.isEmpty || price <= 0) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(content: Text('Vui lòng nhập tên và giá bán hợp lệ.')),
                                  );
                                  return;
                                }

                                // Tổng hợp Specs linh hoạt theo ngành hàng
                                final Map<String, dynamic> dynamicSpecs = {};
                                if (selectedCategory == '1') {
                                  if (specCtrl1.text.trim().isNotEmpty) dynamicSpecs['Kích cỡ'] = specCtrl1.text.trim();
                                  if (specCtrl2.text.trim().isNotEmpty) dynamicSpecs['Màu sắc'] = specCtrl2.text.trim();
                                  if (specCtrl3.text.trim().isNotEmpty) dynamicSpecs['Chất liệu'] = specCtrl3.text.trim();
                                } else if (selectedCategory == '2') {
                                  if (specCtrl1.text.trim().isNotEmpty) dynamicSpecs['Bộ nhớ'] = specCtrl1.text.trim();
                                  if (specCtrl2.text.trim().isNotEmpty) dynamicSpecs['RAM'] = specCtrl2.text.trim();
                                  if (specCtrl3.text.trim().isNotEmpty) dynamicSpecs['Bảo hành'] = specCtrl3.text.trim();
                                } else if (selectedCategory == '3') {
                                  if (specCtrl1.text.trim().isNotEmpty) dynamicSpecs['Dung tích'] = specCtrl1.text.trim();
                                  if (specCtrl2.text.trim().isNotEmpty) dynamicSpecs['Loại da'] = specCtrl2.text.trim();
                                  if (specCtrl3.text.trim().isNotEmpty) dynamicSpecs['Hạn sử dụng'] = specCtrl3.text.trim();
                                } else if (selectedCategory == '4') {
                                  if (specCtrl1.text.trim().isNotEmpty) dynamicSpecs['Công suất'] = specCtrl1.text.trim();
                                  if (specCtrl2.text.trim().isNotEmpty) dynamicSpecs['Kích thước'] = specCtrl2.text.trim();
                                  if (specCtrl3.text.trim().isNotEmpty) dynamicSpecs['Chất liệu'] = specCtrl3.text.trim();
                                } else {
                                  if (specCtrl1.text.trim().isNotEmpty) dynamicSpecs['Thương hiệu'] = specCtrl1.text.trim();
                                  if (specCtrl2.text.trim().isNotEmpty) dynamicSpecs['Xuất xứ'] = specCtrl2.text.trim();
                                }

                                setModalState(() => isSubmitting = true);
                                var response = await _productService.createProduct(
                                  categoryId: selectedCategory,
                                  name: name,
                                  description: descCtrl.text.trim().isNotEmpty ? descCtrl.text.trim() : null,
                                  specs: dynamicSpecs,
                                  images: imageCtrl.text.trim().isNotEmpty ? [imageCtrl.text.trim()] : [],
                                  variants: [
                                    {
                                      'name': 'Mặc định',
                                      'price': price,
                                      'originalPrice': price * 1.2,
                                      'stockQty': stock,
                                      'sku': 'SKU-${DateTime.now().millisecondsSinceEpoch % 10000}',
                                    }
                                  ],
                                );

                                if (!response.success && (response.statusCode == 403 || response.message.contains('gian hàng'))) {
                                  final regRes = await _client.post('/api/v1/seller/register-shop', body: {
                                    'shopName': 'Gian hàng $name',
                                    'province': 'TP. Hồ Chí Minh',
                                  });
                                  if (regRes.success && regRes.data is Map && regRes.data['token'] != null) {
                                    await _client.saveToken(regRes.data['token'].toString());
                                    response = await _productService.createProduct(
                                      categoryId: selectedCategory,
                                      name: name,
                                      description: descCtrl.text.trim().isNotEmpty ? descCtrl.text.trim() : null,
                                      specs: dynamicSpecs,
                                      images: imageCtrl.text.trim().isNotEmpty ? [imageCtrl.text.trim()] : [],
                                      variants: [
                                        {
                                          'name': 'Mặc định',
                                          'price': price,
                                          'originalPrice': price * 1.2,
                                          'stockQty': stock,
                                          'sku': 'SKU-${DateTime.now().millisecondsSinceEpoch % 10000}',
                                        }
                                      ],
                                    );
                                  }
                                }

                                setModalState(() => isSubmitting = false);

                                if (response.success && mounted) {
                                  Navigator.pop(ctx);
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(content: Text('Đăng sản phẩm thành công!'), backgroundColor: Color(0xFF00BFA5)),
                                  );
                                  _loadProducts();
                                  _loadDashboard();
                                } else if (mounted) {
                                  final errMsg = response.message.isNotEmpty
                                      ? response.message
                                      : 'Đăng sản phẩm thất bại. Vui lòng kiểm tra lại.';
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(content: Text(errMsg), backgroundColor: const Color(0xFFD0011B)),
                                  );
                                }
                              },
                        child: isSubmitting
                            ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                            : const Text('Đăng Bán Ngay', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
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

  String _formatVND(num amount) {
    final str = amount.round().toString();
    final reg = RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))');
    return '${str.replaceAllMapped(reg, (Match m) => '${m[1]}.')}₫';
  }

  @override
  Widget build(BuildContext context) {
    final user = AuthService().currentUser;
    final isSeller = AuthService().isAuthenticated && user?.isSeller == true;

    if (!isSeller) {
      return Scaffold(
        backgroundColor: Colors.white,
        appBar: AppBar(
          backgroundColor: Colors.white,
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Color(0xFF1E2022), size: 20),
            onPressed: () => Navigator.pop(context),
          ),
          title: const Text('Kênh Người Bán', style: TextStyle(color: Color(0xFF1E2022), fontWeight: FontWeight.bold, fontSize: 16)),
        ),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 28),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 90,
                  height: 90,
                  decoration: BoxDecoration(
                    color: AppColors.surfaceAlt,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.primary.withValues(alpha: 0.15),
                        blurRadius: 16,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  child: const Icon(Icons.storefront_rounded, color: AppColors.primary, size: 48),
                ),
                const SizedBox(height: 20),
                const Text(
                  'Bạn Chưa Mở Gian Hàng Bán Hàng',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF1E2022)),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 10),
                const Text(
                  'Đăng ký đối tác mở gian hàng ngay hôm nay để bắt đầu tiếp cận hàng triệu khách hàng và quản lý kinh doanh chuyên nghiệp trên ShopNova.',
                  style: TextStyle(fontSize: 13, color: Color(0xFF6E7191), height: 1.4),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 28),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
                    onPressed: () async {
                      await Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const SellerRegisterScreen()),
                      );
                      if (mounted) {
                        setState(() {});
                        _loadDashboard();
                        _loadOrders();
                        _loadProducts();
                      }
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      elevation: 0,
                    ),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.add_business_rounded, size: 20),
                        SizedBox(width: 8),
                        Text('Đăng Ký Đối Tác Bán Hàng Ngay', style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Color(0xFF1E2022), size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(5),
              decoration: BoxDecoration(
                color: AppColors.surfaceAlt,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.storefront_rounded, color: AppColors.primary, size: 18),
            ),
            const SizedBox(width: 8),
            const Text('Kênh Người Bán ShopNova', style: TextStyle(color: Color(0xFF1E2022), fontWeight: FontWeight.w700, fontSize: 16)),
          ],
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(49),
          child: Column(
            children: [
              TabBar(
                controller: _tabController,
                labelColor: primaryColor,
                unselectedLabelColor: const Color(0xFF555770),
                indicatorColor: primaryColor,
                indicatorWeight: 2.5,
                indicatorSize: TabBarIndicatorSize.tab,
                labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14),
                tabs: const [
                  Tab(text: 'Tổng Quan'),
                  Tab(text: 'Đơn Hàng'),
                  Tab(text: 'Sản Phẩm'),
                  Tab(text: 'Hồ Sơ Shop'),
                ],
              ),
              Container(color: const Color(0xFFEEEEF0), height: 1),
            ],
          ),
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildDashboardTab(),
          _buildOrdersTab(),
          _buildProductsTab(),
          _buildShopProfileTab(),
        ],
      ),
      floatingActionButton: _tabController.index == 2
          ? FloatingActionButton.extended(
              backgroundColor: primaryColor,
              icon: const Icon(Icons.add_rounded, color: Colors.white),
              label: const Text('Đăng Sản Phẩm', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              onPressed: _showAddProductDialog,
            )
          : null,
    );
  }

  Widget _buildDashboardTab() {
    if (_isLoadingDashboard) {
      return const Center(child: CircularProgressIndicator(color: AppColors.primary));
    }

    final revenue = (_dashboard['revenue'] as num?) ?? 0;
    final pendingOrders = (_dashboard['pendingOrders'] as num?) ?? 0;
    final totalProducts = (_dashboard['totalProducts'] as num?) ?? 0;
    final lowStock = (_dashboard['lowStockCount'] as num?) ?? 0;

    return RefreshIndicator(
      onRefresh: _loadDashboard,
      color: primaryColor,
      child: ListView(
        padding: const EdgeInsets.all(14),
        children: [
          // Banner Cảnh báo Trạng thái Duyệt Gian Hàng
          if (_sellerShop != null && (_sellerShop!.isPending || _sellerShop!.isRejected))
            _buildApprovalStatusBanner(),

          // Banner Chào Mừng
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [AppColors.primary, AppColors.earth],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(color: primaryColor.withOpacity(0.28), blurRadius: 10, offset: const Offset(0, 4)),
              ],
            ),
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Trung Tâm Quản Lý Gian Hàng', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800)),
                SizedBox(height: 6),
                Text('Theo dõi số liệu bán hàng, xử lý đơn và quản lý kho theo thời gian thực.', style: TextStyle(color: Colors.white70, fontSize: 13, height: 1.3)),
              ],
            ),
          ),
          const SizedBox(height: 14),
          // Chỉ Số Kinh Doanh
          Row(
            children: [
              Expanded(
                child: _buildMetricCard('Doanh Thu', _formatVND(revenue), Icons.monetization_on_rounded, const Color(0xFF16A34A)),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildMetricCard('Đơn Chờ Xử Lý', '$pendingOrders đơn', Icons.pending_actions_rounded, const Color(0xFFD97706)),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _buildMetricCard('Sản Phẩm Đang Bán', '$totalProducts sản phẩm', Icons.inventory_2_outlined, const Color(0xFF2563EB)),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildMetricCard('Cảnh Báo Hết Hàng', '$lowStock SKU', Icons.warning_amber_rounded, const Color(0xFFDC2626)),
              ),
            ],
          ),
          const SizedBox(height: 20),
          // Tiện Ích Nhanh Cho Seller
          const Text('Thao Tác Nhanh', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF1E2022))),
          const SizedBox(height: 10),
          Container(
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
                  ListTile(
                    leading: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: const BoxDecoration(color: AppColors.surfaceAlt, shape: BoxShape.circle),
                      child: const Icon(Icons.add_box_outlined, color: AppColors.primary, size: 20),
                    ),
                    title: const Text('Đăng bán sản phẩm mới', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF1E2022))),
                    subtitle: const Text('Tải ảnh và cấu hình biến thể sản phẩm', style: TextStyle(fontSize: 11, color: Color(0xFF8F90A6))),
                    trailing: const Icon(Icons.chevron_right_rounded, size: 20, color: Color(0xFF8F90A6)),
                    onTap: () {
                      _tabController.animateTo(2);
                      _showAddProductDialog();
                    },
                  ),
                  const Divider(height: 1, indent: 56, color: Color(0xFFEEEEF0)),
                  ListTile(
                    leading: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: const BoxDecoration(color: Color(0xFFFFFBEB), shape: BoxShape.circle),
                      child: const Icon(Icons.local_shipping_outlined, color: Color(0xFFD97706), size: 20),
                    ),
                    title: const Text('Xử lý đơn hàng đang chờ', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF1E2022))),
                    subtitle: const Text('Xác nhận và chuẩn bị hàng giao vận', style: TextStyle(fontSize: 11, color: Color(0xFF8F90A6))),
                    trailing: const Icon(Icons.chevron_right_rounded, size: 20, color: Color(0xFF8F90A6)),
                    onTap: () => _tabController.animateTo(1),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMetricCard(String label, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(14),
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
              Text(label, style: const TextStyle(fontSize: 11, color: Color(0xFF8F90A6))),
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(color: color.withOpacity(0.1), shape: BoxShape.circle),
                child: Icon(icon, color: color, size: 16),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(value, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: color)),
        ],
      ),
    );
  }

  Widget _buildOrdersTab() {
    return Column(
      children: [
        Container(
          color: Colors.white,
          height: 48,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            children: [
              _buildStatusFilterChip('Tất cả', ''),
              _buildStatusFilterChip('Chờ xử lý', 'pending'),
              _buildStatusFilterChip('Đang chuẩn bị', 'processing'),
              _buildStatusFilterChip('Đang giao', 'shipping'),
              _buildStatusFilterChip('Đã giao', 'delivered'),
              _buildStatusFilterChip('Đã hủy', 'cancelled'),
            ],
          ),
        ),
        Expanded(
          child: _isLoadingOrders
              ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
              : _orders.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: const [
                          Icon(Icons.inbox_outlined, size: 54, color: Color(0xFF8F90A6)),
                          SizedBox(height: 12),
                          Text('Không có đơn hàng nào', style: TextStyle(color: Color(0xFF8F90A6), fontSize: 15)),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _loadOrders,
                      color: primaryColor,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(12),
                        itemCount: _orders.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (ctx, index) {
                          final o = _orders[index];
                          return _buildOrderCard(o);
                        },
                      ),
                    ),
        ),
      ],
    );
  }

  Widget _buildStatusFilterChip(String label, String status) {
    final isSelected = _selectedOrderStatus == status;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        label: Text(label),
        selected: isSelected,
        selectedColor: AppColors.surfaceAlt,
        backgroundColor: const Color(0xFFF7F7F8),
        side: BorderSide(color: isSelected ? primaryColor : const Color(0xFFE2E2E6)),
        labelStyle: TextStyle(
          color: isSelected ? primaryColor : const Color(0xFF555770),
          fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
          fontSize: 12,
        ),
        onSelected: (val) {
          setState(() => _selectedOrderStatus = status);
          _loadOrders();
        },
      ),
    );
  }

  Widget _buildOrderCard(ShopOrder o) {
    return Container(
      padding: const EdgeInsets.all(14),
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
              Text('Đơn hàng #${o.id}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF1E2022))),
              _buildStatusBadge(o.status),
            ],
          ),
          const Divider(height: 16, color: Color(0xFFEEEEF0)),
          ...o.items.map((it) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(it.productName, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF1E2022))),
                          Text('${it.variantName} x${it.qty}', style: const TextStyle(color: Color(0xFF8F90A6), fontSize: 12)),
                        ],
                      ),
                    ),
                    Text(_formatVND(it.lineTotal), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF1E2022))),
                  ],
                ),
              )),
          const Divider(height: 16, color: Color(0xFFEEEEF0)),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Tổng thu:', style: TextStyle(fontSize: 13, color: Color(0xFF555770))),
              Text(_formatVND(o.totalAmount), style: TextStyle(color: primaryColor, fontWeight: FontWeight.w800, fontSize: 16)),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              if (o.status == 'pending')
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: primaryColor,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  onPressed: () => _updateOrderStatus(o.id, 'processing', 'Đang chuẩn bị hàng'),
                  child: const Text('Xác Nhận Đơn', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              if (o.status == 'processing')
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF2563EB),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  onPressed: () => _updateOrderStatus(o.id, 'shipping', 'Đang giao hàng'),
                  child: const Text('Giao Cho Vận Chuyển', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              if (o.status == 'shipping')
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF16A34A),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  onPressed: () => _updateOrderStatus(o.id, 'delivered', 'Giao thành công'),
                  child: const Text('Hoàn Tất Đơn', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatusBadge(String status) {
    Color bg;
    Color fg;
    String text;

    switch (status) {
      case 'pending':
        bg = const Color(0xFFFFFBEB);
        fg = const Color(0xFFD97706);
        text = 'Chờ xác nhận';
        break;
      case 'processing':
        bg = const Color(0xFFEFF6FF);
        fg = const Color(0xFF2563EB);
        text = 'Đang đóng gói';
        break;
      case 'shipping':
        bg = const Color(0xFFF3E8FF);
        fg = const Color(0xFF7E22CE);
        text = 'Đang giao';
        break;
      case 'delivered':
        bg = const Color(0xFFF0FDF4);
        fg = const Color(0xFF16A34A);
        text = 'Đã giao';
        break;
      case 'cancelled':
        bg = const Color(0xFFFEF2F2);
        fg = const Color(0xFFDC2626);
        text = 'Đã hủy';
        break;
      default:
        bg = const Color(0xFFF7F7F8);
        fg = const Color(0xFF1E2022);
        text = status;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
      child: Text(text, style: TextStyle(color: fg, fontSize: 11, fontWeight: FontWeight.bold)),
    );
  }

  Widget _buildProductsTab() {
    return _isLoadingProducts
        ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
        : _products.isEmpty
            ? Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.inventory_2_outlined, size: 54, color: Color(0xFF8F90A6)),
                    const SizedBox(height: 12),
                    const Text('Gian hàng chưa có sản phẩm nào', style: TextStyle(color: Color(0xFF8F90A6), fontSize: 15)),
                    const SizedBox(height: 12),
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: primaryColor,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      icon: const Icon(Icons.add_rounded),
                      label: const Text('Đăng sản phẩm đầu tiên'),
                      onPressed: _showAddProductDialog,
                    ),
                  ],
                ),
              )
            : RefreshIndicator(
                onRefresh: _loadProducts,
                color: primaryColor,
                child: ListView.separated(
                  padding: const EdgeInsets.all(12),
                  itemCount: _products.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (ctx, index) {
                    final p = _products[index];
                    return Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFFEEEEF0)),
                        boxShadow: const [
                          BoxShadow(color: Color(0x06000000), blurRadius: 8, offset: Offset(0, 2)),
                        ],
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 64,
                            height: 64,
                            decoration: BoxDecoration(
                              color: const Color(0xFFF7F7F8),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: const Color(0xFFEEEEF0)),
                            ),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: Image.network(
                                ProductImageResolver.resolve(id: p.id, imageUrl: p.imageUrl, name: p.name),
                                fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) => const Icon(Icons.image, color: Colors.grey),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(p.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF1E2022))),
                                const SizedBox(height: 4),
                                Row(
                                  children: [
                                    Text(
                                      p.minPrice == p.maxPrice ? _formatVND(p.minPrice) : '${_formatVND(p.minPrice)} - ${_formatVND(p.maxPrice)}',
                                      style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold, fontSize: 13),
                                    ),
                                    const Spacer(),
                                    _buildApprovalBadge(p.approvalStatus),
                                  ],
                                ),
                                const SizedBox(height: 2),
                                Text('Kho: ${p.totalStock} sản phẩm', style: const TextStyle(color: Color(0xFF8F90A6), fontSize: 12)),
                              ],
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              );
  }

  Widget _buildApprovalBadge(String status) {
    Color bg;
    Color fg;
    String text;

    switch (status) {
      case 'pending':
        bg = const Color(0xFFFFFBEB);
        fg = const Color(0xFFD97706);
        text = 'Chờ duyệt';
        break;
      case 'rejected':
        bg = const Color(0xFFFFEBEE);
        fg = const Color(0xFFC62828);
        text = 'Từ chối';
        break;
      case 'approved':
      default:
        bg = const Color(0xFFE8F5E9);
        fg = const Color(0xFF2E7D32);
        text = 'Đã duyệt';
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
      child: Text(text, style: TextStyle(color: fg, fontSize: 10, fontWeight: FontWeight.bold)),
    );
  }

  Widget _buildApprovalStatusBanner() {
    final isPending = _sellerShop?.isPending == true;
    final isRejected = _sellerShop?.isRejected == true;
    final version = _sellerShop?.approvalVersion ?? 1;

    final bgColor = isPending ? const Color(0xFFFFFBEB) : const Color(0xFFFFEBEE);
    final borderColor = isPending ? const Color(0xFFFDE68A) : const Color(0xFFFECACA);
    final primaryTextColor = isPending ? const Color(0xFFB45309) : const Color(0xFFB91C1C);
    final iconData = isPending ? Icons.pending_actions_rounded : Icons.warning_rounded;

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(iconData, color: primaryTextColor, size: 22),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  isPending
                      ? 'Hồ sơ gian hàng đang chờ xét duyệt (v$version)'
                      : 'Hồ sơ gian hàng bị từ chối duyệt (v$version)',
                  style: TextStyle(color: primaryTextColor, fontWeight: FontWeight.bold, fontSize: 14),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            isPending
                ? 'Gian hàng "${_sellerShop?.name ?? ''}" đang được Ban Quản Trị ShopNova kiểm duyệt. Bạn có thể cập nhật thông tin trong tab "Hồ Sơ Shop".'
                : 'Lý do từ chối: ${_sellerShop?.rejectionReason ?? 'Chưa đáp ứng tiêu chuẩn sàn'}.\nVui lòng chỉnh sửa thông tin hồ sơ bên dưới và bấm "Gửi Lại Xét Duyệt".',
            style: TextStyle(color: primaryTextColor.withValues(alpha: 0.9), fontSize: 12.5, height: 1.35),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              OutlinedButton.icon(
                onPressed: () => _tabController.animateTo(3),
                icon: const Icon(Icons.edit_note_rounded, size: 16),
                label: const Text('Xem & Sửa Hồ Sơ', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                style: OutlinedButton.styleFrom(
                  foregroundColor: primaryTextColor,
                  side: BorderSide(color: primaryTextColor),
                  visualDensity: VisualDensity.compact,
                ),
              ),
              if (isRejected) ...[
                const SizedBox(width: 8),
                ElevatedButton.icon(
                  onPressed: _isResubmittingShop ? null : _resubmitShop,
                  icon: _isResubmittingShop
                      ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.replay_rounded, size: 16),
                  label: const Text('Gửi Lại Xét Duyệt', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFDC2626),
                    foregroundColor: Colors.white,
                    visualDensity: VisualDensity.compact,
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildShopProfileTab() {
    if (_isLoadingShop) {
      return const Center(child: CircularProgressIndicator(color: AppColors.primary));
    }

    final shop = _sellerShop;
    final isPending = shop?.isPending == true;
    final isRejected = shop?.isRejected == true;
    final isActive = shop?.isActive == true;

    Color statusBg = Colors.grey.shade100;
    Color statusFg = Colors.grey.shade800;
    String statusText = shop?.status ?? 'active';

    if (isPending) {
      statusBg = const Color(0xFFFFFBEB);
      statusFg = const Color(0xFFD97706);
      statusText = 'Chờ kiểm duyệt';
    } else if (isRejected) {
      statusBg = const Color(0xFFFFEBEE);
      statusFg = const Color(0xFFC62828);
      statusText = 'Bị từ chối';
    } else if (isActive) {
      statusBg = const Color(0xFFE8F5E9);
      statusFg = const Color(0xFF2E7D32);
      statusText = 'Đang hoạt động';
    } else if (shop?.isSuspended == true) {
      statusBg = const Color(0xFFECEFF1);
      statusFg = const Color(0xFF455A64);
      statusText = 'Tạm khóa';
    }

    return RefreshIndicator(
      onRefresh: _loadShopProfile,
      color: primaryColor,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Thẻ Trạng Thái Hồ Sơ
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE5E7EB)),
              boxShadow: const [BoxShadow(color: Color(0x06000000), blurRadius: 6, offset: Offset(0, 2))],
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(color: statusBg, borderRadius: BorderRadius.circular(20)),
                  child: Text(statusText, style: TextStyle(color: statusFg, fontWeight: FontWeight.bold, fontSize: 12)),
                ),
                const SizedBox(width: 10),
                Text(
                  'Phiên bản hồ sơ: v${shop?.approvalVersion ?? 1}',
                  style: const TextStyle(fontSize: 13, color: Color(0xFF6B7280), fontWeight: FontWeight.w500),
                ),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.refresh_rounded, size: 20, color: Color(0xFF6B7280)),
                  onPressed: _loadShopProfile,
                  tooltip: 'Tải lại hồ sơ',
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Cảnh báo nếu bị từ chối
          if (isRejected) ...[
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF2F2),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFFCA5A5)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.error_outline_rounded, color: Color(0xFFDC2626), size: 20),
                      SizedBox(width: 8),
                      Text('Lý do hồ sơ bị từ chối:', style: TextStyle(color: Color(0xFFDC2626), fontWeight: FontWeight.bold, fontSize: 13.5)),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    shop?.rejectionReason ?? 'Chưa đáp ứng tiêu chuẩn sàn ShopNova.',
                    style: const TextStyle(color: Color(0xFF991B1B), fontSize: 13, height: 1.4),
                  ),
                  const SizedBox(height: 10),
                  const Text(
                    '👉 Vui lòng sửa thông tin bên dưới và bấm nút "Gửi Lại Xét Duyệt (Resubmit)".',
                    style: TextStyle(color: Color(0xFF7F1D1D), fontSize: 12, fontStyle: FontStyle.italic),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
          ],

          // Khu vực Ảnh Bìa & Logo Gian Hàng (Upload purpose: 'shop')
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE5E7EB)),
            ),
            child: Column(
              children: [
                // Banner
                Stack(
                  children: [
                    Container(
                      height: 120,
                      width: double.infinity,
                      decoration: BoxDecoration(
                        color: const Color(0xFFF3F4F6),
                        borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
                        image: (_shopBannerUrl != null && _shopBannerUrl!.isNotEmpty)
                            ? DecorationImage(
                                image: NetworkImage(ApiConfig.resolveImageUrl(_shopBannerUrl)),
                                fit: BoxFit.cover,
                              )
                            : null,
                      ),
                      child: (_shopBannerUrl == null || _shopBannerUrl!.isEmpty)
                          ? const Center(
                              child: Text('Chưa có ảnh bìa gian hàng', style: TextStyle(color: Colors.grey, fontSize: 12)),
                            )
                          : null,
                    ),
                    Positioned(
                      top: 8,
                      right: 8,
                      child: ElevatedButton.icon(
                        onPressed: _isUploadingBanner
                            ? null
                            : () async {
                                setState(() => _isUploadingBanner = true);
                                final res = await UploadService().pickAndUploadImage(purpose: 'shop');
                                setState(() => _isUploadingBanner = false);
                                if (res != null) {
                                  if (res.success && res.url != null) {
                                    setState(() => _shopBannerUrl = res.url);
                                    if (mounted) {
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        const SnackBar(content: Text('Đã tải ảnh bìa gian hàng!'), backgroundColor: Color(0xFF00BFA5)),
                                      );
                                    }
                                  } else {
                                    if (mounted) {
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        SnackBar(content: Text(res.error ?? 'Tải ảnh bìa thất bại'), backgroundColor: Colors.red),
                                      );
                                    }
                                  }
                                }
                              },
                        icon: _isUploadingBanner
                            ? const SizedBox(width: 12, height: 12, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                            : const Icon(Icons.camera_alt_rounded, size: 14),
                        label: Text(_isUploadingBanner ? 'Đang tải...' : 'Đổi ảnh bìa', style: const TextStyle(fontSize: 11)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.black54,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          visualDensity: VisualDensity.compact,
                        ),
                      ),
                    ),
                  ],
                ),
                // Logo Avatar
                Padding(
                  padding: const EdgeInsets.all(14),
                  child: Row(
                    children: [
                      Stack(
                        alignment: Alignment.center,
                        children: [
                          CircleAvatar(
                            radius: 32,
                            backgroundColor: const Color(0xFFF0F2F5),
                            backgroundImage: (_shopLogoUrl != null && _shopLogoUrl!.isNotEmpty)
                                ? NetworkImage(ApiConfig.resolveImageUrl(_shopLogoUrl))
                                : null,
                            child: (_shopLogoUrl == null || _shopLogoUrl!.isEmpty)
                                ? const Icon(Icons.storefront_rounded, size: 32, color: AppColors.primary)
                                : null,
                          ),
                          if (_isUploadingLogo)
                            Container(
                              width: 64,
                              height: 64,
                              decoration: const BoxDecoration(color: Colors.black45, shape: BoxShape.circle),
                              child: const Center(child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)),
                            ),
                        ],
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Logo Gian Hàng', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5)),
                            const SizedBox(height: 2),
                            const Text('Định dạng PNG/JPG/WebP, tối đa 5 MiB', style: TextStyle(color: Color(0xFF6B7280), fontSize: 11.5)),
                            const SizedBox(height: 6),
                            OutlinedButton.icon(
                              onPressed: _isUploadingLogo
                                  ? null
                                  : () async {
                                      setState(() => _isUploadingLogo = true);
                                      final res = await UploadService().pickAndUploadImage(purpose: 'shop');
                                      setState(() => _isUploadingLogo = false);
                                      if (res != null) {
                                        if (res.success && res.url != null) {
                                          setState(() => _shopLogoUrl = res.url);
                                          if (mounted) {
                                            ScaffoldMessenger.of(context).showSnackBar(
                                              const SnackBar(content: Text('Đã tải logo gian hàng!'), backgroundColor: Color(0xFF00BFA5)),
                                            );
                                          }
                                        } else {
                                          if (mounted) {
                                            ScaffoldMessenger.of(context).showSnackBar(
                                              SnackBar(content: Text(res.error ?? 'Tải logo thất bại'), backgroundColor: Colors.red),
                                            );
                                          }
                                        }
                                      }
                                    },
                              icon: const Icon(Icons.photo_camera_rounded, size: 16),
                              label: const Text('Tải logo từ máy', style: TextStyle(fontSize: 12)),
                              style: OutlinedButton.styleFrom(
                                foregroundColor: AppColors.primary,
                                visualDensity: VisualDensity.compact,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Form Thông Tin Gian Hàng
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE5E7EB)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Thông Tin Gian Hàng', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF1E2022))),
                const SizedBox(height: 14),
                TextField(
                  controller: _shopNameCtrl,
                  decoration: InputDecoration(
                    labelText: 'Tên gian hàng *',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _shopTaglineCtrl,
                  decoration: InputDecoration(
                    labelText: 'Khẩu hiệu gian hàng',
                    hintText: 'Ví dụ: Uy tín tạo nên thương hiệu',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _shopProvinceCtrl,
                  decoration: InputDecoration(
                    labelText: 'Tỉnh / Thành phố *',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _shopAddressCtrl,
                  decoration: InputDecoration(
                    labelText: 'Địa chỉ kho hàng / xuất phát',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _shopDescCtrl,
                  maxLines: 4,
                  decoration: InputDecoration(
                    labelText: 'Mô tả chi tiết gian hàng',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
                const SizedBox(height: 20),

                // Nút Lưu Hồ Sơ
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
                    onPressed: _isSavingShop ? null : _saveShopProfile,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: primaryColor,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    child: _isSavingShop
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                        : const Text('Lưu Thay Đổi Hồ Sơ', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                  ),
                ),

                // Nút Gửi Lại Xét Duyệt (Nếu đang bị Rejected)
                if (isRejected) ...[
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton.icon(
                      onPressed: _isResubmittingShop ? null : _resubmitShop,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFDC2626),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      icon: _isResubmittingShop
                          ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                          : const Icon(Icons.send_rounded, size: 18),
                      label: const Text('Gửi Lại Xét Duyệt (Resubmit)', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}
