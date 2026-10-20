import 'package:flutter/material.dart';
import '../../models/order.dart';
import '../../services/api_client.dart';
import '../../services/seller_order_service.dart';
import '../../services/seller_product_service.dart';

/// Màn hình Kênh Người Bán / Seller Hub (Kết nối trực tiếp Backend API)
class SellerHubScreen extends StatefulWidget {
  const SellerHubScreen({super.key});

  @override
  State<SellerHubScreen> createState() => _SellerHubScreenState();
}

class _SellerHubScreenState extends State<SellerHubScreen> with SingleTickerProviderStateMixin {
  final Color primaryColor = const Color(0xFFEE4D2D);
  late TabController _tabController;

  final SellerOrderService _orderService = SellerOrderService();
  final SellerProductService _productService = SellerProductService();
  final ApiClient _client = ApiClient();

  // Dashboard Data
  Map<String, dynamic> _dashboard = {
    'revenue': 0,
    'pendingOrders': 0,
    'totalProducts': 0,
    'lowStockCount': 0,
  };
  bool _isLoadingDashboard = true;

  // Orders Data
  List<ShopOrder> _orders = [];
  bool _isLoadingOrders = true;
  String _selectedOrderStatus = '';

  // Products Data
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
                        IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(ctx)),
                      ],
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: nameCtrl,
                      decoration: InputDecoration(
                        labelText: 'Tên sản phẩm *',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
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
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
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
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
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
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: descCtrl,
                      maxLines: 3,
                      decoration: InputDecoration(
                        labelText: 'Mô tả chi tiết sản phẩm',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: primaryColor,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
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

                                // Nếu chưa có gian hàng hoặc 403, tự động kích hoạt gian hàng và thử lại
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
                                    const SnackBar(content: Text('Đăng sản phẩm thành công!'), backgroundColor: Colors.green),
                                  );
                                  _loadProducts();
                                  _loadDashboard();
                                } else if (mounted) {
                                  final errMsg = response.message.isNotEmpty
                                      ? response.message
                                      : 'Đăng sản phẩm thất bại. Vui lòng kiểm tra lại.';
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(content: Text(errMsg), backgroundColor: Colors.red),
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
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F5),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0.5,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.black87),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Row(
          children: [
            Icon(Icons.storefront, color: Color(0xFFEE4D2D), size: 22),
            SizedBox(width: 8),
            Text('Kênh Người Bán ShopNova', style: TextStyle(color: Colors.black87, fontWeight: FontWeight.bold, fontSize: 17)),
          ],
        ),
        bottom: TabBar(
          controller: _tabController,
          labelColor: primaryColor,
          unselectedLabelColor: Colors.grey.shade600,
          indicatorColor: primaryColor,
          indicatorWeight: 3,
          tabs: const [
            Tab(text: 'Tổng Quan'),
            Tab(text: 'Đơn Hàng'),
            Tab(text: 'Sản Phẩm'),
          ],
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
              icon: const Icon(Icons.add, color: Colors.white),
              label: const Text('Đăng Sản Phẩm', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              onPressed: _showAddProductDialog,
            )
          : null,
    );
  }

  // TAB 1: TỔNG QUAN
  Widget _buildDashboardTab() {
    if (_isLoadingDashboard) {
      return const Center(child: CircularProgressIndicator());
    }

    final revenue = (_dashboard['revenue'] as num?) ?? 0;
    final pendingOrders = (_dashboard['pendingOrders'] as num?) ?? 0;
    final totalProducts = (_dashboard['totalProducts'] as num?) ?? 0;
    final lowStock = (_dashboard['lowStockCount'] as num?) ?? 0;

    return RefreshIndicator(
      onRefresh: _loadDashboard,
      color: primaryColor,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Banner Chào Mừng Người Bán
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFFEE4D2D), Color(0xFFFF7337)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Trung Tâm Quản Lý Gian Hàng', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                SizedBox(height: 6),
                Text('Theo dõi số liệu bán hàng, xử lý đơn và quản lý kho theo thời gian thực.', style: TextStyle(color: Colors.white70, fontSize: 13)),
              ],
            ),
          ),
          const SizedBox(height: 16),
          // Chỉ Số Kinh Doanh
          Row(
            children: [
              Expanded(
                child: _buildMetricCard('Doanh Thu', _formatVND(revenue), Icons.monetization_on, Colors.green),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildMetricCard('Đơn Chờ Xử Lý', '$pendingOrders đơn', Icons.pending_actions, Colors.orange),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _buildMetricCard('Sản Phẩm Đang Bán', '$totalProducts sản phẩm', Icons.inventory_2_outlined, Colors.blue),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildMetricCard('Cảnh Báo Hết Hàng', '$lowStock SKU', Icons.warning_amber_rounded, Colors.redAccent),
              ),
            ],
          ),
          const SizedBox(height: 24),
          // Tiện Ích Nhanh Cho Seller
          const Text('Thao Tác Nhanh', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.black87)),
          const SizedBox(height: 12),
          Card(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            child: Column(
              children: [
                ListTile(
                  leading: const CircleAvatar(backgroundColor: Color(0xFFFBE9E7), child: Icon(Icons.add_box_outlined, color: Color(0xFFEE4D2D))),
                  title: const Text('Đăng bán sản phẩm mới', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                  subtitle: const Text('Tải ảnh và cấu hình biến thể sản phẩm'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () {
                    _tabController.animateTo(2);
                    _showAddProductDialog();
                  },
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const CircleAvatar(backgroundColor: Color(0xFFFFF3E0), child: Icon(Icons.local_shipping_outlined, color: Colors.orange)),
                  title: const Text('Xử lý đơn hàng đang chờ', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                  subtitle: const Text('Xác nhận và chuẩn bị hàng giao vận'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => _tabController.animateTo(1),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMetricCard(String label, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(label, style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
              Icon(icon, color: color, size: 20),
            ],
          ),
          const SizedBox(height: 10),
          Text(value, style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: color)),
        ],
      ),
    );
  }

  // TAB 2: QUẢN LÝ ĐƠN HÀNG
  Widget _buildOrdersTab() {
    return Column(
      children: [
        // Status filter bar
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
              ? const Center(child: CircularProgressIndicator())
              : _orders.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.inbox_outlined, size: 64, color: Colors.grey.shade400),
                          const SizedBox(height: 12),
                          const Text('Không có đơn hàng nào', style: TextStyle(color: Colors.grey, fontSize: 15)),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _loadOrders,
                      color: primaryColor,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(12),
                        itemCount: _orders.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 12),
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
        selectedColor: primaryColor.withValues(alpha: 0.15),
        labelStyle: TextStyle(
          color: isSelected ? primaryColor : Colors.black87,
          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
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
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Đơn hàng #${o.id}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
              _buildStatusBadge(o.status),
            ],
          ),
          const Divider(height: 16),
          ...o.items.map((it) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(it.productName, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
                          Text('${it.variantName} x${it.qty}', style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
                        ],
                      ),
                    ),
                    Text(_formatVND(it.lineTotal), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                  ],
                ),
              )),
          const Divider(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Tổng thu:', style: TextStyle(fontSize: 13, color: Colors.grey)),
              Text(_formatVND(o.totalAmount), style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold, fontSize: 15)),
            ],
          ),
          const SizedBox(height: 10),
          // Thao tác đổi trạng thái
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              if (o.status == 'pending')
                ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: primaryColor, foregroundColor: Colors.white),
                  onPressed: () => _updateOrderStatus(o.id, 'processing', 'Đang chuẩn bị hàng'),
                  child: const Text('Xác Nhận Đơn'),
                ),
              if (o.status == 'processing')
                ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: Colors.blue, foregroundColor: Colors.white),
                  onPressed: () => _updateOrderStatus(o.id, 'shipping', 'Đang giao hàng'),
                  child: const Text('Giao Đơn Cho Vận Chuyển'),
                ),
              if (o.status == 'shipping')
                ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: Colors.green, foregroundColor: Colors.white),
                  onPressed: () => _updateOrderStatus(o.id, 'delivered', 'Giao thành công'),
                  child: const Text('Hoàn Tất Đơn'),
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
        bg = Colors.orange.shade50;
        fg = Colors.orange.shade800;
        text = 'Chờ xác nhận';
        break;
      case 'processing':
        bg = Colors.blue.shade50;
        fg = Colors.blue.shade800;
        text = 'Đang đóng gói';
        break;
      case 'shipping':
        bg = Colors.purple.shade50;
        fg = Colors.purple.shade800;
        text = 'Đang giao';
        break;
      case 'delivered':
        bg = Colors.green.shade50;
        fg = Colors.green.shade800;
        text = 'Đã giao';
        break;
      case 'cancelled':
        bg = Colors.red.shade50;
        fg = Colors.red.shade800;
        text = 'Đã hủy';
        break;
      default:
        bg = Colors.grey.shade100;
        fg = Colors.black87;
        text = status;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(4)),
      child: Text(text, style: TextStyle(color: fg, fontSize: 11, fontWeight: FontWeight.bold)),
    );
  }

  // TAB 3: QUẢN LÝ SẢN PHẨM
  Widget _buildProductsTab() {
    return _isLoadingProducts
        ? const Center(child: CircularProgressIndicator())
        : _products.isEmpty
            ? Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.inventory_2_outlined, size: 64, color: Colors.grey.shade400),
                    const SizedBox(height: 12),
                    const Text('Gian hàng chưa có sản phẩm nào', style: TextStyle(color: Colors.grey, fontSize: 15)),
                    const SizedBox(height: 12),
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(backgroundColor: primaryColor, foregroundColor: Colors.white),
                      icon: const Icon(Icons.add),
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
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: Colors.grey.shade200),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 64,
                            height: 64,
                            decoration: BoxDecoration(
                              color: Colors.grey.shade100,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: p.imageUrl != null && p.imageUrl!.isNotEmpty
                                ? Image.network(p.imageUrl!, fit: BoxFit.cover, errorBuilder: (_, __, ___) => const Icon(Icons.image, color: Colors.grey))
                                : const Icon(Icons.image, color: Colors.grey),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(p.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                                const SizedBox(height: 4),
                                Text(
                                  p.minPrice == p.maxPrice ? _formatVND(p.minPrice) : '${_formatVND(p.minPrice)} - ${_formatVND(p.maxPrice)}',
                                  style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold, fontSize: 13),
                                ),
                                const SizedBox(height: 2),
                                Text('Kho: ${p.totalStock} sản phẩm', style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
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
}
