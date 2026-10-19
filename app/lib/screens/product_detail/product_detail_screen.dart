import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:shopnova/models/product.dart';
import 'package:shopnova/services/catalog_service.dart';
import 'package:shopnova/services/cart_service.dart';
import 'package:shopnova/screens/cart/cart_screen.dart';

class ProductDetailScreen extends StatefulWidget {
  final String? productId;
  final Product? initialProduct;

  const ProductDetailScreen({super.key, this.productId, this.initialProduct});

  @override
  State<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends State<ProductDetailScreen> {
  final Color primaryColor = const Color(0xFFEE4D2D);
  final CatalogService _catalogService = CatalogService();
  Product? _product;
  bool _isLoading = false;
  
  String selectedColor = 'Trắng Basic';
  String selectedSize = 'L (55-65kg)';
  int quantity = 1;

  @override
  void initState() {
    super.initState();
    _product = widget.initialProduct;
    if (widget.productId != null) {
      _loadProduct(widget.productId!);
    }
  }

  Future<void> _loadProduct(String id) async {
    setState(() => _isLoading = _product == null);
    final p = await _catalogService.getProductDetail(id);
    if (mounted && p != null) {
      setState(() {
        _product = p;
        _isLoading = false;
      });
    } else if (mounted) {
      setState(() => _isLoading = false);
    }
  }

  final List<String> colors = ['Trắng Basic', 'Đen Classic', 'Be Vintage', 'Xanh Sage'];
  final List<String> sizes = ['M', 'L (55-65kg)', 'XL', 'XXL'];

  Color getColorFromString(String colorStr) {
    switch (colorStr) {
      case 'Trắng Basic': return Colors.white;
      case 'Đen Classic': return Colors.black;
      case 'Be Vintage': return const Color(0xFFF5F5DC);
      case 'Xanh Sage': return const Color(0xFF9DC183);
      default: return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[200],
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.black87),
        title: const Text(
          'Shopnova Chi Tiết Sản Phẩm',
          style: TextStyle(color: Colors.black87, fontSize: 16),
        ),
        actions: [
          IconButton(icon: const Icon(Icons.share_outlined), onPressed: () {}),
          IconButton(icon: const Icon(Icons.search), onPressed: () {}),
          Stack(
            alignment: Alignment.center,
            children: [
              IconButton(icon: const Icon(Icons.shopping_cart_outlined), onPressed: () {}),
              Positioned(
                right: 8,
                top: 8,
                child: Container(
                  padding: const EdgeInsets.all(2),
                  decoration: BoxDecoration(
                    color: primaryColor,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                  child: const Text(
                    '3',
                    style: TextStyle(color: Colors.white, fontSize: 10),
                    textAlign: TextAlign.center,
                  ),
                ),
              )
            ],
          ),
          IconButton(icon: const Icon(Icons.home_outlined), onPressed: () {}),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(30),
          child: Container(
            width: double.infinity,
            color: Colors.amber[100],
            padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 16),
            child: const Row(
              children: [
                Icon(Icons.check_circle, size: 14, color: Colors.amber),
                SizedBox(width: 4),
                Text(
                  '• HÀNG CHÍNH HÃNG 100%',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.orange),
                ),
              ],
            ),
          ),
        ),
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            _buildImageSection(),
            if (_product?.discount != null && _product!.discount > 0)
              _buildFlashSaleBanner(),
            _buildPriceAndTitleSection(),
            _buildVariantsSection(),
            _buildShopInfoSection(),
            _buildDescriptionSection(),
            const SizedBox(height: 100),
          ],
        ),
      ),
      bottomSheet: _buildBottomBar(),
    );
  }

  Widget _buildImageSection() {
    return Container(
      color: Colors.white,
      child: Stack(
        children: [
          AspectRatio(
            aspectRatio: 1,
            child: Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFFFFF5F2), Color(0xFFFFEAE3)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
              child: Center(
                child: _product?.imageUrl != null && _product!.imageUrl.startsWith('http')
                    ? Image.network(
                        _product!.imageUrl,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Text(
                          _product?.emoji.isNotEmpty == true ? _product!.emoji : '🛍️',
                          style: const TextStyle(fontSize: 100),
                        ),
                      )
                    : Text(
                        _product?.emoji.isNotEmpty == true ? _product!.emoji : '🛍️',
                        style: const TextStyle(fontSize: 100),
                      ),
              ),
            ),
          ),
          Positioned(
            top: 10,
            left: 10,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(color: const Color(0xFF003366), borderRadius: BorderRadius.circular(2)),
                  child: const Text('MALL', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
                ),
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(color: primaryColor, borderRadius: BorderRadius.circular(2)),
                  child: const Text('Yêu Thích+', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          ),
          Positioned(
            bottom: 10,
            right: 10,
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: const BoxDecoration(color: Colors.black54, shape: BoxShape.circle),
                  child: const Icon(Icons.favorite_border, color: Colors.white, size: 20),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(12)),
                  child: const Text('1/5', style: TextStyle(color: Colors.white, fontSize: 12)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFlashSaleBanner() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFFEE4D2D), Color(0xFFFF7337)],
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '⚡ FLASH SALE',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16, fontStyle: FontStyle.italic),
              ),
              Text(
                'Đang bán rất chạy - Sắp hết hạn',
                style: TextStyle(color: Colors.white, fontSize: 12),
              ),
            ],
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(color: Colors.black87, borderRadius: BorderRadius.circular(4)),
            child: const Text(
              '02 : 45 : 05',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
            ),
          )
        ],
      ),
    );
  }

  Widget _buildPriceAndTitleSection() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(16),
      margin: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                NumberFormat.currency(locale: 'vi_VN', symbol: 'đ', decimalDigits: 0).format(_product?.price ?? 99000.0),
                style: TextStyle(color: primaryColor, fontSize: 24, fontWeight: FontWeight.bold),
              ),
              if ((_product?.originalPrice ?? 180000.0) > (_product?.price ?? 99000.0)) ...[
                const SizedBox(width: 8),
                Text(
                  NumberFormat.currency(locale: 'vi_VN', symbol: 'đ', decimalDigits: 0).format(_product?.originalPrice ?? 180000.0),
                  style: const TextStyle(color: Colors.grey, fontSize: 14, decoration: TextDecoration.lineThrough),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                  decoration: BoxDecoration(color: Colors.red[50], borderRadius: BorderRadius.circular(2)),
                  child: Text('-${_product?.discount ?? 45}%', style: TextStyle(color: primaryColor, fontSize: 12, fontWeight: FontWeight.bold)),
                ),
              ],
            ],
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              border: Border.all(color: Colors.green),
              borderRadius: BorderRadius.circular(4),
            ),
            child: const Text('Freeship Xtra', style: TextStyle(color: Colors.green, fontSize: 10)),
          ),
          const SizedBox(height: 8),
          Text(
            _product?.name ?? 'Áo Thun Cotton Unisex Form Rộng Trơn Thoáng Khí ShopNova Official Co Dãn 4 Chiều Cao Cấp',
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500, height: 1.4),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              const Text('⭐ 4.9', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
              const SizedBox(width: 8),
              Container(width: 1, height: 12, color: Colors.grey[400]),
              const SizedBox(width: 8),
              const Text('3.4k đánh giá', style: TextStyle(fontSize: 13, color: Colors.black87)),
              const SizedBox(width: 8),
              Container(width: 1, height: 12, color: Colors.grey[400]),
              const SizedBox(width: 8),
              const Text('Đã bán 12.8k', style: TextStyle(fontSize: 13, color: Colors.black87)),
            ],
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(color: Colors.orange[50], borderRadius: BorderRadius.circular(4)),
            child: const Text('⚡ Hỏa Tốc 2H', style: TextStyle(color: Colors.deepOrange, fontSize: 12)),
          )
        ],
      ),
    );
  }



  Widget _buildVariantsSection() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(16),
      margin: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Tùy chọn biến thể', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
              Text('Kho: 342 sản phẩm', style: TextStyle(color: Colors.grey, fontSize: 13)),
            ],
          ),
          const SizedBox(height: 16),
          const Text('Màu sắc:', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: colors.map((color) {
              final isSelected = selectedColor == color;
              return GestureDetector(
                onTap: () => setState(() => selectedColor = color),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                  decoration: BoxDecoration(
                    color: isSelected ? Colors.red[50] : Colors.grey[100],
                    border: Border.all(color: isSelected ? primaryColor : Colors.transparent),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 12,
                        height: 12,
                        decoration: BoxDecoration(
                          color: getColorFromString(color),
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.grey[400]!),
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(color, style: TextStyle(fontSize: 12, color: isSelected ? primaryColor : Colors.black87)),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 16),
          const Text('Kích thước:', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: sizes.map((size) {
              final isSelected = selectedSize == size;
              return GestureDetector(
                onTap: () => setState(() => selectedSize = size),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: isSelected ? Colors.red[50] : Colors.grey[100],
                    border: Border.all(color: isSelected ? primaryColor : Colors.transparent),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(size, style: TextStyle(fontSize: 12, color: isSelected ? primaryColor : Colors.black87)),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              const Text('Số lượng:', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
              const Spacer(),
              Row(
                children: [
                  InkWell(
                    onTap: () {
                      if (quantity > 1) setState(() => quantity--);
                    },
                    child: Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(border: Border.all(color: Colors.grey[300]!), borderRadius: const BorderRadius.horizontal(left: Radius.circular(4))),
                      child: const Icon(Icons.remove, size: 16, color: Colors.black54),
                    ),
                  ),
                  Container(
                    width: 40,
                    height: 28,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(border: Border.symmetric(horizontal: BorderSide(color: Colors.grey[300]!))),
                    child: Text('$quantity', style: const TextStyle(fontSize: 14)),
                  ),
                  InkWell(
                    onTap: () => setState(() => quantity++),
                    child: Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(border: Border.all(color: Colors.grey[300]!), borderRadius: const BorderRadius.horizontal(right: Radius.circular(4))),
                      child: const Icon(Icons.add, size: 16, color: Colors.black54),
                    ),
                  ),
                ],
              )
            ],
          )
        ],
      ),
    );
  }

  Widget _buildShopInfoSection() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(16),
      margin: const EdgeInsets.only(bottom: 8),
      child: Column(
        children: [
          Row(
            children: [
              const CircleAvatar(
                radius: 24,
                backgroundColor: Colors.grey,
                child: Icon(Icons.store, color: Colors.white),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${_product?.shopName.isNotEmpty == true ? _product!.shopName : "Nova Official Store"} [MALL]', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                    const SizedBox(height: 4),
                    Text('Online 5 phút trước', style: TextStyle(color: Colors.grey[600], fontSize: 12)),
                  ],
                ),
              ),
              OutlinedButton(
                onPressed: () {},
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  minimumSize: const Size(0, 32),
                ),
                child: const Text('Xem Shop', style: TextStyle(fontSize: 12, color: Colors.black87)),
              ),
              const SizedBox(width: 8),
              ElevatedButton(
                onPressed: () {},
                style: ElevatedButton.styleFrom(
                  backgroundColor: primaryColor,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  minimumSize: const Size(0, 32),
                ),
                child: const Text('+ Theo dõi', style: TextStyle(fontSize: 12)),
              )
            ],
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildShopStat('4.9/5.0', '(48k Đánh giá)'),
              _buildShopStat('99%', '(Phản hồi)'),
              _buildShopStat('100%', '(Chính hãng)'),
            ],
          )
        ],
      ),
    );
  }

  Widget _buildShopStat(String title, String subtitle) {
    return Column(
      children: [
        Text(title, style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold, fontSize: 13)),
        const SizedBox(height: 4),
        Text(subtitle, style: const TextStyle(color: Colors.grey, fontSize: 11)),
      ],
    );
  }



  Widget _buildDescriptionSection() {
    final desc = _product?.description.isNotEmpty == true ? _product!.description : 'Chất liệu 100% cotton cao cấp, thấm hút mồ hôi, co giãn 4 chiều.';
    final specs = _product?.specs ?? {};

    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(16),
      width: double.infinity,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Mô tả sản phẩm', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
          const SizedBox(height: 12),
          Text(desc, style: const TextStyle(fontSize: 13, height: 1.5)),
          if (specs.isNotEmpty) ...[
            const SizedBox(height: 16),
            const Text('Chi tiết thông số', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
            const SizedBox(height: 8),
            ...specs.entries.map((e) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 2),
              child: Text('• ${e.key}: ${e.value}', style: const TextStyle(fontSize: 13, color: Colors.black87)),
            )),
          ],
        ],
      ),
    );
  }

  Widget _buildBottomBar() {
    return Container(
      height: 60,
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Colors.grey[300]!)),
      ),
      child: Row(
        children: [
          Expanded(
            flex: 2,
            child: InkWell(
              onTap: () {},
              child: const Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.chat_bubble_outline, size: 20),
                  Text('Chat Shop', style: TextStyle(fontSize: 10)),
                ],
              ),
            ),
          ),
          Container(width: 1, color: Colors.grey[300]),
          Expanded(
            flex: 2,
            child: InkWell(
              onTap: () {
                final p = _product;
                CartService().addToCart(
                  productId: widget.productId ?? p?.id ?? '1',
                  productName: p?.name ?? 'Sản phẩm ShopNova',
                  productSlug: p?.id ?? '1',
                  variantName: '$selectedColor - $selectedSize',
                  price: p?.price ?? 180000,
                  originalPrice: p?.originalPrice,
                  qty: quantity,
                  imageUrl: p?.images.isNotEmpty == true ? p!.images.first : (p?.imageUrl ?? ''),
                );
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Đã thêm sản phẩm vào giỏ hàng thành công!'),
                    backgroundColor: Colors.green,
                    duration: Duration(seconds: 2),
                  ),
                );
              },
              child: const Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.add_shopping_cart, size: 20),
                  Text('Thêm giỏ', style: TextStyle(fontSize: 10)),
                ],
              ),
            ),
          ),
          Expanded(
            flex: 5,
            child: InkWell(
              onTap: () {
                final p = _product;
                CartService().addToCart(
                  productId: widget.productId ?? p?.id ?? '1',
                  productName: p?.name ?? 'Sản phẩm ShopNova',
                  productSlug: p?.id ?? '1',
                  variantName: '$selectedColor - $selectedSize',
                  price: p?.price ?? 180000,
                  originalPrice: p?.originalPrice,
                  qty: quantity,
                  imageUrl: p?.images.isNotEmpty == true ? p!.images.first : (p?.imageUrl ?? ''),
                );
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const CartScreen()),
                );
              },
              child: Container(
                color: primaryColor,
                child: const Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text('MUA VỚI VOUCHER', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                    Text('Cầm thêm 20k tại bước thanh toán', style: TextStyle(color: Colors.white70, fontSize: 10)),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
