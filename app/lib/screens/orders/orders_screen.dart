import 'package:flutter/material.dart';
import '../../services/order_service.dart';
import '../../services/review_service.dart';
import '../../services/upload_service.dart';
import '../../theme/app_colors.dart';

class OrdersScreen extends StatefulWidget {
  final int initialTabIndex;

  const OrdersScreen({super.key, this.initialTabIndex = 0});

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final Color primaryColor = AppColors.primary;

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

  /// Hộp thoại đánh giá sản phẩm dành riêng cho đơn đã giao thành công
  void _showOrderReviewDialog(Map<String, dynamic> order, List<dynamic> items) {
    if (items.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Không tìm thấy sản phẩm trong đơn để đánh giá.')),
      );
      return;
    }

    final firstItem = items.first as Map<String, dynamic>;
    final productName = firstItem['productName'] ?? firstItem['product_name'] ?? 'Sản phẩm đã mua';
    final orderItemId = (firstItem['id'] ?? firstItem['orderItemId'] ?? firstItem['order_item_id'] ?? order['id'] ?? '1').toString();

    int rating = 5;
    final commentCtrl = TextEditingController();
    List<String> reviewImages = [];
    bool isUploadingImage = false;
    bool isSubmitting = false;

    final ratingLabels = {
      1: '⭐ Rất tệ',
      2: '⭐⭐ Không hài lòng',
      3: '⭐⭐⭐ Bình thường',
      4: '⭐⭐⭐⭐ Hài lòng',
      5: '⭐⭐⭐⭐⭐ Tuyệt vời',
    };

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (modalCtx, setModalState) {
            return Container(
              padding: EdgeInsets.only(
                bottom: MediaQuery.of(modalCtx).viewInsets.bottom + 20,
                left: 16,
                right: 16,
                top: 20,
              ),
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.rate_review_rounded, color: AppColors.primary, size: 22),
                        const SizedBox(width: 8),
                        const Text(
                          'Đánh Giá Sản Phẩm',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17, color: Color(0xFF1E2022)),
                        ),
                        const Spacer(),
                        IconButton(
                          icon: const Icon(Icons.close_rounded, color: Color(0xFF8F90A6)),
                          onPressed: () => Navigator.pop(modalCtx),
                        ),
                      ],
                    ),
                    const Divider(height: 12),
                    Text(
                      productName,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: Color(0xFF555770)),
                    ),
                    const SizedBox(height: 14),
                    const Center(
                      child: Text('Chất lượng sản phẩm & Dịch vụ shop', style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.bold)),
                    ),
                    const SizedBox(height: 8),
                    // 5 Star Rating Bar
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: List.generate(5, (index) {
                        final starIndex = index + 1;
                        return IconButton(
                          icon: Icon(
                            starIndex <= rating ? Icons.star_rounded : Icons.star_border_rounded,
                            color: Colors.amber.shade700,
                            size: 36,
                          ),
                          onPressed: () => setModalState(() => rating = starIndex),
                        );
                      }),
                    ),
                    Center(
                      child: Text(
                        ratingLabels[rating] ?? '',
                        style: TextStyle(color: Colors.amber.shade900, fontWeight: FontWeight.w700, fontSize: 13),
                      ),
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: commentCtrl,
                      maxLines: 3,
                      decoration: InputDecoration(
                        labelText: 'Nhận xét chi tiết (tối thiểu 5 ký tự) *',
                        hintText: 'Chất lượng sản phẩm thế nào? Bạn có hài lòng về đóng gói, giao hàng không?',
                        labelStyle: const TextStyle(fontSize: 12.5),
                        hintStyle: const TextStyle(fontSize: 12, color: Color(0xFF8F90A6)),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                    const SizedBox(height: 12),
                    // Tải ảnh review (UploadService kiểm tra MIME, Magic Bytes, dung lượng <= 2MB, nén WebP)
                    Row(
                      children: [
                        OutlinedButton.icon(
                          onPressed: isUploadingImage
                              ? null
                              : () async {
                                  setModalState(() => isUploadingImage = true);
                                  final uploadResult = await UploadService().pickAndUploadImage(purpose: 'review');
                                  setModalState(() => isUploadingImage = false);
                                  if (uploadResult != null && uploadResult.success && uploadResult.url != null) {
                                    setModalState(() => reviewImages.add(uploadResult.url!));
                                  } else if (uploadResult != null && uploadResult.error != null && mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(content: Text(uploadResult.error!), backgroundColor: const Color(0xFFD0011B)),
                                    );
                                  }
                                },
                          icon: isUploadingImage
                              ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
                              : const Icon(Icons.add_a_photo_rounded, size: 16),
                          label: const Text('Thêm ảnh thực tế (Tối đa 2MB)', style: TextStyle(fontSize: 12)),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: AppColors.primary,
                            side: const BorderSide(color: AppColors.primary),
                          ),
                        ),
                      ],
                    ),
                    if (reviewImages.isNotEmpty) ...[
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 8,
                        children: reviewImages.map((img) {
                          return Stack(
                            children: [
                              ClipRRect(
                                borderRadius: BorderRadius.circular(8),
                                child: Image.network(
                                  img,
                                  width: 60,
                                  height: 60,
                                  fit: BoxFit.cover,
                                  errorBuilder: (_, __, ___) => const Icon(Icons.image),
                                ),
                              ),
                              Positioned(
                                top: 0,
                                right: 0,
                                child: InkWell(
                                  onTap: () => setModalState(() => reviewImages.remove(img)),
                                  child: Container(
                                    decoration: const BoxDecoration(color: Colors.black54, shape: BoxShape.circle),
                                    child: const Icon(Icons.close_rounded, size: 16, color: Colors.white),
                                  ),
                                ),
                              ),
                            ],
                          );
                        }).toList(),
                      ),
                    ],
                    const SizedBox(height: 20),
                    SizedBox(
                      width: double.infinity,
                      height: 46,
                      child: ElevatedButton(
                        onPressed: isSubmitting
                            ? null
                            : () async {
                                final comment = commentCtrl.text.trim();
                                if (comment.length < 5) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(content: Text('Vui lòng nhập tối thiểu 5 ký tự nhận xét.')),
                                  );
                                  return;
                                }

                                setModalState(() => isSubmitting = true);
                                final res = await ReviewService().createReview(
                                  orderItemId: orderItemId,
                                  rating: rating,
                                  comment: comment,
                                  images: reviewImages,
                                );
                                setModalState(() => isSubmitting = false);

                                if (mounted) {
                                  Navigator.pop(modalCtx);
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text('Cảm ơn bạn! Đánh giá đã được gửi thành công.'),
                                      backgroundColor: Color(0xFF00BFA5),
                                    ),
                                  );
                                }
                              },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        child: isSubmitting
                            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                            : const Text('Gửi Đánh Giá', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(49),
          child: Column(
            children: [
              TabBar(
                controller: _tabController,
                isScrollable: true,
                tabAlignment: TabAlignment.start,
                labelColor: primaryColor,
                unselectedLabelColor: AppColors.textSecondary,
                indicatorColor: primaryColor,
                indicatorWeight: 2.5,
                indicatorSize: TabBarIndicatorSize.label,
                labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13),
                tabs: const [
                  Tab(text: 'Chờ xác nhận'),
                  Tab(text: 'Chờ lấy hàng'),
                  Tab(text: 'Đang giao'),
                  Tab(text: 'Đã giao'),
                  Tab(text: 'Đã hủy / Trả hàng'),
                ],
              ),
              Container(color: AppColors.border, height: 1),
            ],
          ),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: AppColors.textPrimary, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Đơn Mua Của Tôi',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontWeight: FontWeight.w700,
            fontSize: 18,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: Color(0xFF555770)),
            tooltip: 'Làm mới đơn hàng',
            onPressed: _loadOrders,
          ),
          const SizedBox(width: 4),
        ],
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
      return const Center(child: CircularProgressIndicator(color: AppColors.primary));
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
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFEEEEF0)),
        boxShadow: const [
          BoxShadow(color: Color(0x06000000), blurRadius: 10, offset: Offset(0, 3)),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 80,
            height: 80,
            decoration: const BoxDecoration(
              color: Color(0xFFF7F7F8),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.inventory_2_outlined, size: 40, color: Color(0xFF8F90A6)),
          ),
          const SizedBox(height: 18),
          Text(
            title,
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: Color(0xFF1E2022)),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            subtitle,
            textAlign: TextAlign.center,
            style: const TextStyle(color: Color(0xFF8F90A6), fontSize: 13, height: 1.4),
          ),
          const SizedBox(height: 22),
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [AppColors.primary, AppColors.earth],
              ),
              borderRadius: BorderRadius.all(Radius.circular(10)),
            ),
            child: ElevatedButton(
              onPressed: _loadOrders,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.transparent,
                shadowColor: Colors.transparent,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              child: const Text('Làm mới danh sách', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
            ),
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
    final canReview = status == 'delivered' || status == 'completed';

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

    Color statusBgColor;
    Color statusTextColor;
    String statusText;
    switch (status) {
      case 'confirmed':
      case 'processing':
        statusBgColor = const Color(0xFFEFF6FF);
        statusTextColor = const Color(0xFF2563EB);
        statusText = 'Đang chuẩn bị hàng';
        break;
      case 'shipping':
      case 'in_transit':
        statusBgColor = const Color(0xFFFFFBEB);
        statusTextColor = const Color(0xFFD97706);
        statusText = 'Đang vận chuyển';
        break;
      case 'delivered':
      case 'completed':
        statusBgColor = const Color(0xFFF0FDF4);
        statusTextColor = const Color(0xFF16A34A);
        statusText = 'Giao thành công';
        break;
      case 'cancelled':
      case 'returned':
        statusBgColor = const Color(0xFFFEF2F2);
        statusTextColor = const Color(0xFFDC2626);
        statusText = 'Đã hủy';
        break;
      default:
        statusBgColor = AppColors.surfaceAlt;
        statusTextColor = primaryColor;
        statusText = 'Chờ shop xác nhận';
    }

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
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
          // Order Header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: const BoxDecoration(
              color: Color(0xFFFAFAFC),
              borderRadius: BorderRadius.vertical(top: Radius.circular(14)),
              border: Border(bottom: BorderSide(color: Color(0xFFEEEEF0))),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(Icons.receipt_long_rounded, color: Color(0xFF555770), size: 18),
                    const SizedBox(width: 8),
                    Text(
                      'Đơn hàng: #$code',
                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: Color(0xFF1E2022)),
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: statusBgColor,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    statusText,
                    style: TextStyle(color: statusTextColor, fontSize: 11, fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
          ),
          // Order Meta Date
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 10, 14, 4),
            child: Text(
              createdAt.length >= 10 ? 'Ngày đặt: ${createdAt.substring(0, 10)}' : 'Hôm nay',
              style: const TextStyle(color: Color(0xFF8F90A6), fontSize: 11),
            ),
          ),
          // Order Items
          if (items.isEmpty)
            Padding(
              padding: const EdgeInsets.all(14),
              child: Text(
                'Kiện hàng #$code',
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: Color(0xFF1E2022)),
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
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 58,
                      height: 58,
                      decoration: BoxDecoration(
                        color: const Color(0xFFF7F7F8),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFFEEEEF0)),
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: img.isNotEmpty && (img.startsWith('http://') || img.startsWith('https://'))
                            ? Image.network(
                                img,
                                fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) => const Icon(Icons.shopping_bag_outlined, color: Colors.grey),
                              )
                            : const Icon(Icons.shopping_bag_outlined, color: Colors.grey),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            name,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF1E2022)),
                          ),
                          const SizedBox(height: 3),
                          Text('Phân loại: $variant', style: const TextStyle(color: Color(0xFF8F90A6), fontSize: 11)),
                          const SizedBox(height: 4),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(price, style: TextStyle(color: primaryColor, fontSize: 13, fontWeight: FontWeight.w700)),
                              Text(qty, style: const TextStyle(color: Color(0xFF8F90A6), fontSize: 12, fontWeight: FontWeight.bold)),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            }),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 14),
            child: Divider(height: 1, color: Color(0xFFEEEEF0)),
          ),
          // Total Amount & Action Buttons
          Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    const Text('Tổng: ', style: TextStyle(fontSize: 12, color: Color(0xFF555770))),
                    Text(
                      _formatVND(num.tryParse(totalAmount.toString()) ?? 0),
                      style: TextStyle(color: primaryColor, fontWeight: FontWeight.w800, fontSize: 16),
                    ),
                  ],
                ),
                Row(
                  children: [
                    // Nút Hủy đơn (khi đơn còn đang chờ)
                    if (status == 'pending' || status == 'created' || status.isEmpty) ...[
                      OutlinedButton(
                        onPressed: () => _cancelOrder(order['id']?.toString() ?? ''),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFFDC2626),
                          side: const BorderSide(color: Color(0xFFFCA5A5)),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          minimumSize: const Size(0, 34),
                        ),
                        child: const Text('Hủy đơn', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                      ),
                      const SizedBox(width: 8),
                    ],
                    // Nút Đã nhận hàng (khi đơn đang vận chuyển)
                    if (status == 'shipping' || status == 'in_transit') ...[
                      ElevatedButton(
                        onPressed: () => _confirmOrderReceived(order['id']?.toString() ?? ''),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF16A34A),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          minimumSize: const Size(0, 34),
                        ),
                        child: const Text('Đã nhận hàng', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                      ),
                      const SizedBox(width: 8),
                    ],
                    // Nút Đánh Giá Sản Phẩm (Chỉ hiển thị khi đơn đã giao thành công)
                    if (canReview) ...[
                      ElevatedButton.icon(
                        onPressed: () => _showOrderReviewDialog(order, items),
                        icon: const Icon(Icons.star_rounded, size: 16, color: Colors.white),
                        label: const Text('Đánh giá', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: primaryColor,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          minimumSize: const Size(0, 34),
                        ),
                      ),
                      const SizedBox(width: 8),
                    ],
                    OutlinedButton(
                      onPressed: () {
                        showDialog(
                          context: context,
                          builder: (ctx) => AlertDialog(
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                            title: Text('Chi tiết đơn #$code', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                            content: Column(
                              mainAxisSize: MainAxisSize.min,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('Trạng thái: $statusText', style: const TextStyle(fontWeight: FontWeight.w600)),
                                const SizedBox(height: 6),
                                Text('Số lượng sản phẩm: ${items.length} món'),
                                const SizedBox(height: 4),
                                Text('Tổng tiền: ${_formatVND(num.tryParse(totalAmount.toString()) ?? 0)}', style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold)),
                                if (order['recipientName'] != null) ...[
                                  const Divider(height: 16),
                                  Text('Người nhận: ${order['recipientName']}'),
                                  Text('SĐT: ${order['recipientPhone'] ?? ''}'),
                                  Text('Địa chỉ: ${order['addressDetail'] ?? ''}, ${order['ward'] ?? ''}, ${order['district'] ?? ''}, ${order['province'] ?? ''}'),
                                ],
                              ],
                            ),
                            actions: [
                              TextButton(
                                onPressed: () => Navigator.pop(ctx),
                                child: const Text('Đóng', style: TextStyle(color: Color(0xFF555770))),
                              ),
                            ],
                          ),
                        );
                      },
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF1E2022),
                        side: const BorderSide(color: Color(0xFFE2E2E6)),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                        minimumSize: const Size(0, 34),
                      ),
                      child: const Text('Chi tiết', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
  Future<void> _confirmOrderReceived(String orderId) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Xác nhận nhận hàng', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        content: const Text('Bạn xác nhận đã nhận đầy đủ sản phẩm và hàng hóa nguyên vẹn, hài lòng với đơn hàng?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Chưa nhận', style: TextStyle(color: Color(0xFF8F90A6))),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF16A34A), foregroundColor: Colors.white),
            child: const Text('Đã nhận đủ'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      final success = await OrderService().confirmOrderReceived(orderId);
      if (mounted) {
        if (success) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Xác nhận đã nhận hàng thành công. Cảm ơn bạn!'),
              backgroundColor: Color(0xFF16A34A),
            ),
          );
          _loadOrders();
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Không thể xác nhận lúc này. Vui lòng thử lại sau.'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    }
  }

  Future<void> _cancelOrder(String orderId) async {
    final reasonController = TextEditingController(text: 'Khách hàng đổi ý / Đặt lại');
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Hủy đơn hàng', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Bạn có chắc chắn muốn hủy đơn hàng này không?', style: TextStyle(fontSize: 13)),
            const SizedBox(height: 12),
            TextField(
              controller: reasonController,
              decoration: const InputDecoration(
                labelText: 'Lý do hủy đơn',
                border: OutlineInputBorder(),
                isDense: true,
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Không hủy', style: TextStyle(color: Color(0xFF8F90A6))),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red, foregroundColor: Colors.white),
            child: const Text('Xác nhận hủy'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      final success = await OrderService().cancelOrder(orderId, reason: reasonController.text.trim());
      if (mounted) {
        if (success) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Đã hủy đơn hàng thành công.'),
              backgroundColor: Color(0xFF1E2022),
            ),
          );
          _loadOrders();
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Không thể hủy đơn hàng này.'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    }
  }
}
