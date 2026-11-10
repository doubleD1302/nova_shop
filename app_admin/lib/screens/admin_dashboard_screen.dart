import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../config/api_config.dart';
import '../services/api_client.dart';
import '../services/auth_service.dart';
import '../theme/admin_theme.dart';
import '../widgets/nova_logo.dart';
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

  Future<void> _promptRejectShop(String shopId, int version, String shopName) async {
    final ctrl = TextEditingController(text: 'Thông tin CMND/CCCD hoặc Giấy phép kinh doanh không khớp.');
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDlgState) => AlertDialog(
          backgroundColor: AdminTheme.card,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(10)),
                child: const Icon(Icons.cancel_outlined, color: AdminTheme.danger, size: 20),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text('Từ chối duyệt "$shopName"', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AdminTheme.textPrimary)),
              ),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Nhập lý do từ chối để thông báo cho người bán:', style: TextStyle(fontSize: 12, color: AdminTheme.textSecondary)),
              const SizedBox(height: 10),
              TextField(
                controller: ctrl,
                maxLines: 3,
                style: const TextStyle(fontSize: 13),
                decoration: const InputDecoration(hintText: 'Nhập lý do...'),
              ),
              const SizedBox(height: 10),
              const Text('Gợi ý lý do nhanh:', style: TextStyle(fontSize: 11, color: AdminTheme.textSecondary)),
              const SizedBox(height: 6),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  'CMND/CCCD hoặc Giấy phép không khớp',
                  'Địa chỉ kho hoặc SĐT không hợp lệ',
                  'Tên shop vi phạm bản quyền thương hiệu',
                  'Chưa đủ giấy tờ pháp lý theo quy định',
                ].map((sample) => InkWell(
                  onTap: () {
                    ctrl.text = sample;
                    setDlgState(() {});
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: AdminTheme.surfaceSubtle,
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: AdminTheme.border),
                    ),
                    child: Text('+ $sample', style: const TextStyle(fontSize: 10.5, color: AdminTheme.textSecondary)),
                  ),
                )).toList(),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Hủy')),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: AdminTheme.danger, foregroundColor: Colors.white),
              onPressed: () => Navigator.pop(ctx, ctrl.text.trim()),
              child: const Text('Từ chối'),
            ),
          ],
        ),
      ),
    );
    if (reason != null && reason.isNotEmpty) {
      _approveShop(shopId, version, isApproved: false, comment: reason);
    }
  }

  Future<void> _promptSuspendShop(String shopId, String shopName) async {
    final ctrl = TextEditingController(text: 'Gian hàng có dấu hiệu vi phạm chính sách bán hàng sàn NovaShop.');
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AdminTheme.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(10)),
              child: const Icon(Icons.lock_outline_rounded, color: AdminTheme.danger, size: 20),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text('Tạm Khóa Shop "$shopName"', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AdminTheme.textPrimary)),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Hành động này sẽ tạm ẩn toàn bộ sản phẩm của gian hàng khỏi sàn thương mại.', style: TextStyle(fontSize: 12, color: AdminTheme.textSecondary)),
            const SizedBox(height: 10),
            TextField(controller: ctrl, maxLines: 2, style: const TextStyle(fontSize: 13), decoration: const InputDecoration(labelText: 'Lý do tạm khóa gian hàng')),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Hủy')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AdminTheme.danger, foregroundColor: Colors.white),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Khóa gian hàng'),
          ),
        ],
      ),
    );
    if (confirm == true) {
      _updateShopStatus(shopId, 'suspended');
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
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(res.message.isNotEmpty ? res.message : 'Thao tác thất bại.'), backgroundColor: AdminTheme.danger),
      );
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
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(res.message.isNotEmpty ? res.message : 'Thao tác thất bại.'), backgroundColor: AdminTheme.danger),
      );
    }
  }

  // 4. Duyệt / Từ chối Sản phẩm
  Future<void> _updateProductApproval(String productId, String approvalStatus, {String? reason}) async {
    final res = await _client.patch(
      '/api/v1/admin/products/$productId/approval',
      body: {
        'approvalStatus': approvalStatus,
        if (approvalStatus == 'rejected') 'rejectionReason': reason ?? 'Sản phẩm vi phạm chính sách đăng bán',
      },
    );
    if (!mounted) return;
    if (res.success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Đã cập nhật kiểm duyệt sản phẩm: $approvalStatus'), backgroundColor: AdminTheme.success),
      );
      _fetchProducts();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(res.message.isNotEmpty ? res.message : 'Thao tác thất bại.'), backgroundColor: AdminTheme.danger),
      );
    }
  }

  Future<void> _promptRejectProduct(String productId, String productName) async {
    final ctrl = TextEditingController(text: 'Hình ảnh sản phẩm mờ hoặc sai quy cách 4 góc.');
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDlgState) => AlertDialog(
          backgroundColor: AdminTheme.card,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(10)),
                child: const Icon(Icons.cancel_outlined, color: AdminTheme.danger, size: 20),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text('Từ chối duyệt "$productName"', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AdminTheme.textPrimary)),
              ),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Nhập lý do từ chối để thông báo cho người bán:', style: TextStyle(fontSize: 12, color: AdminTheme.textSecondary)),
              const SizedBox(height: 10),
              TextField(
                controller: ctrl,
                maxLines: 3,
                style: const TextStyle(fontSize: 13),
                decoration: const InputDecoration(hintText: 'Nhập lý do...'),
              ),
              const SizedBox(height: 10),
              const Text('Gợi ý lý do nhanh:', style: TextStyle(fontSize: 11, color: AdminTheme.textSecondary)),
              const SizedBox(height: 6),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  'Hình ảnh mờ hoặc sai quy cách 4 góc',
                  'Mô tả sơ sài hoặc chưa rõ nguồn gốc',
                  'Giá bán không đúng quy định sàn',
                  'Tên sản phẩm chứa từ khóa vi phạm',
                ].map((sample) => InkWell(
                  onTap: () {
                    ctrl.text = sample;
                    setDlgState(() {});
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: AdminTheme.surfaceSubtle,
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: AdminTheme.border),
                    ),
                    child: Text('+ $sample', style: const TextStyle(fontSize: 10.5, color: AdminTheme.textSecondary)),
                  ),
                )).toList(),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Hủy')),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: AdminTheme.danger, foregroundColor: Colors.white),
              onPressed: () => Navigator.pop(ctx, ctrl.text.trim()),
              child: const Text('Từ chối'),
            ),
          ],
        ),
      ),
    );
    if (reason != null && reason.isNotEmpty) {
      _updateProductApproval(productId, 'rejected', reason: reason);
    }
  }

  Future<void> _toggleFlashSale(String productId, bool currentVal) async {
    final res = await _client.patch(
      '/api/v1/admin/products/$productId/flash-sale',
      body: {'enabled': !currentVal},
    );
    if (!mounted) return;
    if (res.success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(!currentVal ? 'Đã bật Flash Sale cho sản phẩm!' : 'Đã tắt Flash Sale.'),
          backgroundColor: AdminTheme.success,
        ),
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

  // MODAL 9: XEM CHI TIẾT HỒ SƠ KYC GIAN HÀNG & LỊCH SỬ XÉT DUYỆT
  Future<void> _showShopKycModal(Map<String, dynamic> shop) async {
    final shopId = shop['id']?.toString() ?? '';
    final shopName = shop['name']?.toString() ?? 'Gian hàng';
    final version = shop['approvalVersion'] is int ? shop['approvalVersion'] as int : 1;
    final approvalStatus = shop['approvalStatus']?.toString() ?? 'pending';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setModalState) {
          return FutureBuilder<List<dynamic>>(
            future: Future.wait([
              _client.get('/api/v1/admin/shops/$shopId/registration'),
              _client.get('/api/v1/admin/shops/$shopId/approval-events'),
            ]),
            builder: (context, snapshot) {
              final isLoading = snapshot.connectionState == ConnectionState.waiting;
              Map<String, dynamic>? regData;
              List<Map<String, dynamic>> events = [];

              if (snapshot.hasData) {
                final regRes = snapshot.data![0];
                final evRes = snapshot.data![1];
                if (regRes.success && regRes.data is Map) {
                  final dataMap = regRes.data as Map;
                  regData = Map<String, dynamic>.from(dataMap.containsKey('registration') ? dataMap['registration'] : dataMap);
                }
                if (evRes.success && evRes.data is List) {
                  events = List<Map<String, dynamic>>.from(evRes.data as List);
                }
              }

              final ownerName = regData?['ownerName'] ?? shop['ownerFullName'] ?? shop['ownerUsername'] ?? 'Chủ shop';
              final idNumber = regData?['identityCardNumber']?.toString() ?? '';
              final maskedId = idNumber.length >= 4 ? '******${idNumber.substring(idNumber.length - 4)}' : (idNumber.isNotEmpty ? idNumber : 'Chưa cập nhật');
              final busType = regData?['businessType'] == 'enterprise' ? 'Doanh nghiệp' : regData?['businessType'] == 'household' ? 'Hộ kinh doanh' : 'Cá nhân';
              final taxCode = regData?['taxCode'] ?? 'Chưa khai báo';
              final invoiceEmail = regData?['invoiceEmail'] ?? 'Chưa khai báo';
              final shippingMethods = regData?['shippingMethods'] is List ? (regData!['shippingMethods'] as List).join(', ') : 'Nhanh ⚡, Tiết kiệm 📦';

              return Container(
                constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.88),
                padding: const EdgeInsets.all(20),
                decoration: const BoxDecoration(
                  color: AdminTheme.card,
                  borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
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
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(color: AdminTheme.surfaceSubtle, borderRadius: BorderRadius.circular(10)),
                              child: const Icon(Icons.assignment_ind_outlined, color: AdminTheme.primary, size: 20),
                            ),
                            const SizedBox(width: 10),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('Hồ Sơ KYC Gian Hàng', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AdminTheme.textPrimary)),
                                Text('$shopName · ID #$shopId (v$version)', style: const TextStyle(fontSize: 11.5, color: AdminTheme.textSecondary)),
                              ],
                            ),
                          ],
                        ),
                        IconButton(icon: const Icon(Icons.close, size: 20), onPressed: () => Navigator.pop(ctx)),
                      ],
                    ),
                    const Divider(color: AdminTheme.border, height: 20),
                    Expanded(
                      child: isLoading
                          ? const Center(child: CircularProgressIndicator(color: AdminTheme.primary))
                          : ListView(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(14),
                                  decoration: BoxDecoration(
                                    color: AdminTheme.surfaceSubtle,
                                    borderRadius: BorderRadius.circular(14),
                                    border: Border.all(color: AdminTheme.border),
                                  ),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      const Text('THÔNG TIN ĐỊNH DANH PHÁP LÝ', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AdminTheme.primary)),
                                      const SizedBox(height: 8),
                                      _kycRow('Loại hình kinh doanh:', busType),
                                      _kycRow('Người đại diện / Chủ shop:', ownerName.toString()),
                                      _kycRow('Số CMND / CCCD:', maskedId),
                                      _kycRow('Mã số thuế:', taxCode.toString()),
                                      _kycRow('Email hóa đơn điện tử:', invoiceEmail.toString()),
                                      _kycRow('Đơn vị vận chuyển:', shippingMethods),
                                      _kycRow('Địa chỉ kho / liên hệ:', shop['address']?.toString() ?? 'Chưa cập nhật'),
                                      _kycRow('Tỉnh / Thành phố:', shop['location']?.toString() ?? 'TP. Hồ Chí Minh'),
                                    ],
                                  ),
                                ),
                                const SizedBox(height: 14),
                                const Text('LỊCH SỬ XÉT DUYỆT GIAN HÀNG', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AdminTheme.textSecondary)),
                                const SizedBox(height: 8),
                                if (events.isEmpty)
                                  Container(
                                    padding: const EdgeInsets.all(12),
                                    decoration: BoxDecoration(color: AdminTheme.card, borderRadius: BorderRadius.circular(12), border: Border.all(color: AdminTheme.border)),
                                    child: const Text('Chưa có sự kiện xét duyệt nào được ghi nhận trước đây.', style: TextStyle(fontSize: 12, color: AdminTheme.textSecondary)),
                                  )
                                else
                                  ...events.map((evt) {
                                    final action = evt['action']?.toString() ?? 'submitted';
                                    final actionLabel = action == 'approved' ? 'Đã phê duyệt' : action == 'rejected' ? 'Bị từ chối' : action == 'resubmitted' ? 'Gửi lại hồ sơ' : 'Nộp hồ sơ';
                                    final actionColor = action == 'approved' ? AdminTheme.success : action == 'rejected' ? AdminTheme.danger : Colors.amber.shade800;
                                    final time = evt['createdAt']?.toString() ?? '';
                                    final comment = evt['comment']?.toString() ?? '';

                                    return Container(
                                      margin: const EdgeInsets.only(bottom: 8),
                                      padding: const EdgeInsets.all(12),
                                      decoration: BoxDecoration(color: AdminTheme.card, borderRadius: BorderRadius.circular(12), border: Border.all(color: AdminTheme.border)),
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Row(
                                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                            children: [
                                              Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                                decoration: BoxDecoration(color: actionColor.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(6)),
                                                child: Text(actionLabel, style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: actionColor)),
                                              ),
                                              Text(time, style: const TextStyle(fontSize: 10.5, color: AdminTheme.textSecondary)),
                                            ],
                                          ),
                                          if (comment.isNotEmpty) ...[
                                            const SizedBox(height: 6),
                                            Text('Ghi chú: $comment', style: const TextStyle(fontSize: 12, color: AdminTheme.textPrimary)),
                                          ],
                                        ],
                                      ),
                                    );
                                  }),
                              ],
                            ),
                    ),
                    const Divider(color: AdminTheme.border, height: 20),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            style: OutlinedButton.styleFrom(
                              foregroundColor: AdminTheme.danger,
                              side: const BorderSide(color: AdminTheme.danger),
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            onPressed: () {
                              Navigator.pop(ctx);
                              _promptRejectShop(shopId, version, shopName);
                            },
                            child: const Text('✕ Từ chối duyệt...'),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AdminTheme.success,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            onPressed: () {
                              Navigator.pop(ctx);
                              _approveShop(shopId, version, isApproved: true);
                            },
                            child: const Text('✓ Phê duyệt KYC'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              );
            },
          );
        },
      ),
    );
  }

  Widget _kycRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3.5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 140, child: Text(label, style: const TextStyle(fontSize: 11.5, color: AdminTheme.textSecondary))),
          Expanded(child: Text(value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AdminTheme.textPrimary))),
        ],
      ),
    );
  }

  // MODAL 7: LỊCH SỬ VI PHẠM GIAN HÀNG
  Future<void> _showShopViolationsModal(Map<String, dynamic> shop) async {
    final shopId = shop['id']?.toString() ?? '';
    final shopName = shop['name']?.toString() ?? 'Gian hàng';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => FutureBuilder<ApiResponse>(
        future: _client.get('/api/v1/admin/shops/$shopId/violations'),
        builder: (context, snapshot) {
          final isLoading = snapshot.connectionState == ConnectionState.waiting;
          List<Map<String, dynamic>> violations = [];
          if (snapshot.hasData && snapshot.data!.success && snapshot.data!.data is List) {
            violations = List<Map<String, dynamic>>.from(snapshot.data!.data as List);
          }

          return Container(
            constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.8),
            padding: const EdgeInsets.all(20),
            decoration: const BoxDecoration(
              color: AdminTheme.card,
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
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
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(10)),
                          child: const Icon(Icons.warning_amber_rounded, color: AdminTheme.danger, size: 20),
                        ),
                        const SizedBox(width: 10),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Lịch Sử Vi Phạm Gian Hàng', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AdminTheme.textPrimary)),
                            Text('$shopName · ${violations.length} vi phạm đã ghi nhận', style: const TextStyle(fontSize: 11.5, color: AdminTheme.textSecondary)),
                          ],
                        ),
                      ],
                    ),
                    IconButton(icon: const Icon(Icons.close, size: 20), onPressed: () => Navigator.pop(ctx)),
                  ],
                ),
                const Divider(color: AdminTheme.border, height: 20),
                Expanded(
                  child: isLoading
                      ? const Center(child: CircularProgressIndicator(color: AdminTheme.primary))
                      : violations.isEmpty
                          ? const Center(
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.verified_user_outlined, size: 48, color: AdminTheme.success),
                                  SizedBox(height: 8),
                                  Text('Gian hàng chưa có vi phạm nào.', style: TextStyle(color: AdminTheme.textSecondary)),
                                ],
                              ),
                            )
                          : ListView.separated(
                              itemCount: violations.length,
                              separatorBuilder: (_, __) => const SizedBox(height: 10),
                              itemBuilder: (ctx, idx) {
                                final v = violations[idx];
                                final vId = v['id']?.toString() ?? '';
                                final reason = v['reason']?.toString() ?? 'Vi phạm chính sách';
                                final actionTaken = v['actionTaken']?.toString() ?? 'Cảnh cáo';
                                final emailStatus = v['emailStatus']?.toString() ?? 'pending';

                                return Container(
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: AdminTheme.surfaceSubtle,
                                    borderRadius: BorderRadius.circular(14),
                                    border: Border.all(color: AdminTheme.border),
                                  ),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        children: [
                                          Text('Vi phạm #$vId · $actionTaken', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AdminTheme.danger)),
                                          _statusPill(emailStatus == 'sent' ? 'active' : emailStatus == 'failed' ? 'suspended' : 'pending'),
                                        ],
                                      ),
                                      const SizedBox(height: 6),
                                      Text('Lý do: $reason', style: const TextStyle(fontSize: 12, color: AdminTheme.textPrimary)),
                                      const SizedBox(height: 8),
                                      Align(
                                        alignment: Alignment.centerRight,
                                        child: OutlinedButton.icon(
                                          style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4), minimumSize: Size.zero),
                                          icon: const Icon(Icons.mail_outline_rounded, size: 14),
                                          label: const Text('Gửi lại email cảnh cáo', style: TextStyle(fontSize: 11)),
                                          onPressed: () => _retryViolationEmail(vId),
                                        ),
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
        },
      ),
    );
  }

  Future<void> _retryViolationEmail(String violationId) async {
    final res = await _client.post('/api/v1/admin/violations/$violationId/retry-email');
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(res.message.isNotEmpty ? res.message : (res.success ? 'Đã gửi lại email thành công!' : 'Gửi email thất bại.')),
          backgroundColor: res.success ? AdminTheme.success : AdminTheme.danger,
        ),
      );
    }
  }

  // MODAL 1: XEM CHI TIẾT SẢN PHẨM & BỘ 4 ẢNH THỰC TẾ
  void _showProductPreviewModal(Map<String, dynamic> product) {
    final pId = product['id']?.toString() ?? '';
    final name = product['name']?.toString() ?? 'Sản phẩm';
    final price = double.tryParse(product['price']?.toString() ?? '0') ?? 0;
    final origPrice = double.tryParse(product['originalPrice']?.toString() ?? '0') ?? 0;
    final stock = product['stock'] ?? 0;
    final sold = product['sold'] ?? 0;
    final desc = product['description']?.toString() ?? 'Chưa có mô tả chi tiết cho sản phẩm này.';
    final category = product['categoryName']?.toString() ?? product['category']?.toString() ?? 'Ngành hàng';
    final shopName = product['shopName']?.toString() ?? 'Shop';
    final approvalStatus = product['approvalStatus']?.toString() ?? 'pending';
    final isFlashSale = product['isFlashSale'] == true;

    List<String> images = [];
    if (product['images'] is List) {
      for (final img in product['images'] as List) {
        if (img is String) images.add(img);
        if (img is Map && img['url'] != null) images.add(img['url'].toString());
      }
    }
    if (images.isEmpty && product['imageUrl'] != null) {
      images.add(product['imageUrl'].toString());
    }

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.9),
        padding: const EdgeInsets.all(20),
        decoration: const BoxDecoration(
          color: AdminTheme.card,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
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
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(color: AdminTheme.surfaceSubtle, borderRadius: BorderRadius.circular(10)),
                      child: const Icon(Icons.inventory_2_outlined, color: AdminTheme.primary, size: 20),
                    ),
                    const SizedBox(width: 10),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Chi Tiết & Kiểm Duyệt Sản Phẩm', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AdminTheme.textPrimary)),
                        Text('Mã ID #$pId · Gian hàng: $shopName', style: const TextStyle(fontSize: 11.5, color: AdminTheme.textSecondary)),
                      ],
                    ),
                  ],
                ),
                IconButton(icon: const Icon(Icons.close, size: 20), onPressed: () => Navigator.pop(ctx)),
              ],
            ),
            const Divider(color: AdminTheme.border, height: 20),
            Expanded(
              child: ListView(
                children: [
                  Text('BỘ ${images.length} ẢNH THỰC TẾ CỦA SẢN PHẨM', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AdminTheme.primary)),
                  const SizedBox(height: 8),
                  if (images.isEmpty)
                    Container(
                      height: 120,
                      decoration: BoxDecoration(color: AdminTheme.surfaceSubtle, borderRadius: BorderRadius.circular(12)),
                      child: const Center(child: Text('Sản phẩm chưa có ảnh tải lên.', style: TextStyle(color: AdminTheme.textSecondary))),
                    )
                  else
                    SizedBox(
                      height: 120,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: images.length,
                        separatorBuilder: (_, __) => const SizedBox(width: 10),
                        itemBuilder: (ctx, idx) {
                          return ClipRRect(
                            borderRadius: BorderRadius.circular(12),
                            child: Container(
                              width: 120,
                              height: 120,
                              color: AdminTheme.surfaceSubtle,
                              child: Image.network(
                                images[idx],
                                fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) => const Icon(Icons.image_not_supported_outlined, color: AdminTheme.textSecondary),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  const SizedBox(height: 14),
                  Text(name, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AdminTheme.textPrimary)),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      _statusPill(approvalStatus),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(color: AdminTheme.surfaceSubtle, borderRadius: BorderRadius.circular(6)),
                        child: Text(category, style: const TextStyle(fontSize: 11, color: AdminTheme.textSecondary, fontWeight: FontWeight.bold)),
                      ),
                      if (isFlashSale) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(color: Colors.amber.shade100, borderRadius: BorderRadius.circular(6)),
                          child: Row(
                            children: [
                              Icon(Icons.bolt, size: 12, color: Colors.amber.shade900),
                              Text('FLASH SALE', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.amber.shade900)),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 14),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AdminTheme.surfaceSubtle,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: AdminTheme.border),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceAround,
                      children: [
                        Column(
                          children: [
                            const Text('Giá bán', style: TextStyle(fontSize: 10.5, color: AdminTheme.textSecondary)),
                            const SizedBox(height: 2),
                            Text(_currencyFormat.format(price), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AdminTheme.primary)),
                          ],
                        ),
                        if (origPrice > 0)
                          Column(
                            children: [
                              const Text('Giá niêm yết', style: TextStyle(fontSize: 10.5, color: AdminTheme.textSecondary)),
                              const SizedBox(height: 2),
                              Text(_currencyFormat.format(origPrice), style: const TextStyle(fontSize: 12, decoration: TextDecoration.lineThrough, color: AdminTheme.textSecondary)),
                            ],
                          ),
                        Column(
                          children: [
                            const Text('Tồn kho', style: TextStyle(fontSize: 10.5, color: AdminTheme.textSecondary)),
                            const SizedBox(height: 2),
                            Text('$stock', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AdminTheme.textPrimary)),
                          ],
                        ),
                        Column(
                          children: [
                            const Text('Đã bán', style: TextStyle(fontSize: 10.5, color: AdminTheme.textSecondary)),
                            const SizedBox(height: 2),
                            Text('$sold', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AdminTheme.textPrimary)),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  const Text('MÔ TẢ SẢN PHẨM TỪ NGƯỜI BÁN', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AdminTheme.primary)),
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AdminTheme.card,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AdminTheme.border),
                    ),
                    child: Text(desc, style: const TextStyle(fontSize: 12.5, color: AdminTheme.textPrimary, height: 1.4)),
                  ),
                ],
              ),
            ),
            const Divider(color: AdminTheme.border, height: 20),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AdminTheme.danger,
                      side: const BorderSide(color: AdminTheme.danger),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    onPressed: () {
                      Navigator.pop(ctx);
                      _promptRejectProduct(pId, name);
                    },
                    child: const Text('✕ Từ chối duyệt...'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AdminTheme.success,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    onPressed: () {
                      Navigator.pop(ctx);
                      _updateProductApproval(pId, 'approved');
                    },
                    child: const Text('✓ Duyệt sản phẩm'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // MODAL 5: CHI TIẾT & XỬ LÝ BÁO CÁO VI PHẠM
  void _showReportDetailModal(Map<String, dynamic> report) {
    final repId = report['id']?.toString() ?? '';
    final reason = report['reason']?.toString() ?? 'Vi phạm nội dung';
    final details = report['details']?.toString() ?? '';
    final targetName = report['targetName']?.toString() ?? 'Đối tượng bị báo cáo';
    final targetType = report['targetType']?.toString() ?? 'product';
    final targetId = report['targetId']?.toString() ?? '';
    final reporter = report['reporterUsername']?.toString() ?? report['reporterName']?.toString() ?? 'Người dùng';
    final status = report['status']?.toString() ?? 'open';
    final evidenceUrl = report['evidenceUrl']?.toString();
    final shopId = report['shopId']?.toString();
    final violationId = report['violationId']?.toString() ?? repId;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.9),
        padding: const EdgeInsets.all(20),
        decoration: const BoxDecoration(
          color: AdminTheme.card,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
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
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(10)),
                      child: const Icon(Icons.flag_outlined, color: AdminTheme.danger, size: 20),
                    ),
                    const SizedBox(width: 10),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Báo Cáo Vi Phạm #$repId', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AdminTheme.textPrimary)),
                        Text('Người gửi: @$reporter', style: const TextStyle(fontSize: 11.5, color: AdminTheme.textSecondary)),
                      ],
                    ),
                  ],
                ),
                IconButton(icon: const Icon(Icons.close, size: 20), onPressed: () => Navigator.pop(ctx)),
              ],
            ),
            const Divider(color: AdminTheme.border, height: 20),
            Expanded(
              child: ListView(
                children: [
                  _statusPill(status),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: AdminTheme.surfaceSubtle, borderRadius: BorderRadius.circular(14), border: Border.all(color: AdminTheme.border)),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('ĐỐI TƯỢNG BỊ KHIẾU NẠI', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: AdminTheme.primary)),
                        const SizedBox(height: 4),
                        Text(targetName, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.bold, color: AdminTheme.textPrimary)),
                        const SizedBox(height: 2),
                        Text('Loại: $targetType · ID: #$targetId', style: const TextStyle(fontSize: 11, color: AdminTheme.textSecondary)),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: AdminTheme.card, borderRadius: BorderRadius.circular(14), border: Border.all(color: AdminTheme.border)),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('LÝ DO KHIẾU NẠI', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: AdminTheme.primary)),
                        const SizedBox(height: 4),
                        Text(reason, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AdminTheme.danger)),
                        if (details.isNotEmpty) ...[
                          const SizedBox(height: 6),
                          Text(details, style: const TextStyle(fontSize: 12, color: AdminTheme.textPrimary, height: 1.35)),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  if (evidenceUrl != null && evidenceUrl.isNotEmpty) ...[
                    const Text('HÌNH ẢNH BẰNG CHỨNG', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: AdminTheme.primary)),
                    const SizedBox(height: 6),
                    GestureDetector(
                      onTap: () => _showZoomImageDialog(evidenceUrl),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(12),
                        child: Container(
                          height: 160,
                          width: double.infinity,
                          color: AdminTheme.surfaceSubtle,
                          child: Stack(
                            alignment: Alignment.center,
                            children: [
                              Image.network(evidenceUrl, fit: BoxFit.cover, width: double.infinity, height: 160),
                              Positioned(
                                bottom: 8,
                                right: 8,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(6)),
                                  child: const Row(
                                    children: [
                                      Icon(Icons.zoom_in, color: Colors.white, size: 14),
                                      SizedBox(width: 4),
                                      Text('Chạm để phóng to', style: TextStyle(color: Colors.white, fontSize: 11)),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),
                  ],
                  if (shopId != null && shopId.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: OutlinedButton.icon(
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AdminTheme.danger,
                          side: const BorderSide(color: AdminTheme.danger),
                        ),
                        icon: const Icon(Icons.lock_outline_rounded, size: 16),
                        label: const Text('Tạm khóa Shop bị khiếu nại này'),
                        onPressed: () {
                          Navigator.pop(ctx);
                          _promptSuspendShop(shopId, targetName);
                        },
                      ),
                    ),
                ],
              ),
            ),
            const Divider(color: AdminTheme.border, height: 20),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () {
                      Navigator.pop(ctx);
                      _updateReportStatus(repId, 'dismissed');
                    },
                    style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 12)),
                    child: const Text('Bác bỏ'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton(
                    onPressed: () {
                      Navigator.pop(ctx);
                      _updateReportStatus(repId, 'investigating');
                    },
                    style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 12)),
                    child: const Text('Đang điều tra'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  flex: 2,
                  child: ElevatedButton(
                    onPressed: () {
                      Navigator.pop(ctx);
                      _updateReportStatus(repId, 'confirmed_violation');
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AdminTheme.danger,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    child: const Text('Xác nhận vi phạm'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _showZoomImageDialog(String imageUrl) {
    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: Colors.black87,
        insetPadding: const EdgeInsets.all(12),
        child: Stack(
          children: [
            Center(
              child: InteractiveViewer(
                minScale: 0.5,
                maxScale: 4.0,
                child: Image.network(imageUrl, fit: BoxFit.contain),
              ),
            ),
            Positioned(
              top: 10,
              right: 10,
              child: IconButton(
                icon: const Icon(Icons.close, color: Colors.white, size: 24),
                onPressed: () => Navigator.pop(ctx),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // CHI TIẾT ĐƠN HÀNG DÀNH CHO ADMIN
  void _showOrderDetailModal(Map<String, dynamic> order) {
    final orderId = order['id']?.toString() ?? '';
    final code = order['code']?.toString() ?? orderId;
    final status = order['status']?.toString() ?? 'pending';
    final buyer = order['buyerName']?.toString() ?? order['customerName']?.toString() ?? 'Khách hàng';
    final phone = order['phone']?.toString() ?? order['buyerPhone']?.toString() ?? '';
    final address = order['shippingAddress']?.toString() ?? 'Chưa cập nhật địa chỉ giao hàng';
    final total = double.tryParse(order['totalAmount']?.toString() ?? '0') ?? 0;
    final shippingFee = double.tryParse(order['shippingFee']?.toString() ?? '0') ?? 0;
    final shippingUnit = order['shippingUnit']?.toString() ?? 'Giao hàng Tiêu chuẩn';
    final payment = order['payment']?.toString() ?? 'COD';
    final items = order['items'] is List ? (order['items'] as List) : [];

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setModalState) => Container(
          constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.88),
          padding: const EdgeInsets.all(20),
          decoration: const BoxDecoration(
            color: AdminTheme.card,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
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
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(color: AdminTheme.surfaceSubtle, borderRadius: BorderRadius.circular(10)),
                        child: const Icon(Icons.receipt_long_outlined, color: AdminTheme.primary, size: 20),
                      ),
                      const SizedBox(width: 10),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Đơn Hàng #$code', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AdminTheme.textPrimary)),
                          Text('Khách: $buyer ${phone.isNotEmpty ? "· $phone" : ""}', style: const TextStyle(fontSize: 11.5, color: AdminTheme.textSecondary)),
                        ],
                      ),
                    ],
                  ),
                  IconButton(icon: const Icon(Icons.close, size: 20), onPressed: () => Navigator.pop(ctx)),
                ],
              ),
              const Divider(color: AdminTheme.border, height: 20),
              Expanded(
                child: ListView(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(color: AdminTheme.surfaceSubtle, borderRadius: BorderRadius.circular(12), border: Border.all(color: AdminTheme.border)),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('ĐỊA CHỈ NHẬN HÀNG', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: AdminTheme.primary)),
                          const SizedBox(height: 4),
                          Text(address, style: const TextStyle(fontSize: 12, color: AdminTheme.textPrimary)),
                          const SizedBox(height: 6),
                          Text('Đơn vị vận chuyển: $shippingUnit (Phí: ${_currencyFormat.format(shippingFee)})', style: const TextStyle(fontSize: 11, color: AdminTheme.textSecondary)),
                          Text('Phương thức thanh toán: $payment', style: const TextStyle(fontSize: 11, color: AdminTheme.textSecondary)),
                        ],
                      ),
                    ),
                    const SizedBox(height: 14),
                    const Text('SẢN PHẨM TRONG ĐƠN', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AdminTheme.primary)),
                    const SizedBox(height: 8),
                    if (items.isEmpty)
                      const Text('Chi tiết sản phẩm đang được cập nhật.', style: TextStyle(color: AdminTheme.textSecondary, fontSize: 12))
                    else
                      ...items.map((i) {
                        final iName = i['name']?.toString() ?? 'Sản phẩm';
                        final iQty = i['quantity'] ?? 1;
                        final iPrice = double.tryParse(i['price']?.toString() ?? '0') ?? 0;
                        return Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(color: AdminTheme.card, borderRadius: BorderRadius.circular(12), border: Border.all(color: AdminTheme.border)),
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(iName, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: AdminTheme.textPrimary)),
                                    const SizedBox(height: 2),
                                    Text('x$iQty · ${_currencyFormat.format(iPrice)}', style: const TextStyle(fontSize: 11, color: AdminTheme.textSecondary)),
                                  ],
                                ),
                              ),
                              Text(_currencyFormat.format(iPrice * iQty), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AdminTheme.primary)),
                            ],
                          ),
                        );
                      }),
                    const SizedBox(height: 10),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Tổng thanh toán:', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AdminTheme.textPrimary)),
                        Text(_currencyFormat.format(total), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AdminTheme.primary)),
                      ],
                    ),
                    const SizedBox(height: 16),
                    const Text('CẬP NHẬT TRẠNG THÁI ĐƠN HÀNG', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AdminTheme.primary)),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      value: status,
                      decoration: const InputDecoration(labelText: 'Trạng thái xử lý'),
                      items: const [
                        DropdownMenuItem(value: 'pending', child: Text('Chờ xác nhận')),
                        DropdownMenuItem(value: 'confirmed', child: Text('Đã xác nhận / Chuẩn bị hàng')),
                        DropdownMenuItem(value: 'shipping', child: Text('Đang giao hàng')),
                        DropdownMenuItem(value: 'delivered', child: Text('Đã giao thành công')),
                        DropdownMenuItem(value: 'cancelled', child: Text('Đã hủy đơn hàng')),
                      ],
                      onChanged: (newSt) async {
                        if (newSt != null && newSt != status) {
                          Navigator.pop(ctx);
                          final res = await _client.patch('/api/v1/admin/orders/$orderId/status', body: {'status': newSt});
                          if (mounted) {
                            if (res.success) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text('Đã cập nhật đơn hàng thành "$newSt"'), backgroundColor: AdminTheme.success),
                              );
                              _fetchOrders();
                            } else {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text(res.message.isNotEmpty ? res.message : 'Lỗi cập nhật.'), backgroundColor: AdminTheme.danger),
                              );
                            }
                          }
                        }
                      },
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // MODAL QUẢN TRỊ TÀI KHOẢN NGƯỜI DÙNG
  void _showUserRoleDialog(Map<String, dynamic> user) {
    final uId = user['id']?.toString() ?? '';
    final username = user['username']?.toString() ?? '';
    final fullName = user['fullName']?.toString() ?? username;
    final email = user['email']?.toString() ?? '—';
    final role = user['role']?.toString() ?? 'customer';
    final status = user['status']?.toString() ?? 'active';

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AdminTheme.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(color: AdminTheme.surfaceSubtle, borderRadius: BorderRadius.circular(10)),
              child: const Icon(Icons.manage_accounts_outlined, color: AdminTheme.primary, size: 20),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Quản Trị Tài Khoản', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AdminTheme.textPrimary)),
                  Text('@$username · #$uId', style: const TextStyle(fontSize: 11.5, color: AdminTheme.textSecondary)),
                ],
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Họ và tên: $fullName', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AdminTheme.textPrimary)),
            Text('Email: $email', style: const TextStyle(fontSize: 12, color: AdminTheme.textSecondary)),
            const SizedBox(height: 12),
            Row(
              children: [
                const Text('Vai trò: ', style: TextStyle(fontSize: 12, color: AdminTheme.textSecondary)),
                _statusPill(role),
                const SizedBox(width: 10),
                const Text('Trạng thái: ', style: TextStyle(fontSize: 12, color: AdminTheme.textSecondary)),
                _statusPill(status),
              ],
            ),
            const Divider(color: AdminTheme.border, height: 24),
            const Text('HÀNH ĐỘNG:', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AdminTheme.primary)),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: status == 'active' ? AdminTheme.danger : AdminTheme.success,
                  foregroundColor: Colors.white,
                ),
                icon: Icon(status == 'active' ? Icons.lock_outline_rounded : Icons.lock_open_rounded, size: 16),
                label: Text(status == 'active' ? 'Khóa tài khoản này' : 'Mở khóa tài khoản'),
                onPressed: () {
                  Navigator.pop(ctx);
                  _updateUserStatus(uId, status == 'active' ? 'blocked' : 'active');
                },
              ),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Đóng')),
        ],
      ),
    );
  }

  Widget _alertItem(String text, String cta, VoidCallback onTap) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Text(text, style: TextStyle(fontSize: 12, color: Colors.amber.shade900, fontWeight: FontWeight.w500)),
          ),
          InkWell(
            onTap: onTap,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(color: Colors.amber.shade200, borderRadius: BorderRadius.circular(6)),
              child: Text(cta, style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: Colors.amber.shade900)),
            ),
          ),
        ],
      ),
    );
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
          const NovaLogo(size: 28, fontSize: 16, subtitle: 'Cổng Quản Trị'),
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

    final pendingShopsCount = _shops.where((s) => s['approvalStatus'] == 'pending').length;
    final pendingProductsCount = _products.where((p) => (p['approvalStatus'] ?? 'pending') == 'pending').length;
    final openReportsCount = _reports.where((r) => r['status'] == 'open' || r['status'] == 'investigating').length;

    return RefreshIndicator(
      onRefresh: () async => _loadCurrentSection(),
      color: AdminTheme.primary,
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Thông báo công việc cần duyệt ngay (Chuẩn Shopee / NovaShop Web)
            if (pendingShopsCount > 0 || pendingProductsCount > 0 || openReportsCount > 0) ...[
              Container(
                margin: const EdgeInsets.only(bottom: 14),
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
                        Icon(Icons.notifications_active_rounded, color: Colors.amber.shade900, size: 18),
                        const SizedBox(width: 8),
                        Text(
                          'YÊU CẦU CẦN XỬ LÝ NGAY',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.amber.shade900),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    if (pendingShopsCount > 0)
                      _alertItem('Có $pendingShopsCount gian hàng mới nộp hồ sơ chờ duyệt KYC.', 'Duyệt Shop', () => setState(() { _selectedNavIndex = 1; _shopFilterTab = 'pending'; })),
                    if (pendingProductsCount > 0)
                      _alertItem('Có $pendingProductsCount sản phẩm mới nộp chờ kiểm duyệt.', 'Duyệt SP', () => setState(() { _selectedNavIndex = 3; _productFilterTab = 'pending'; })),
                    if (openReportsCount > 0)
                      _alertItem('Có $openReportsCount khiếu nại báo cáo vi phạm cần xác minh.', 'Xử lý', () => setState(() { _selectedNavIndex = 6; _reportFilterTab = 'open'; })),
                  ],
                ),
              ),
            ],

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
  // MODULE 2: QUẢN LÝ SHOP (SHOPS) - CHUẨN 100% ADMINPAGE.JSX
  // ============================================================

  Widget _buildShopsSection() {
    final filtered = _shops.where((s) {
      if (_searchQuery.isNotEmpty) {
        final name = (s['name']?.toString() ?? '').toLowerCase();
        final owner = (s['ownerUsername']?.toString() ?? s['ownerFullName']?.toString() ?? '').toLowerCase();
        if (!name.contains(_searchQuery.toLowerCase()) && !owner.contains(_searchQuery.toLowerCase())) return false;
      }
      if (_shopFilterTab == 'pending') return s['approvalStatus'] == 'pending';
      if (_shopFilterTab == 'active') return s['status'] == 'active' && s['approvalStatus'] == 'approved';
      if (_shopFilterTab == 'suspended') return s['status'] == 'suspended';
      if (_shopFilterTab == 'rejected') return s['approvalStatus'] == 'rejected';
      return true;
    }).toList();

    return Column(
      children: [
        // 5 Tabs giống hệt AdminPage.jsx
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
                _filterChip('rejected', 'Bị từ chối (${_shops.where((s) => s['approvalStatus'] == 'rejected').length})', _shopFilterTab, (k) => setState(() => _shopFilterTab = k)),
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
                    final owner = shop['ownerFullName']?.toString() ?? shop['ownerUsername']?.toString() ?? 'Chủ shop';
                    final ownerUsername = shop['ownerUsername']?.toString() ?? '';
                    final approvalStatus = shop['approvalStatus']?.toString() ?? 'pending';
                    final status = shop['status']?.toString() ?? 'active';
                    final version = shop['approvalVersion'] is int ? shop['approvalVersion'] as int : 1;
                    final location = shop['location']?.toString() ?? 'TP. Hồ Chí Minh';

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
                                width: 44,
                                height: 44,
                                decoration: BoxDecoration(
                                  color: AdminTheme.surfaceSubtle,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: AdminTheme.border),
                                ),
                                child: const Center(
                                  child: Icon(Icons.storefront_rounded, color: AdminTheme.primary, size: 24),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Expanded(
                                          child: Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AdminTheme.textPrimary)),
                                        ),
                                        Text('v$version', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AdminTheme.textSecondary)),
                                      ],
                                    ),
                                    const SizedBox(height: 2),
                                    Text('$owner · @$ownerUsername · $location', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11, color: AdminTheme.textSecondary)),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 6),
                              _statusPill(approvalStatus),
                            ],
                          ),
                          const Divider(color: AdminTheme.border, height: 18),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Row(
                                children: [
                                  TextButton.icon(
                                    style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: Size.zero),
                                    icon: const Icon(Icons.description_outlined, size: 14, color: AdminTheme.primary),
                                    label: const Text('Hồ sơ KYC', style: TextStyle(fontSize: 11, color: AdminTheme.primary, fontWeight: FontWeight.bold)),
                                    onPressed: () => _showShopKycModal(shop),
                                  ),
                                  const SizedBox(width: 12),
                                  TextButton.icon(
                                    style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: Size.zero),
                                    icon: const Icon(Icons.history_outlined, size: 14, color: AdminTheme.textSecondary),
                                    label: const Text('Vi phạm', style: TextStyle(fontSize: 11, color: AdminTheme.textSecondary)),
                                    onPressed: () => _showShopViolationsModal(shop),
                                  ),
                                ],
                              ),
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
                                      onPressed: () => _promptRejectShop(shopId, version, name),
                                      child: const Text('Từ chối', style: TextStyle(fontSize: 11)),
                                    ),
                                    const SizedBox(width: 8),
                                    ElevatedButton(
                                      style: ElevatedButton.styleFrom(
                                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                                        minimumSize: Size.zero,
                                        backgroundColor: AdminTheme.success,
                                        foregroundColor: Colors.white,
                                      ),
                                      onPressed: () => _approveShop(shopId, version, isApproved: true),
                                      child: const Text('Duyệt KYC', style: TextStyle(fontSize: 11)),
                                    ),
                                  ] else ...[
                                    OutlinedButton(
                                      style: OutlinedButton.styleFrom(
                                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                        minimumSize: Size.zero,
                                        foregroundColor: status == 'active' ? AdminTheme.danger : AdminTheme.success,
                                        side: BorderSide(color: status == 'active' ? AdminTheme.danger : AdminTheme.success),
                                      ),
                                      onPressed: () => status == 'active' ? _promptSuspendShop(shopId, name) : _updateShopStatus(shopId, 'active'),
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
  // MODULE 3: QUẢN LÝ NGƯỜI DÙNG (USERS) - CHUẨN 100% ADMINPAGE.JSX
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
                    final email = u['email']?.toString() ?? '';
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
                            width: 42,
                            height: 42,
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
                                Text('@$username ${email.isNotEmpty ? "· $email" : ""}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11, color: AdminTheme.textSecondary)),
                                const SizedBox(height: 2),
                                Row(
                                  children: [
                                    _statusPill(role),
                                    const SizedBox(width: 6),
                                    _statusPill(status),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          Column(
                            children: [
                              TextButton(
                                style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: Size.zero),
                                onPressed: () => _showUserRoleDialog(u),
                                child: const Text('Quản lý', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AdminTheme.primary)),
                              ),
                              const SizedBox(height: 4),
                              OutlinedButton(
                                style: OutlinedButton.styleFrom(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                  minimumSize: Size.zero,
                                  foregroundColor: status == 'active' ? AdminTheme.danger : AdminTheme.success,
                                  side: BorderSide(color: status == 'active' ? AdminTheme.danger : AdminTheme.success),
                                ),
                                onPressed: () => _updateUserStatus(userId, status == 'active' ? 'blocked' : 'active'),
                                child: Text(status == 'active' ? 'Khóa' : 'Mở', style: const TextStyle(fontSize: 10.5)),
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
  // MODULE 4: QUẢN LÝ SẢN PHẨM (PRODUCTS) - CHUẨN 100% ADMINPAGE.JSX
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
      if (_productFilterTab == 'draft_hidden') return p['status'] == 'hidden' || p['status'] == 'draft';
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
                _filterChip('draft_hidden', 'Bản nháp / Ẩn (${_products.where((p) => p['status'] == 'hidden' || p['status'] == 'draft').length})', _productFilterTab, (k) => setState(() => _productFilterTab = k)),
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
                    final shopName = p['shopName']?.toString() ?? 'Shop';

                    String? thumbUrl = p['imageUrl']?.toString();
                    if (thumbUrl == null && p['images'] is List && (p['images'] as List).isNotEmpty) {
                      final first = p['images'][0];
                      thumbUrl = first is String ? first : (first is Map ? first['url']?.toString() : null);
                    }

                    return Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AdminTheme.card,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AdminTheme.border),
                      ),
                      child: Row(
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(10),
                            child: Container(
                              width: 54,
                              height: 54,
                              color: AdminTheme.surfaceSubtle,
                              child: thumbUrl != null && thumbUrl.isNotEmpty
                                  ? Image.network(thumbUrl, fit: BoxFit.cover, errorBuilder: (_, __, ___) => const Icon(Icons.inventory_2_outlined, color: AdminTheme.textSecondary))
                                  : const Icon(Icons.inventory_2_outlined, color: AdminTheme.textSecondary),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: InkWell(
                              onTap: () => _showProductPreviewModal(p),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AdminTheme.textPrimary)),
                                  Text('$shopName · ${_currencyFormat.format(price)}', style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold, color: AdminTheme.primary)),
                                  const SizedBox(height: 2),
                                  Row(
                                    children: [
                                      _statusPill(approvalStatus),
                                      const SizedBox(width: 6),
                                      const Text('Xem chi tiết →', style: TextStyle(fontSize: 10.5, color: AdminTheme.primary, decoration: TextDecoration.underline)),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ),
                          IconButton(
                            icon: Icon(
                              p['isFlashSale'] == true ? Icons.bolt_rounded : Icons.bolt_outlined,
                              color: p['isFlashSale'] == true ? AdminTheme.warning : AdminTheme.textSecondary,
                              size: 20,
                            ),
                            tooltip: 'Flash Sale sàn',
                            onPressed: () => _toggleFlashSale(pId, p['isFlashSale'] == true),
                          ),
                          if (approvalStatus == 'pending') ...[
                            IconButton(
                              icon: const Icon(Icons.close, color: AdminTheme.danger, size: 20),
                              onPressed: () => _promptRejectProduct(pId, name),
                            ),
                            IconButton(
                              icon: const Icon(Icons.check, color: AdminTheme.success, size: 20),
                              onPressed: () => _updateProductApproval(pId, 'approved'),
                            ),
                          ],
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
  // MODULE 5: QUẢN LÝ ĐƠN HÀNG (ORDERS) - CHUẨN 100% ADMINPAGE.JSX
  // ============================================================

  Widget _buildOrdersSection() {
    final filtered = _orders.where((o) {
      if (_searchQuery.isNotEmpty) {
        final code = (o['code']?.toString() ?? o['id']?.toString() ?? '').toLowerCase();
        final buyer = (o['buyerName']?.toString() ?? o['customerName']?.toString() ?? '').toLowerCase();
        if (!code.contains(_searchQuery.toLowerCase()) && !buyer.contains(_searchQuery.toLowerCase())) return false;
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
                _filterChip('confirmed', 'Chờ lấy hàng', _orderFilterTab, (k) => setState(() => _orderFilterTab = k)),
                _filterChip('shipping', 'Đang giao', _orderFilterTab, (k) => setState(() => _orderFilterTab = k)),
                _filterChip('delivered', 'Đã giao', _orderFilterTab, (k) => setState(() => _orderFilterTab = k)),
                _filterChip('cancelled', 'Đã hủy', _orderFilterTab, (k) => setState(() => _orderFilterTab = k)),
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
              hintText: 'Tìm theo mã đơn hoặc người mua...',
              prefixIcon: const Icon(Icons.search, size: 18, color: AdminTheme.textSecondary),
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
                    final buyer = o['buyerName']?.toString() ?? o['customerName']?.toString() ?? 'Khách';

                    return InkWell(
                      onTap: () => _showOrderDetailModal(o),
                      borderRadius: BorderRadius.circular(16),
                      child: Container(
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
                                Text('Khách: $buyer', style: const TextStyle(fontSize: 11, color: AdminTheme.textSecondary)),
                                const SizedBox(height: 2),
                                Text(_currencyFormat.format(total), style: const TextStyle(fontSize: 12.5, color: AdminTheme.primary, fontWeight: FontWeight.bold)),
                              ],
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                _statusPill(status),
                                const SizedBox(height: 4),
                                const Text('Chi tiết →', style: TextStyle(fontSize: 11, color: AdminTheme.primary, fontWeight: FontWeight.bold)),
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

  // ============================================================
  // MODULE 6: DOANH THU (REVENUE) - CHUẨN 100% ADMINPAGE.JSX
  // ============================================================

  Widget _buildRevenueSection() {
    final revenue = double.tryParse(_stats?['revenue']?.toString() ?? '0') ?? 0;
    final commission = revenue * 0.05; // Hoa hồng sàn 5%
    final payoutEst = revenue * 0.95; // Quyết toán người bán

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
              boxShadow: [
                BoxShadow(color: AdminTheme.primary.withValues(alpha: 0.3), blurRadius: 10, offset: const Offset(0, 4)),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Tổng GMV Toàn Sàn ShopNova', style: TextStyle(color: Colors.white70, fontSize: 13)),
                const SizedBox(height: 4),
                Text(_currencyFormat.format(revenue), style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold)),
                const Divider(color: Colors.white24, height: 24),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Hoa hồng sàn (5%):', style: TextStyle(color: Colors.white70, fontSize: 11)),
                        Text(_currencyFormat.format(commission), style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold)),
                      ],
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        const Text('Quyết toán cho Shop:', style: TextStyle(color: Colors.white70, fontSize: 11)),
                        Text(_currencyFormat.format(payoutEst), style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          const Text('PHÂN TÍCH TỶ LỆ ĐƠN HÀNG TOÀN SÀN', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AdminTheme.textSecondary, letterSpacing: 0.5)),
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
                _orderStatItem('Chờ xử lý', _orderStatusCounts?['pending'] ?? 0, AdminTheme.warning),
                _orderStatItem('Đang giao', _orderStatusCounts?['shipping'] ?? 0, AdminTheme.info),
                _orderStatItem('Hoàn tất', _orderStatusCounts?['delivered'] ?? 0, AdminTheme.success),
                _orderStatItem('Đã hủy', _orderStatusCounts?['cancelled'] ?? 0, AdminTheme.danger),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ============================================================
  // MODULE 7: BÁO CÁO VI PHẠM (REPORTS) - CHUẨN 100% ADMINPAGE.JSX
  // ============================================================

  Widget _buildReportsSection() {
    final filtered = _reports.where((r) {
      if (_searchQuery.isNotEmpty) {
        final reason = (r['reason']?.toString() ?? '').toLowerCase();
        final target = (r['targetName']?.toString() ?? '').toLowerCase();
        if (!reason.contains(_searchQuery.toLowerCase()) && !target.contains(_searchQuery.toLowerCase())) return false;
      }
      if (_reportFilterTab == 'open') return r['status'] == 'open';
      if (_reportFilterTab == 'investigating') return r['status'] == 'investigating';
      if (_reportFilterTab == 'confirmed_violation') return r['status'] == 'confirmed_violation';
      if (_reportFilterTab == 'dismissed') return r['status'] == 'dismissed';
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
                _filterChip('all', 'Tất cả (${_reports.length})', _reportFilterTab, (k) => setState(() => _reportFilterTab = k)),
                _filterChip('open', 'Chờ xử lý (${_reports.where((r) => r['status'] == 'open').length})', _reportFilterTab, (k) => setState(() => _reportFilterTab = k)),
                _filterChip('investigating', 'Đang xác minh (${_reports.where((r) => r['status'] == 'investigating').length})', _reportFilterTab, (k) => setState(() => _reportFilterTab = k)),
                _filterChip('confirmed_violation', 'Đã xác nhận (${_reports.where((r) => r['status'] == 'confirmed_violation').length})', _reportFilterTab, (k) => setState(() => _reportFilterTab = k)),
                _filterChip('dismissed', 'Bác bỏ (${_reports.where((r) => r['status'] == 'dismissed').length})', _reportFilterTab, (k) => setState(() => _reportFilterTab = k)),
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
              hintText: 'Tìm theo lý do hoặc đối tượng...',
              prefixIcon: const Icon(Icons.search, size: 18, color: AdminTheme.textSecondary),
            ),
          ),
        ),
        Expanded(
          child: filtered.isEmpty
              ? const Center(child: Text('Không có báo cáo vi phạm nào.', style: TextStyle(color: AdminTheme.textSecondary)))
              : ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  itemCount: filtered.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (ctx, idx) {
                    final rep = filtered[idx];
                    final repId = rep['id']?.toString() ?? '';
                    final reason = rep['reason']?.toString() ?? 'Vi phạm nội dung';
                    final targetName = rep['targetName']?.toString() ?? 'Đối tượng';
                    final status = rep['status']?.toString() ?? 'open';

                    return InkWell(
                      onTap: () => _showReportDetailModal(rep),
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
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text('Báo cáo #$repId', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                                _statusPill(status),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Text('Đối tượng: $targetName', style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold, color: AdminTheme.textPrimary)),
                            Text('Lý do: $reason', style: const TextStyle(fontSize: 12, color: AdminTheme.danger)),
                            const SizedBox(height: 8),
                            const Align(
                              alignment: Alignment.centerRight,
                              child: Text('Chi tiết & Xử lý →', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AdminTheme.primary)),
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

  // ============================================================
  // MODULE 8: CÀI ĐẶT HỆ THỐNG (SETTINGS) - CHUẨN 100% ADMINPAGE.JSX
  // ============================================================

  Widget _buildSettingsSection() {
    final emailConfigured = _emailStatus?['configured'] == true;
    final emailHost = _emailStatus?['host']?.toString() ?? 'Chưa cấu hình';
    final emailPort = _emailStatus?['port']?.toString() ?? '—';
    final emailFrom = _emailStatus?['from']?.toString() ?? '—';

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
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Máy Chủ API & Hạ Tầng', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AdminTheme.textPrimary)),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(color: Colors.green.shade50, borderRadius: BorderRadius.circular(6)),
                      child: const Row(
                        children: [
                          Icon(Icons.check_circle, size: 12, color: AdminTheme.success),
                          SizedBox(width: 4),
                          Text('ONLINE', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AdminTheme.success)),
                        ],
                      ),
                    ),
                  ],
                ),
                const Divider(color: AdminTheme.border, height: 20),
                Text('Endpoint Base URL: ${ApiConfig.baseUrl}', style: const TextStyle(fontSize: 12, color: AdminTheme.textPrimary, fontFamily: 'monospace')),
                const SizedBox(height: 6),
                const Text('Hệ quản trị CSDL: SQLite ShopNova Sync (Task 5553 & Task 6853)', style: TextStyle(fontSize: 12, color: AdminTheme.textSecondary)),
                const SizedBox(height: 6),
                const Text('Môi trường: Development / Production Sandbox', style: TextStyle(fontSize: 12, color: AdminTheme.textSecondary)),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Dịch vụ Email SMTP
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
                    const Text('Dịch Vụ Gửi Email (SMTP)', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AdminTheme.textPrimary)),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: emailConfigured ? Colors.green.shade50 : Colors.amber.shade50,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        emailConfigured ? '✓ ĐANG HOẠT ĐỘNG' : '⚠ CHƯA CẤU HÌNH',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: emailConfigured ? AdminTheme.success : Colors.amber.shade900,
                        ),
                      ),
                    ),
                  ],
                ),
                const Divider(color: AdminTheme.border, height: 20),
                Text('Máy chủ SMTP: $emailHost', style: const TextStyle(fontSize: 12, color: AdminTheme.textPrimary)),
                const SizedBox(height: 4),
                Text('Cổng Port: $emailPort', style: const TextStyle(fontSize: 12, color: AdminTheme.textPrimary)),
                const SizedBox(height: 4),
                Text('Địa chỉ gửi: $emailFrom', style: const TextStyle(fontSize: 12, color: AdminTheme.textPrimary)),
                const SizedBox(height: 10),
                OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(minimumSize: Size.zero, padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6)),
                  icon: const Icon(Icons.refresh, size: 14),
                  label: const Text('Kiểm tra lại kết nối SMTP', style: TextStyle(fontSize: 11)),
                  onPressed: () async {
                    await _fetchEmailStatus();
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Đã cập nhật trạng thái email server!'), backgroundColor: AdminTheme.success),
                      );
                    }
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Tỷ lệ hoa hồng sàn & Cài đặt hệ thống
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
                const Text('Cấu Hình Hoa Hồng Nền Tảng', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AdminTheme.textPrimary)),
                const Divider(color: AdminTheme.border, height: 20),
                const Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Tỷ lệ phí hoa hồng sàn (Commission):', style: TextStyle(fontSize: 12.5, color: AdminTheme.textPrimary)),
                    Text('5.0%', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AdminTheme.primary)),
                  ],
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.amber.shade50,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.amber.shade200),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Icons.info_outline, size: 18, color: Colors.amber.shade900),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Chưa có API lưu cấu hình runtime - Cấu hình hệ thống hiện được đọc trực tiếp từ biến môi trường máy chủ Backend. Tính năng lưu tùy biến trực tiếp từ App sẽ được kích hoạt khi Backend hỗ trợ.',
                          style: TextStyle(fontSize: 11.5, color: Colors.amber.shade900, height: 1.35),
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
