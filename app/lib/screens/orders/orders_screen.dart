import 'package:flutter/material.dart';
import '../../services/order_service.dart';

class OrdersScreen extends StatefulWidget {
  final int initialTabIndex;

  const OrdersScreen({super.key, this.initialTabIndex = 0});

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final Color primaryColor = const Color(0xFFEE4D2D);

  List<Map<String, dynamic>> _orders = [];
  bool _isLoadingOrders = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 5, vsync: this, initialIndex: widget.initialTabIndex);
    _loadOrders();
  }

  Future<void> _loadOrders() async {
    setState(() => _isLoadingOrders = true);
    final orders = await OrderService().fetchOrders();
    if (mounted) {
      setState(() {
        _orders = orders;
        _isLoadingOrders = false;
      });
    }
  }

  String _formatVND(num amount) {
    final str = amount.round().toString();
    final reg = RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))');
    return '${str.replaceAllMapped(reg, (Match m) => '${m[1]}.')}₫';
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
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
        title: const Text(
          'Đơn mua của tôi',
          style: TextStyle(color: Colors.black87, fontSize: 16, fontWeight: FontWeight.bold),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.black87),
            tooltip: 'Làm mới đơn hàng',
            onPressed: _loadOrders,
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          labelColor: primaryColor,
          unselectedLabelColor: Colors.grey[600],
          indicatorColor: primaryColor,
          labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
          unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.normal, fontSize: 13),
          tabs: const [
            Tab(text: 'Chờ xác nhận'),
            Tab(text: 'Chờ lấy hàng'),
            Tab(text: 'Đang giao'),
            Tab(text: 'Đã giao'),
            Tab(text: 'Đã hủy / Trả hàng'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildOrdersTab(
            filter: (s) => s == 'pending' || s == 'created' || s.isEmpty,
            emptyTitle: 'Chưa có đơn chờ xác nhận',
            emptySubtitle: 'Các đơn hàng vừa đặt sẽ xuất hiện tại đây khi chờ người bán phê duyệt.',
          ),
          _buildOrdersTab(
            filter: (s) => s == 'confirmed' || s == 'processing',
            emptyTitle: 'Chưa có đơn chờ lấy hàng',
            emptySubtitle: 'Đơn hàng đã được duyệt và đang trong quá trình đóng gói chuẩn bị giao.',
          ),
          _buildOrdersTab(
            filter: (s) => s == 'shipping' || s == 'in_transit',
            emptyTitle: 'Chưa có đơn hàng đang giao',
            emptySubtitle: 'Khi bưu tá nhận kiện hàng từ shop, đơn sẽ hiển thị tại mục này.',
          ),
          _buildOrdersTab(
            filter: (s) => s == 'delivered' || s == 'completed',
            emptyTitle: 'Chưa có đơn hàng đã giao',
            emptySubtitle: 'Các đơn hàng giao thành công sẽ hiển thị ở đây để bạn đánh giá sản phẩm.',
          ),
          _buildOrdersTab(
            filter: (s) => s == 'cancelled' || s == 'returned',
            emptyTitle: 'Chưa có đơn hàng bị hủy',
            emptySubtitle: 'Các đơn hàng hủy hoặc hoàn tiền sẽ được ghi nhận tại đây.',
          ),
        ],
      ),
    );
  }

  Widget _buildOrdersTab({
    required bool Function(String status) filter,
    required String emptyTitle,
    required String emptySubtitle,
  }) {
    if (_isLoadingOrders) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFFEE4D2D)));
    }

    final filteredOrders = _orders.where((o) {
      final s = (o['status'] ?? '').toString().toLowerCase();
      return filter(s);
    }).toList();

    return RefreshIndicator(
      onRefresh: _loadOrders,
      color: primaryColor,
      child: filteredOrders.isEmpty
          ? ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              children: [
                const SizedBox(height: 60),
                _buildEmptyOrdersState(emptyTitle, emptySubtitle),
              ],
            )
          : ListView.builder(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.symmetric(vertical: 8),
              itemCount: filteredOrders.length,
              itemBuilder: (context, index) => _buildDynamicOrderCard(filteredOrders[index]),
            ),
    );
  }

  Widget _buildEmptyOrdersState(String title, String subtitle) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 4, offset: const Offset(0, 2))
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.inventory_2_outlined, size: 56, color: Colors.grey.shade400),
          const SizedBox(height: 14),
          Text(
            title,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            subtitle,
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.grey, fontSize: 13, height: 1.4),
          ),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: _loadOrders,
            style: ElevatedButton.styleFrom(
              backgroundColor: primaryColor,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 10),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
            ),
            child: const Text('Làm mới danh sách', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  Widget _buildDynamicOrderCard(Map<String, dynamic> order) {
    final code = order['code'] ?? order['id'] ?? 'ORD';
    final totalAmount = order['totalAmount'] ?? order['total_amount'] ?? 0;
    final status = (order['status'] ?? 'pending').toString().toLowerCase();
    final createdAt = (order['createdAt'] ?? '').toString();
    List<dynamic> items = [];
    if (order['items'] is List && (order['items'] as List).isNotEmpty) {
      items = order['items'] as List;
    } else if (order['shopOrders'] is List) {
      for (final so in order['shopOrders'] as List) {
        if (so is Map && so['items'] is List) {
          items.addAll(so['items'] as List);
        }
      }
    }

    Color statusColor;
    String statusText;
    switch (status) {
      case 'confirmed':
      case 'processing':
        statusColor = Colors.blue;
        statusText = 'Đang chuẩn bị hàng';
        break;
      case 'shipping':
      case 'in_transit':
        statusColor = Colors.orange;
        statusText = 'Đang vận chuyển';
        break;
      case 'delivered':
      case 'completed':
        statusColor = Colors.green;
        statusText = 'Giao thành công';
        break;
      case 'cancelled':
      case 'returned':
        statusColor = Colors.red;
        statusText = 'Đã hủy';
        break;
      default:
        statusColor = primaryColor;
        statusText = 'Chờ shop xác nhận';
    }

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 4, offset: const Offset(0, 2))
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Order Header
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.grey[50],
              borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(Icons.receipt_long, color: Colors.blueGrey, size: 18),
                    const SizedBox(width: 8),
                    Text('Mã: #$code', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: statusColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    statusText,
                    style: TextStyle(color: statusColor, fontSize: 11, fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
          ),
          // Order Meta Date
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
            child: Text(
              createdAt.length >= 10 ? 'Ngày đặt: ${createdAt.substring(0, 10)}' : 'Hôm nay',
              style: const TextStyle(color: Colors.grey, fontSize: 11),
            ),
          ),
          // Order Items from DB
          if (items.isEmpty)
            Padding(
              padding: const EdgeInsets.all(12),
              child: Text(
                'Kiện hàng #$code',
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
              ),
            )
          else
            ...items.map((it) {
              final name = it['productName'] ?? it['product_name'] ?? 'Sản phẩm ShopNova';
              final variant = it['variantName'] ?? it['variant_name'] ?? 'Mặc định';
              final rawPrice = it['unitPrice'] ??
                  it['unit_price'] ??
                  it['price'] ??
                  it['lineTotal'] ??
                  it['line_total'];
              num parsedPrice = num.tryParse(rawPrice?.toString() ?? '') ?? 0;
              if (parsedPrice <= 0 && items.isNotEmpty && totalAmount > 0) {
                final num total = num.tryParse(totalAmount.toString()) ?? 0;
                final qtyNum = num.tryParse((it['qty'] ?? it['quantity'] ?? 1).toString()) ?? 1;
                parsedPrice = (total / items.length) / (qtyNum > 0 ? qtyNum : 1);
              }
              final price = _formatVND(parsedPrice);
              final qty = 'x${it['qty'] ?? it['quantity'] ?? 1}';
              final img = (it['imageUrl'] ?? it['image_url'] ?? it['image'] ?? '').toString();

              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 56,
                      height: 56,
                      decoration: BoxDecoration(
                        color: Colors.grey[100],
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: img.isNotEmpty && (img.startsWith('http://') || img.startsWith('https://'))
                          ? Image.network(
                              img,
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => const Icon(Icons.shopping_bag_outlined, color: Colors.grey),
                            )
                          : const Icon(Icons.shopping_bag_outlined, color: Colors.grey),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            name,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
                          ),
                          const SizedBox(height: 2),
                          Text('Phân loại: $variant', style: const TextStyle(color: Colors.grey, fontSize: 11)),
                          const SizedBox(height: 4),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(price, style: TextStyle(color: primaryColor, fontSize: 12, fontWeight: FontWeight.bold)),
                              Text(qty, style: const TextStyle(color: Colors.grey, fontSize: 12)),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            }),
          const Divider(height: 8),
          // Total Amount & Action
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Text('Tổng thanh toán: ', style: TextStyle(fontSize: 12, color: Colors.grey)),
                    Text(
                      _formatVND(num.tryParse(totalAmount.toString()) ?? 0),
                      style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold, fontSize: 16),
                    ),
                  ],
                ),
                OutlinedButton(
                  onPressed: () {
                    showDialog(
                      context: context,
                      builder: (ctx) => AlertDialog(
                        title: Text('Chi tiết đơn #$code'),
                        content: Column(
                          mainAxisSize: MainAxisSize.min,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Trạng thái: $statusText'),
                            const SizedBox(height: 4),
                            Text('Số lượng sản phẩm: ${items.length} món'),
                            const SizedBox(height: 4),
                            Text('Tổng tiền: ${_formatVND(num.tryParse(totalAmount.toString()) ?? 0)}'),
                            if (order['recipientName'] != null) ...[
                              const SizedBox(height: 8),
                              Text('Người nhận: ${order['recipientName']}'),
                              Text('SĐT: ${order['recipientPhone'] ?? ''}'),
                              Text('Địa chỉ: ${order['addressDetail'] ?? ''}, ${order['ward'] ?? ''}, ${order['district'] ?? ''}, ${order['province'] ?? ''}'),
                            ],
                          ],
                        ),
                        actions: [
                          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Đóng')),
                        ],
                      ),
                    );
                  },
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.black87,
                    side: BorderSide(color: Colors.grey[300]!),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    minimumSize: const Size(0, 32),
                  ),
                  child: const Text('Chi tiết', style: TextStyle(fontSize: 12)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
