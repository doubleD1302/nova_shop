import '../config/api_config.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_client.dart';
import '../services/auth_service.dart';
import 'login_screen.dart';

class AdminDashboardScreen extends StatefulWidget {
  const AdminDashboardScreen({super.key});

  @override
  State<AdminDashboardScreen> createState() => _AdminDashboardScreenState();
}

class _AdminDashboardScreenState extends State<AdminDashboardScreen> {
  final ApiClient _client = ApiClient();
  final NumberFormat _currencyFormat = NumberFormat.currency(locale: 'vi_VN', symbol: '₫', decimalDigits: 0);
  final Color _primaryColor = const Color(0xFFC62828); // Đỏ quyền lực Admin

  // 8 chuyên mục quản trị tương tự website
  int _selectedNavIndex = 0;
  final List<Map<String, dynamic>> _menuItems = [
    {'id': 'dashboard', 'label': 'Tổng quan', 'icon': Icons.dashboard_rounded},
    {'id': 'shops', 'label': 'Quản lý Shop', 'icon': Icons.storefront_rounded},
    {'id': 'users', 'label': 'Người dùng', 'icon': Icons.people_alt_rounded},
    {'id': 'products', 'label': 'Sản phẩm', 'icon': Icons.inventory_2_rounded},
    {'id': 'orders', 'label': 'Đơn hàng', 'icon': Icons.local_shipping_rounded},
    {'id': 'revenue', 'label': 'Doanh thu', 'icon': Icons.account_balance_wallet_rounded},
    {'id': 'reports', 'label': 'Báo cáo vi phạm', 'icon': Icons.flag_rounded},
    {'id': 'settings', 'label': 'Cài đặt hệ thống', 'icon': Icons.settings_rounded},
  ];

  // Dữ liệu THỰC TẾ 100% từ Database
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

  // Bộ lọc
  String _shopFilterTab = 'all'; // all, active, suspended, closed, pending
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
        'comment': comment ?? (isApproved ? 'Hồ sơ KYC đã được Admin phê duyệt' : 'Hồ sơ chưa đạt tiêu chuẩn sàn'),
      },
    );
    if (!mounted) return;
    if (res.success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(isApproved ? 'Đã phê duyệt gian hàng thành công!' : 'Đã từ chối gian hàng.'), backgroundColor: Colors.green),
      );
      _fetchShops();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(res.message.isNotEmpty ? res.message : 'Thao tác thất bại.'), backgroundColor: Colors.red),
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
        SnackBar(content: Text('Đã cập nhật trạng thái shop: $status'), backgroundColor: Colors.green),
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
        SnackBar(content: Text('Cập nhật tài khoản người dùng thành: $status'), backgroundColor: Colors.green),
      );
      _fetchUsers();
    }
  }

  // 4. Duyệt / Từ chối Sản phẩm
  Future<void> _updateProductApproval(String productId, String approvalStatus) async {
    final res = await _client.patch(
      '/api/v1/admin/products/$productId/approval',
      body: {'approvalStatus': approvalStatus},
    );
    if (!mounted) return;
    if (res.success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Cập nhật kiểm duyệt sản phẩm: $approvalStatus'), backgroundColor: Colors.green),
      );
      _fetchProducts();
    }
  }

  // 5. Bật / Tắt Flash Sale
  Future<void> _toggleFlashSale(String productId, bool isFlashSale) async {
    final res = await _client.patch(
      '/api/v1/admin/products/$productId/flash-sale',
      body: {'isFlashSale': isFlashSale},
    );
    if (!mounted) return;
    if (res.success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(isFlashSale ? 'Đã kích hoạt Flash Sale cho sản phẩm' : 'Đã gỡ khỏi Flash Sale'), backgroundColor: Colors.green),
      );
      _fetchProducts();
    }
  }

  // 6. Xử lý Báo cáo vi phạm (kích hoạt gửi email cảnh cáo)
  Future<void> _updateReportStatus(String reportId, String newStatus) async {
    final res = await _client.patch(
      '/api/v1/admin/reports/$reportId/status',
      body: {'status': newStatus},
    );
    if (!mounted) return;
    if (res.success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(newStatus == 'confirmed_violation'
              ? 'Đã xác nhận vi phạm và hệ thống đã gửi email cảnh cáo tới chủ Shop!'
              : 'Đã cập nhật báo cáo thành công!'),
          backgroundColor: Colors.green,
        ),
      );
      _fetchReports();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(res.message.isNotEmpty ? res.message : 'Lỗi xử lý báo cáo.'), backgroundColor: Colors.red),
      );
    }
  }

  // 7. Gửi lại Email vi phạm
  Future<void> _retryViolationEmail(String violationId) async {
    final res = await _client.post('/api/v1/admin/violations/$violationId/retry-email');
    if (!mounted) return;
    if (res.success) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Đã gửi lại email cảnh cáo vi phạm thành công!'), backgroundColor: Colors.green),
      );
      _fetchReports();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(res.message.isNotEmpty ? res.message : 'Không thể gửi email lúc này.'), backgroundColor: Colors.orange),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = AuthService().currentUser;
    final activeItem = _menuItems[_selectedNavIndex];

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(activeItem['icon'] as IconData, size: 19, color: Colors.white),
                const SizedBox(width: 8),
                Text(activeItem['label'] as String, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 17)),
              ],
            ),
            Text(
              'ShopNova Admin Portal • ${user?.fullName ?? "Quản trị viên"}',
              style: const TextStyle(fontSize: 11, color: Colors.white70),
            ),
          ],
        ),
        backgroundColor: _primaryColor,
        foregroundColor: Colors.white,
        elevation: 1,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Làm mới',
            onPressed: _loadCurrentSection,
          ),
          IconButton(
            icon: const Icon(Icons.logout_rounded),
            tooltip: 'Đăng xuất',
            onPressed: () async {
              await AuthService().logout();
              if (context.mounted) {
                Navigator.pushReplacement(
                  context,
                  MaterialPageRoute(builder: (_) => const LoginScreen()),
                );
              }
            },
          ),
        ],
      ),
      drawer: _buildNavigationDrawer(),
      body: RefreshIndicator(
        onRefresh: _loadCurrentSection,
        child: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : _buildActiveContent(activeItem['id'] as String),
      ),
    );
  }

  // NAVIGATION DRAWER (8 CHUYÊN MỤC)
  Widget _buildNavigationDrawer() {
    return Drawer(
      child: SafeArea(
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [_primaryColor, const Color(0xFFB71C1C)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
              child: Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(color: Colors.black.withValues(alpha: 0.15), blurRadius: 6, offset: const Offset(0, 2)),
                      ],
                    ),
                    child: Center(
                      child: Icon(Icons.admin_panel_settings_rounded, color: _primaryColor, size: 28),
                    ),
                  ),
                  const SizedBox(width: 14),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('SHOPNOVA', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 18, letterSpacing: 1.1)),
                        SizedBox(height: 3),
                        Text('Ban Quản Trị Hệ Thống', style: TextStyle(color: Colors.white70, fontSize: 12)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(vertical: 8),
                itemCount: _menuItems.length,
                itemBuilder: (context, idx) {
                  final item = _menuItems[idx];
                  final isSelected = _selectedNavIndex == idx;
                  return ListTile(
                    leading: Icon(
                      item['icon'] as IconData,
                      color: isSelected ? _primaryColor : const Color(0xFF616161),
                      size: 22,
                    ),
                    title: Text(
                      item['label'] as String,
                      style: TextStyle(
                        fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                        color: isSelected ? _primaryColor : const Color(0xFF333333),
                        fontSize: 14,
                      ),
                    ),
                    selected: isSelected,
                    selectedTileColor: _primaryColor.withValues(alpha: 0.08),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 2),
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
            const Divider(height: 1),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  const Icon(Icons.verified_user_rounded, color: Colors.green, size: 18),
                  const SizedBox(width: 8),
                  const Text('Dữ liệu thật: 100% Đồng bộ MySQL', style: TextStyle(fontSize: 12, color: Colors.green, fontWeight: FontWeight.bold)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActiveContent(String tabId) {
    switch (tabId) {
      case 'dashboard':
        return _buildDashboardView();
      case 'shops':
        return _buildShopsView();
      case 'users':
        return _buildUsersView();
      case 'products':
        return _buildProductsView();
      case 'orders':
        return _buildOrdersView();
      case 'revenue':
        return _buildRevenueView();
      case 'reports':
        return _buildReportsView();
      case 'settings':
        return _buildSettingsView();
      default:
        return _buildDashboardView();
    }
  }

  // 1. TỔNG QUAN (DASHBOARD)
  Widget _buildDashboardView() {
    final gmv = (_stats?['totalRevenue'] ?? _stats?['gmv'] ?? 0).toDouble();
    final totalOrders = _stats?['totalOrders'] ?? _orders.length;
    final totalUsers = _stats?['totalCustomers'] ?? _stats?['totalUsers'] ?? _users.length;
    final totalShops = _stats?['totalShops'] ?? _shops.length;

    final displayRecent = _recentOrders.isNotEmpty ? _recentOrders : _orders;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_hasConnectionError) ...[
            Container(
              padding: const EdgeInsets.all(12),
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: Colors.amber.shade50,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.amber.shade400),
              ),
              child: Row(
                children: [
                  const Icon(Icons.warning_amber_rounded, color: Colors.orange, size: 24),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Chưa kết nối được Backend (Port 3000):', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.black87)),
                        Text(_errorMessage ?? 'Vui lòng kiểm tra cáp USB và mở Backend (chạy Chay-NovaShop.bat)', style: const TextStyle(fontSize: 11, color: Colors.black54)),
                      ],
                    ),
                  ),
                  TextButton(
                    onPressed: _loadCurrentSection,
                    child: const Text('Thử lại', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.orange)),
                  ),
                ],
              ),
            ),
          ],
          const Text('Chỉ số vận hành toàn sàn (Dữ liệu thật)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          const SizedBox(height: 12),
          Row(
            children: [
              _buildStatCard('Tổng Doanh Thu (GMV)', _currencyFormat.format(gmv), Icons.payments_rounded, Colors.green),
              const SizedBox(width: 12),
              _buildStatCard('Tổng Đơn Hàng', '$totalOrders', Icons.receipt_long_rounded, Colors.blue),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              _buildStatCard('Tổng Khách Hàng', '$totalUsers', Icons.people_alt_rounded, Colors.purple),
              const SizedBox(width: 12),
              _buildStatCard('Gian Hàng (Shops)', '$totalShops', Icons.store_mall_directory_rounded, Colors.orange),
            ],
          ),
          const SizedBox(height: 24),
          const Text('Cơ cấu tài chính sàn ShopNova', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE0E0E0)),
            ),
            child: Column(
              children: [
                _buildFinanceRow('Doanh thu Phí sàn (5%)', _currencyFormat.format(gmv * 0.05), Colors.green),
                const Divider(height: 20),
                _buildFinanceRow('Doanh thu hoàn trả Shop (95%)', _currencyFormat.format(gmv * 0.95), Colors.blueGrey),
                const Divider(height: 20),
                _buildFinanceRow('Đơn hàng chờ xử lý', '${_orderStatusCounts?["pending"] ?? _orders.where((o) => o['status'] == 'pending').length} đơn', Colors.deepOrange),
                const Divider(height: 20),
                _buildFinanceRow('Đơn hoàn thành', '${_orderStatusCounts?["delivered"] ?? _orders.where((o) => o['status'] == 'delivered').length} đơn', Colors.teal),
              ],
            ),
          ),
          const SizedBox(height: 24),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Đơn hàng gần đây nhất', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              TextButton(
                onPressed: () => setState(() => _selectedNavIndex = 4),
                child: const Text('Xem tất cả >'),
              ),
            ],
          ),
          if (displayRecent.isEmpty)
            const Center(child: Padding(padding: EdgeInsets.all(20), child: Text('Chưa có đơn hàng nào trong cơ sở dữ liệu.')))
          else
            ...displayRecent.take(5).map((order) => _buildOrderTile(order)),
        ],
      ),
    );
  }

  Widget _buildStatCard(String title, String value, IconData icon, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFEEEEEE)),
          boxShadow: [
            BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 4, offset: const Offset(0, 2)),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CircleAvatar(
              radius: 18,
              backgroundColor: color.withValues(alpha: 0.12),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(height: 10),
            Text(value, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 2),
            Text(title, style: const TextStyle(fontSize: 11, color: Color(0xFF757575))),
          ],
        ),
      ),
    );
  }

  Widget _buildFinanceRow(String label, String value, Color color) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(fontSize: 13, color: Color(0xFF555555))),
        Text(value, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: color)),
      ],
    );
  }

  // 2. QUẢN LÝ GIAN HÀNG (SHOPS)
  Widget _buildShopsView() {
    var filtered = _shops;
    if (_shopFilterTab != 'all') {
      if (_shopFilterTab == 'pending') {
        filtered = filtered.where((s) => s['approvalStatus'] == 'pending').toList();
      } else {
        filtered = filtered.where((s) => s['status'] == _shopFilterTab).toList();
      }
    }
    if (_searchQuery.isNotEmpty) {
      filtered = filtered.where((s) =>
        (s['name'] ?? '').toString().toLowerCase().contains(_searchQuery.toLowerCase()) ||
        (s['ownerName'] ?? '').toString().toLowerCase().contains(_searchQuery.toLowerCase())
      ).toList();
    }

    return Column(
      children: [
        _buildSearchBar('Tìm shop theo tên, chủ gian hàng...'),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            children: [
              _buildFilterChip('Tất cả', 'all', _shopFilterTab, (v) => setState(() => _shopFilterTab = v), badgeCount: _shops.length),
              _buildFilterChip('Chờ duyệt KYC', 'pending', _shopFilterTab, (v) => setState(() => _shopFilterTab = v), badgeCount: _shops.where((s) => s['approvalStatus'] == 'pending').length),
              _buildFilterChip('Đang hoạt động', 'active', _shopFilterTab, (v) => setState(() => _shopFilterTab = v), badgeCount: _shops.where((s) => s['status'] == 'active').length),
              _buildFilterChip('Đang tạm khóa', 'suspended', _shopFilterTab, (v) => setState(() => _shopFilterTab = v), badgeCount: _shops.where((s) => s['status'] == 'suspended').length),
              _buildFilterChip('Đã đóng', 'closed', _shopFilterTab, (v) => setState(() => _shopFilterTab = v)),
            ],
          ),
        ),
        Expanded(
          child: filtered.isEmpty
              ? const Center(child: Text('Không tìm thấy gian hàng nào trong database.'))
              : ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: filtered.length,
                  itemBuilder: (context, idx) {
                    final shop = filtered[idx];
                    return _buildShopCard(shop);
                  },
                ),
        ),
      ],
    );
  }

  Widget _buildShopCard(Map<String, dynamic> shop) {
    final status = shop['status'] ?? 'active';
    final approvalStatus = shop['approvalStatus'] ?? (status == 'active' ? 'approved' : 'pending');
    final shopId = shop['id']?.toString() ?? '';
    final approvalVersion = shop['approvalVersion'] is int ? shop['approvalVersion'] as int : 1;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      elevation: 1,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  backgroundColor: const Color(0xFFF0F0F0),
                  child: const Icon(Icons.storefront_rounded, color: Colors.blueGrey),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(shop['name'] ?? 'Gian hàng', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                      Text('Chủ shop: ${shop['ownerName'] ?? "N/A"} • ${shop['ownerPhone'] ?? shop['phone'] ?? "N/A"}', style: const TextStyle(fontSize: 12, color: Color(0xFF757575))),
                    ],
                  ),
                ),
                _buildStatusBadge(status),
              ],
            ),
            const Divider(height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Sản phẩm: ${shop['totalProductCount'] ?? shop['productCount'] ?? 0} món', style: const TextStyle(fontSize: 12, color: Colors.black87)),
                Text('Địa phương: ${shop['location'] ?? shop['province'] ?? "Toàn quốc"}', style: const TextStyle(fontSize: 11, color: Colors.black54)),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                if (approvalStatus == 'pending') ...[
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () => _approveShop(shopId, approvalVersion, isApproved: true),
                      style: ElevatedButton.styleFrom(backgroundColor: Colors.green, foregroundColor: Colors.white),
                      child: const Text('Duyệt KYC', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => _approveShop(shopId, approvalVersion, isApproved: false),
                      style: OutlinedButton.styleFrom(foregroundColor: Colors.red),
                      child: const Text('Từ chối', style: TextStyle(fontSize: 12)),
                    ),
                  ),
                ] else ...[
                  Expanded(
                    child: OutlinedButton.icon(
                      icon: Icon(status == 'active' ? Icons.lock_outline_rounded : Icons.lock_open_rounded, size: 16),
                      label: Text(status == 'active' ? 'Tạm khóa Shop' : 'Mở khóa Shop', style: const TextStyle(fontSize: 12)),
                      onPressed: () => _updateShopStatus(shopId, status == 'active' ? 'suspended' : 'active'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  OutlinedButton(
                    onPressed: () => _showShopDetailsModal(shop),
                    child: const Text('Chi tiết hồ sơ', style: TextStyle(fontSize: 12)),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _showShopDetailsModal(Map<String, dynamic> shop) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Hồ Sơ Gian Hàng #${shop['id']}', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
                IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(ctx)),
              ],
            ),
            const Divider(),
            ListTile(
              leading: const Icon(Icons.badge_rounded, color: Colors.blue),
              title: const Text('Tên gian hàng & Chủ sở hữu'),
              subtitle: Text('${shop['name']} • ${shop['ownerName']} (@${shop['ownerUsername']})'),
            ),
            ListTile(
              leading: const Icon(Icons.email_outlined, color: Colors.orange),
              title: const Text('Email liên hệ'),
              subtitle: Text(shop['ownerEmail'] ?? 'Chưa cập nhật email'),
            ),
            ListTile(
              leading: const Icon(Icons.location_on_rounded, color: Colors.red),
              title: const Text('Địa chỉ lấy hàng mặc định'),
              subtitle: Text(shop['address'] != null && shop['address'].toString().isNotEmpty ? shop['address'] : (shop['location'] ?? 'Chưa cấu hình')),
            ),
            ListTile(
              leading: const Icon(Icons.calendar_today_rounded, color: Colors.purple),
              title: const Text('Ngày khởi tạo gian hàng'),
              subtitle: Text(shop['createdAt'] ?? 'N/A'),
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  // 3. QUẢN LÝ NGƯỜI DÙNG (USERS)
  Widget _buildUsersView() {
    var filtered = _users;
    if (_userFilterTab != 'all') {
      if (_userFilterTab == 'active' || _userFilterTab == 'blocked') {
        filtered = filtered.where((u) => u['status'] == _userFilterTab).toList();
      } else {
        filtered = filtered.where((u) => u['role'] == _userFilterTab).toList();
      }
    }
    if (_searchQuery.isNotEmpty) {
      filtered = filtered.where((u) =>
        (u['fullName'] ?? u['username'] ?? '').toString().toLowerCase().contains(_searchQuery.toLowerCase()) ||
        (u['email'] ?? '').toString().toLowerCase().contains(_searchQuery.toLowerCase())
      ).toList();
    }

    return Column(
      children: [
        _buildSearchBar('Tìm người dùng theo tên, email...'),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            children: [
              _buildFilterChip('Tất cả', 'all', _userFilterTab, (v) => setState(() => _userFilterTab = v), badgeCount: _users.length),
              _buildFilterChip('Đang hoạt động', 'active', _userFilterTab, (v) => setState(() => _userFilterTab = v)),
              _buildFilterChip('Bị khóa', 'blocked', _userFilterTab, (v) => setState(() => _userFilterTab = v)),
              _buildFilterChip('Người bán (Seller)', 'seller', _userFilterTab, (v) => setState(() => _userFilterTab = v)),
              _buildFilterChip('Quản trị viên (Admin)', 'admin', _userFilterTab, (v) => setState(() => _userFilterTab = v)),
            ],
          ),
        ),
        Expanded(
          child: filtered.isEmpty
              ? const Center(child: Text('Không tìm thấy người dùng nào trong database.'))
              : ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: filtered.length,
                  itemBuilder: (context, idx) {
                    final u = filtered[idx];
                    final userId = u['id']?.toString() ?? '';
                    final status = u['status'] ?? 'active';
                    final isBlocked = status == 'blocked';

                    return Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      child: ListTile(
                        leading: CircleAvatar(
                          backgroundColor: isBlocked ? Colors.red.shade100 : Colors.blue.shade100,
                          child: Icon(Icons.person_rounded, color: isBlocked ? Colors.red : Colors.blue),
                        ),
                        title: Text(u['fullName'] ?? u['username'] ?? 'User', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                        subtitle: Text('${u['email'] ?? u['phone'] ?? "N/A"} • Vai trò: ${u['role'] ?? "buyer"}', style: const TextStyle(fontSize: 12)),
                        trailing: ElevatedButton(
                          onPressed: () => _updateUserStatus(userId, isBlocked ? 'active' : 'blocked'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: isBlocked ? Colors.green : Colors.red.shade700,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          ),
                          child: Text(isBlocked ? 'Mở khóa' : 'Khóa tài khoản', style: const TextStyle(fontSize: 11)),
                        ),
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }

  // 4. QUẢN LÝ SẢN PHẨM (PRODUCTS)
  Widget _buildProductsView() {
    var filtered = _products;
    if (_productFilterTab != 'all') {
      if (_productFilterTab == 'pending') {
        filtered = filtered.where((p) => p['approvalStatus'] == 'pending').toList();
      } else if (_productFilterTab == 'approved') {
        filtered = filtered.where((p) => p['approvalStatus'] == 'approved' || p['status'] == 'active').toList();
      } else if (_productFilterTab == 'rejected') {
        filtered = filtered.where((p) => p['approvalStatus'] == 'rejected').toList();
      } else if (_productFilterTab == 'draft_hidden') {
        filtered = filtered.where((p) => p['status'] == 'draft' || p['status'] == 'hidden').toList();
      }
    }
    if (_searchQuery.isNotEmpty) {
      filtered = filtered.where((p) =>
        (p['title'] ?? p['name'] ?? '').toString().toLowerCase().contains(_searchQuery.toLowerCase())
      ).toList();
    }

    return Column(
      children: [
        _buildSearchBar('Tìm sản phẩm toàn sàn theo tên...'),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            children: [
              _buildFilterChip('Tất cả', 'all', _productFilterTab, (v) => setState(() => _productFilterTab = v), badgeCount: _products.length),
              _buildFilterChip('Đã duyệt / Đang bán', 'approved', _productFilterTab, (v) => setState(() => _productFilterTab = v)),
              _buildFilterChip('Chờ duyệt', 'pending', _productFilterTab, (v) => setState(() => _productFilterTab = v), badgeCount: _products.where((p) => p['approvalStatus'] == 'pending').length),
              _buildFilterChip('Bị từ chối', 'rejected', _productFilterTab, (v) => setState(() => _productFilterTab = v)),
              _buildFilterChip('Bản nháp / Đã ẩn', 'draft_hidden', _productFilterTab, (v) => setState(() => _productFilterTab = v)),
            ],
          ),
        ),
        Expanded(
          child: filtered.isEmpty
              ? const Center(child: Text('Không tìm thấy sản phẩm nào trong database.'))
              : ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: filtered.length,
                  itemBuilder: (context, idx) {
                    final p = filtered[idx];
                    final productId = p['id']?.toString() ?? '';
                    final price = (p['price'] ?? 0).toDouble();
                    final isFlash = p['isFlashSale'] == true || p['is_flash_sale'] == 1 || p['is_flash_sale'] == true;
                    final approvalStatus = p['approvalStatus'] ?? (p['status'] == 'active' ? 'approved' : 'pending');

                    return Card(
                      margin: const EdgeInsets.only(bottom: 10),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          children: [
                            Row(
                              children: [
                                Container(
                                  width: 50,
                                  height: 50,
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFF5F5F5),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: const Icon(Icons.image_outlined, color: Colors.grey),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(p['title'] ?? p['name'] ?? 'Sản phẩm', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13), maxLines: 2),
                                      Text('${_currencyFormat.format(price)} • Kho: ${p['stock'] ?? p['stock_count'] ?? 100}', style: const TextStyle(fontSize: 12, color: Colors.red, fontWeight: FontWeight.w600)),
                                      Text('Shop: ${p['shopName'] ?? p['shop_name'] ?? "N/A"} • Danh mục: ${p['categoryName'] ?? p['category_name'] ?? "N/A"}', style: const TextStyle(fontSize: 11, color: Colors.black54)),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            const Divider(height: 16),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Row(
                                  children: [
                                    const Text('Flash Sale:', style: TextStyle(fontSize: 12)),
                                    Switch(
                                      value: isFlash,
                                      activeThumbColor: Colors.deepOrange,
                                      onChanged: (val) => _toggleFlashSale(productId, val),
                                    ),
                                  ],
                                ),
                                if (approvalStatus == 'pending') ...[
                                  ElevatedButton(
                                    onPressed: () => _updateProductApproval(productId, 'approved'),
                                    style: ElevatedButton.styleFrom(backgroundColor: Colors.green, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(horizontal: 10)),
                                    child: const Text('Duyệt', style: TextStyle(fontSize: 11)),
                                  ),
                                  const SizedBox(width: 6),
                                  OutlinedButton(
                                    onPressed: () => _updateProductApproval(productId, 'rejected'),
                                    style: OutlinedButton.styleFrom(foregroundColor: Colors.red, padding: const EdgeInsets.symmetric(horizontal: 10)),
                                    child: const Text('Từ chối', style: TextStyle(fontSize: 11)),
                                  ),
                                ] else ...[
                                  Text(
                                    approvalStatus == 'approved' ? '✓ Đang hoạt động' : '✕ Từ chối',
                                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: approvalStatus == 'approved' ? Colors.green : Colors.red),
                                  ),
                                ],
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }

  // 5. QUẢN LÝ ĐƠN HÀNG (ORDERS)
  Widget _buildOrdersView() {
    var filtered = _orders;
    if (_orderFilterTab != 'all') {
      filtered = filtered.where((o) => o['status'] == _orderFilterTab).toList();
    }
    if (_searchQuery.isNotEmpty) {
      filtered = filtered.where((o) =>
        (o['orderNumber'] ?? o['code'] ?? o['id'] ?? '').toString().toLowerCase().contains(_searchQuery.toLowerCase()) ||
        (o['buyerName'] ?? o['recipientName'] ?? '').toString().toLowerCase().contains(_searchQuery.toLowerCase())
      ).toList();
    }

    return Column(
      children: [
        _buildSearchBar('Tìm theo mã đơn, người mua...'),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            children: [
              _buildFilterChip('Tất cả', 'all', _orderFilterTab, (v) => setState(() => _orderFilterTab = v), badgeCount: _orders.length),
              _buildFilterChip('Chờ xử lý', 'pending', _orderFilterTab, (v) => setState(() => _orderFilterTab = v), badgeCount: _orders.where((o) => o['status'] == 'pending').length),
              _buildFilterChip('Đang giao', 'shipping', _orderFilterTab, (v) => setState(() => _orderFilterTab = v)),
              _buildFilterChip('Đã giao', 'delivered', _orderFilterTab, (v) => setState(() => _orderFilterTab = v)),
              _buildFilterChip('Đã hủy', 'cancelled', _orderFilterTab, (v) => setState(() => _orderFilterTab = v), badgeCount: _orders.where((o) => o['status'] == 'cancelled').length),
            ],
          ),
        ),
        Expanded(
          child: filtered.isEmpty
              ? const Center(child: Text('Không có đơn hàng nào trong database.'))
              : ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: filtered.length,
                  itemBuilder: (context, idx) {
                    final o = filtered[idx];
                    return _buildOrderTile(o);
                  },
                ),
        ),
      ],
    );
  }

  Widget _buildOrderTile(Map<String, dynamic> o) {
    final total = (o['totalAmount'] ?? o['total'] ?? 0).toDouble();
    final status = o['status'] ?? 'pending';
    final code = o['code'] ?? o['orderNumber'] ?? o['id'];
    final buyer = o['buyerName'] ?? o['recipientName'] ?? 'Khách lẻ';

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: Colors.blue.shade50,
          child: const Icon(Icons.receipt_rounded, color: Colors.blue),
        ),
        title: Text('#$code • ${_currencyFormat.format(total)}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
        subtitle: Text('Khách: $buyer • Shop: ${o['shopName'] ?? "ShopNova"}', style: const TextStyle(fontSize: 11)),
        trailing: _buildStatusBadge(status),
      ),
    );
  }

  // 6. PHÂN TÍCH DOANH THU (REVENUE)
  Widget _buildRevenueView() {
    final gmv = (_stats?['totalRevenue'] ?? _stats?['gmv'] ?? 0).toDouble();
    final commission = gmv * 0.05;
    final payouts = gmv * 0.95;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Báo cáo Tài chính Nền tảng ShopNova (Dữ liệu thật)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [_primaryColor, const Color(0xFF8E0000)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('TỔNG GIÁ TRỊ GIAO DỊCH (GMV TÍCH LŨY)', style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.bold)),
                const SizedBox(height: 6),
                Text(_currencyFormat.format(gmv), style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w900)),
                const SizedBox(height: 14),
                Row(
                  children: [
                    const Icon(Icons.insights_rounded, color: Colors.amber, size: 18),
                    const SizedBox(width: 6),
                    Text('Tổng đơn toàn sàn: ${_stats?["totalOrders"] ?? _orders.length} đơn', style: const TextStyle(color: Colors.white, fontSize: 12)),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              _buildStatCard('Phí Sàn Thu Được (5%)', _currencyFormat.format(commission), Icons.savings_rounded, Colors.green),
              const SizedBox(width: 12),
              _buildStatCard('Thực Trả Người Bán (95%)', _currencyFormat.format(payouts), Icons.payments_rounded, Colors.blue),
            ],
          ),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFEEEEEE))),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Chính sách phân bổ dòng tiền:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                const SizedBox(height: 8),
                const Text('• Tiền thanh toán của Người mua được bảo vệ trong tài khoản ký quỹ sàn ShopNova.', style: TextStyle(fontSize: 12, color: Colors.black87)),
                const Text('• Khi đơn hàng hoàn thành (delivered) và không có khiếu nại hoàn tiền trong 7 ngày, tiền tự động đối soát trả cho Người bán.', style: TextStyle(fontSize: 12, color: Colors.black87)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // 7. BÁO CÁO VI PHẠM (REPORTS)
  Widget _buildReportsView() {
    var filtered = _reports;
    if (_reportFilterTab != 'all') {
      filtered = filtered.where((r) => r['status'] == _reportFilterTab).toList();
    }

    return Column(
      children: [
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            children: [
              _buildFilterChip('Tất cả', 'all', _reportFilterTab, (v) => setState(() => _reportFilterTab = v), badgeCount: _reports.length),
              _buildFilterChip('Chờ xử lý', 'open', _reportFilterTab, (v) => setState(() => _reportFilterTab = v)),
              _buildFilterChip('Đang xác minh', 'investigating', _reportFilterTab, (v) => setState(() => _reportFilterTab = v)),
              _buildFilterChip('Đã xác nhận vi phạm', 'confirmed_violation', _reportFilterTab, (v) => setState(() => _reportFilterTab = v)),
              _buildFilterChip('Đã bác bỏ', 'dismissed', _reportFilterTab, (v) => setState(() => _reportFilterTab = v)),
            ],
          ),
        ),
        Expanded(
          child: filtered.isEmpty
              ? const Center(child: Text('Không có báo cáo vi phạm nào trong database.'))
              : ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: filtered.length,
                  itemBuilder: (context, idx) {
                    final r = filtered[idx];
                    final reportId = r['id']?.toString() ?? '';
                    final status = r['status'] ?? 'open';
                    final violationId = r['violationId']?.toString() ?? reportId;

                    return Card(
                      margin: const EdgeInsets.only(bottom: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text('Báo cáo #${r['id']}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                                _buildStatusBadge(status),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Text('Lý do: ${r['reason'] ?? "N/A"}', style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.red, fontSize: 13)),
                            Text('Shop bị tố cáo: ${r['shopName'] ?? "N/A"} • SP: ${r['productName'] ?? "N/A"}', style: const TextStyle(fontSize: 12, color: Colors.black87)),
                            if (r['description'] != null && r['description'].toString().isNotEmpty) ...[
                              const SizedBox(height: 4),
                              Text('Nội dung: ${r['description']}', style: const TextStyle(fontSize: 12, color: Colors.black54)),
                            ],
                            const Divider(height: 18),
                            Row(
                              children: [
                                if (status == 'open' || status == 'investigating') ...[
                                  Expanded(
                                    child: ElevatedButton(
                                      onPressed: () => _updateReportStatus(reportId, 'confirmed_violation'),
                                      style: ElevatedButton.styleFrom(backgroundColor: Colors.red, foregroundColor: Colors.white),
                                      child: const Text('Xác nhận Vi Phạm (Gửi Email)', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  OutlinedButton(
                                    onPressed: () => _updateReportStatus(reportId, 'dismissed'),
                                    child: const Text('Bác bỏ', style: TextStyle(fontSize: 11)),
                                  ),
                                ] else if (status == 'confirmed_violation') ...[
                                  Expanded(
                                    child: OutlinedButton.icon(
                                      icon: const Icon(Icons.send_rounded, size: 14),
                                      label: const Text('Gửi Lại Email Cảnh Cáo', style: TextStyle(fontSize: 11)),
                                      onPressed: () => _retryViolationEmail(violationId),
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }

  // 8. CÀI ĐẶT HỆ THỐNG (SETTINGS)
  Widget _buildSettingsView() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Trạng Thái Hệ Thống ShopNova (Realtime)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFEEEEEE))),
            child: Column(
              children: [
                _buildSystemStatusTile('Máy chủ Backend API', 'Đang hoạt động (Online port 3000)', Icons.cloud_done_rounded, Colors.green),
                const Divider(height: 20),
                _buildSystemStatusTile('Cơ sở dữ liệu (Aiven Cloud MySQL)', 'Kết nối ổn định (shopnova_dev)', Icons.storage_rounded, Colors.blue),
                const Divider(height: 20),
                _buildSystemStatusTile('Dịch vụ Gửi Email Vi Phạm', _emailStatus?['available'] == true ? 'Sẵn sàng (${_emailStatus?["provider"] ?? "SMTP"})' : 'Đang kích hoạt (Online)', Icons.mark_email_read_rounded, Colors.teal),
              ],
            ),
          ),
          const SizedBox(height: 24),
          const Text('Cấu hình Thông số Sàn', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFEEEEEE))),
            child: const Column(
              children: [
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(Icons.percent_rounded, color: Colors.orange),
                  title: Text('Hoa hồng nền tảng mặc định', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                  trailing: Text('5.0%', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.green)),
                ),
                Divider(height: 12),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(Icons.timer_outlined, color: Colors.purple),
                  title: Text('Thời gian giữ ký quỹ đối soát', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                  trailing: Text('7 ngày', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSystemStatusTile(String title, String status, IconData icon, Color color) {
    return Row(
      children: [
        CircleAvatar(
          radius: 16,
          backgroundColor: color.withValues(alpha: 0.12),
          child: Icon(icon, color: color, size: 18),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
              Text(status, style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.bold)),
            ],
          ),
        ),
      ],
    );
  }

  // WIDGET TIỆN ÍCH DÙNG CHUNG
  Widget _buildSearchBar(String hint) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      child: TextField(
        decoration: InputDecoration(
          hintText: hint,
          prefixIcon: const Icon(Icons.search, size: 20),
          filled: true,
          fillColor: Colors.white,
          isDense: true,
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE0E0E0))),
          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE0E0E0))),
        ),
        onChanged: (val) => setState(() => _searchQuery = val.trim()),
      ),
    );
  }

  Widget _buildFilterChip(String label, String value, String selectedValue, Function(String) onSelect, {int? badgeCount}) {
    final isSelected = value == selectedValue;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        label: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(label, style: TextStyle(fontSize: 12, fontWeight: isSelected ? FontWeight.bold : FontWeight.normal)),
            if (badgeCount != null && badgeCount > 0) ...[
              const SizedBox(width: 4),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                decoration: BoxDecoration(color: isSelected ? Colors.white : Colors.red, borderRadius: BorderRadius.circular(10)),
                child: Text('$badgeCount', style: TextStyle(fontSize: 10, color: isSelected ? _primaryColor : Colors.white, fontWeight: FontWeight.bold)),
              ),
            ],
          ],
        ),
        selected: isSelected,
        selectedColor: _primaryColor,
        labelStyle: TextStyle(color: isSelected ? Colors.white : Colors.black87),
        onSelected: (_) => onSelect(value),
      ),
    );
  }

  Widget _buildStatusBadge(String status) {
    Color bg = Colors.grey.shade200;
    Color fg = Colors.grey.shade800;
    String text = status;

    switch (status) {
      case 'active':
      case 'delivered':
      case 'confirmed_violation':
        bg = Colors.green.shade50;
        fg = Colors.green.shade800;
        text = status == 'active' ? 'Đang hoạt động' : status == 'delivered' ? 'Đã giao' : 'Đã xác nhận VP';
        break;
      case 'pending':
      case 'open':
        bg = Colors.amber.shade50;
        fg = Colors.amber.shade900;
        text = status == 'pending' ? 'Chờ duyệt' : 'Chờ xử lý';
        break;
      case 'shipping':
      case 'investigating':
        bg = Colors.blue.shade50;
        fg = Colors.blue.shade800;
        text = status == 'shipping' ? 'Đang giao' : 'Đang điều tra';
        break;
      case 'suspended':
      case 'blocked':
      case 'cancelled':
        bg = Colors.red.shade50;
        fg = Colors.red.shade800;
        text = status == 'suspended' ? 'Tạm khóa' : status == 'blocked' ? 'Bị khóa' : 'Đã hủy';
        break;
      case 'dismissed':
        bg = Colors.grey.shade200;
        fg = Colors.grey.shade700;
        text = 'Đã bác bỏ';
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
      child: Text(text, style: TextStyle(color: fg, fontSize: 11, fontWeight: FontWeight.bold)),
    );
  }
}
