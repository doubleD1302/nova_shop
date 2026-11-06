import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_client.dart';
import '../services/auth_service.dart';
import '../services/upload_service.dart';
import 'login_screen.dart';
import 'seller_payout_screen.dart';

class SellerMainScreen extends StatefulWidget {
  const SellerMainScreen({super.key});

  @override
  State<SellerMainScreen> createState() => _SellerMainScreenState();
}

class _SellerMainScreenState extends State<SellerMainScreen> with SingleTickerProviderStateMixin {
  final ApiClient _client = ApiClient();
  final NumberFormat _currencyFormat = NumberFormat.currency(locale: 'vi_VN', symbol: '₫', decimalDigits: 0);
  final Color _primaryColor = const Color(0xFF00796B); // Xanh Mall Seller thanh lịch

  late TabController _tabController;

  // Dữ liệu shop
  Map<String, dynamic>? _shopProfile;
  Map<String, dynamic>? _orderSummary;
  List<Map<String, dynamic>> _sellerOrders = [];
  List<Map<String, dynamic>> _sellerProducts = [];
  List<Map<String, dynamic>> _categories = [];

  bool _isLoadingOrders = false;
  bool _isLoadingProducts = false;
  bool _isLoadingProfile = false;

  // Bộ lọc đơn hàng (6 tabs giống website)
  String _orderTab = 'all'; // all, pending, confirmed, shipping, delivered, cancelled
  String _orderSearch = '';

  // Bộ lọc sản phẩm (5 tabs giống website)
  String _productTab = 'all'; // all, active, pending, rejected, out_of_stock
  String _productSearch = '';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 5, vsync: this);
    _loadAll();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _loadAll() {
    _loadProfile();
    _loadOrders();
    _loadProducts();
    _loadCategories();
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
    if (res.success && res.data is List && mounted) {
      setState(() {
        _categories = List<Map<String, dynamic>>.from(res.data as List);
      });
    }
  }

  // --- HÀNH ĐỘNG SELLER ---

  // 1. Cập nhật trạng thái đơn hàng (Xác nhận, Giao hàng, Hoàn tất, Hủy)
  Future<void> _updateOrderStatus(String shopOrderId, String newStatus) async {
    final res = await _client.patch(
      '/api/v1/seller/orders/$shopOrderId/status',
      body: {'status': newStatus},
    );
    if (!mounted) return;
    if (res.success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(newStatus == 'confirmed'
              ? 'Đã xác nhận đơn hàng! Shipper sẽ tới lấy hàng.'
              : newStatus == 'shipping'
                  ? 'Đơn hàng đã được bàn giao cho đơn vị vận chuyển!'
                  : newStatus == 'delivered'
                      ? 'Đơn hàng đã hoàn tất thành công!'
                      : 'Đã cập nhật trạng thái đơn hàng.'),
          backgroundColor: Colors.green,
        ),
      );
      _loadOrders();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(res.message.isNotEmpty ? res.message : 'Thao tác thất bại.'), backgroundColor: Colors.red),
      );
    }
  }

  // 2. Chỉnh sửa nhanh Giá và Tồn kho sản phẩm
  void _showQuickEditProduct(Map<String, dynamic> product) {
    final productId = product['id']?.toString() ?? '';
    final priceCtrl = TextEditingController(text: (product['price'] ?? '').toString());
    final stockCtrl = TextEditingController(text: (product['stock'] ?? '').toString());

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Sửa nhanh: ${product['title'] ?? product['name']}', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold), maxLines: 1),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: priceCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Giá bán (VNĐ) *', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: stockCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Số lượng tồn kho *', border: OutlineInputBorder()),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Hủy')),
          ElevatedButton(
            onPressed: () async {
              final newPrice = double.tryParse(priceCtrl.text) ?? 0;
              final newStock = int.tryParse(stockCtrl.text) ?? 0;
              if (newPrice <= 0 || newStock < 0) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Vui lòng nhập giá và tồn kho hợp lệ.'), backgroundColor: Colors.orange),
                );
                return;
              }
              Navigator.pop(ctx);
              final res = await _client.put('/api/v1/seller/products/$productId', body: {
                'price': newPrice,
                'stock': newStock,
              });
              if (mounted) {
                if (res.success) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Cập nhật giá và tồn kho thành công!'), backgroundColor: Colors.green),
                  );
                  _loadProducts();
                } else {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(res.message.isNotEmpty ? res.message : 'Lỗi cập nhật.'), backgroundColor: Colors.red),
                  );
                }
              }
            },
            style: ElevatedButton.styleFrom(backgroundColor: _primaryColor, foregroundColor: Colors.white),
            child: const Text('Lưu thay đổi'),
          ),
        ],
      ),
    );
  }

  // 3. Bật / Tắt kinh doanh sản phẩm
  Future<void> _toggleProductStatus(String productId, bool isActive) async {
    final res = await _client.put('/api/v1/seller/products/$productId', body: {
      'status': isActive ? 'active' : 'hidden',
    });
    if (!mounted) return;
    if (res.success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(isActive ? 'Đã bật kinh doanh sản phẩm' : 'Đã tạm ẩn sản phẩm'), backgroundColor: Colors.green),
      );
      _loadProducts();
    }
  }

  // 4. Xóa / Ngừng bán sản phẩm
  Future<void> _deleteProduct(String productId) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Xác nhận xóa sản phẩm'),
        content: const Text('Bạn có chắc chắn muốn ngừng kinh doanh và xóa sản phẩm này khỏi gian hàng?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Hủy')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red, foregroundColor: Colors.white),
            child: const Text('Xóa sản phẩm'),
          ),
        ],
      ),
    );
    if (confirm != true) return;

    final res = await _client.delete('/api/v1/seller/products/$productId');
    if (!mounted) return;
    if (res.success) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Đã gỡ sản phẩm thành công.'), backgroundColor: Colors.green),
      );
      _loadProducts();
    }
  }

  // 5. Gửi lại hồ sơ xét duyệt KYC nếu bị từ chối
  Future<void> _resubmitKYC() async {
    final res = await _client.post('/api/v1/seller/shop/resubmit');
    if (!mounted) return;
    if (res.success) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Đã gửi lại hồ sơ gian hàng thành công! Đang chờ Admin xét duyệt.'), backgroundColor: Colors.green),
      );
      _loadProfile();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(res.message.isNotEmpty ? res.message : 'Gửi lại thất bại.'), backgroundColor: Colors.red),
      );
    }
  }

  // 6. Form Đăng / Sửa Sản Phẩm (Đầy đủ Thuộc tính theo ngành hàng & Biến thể & Upload ảnh bảo mật)
  void _openProductForm({Map<String, dynamic>? initialProduct}) {
    final isEditing = initialProduct != null;
    final productId = initialProduct?['id']?.toString();

    final nameCtrl = TextEditingController(text: initialProduct?['title'] ?? initialProduct?['name'] ?? '');
    final priceCtrl = TextEditingController(text: initialProduct?['price']?.toString() ?? '');
    final originalPriceCtrl = TextEditingController(text: initialProduct?['originalPrice']?.toString() ?? '');
    final stockCtrl = TextEditingController(text: initialProduct?['stock']?.toString() ?? '100');
    final descCtrl = TextEditingController(text: initialProduct?['description'] ?? '');

    String? selectedCategoryId = initialProduct?['categoryId']?.toString();
    String? uploadedImageUrl = initialProduct?['imageUrl'] ?? (initialProduct?['images'] is List && (initialProduct!['images'] as List).isNotEmpty ? initialProduct['images'][0] : null);
    bool isUploadingImage = false;

    // Thuộc tính chi tiết ngành hàng động
    final attr1Ctrl = TextEditingController(); // Size / RAM / Dung tích / Công suất
    final attr2Ctrl = TextEditingController(); // Màu sắc / Bộ nhớ / Loại da / Chất liệu
    final attr3Ctrl = TextEditingController(); // Xuất xứ / Bảo hành / HSD / Điện áp

    // Biến thể (Variants)
    List<Map<String, dynamic>> variants = [
      {'name': 'Tiêu chuẩn', 'price': priceCtrl.text, 'stock': stockCtrl.text},
    ];

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) {
          return Padding(
            padding: EdgeInsets.only(
              top: 20,
              left: 20,
              right: 20,
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
                      Text(
                        isEditing ? 'Chỉnh Sửa Sản Phẩm' : 'Đăng Sản Phẩm Mới',
                        style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
                      ),
                      IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(ctx)),
                    ],
                  ),
                  const Divider(),
                  const SizedBox(height: 8),

                  // 1. UPLOAD ẢNH BẢO MẬT (MAGIC BYTES + MAX 5MB + AUTO-WEBP)
                  const Text('Hình ảnh sản phẩm (Ràng buộc tối đa 5MB, .jpg, .png, .webp):', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      GestureDetector(
                        onTap: () async {
                          setModalState(() => isUploadingImage = true);
                          final result = await UploadService().pickAndUploadImage(purpose: 'product');
                          setModalState(() {
                            isUploadingImage = false;
                            if (result != null && result.success && result.url != null) {
                              uploadedImageUrl = result.url;
                            }
                          });
                          if (mounted && result != null && !result.success && result.error != null) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text(result.error!), backgroundColor: Colors.red),
                            );
                          }
                        },
                        child: Container(
                          height: 100,
                          width: 100,
                          decoration: BoxDecoration(
                            color: const Color(0xFFF7F8FA),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: const Color(0xFFE0E0E0)),
                          ),
                          child: isUploadingImage
                              ? const Center(child: CircularProgressIndicator())
                              : uploadedImageUrl != null
                                  ? ClipRRect(
                                      borderRadius: BorderRadius.circular(10),
                                      child: Image.network(uploadedImageUrl!, fit: BoxFit.cover, errorBuilder: (c, e, s) => const Icon(Icons.check_circle, color: Colors.green)),
                                    )
                                  : const Column(
                                      mainAxisAlignment: MainAxisAlignment.center,
                                      children: [
                                        Icon(Icons.add_a_photo_outlined, color: Colors.teal),
                                        SizedBox(height: 4),
                                        Text('Tải ảnh lên', style: TextStyle(fontSize: 11, color: Colors.black54)),
                                      ],
                                    ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Quy chuẩn ảnh ShopNova:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11)),
                            const Text('✓ Tự động nén WebP chất lượng cao\n✓ Kiểm tra định dạng Magic Bytes\n✓ Chặn tập tin shell & mã độc', style: TextStyle(fontSize: 10, color: Colors.black54)),
                            if (uploadedImageUrl != null)
                              TextButton.icon(
                                icon: const Icon(Icons.delete_outline, size: 14, color: Colors.red),
                                label: const Text('Xóa ảnh', style: TextStyle(fontSize: 11, color: Colors.red)),
                                onPressed: () => setModalState(() => uploadedImageUrl = null),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),

                  // 2. TÊN VÀ DANH MỤC NGÀNH HÀNG
                  TextField(
                    controller: nameCtrl,
                    decoration: const InputDecoration(labelText: 'Tên sản phẩm *', border: OutlineInputBorder(), isDense: true),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: selectedCategoryId ?? (_categories.isNotEmpty ? _categories.first['id']?.toString() : null),
                    decoration: const InputDecoration(labelText: 'Ngành hàng danh mục *', border: OutlineInputBorder(), isDense: true),
                    items: _categories.map((c) {
                      return DropdownMenuItem<String>(
                        value: c['id']?.toString(),
                        child: Text(c['name'] ?? '', style: const TextStyle(fontSize: 13)),
                      );
                    }).toList(),
                    onChanged: (val) => setModalState(() => selectedCategoryId = val),
                  ),
                  const SizedBox(height: 14),

                  // 3. THUỘC TÍNH CHI TIẾT THEO NGÀNH HÀNG
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF9FBFB),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFE0E0E0)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Row(
                          children: [
                            Icon(Icons.tune_rounded, size: 16, color: Colors.teal),
                            SizedBox(width: 6),
                            Text('Thuộc tính ngành hàng', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.teal)),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            Expanded(child: TextField(controller: attr1Ctrl, decoration: const InputDecoration(labelText: 'Kích cỡ / RAM / Dung tích', border: OutlineInputBorder(), isDense: true))),
                            const SizedBox(width: 8),
                            Expanded(child: TextField(controller: attr2Ctrl, decoration: const InputDecoration(labelText: 'Màu sắc / Bộ nhớ', border: OutlineInputBorder(), isDense: true))),
                          ],
                        ),
                        const SizedBox(height: 8),
                        TextField(controller: attr3Ctrl, decoration: const InputDecoration(labelText: 'Xuất xứ / Bảo hành / Chất liệu', border: OutlineInputBorder(), isDense: true)),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),

                  // 4. GIÁ BÁN VÀ TỒN KHO
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: priceCtrl,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(labelText: 'Giá bán (VNĐ) *', border: OutlineInputBorder(), isDense: true),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextField(
                          controller: originalPriceCtrl,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(labelText: 'Giá gốc (nếu giảm)', border: OutlineInputBorder(), isDense: true),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: stockCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Tổng số lượng trong kho *', border: OutlineInputBorder(), isDense: true),
                  ),
                  const SizedBox(height: 12),

                  // 5. MÔ TẢ CHI TIẾT
                  TextField(
                    controller: descCtrl,
                    maxLines: 3,
                    decoration: const InputDecoration(labelText: 'Mô tả chi tiết sản phẩm *', border: OutlineInputBorder(), isDense: true),
                  ),
                  const SizedBox(height: 18),

                  // NÚT LƯU
                  SizedBox(
                    width: double.infinity,
                    height: 46,
                    child: ElevatedButton(
                      onPressed: () async {
                        final name = nameCtrl.text.trim();
                        final price = double.tryParse(priceCtrl.text) ?? 0;
                        final originalPrice = double.tryParse(originalPriceCtrl.text) ?? price;
                        final stock = int.tryParse(stockCtrl.text) ?? 1;

                        if (name.isEmpty || price <= 0) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Vui lòng nhập tên sản phẩm và giá bán hợp lệ.'), backgroundColor: Colors.orange),
                          );
                          return;
                        }

                        final payload = {
                          'name': name,
                          'title': name,
                          'price': price,
                          'originalPrice': originalPrice,
                          'stock': stock,
                          'categoryId': selectedCategoryId,
                          'description': descCtrl.text.trim(),
                          'imageUrl': uploadedImageUrl,
                          'attributes': {
                            'attr1': attr1Ctrl.text.trim(),
                            'attr2': attr2Ctrl.text.trim(),
                            'attr3': attr3Ctrl.text.trim(),
                          },
                          'variants': variants,
                        };

                        Navigator.pop(ctx);

                        final res = isEditing
                            ? await _client.put('/api/v1/seller/products/$productId', body: payload)
                            : await _client.post('/api/v1/seller/products', body: payload);

                        if (mounted) {
                          if (res.success) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(isEditing ? 'Cập nhật sản phẩm thành công!' : 'Đăng bán sản phẩm thành công! Đang chờ duyệt.'),
                                backgroundColor: Colors.green,
                              ),
                            );
                            _loadProducts();
                          } else {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text(res.message.isNotEmpty ? res.message : 'Lỗi lưu sản phẩm.'), backgroundColor: Colors.red),
                            );
                          }
                        }
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: _primaryColor,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      child: Text(
                        isEditing ? 'LƯU CẬP NHẬT SẢN PHẨM' : 'ĐĂNG BÁN SẢN PHẨM',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  // 7. Cấu hình Hồ Sơ Gian Hàng & KYC
  void _openShopProfileEditor() {
    final nameCtrl = TextEditingController(text: _shopProfile?['name'] ?? '');
    final taglineCtrl = TextEditingController(text: _shopProfile?['tagline'] ?? '');
    final descCtrl = TextEditingController(text: _shopProfile?['description'] ?? '');
    final phoneCtrl = TextEditingController(text: _shopProfile?['phone'] ?? '');
    final addressCtrl = TextEditingController(text: _shopProfile?['address'] ?? _shopProfile?['pickupAddress'] ?? '');
    final bankCtrl = TextEditingController(text: _shopProfile?['bankAccount'] ?? '');
    String? logoUrl = _shopProfile?['logoUrl'] ?? _shopProfile?['avatarUrl'];

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: EdgeInsets.only(
            top: 20,
            left: 20,
            right: 20,
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
                    const Text('Thiết Lập Hồ Sơ Gian Hàng', style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
                    IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(ctx)),
                  ],
                ),
                const Divider(),
                const SizedBox(height: 8),

                // LOGO SHOP
                Center(
                  child: Column(
                    children: [
                      GestureDetector(
                        onTap: () async {
                          final result = await UploadService().pickAndUploadImage(purpose: 'avatar');
                          if (result != null && result.success && result.url != null) {
                            setSheetState(() => logoUrl = result.url);
                          }
                        },
                        child: CircleAvatar(
                          radius: 36,
                          backgroundColor: Colors.teal.shade50,
                          backgroundImage: logoUrl != null ? NetworkImage(logoUrl!) : null,
                          child: logoUrl == null ? const Icon(Icons.storefront_rounded, size: 36, color: Colors.teal) : null,
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text('Chạm để đổi Logo Shop (tối đa 1MB)', style: TextStyle(fontSize: 10, color: Colors.black54)),
                    ],
                  ),
                ),
                const SizedBox(height: 14),

                TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Tên gian hàng *', border: OutlineInputBorder(), isDense: true)),
                const SizedBox(height: 10),
                TextField(controller: taglineCtrl, decoration: const InputDecoration(labelText: 'Khẩu hiệu gian hàng', border: OutlineInputBorder(), isDense: true)),
                const SizedBox(height: 10),
                TextField(controller: phoneCtrl, decoration: const InputDecoration(labelText: 'Số điện thoại liên hệ *', border: OutlineInputBorder(), isDense: true)),
                const SizedBox(height: 10),
                TextField(controller: addressCtrl, decoration: const InputDecoration(labelText: 'Địa chỉ lấy hàng mặc định (cho Shipper) *', border: OutlineInputBorder(), isDense: true)),
                const SizedBox(height: 10),
                TextField(controller: bankCtrl, decoration: const InputDecoration(labelText: 'Tài khoản ngân hàng đối soát doanh thu *', border: OutlineInputBorder(), isDense: true)),
                const SizedBox(height: 10),
                TextField(controller: descCtrl, maxLines: 2, decoration: const InputDecoration(labelText: 'Mô tả giới thiệu gian hàng', border: OutlineInputBorder(), isDense: true)),
                const SizedBox(height: 18),

                SizedBox(
                  width: double.infinity,
                  height: 44,
                  child: ElevatedButton(
                    onPressed: () async {
                      final name = nameCtrl.text.trim();
                      if (name.isEmpty) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Vui lòng nhập tên gian hàng.'), backgroundColor: Colors.orange),
                        );
                        return;
                      }

                      Navigator.pop(ctx);
                      final res = await _client.put('/api/v1/seller/shop', body: {
                        'name': name,
                        'tagline': taglineCtrl.text.trim(),
                        'description': descCtrl.text.trim(),
                        'phone': phoneCtrl.text.trim(),
                        'pickupAddress': addressCtrl.text.trim(),
                        'address': addressCtrl.text.trim(),
                        'bankAccount': bankCtrl.text.trim(),
                        'logoUrl': logoUrl,
                      });

                      if (mounted) {
                        if (res.success) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Cập nhật hồ sơ gian hàng thành công!'), backgroundColor: Colors.green),
                          );
                          _loadProfile();
                        } else {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text(res.message.isNotEmpty ? res.message : 'Lỗi cập nhật.'), backgroundColor: Colors.red),
                          );
                        }
                      }
                    },
                    style: ElevatedButton.styleFrom(backgroundColor: _primaryColor, foregroundColor: Colors.white),
                    child: const Text('LƯU THAY ĐỔI HỒ SƠ', style: TextStyle(fontWeight: FontWeight.bold)),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF4F6F8),
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8)),
              child: Icon(Icons.storefront_rounded, color: _primaryColor, size: 20),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('ShopNova Seller', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                Text(
                  _shopProfile?['name'] ?? 'Kênh Quản Lý Người Bán',
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.normal, color: Colors.white70),
                ),
              ],
            ),
          ],
        ),
        backgroundColor: _primaryColor,
        foregroundColor: Colors.white,
        elevation: 1,
        actions: [
          IconButton(
            icon: const Icon(Icons.add_box_rounded),
            tooltip: 'Đăng sản phẩm mới',
            onPressed: () => _openProductForm(),
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
        bottom: TabBar(
          controller: _tabController,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white70,
          indicatorColor: Colors.amber,
          indicatorWeight: 3,
          isScrollable: true,
          tabs: const [
            Tab(text: 'Tổng Quan', icon: Icon(Icons.dashboard_rounded, size: 18)),
            Tab(text: 'Đơn Hàng', icon: Icon(Icons.local_shipping_rounded, size: 18)),
            Tab(text: 'Sản Phẩm', icon: Icon(Icons.inventory_2_rounded, size: 18)),
            Tab(text: 'Ví Tiền', icon: Icon(Icons.account_balance_wallet_rounded, size: 18)),
            Tab(text: 'Hồ Sơ Shop', icon: Icon(Icons.store_mall_directory_rounded, size: 18)),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildDashboardTab(),
          _buildOrdersTab(),
          _buildProductsTab(),
          const SellerPayoutScreen(),
          _buildProfileTab(),
        ],
      ),
    );
  }

  // TAB 1: TỔNG QUAN
  Widget _buildDashboardTab() {
    final totalOrders = _orderSummary != null && _orderSummary!['total'] != null
        ? (_orderSummary!['total'] as num).toInt()
        : _sellerOrders.length;
    final pendingOrders = _orderSummary != null && _orderSummary!['pending'] != null
        ? (_orderSummary!['pending'] as num).toInt()
        : _sellerOrders.where((o) => o['status'] == 'pending' || o['status'] == 'chờ xác nhận').length;
    final deliveredOrders = _orderSummary != null && _orderSummary!['delivered'] != null
        ? (_orderSummary!['delivered'] as num).toInt()
        : _sellerOrders.where((o) => o['status'] == 'delivered').length;
    final totalRevenue = _orderSummary != null && _orderSummary!['revenue'] != null
        ? (_orderSummary!['revenue'] as num).toDouble()
        : _sellerOrders
            .where((o) => o['status'] == 'delivered')
            .fold<double>(0.0, (sum, o) => sum + ((o['total'] ?? o['totalForShop'] ?? o['totalAmount'] ?? o['totalPrice'] ?? 0) as num).toDouble());
    final totalProducts = _sellerProducts.length;
    final activeProducts = _sellerProducts.where((p) => p['status'] != 'hidden' && (p['approvalStatus'] == 'approved' || p['approvalStatus'] == null)).length;
    final kycStatus = _shopProfile?['approvalStatus'] ?? _shopProfile?['status'] ?? 'approved';
    final rejectionReason = _shopProfile?['rejectionReason'] ?? 'Hồ sơ chưa đạt tiêu chuẩn.';
    final ratingVal = _shopProfile?['rating'] ?? 5.0;
    final ratingCount = _shopProfile?['ratingCount'] ?? 0;

    return RefreshIndicator(
      onRefresh: () async => _loadAll(),
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // BANNER TRẠNG THÁI KYC GIAN HÀNG
            if (kycStatus == 'pending') ...[
              Container(
                padding: const EdgeInsets.all(14),
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(color: Colors.amber.shade50, borderRadius: BorderRadius.circular(10), border: Border.all(color: Colors.amber.shade300)),
                child: Row(
                  children: [
                    Icon(Icons.hourglass_top_rounded, color: Colors.amber.shade900),
                    const SizedBox(width: 10),
                    const Expanded(
                      child: Text('Gian hàng đang chờ Admin kiểm duyệt KYC. Một số tính năng đăng bán sẽ được mở khi duyệt.', style: TextStyle(fontSize: 12, color: Colors.black87)),
                    ),
                  ],
                ),
              ),
            ] else if (kycStatus == 'rejected') ...[
              Container(
                padding: const EdgeInsets.all(14),
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(10), border: Border.all(color: Colors.red.shade300)),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.error_outline_rounded, color: Colors.red),
                        const SizedBox(width: 10),
                        const Expanded(child: Text('Hồ sơ gian hàng bị từ chối phê duyệt.', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.red, fontSize: 13))),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text('Lý do phản hồi: $rejectionReason', style: const TextStyle(fontSize: 12, color: Colors.black87)),
                    const SizedBox(height: 10),
                    ElevatedButton.icon(
                      icon: const Icon(Icons.refresh_rounded, size: 16),
                      label: const Text('Gửi lại hồ sơ xét duyệt KYC'),
                      onPressed: _resubmitKYC,
                      style: ElevatedButton.styleFrom(backgroundColor: Colors.red, foregroundColor: Colors.white),
                    ),
                  ],
                ),
              ),
            ],

            Row(
              children: [
                _buildMetricCard(
                  'Doanh Thu Đã Giao',
                  _currencyFormat.format(totalRevenue),
                  'Đã giao $deliveredOrders đơn',
                  Icons.account_balance_wallet_rounded,
                  Colors.green,
                ),
                const SizedBox(width: 12),
                _buildMetricCard(
                  'Tổng Đơn Hàng',
                  '$totalOrders',
                  'Chờ xử lý: $pendingOrders đơn',
                  Icons.receipt_long_rounded,
                  Colors.blue,
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                _buildMetricCard(
                  'Sản Phẩm Trong Shop',
                  '$totalProducts',
                  'Đang bán: $activeProducts SP',
                  Icons.inventory_2_rounded,
                  Colors.purple,
                ),
                const SizedBox(width: 12),
                _buildMetricCard(
                  'Đánh Giá Gian Hàng',
                  '${ratingVal is num ? (ratingVal == 0 ? "5.0" : ratingVal.toStringAsFixed(1)) : ratingVal} ★',
                  '$ratingCount lượt đánh giá',
                  Icons.star_rounded,
                  Colors.amber.shade800,
                ),
              ],
            ),
            const SizedBox(height: 14),
            // Thẻ Ví Doanh Thu & Rút Tiền
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF00796B), Color(0xFF004D40)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(12),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF00796B).withOpacity(0.2),
                    blurRadius: 8,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.account_balance_wallet_rounded, color: Colors.white, size: 26),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Ví Doanh Thu ShopNova', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                        SizedBox(height: 3),
                        Text('Quản lý số dư bán hàng, kích hoạt ví nhận tiền và rút tiền.', style: TextStyle(color: Colors.white70, fontSize: 11)),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  ElevatedButton(
                    onPressed: () => _tabController.animateTo(3),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: const Color(0xFF00796B),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      minimumSize: const Size(0, 34),
                    ),
                    child: const Text('Mở ví', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Đơn hàng cần chuẩn bị gấp', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                TextButton(
                  onPressed: () => _tabController.animateTo(1),
                  child: const Text('Xem tất cả >'),
                ),
              ],
            ),
            if (_sellerOrders.isEmpty)
              const Center(child: Padding(padding: EdgeInsets.all(20), child: Text('Hiện không có đơn hàng mới nào.')))
            else
              ..._sellerOrders.take(3).map((order) => _buildOrderCard(order)),
          ],
        ),
      ),
    );
  }

  Widget _buildMetricCard(String title, String value, String sub, IconData icon, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE8ECEF)),
          boxShadow: [
            BoxShadow(color: Colors.black.withValues(alpha: 0.02), blurRadius: 4, offset: const Offset(0, 2)),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CircleAvatar(
              radius: 16,
              backgroundColor: color.withValues(alpha: 0.1),
              child: Icon(icon, color: color, size: 18),
            ),
            const SizedBox(height: 10),
            Text(value, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF1E293B))),
            const SizedBox(height: 2),
            Text(title, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
            const SizedBox(height: 4),
            Text(sub, style: TextStyle(fontSize: 10, color: color, fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }

  // TAB 2: ĐƠN HÀNG (6 TABS GIỐNG WEBSITE)
  Widget _buildOrdersTab() {
    var filtered = _sellerOrders;
    if (_orderTab != 'all') {
      filtered = filtered.where((o) => o['status'] == _orderTab).toList();
    }
    if (_orderSearch.isNotEmpty) {
      filtered = filtered.where((o) =>
        (o['orderNumber'] ?? o['id'] ?? '').toString().toLowerCase().contains(_orderSearch.toLowerCase()) ||
        (o['buyerName'] ?? '').toString().toLowerCase().contains(_orderSearch.toLowerCase())
      ).toList();
    }

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: TextField(
            decoration: InputDecoration(
              hintText: 'Tìm theo mã đơn hoặc tên khách...',
              prefixIcon: const Icon(Icons.search, size: 20),
              filled: true,
              fillColor: Colors.white,
              isDense: true,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE0E0E0))),
            ),
            onChanged: (val) => setState(() => _orderSearch = val.trim()),
          ),
        ),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            children: [
              _buildFilterChip('Tất cả', 'all', _orderTab, (v) => setState(() => _orderTab = v)),
              _buildFilterChip('Chờ xác nhận', 'pending', _orderTab, (v) => setState(() => _orderTab = v), badgeCount: _sellerOrders.where((o) => o['status'] == 'pending').length),
              _buildFilterChip('Chờ lấy hàng', 'confirmed', _orderTab, (v) => setState(() => _orderTab = v)),
              _buildFilterChip('Đang giao', 'shipping', _orderTab, (v) => setState(() => _orderTab = v)),
              _buildFilterChip('Đã giao', 'delivered', _orderTab, (v) => setState(() => _orderTab = v)),
              _buildFilterChip('Đã hủy', 'cancelled', _orderTab, (v) => setState(() => _orderTab = v)),
            ],
          ),
        ),
        Expanded(
          child: _isLoadingOrders
              ? const Center(child: CircularProgressIndicator())
              : filtered.isEmpty
                  ? const Center(child: Text('Không có đơn hàng nào trong mục này.'))
                  : ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: filtered.length,
                  itemBuilder: (context, idx) {
                    final order = filtered[idx];
                    return _buildOrderCard(order);
                  },
                ),
        ),
      ],
    );
  }

  Widget _buildOrderCard(Map<String, dynamic> order) {
    final status = order['status'] ?? 'pending';
    final orderId = order['id']?.toString() ?? '';
    final shopOrderId = (order['shopOrderId'] ?? order['id'])?.toString() ?? '';
    final total = ((order['total'] ?? order['totalForShop'] ?? order['totalAmount'] ?? order['totalPrice'] ?? 0) as num).toDouble();
    final items = (order['items'] as List?) ?? [];

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
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Đơn #${order['code'] ?? order['orderNumber'] ?? orderId}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                _buildOrderStatusBadge(status),
              ],
            ),
            const SizedBox(height: 6),
            Text('Khách: ${order['buyerName'] ?? "Khách lẻ"} • SĐT: ${order['buyerPhone'] ?? "N/A"}', style: const TextStyle(fontSize: 12, color: Colors.black87)),
            if (order['buyerAddress'] != null)
              Text('Giao tới: ${order['buyerAddress']}', style: const TextStyle(fontSize: 11, color: Colors.black54), maxLines: 1),

            if (items.isNotEmpty) ...[
              const Divider(height: 16),
              ...items.take(3).map((it) {
                final itMap = it is Map ? it : {};
                final itName = itMap['name'] ?? itMap['productName'] ?? 'Sản phẩm';
                final itVariant = itMap['variant'] ?? itMap['variantName'] ?? 'Mặc định';
                final itQty = itMap['qty'] ?? itMap['quantity'] ?? 1;
                final itPrice = ((itMap['price'] ?? 0) as num).toDouble();
                final itImg = (itMap['image'] ?? itMap['imageUrl'] ?? '').toString();

                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: Colors.grey.shade100,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: Colors.grey.shade300),
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(6),
                          child: itImg.isNotEmpty && (itImg.startsWith('http://') || itImg.startsWith('https://'))
                              ? Image.network(itImg, fit: BoxFit.cover, errorBuilder: (_, __, ___) => const Icon(Icons.shopping_bag_outlined, size: 20))
                              : const Icon(Icons.shopping_bag_outlined, size: 20),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(itName, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                            Text('PL: $itVariant • SL: x$itQty', style: TextStyle(fontSize: 10, color: Colors.grey.shade600)),
                          ],
                        ),
                      ),
                      Text(_currencyFormat.format(itPrice * (itQty as num)), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.black87)),
                    ],
                  ),
                );
              }),
              if (items.length > 3)
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Text('+ thêm ${items.length - 3} sản phẩm khác...', style: TextStyle(fontSize: 11, color: Colors.grey.shade600, fontStyle: FontStyle.italic)),
                ),
            ],

            const Divider(height: 18),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Tổng thu gian hàng:', style: TextStyle(fontSize: 12, color: Colors.black54)),
                Text(_currencyFormat.format(total), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.red)),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                OutlinedButton(
                  onPressed: () {
                    showDialog(
                      context: context,
                      builder: (ctx) => AlertDialog(
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        title: Text('Đơn #${order['code'] ?? orderId}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                        content: SingleChildScrollView(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Người mua: ${order['buyerName'] ?? "Khách lẻ"}', style: const TextStyle(fontWeight: FontWeight.w600)),
                              Text('Số điện thoại: ${order['buyerPhone'] ?? "N/A"}'),
                              Text('Địa chỉ giao hàng: ${order['buyerAddress'] ?? "Chưa có"}'),
                              if (order['note'] != null && order['note'].toString().isNotEmpty) ...[
                                const SizedBox(height: 4),
                                Text('Ghi chú khách: ${order['note']}', style: const TextStyle(fontStyle: FontStyle.italic, color: Colors.deepOrange)),
                              ],
                              const Divider(height: 16),
                              Text('Tổng tiền: ${_currencyFormat.format(total)}', style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.red)),
                              const SizedBox(height: 8),
                              Text('Trạng thái hiện tại: ${_orderStatusLabel(status)}'),
                            ],
                          ),
                        ),
                        actions: [
                          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Đóng')),
                        ],
                      ),
                    );
                  },
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.black87,
                    side: BorderSide(color: Colors.grey.shade300),
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    minimumSize: const Size(0, 36),
                  ),
                  child: const Text('Chi tiết', style: TextStyle(fontSize: 11)),
                ),
                const SizedBox(width: 8),
                if (status == 'pending') ...[
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () => _updateOrderStatus(shopOrderId, 'confirmed'),
                      style: ElevatedButton.styleFrom(backgroundColor: _primaryColor, foregroundColor: Colors.white),
                      child: const Text('Xác nhận đơn', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                    ),
                  ),
                  const SizedBox(width: 8),
                  OutlinedButton(
                    onPressed: () => _updateOrderStatus(shopOrderId, 'cancelled'),
                    style: OutlinedButton.styleFrom(foregroundColor: Colors.red),
                    child: const Text('Hủy', style: TextStyle(fontSize: 12)),
                  ),
                ] else if (status == 'confirmed') ...[
                  Expanded(
                    child: ElevatedButton.icon(
                      icon: const Icon(Icons.local_shipping_rounded, size: 16),
                      label: const Text('Giao cho vận chuyển', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                      onPressed: () => _updateOrderStatus(shopOrderId, 'shipping'),
                      style: ElevatedButton.styleFrom(backgroundColor: Colors.blue.shade700, foregroundColor: Colors.white),
                    ),
                  ),
                ] else if (status == 'shipping') ...[
                  Expanded(
                    child: ElevatedButton.icon(
                      icon: const Icon(Icons.check_circle_outline, size: 16),
                      label: const Text('Xác nhận đã giao', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                      onPressed: () => _updateOrderStatus(shopOrderId, 'delivered'),
                      style: ElevatedButton.styleFrom(backgroundColor: Colors.green, foregroundColor: Colors.white),
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  // TAB 3: SẢN PHẨM (5 TABS GIỐNG WEBSITE)
  Widget _buildProductsTab() {
    var filtered = _sellerProducts;
    if (_productTab != 'all') {
      if (_productTab == 'active') {
        filtered = filtered.where((p) => (p['approvalStatus'] == 'approved' || p['approvalStatus'] == null) && p['status'] != 'hidden' && (p['stock'] ?? 1) > 0).toList();
      } else if (_productTab == 'pending') {
        filtered = filtered.where((p) => p['approvalStatus'] == 'pending').toList();
      } else if (_productTab == 'rejected') {
        filtered = filtered.where((p) => p['approvalStatus'] == 'rejected').toList();
      } else if (_productTab == 'out_of_stock') {
        filtered = filtered.where((p) => p['status'] == 'hidden' || (p['stock'] ?? 0) == 0).toList();
      }
    }
    if (_productSearch.isNotEmpty) {
      filtered = filtered.where((p) =>
        (p['title'] ?? p['name'] ?? '').toString().toLowerCase().contains(_productSearch.toLowerCase())
      ).toList();
    }

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: TextField(
            decoration: InputDecoration(
              hintText: 'Tìm kiếm sản phẩm trong shop...',
              prefixIcon: const Icon(Icons.search, size: 20),
              filled: true,
              fillColor: Colors.white,
              isDense: true,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE0E0E0))),
            ),
            onChanged: (val) => setState(() => _productSearch = val.trim()),
          ),
        ),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            children: [
              _buildFilterChip('Tất cả', 'all', _productTab, (v) => setState(() => _productTab = v)),
              _buildFilterChip('Đang bán', 'active', _productTab, (v) => setState(() => _productTab = v)),
              _buildFilterChip('Chờ duyệt', 'pending', _productTab, (v) => setState(() => _productTab = v), badgeCount: _sellerProducts.where((p) => p['approvalStatus'] == 'pending').length),
              _buildFilterChip('Bị từ chối', 'rejected', _productTab, (v) => setState(() => _productTab = v)),
              _buildFilterChip('Đã ẩn / Hết hàng', 'out_of_stock', _productTab, (v) => setState(() => _productTab = v)),
            ],
          ),
        ),
        Expanded(
          child: _isLoadingProducts
              ? const Center(child: CircularProgressIndicator())
              : filtered.isEmpty
                  ? const Center(child: Text('Không có sản phẩm nào.'))
                  : ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: filtered.length,
                  itemBuilder: (context, idx) {
                    final p = filtered[idx];
                    final productId = p['id']?.toString() ?? '';
                    final price = (p['price'] ?? 0).toDouble();
                    final stock = p['stock'] ?? 0;
                    final isHidden = p['status'] == 'hidden';
                    final approvalStatus = p['approvalStatus'] ?? 'approved';

                    return Card(
                      margin: const EdgeInsets.only(bottom: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      elevation: 1,
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          children: [
                            Row(
                              children: [
                                Container(
                                  width: 60,
                                  height: 60,
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFF1F5F9),
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
                                      const SizedBox(height: 3),
                                      Text(_currencyFormat.format(price), style: const TextStyle(color: Colors.red, fontWeight: FontWeight.bold, fontSize: 13)),
                                      Text('Kho: $stock sản phẩm • Trạng thái: ${approvalStatus == "approved" ? "Đã duyệt" : approvalStatus == "rejected" ? "Bị từ chối" : "Chờ duyệt"}',
                                          style: TextStyle(fontSize: 11, color: approvalStatus == 'approved' ? Colors.green : Colors.orange)),
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
                                    const Text('Kinh doanh:', style: TextStyle(fontSize: 11)),
                                    Switch(
                                      value: !isHidden,
                                      activeThumbColor: _primaryColor,
                                      onChanged: (val) => _toggleProductStatus(productId, val),
                                    ),
                                  ],
                                ),
                                Row(
                                  children: [
                                    OutlinedButton(
                                      onPressed: () => _showQuickEditProduct(p),
                                      style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4)),
                                      child: const Text('Sửa giá/kho', style: TextStyle(fontSize: 11)),
                                    ),
                                    const SizedBox(width: 6),
                                    IconButton(
                                      icon: const Icon(Icons.edit_note_rounded, color: Colors.blue),
                                      tooltip: 'Sửa toàn diện',
                                      onPressed: () => _openProductForm(initialProduct: p),
                                    ),
                                    IconButton(
                                      icon: const Icon(Icons.delete_outline_rounded, color: Colors.red),
                                      tooltip: 'Xóa',
                                      onPressed: () => _deleteProduct(productId),
                                    ),
                                  ],
                                ),
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

  // TAB 4: HỒ SƠ GIAN HÀNG & CẤU HÌNH (SHOP PROFILE)
  Widget _buildProfileTab() {
    if (_isLoadingProfile) return const Center(child: CircularProgressIndicator());
    final name = (_shopProfile?['name']?.toString().isNotEmpty == true) ? _shopProfile!['name'].toString() : 'Gian hàng ShopNova';
    final tagline = (_shopProfile?['tagline']?.toString().isNotEmpty == true) ? _shopProfile!['tagline'].toString() : 'Gian hàng đối tác chính thức';
    final address = (_shopProfile?['pickupAddress'] ?? _shopProfile?['address'] ?? _shopProfile?['location'])?.toString();
    final addressText = (address != null && address.isNotEmpty) ? address : 'Chưa thiết lập địa chỉ lấy hàng';
    final bank = (_shopProfile?['bankAccount'] ?? _shopProfile?['bank_account'])?.toString();
    final bankText = (bank != null && bank.isNotEmpty) ? bank : 'Chưa liên kết tài khoản ngân hàng';
    final phone = (_shopProfile?['phone'] ?? _shopProfile?['phone_number'])?.toString();
    final phoneText = (phone != null && phone.isNotEmpty) ? phone : 'Chưa cập nhật SĐT';

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [_primaryColor, const Color(0xFF004D40)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 30,
                  backgroundColor: Colors.white,
                  child: Icon(Icons.storefront_rounded, size: 32, color: _primaryColor),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                      Text(tagline, style: const TextStyle(color: Colors.white70, fontSize: 12)),
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(6)),
                        child: const Text('✓ Gian Hàng Chính Hãng', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          ElevatedButton.icon(
            icon: const Icon(Icons.edit_rounded, size: 16),
            label: const Text('Chỉnh sửa Thông tin & Cấu hình Gian hàng'),
            onPressed: _openShopProfileEditor,
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.white,
              foregroundColor: _primaryColor,
              minimumSize: const Size(double.infinity, 44),
              side: BorderSide(color: _primaryColor),
            ),
          ),
          const SizedBox(height: 20),

          const Text('Thông tin Vận hành & Đối soát:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Column(
              children: [
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.phone_rounded, color: Colors.blue),
                  title: const Text('Số điện thoại liên hệ', style: TextStyle(fontSize: 12, color: Colors.black54)),
                  subtitle: Text(phoneText, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.black87)),
                ),
                const Divider(),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.local_shipping_rounded, color: Colors.deepOrange),
                  title: const Text('Địa chỉ lấy hàng cho Shipper', style: TextStyle(fontSize: 12, color: Colors.black54)),
                  subtitle: Text(addressText, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.black87)),
                ),
                const Divider(),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.account_balance_rounded, color: Colors.green),
                  title: const Text('Tài khoản ngân hàng nhận tiền đối soát', style: TextStyle(fontSize: 12, color: Colors.black54)),
                  subtitle: Text(bankText, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.black87)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // WIDGET TIỆN ÍCH DÙNG CHUNG
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

  String _orderStatusLabel(String status) {
    switch (status) {
      case 'pending': return 'Chờ xác nhận';
      case 'confirmed': return 'Chờ lấy hàng';
      case 'shipping': return 'Đang giao';
      case 'delivered': return 'Đã giao thành công';
      case 'cancelled': return 'Đã hủy';
      default: return status;
    }
  }

  Widget _buildOrderStatusBadge(String status) {
    Color bg = Colors.grey.shade100;
    Color fg = Colors.grey.shade800;
    String text = status;

    switch (status) {
      case 'pending':
        bg = Colors.amber.shade50;
        fg = Colors.amber.shade900;
        text = 'Chờ xác nhận';
        break;
      case 'confirmed':
        bg = Colors.blue.shade50;
        fg = Colors.blue.shade900;
        text = 'Chờ lấy hàng';
        break;
      case 'shipping':
        bg = Colors.purple.shade50;
        fg = Colors.purple.shade900;
        text = 'Đang giao';
        break;
      case 'delivered':
        bg = Colors.green.shade50;
        fg = Colors.green.shade900;
        text = 'Đã giao';
        break;
      case 'cancelled':
        bg = Colors.red.shade50;
        fg = Colors.red.shade900;
        text = 'Đã hủy';
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
      child: Text(text, style: TextStyle(color: fg, fontSize: 11, fontWeight: FontWeight.bold)),
    );
  }
}
