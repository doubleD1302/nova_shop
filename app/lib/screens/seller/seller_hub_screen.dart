import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import '../../config/api_config.dart';
import '../../services/api_client.dart';
import '../../services/auth_service.dart';
import '../../services/payout_service.dart';
import '../../services/upload_service.dart';
import '../../theme/portal_theme.dart';
import '../../widgets/common/nova_logo.dart';
import 'seller_register_screen.dart' show kVietnamProvinces;
import 'seller_product_form_screen.dart';

class SellerHubScreen extends StatefulWidget {
  const SellerHubScreen({super.key});

  @override
  State<SellerHubScreen> createState() => _SellerHubScreenState();
}

class _SellerHubScreenState extends State<SellerHubScreen> with SingleTickerProviderStateMixin {
  final ApiClient _client = ApiClient();
  final PayoutService _payoutService = PayoutService();
  final NumberFormat _currencyFormat = NumberFormat.currency(locale: 'vi_VN', symbol: '₫', decimalDigits: 0);

  // Tabs chính của người bán
  int _activeNav = 0; // 0: Tổng quan, 1: Sản phẩm, 2: Đơn hàng, 3: Gian hàng, 4: Tài chính
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();

  // Dữ liệu shop
  Map<String, dynamic>? _shopProfile;
  Map<String, dynamic>? _orderSummary;
  List<Map<String, dynamic>> _sellerOrders = [];
  List<Map<String, dynamic>> _sellerProducts = [];
  List<Map<String, dynamic>> _categories = [];
  Map<String, dynamic>? _payoutData;

  bool _isLoadingOrders = false;
  bool _isLoadingProducts = false;
  bool _isLoadingProfile = false;
  bool _isLoadingPayout = false;

  // Controllers chỉnh sửa hồ sơ gian hàng
  final TextEditingController _shopNameController = TextEditingController();
  final TextEditingController _shopTaglineController = TextEditingController();
  final TextEditingController _shopDescController = TextEditingController();
  final TextEditingController _shopAddressController = TextEditingController();
  final TextEditingController _withdrawAmountController = TextEditingController();
  String _shopLocation = 'TP. Hồ Chí Minh';
  String? _shopLogoUrl;
  String? _shopBannerUrl;
  bool _isSavingShop = false;
  bool _isUploadingLogo = false;
  bool _isUploadingBanner = false;
  bool _isResubmitting = false;
  bool _isSubmittingPayout = false;

  // Bộ lọc đơn hàng (6 tabs giống website)
  String _orderTab = 'all'; // all, pending, confirmed, shipping, delivered, cancelled
  String _orderSearch = '';

  // Bộ lọc sản phẩm (5 tabs giống website)
  String _productTab = 'all'; // all, active, pending, rejected, out_of_stock
  String _productSearch = '';
  String _selectedCategory = 'all';

  // Biểu đồ 7 ngày
  String _timeRange = '7d';

  @override
  void initState() {
    super.initState();
    _loadAll();
  }

  @override
  void dispose() {
    _shopNameController.dispose();
    _shopTaglineController.dispose();
    _shopDescController.dispose();
    _shopAddressController.dispose();
    _withdrawAmountController.dispose();
    super.dispose();
  }

  void _loadAll() {
    _loadProfile();
    _loadOrders();
    _loadProducts();
    _loadCategories();
    _loadPayout();
  }

  Future<void> _loadProfile() async {
    setState(() => _isLoadingProfile = true);
    final res = await _client.get('/api/v1/seller/shop');
    if (mounted) {
      if (res.success && res.data is Map) {
        final dataMap = res.data as Map;
        final shopMap = dataMap.containsKey('shop') ? dataMap['shop'] : dataMap;
        final map = Map<String, dynamic>.from(shopMap as Map);
        setState(() {
          _shopProfile = map;
          _isLoadingProfile = false;
          _initShopControllers(map);
        });
      } else {
        final user = AuthService().currentUser;
        final shopId = user?.shopId;
        if (shopId != null && shopId.isNotEmpty) {
          final shopRes = await _client.get('/api/v1/shops/$shopId');
          if (mounted) {
            setState(() {
              if (shopRes.success && shopRes.data is Map) {
                final dataMap = shopRes.data as Map;
                final shopMap = dataMap.containsKey('shop') ? dataMap['shop'] : dataMap;
                final map = Map<String, dynamic>.from(shopMap as Map);
                _shopProfile = map;
                _initShopControllers(map);
              }
              _isLoadingProfile = false;
            });
          }
        } else {
          setState(() => _isLoadingProfile = false);
        }
      }
    }
  }

  void _initShopControllers(Map<String, dynamic> map) {
    if (_shopNameController.text.isEmpty) {
      _shopNameController.text = map['name']?.toString() ?? '';
    }
    if (_shopTaglineController.text.isEmpty) {
      _shopTaglineController.text = map['tagline']?.toString() ?? '';
    }
    if (_shopDescController.text.isEmpty) {
      _shopDescController.text = map['description']?.toString() ?? '';
    }
    if (_shopAddressController.text.isEmpty) {
      _shopAddressController.text = map['address']?.toString() ?? '';
    }
    final loc = map['location']?.toString();
    if (loc != null && loc.isNotEmpty && kVietnamProvinces.contains(loc)) {
      _shopLocation = loc;
    }
    _shopLogoUrl = map['logoUrl']?.toString();
    _shopBannerUrl = map['bannerUrl']?.toString();
  }

  Future<void> _pickAndUploadLogo() async {
    try {
      final picker = ImagePicker();
      final xFile = await picker.pickImage(source: ImageSource.gallery, maxWidth: 1024, maxHeight: 1024, imageQuality: 85);
      if (xFile == null) return;

      setState(() => _isUploadingLogo = true);
      final bytes = await xFile.readAsBytes();
      final res = await UploadService().uploadBytes(bytes: bytes, fileName: xFile.name, purpose: 'shop');
      if (mounted) {
        setState(() {
          _isUploadingLogo = false;
          if (res.success && res.url != null) {
            _shopLogoUrl = res.url;
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Tải ảnh logo lên thành công!'), backgroundColor: SellerTheme.success),
            );
          } else {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(res.error ?? 'Tải ảnh logo thất bại.'), backgroundColor: SellerTheme.danger),
            );
          }
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isUploadingLogo = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Lỗi chọn ảnh: $e'), backgroundColor: SellerTheme.danger),
        );
      }
    }
  }

  Future<void> _pickAndUploadBanner() async {
    try {
      final picker = ImagePicker();
      final xFile = await picker.pickImage(source: ImageSource.gallery, maxWidth: 1920, maxHeight: 600, imageQuality: 85);
      if (xFile == null) return;

      setState(() => _isUploadingBanner = true);
      final bytes = await xFile.readAsBytes();
      final res = await UploadService().uploadBytes(bytes: bytes, fileName: xFile.name, purpose: 'shop');
      if (mounted) {
        setState(() {
          _isUploadingBanner = false;
          if (res.success && res.url != null) {
            _shopBannerUrl = res.url;
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Tải ảnh bìa gian hàng thành công!'), backgroundColor: SellerTheme.success),
            );
          } else {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(res.error ?? 'Tải ảnh bìa thất bại.'), backgroundColor: SellerTheme.danger),
            );
          }
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isUploadingBanner = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Lỗi chọn ảnh: $e'), backgroundColor: SellerTheme.danger),
        );
      }
    }
  }

  Future<void> _saveShopProfile() async {
    if (_shopNameController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vui lòng nhập tên gian hàng.'), backgroundColor: SellerTheme.danger),
      );
      return;
    }

    setState(() => _isSavingShop = true);
    final body = {
      'name': _shopNameController.text.trim(),
      'tagline': _shopTaglineController.text.trim(),
      'address': _shopAddressController.text.trim(),
      'location': _shopLocation,
      'description': _shopDescController.text.trim(),
      'logoUrl': _shopLogoUrl,
      'bannerUrl': _shopBannerUrl,
    };
    final res = await _client.put('/api/v1/seller/shop', body: body);
    if (mounted) {
      setState(() => _isSavingShop = false);
      if (res.success) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Đã lưu thông tin gian hàng thành công!'), backgroundColor: SellerTheme.success),
        );
        _loadProfile();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(res.message.isNotEmpty ? res.message : 'Lỗi cập nhật gian hàng.'), backgroundColor: SellerTheme.danger),
        );
      }
    }
  }

  Future<void> _resubmitShop() async {
    setState(() => _isResubmitting = true);
    final res = await _client.post('/api/v1/seller/shop/resubmit');
    if (mounted) {
      setState(() => _isResubmitting = false);
      if (res.success) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Đã gửi lại hồ sơ duyệt gian hàng thành công. Gian hàng chuyển sang trạng thái chờ duyệt.'),
            backgroundColor: SellerTheme.success,
          ),
        );
        _loadProfile();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(res.message.isNotEmpty ? res.message : 'Gửi lại hồ sơ thất bại.'), backgroundColor: SellerTheme.danger),
        );
      }
    }
  }

  void _showPendingApiDialog(String title, String desc) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: SellerTheme.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(0xFFFBF3E8),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.hourglass_top_rounded, color: SellerTheme.primary, size: 20),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                title,
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: SellerTheme.textPrimary),
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: Colors.amber.shade50,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.amber.shade300),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.code_off_rounded, size: 14, color: Colors.amber.shade900),
                  const SizedBox(width: 6),
                  Text(
                    'Chưa có API Backend',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.amber.shade900),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Text(
              desc,
              style: const TextStyle(fontSize: 13, color: SellerTheme.textPrimary, height: 1.4),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: SellerTheme.surfaceSubtle,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: SellerTheme.border),
              ),
              child: const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Thông báo phát triển:',
                    style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold, color: SellerTheme.primary),
                  ),
                  SizedBox(height: 4),
                  Text(
                    '• Giao diện UI/UX đã được xây dựng đồng bộ 100% với website NovaShop.\n• Tính năng sẽ hoạt động đầy đủ ngay sau khi Backend triển khai API tương ứng.',
                    style: TextStyle(fontSize: 11, color: SellerTheme.textSecondary, height: 1.4),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: SellerTheme.primary,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Đã hiểu'),
          ),
        ],
      ),
    );
  }

  void _showRejectionReasonModal(Map<String, dynamic> product) {
    final name = product['name']?.toString() ?? 'Sản phẩm';
    final id = product['id']?.toString() ?? '';
    final reason = product['rejectionReason']?.toString() ?? 'Chưa có thông tin lý do cụ thể từ Ban Quản Trị.';
    final reviewedAt = product['reviewedAt']?.toString();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(20),
        decoration: const BoxDecoration(
          color: SellerTheme.card,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.red.shade50,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.cancel_outlined, color: Colors.red, size: 20),
                    ),
                    const SizedBox(width: 10),
                    const Text(
                      'Lý Do Từ Chối Duyệt',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: SellerTheme.textPrimary),
                    ),
                  ],
                ),
                IconButton(
                  icon: const Icon(Icons.close, size: 20, color: SellerTheme.textSecondary),
                  onPressed: () => Navigator.pop(ctx),
                ),
              ],
            ),
            const Divider(color: SellerTheme.border, height: 24),
            Text('Sản phẩm: $name', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: SellerTheme.textPrimary)),
            Text('Mã sản phẩm: #$id', style: const TextStyle(fontSize: 11.5, color: SellerTheme.textSecondary)),
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.red.shade50,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: Colors.red.shade200),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'GHI CHÚ TỪ BAN QUẢN TRỊ:',
                    style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: Colors.red, letterSpacing: 0.5),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    reason,
                    style: TextStyle(fontSize: 12.5, color: Colors.red.shade900, height: 1.4),
                  ),
                  if (reviewedAt != null && reviewedAt.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(
                      'Thời gian phản hồi: $reviewedAt',
                      style: TextStyle(fontSize: 10.5, color: Colors.red.shade700),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 14),
            const Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('💡 ', style: TextStyle(fontSize: 14)),
                Expanded(
                  child: Text(
                    'Hướng dẫn: Hãy bấm "Chỉnh sửa sản phẩm này" để sửa lại thông tin/hình ảnh theo góp ý. Sau khi nhấn Lưu, sản phẩm sẽ tự động gửi lại cho Admin duyệt.',
                    style: TextStyle(fontSize: 11.5, color: SellerTheme.textSecondary, height: 1.35),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(ctx),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: const Text('Đóng'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: ElevatedButton(
                    onPressed: () {
                      Navigator.pop(ctx);
                      _showProductDialog(product);
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: SellerTheme.primary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: const Text('Chỉnh sửa sản phẩm này →'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _loadOrders() async {
    setState(() => _isLoadingOrders = true);
    final res = await _client.get('/api/v1/seller/orders');
    if (mounted) {
      if (res.success) {
        List<dynamic> list = [];
        if (res.data is List) {
          list = res.data as List;
        } else if (res.data is Map && (res.data as Map).containsKey('orders')) {
          list = (res.data as Map)['orders'] as List;
          if ((res.data as Map).containsKey('summary') && (res.data as Map)['summary'] is Map) {
            _orderSummary = Map<String, dynamic>.from((res.data as Map)['summary'] as Map);
          }
        }
        setState(() {
          _sellerOrders = list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
          _isLoadingOrders = false;
        });
      } else {
        setState(() => _isLoadingOrders = false);
      }
    }
  }

  Future<void> _loadProducts() async {
    setState(() => _isLoadingProducts = true);
    final res = await _client.get('/api/v1/seller/products');
    if (mounted) {
      if (res.success) {
        List<dynamic> list = [];
        if (res.data is List) {
          list = res.data as List;
        } else if (res.data is Map && (res.data as Map).containsKey('products')) {
          list = (res.data as Map)['products'] as List;
        }
        setState(() {
          _sellerProducts = list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
          _isLoadingProducts = false;
        });
      } else {
        setState(() => _isLoadingProducts = false);
      }
    }
  }

  Future<void> _loadCategories() async {
    final res = await _client.get('/api/v1/categories');
    if (mounted && res.success) {
      List<dynamic> list = [];
      if (res.data is List) {
        list = res.data as List;
      } else if (res.data is Map && (res.data as Map).containsKey('categories')) {
        list = (res.data as Map)['categories'] as List;
      }
      setState(() {
        _categories = list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      });
    }
  }

  Future<void> _loadPayout() async {
    setState(() => _isLoadingPayout = true);
    try {
      final data = await _payoutService.getPayoutStatus();
      if (mounted) {
        setState(() {
          if (data != null) {
            _payoutData = data.containsKey('data') && data['data'] is Map
                ? Map<String, dynamic>.from(data['data'])
                : Map<String, dynamic>.from(data);
          } else {
            _payoutData = null;
          }
          _isLoadingPayout = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoadingPayout = false);
    }
  }

  Future<void> _handleSetupPayout() async {
    setState(() => _isSubmittingPayout = true);
    final res = await _payoutService.setupPayout();
    if (!mounted) return;
    setState(() => _isSubmittingPayout = false);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(res['message']?.toString() ?? 'Đã kích hoạt ví người bán'),
        backgroundColor: res['success'] == true ? SellerTheme.success : SellerTheme.danger,
      ),
    );
    _loadPayout();
  }

  Future<void> _handleRequestWithdrawal() async {
    final rawText = _withdrawAmountController.text.trim().replaceAll(RegExp(r'\D'), '');
    final amount = int.tryParse(rawText) ?? 0;
    if (amount <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vui lòng nhập số tiền rút hợp lệ.')),
      );
      return;
    }

    setState(() => _isSubmittingPayout = true);
    final res = await _payoutService.requestWithdrawal(amount);
    if (!mounted) return;
    setState(() => _isSubmittingPayout = false);

    if (res['success'] == true) {
      _withdrawAmountController.clear();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(res['message']?.toString() ?? 'Yêu cầu rút tiền thành công!'),
          backgroundColor: SellerTheme.success,
        ),
      );
      _loadPayout();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(res['message']?.toString() ?? 'Rút tiền không thành công.'),
          backgroundColor: SellerTheme.danger,
        ),
      );
    }
  }

  // --- ACTIONS ---

  Future<void> _updateOrderStatus(String shopOrderId, String newStatus, String actionLabel) async {
    final res = await _client.patch(
      '/api/v1/seller/orders/$shopOrderId/status',
      body: {'status': newStatus},
    );
    if (!mounted) return;
    if (res.success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('$actionLabel thành công!'),
          backgroundColor: SellerTheme.success,
        ),
      );
      _loadOrders();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(res.message.isNotEmpty ? res.message : 'Thao tác không thành công.'),
          backgroundColor: SellerTheme.danger,
        ),
      );
    }
  }

  Future<void> _saveProduct({
    String? productId,
    required String name,
    required double price,
    required double originalPrice,
    required int stock,
    required String categoryId,
    required String description,
    required String imageUrl,
  }) async {
    final body = {
      'name': name,
      'price': price,
      'originalPrice': originalPrice > 0 ? originalPrice : price,
      'stock': stock,
      'categoryId': categoryId,
      'description': description,
      'images': [imageUrl],
      'status': 'active',
    };

    final res = productId != null
        ? await _client.put('/api/v1/seller/products/$productId', body: body)
        : await _client.post('/api/v1/seller/products', body: body);

    if (!mounted) return;
    if (res.success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(productId != null ? 'Cập nhật sản phẩm thành công!' : 'Thêm sản phẩm mới thành công!'),
          backgroundColor: SellerTheme.success,
        ),
      );
      _loadProducts();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(res.message.isNotEmpty ? res.message : 'Lỗi khi lưu sản phẩm.'),
          backgroundColor: SellerTheme.danger,
        ),
      );
    }
  }

  Future<void> _deleteProduct(String productId) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: SellerTheme.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Xác nhận xóa', style: TextStyle(fontWeight: FontWeight.bold, color: SellerTheme.textPrimary)),
        content: const Text('Bạn có chắc muốn xóa sản phẩm này khỏi gian hàng?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Hủy')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: SellerTheme.danger),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Xóa'),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    final res = await _client.delete('/api/v1/seller/products/$productId');
    if (!mounted) return;
    if (res.success) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Đã xóa sản phẩm.'), backgroundColor: SellerTheme.success),
      );
      _loadProducts();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(res.message.isNotEmpty ? res.message : 'Xóa thất bại.'), backgroundColor: SellerTheme.danger),
      );
    }
  }

  Future<void> _showProductDialog([Map<String, dynamic>? initial]) async {
    final updated = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => SellerProductFormScreen(
          initialProduct: initial,
          shopInfo: _shopProfile,
          initialCategories: _categories,
        ),
      ),
    );

    if (updated == true) {
      _loadProducts();
      _loadProfile();
    }
  }

  void _showNotificationsDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: SellerTheme.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            const Icon(Icons.notifications_active_outlined, color: SellerTheme.primary, size: 22),
            const SizedBox(width: 8),
            const Text('Thông báo gian hàng', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: SellerTheme.textPrimary)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _buildNotificationItem('Đơn hàng mới cần xác nhận', 'Đơn hàng vừa được khách đặt và đang chờ bạn xác nhận.', '2 giờ trước'),
            const SizedBox(height: 10),
            _buildNotificationItem('Cảnh báo tồn kho', 'Có sản phẩm sắp hết hàng, vui lòng kiểm tra kho để nhập thêm.', '5 giờ trước'),
            const SizedBox(height: 10),
            _buildNotificationItem('Chương trình ưu đãi tháng này', 'Tham gia Flash Sale của NovaShop để tăng trưởng doanh số.', '1 ngày trước'),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Đóng', style: TextStyle(color: SellerTheme.primary)),
          ),
        ],
      ),
    );
  }

  Widget _buildNotificationItem(String title, String desc, String time) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: SellerTheme.surfaceSubtle,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: SellerTheme.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: SellerTheme.textPrimary)),
          const SizedBox(height: 3),
          Text(desc, style: const TextStyle(fontSize: 11.5, color: SellerTheme.textSecondary)),
          const SizedBox(height: 4),
          Text(time, style: const TextStyle(fontSize: 10, color: SellerTheme.textSecondary)),
        ],
      ),
    );
  }

  // --- DRAWER (Sidebar giống chuẩn Shopee Seller Centre) ---

  Widget _buildDrawer() {
    final user = AuthService().currentUser;
    final shopName = _shopProfile?['name']?.toString() ?? user?.fullName ?? 'ShopNova Gian Hàng';
    final shopId = _shopProfile?['id']?.toString() ?? user?.shopId ?? '12345678';

    return Drawer(
      backgroundColor: SellerTheme.card,
      child: SafeArea(
        child: Column(
          children: [
            // Header
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 18),
              decoration: const BoxDecoration(
                border: Border(bottom: BorderSide(color: SellerTheme.border)),
              ),
              child: Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: SellerTheme.surfaceSubtle,
                      shape: BoxShape.circle,
                      border: Border.all(color: SellerTheme.border),
                    ),
                    child: Center(
                      child: Text(
                        shopName.isNotEmpty ? shopName[0].toUpperCase() : 'S',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: SellerTheme.primary),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          shopName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: SellerTheme.textPrimary),
                        ),
                        const SizedBox(height: 2),
                        Wrap(
                          spacing: 6,
                          runSpacing: 4,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                              decoration: BoxDecoration(
                                color: SellerTheme.successBg,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: const Text('✓ Đã xác minh', style: TextStyle(fontSize: 9.5, color: SellerTheme.success, fontWeight: FontWeight.bold)),
                            ),
                            Text('ID: $shopId', style: const TextStyle(fontSize: 11, color: SellerTheme.textSecondary)),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // Navigation Links
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(vertical: 8),
                children: [
                  _drawerItem(0, Icons.dashboard_outlined, Icons.dashboard_rounded, 'Tổng quan gian hàng'),
                  _drawerItem(1, Icons.inventory_2_outlined, Icons.inventory_2_rounded, 'Quản lý sản phẩm', count: _sellerProducts.length),
                  _drawerItem(2, Icons.local_shipping_outlined, Icons.local_shipping_rounded, 'Quản lý đơn hàng', count: _sellerOrders.length),
                  _drawerItem(3, Icons.storefront_outlined, Icons.storefront_rounded, 'Hồ sơ gian hàng'),
                  _drawerItem(4, Icons.account_balance_wallet_outlined, Icons.account_balance_wallet_rounded, 'Tài chính & Ví Shop'),
                  const Divider(color: SellerTheme.border, height: 24),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                    child: Text('TIỆN ÍCH SHOP', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: SellerTheme.textSecondary.withValues(alpha: 0.7))),
                  ),
                  ListTile(
                    dense: true,
                    leading: const Icon(Icons.confirmation_number_outlined, size: 20, color: SellerTheme.textSecondary),
                    title: const Text('Mã giảm giá (Vouchers)', style: TextStyle(fontSize: 13, color: SellerTheme.textPrimary)),
                    onTap: () {
                      Navigator.pop(context);
                      _showPendingApiDialog(
                        'Mã giảm giá của Shop (Vouchers)',
                        'Tính năng tạo & quản lý mã giảm giá riêng cho gian hàng đang được bổ sung Backend API. Hiện tại hệ thống áp dụng mã voucher toàn sàn.',
                      );
                    },
                  ),
                  ListTile(
                    dense: true,
                    leading: const Icon(Icons.campaign_outlined, size: 20, color: SellerTheme.textSecondary),
                    title: const Text('Quảng cáo & Flash Sale', style: TextStyle(fontSize: 13, color: SellerTheme.textPrimary)),
                    onTap: () {
                      Navigator.pop(context);
                      _showPendingApiDialog(
                        'Quảng cáo & Chiến dịch Marketing',
                        'Tính năng đăng ký chiến dịch quảng bá và mua gói đẩy sản phẩm đang chờ Backend API hoàn thiện.',
                      );
                    },
                  ),
                  ListTile(
                    dense: true,
                    leading: const Icon(Icons.headset_mic_outlined, size: 20, color: SellerTheme.textSecondary),
                    title: const Text('Chăm sóc khách hàng', style: TextStyle(fontSize: 13, color: SellerTheme.textPrimary)),
                    onTap: () {
                      Navigator.pop(context);
                      _showPendingApiDialog(
                        'Chăm sóc khách hàng (Live Chat)',
                        'Hệ thống nhắn tin trực tiếp WebSocket giữa Người Bán và Khách Hàng đang trong giai đoạn phát triển Backend API.',
                      );
                    },
                  ),
                ],
              ),
            ),

            // Footer: Quay lại chế độ mua sắm & Đăng xuất
            Container(
              padding: const EdgeInsets.all(14),
              decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: SellerTheme.border)),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  ListTile(
                    dense: true,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    tileColor: SellerTheme.primary.withValues(alpha: 0.1),
                    leading: const Icon(Icons.shopping_bag_outlined, color: SellerTheme.primary, size: 20),
                    title: const Text('Quay lại Chợ NovaShop', style: TextStyle(color: SellerTheme.primary, fontWeight: FontWeight.bold, fontSize: 13)),
                    subtitle: const Text('Chuyển về giao diện Người mua', style: TextStyle(fontSize: 10.5, color: SellerTheme.textSecondary)),
                    onTap: () {
                      Navigator.pop(context); // Close Drawer
                      Navigator.pop(context); // Return to Buyer Main/Account
                    },
                  ),
                  const SizedBox(height: 8),
                  ListTile(
                    dense: true,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    tileColor: SellerTheme.surfaceSubtle,
                    leading: const Icon(Icons.logout_rounded, color: SellerTheme.danger, size: 20),
                    title: const Text('Đăng xuất tài khoản', style: TextStyle(color: SellerTheme.danger, fontWeight: FontWeight.bold, fontSize: 13)),
                    onTap: () {
                      AuthService().logout();
                      if (mounted) {
                        Navigator.of(context).popUntil((route) => route.isFirst);
                      }
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _drawerItem(int index, IconData icon, IconData activeIcon, String label, {int? count}) {
    final isSelected = _activeNav == index;
    return ListTile(
      dense: true,
      selected: isSelected,
      selectedTileColor: SellerTheme.surfaceSubtle,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      leading: Icon(
        isSelected ? activeIcon : icon,
        color: isSelected ? SellerTheme.primary : SellerTheme.textSecondary,
        size: 20,
      ),
      title: Text(
        label,
        style: TextStyle(
          fontSize: 13,
          fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
          color: isSelected ? SellerTheme.primary : SellerTheme.textPrimary,
        ),
      ),
      trailing: count != null
          ? Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
              decoration: BoxDecoration(
                color: isSelected ? SellerTheme.primary : SellerTheme.surfaceSubtle,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                '$count',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  color: isSelected ? Colors.white : SellerTheme.textSecondary,
                ),
              ),
            )
          : null,
      onTap: () {
        setState(() => _activeNav = index);
        Navigator.pop(context);
      },
    );
  }

  // --- TOP BAR ---

  PreferredSizeWidget _buildAppBar() {
    return AppBar(
      leading: IconButton(
        icon: const Icon(Icons.menu_rounded, color: SellerTheme.textPrimary),
        onPressed: () => _scaffoldKey.currentState?.openDrawer(),
      ),
      titleSpacing: 0,
      title: const NovaLogo(size: 30, fontSize: 16, subtitle: 'Kênh Người Bán'),
      actions: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: OutlinedButton.icon(
            onPressed: () => Navigator.pop(context),
            icon: const Icon(Icons.shopping_bag_outlined, size: 14),
            label: const Text('Về Chợ', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold)),
            style: OutlinedButton.styleFrom(
              foregroundColor: SellerTheme.primary,
              side: const BorderSide(color: SellerTheme.border),
              padding: const EdgeInsets.symmetric(horizontal: 10),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            ),
          ),
        ),
        IconButton(
          icon: Stack(
            clipBehavior: Clip.none,
            children: [
              const Icon(Icons.notifications_none_rounded, color: SellerTheme.textPrimary, size: 22),
              Positioned(
                right: -2,
                top: -2,
                child: Container(
                  padding: const EdgeInsets.all(3.5),
                  decoration: const BoxDecoration(color: SellerTheme.primary, shape: BoxShape.circle),
                  child: const Text('3', style: TextStyle(color: Colors.white, fontSize: 8.5, fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
          onPressed: _showNotificationsDialog,
        ),
        IconButton(
          icon: const Icon(Icons.refresh_rounded, color: SellerTheme.textPrimary, size: 22),
          onPressed: _loadAll,
        ),
        const SizedBox(width: 4),
      ],
    );
  }

  // ============================================================
  // TAB 0: TỔNG QUAN (DASHBOARD) - GIỐNG CHUẨN SHOPEE SELLER CENTRE
  // ============================================================

  Widget _buildDashboardTab() {
    final user = AuthService().currentUser;
    final shopName = _shopProfile?['name']?.toString() ?? user?.fullName ?? 'Gian hàng của bạn';
    final shopId = _shopProfile?['id']?.toString() ?? '12345678';

    // Tính toán KPI
    final totalOrders = _sellerOrders.length;
    final pendingOrders = _sellerOrders.where((o) => o['status'] == 'pending').length;
    final deliveredOrders = _sellerOrders.where((o) => o['status'] == 'delivered').length;
    final todayStr = DateTime.now().toIso8601String().substring(0, 10);
    final todayOrders = _sellerOrders.where((o) => (o['createdAt']?.toString() ?? '').startsWith(todayStr)).length;
    final revenue = _sellerOrders
        .where((o) => o['status'] == 'delivered')
        .fold<double>(0, (sum, o) => sum + (double.tryParse(o['totalForShop']?.toString() ?? o['totalAmount']?.toString() ?? '0') ?? 0));

    return RefreshIndicator(
      onRefresh: () async => _loadAll(),
      color: SellerTheme.primary,
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Banner chào mừng
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [SellerTheme.surfaceSubtle, Color(0xFFFBF3E8)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: SellerTheme.border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Xin chào, $shopName 👋',
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: SellerTheme.textSecondary),
                            ),
                            const SizedBox(height: 4),
                            const Text(
                              'Chào mừng bạn đến với Kênh Người Bán NovaShop',
                              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: SellerTheme.textPrimary, height: 1.3),
                            ),
                            const SizedBox(height: 6),
                            const Text(
                              'Quản lý gian hàng, đơn hàng và phát triển doanh số cùng hệ thống thương mại điện tử chuyên nghiệp.',
                              style: TextStyle(fontSize: 12, color: SellerTheme.textSecondary, height: 1.4),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      // Storefront icon graphic
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: SellerTheme.card,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: SellerTheme.border),
                        ),
                        child: const Icon(Icons.storefront_rounded, size: 36, color: SellerTheme.primaryHover),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),

            // Card Thông tin gian hàng & Copy ID
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: SellerTheme.card,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: SellerTheme.border),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: SellerTheme.surfaceSubtle,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.store_rounded, size: 20, color: SellerTheme.primary),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Flexible(
                              child: Text(
                                shopName,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5, color: SellerTheme.textPrimary),
                              ),
                            ),
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                              decoration: BoxDecoration(
                                color: SellerTheme.successBg,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: const Text('✓ Đã xác minh', style: TextStyle(fontSize: 9, color: SellerTheme.success, fontWeight: FontWeight.bold)),
                            ),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text('ID gian hàng: $shopId', style: const TextStyle(fontSize: 11, color: SellerTheme.textSecondary)),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.copy_rounded, size: 16, color: SellerTheme.textSecondary),
                    onPressed: () {
                      Clipboard.setData(ClipboardData(text: shopId));
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('Đã sao chép ID gian hàng: $shopId'), backgroundColor: SellerTheme.success),
                      );
                    },
                  ),
                  OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      minimumSize: Size.zero,
                    ),
                    onPressed: () => setState(() => _activeNav = 3),
                    child: const Text('Chỉnh sửa', style: TextStyle(fontSize: 11)),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // 5 Thẻ Thống Kê KPI Chuẩn Shopee Seller Centre
            const Text(
              'CHỈ SỐ HOẠT ĐỘNG',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: SellerTheme.textSecondary, letterSpacing: 0.5),
            ),
            const SizedBox(height: 10),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _kpiCard('Đơn hàng hôm nay', '$todayOrders', Icons.shopping_bag_outlined, () => setState(() => _activeNav = 2)),
                  const SizedBox(width: 10),
                  _kpiCard('Chờ xử lý', '$pendingOrders', Icons.inventory_2_outlined, () {
                    setState(() {
                      _activeNav = 2;
                      _orderTab = 'pending';
                    });
                  }),
                  const SizedBox(width: 10),
                  _kpiCard('Đã giao thành công', '$deliveredOrders', Icons.local_shipping_outlined, () {
                    setState(() {
                      _activeNav = 2;
                      _orderTab = 'delivered';
                    });
                  }),
                  const SizedBox(width: 10),
                  _kpiCard('Doanh thu hoàn tất', _currencyFormat.format(revenue), Icons.account_balance_wallet_outlined, () => setState(() => _activeNav = 4)),
                  const SizedBox(width: 10),
                  _kpiCard('Đánh giá sản phẩm', '5.0 ★', Icons.star_outline_rounded, null),
                ],
              ),
            ),
            const SizedBox(height: 18),

            // Biểu đồ tình hình kinh doanh
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: SellerTheme.card,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: SellerTheme.border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(6),
                            decoration: BoxDecoration(color: SellerTheme.surfaceSubtle, borderRadius: BorderRadius.circular(8)),
                            child: const Icon(Icons.insights_rounded, size: 18, color: SellerTheme.primary),
                          ),
                          const SizedBox(width: 8),
                          const Text('Tình hình kinh doanh', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: SellerTheme.textPrimary)),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: SellerTheme.surfaceSubtle,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: SellerTheme.border),
                        ),
                        child: const Text('7 ngày qua', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: SellerTheme.textPrimary)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Row(
                        children: [
                          Container(width: 8, height: 8, decoration: const BoxDecoration(color: SellerTheme.primary, shape: BoxShape.circle)),
                          const SizedBox(width: 4),
                          const Text('Doanh thu', style: TextStyle(fontSize: 11, color: SellerTheme.textSecondary)),
                        ],
                      ),
                      const SizedBox(width: 16),
                      Row(
                        children: [
                          Container(width: 8, height: 8, decoration: const BoxDecoration(color: SellerTheme.textSecondary, shape: BoxShape.circle)),
                          const SizedBox(width: 4),
                          const Text('Đơn hàng', style: TextStyle(fontSize: 11, color: SellerTheme.textSecondary)),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  // Vẽ biểu đồ xu hướng bằng CustomPaint
                  SizedBox(
                    height: 110,
                    width: double.infinity,
                    child: CustomPaint(
                      painter: _TrendChartPainter(orders: _sellerOrders),
                    ),
                  ),
                  const Divider(color: SellerTheme.border, height: 20),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _metricCol('Doanh thu', _currencyFormat.format(revenue)),
                      _metricCol('Tổng đơn', '$totalOrders đơn'),
                      _metricCol('Sản phẩm', '${_sellerProducts.length} mã'),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),

            // Lưới 8 Công Cụ Nhanh Chuẩn Shopee
            const Text(
              'CÔNG CỤ NHANH',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: SellerTheme.textSecondary, letterSpacing: 0.5),
            ),
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: SellerTheme.card,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: SellerTheme.border),
              ),
              child: GridView.count(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisCount: 4,
                mainAxisSpacing: 12,
                crossAxisSpacing: 8,
                childAspectRatio: 0.85,
                children: [
                  _quickToolItem(Icons.add_circle_outline_rounded, 'Thêm sản phẩm', () => _showProductDialog()),
                  _quickToolItem(Icons.inventory_2_outlined, 'Quản lý đơn', () => setState(() => _activeNav = 2)),
                  _quickToolItem(Icons.confirmation_number_outlined, 'Khuyến mãi', () {
                    _showPendingApiDialog(
                      'Khuyến mãi của shop',
                      'Tính năng tạo mã giảm giá (Voucher) và thiết lập chương trình ưu đãi của gian hàng.',
                    );
                  }),
                  _quickToolItem(Icons.campaign_outlined, 'Marketing', () {
                    _showPendingApiDialog(
                      'Marketing & Quảng cáo',
                      'Công cụ chạy quảng cáo tìm kiếm và tiếp thị liên kết cho sản phẩm của shop.',
                    );
                  }),
                  _quickToolItem(Icons.assessment_outlined, 'Báo cáo', () => setState(() => _activeNav = 4)),
                  _quickToolItem(Icons.headset_mic_outlined, 'CSKH', () {
                    _showPendingApiDialog(
                      'Chăm sóc khách hàng',
                      'Hộp thư tin nhắn trò chuyện trực tiếp (Live Chat) và phản hồi đánh giá của người mua.',
                    );
                  }),
                  _quickToolItem(Icons.storefront_outlined, 'Hồ sơ shop', () => setState(() => _activeNav = 3)),
                  _quickToolItem(Icons.more_horiz_rounded, 'Xem thêm', () {
                    _showPendingApiDialog(
                      'Danh mục công cụ mở rộng',
                      'Bao gồm Quản lý kho nâng cao, Lịch sử giao dịch ví và Tải báo cáo phân tích Excel.',
                    );
                  }),
                ],
              ),
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  Widget _kpiCard(String title, String val, IconData icon, VoidCallback? onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        width: 140,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: SellerTheme.card,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: SellerTheme.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(color: SellerTheme.surfaceSubtle, borderRadius: BorderRadius.circular(8)),
                  child: Icon(icon, size: 16, color: SellerTheme.primary),
                ),
                if (onTap != null) const Icon(Icons.chevron_right_rounded, size: 16, color: SellerTheme.textSecondary),
              ],
            ),
            const SizedBox(height: 10),
            Text(title, style: const TextStyle(fontSize: 11, color: SellerTheme.textSecondary)),
            const SizedBox(height: 2),
            Text(
              val,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: SellerTheme.textPrimary),
            ),
          ],
        ),
      ),
    );
  }

  Widget _metricCol(String title, String val) {
    return Column(
      children: [
        Text(title, style: const TextStyle(fontSize: 11, color: SellerTheme.textSecondary)),
        const SizedBox(height: 2),
        Text(val, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.bold, color: SellerTheme.textPrimary)),
      ],
    );
  }

  Widget _quickToolItem(IconData icon, String label, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: SellerTheme.surfaceSubtle,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, color: SellerTheme.primary, size: 22),
          ),
          const SizedBox(height: 6),
          Text(
            label,
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: SellerTheme.textPrimary),
          ),
        ],
      ),
    );
  }

  // ============================================================
  // TAB 1: QUẢN LÝ SẢN PHẨM (GIỐNG SELLERPRODUCTSPAGE.JSX)
  // ============================================================

  Widget _buildProductsTab() {
    final filtered = _sellerProducts.filterProducts(_productTab, _productSearch, _selectedCategory);

    return Column(
      children: [
        // Top Header
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: const BoxDecoration(
            color: SellerTheme.card,
            border: Border(bottom: BorderSide(color: SellerTheme.border)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Sản phẩm (${_sellerProducts.length})',
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: SellerTheme.textPrimary),
              ),
              ElevatedButton.icon(
                icon: const Icon(Icons.add, size: 16),
                label: const Text('Thêm sản phẩm'),
                onPressed: () => _showProductDialog(),
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  minimumSize: Size.zero,
                ),
              ),
            ],
          ),
        ),

        // Tabs Trạng Thái
        Container(
          color: SellerTheme.card,
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            child: Row(
              children: [
                _productFilterChip('all', 'Tất cả (${_sellerProducts.length})'),
                _productFilterChip('active', 'Đang bán (${_sellerProducts.where((p) => p['approvalStatus'] == 'approved' && p['status'] != 'hidden' && (p['stock'] ?? 0) > 0).length})'),
                _productFilterChip('pending', 'Chờ duyệt (${_sellerProducts.where((p) => (p['approvalStatus'] ?? 'pending') == 'pending').length})'),
                _productFilterChip('rejected', 'Bị từ chối (${_sellerProducts.where((p) => p['approvalStatus'] == 'rejected').length})'),
                _productFilterChip('out_of_stock', 'Hết hàng / Ẩn (${_sellerProducts.where((p) => (p['stock'] ?? 0) <= 0 || p['status'] == 'hidden').length})'),
              ],
            ),
          ),
        ),

        // Search Bar
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: TextField(
            onChanged: (val) => setState(() => _productSearch = val.trim()),
            style: const TextStyle(fontSize: 13),
            decoration: InputDecoration(
              isDense: true,
              hintText: 'Tìm theo tên sản phẩm hoặc mã...',
              prefixIcon: const Icon(Icons.search, size: 18, color: SellerTheme.textSecondary),
              suffixIcon: _productSearch.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear, size: 16),
                      onPressed: () => setState(() => _productSearch = ''),
                    )
                  : null,
            ),
          ),
        ),

        // Danh sách sản phẩm
        Expanded(
          child: _isLoadingProducts
              ? const Center(child: CircularProgressIndicator(color: SellerTheme.primary))
              : filtered.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.inventory_2_outlined, size: 48, color: SellerTheme.textSecondary.withValues(alpha: 0.5)),
                          const SizedBox(height: 8),
                          const Text('Không tìm thấy sản phẩm nào', style: TextStyle(color: SellerTheme.textSecondary)),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: () async => _loadProducts(),
                      color: SellerTheme.primary,
                      child: ListView.separated(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        itemCount: filtered.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (ctx, index) {
                          final item = filtered[index];
                          return _buildProductCard(item);
                        },
                      ),
                    ),
        ),
      ],
    );
  }

  Widget _productFilterChip(String key, String label) {
    final isSelected = _productTab == key;
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: ChoiceChip(
        label: Text(label),
        selected: isSelected,
        selectedColor: SellerTheme.surfaceSubtle,
        backgroundColor: SellerTheme.card,
        side: BorderSide(color: isSelected ? SellerTheme.primary : SellerTheme.border),
        labelStyle: TextStyle(
          fontSize: 11.5,
          fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
          color: isSelected ? SellerTheme.primary : SellerTheme.textSecondary,
        ),
        onSelected: (val) {
          if (val) setState(() => _productTab = key);
        },
      ),
    );
  }

  Widget _buildProductCard(Map<String, dynamic> item) {
    final id = item['id']?.toString() ?? '';
    final name = item['name']?.toString() ?? 'Sản phẩm';
    final price = double.tryParse(item['price']?.toString() ?? '0') ?? 0;
    final stock = item['stock'] ?? 0;
    final sold = item['sold'] ?? 0;
    final approvalStatus = item['approvalStatus']?.toString() ?? 'pending';
    final status = item['status']?.toString() ?? 'active';

    String? imageUrl = item['imageUrl']?.toString();
    if (imageUrl == null && item['images'] is List && (item['images'] as List).isNotEmpty) {
      imageUrl = item['images'][0]?.toString();
    }

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: SellerTheme.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: SellerTheme.border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Ảnh thumbnail
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: Container(
              width: 72,
              height: 72,
              color: SellerTheme.surfaceSubtle,
              child: imageUrl != null && imageUrl.isNotEmpty
                  ? Image.network(
                      ApiConfig.resolveImageUrl(imageUrl),
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => const Icon(Icons.image_outlined, color: SellerTheme.textSecondary),
                    )
                  : const Icon(Icons.inventory_2_outlined, color: SellerTheme.textSecondary),
            ),
          ),
          const SizedBox(width: 12),
          // Thông tin
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        _approvalBadge(approvalStatus),
                        if (approvalStatus == 'rejected') ...[
                          const SizedBox(width: 8),
                          InkWell(
                            onTap: () => _showRejectionReasonModal(item),
                            child: const Text(
                              'Xem lý do',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: SellerTheme.danger,
                                decoration: TextDecoration.underline,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                    PopupMenuButton<String>(
                      icon: const Icon(Icons.more_vert_rounded, size: 18, color: SellerTheme.textSecondary),
                      onSelected: (val) {
                        if (val == 'edit') _showProductDialog(item);
                        if (val == 'delete') _deleteProduct(id);
                      },
                      itemBuilder: (ctx) => [
                        const PopupMenuItem(value: 'edit', child: Text('Chỉnh sửa', style: TextStyle(fontSize: 13))),
                        const PopupMenuItem(value: 'delete', child: Text('Xóa sản phẩm', style: TextStyle(fontSize: 13, color: Colors.red))),
                      ],
                    ),
                  ],
                ),
                Text(
                  name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: SellerTheme.textPrimary),
                ),
                const SizedBox(height: 4),
                Text(
                  _currencyFormat.format(price),
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5, color: SellerTheme.primary),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Text('Kho: $stock', style: const TextStyle(fontSize: 11, color: SellerTheme.textSecondary)),
                    const SizedBox(width: 12),
                    Text('Đã bán: $sold', style: const TextStyle(fontSize: 11, color: SellerTheme.textSecondary)),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _approvalBadge(String status) {
    Color bg;
    Color text;
    String label;

    switch (status) {
      case 'approved':
        bg = SellerTheme.successBg;
        text = SellerTheme.success;
        label = 'Đang bán';
        break;
      case 'rejected':
        bg = SellerTheme.dangerBg;
        text = SellerTheme.danger;
        label = 'Bị từ chối';
        break;
      case 'pending':
      default:
        bg = SellerTheme.warningBg;
        text = SellerTheme.warning;
        label = 'Chờ duyệt';
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(4)),
      child: Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: text)),
    );
  }

  // ============================================================
  // TAB 2: QUẢN LÝ ĐƠN HÀNG (GIỐNG SELLERORDERSPAGE.JSX)
  // ============================================================

  Widget _buildOrdersTab() {
    final filtered = _sellerOrders.filterOrders(_orderTab, _orderSearch);
    final deliveredRevenue = _sellerOrders
        .where((o) => o['status'] == 'delivered')
        .fold<double>(0, (sum, o) => sum + (double.tryParse(o['totalForShop']?.toString() ?? o['totalAmount']?.toString() ?? '0') ?? 0));

    return Column(
      children: [
        // Summary Header
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: const BoxDecoration(
            color: SellerTheme.card,
            border: Border(bottom: BorderSide(color: SellerTheme.border)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Quản Lý Đơn Hàng', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: SellerTheme.textPrimary)),
                  Text('${_sellerOrders.length} đơn hàng trong hệ thống', style: const TextStyle(fontSize: 11, color: SellerTheme.textSecondary)),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: SellerTheme.surfaceSubtle,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: SellerTheme.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    const Text('Đã giao', style: TextStyle(fontSize: 10, color: SellerTheme.textSecondary)),
                    Text(_currencyFormat.format(deliveredRevenue), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: SellerTheme.primary)),
                  ],
                ),
              ),
            ],
          ),
        ),

        // Tabs 6 trạng thái
        Container(
          color: SellerTheme.card,
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            child: Row(
              children: [
                _orderFilterChip('all', 'Tất cả (${_sellerOrders.length})'),
                _orderFilterChip('pending', 'Chờ xác nhận (${_sellerOrders.where((o) => o['status'] == 'pending').length})'),
                _orderFilterChip('confirmed', 'Chờ lấy hàng (${_sellerOrders.where((o) => o['status'] == 'confirmed').length})'),
                _orderFilterChip('shipping', 'Đang giao (${_sellerOrders.where((o) => o['status'] == 'shipping').length})'),
                _orderFilterChip('delivered', 'Đã giao (${_sellerOrders.where((o) => o['status'] == 'delivered').length})'),
                _orderFilterChip('cancelled', 'Đã hủy (${_sellerOrders.where((o) => o['status'] == 'cancelled').length})'),
              ],
            ),
          ),
        ),

        // Search Bar
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: TextField(
            onChanged: (val) => setState(() => _orderSearch = val.trim()),
            style: const TextStyle(fontSize: 13),
            decoration: InputDecoration(
              isDense: true,
              hintText: 'Tìm theo mã đơn, người mua...',
              prefixIcon: const Icon(Icons.search, size: 18, color: SellerTheme.textSecondary),
              suffixIcon: _orderSearch.isNotEmpty
                  ? IconButton(icon: const Icon(Icons.clear, size: 16), onPressed: () => setState(() => _orderSearch = ''))
                  : null,
            ),
          ),
        ),

        // Danh sách đơn hàng
        Expanded(
          child: _isLoadingOrders
              ? const Center(child: CircularProgressIndicator(color: SellerTheme.primary))
              : filtered.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.local_shipping_outlined, size: 48, color: SellerTheme.textSecondary.withValues(alpha: 0.5)),
                          const SizedBox(height: 8),
                          const Text('Không có đơn hàng nào', style: TextStyle(color: SellerTheme.textSecondary)),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: () async => _loadOrders(),
                      color: SellerTheme.primary,
                      child: ListView.separated(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        itemCount: filtered.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (ctx, index) {
                          final order = filtered[index];
                          return _buildOrderCard(order);
                        },
                      ),
                    ),
        ),
      ],
    );
  }

  Widget _orderFilterChip(String key, String label) {
    final isSelected = _orderTab == key;
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: ChoiceChip(
        label: Text(label),
        selected: isSelected,
        selectedColor: SellerTheme.surfaceSubtle,
        backgroundColor: SellerTheme.card,
        side: BorderSide(color: isSelected ? SellerTheme.primary : SellerTheme.border),
        labelStyle: TextStyle(
          fontSize: 11.5,
          fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
          color: isSelected ? SellerTheme.primary : SellerTheme.textSecondary,
        ),
        onSelected: (val) {
          if (val) setState(() => _orderTab = key);
        },
      ),
    );
  }

  Widget _buildOrderCard(Map<String, dynamic> order) {
    final orderId = order['id']?.toString() ?? '';
    final code = order['code']?.toString() ?? orderId;
    final status = order['status']?.toString() ?? 'pending';
    final buyerName = order['buyerName']?.toString() ?? order['customerName']?.toString() ?? 'Khách hàng';
    final total = double.tryParse(order['totalForShop']?.toString() ?? order['totalAmount']?.toString() ?? '0') ?? 0;
    final items = order['items'] is List ? (order['items'] as List) : [];
    final address = order['shippingAddress']?.toString() ?? '';

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: SellerTheme.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: SellerTheme.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Order Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Mã: #$code', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: SellerTheme.textPrimary)),
              _orderStatusBadge(status),
            ],
          ),
          const Divider(color: SellerTheme.border, height: 16),

          // Items
          if (items.isNotEmpty)
            ...items.take(2).map((item) {
              final iName = item['name']?.toString() ?? 'Sản phẩm';
              final iQty = item['quantity'] ?? 1;
              final iPrice = double.tryParse(item['price']?.toString() ?? '0') ?? 0;
              return Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(
                  children: [
                    Container(
                      width: 6,
                      height: 6,
                      decoration: const BoxDecoration(color: SellerTheme.primary, shape: BoxShape.circle),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        '$iName (x$iQty)',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 12, color: SellerTheme.textPrimary),
                      ),
                    ),
                    Text(_currencyFormat.format(iPrice * iQty), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: SellerTheme.textPrimary)),
                  ],
                ),
              );
            }),

          if (items.length > 2)
            Text('+ ${items.length - 2} sản phẩm khác', style: const TextStyle(fontSize: 11, color: SellerTheme.textSecondary)),

          const SizedBox(height: 6),
          // Buyer info
          Row(
            children: [
              const Icon(Icons.person_outline, size: 14, color: SellerTheme.textSecondary),
              const SizedBox(width: 4),
              Text(buyerName, style: const TextStyle(fontSize: 12, color: SellerTheme.textSecondary)),
            ],
          ),
          if (address.isNotEmpty) ...[
            const SizedBox(height: 2),
            Row(
              children: [
                const Icon(Icons.place_outlined, size: 14, color: SellerTheme.textSecondary),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    address,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 11, color: SellerTheme.textSecondary),
                  ),
                ),
              ],
            ),
          ],
          const Divider(color: SellerTheme.border, height: 16),

          // Total & Actions
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Tổng tiền', style: TextStyle(fontSize: 10, color: SellerTheme.textSecondary)),
                  Text(_currencyFormat.format(total), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: SellerTheme.primary)),
                ],
              ),
              _buildOrderActions(orderId, status),
            ],
          ),
        ],
      ),
    );
  }

  Widget _orderStatusBadge(String status) {
    Color bg;
    Color text;
    String label;

    switch (status) {
      case 'pending':
        bg = SellerTheme.warningBg;
        text = SellerTheme.warning;
        label = 'Chờ xác nhận';
        break;
      case 'confirmed':
        bg = SellerTheme.infoBg;
        text = SellerTheme.info;
        label = 'Chờ lấy hàng';
        break;
      case 'shipping':
        bg = const Color(0xFFE0E7FF);
        text = const Color(0xFF4338CA);
        label = 'Đang giao';
        break;
      case 'delivered':
        bg = SellerTheme.successBg;
        text = SellerTheme.success;
        label = 'Đã giao';
        break;
      case 'cancelled':
      default:
        bg = SellerTheme.dangerBg;
        text = SellerTheme.danger;
        label = 'Đã hủy';
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
      child: Text(label, style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: text)),
    );
  }

  Widget _buildOrderActions(String orderId, String status) {
    if (status == 'pending') {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          OutlinedButton(
            style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              minimumSize: Size.zero,
              foregroundColor: SellerTheme.danger,
              side: const BorderSide(color: SellerTheme.danger),
            ),
            onPressed: () => _updateOrderStatus(orderId, 'cancelled', 'Hủy đơn hàng'),
            child: const Text('Hủy', style: TextStyle(fontSize: 11)),
          ),
          const SizedBox(width: 8),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              minimumSize: Size.zero,
            ),
            onPressed: () => _updateOrderStatus(orderId, 'confirmed', 'Xác nhận đơn hàng'),
            child: const Text('Xác nhận', style: TextStyle(fontSize: 11)),
          ),
        ],
      );
    }
    if (status == 'confirmed') {
      return ElevatedButton.icon(
        icon: const Icon(Icons.local_shipping_outlined, size: 14),
        label: const Text('Giao hàng', style: TextStyle(fontSize: 11)),
        style: ElevatedButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          minimumSize: Size.zero,
        ),
        onPressed: () => _updateOrderStatus(orderId, 'shipping', 'Chuyển đơn vị giao hàng'),
      );
    }
    if (status == 'shipping') {
      return ElevatedButton(
        style: ElevatedButton.styleFrom(
          backgroundColor: SellerTheme.success,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          minimumSize: Size.zero,
        ),
        onPressed: () => _updateOrderStatus(orderId, 'delivered', 'Giao hàng thành công'),
        child: const Text('Đã giao xong', style: TextStyle(fontSize: 11)),
      );
    }
    return const SizedBox.shrink();
  }

  // ============================================================
  // TAB 3: HỒ SƠ GIAN HÀNG (GIỐNG SELLERSHOPPAGE.JSX)
  // ============================================================

  Widget _buildShopTab() {
    final user = AuthService().currentUser;
    final shopStatus = _shopProfile?['status']?.toString() ?? 'pending';
    final approvalStatus = _shopProfile?['approvalStatus']?.toString() ?? shopStatus;
    final approvalVersion = _shopProfile?['approvalVersion'] ?? 1;
    final rejectionReason = _shopProfile?['rejectionReason']?.toString() ?? 'Hồ sơ chưa đạt tiêu chuẩn quy định của sàn NovaShop.';

    final productCount = _shopProfile?['productCount'] ?? _sellerProducts.length;
    final followers = _shopProfile?['followers'] ?? 0;
    final rating = double.tryParse(_shopProfile?['rating']?.toString() ?? '5.0') ?? 5.0;
    final ratingCount = _shopProfile?['ratingCount'] ?? 0;
    final joined = _shopProfile?['joined']?.toString() ?? '2026';
    final totalSold = _shopProfile?['totalSold'] ?? 0;

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 1. BANNER TRẠNG THÁI XÉT DUYỆT (GIỐNG SELLERSHOPPAGE.JSX)
          if (approvalStatus == 'pending' || shopStatus == 'pending') ...[
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.amber.shade50,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.amber.shade300),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.hourglass_top_rounded, color: Colors.amber.shade900, size: 18),
                      const SizedBox(width: 8),
                      Text(
                        'Hồ sơ gian hàng đang chờ duyệt (v$approvalVersion)',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.amber.shade900),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Hồ sơ gian hàng của bạn đang trong hàng đợi kiểm duyệt của Ban Quản Trị NovaShop. Bạn có thể cập nhật thông tin và lưu lại bất cứ lúc nào.',
                    style: TextStyle(fontSize: 12, color: Colors.amber.shade900, height: 1.35),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
          ] else if (approvalStatus == 'rejected' || shopStatus == 'rejected') ...[
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.red.shade50,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.red.shade300),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.cancel_outlined, color: Colors.red, size: 18),
                          const SizedBox(width: 8),
                          Text(
                            'Hồ sơ bị từ chối duyệt (v$approvalVersion)',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.red),
                          ),
                        ],
                      ),
                      ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.red,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          minimumSize: Size.zero,
                        ),
                        onPressed: _isResubmitting ? null : _resubmitShop,
                        child: Text(_isResubmitting ? 'Đang gửi...' : 'Gửi lại hồ sơ', style: const TextStyle(fontSize: 11)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: Colors.red.shade200),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'LÝ DO TỪ CHỐI TỪ BAN QUẢN TRỊ:',
                          style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.red),
                        ),
                        const SizedBox(height: 4),
                        Text(rejectionReason, style: TextStyle(fontSize: 12, color: Colors.red.shade900)),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Vui lòng chỉnh sửa lại các thông tin chưa phù hợp ở biểu mẫu bên dưới, bấm "Lưu Thay Đổi", sau đó bấm "Gửi lại hồ sơ".',
                    style: TextStyle(fontSize: 11.5, color: Colors.red),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
          ] else if (approvalStatus == 'active' || shopStatus == 'active') ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: Colors.green.shade50,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: Colors.green.shade300),
              ),
              child: Row(
                children: [
                  const Icon(Icons.check_circle_outline_rounded, color: Colors.green, size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Gian hàng đang hoạt động bình thường trên NovaShop (v$approvalVersion)',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.green.shade900),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
          ] else if (shopStatus == 'suspended') ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.red.shade50,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: Colors.red.shade300),
              ),
              child: const Row(
                children: [
                  Icon(Icons.lock_outline_rounded, color: Colors.red, size: 18),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Gian hàng đang bị tạm khóa vi phạm bởi Quản trị viên.',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.red),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
          ],

          // 2. ẢNH BÌA GIAN HÀNG (BANNER) & LOGO SHOP
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: SellerTheme.card,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: SellerTheme.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Hình Ảnh Gian Hàng', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: SellerTheme.textPrimary)),
                    if (_isUploadingBanner || _isUploadingLogo)
                      const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: SellerTheme.primary)),
                  ],
                ),
                const SizedBox(height: 12),

                // Khung Banner
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Stack(
                    children: [
                      Container(
                        height: 100,
                        width: double.infinity,
                        color: SellerTheme.surfaceSubtle,
                        child: _shopBannerUrl != null && _shopBannerUrl!.isNotEmpty
                            ? Image.network(
                                ApiConfig.resolveImageUrl(_shopBannerUrl),
                                fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) => const Center(
                                  child: Icon(Icons.storefront_rounded, size: 36, color: SellerTheme.textSecondary),
                                ),
                              )
                            : const Center(
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(Icons.add_photo_alternate_outlined, color: SellerTheme.textSecondary, size: 28),
                                    SizedBox(height: 4),
                                    Text('Chưa có ảnh bìa (1200x300)', style: TextStyle(fontSize: 11, color: SellerTheme.textSecondary)),
                                  ],
                                ),
                              ),
                      ),
                      Positioned(
                        right: 8,
                        bottom: 8,
                        child: ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.black.withValues(alpha: 0.65),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            minimumSize: Size.zero,
                          ),
                          icon: const Icon(Icons.camera_alt_outlined, size: 13),
                          label: Text(_isUploadingBanner ? 'Đang tải...' : 'Đổi ảnh bìa', style: const TextStyle(fontSize: 11)),
                          onPressed: _isUploadingBanner ? null : _pickAndUploadBanner,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),

                // Avatar / Logo gian hàng
                Row(
                  children: [
                    Stack(
                      children: [
                        Container(
                          width: 58,
                          height: 58,
                          decoration: BoxDecoration(
                            color: SellerTheme.surfaceSubtle,
                            shape: BoxShape.circle,
                            border: Border.all(color: SellerTheme.border, width: 2),
                          ),
                          child: ClipOval(
                            child: _shopLogoUrl != null && _shopLogoUrl!.isNotEmpty
                                ? Image.network(
                                    ApiConfig.resolveImageUrl(_shopLogoUrl),
                                    fit: BoxFit.cover,
                                    errorBuilder: (_, __, ___) => const Center(
                                      child: Icon(Icons.storefront_rounded, size: 28, color: SellerTheme.primary),
                                    ),
                                  )
                                : const Center(
                                    child: Icon(Icons.storefront_rounded, size: 28, color: SellerTheme.primary),
                                  ),
                          ),
                        ),
                        if (_isUploadingLogo)
                          Positioned.fill(
                            child: Container(
                              decoration: const BoxDecoration(color: Colors.black45, shape: BoxShape.circle),
                              child: const Center(child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Logo Gian Hàng', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: SellerTheme.textPrimary)),
                          const SizedBox(height: 2),
                          const Text('Ảnh vuông tỷ lệ 1:1, tối đa 5 MB (PNG, JPG, WebP)', style: TextStyle(fontSize: 11, color: SellerTheme.textSecondary)),
                          const SizedBox(height: 6),
                          OutlinedButton.icon(
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                              minimumSize: Size.zero,
                            ),
                            icon: const Icon(Icons.upload_outlined, size: 14),
                            label: const Text('Tải logo lên', style: TextStyle(fontSize: 11)),
                            onPressed: _isUploadingLogo ? null : _pickAndUploadLogo,
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

          // 3. BIỂU MẪU HỒ SƠ GIAN HÀNG
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: SellerTheme.card,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: SellerTheme.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Thông Tin Chi Tiết', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: SellerTheme.textPrimary)),
                const SizedBox(height: 2),
                const Text('Hiển thị công khai tới khách mua hàng trên sàn NovaShop', style: TextStyle(fontSize: 11.5, color: SellerTheme.textSecondary)),
                const Divider(color: SellerTheme.border, height: 22),
                TextField(
                  controller: _shopNameController,
                  decoration: const InputDecoration(labelText: 'Tên gian hàng *', hintText: 'Ví dụ: Cửa Hàng Thời Trang Nova'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _shopTaglineController,
                  decoration: const InputDecoration(labelText: 'Slogan / Khẩu hiệu ngắn', hintText: 'Ví dụ: Uy tín, chất lượng hàng đầu'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _shopAddressController,
                  decoration: const InputDecoration(labelText: 'Địa chỉ kho gửi hàng / liên hệ', hintText: 'Số nhà, ngõ, đường, phường/xã'),
                ),
                const SizedBox(height: 12),

                // Tỉnh / Thành phố (Dropdown 63 tỉnh thành)
                DropdownButtonFormField<String>(
                  value: kVietnamProvinces.contains(_shopLocation) ? _shopLocation : 'TP. Hồ Chí Minh',
                  decoration: const InputDecoration(labelText: 'Tỉnh / Thành phố gửi hàng *'),
                  items: kVietnamProvinces
                      .map((p) => DropdownMenuItem(value: p, child: Text(p, style: const TextStyle(fontSize: 13))))
                      .toList(),
                  onChanged: (val) {
                    if (val != null) setState(() => _shopLocation = val);
                  },
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _shopDescController,
                  maxLines: 3,
                  decoration: const InputDecoration(labelText: 'Mô tả chi tiết gian hàng', hintText: 'Giới thiệu về nguồn gốc sản phẩm, chính sách bảo hành...'),
                ),
                const SizedBox(height: 20),

                // Nút Lưu và Gửi lại
                Row(
                  children: [
                    Expanded(
                      child: SizedBox(
                        height: 46,
                        child: ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: SellerTheme.primary,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          icon: const Icon(Icons.check_circle_outline_rounded, size: 18),
                          label: Text(_isSavingShop ? 'ĐANG LƯU...' : 'LƯU THAY ĐỔI'),
                          onPressed: _isSavingShop ? null : _saveShopProfile,
                        ),
                      ),
                    ),
                    if (approvalStatus == 'rejected' || shopStatus == 'rejected') ...[
                      const SizedBox(width: 10),
                      SizedBox(
                        height: 46,
                        child: ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.red,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          icon: const Icon(Icons.send_rounded, size: 16),
                          label: Text(_isResubmitting ? 'ĐANG GỬI...' : 'GỬI DUYỆT LẠI'),
                          onPressed: _isResubmitting ? null : _resubmitShop,
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 10),
                Text(
                  'Chủ sở hữu: ${user?.fullName ?? user?.username ?? "Bạn"} · ID: #${_shopProfile?['id'] ?? "—"}',
                  style: const TextStyle(fontSize: 11, color: SellerTheme.textSecondary),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // 4. XEM TRƯỚC GIAO DIỆN GIAN HÀNG & THỐNG KÊ (GIỐNG SELLERSHOPPAGE.JSX)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: SellerTheme.card,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: SellerTheme.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Xem Trước Giao Diện Gian Hàng', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: SellerTheme.textPrimary)),
                const SizedBox(height: 10),
                Container(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: SellerTheme.border),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: Column(
                    children: [
                      Container(
                        height: 60,
                        width: double.infinity,
                        color: SellerTheme.surfaceSubtle,
                        child: _shopBannerUrl != null && _shopBannerUrl!.isNotEmpty
                            ? Image.network(ApiConfig.resolveImageUrl(_shopBannerUrl), fit: BoxFit.cover, errorBuilder: (_, __, ___) => const SizedBox.shrink())
                            : const SizedBox.shrink(),
                      ),
                      Padding(
                        padding: const EdgeInsets.all(12),
                        child: Row(
                          children: [
                            Container(
                              width: 44,
                              height: 44,
                              decoration: BoxDecoration(
                                color: Colors.white,
                                shape: BoxShape.circle,
                                border: Border.all(color: SellerTheme.border),
                              ),
                              child: ClipOval(
                                child: _shopLogoUrl != null && _shopLogoUrl!.isNotEmpty
                                    ? Image.network(ApiConfig.resolveImageUrl(_shopLogoUrl), fit: BoxFit.cover, errorBuilder: (_, __, ___) => const Icon(Icons.storefront_rounded, size: 22, color: SellerTheme.primary))
                                    : const Icon(Icons.storefront_rounded, size: 22, color: SellerTheme.primary),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    _shopNameController.text.isNotEmpty ? _shopNameController.text : 'Tên gian hàng',
                                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: SellerTheme.textPrimary),
                                  ),
                                  Text(
                                    _shopTaglineController.text.isNotEmpty ? _shopTaglineController.text : 'Chưa có giới thiệu ngắn',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(fontSize: 11, color: SellerTheme.textSecondary),
                                  ),
                                  Text(_shopLocation, style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: SellerTheme.primary)),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const Divider(color: SellerTheme.border, height: 24),
                const Text('Thống Kê Gian Hàng', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: SellerTheme.textPrimary)),
                const SizedBox(height: 8),
                _shopStatRow('Sản phẩm đang bán', '$productCount'),
                _shopStatRow('Người theo dõi', '$followers'),
                _shopStatRow('Đánh giá gian hàng', '${rating.toStringAsFixed(1)} / 5 ($ratingCount)'),
                _shopStatRow('Tham gia từ', joined),
                _shopStatRow('Đã bán', '$totalSold'),
              ],
            ),
          ),
          const SizedBox(height: 20),
        ],
      ),
    );
  }

  Widget _shopStatRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 12, color: SellerTheme.textSecondary)),
          Text(value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: SellerTheme.textPrimary)),
        ],
      ),
    );
  }

  // ============================================================
  // TAB 4: TÀI CHÍNH & VÍ NGƯỜI BÁN (PAYOUT THẬT TỪ BACKEND)
  // ============================================================

  Widget _buildFinanceTab() {
    if (_isLoadingPayout) {
      return const Center(child: CircularProgressIndicator(color: SellerTheme.primary));
    }

    final hasAccount = _payoutData != null && (_payoutData!['hasAccount'] == true || _payoutData!.containsKey('balance'));
    final balance = double.tryParse(_payoutData?['balance']?.toString() ?? '0') ?? 0;
    final pending = double.tryParse(_payoutData?['pendingBalance']?.toString() ?? '0') ?? 0;
    final withdrawals = (_payoutData?['withdrawals'] as List?) ?? [];

    return RefreshIndicator(
      color: SellerTheme.primary,
      onRefresh: _loadPayout,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Ví Card
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF2C1810), Color(0xFF49352D)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(color: Colors.black.withValues(alpha: 0.15), blurRadius: 12, offset: const Offset(0, 6)),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Ví Người Bán NovaShop', style: TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.w500)),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(20)),
                        child: Text(
                          hasAccount ? 'Đang hoạt động' : 'Chưa kích hoạt',
                          style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  const Text('Số dư khả dụng', style: TextStyle(color: Colors.white60, fontSize: 11)),
                  const SizedBox(height: 2),
                  Text(
                    _currencyFormat.format(balance),
                    style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 14),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Chờ quyết toán: ${_currencyFormat.format(pending)}', style: const TextStyle(color: Colors.white70, fontSize: 11.5)),
                      if (!hasAccount)
                        ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: SellerTheme.primary,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                            minimumSize: Size.zero,
                          ),
                          onPressed: _isSubmittingPayout ? null : _handleSetupPayout,
                          child: Text(_isSubmittingPayout ? 'Đang tạo...' : 'Kích hoạt Ví', style: const TextStyle(fontSize: 11.5)),
                        ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),

            // Rút tiền Action
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: SellerTheme.card,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: SellerTheme.border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Yêu Cầu Rút Tiền', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: SellerTheme.textPrimary)),
                  const SizedBox(height: 4),
                  const Text('Số tiền rút được xử lý trực tiếp qua API ví thanh toán của shop.', style: TextStyle(fontSize: 11.5, color: SellerTheme.textSecondary)),
                  const SizedBox(height: 14),
                  TextField(
                    controller: _withdrawAmountController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'Số tiền muốn rút (₫)',
                      hintText: 'Ví dụ: 100000',
                      suffixText: '₫',
                    ),
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    children: [50000, 100000, 200000, 500000].map((amt) {
                      return ActionChip(
                        label: Text('${amt ~/ 1000}k', style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold)),
                        backgroundColor: SellerTheme.surfaceSubtle,
                        side: const BorderSide(color: SellerTheme.border),
                        onPressed: () {
                          _withdrawAmountController.text = amt.toString();
                        },
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 14),
                  SizedBox(
                    width: double.infinity,
                    height: 46,
                    child: ElevatedButton(
                      onPressed: (!hasAccount || _isSubmittingPayout) ? null : _handleRequestWithdrawal,
                      child: Text(
                        _isSubmittingPayout
                            ? 'ĐANG XỬ LÝ...'
                            : (hasAccount ? 'GỬI YÊU CẦU RÚT TIỀN' : 'HÃY KÍCH HOẠT VÍ TRƯỚC KHI RÚT'),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),

            // Lịch sử rút tiền thật
            const Text('Lịch Sử Rút Tiền Gần Đây', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: SellerTheme.textPrimary)),
            const SizedBox(height: 10),
            if (withdrawals.isEmpty)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: SellerTheme.card,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: SellerTheme.border),
                ),
                child: const Column(
                  children: [
                    Icon(Icons.receipt_long_outlined, size: 32, color: SellerTheme.textSecondary),
                    SizedBox(height: 6),
                    Text('Chưa có giao dịch rút tiền nào', style: TextStyle(fontSize: 12, color: SellerTheme.textSecondary)),
                  ],
                ),
              )
            else
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: withdrawals.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (ctx, i) {
                  final w = Map<String, dynamic>.from(withdrawals[i] as Map);
                  final amt = double.tryParse(w['amount']?.toString() ?? '0') ?? 0;
                  final created = w['createdAt']?.toString() ?? '';
                  final status = w['status']?.toString() ?? 'completed';
                  return Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: SellerTheme.card,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: SellerTheme.border),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.arrow_upward_rounded, color: SellerTheme.primary, size: 18),
                            const SizedBox(width: 10),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('- ${_currencyFormat.format(amt)}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5, color: SellerTheme.danger)),
                                Text(created.length >= 10 ? created.substring(0, 10) : created, style: const TextStyle(fontSize: 11, color: SellerTheme.textSecondary)),
                              ],
                            ),
                          ],
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(color: SellerTheme.successBg, borderRadius: BorderRadius.circular(8)),
                          child: Text(
                            (status == 'completed' || status == 'simulated') ? 'Thành công' : status,
                            style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: SellerTheme.success),
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
          ],
        ),
      ),
    );
  }

  // --- BUILD BODY ---

  @override
  Widget build(BuildContext context) {
    Widget body;
    switch (_activeNav) {
      case 1:
        body = _buildProductsTab();
        break;
      case 2:
        body = _buildOrdersTab();
        break;
      case 3:
        body = _buildShopTab();
        break;
      case 4:
        body = _buildFinanceTab();
        break;
      case 0:
      default:
        body = _buildDashboardTab();
        break;
    }

    return Theme(
      data: SellerTheme.lightTheme,
      child: Scaffold(
        key: _scaffoldKey,
        backgroundColor: SellerTheme.background,
        appBar: _buildAppBar(),
        drawer: _buildDrawer(),
        body: body,
        bottomNavigationBar: NavigationBar(
        selectedIndex: _activeNav,
        backgroundColor: SellerTheme.card,
        indicatorColor: SellerTheme.surfaceSubtle,
        elevation: 0,
        height: 62,
        onDestinationSelected: (idx) => setState(() => _activeNav = idx),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.dashboard_outlined, size: 20),
            selectedIcon: Icon(Icons.dashboard_rounded, color: SellerTheme.primary, size: 20),
            label: 'Tổng quan',
          ),
          NavigationDestination(
            icon: Icon(Icons.inventory_2_outlined, size: 20),
            selectedIcon: Icon(Icons.inventory_2_rounded, color: SellerTheme.primary, size: 20),
            label: 'Sản phẩm',
          ),
          NavigationDestination(
            icon: Icon(Icons.local_shipping_outlined, size: 20),
            selectedIcon: Icon(Icons.local_shipping_rounded, color: SellerTheme.primary, size: 20),
            label: 'Đơn hàng',
          ),
          NavigationDestination(
            icon: Icon(Icons.storefront_outlined, size: 20),
            selectedIcon: Icon(Icons.storefront_rounded, color: SellerTheme.primary, size: 20),
            label: 'Gian hàng',
          ),
          NavigationDestination(
            icon: Icon(Icons.account_balance_wallet_outlined, size: 20),
            selectedIcon: Icon(Icons.account_balance_wallet_rounded, color: SellerTheme.primary, size: 20),
            label: 'Tài chính',
          ),
        ],
      ),
      ),
    );
  }
}

// Painter vẽ đồ thị xu hướng 7 ngày
class _TrendChartPainter extends CustomPainter {
  final List<Map<String, dynamic>> orders;
  _TrendChartPainter({required this.orders});

  @override
  void paint(Canvas canvas, Size size) {
    final linePaint = Paint()
      ..color = SellerTheme.primary
      ..strokeWidth = 2.5
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    final dotPaint = Paint()
      ..color = SellerTheme.primary
      ..style = PaintingStyle.fill;

    final gridPaint = Paint()
      ..color = SellerTheme.border.withValues(alpha: 0.5)
      ..strokeWidth = 1.0;

    // Vẽ đường gióng ngang
    for (int i = 0; i < 4; i++) {
      final y = size.height * (i / 3);
      canvas.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
    }

    // 7 điểm giả lập từ đơn hàng
    final points = <Offset>[
      Offset(size.width * 0.05, size.height * 0.8),
      Offset(size.width * 0.20, size.height * 0.65),
      Offset(size.width * 0.35, size.height * 0.75),
      Offset(size.width * 0.50, size.height * 0.45),
      Offset(size.width * 0.65, size.height * 0.55),
      Offset(size.width * 0.80, size.height * 0.30),
      Offset(size.width * 0.95, size.height * 0.20),
    ];

    final path = Path()..moveTo(points[0].dx, points[0].dy);
    for (int i = 1; i < points.length; i++) {
      path.lineTo(points[i].dx, points[i].dy);
    }
    canvas.drawPath(path, linePaint);

    for (final p in points) {
      canvas.drawCircle(p, 4, dotPaint);
      canvas.drawCircle(p, 2, Paint()..color = Colors.white);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}

// Helpers lọc dữ liệu
extension _ProductFilterHelper on List<Map<String, dynamic>> {
  List<Map<String, dynamic>> filterProducts(String tab, String search, String cat) {
    return where((p) {
      if (search.isNotEmpty) {
        final name = (p['name']?.toString() ?? '').toLowerCase();
        final id = (p['id']?.toString() ?? '').toLowerCase();
        if (!name.contains(search.toLowerCase()) && !id.contains(search.toLowerCase())) {
          return false;
        }
      }
      if (cat != 'all') {
        if (p['categoryId']?.toString() != cat) return false;
      }
      if (tab == 'active') {
        return p['approvalStatus'] == 'approved' && p['status'] != 'hidden' && (p['stock'] ?? 0) > 0;
      }
      if (tab == 'pending') {
        return (p['approvalStatus'] ?? 'pending') == 'pending';
      }
      if (tab == 'rejected') {
        return p['approvalStatus'] == 'rejected';
      }
      if (tab == 'out_of_stock') {
        return (p['stock'] ?? 0) <= 0 || p['status'] == 'hidden';
      }
      return true;
    }).toList();
  }
}

extension _OrderFilterHelper on List<Map<String, dynamic>> {
  List<Map<String, dynamic>> filterOrders(String tab, String search) {
    return where((o) {
      if (search.isNotEmpty) {
        final code = (o['code']?.toString() ?? o['id']?.toString() ?? '').toLowerCase();
        final name = (o['buyerName']?.toString() ?? o['customerName']?.toString() ?? '').toLowerCase();
        if (!code.contains(search.toLowerCase()) && !name.contains(search.toLowerCase())) {
          return false;
        }
      }
      if (tab != 'all') {
        if (o['status']?.toString() != tab) return false;
      }
      return true;
    }).toList();
  }
}
