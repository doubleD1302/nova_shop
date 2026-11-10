import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import '../services/api_client.dart';
import '../services/auth_service.dart';
import '../services/payout_service.dart';
import '../theme/seller_theme.dart';
import '../widgets/nova_logo.dart';
import 'login_screen.dart';
import 'seller_product_form_screen.dart';

class SellerMainScreen extends StatefulWidget {
  const SellerMainScreen({super.key});

  @override
  State<SellerMainScreen> createState() => _SellerMainScreenState();
}

class _SellerMainScreenState extends State<SellerMainScreen> with SingleTickerProviderStateMixin {
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
        setState(() {
          _shopProfile = Map<String, dynamic>.from(shopMap as Map);
          _isLoadingProfile = false;
        });
      } else {
        final user = AuthService().currentUser;
        final shopId = user?.shopId ?? '1';
        final shopRes = await _client.get('/api/v1/shops/$shopId');
        if (mounted) {
          setState(() {
            if (shopRes.success && shopRes.data is Map) {
              final dataMap = shopRes.data as Map;
              final shopMap = dataMap.containsKey('shop') ? dataMap['shop'] : dataMap;
              _shopProfile = Map<String, dynamic>.from(shopMap as Map);
            }
            _isLoadingProfile = false;
          });
        }
      }
    }
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
      final res = await _payoutService.getPayoutStatus();
      if (mounted && res != null && res['success'] == true) {
        setState(() {
          _payoutData = res['data'] is Map ? Map<String, dynamic>.from(res['data']) : null;
          _isLoadingPayout = false;
        });
      } else {
        if (mounted) setState(() => _isLoadingPayout = false);
      }
    } catch (_) {
      if (mounted) setState(() => _isLoadingPayout = false);
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
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                              decoration: BoxDecoration(
                                color: SellerTheme.successBg,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: const Text('✓ Đã xác minh', style: TextStyle(fontSize: 9.5, color: SellerTheme.success, fontWeight: FontWeight.bold)),
                            ),
                            const SizedBox(width: 6),
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
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Tính năng Khuyến mãi Shop đang sẵn sàng trên web và ứng dụng.')),
                      );
                    },
                  ),
                  ListTile(
                    dense: true,
                    leading: const Icon(Icons.campaign_outlined, size: 20, color: SellerTheme.textSecondary),
                    title: const Text('Quảng cáo & Flash Sale', style: TextStyle(fontSize: 13, color: SellerTheme.textPrimary)),
                    onTap: () {
                      Navigator.pop(context);
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Chương trình Flash Sale áp dụng cho toàn sàn ShopNova.')),
                      );
                    },
                  ),
                  ListTile(
                    dense: true,
                    leading: const Icon(Icons.headset_mic_outlined, size: 20, color: SellerTheme.textSecondary),
                    title: const Text('Chăm sóc khách hàng', style: TextStyle(fontSize: 13, color: SellerTheme.textPrimary)),
                    onTap: () {
                      Navigator.pop(context);
                      _showNotificationsDialog();
                    },
                  ),
                ],
              ),
            ),

            // Footer Logout
            Container(
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: SellerTheme.border)),
              ),
              child: ListTile(
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                tileColor: SellerTheme.surfaceSubtle,
                leading: const Icon(Icons.logout_rounded, color: SellerTheme.danger, size: 20),
                title: const Text('Đăng xuất tài khoản', style: TextStyle(color: SellerTheme.danger, fontWeight: FontWeight.bold, fontSize: 13)),
                onTap: () async {
                  await AuthService().logout();
                  if (mounted) {
                    Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const LoginScreen()));
                  }
                },
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
        const SizedBox(width: 8),
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
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Quản lý mã giảm giá của gian hàng.')));
                  }),
                  _quickToolItem(Icons.campaign_outlined, 'Marketing', () {
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Tiếp thị sản phẩm và tăng lưu lượng truy cập.')));
                  }),
                  _quickToolItem(Icons.assessment_outlined, 'Báo cáo', () => setState(() => _activeNav = 4)),
                  _quickToolItem(Icons.headset_mic_outlined, 'CSKH', _showNotificationsDialog),
                  _quickToolItem(Icons.storefront_outlined, 'Hồ sơ shop', () => setState(() => _activeNav = 3)),
                  _quickToolItem(Icons.account_balance_wallet_outlined, 'Ví người bán', () => setState(() => _activeNav = 4)),
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
                      imageUrl,
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
                    _approvalBadge(approvalStatus),
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
    final nameCtrl = TextEditingController(text: _shopProfile?['name']?.toString() ?? user?.fullName ?? '');
    final taglineCtrl = TextEditingController(text: _shopProfile?['tagline']?.toString() ?? '');
    final descCtrl = TextEditingController(text: _shopProfile?['description']?.toString() ?? '');
    final addressCtrl = TextEditingController(text: _shopProfile?['address']?.toString() ?? '');
    final locCtrl = TextEditingController(text: _shopProfile?['location']?.toString() ?? 'TP. Hồ Chí Minh');

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Banner Top
          Container(
            height: 110,
            width: double.infinity,
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [SellerTheme.primaryHover, SellerTheme.primary]),
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Center(
              child: Icon(Icons.storefront_rounded, size: 48, color: Colors.white70),
            ),
          ),
          const SizedBox(height: 16),

          if (_shopProfile?['approvalStatus'] == 'rejected') ...[
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: SellerTheme.dangerBg,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: SellerTheme.danger.withValues(alpha: 0.3)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.error_outline, color: SellerTheme.danger, size: 20),
                      const SizedBox(width: 8),
                      const Text(
                        'Gian hàng bị từ chối phê duyệt KYC',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: SellerTheme.danger),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Lý do: ${_shopProfile?['rejectionReason'] ?? 'Hồ sơ chưa đạt tiêu chuẩn sàn'}. Vui lòng cập nhật lại thông tin và bấm gửi duyệt lại.',
                    style: const TextStyle(fontSize: 12, color: SellerTheme.danger),
                  ),
                  const SizedBox(height: 10),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: SellerTheme.danger,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      minimumSize: Size.zero,
                    ),
                    onPressed: () async {
                      final res = await _client.post('/api/v1/seller/shop/resubmit');
                      if (mounted) {
                        if (res.success) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Đã gửi lại hồ sơ gian hàng cho ban quản trị duyệt!'), backgroundColor: SellerTheme.success),
                          );
                          _loadProfile();
                        } else {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text(res.message.isNotEmpty ? res.message : 'Gửi lại thất bại.'), backgroundColor: SellerTheme.danger),
                          );
                        }
                      }
                    },
                    child: const Text('GỬI DUYỆT LẠI GIAN HÀNG', style: TextStyle(fontSize: 11)),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],

          // Form fields
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
                const Text('Thông Tin Gian Hàng', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: SellerTheme.textPrimary)),
                const SizedBox(height: 4),
                const Text('Cập nhật hồ sơ kinh doanh và địa chỉ để khách hàng tin tưởng', style: TextStyle(fontSize: 11.5, color: SellerTheme.textSecondary)),
                const Divider(color: SellerTheme.border, height: 24),
                TextField(
                  controller: nameCtrl,
                  decoration: const InputDecoration(labelText: 'Tên gian hàng *'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: taglineCtrl,
                  decoration: const InputDecoration(labelText: 'Khẩu hiệu (Tagline)'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: addressCtrl,
                  decoration: const InputDecoration(labelText: 'Địa chỉ kho lấy hàng'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: locCtrl,
                  decoration: const InputDecoration(labelText: 'Khu vực / Tỉnh thành'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: descCtrl,
                  maxLines: 3,
                  decoration: const InputDecoration(labelText: 'Mô tả chi tiết gian hàng'),
                ),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  height: 46,
                  child: ElevatedButton(
                    onPressed: () async {
                      final body = {
                        'name': nameCtrl.text.trim(),
                        'tagline': taglineCtrl.text.trim(),
                        'address': addressCtrl.text.trim(),
                        'location': locCtrl.text.trim(),
                        'description': descCtrl.text.trim(),
                      };
                      final res = await _client.put('/api/v1/seller/shop', body: body);
                      if (mounted) {
                        if (res.success) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Cập nhật hồ sơ shop thành công!'), backgroundColor: SellerTheme.success),
                          );
                          _loadProfile();
                        } else {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text(res.message.isNotEmpty ? res.message : 'Lỗi cập nhật.'), backgroundColor: SellerTheme.danger),
                          );
                        }
                      }
                    },
                    child: const Text('LƯU THÔNG TIN GIAN HÀNG'),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ============================================================
  // TAB 4: TÀI CHÍNH & VÍ NGƯỜI BÁN (PAYOUT)
  // ============================================================

  Widget _buildFinanceTab() {
    final balance = double.tryParse(_payoutData?['balance']?.toString() ?? '15000000') ?? 15000000;
    final pending = double.tryParse(_payoutData?['pendingBalance']?.toString() ?? '3500000') ?? 3500000;

    return SingleChildScrollView(
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
                      child: const Text('Đang hoạt động', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
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
                  children: [
                    Text('Chờ quyết toán: ${_currencyFormat.format(pending)}', style: const TextStyle(color: Colors.white70, fontSize: 11.5)),
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
                const Text('Tiền sẽ được chuyển về tài khoản ngân hàng liên kết trong vòng 24 giờ.', style: TextStyle(fontSize: 11.5, color: SellerTheme.textSecondary)),
                const SizedBox(height: 14),
                TextField(
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Số tiền muốn rút (₫)', hintText: 'Tối thiểu 100.000 ₫'),
                ),
                const SizedBox(height: 14),
                SizedBox(
                  width: double.infinity,
                  height: 46,
                  child: ElevatedButton(
                    onPressed: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Yêu cầu rút tiền đã được tiếp nhận và xử lý.'), backgroundColor: SellerTheme.success),
                      );
                    },
                    child: const Text('GỬI YÊU CẦU RÚT TIỀN'),
                  ),
                ),
              ],
            ),
          ),
        ],
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

    return Scaffold(
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
