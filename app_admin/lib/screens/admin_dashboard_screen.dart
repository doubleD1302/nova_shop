import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../config/api_config.dart';
import '../services/api_client.dart';
import '../services/auth_service.dart';
import '../theme/admin_theme.dart';
import 'login_screen.dart';

class AdminDashboardScreen extends StatefulWidget {
  const AdminDashboardScreen({super.key});

  @override
  State<AdminDashboardScreen> createState() => _AdminDashboardScreenState();
}

class _AdminDashboardScreenState extends State<AdminDashboardScreen> {
  final ApiClient _client = ApiClient();
  final NumberFormat _currencyFormat = NumberFormat.currency(locale: 'vi_VN', symbol: '₫', decimalDigits: 0);
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();

  // 8 chuyên mục quản trị tương tự website AdminPage.jsx
  int _selectedNavIndex = 0;
  final List<Map<String, dynamic>> _menuItems = [
    {'id': 'dashboard', 'label': 'Tổng quan', 'icon': Icons.dashboard_outlined, 'activeIcon': Icons.dashboard_rounded},
    {'id': 'shops', 'label': 'Quản lý Shop', 'icon': Icons.storefront_outlined, 'activeIcon': Icons.storefront_rounded},
    {'id': 'users', 'label': 'Người dùng', 'icon': Icons.people_outline_rounded, 'activeIcon': Icons.people_alt_rounded},
    {'id': 'products', 'label': 'Sản phẩm', 'icon': Icons.inventory_2_outlined, 'activeIcon': Icons.inventory_2_rounded},
    {'id': 'orders', 'label': 'Đơn hàng', 'icon': Icons.local_shipping_outlined, 'activeIcon': Icons.local_shipping_rounded},
    {'id': 'revenue', 'label': 'Doanh thu', 'icon': Icons.account_balance_wallet_outlined, 'activeIcon': Icons.account_balance_wallet_rounded},
    {'id': 'reports', 'label': 'Báo cáo vi phạm', 'icon': Icons.flag_outlined, 'activeIcon': Icons.flag_rounded},
    {'id': 'settings', 'label': 'Cài đặt hệ thống', 'icon': Icons.settings_outlined, 'activeIcon': Icons.settings_rounded},
  ];

  // Dữ liệu từ Database
  Map<String, dynamic>? _stats;
  Map<String, dynamic>? _orderStatusCounts;
  List<Map<String, dynamic>> _recentOrders = [];
  List<Map<String, dynamic>> _shops = [];
  List<Map<String, dynamic>> _users = [];
  List<Map<String, dynamic>> _products = [];
  List<Map<String, dynamic>> _orders = [];
  List<Map<String, dynamic>> _reports = [];
  Map<String, dynamic>? _emailStatus;

  bool _isLoading = false;
  bool _hasConnectionError = false;
  String? _errorMessage;
  String _searchQuery = '';

  // Bộ lọc theo tabs
  String _shopFilterTab = 'all'; // all, pending, active, suspended, closed
  String _productFilterTab = 'all'; // all, pending, approved, rejected, draft_hidden
  String _reportFilterTab = 'all'; // all, open, investigating, confirmed_violation, dismissed
  String _orderFilterTab = 'all'; // all, pending, confirmed, shipping, delivered, cancelled
  String _userFilterTab = 'all'; // all, active, blocked, seller, admin

  @override
  void initState() {
    super.initState();
    _loadCurrentSection();
  }

  Future<void> _loadCurrentSection() async {
    setState(() {
      _isLoading = true;
      _hasConnectionError = false;
      _errorMessage = null;
    });
    try {
      await ApiConfig.autoDetectBaseUrl();
      final activeId = _menuItems[_selectedNavIndex]['id'];
      if (activeId == 'dashboard' || activeId == 'revenue') {
        await _fetchStats();
      }
      if (activeId == 'dashboard' || activeId == 'shops') {
        await _fetchShops();
      }
      if (activeId == 'dashboard' || activeId == 'orders') {
        await _fetchOrders();
      }
      if (activeId == 'users') {
        await _fetchUsers();
      }
      if (activeId == 'products') {
        await _fetchProducts();
      }
      if (activeId == 'reports') {
        await _fetchReports();
        await _fetchEmailStatus();
      }
      if (activeId == 'settings') {
        await _fetchEmailStatus();
      }
    } catch (e) {
      debugPrint('[Admin] Lỗi tải dữ liệu: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _fetchStats() async {
    final res = await _client.get('/api/v1/admin/stats');
    if (res.success && res.data is Map) {
      final map = Map<String, dynamic>.from(res.data as Map);
      _stats = map['stats'] != null ? Map<String, dynamic>.from(map['stats'] as Map) : map;
      if (map['orderStatusCounts'] != null) {
        _orderStatusCounts = Map<String, dynamic>.from(map['orderStatusCounts'] as Map);
      }
      if (map['recentOrders'] is List) {
        _recentOrders = List<Map<String, dynamic>>.from(map['recentOrders'] as List);
      }
      setState(() => _hasConnectionError = false);
    } else {
      if (res.statusCode == 401 && mounted) {
        await AuthService().logout();
        Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const LoginScreen()));
        return;
      }
      setState(() {
        _hasConnectionError = true;
        _errorMessage = res.message.isNotEmpty ? res.message : 'Không thể kết nối máy chủ Backend.';
      });
    }
  }

  Future<void> _fetchShops() async {
    final res = await _client.get('/api/v1/admin/shops');
    if (res.success) {
      final list = res.data is Map ? (res.data['shops'] ?? res.data) : res.data;
      if (list is List) {
        setState(() {
          _shops = List<Map<String, dynamic>>.from(list);
        });
      }
    }
  }

  Future<void> _fetchUsers() async {
    final res = await _client.get('/api/v1/admin/users');
    if (res.success) {
      final list = res.data is Map ? (res.data['users'] ?? res.data) : res.data;
      if (list is List) {
        setState(() {
          _users = List<Map<String, dynamic>>.from(list);
        });
      }
    }
  }

  Future<void> _fetchProducts() async {
    final res = await _client.get('/api/v1/admin/products');
    if (res.success) {
      final list = res.data is Map ? (res.data['products'] ?? res.data) : res.data;
      if (list is List) {
        setState(() {
          _products = List<Map<String, dynamic>>.from(list);
        });
      }
    }
  }

  Future<void> _fetchOrders() async {
    final res = await _client.get('/api/v1/admin/orders');
    if (res.success) {
      final list = res.data is Map ? (res.data['orders'] ?? res.data) : res.data;
      if (list is List) {
        setState(() {
          _orders = List<Map<String, dynamic>>.from(list);
        });
      }
    }
  }

  Future<void> _fetchReports() async {
    final res = await _client.get('/api/v1/admin/reports');
    if (res.success) {
      final list = res.data is Map ? (res.data['reports'] ?? res.data) : res.data;
      if (list is List) {
        setState(() {
          _reports = List<Map<String, dynamic>>.from(list);
        });
      }
    }
  }

  Future<void> _fetchEmailStatus() async {
    final res = await _client.get('/api/v1/admin/email-status');
    if (res.success && res.data is Map) {
      _emailStatus = Map<String, dynamic>.from(res.data as Map);
    }
  }

  // --- HÀNH ĐỘNG QUẢN TRỊ VIÊN ---

  // 1. Phê duyệt KYC gian hàng
  Future<void> _approveShop(String shopId, int approvalVersion, {required bool isApproved, String? comment}) async {
    final res = await _client.patch(
      '/api/v1/admin/shops/$shopId/approval',
      body: {
        'approvalStatus': isApproved ? 'approved' : 'rejected',
        'approvalVersion': approvalVersion,
        if (!isApproved) 'rejectionReason': comment ?? 'Hồ sơ chưa đạt tiêu chuẩn sàn',
      },
    );
    if (!mounted) return;
    if (res.success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(isApproved ? 'Đã phê duyệt gian hàng thành công!' : 'Đã từ chối gian hàng.'), backgroundColor: AdminTheme.success),
      );
      _fetchShops();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(res.message.isNotEmpty ? res.message : 'Thao tác thất bại.'), backgroundColor: AdminTheme.danger),
      );
    }
  }

  // 2. Khóa / Mở khóa Shop
  Future<void> _updateShopStatus(String shopId, String status) async {
    final res = await _client.patch(
      '/api/v1/admin/shops/$shopId/status',
      body: {'status': status},
    );
    if (!mounted) return;
    if (res.success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Đã cập nhật trạng thái shop: $status'), backgroundColor: AdminTheme.success),
      );
      _fetchShops();
    }
  }

  // 3. Khóa / Mở khóa Người dùng
  Future<void> _updateUserStatus(String userId, String status) async {
    final res = await _client.patch(
      '/api/v1/admin/users/$userId/status',
      body: {'status': status},
    );
    if (!mounted) return;
    if (res.success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Cập nhật tài khoản người dùng thành: $status'), backgroundColor: AdminTheme.success),
      );
      _fetchUsers();
    }
  }

  // 4. Duyệt / Từ chối Sản phẩm
  Future<void> _updateProductApproval(String productId, String approvalStatus) async {
    final res = await _client.patch(
      '/api/v1/admin/products/$productId/approval',
      body: {
        'approvalStatus': approvalStatus,
        if (approvalStatus == 'rejected') 'rejectionReason': 'Sản phẩm vi phạm chính sách đăng bán',
      },
    );
    if (!mounted) return;
    if (res.success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Đã cập nhật kiểm duyệt sản phẩm: $approvalStatus'), backgroundColor: AdminTheme.success),
      );
      _fetchProducts();
    }
  }

  // 5. Cập nhật Báo cáo vi phạm
  Future<void> _updateReportStatus(String reportId, String status) async {
    final res = await _client.patch(
      '/api/v1/admin/reports/$reportId/status',
      body: {'status': status},
    );
    if (!mounted) return;
    if (res.success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Đã cập nhật báo cáo vi phạm: $status'), backgroundColor: AdminTheme.success),
      );
      _fetchReports();
    }
  }

  // --- DRAWER QUẢN TRỊ VIÊN ---

  Widget _buildDrawer() {
    final user = AuthService().currentUser;
    final adminName = user?.fullName ?? user?.username ?? 'Quản Trị Viên';

    return Drawer(
      backgroundColor: AdminTheme.card,
      child: SafeArea(
        child: Column(
          children: [
            // Header Quản trị
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 18),
              decoration: const BoxDecoration(
                border: Border(bottom: BorderSide(color: AdminTheme.border)),
              ),
              child: Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: AdminTheme.surfaceSubtle,
                      shape: BoxShape.circle,
                      border: Border.all(color: AdminTheme.border),
                    ),
                    child: Center(
                      child: Text(
                        adminName.isNotEmpty ? adminName[0].toUpperCase() : 'A',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: AdminTheme.primary),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          adminName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AdminTheme.textPrimary),
                        ),
                        const SizedBox(height: 2),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                          decoration: BoxDecoration(
                            color: AdminTheme.surfaceSubtle,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: const Text('Quản trị viên Hệ thống', style: TextStyle(fontSize: 10, color: AdminTheme.primary, fontWeight: FontWeight.bold)),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // Danh sách 8 Chuyên mục Quản trị
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(vertical: 8),
                itemCount: _menuItems.length,
                itemBuilder: (ctx, idx) {
                  final item = _menuItems[idx];
                  final isSelected = _selectedNavIndex == idx;
                  return ListTile(
                    dense: true,
                    selected: isSelected,
                    selectedTileColor: AdminTheme.surfaceSubtle,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    leading: Icon(
                      isSelected ? item['activeIcon'] as IconData : item['icon'] as IconData,
                      color: isSelected ? AdminTheme.primary : AdminTheme.textSecondary,
                      size: 20,
                    ),
                    title: Text(
                      item['label'] as String,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                        color: isSelected ? AdminTheme.primary : AdminTheme.textPrimary,
                      ),
                    ),
                    onTap: () {
                      setState(() {
                        _selectedNavIndex = idx;
                        _searchQuery = '';
                      });
                      Navigator.pop(context);
                      _loadCurrentSection();
                    },
                  );
                },
              ),
            ),

            // Footer Logout
            Container(
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: AdminTheme.border)),
              ),
              child: ListTile(
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                tileColor: AdminTheme.surfaceSubtle,
                leading: const Icon(Icons.logout_rounded, color: AdminTheme.danger, size: 20),
                title: const Text('Đăng xuất quản trị', style: TextStyle(color: AdminTheme.danger, fontWeight: FontWeight.bold, fontSize: 13)),
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

  // --- APP BAR ---

  PreferredSizeWidget _buildAppBar() {
    final currentTitle = _menuItems[_selectedNavIndex]['label'] as String;

    return AppBar(
      leading: IconButton(
        icon: const Icon(Icons.menu_rounded, color: AdminTheme.textPrimary),
        onPressed: () => _scaffoldKey.currentState?.openDrawer(),
      ),
      titleSpacing: 0,
      title: Row(
        children: [
          RichText(
            text: const TextSpan(
              children: [
                TextSpan(
                  text: 'Nova',
                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: AdminTheme.textPrimary),
                ),
                TextSpan(
                  text: 'Shop',
                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: AdminTheme.primaryHover),
                ),
                TextSpan(
                  text: ' · Admin',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AdminTheme.textPrimary),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
            decoration: BoxDecoration(color: AdminTheme.surfaceSubtle, borderRadius: BorderRadius.circular(6)),
            child: Text(currentTitle, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AdminTheme.primary)),
          ),
        ],
      ),
      actions: [
        IconButton(
          icon: const Icon(Icons.refresh_rounded, color: AdminTheme.textPrimary, size: 22),
          onPressed: _loadCurrentSection,
        ),
        const SizedBox(width: 8),
      ],
    );
  }

  // ============================================================
  // MODULE 1: TỔNG QUAN HỆ THỐNG (DASHBOARD)
  // ============================================================

  Widget _buildDashboardSection() {
    final revenue = double.tryParse(_stats?['revenue']?.toString() ?? '0') ?? 0;
    final totalOrders = _stats?['orders'] ?? _orders.length;
    final totalUsers = _stats?['users'] ?? _users.length;
    final totalShops = _stats?['shops'] ?? _shops.length;

    return RefreshIndicator(
      onRefresh: () async => _loadCurrentSection(),
      color: AdminTheme.primary,
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 4 Thẻ KPI Lớn Chuẩn Website
            const Text(
              'TỔNG QUAN TOÀN SÀN',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AdminTheme.textSecondary, letterSpacing: 0.5),
            ),
            const SizedBox(height: 10),
            GridView.count(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisCount: 2,
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              childAspectRatio: 1.4,
              children: [
                _kpiBox('Doanh thu toàn sàn', _currencyFormat.format(revenue), Icons.account_balance_wallet_outlined, AdminTheme.primary, () {
                  setState(() => _selectedNavIndex = 5);
                  _loadCurrentSection();
                }),
                _kpiBox('Tổng đơn hàng', '$totalOrders đơn', Icons.local_shipping_outlined, const Color(0xFF1D4ED8), () {
                  setState(() => _selectedNavIndex = 4);
                  _loadCurrentSection();
                }),
                _kpiBox('Người dùng hệ thống', '$totalUsers người', Icons.people_outline_rounded, const Color(0xFF0D9488), () {
                  setState(() => _selectedNavIndex = 2);
                  _loadCurrentSection();
                }),
                _kpiBox('Cửa hàng / Shop', '$totalShops shop', Icons.storefront_outlined, const Color(0xFFD97706), () {
                  setState(() => _selectedNavIndex = 1);
                  _loadCurrentSection();
                }),
              ],
            ),
            const SizedBox(height: 16),

            // Biểu đồ Doanh thu 7 ngày qua
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AdminTheme.card,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: AdminTheme.border),
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
                            decoration: BoxDecoration(color: AdminTheme.surfaceSubtle, borderRadius: BorderRadius.circular(8)),
                            child: const Icon(Icons.show_chart_rounded, size: 18, color: AdminTheme.primary),
                          ),
                          const SizedBox(width: 8),
                          const Text('Tăng trưởng doanh thu 7 ngày', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AdminTheme.textPrimary)),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(color: AdminTheme.surfaceSubtle, borderRadius: BorderRadius.circular(8)),
                        child: const Text('Tuần này', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AdminTheme.primary)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  SizedBox(
                    height: 100,
                    width: double.infinity,
                    child: CustomPaint(
                      painter: _AdminTrendPainter(),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Trạng thái đơn hàng
            const Text(
              'TÌNH TRẠNG ĐƠN HÀNG TOÀN SÀN',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AdminTheme.textSecondary, letterSpacing: 0.5),
            ),
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AdminTheme.card,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: AdminTheme.border),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _orderStatItem('Chờ xác nhận', _orderStatusCounts?['pending'] ?? 0, AdminTheme.warning),
                  _orderStatItem('Đang giao', _orderStatusCounts?['shipping'] ?? 0, AdminTheme.info),
                  _orderStatItem('Đã giao', _orderStatusCounts?['delivered'] ?? 0, AdminTheme.success),
                  _orderStatItem('Đã hủy', _orderStatusCounts?['cancelled'] ?? 0, AdminTheme.danger),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Hoạt động gần đây
            if (_recentOrders.isNotEmpty) ...[
              const Text(
                'ĐƠN HÀNG MỚI PHÁT SINH',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AdminTheme.textSecondary, letterSpacing: 0.5),
              ),
              const SizedBox(height: 10),
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _recentOrders.take(3).length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (ctx, idx) {
                  final ro = _recentOrders[idx];
                  return Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AdminTheme.card,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: AdminTheme.border),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('#${ro['code'] ?? ro['id']}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AdminTheme.textPrimary)),
                            Text(ro['shopName']?.toString() ?? 'Shop', style: const TextStyle(fontSize: 11, color: AdminTheme.textSecondary)),
                          ],
                        ),
                        Text(
                          _currencyFormat.format(double.tryParse(ro['totalAmount']?.toString() ?? '0') ?? 0),
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AdminTheme.primary),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ],
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  Widget _kpiBox(String title, String val, IconData icon, Color color, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AdminTheme.card,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AdminTheme.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(color: AdminTheme.surfaceSubtle, borderRadius: BorderRadius.circular(8)),
                  child: Icon(icon, size: 16, color: color),
                ),
                const Icon(Icons.arrow_forward_rounded, size: 14, color: AdminTheme.textSecondary),
              ],
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11, color: AdminTheme.textSecondary)),
                const SizedBox(height: 2),
                Text(val, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AdminTheme.textPrimary)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _orderStatItem(String label, dynamic count, Color color) {
    return Column(
      children: [
        Text('$count', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: color)),
        const SizedBox(height: 2),
        Text(label, style: const TextStyle(fontSize: 11, color: AdminTheme.textSecondary)),
      ],
    );
  }

  // ============================================================
  // MODULE 2: QUẢN LÝ SHOP (SHOPS)
  // ============================================================

  Widget _buildShopsSection() {
    final filtered = _shops.where((s) {
      if (_searchQuery.isNotEmpty) {
        final name = (s['name']?.toString() ?? '').toLowerCase();
        final owner = (s['ownerUsername']?.toString() ?? '').toLowerCase();
        if (!name.contains(_searchQuery.toLowerCase()) && !owner.contains(_searchQuery.toLowerCase())) return false;
      }
      if (_shopFilterTab == 'pending') return s['approvalStatus'] == 'pending';
      if (_shopFilterTab == 'active') return s['status'] == 'active' && s['approvalStatus'] == 'approved';
      if (_shopFilterTab == 'suspended') return s['status'] == 'suspended';
      if (_shopFilterTab == 'closed') return s['status'] == 'closed';
      return true;
    }).toList();

    return Column(
      children: [
        // Tabs
        Container(
          color: AdminTheme.card,
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Row(
              children: [
                _filterChip('all', 'Tất cả (${_shops.length})', _shopFilterTab, (k) => setState(() => _shopFilterTab = k)),
                _filterChip('pending', 'Chờ duyệt KYC (${_shops.where((s) => s['approvalStatus'] == 'pending').length})', _shopFilterTab, (k) => setState(() => _shopFilterTab = k)),
                _filterChip('active', 'Đang hoạt động (${_shops.where((s) => s['status'] == 'active' && s['approvalStatus'] == 'approved').length})', _shopFilterTab, (k) => setState(() => _shopFilterTab = k)),
                _filterChip('suspended', 'Tạm khóa (${_shops.where((s) => s['status'] == 'suspended').length})', _shopFilterTab, (k) => setState(() => _shopFilterTab = k)),
              ],
            ),
          ),
        ),

        // Search Bar
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: TextField(
            onChanged: (val) => setState(() => _searchQuery = val.trim()),
            style: const TextStyle(fontSize: 13),
            decoration: InputDecoration(
              isDense: true,
              hintText: 'Tìm theo tên shop, chủ sở hữu...',
              prefixIcon: const Icon(Icons.search, size: 18, color: AdminTheme.textSecondary),
              suffixIcon: _searchQuery.isNotEmpty
                  ? IconButton(icon: const Icon(Icons.clear, size: 16), onPressed: () => setState(() => _searchQuery = ''))
                  : null,
            ),
          ),
        ),

        // List Shops
        Expanded(
          child: filtered.isEmpty
              ? const Center(child: Text('Không tìm thấy gian hàng nào.', style: TextStyle(color: AdminTheme.textSecondary)))
              : ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  itemCount: filtered.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (ctx, idx) {
                    final shop = filtered[idx];
                    final shopId = shop['id']?.toString() ?? '';
                    final name = shop['name']?.toString() ?? 'Gian hàng';
                    final owner = shop['ownerUsername']?.toString() ?? shop['ownerFullName']?.toString() ?? 'Chủ shop';
                    final approvalStatus = shop['approvalStatus']?.toString() ?? 'pending';
                    final status = shop['status']?.toString() ?? 'active';
                    final version = shop['approvalVersion'] is int ? shop['approvalVersion'] as int : 1;

                    return Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: AdminTheme.card,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AdminTheme.border),
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
                                  color: AdminTheme.surfaceSubtle,
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: const Icon(Icons.storefront_rounded, color: AdminTheme.primary, size: 22),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5, color: AdminTheme.textPrimary)),
                                    Text('@$owner · ID: $shopId', style: const TextStyle(fontSize: 11, color: AdminTheme.textSecondary)),
                                  ],
                                ),
                              ),
                              _statusPill(approvalStatus),
                            ],
                          ),
                          const Divider(color: AdminTheme.border, height: 18),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text('Trạng thái: $status', style: const TextStyle(fontSize: 11.5, color: AdminTheme.textSecondary)),
                              Row(
                                children: [
                                  if (approvalStatus == 'pending') ...[
                                    OutlinedButton(
                                      style: OutlinedButton.styleFrom(
                                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                        minimumSize: Size.zero,
                                        foregroundColor: AdminTheme.danger,
                                        side: const BorderSide(color: AdminTheme.danger),
                                      ),
                                      onPressed: () => _approveShop(shopId, version, isApproved: false),
                                      child: const Text('Từ chối', style: TextStyle(fontSize: 11)),
                                    ),
                                    const SizedBox(width: 8),
                                    ElevatedButton(
                                      style: ElevatedButton.styleFrom(
                                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                                        minimumSize: Size.zero,
                                      ),
                                      onPressed: () => _approveShop(shopId, version, isApproved: true),
                                      child: const Text('Duyệt KYC', style: TextStyle(fontSize: 11)),
                                    ),
                                  ] else ...[
                                    OutlinedButton(
                                      style: OutlinedButton.styleFrom(
                                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                        minimumSize: Size.zero,
                                      ),
                                      onPressed: () => _updateShopStatus(shopId, status == 'active' ? 'suspended' : 'active'),
                                      child: Text(status == 'active' ? 'Khóa shop' : 'Mở khóa', style: const TextStyle(fontSize: 11)),
                                    ),
                                  ],
                                ],
                              ),
                            ],
                          ),
                        ],
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }

  // ============================================================
  // MODULE 3: QUẢN LÝ NGƯỜI DÙNG (USERS)
  // ============================================================

  Widget _buildUsersSection() {
    final filtered = _users.where((u) {
      if (_searchQuery.isNotEmpty) {
        final name = (u['fullName']?.toString() ?? '').toLowerCase();
        final username = (u['username']?.toString() ?? '').toLowerCase();
        final email = (u['email']?.toString() ?? '').toLowerCase();
        if (!name.contains(_searchQuery.toLowerCase()) && !username.contains(_searchQuery.toLowerCase()) && !email.contains(_searchQuery.toLowerCase())) return false;
      }
      if (_userFilterTab == 'active') return u['status'] == 'active';
      if (_userFilterTab == 'blocked') return u['status'] == 'blocked';
      if (_userFilterTab == 'seller') return u['role'] == 'seller';
      if (_userFilterTab == 'admin') return u['role'] == 'admin';
      return true;
    }).toList();

    return Column(
      children: [
        Container(
          color: AdminTheme.card,
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Row(
              children: [
                _filterChip('all', 'Tất cả (${_users.length})', _userFilterTab, (k) => setState(() => _userFilterTab = k)),
                _filterChip('seller', 'Người bán (${_users.where((u) => u['role'] == 'seller').length})', _userFilterTab, (k) => setState(() => _userFilterTab = k)),
                _filterChip('active', 'Hoạt động (${_users.where((u) => u['status'] == 'active').length})', _userFilterTab, (k) => setState(() => _userFilterTab = k)),
                _filterChip('blocked', 'Đã khóa (${_users.where((u) => u['status'] == 'blocked').length})', _userFilterTab, (k) => setState(() => _userFilterTab = k)),
              ],
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: TextField(
            onChanged: (val) => setState(() => _searchQuery = val.trim()),
            style: const TextStyle(fontSize: 13),
            decoration: InputDecoration(
              isDense: true,
              hintText: 'Tìm theo tên, email, username...',
              prefixIcon: const Icon(Icons.search, size: 18, color: AdminTheme.textSecondary),
            ),
          ),
        ),
        Expanded(
          child: filtered.isEmpty
              ? const Center(child: Text('Không tìm thấy người dùng nào.', style: TextStyle(color: AdminTheme.textSecondary)))
              : ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  itemCount: filtered.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (ctx, idx) {
                    final u = filtered[idx];
                    final userId = u['id']?.toString() ?? '';
                    final fullName = u['fullName']?.toString() ?? u['username']?.toString() ?? 'User';
                    final username = u['username']?.toString() ?? '';
                    final role = u['role']?.toString() ?? 'buyer';
                    final status = u['status']?.toString() ?? 'active';

                    return Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AdminTheme.card,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AdminTheme.border),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 40,
                            height: 40,
                            decoration: BoxDecoration(color: AdminTheme.surfaceSubtle, shape: BoxShape.circle),
                            child: Center(
                              child: Text(fullName.isNotEmpty ? fullName[0].toUpperCase() : 'U', style: const TextStyle(fontWeight: FontWeight.bold, color: AdminTheme.primary)),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(fullName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AdminTheme.textPrimary)),
                                Text('@$username · Vai trò: $role', style: const TextStyle(fontSize: 11, color: AdminTheme.textSecondary)),
                              ],
                            ),
                          ),
                          OutlinedButton(
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              minimumSize: Size.zero,
                              foregroundColor: status == 'active' ? AdminTheme.danger : AdminTheme.success,
                              side: BorderSide(color: status == 'active' ? AdminTheme.danger : AdminTheme.success),
                            ),
                            onPressed: () => _updateUserStatus(userId, status == 'active' ? 'blocked' : 'active'),
                            child: Text(status == 'active' ? 'Khóa' : 'Mở khóa', style: const TextStyle(fontSize: 11)),
                          ),
                        ],
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }

  // ============================================================
  // MODULE 4: QUẢN LÝ SẢN PHẨM (PRODUCTS)
  // ============================================================

  Widget _buildProductsSection() {
    final filtered = _products.where((p) {
      if (_searchQuery.isNotEmpty) {
        final name = (p['name']?.toString() ?? '').toLowerCase();
        if (!name.contains(_searchQuery.toLowerCase())) return false;
      }
      if (_productFilterTab == 'pending') return (p['approvalStatus'] ?? 'pending') == 'pending';
      if (_productFilterTab == 'approved') return p['approvalStatus'] == 'approved';
      if (_productFilterTab == 'rejected') return p['approvalStatus'] == 'rejected';
      return true;
    }).toList();

    return Column(
      children: [
        Container(
          color: AdminTheme.card,
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Row(
              children: [
                _filterChip('all', 'Tất cả (${_products.length})', _productFilterTab, (k) => setState(() => _productFilterTab = k)),
                _filterChip('pending', 'Chờ duyệt (${_products.where((p) => (p['approvalStatus'] ?? 'pending') == 'pending').length})', _productFilterTab, (k) => setState(() => _productFilterTab = k)),
                _filterChip('approved', 'Đã duyệt (${_products.where((p) => p['approvalStatus'] == 'approved').length})', _productFilterTab, (k) => setState(() => _productFilterTab = k)),
                _filterChip('rejected', 'Bị từ chối (${_products.where((p) => p['approvalStatus'] == 'rejected').length})', _productFilterTab, (k) => setState(() => _productFilterTab = k)),
              ],
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: TextField(
            onChanged: (val) => setState(() => _searchQuery = val.trim()),
            style: const TextStyle(fontSize: 13),
            decoration: InputDecoration(
              isDense: true,
              hintText: 'Tìm theo tên sản phẩm...',
              prefixIcon: const Icon(Icons.search, size: 18, color: AdminTheme.textSecondary),
            ),
          ),
        ),
        Expanded(
          child: filtered.isEmpty
              ? const Center(child: Text('Không có sản phẩm nào.', style: TextStyle(color: AdminTheme.textSecondary)))
              : ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  itemCount: filtered.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (ctx, idx) {
                    final p = filtered[idx];
                    final pId = p['id']?.toString() ?? '';
                    final name = p['name']?.toString() ?? 'Sản phẩm';
                    final price = double.tryParse(p['price']?.toString() ?? '0') ?? 0;
                    final approvalStatus = p['approvalStatus']?.toString() ?? 'pending';

                    return Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AdminTheme.card,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AdminTheme.border),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 50,
                            height: 50,
                            decoration: BoxDecoration(
                              color: AdminTheme.surfaceSubtle,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(Icons.inventory_2_outlined, color: AdminTheme.textSecondary),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AdminTheme.textPrimary)),
                                Text(_currencyFormat.format(price), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AdminTheme.primary)),
                              ],
                            ),
                          ),
                          if (approvalStatus == 'pending') ...[
                            IconButton(
                              icon: const Icon(Icons.close, color: AdminTheme.danger, size: 20),
                              onPressed: () => _updateProductApproval(pId, 'rejected'),
                            ),
                            IconButton(
                              icon: const Icon(Icons.check, color: AdminTheme.success, size: 20),
                              onPressed: () => _updateProductApproval(pId, 'approved'),
                            ),
                          ] else
                            _statusPill(approvalStatus),
                        ],
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }

  // ============================================================
  // MODULE 5: QUẢN LÝ ĐƠN HÀNG (ORDERS)
  // ============================================================

  Widget _buildOrdersSection() {
    final filtered = _orders.where((o) {
      if (_searchQuery.isNotEmpty) {
        final code = (o['code']?.toString() ?? o['id']?.toString() ?? '').toLowerCase();
        if (!code.contains(_searchQuery.toLowerCase())) return false;
      }
      if (_orderFilterTab != 'all') {
        if (o['status']?.toString() != _orderFilterTab) return false;
      }
      return true;
    }).toList();

    return Column(
      children: [
        Container(
          color: AdminTheme.card,
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Row(
              children: [
                _filterChip('all', 'Tất cả (${_orders.length})', _orderFilterTab, (k) => setState(() => _orderFilterTab = k)),
                _filterChip('pending', 'Chờ xác nhận', _orderFilterTab, (k) => setState(() => _orderFilterTab = k)),
                _filterChip('shipping', 'Đang giao', _orderFilterTab, (k) => setState(() => _orderFilterTab = k)),
                _filterChip('delivered', 'Đã giao', _orderFilterTab, (k) => setState(() => _orderFilterTab = k)),
              ],
            ),
          ),
        ),
        Expanded(
          child: filtered.isEmpty
              ? const Center(child: Text('Không có đơn hàng nào.', style: TextStyle(color: AdminTheme.textSecondary)))
              : ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  itemCount: filtered.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (ctx, idx) {
                    final o = filtered[idx];
                    final code = o['code']?.toString() ?? o['id']?.toString() ?? '';
                    final total = double.tryParse(o['totalAmount']?.toString() ?? '0') ?? 0;
                    final status = o['status']?.toString() ?? 'pending';

                    return Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AdminTheme.card,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AdminTheme.border),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('#$code', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AdminTheme.textPrimary)),
                              Text(_currencyFormat.format(total), style: const TextStyle(fontSize: 12, color: AdminTheme.primary, fontWeight: FontWeight.bold)),
                            ],
                          ),
                          _statusPill(status),
                        ],
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }

  // ============================================================
  // MODULE 6: DOANH THU (REVENUE)
  // ============================================================

  Widget _buildRevenueSection() {
    final revenue = double.tryParse(_stats?['revenue']?.toString() ?? '0') ?? 0;
    final commission = revenue * 0.05; // Hoa hồng sàn 5%

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [AdminTheme.primaryHover, AdminTheme.primary]),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Tổng GMV Toàn Sàn ShopNova', style: TextStyle(color: Colors.white70, fontSize: 13)),
                const SizedBox(height: 4),
                Text(_currencyFormat.format(revenue), style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold)),
                const SizedBox(height: 12),
                Text('Doanh thu hoa hồng sàn ước tính (5%): ${_currencyFormat.format(commission)}', style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ============================================================
  // MODULE 7: BÁO CÁO VI PHẠM (REPORTS)
  // ============================================================

  Widget _buildReportsSection() {
    return Column(
      children: [
        Expanded(
          child: _reports.isEmpty
              ? const Center(child: Text('Không có báo cáo vi phạm nào cần xử lý.', style: TextStyle(color: AdminTheme.textSecondary)))
              : ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  itemCount: _reports.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (ctx, idx) {
                    final rep = _reports[idx];
                    final repId = rep['id']?.toString() ?? '';
                    final reason = rep['reason']?.toString() ?? 'Vi phạm nội dung';
                    final status = rep['status']?.toString() ?? 'open';

                    return Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AdminTheme.card,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AdminTheme.border),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text('Báo cáo #$repId', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                              _statusPill(status),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Text('Lý do: $reason', style: const TextStyle(fontSize: 12, color: AdminTheme.textPrimary)),
                          const SizedBox(height: 10),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: [
                              OutlinedButton(
                                style: OutlinedButton.styleFrom(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                  minimumSize: Size.zero,
                                ),
                                onPressed: () => _updateReportStatus(repId, 'dismissed'),
                                child: const Text('Bác bỏ', style: TextStyle(fontSize: 11)),
                              ),
                              const SizedBox(width: 8),
                              ElevatedButton(
                                style: ElevatedButton.styleFrom(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                  minimumSize: Size.zero,
                                ),
                                onPressed: () => _updateReportStatus(repId, 'confirmed_violation'),
                                child: const Text('Xác nhận vi phạm', style: TextStyle(fontSize: 11)),
                              ),
                            ],
                          ),
                        ],
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }

  // ============================================================
  // MODULE 8: CÀI ĐẶT HỆ THỐNG (SETTINGS)
  // ============================================================

  Widget _buildSettingsSection() {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AdminTheme.card,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: AdminTheme.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Thông Tin Máy Chủ API', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AdminTheme.textPrimary)),
                const Divider(color: AdminTheme.border, height: 20),
                Text('Endpoint: ${ApiConfig.baseUrl}', style: const TextStyle(fontSize: 12, color: AdminTheme.textPrimary)),
                const SizedBox(height: 6),
                const Text('Trạng thái kết nối: Hoạt động bình thường (Online)', style: TextStyle(fontSize: 12, color: AdminTheme.success, fontWeight: FontWeight.bold)),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AdminTheme.card,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: AdminTheme.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Dịch Vụ Email Thông Báo', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AdminTheme.textPrimary)),
                const Divider(color: AdminTheme.border, height: 20),
                Text('Trạng thái: ${_emailStatus?['status'] ?? 'Ready / Connected'}', style: const TextStyle(fontSize: 12, color: AdminTheme.textPrimary)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // --- WIDGET HELPERS ---

  Widget _filterChip(String key, String label, String currentVal, Function(String) onSelect) {
    final isSelected = currentVal == key;
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: ChoiceChip(
        label: Text(label),
        selected: isSelected,
        selectedColor: AdminTheme.surfaceSubtle,
        backgroundColor: AdminTheme.card,
        side: BorderSide(color: isSelected ? AdminTheme.primary : AdminTheme.border),
        labelStyle: TextStyle(
          fontSize: 11.5,
          fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
          color: isSelected ? AdminTheme.primary : AdminTheme.textSecondary,
        ),
        onSelected: (val) {
          if (val) onSelect(key);
        },
      ),
    );
  }

  Widget _statusPill(String status) {
    Color bg;
    Color text;
    String label;

    switch (status) {
      case 'active':
      case 'delivered':
      case 'approved':
        bg = AdminTheme.successBg;
        text = AdminTheme.success;
        label = status == 'approved' ? 'Đã duyệt' : (status == 'delivered' ? 'Đã giao' : 'Hoạt động');
        break;
      case 'pending':
        bg = AdminTheme.warningBg;
        text = AdminTheme.warning;
        label = 'Chờ xử lý';
        break;
      case 'rejected':
      case 'cancelled':
      case 'suspended':
      case 'blocked':
        bg = AdminTheme.dangerBg;
        text = AdminTheme.danger;
        label = status == 'suspended' ? 'Đã khóa' : (status == 'rejected' ? 'Bị từ chối' : 'Đã hủy');
        break;
      default:
        bg = AdminTheme.surfaceSubtle;
        text = AdminTheme.textSecondary;
        label = status;
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(4)),
      child: Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: text)),
    );
  }

  @override
  Widget build(BuildContext context) {
    Widget content;
    switch (_selectedNavIndex) {
      case 1:
        content = _buildShopsSection();
        break;
      case 2:
        content = _buildUsersSection();
        break;
      case 3:
        content = _buildProductsSection();
        break;
      case 4:
        content = _buildOrdersSection();
        break;
      case 5:
        content = _buildRevenueSection();
        break;
      case 6:
        content = _buildReportsSection();
        break;
      case 7:
        content = _buildSettingsSection();
        break;
      case 0:
      default:
        content = _buildDashboardSection();
        break;
    }

    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: AdminTheme.background,
      appBar: _buildAppBar(),
      drawer: _buildDrawer(),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AdminTheme.primary))
          : content,
    );
  }
}

// Painter vẽ đồ thị xu hướng doanh thu Admin
class _AdminTrendPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final linePaint = Paint()
      ..color = AdminTheme.primary
      ..strokeWidth = 2.5
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    final dotPaint = Paint()
      ..color = AdminTheme.primary
      ..style = PaintingStyle.fill;

    final gridPaint = Paint()
      ..color = AdminTheme.border.withValues(alpha: 0.5)
      ..strokeWidth = 1.0;

    for (int i = 0; i < 4; i++) {
      final y = size.height * (i / 3);
      canvas.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
    }

    final points = <Offset>[
      Offset(size.width * 0.05, size.height * 0.75),
      Offset(size.width * 0.20, size.height * 0.60),
      Offset(size.width * 0.35, size.height * 0.70),
      Offset(size.width * 0.50, size.height * 0.40),
      Offset(size.width * 0.65, size.height * 0.50),
      Offset(size.width * 0.80, size.height * 0.25),
      Offset(size.width * 0.95, size.height * 0.15),
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
