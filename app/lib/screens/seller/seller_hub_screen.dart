import 'package:flutter/material.dart';
import '../../models/order.dart';
import '../../services/auth_service.dart';
import '../../services/api_client.dart';
import '../../services/seller_order_service.dart';
import '../../services/seller_product_service.dart';
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

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadDashboard();
    _loadOrders();
    _loadProducts();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
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
    final nameCtrl = TextEditingController();
    final priceCtrl = TextEditingController();
    final stockCtrl = TextEditingController(text: '50');
    final descCtrl = TextEditingController();
    final imageCtrl = TextEditingController();
    bool isSubmitting = false;

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
                    const SizedBox(height: 12),
                    TextField(
                      controller: imageCtrl,
                      decoration: InputDecoration(
                        labelText: 'Link ảnh sản phẩm (URL)',
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

                                setModalState(() => isSubmitting = true);
                                var response = await _productService.createProduct(
                                  categoryId: '1',
                                  name: name,
                                  description: descCtrl.text.trim().isNotEmpty ? descCtrl.text.trim() : null,
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
                                      categoryId: '1',
                                      name: name,
                                      description: descCtrl.text.trim().isNotEmpty ? descCtrl.text.trim() : null,
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
                              child: p.imageUrl != null && p.imageUrl!.isNotEmpty
                                  ? Image.network(p.imageUrl!, fit: BoxFit.cover, errorBuilder: (_, __, ___) => const Icon(Icons.image, color: Colors.grey))
                                  : const Icon(Icons.image, color: Colors.grey),
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
}
