import 'package:flutter/material.dart';

class ProductDetailScreen extends StatefulWidget {
  const ProductDetailScreen({super.key});

  @override
  State<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends State<ProductDetailScreen> {
  final Color primaryColor = const Color(0xFFEE4D2D);
  
  String selectedColor = 'Trắng Basic';
  String selectedSize = 'L (55-65kg)';
  int quantity = 1;

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
            _buildFlashSaleBanner(),
            _buildPriceAndTitleSection(),
            _buildAiStylistBanner(),
            _buildVariantsSection(),
            _buildShopInfoSection(),
            _buildReviewsPreview(),
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
              color: Colors.grey[300],
              child: const Center(
                child: Icon(Icons.image, size: 100, color: Colors.grey),
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
              Text('đ 99.000', style: TextStyle(color: primaryColor, fontSize: 24, fontWeight: FontWeight.bold)),
              const SizedBox(width: 8),
              const Text('180.000đ', style: TextStyle(color: Colors.grey, fontSize: 14, decoration: TextDecoration.lineThrough)),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                decoration: BoxDecoration(color: Colors.red[50], borderRadius: BorderRadius.circular(2)),
                child: Text('-45%', style: TextStyle(color: primaryColor, fontSize: 12, fontWeight: FontWeight.bold)),
              ),
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
          const Text(
            'Áo Thun Cotton Unisex Form Rộng Trơn Thoáng Khí ShopNova Official Co Dãn 4 Chiều Cao Cấp',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500, height: 1.4),
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

  Widget _buildAiStylistBanner() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(16),
      margin: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.auto_awesome, color: primaryColor, size: 20),
              const SizedBox(width: 8),
              Text(
                'Nova AI Stylist [TRỢ LÝ ẢO]',
                style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold, fontSize: 14),
              ),
            ],
          ),
          const SizedBox(height: 8),
          const Text(
            'Phối cùng Quần Short Kaki và Túi Tote để được giảm thêm 15% trọn bộ combo!',
            style: TextStyle(fontSize: 13, color: Colors.black87),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () {},
                  style: OutlinedButton.styleFrom(
                    foregroundColor: primaryColor,
                    side: BorderSide(color: primaryColor),
                    padding: const EdgeInsets.symmetric(vertical: 8),
                  ),
                  child: const Text('Ướm thử đồ ảo (AI Try-on)', style: TextStyle(fontSize: 12)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: () {},
                  style: ElevatedButton.styleFrom(
                    backgroundColor: primaryColor,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 8),
                  ),
                  child: const Text('Xem Combo', style: TextStyle(fontSize: 12)),
                ),
              ),
            ],
          ),
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
                    const Text('Nova Official Store [MALL]', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
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

  Widget _buildReviewsPreview() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(16),
      margin: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Đánh giá sản phẩm ⭐ 4.9 (3.4k)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
              Text('Xem tất cả >', style: TextStyle(color: primaryColor, fontSize: 13)),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const CircleAvatar(radius: 12, backgroundColor: Colors.grey, child: Icon(Icons.person, size: 16, color: Colors.white)),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('nguyen_van_a', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500)),
                    const Row(children: [
                      Icon(Icons.star, color: Colors.amber, size: 12),
                      Icon(Icons.star, color: Colors.amber, size: 12),
                      Icon(Icons.star, color: Colors.amber, size: 12),
                      Icon(Icons.star, color: Colors.amber, size: 12),
                      Icon(Icons.star, color: Colors.amber, size: 12),
                    ]),
                    const SizedBox(height: 4),
                    const Text('Áo đẹp, chất vải dày dặn mát mẻ, giao hàng nhanh.', style: TextStyle(fontSize: 13)),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Container(
                          width: 40,
                          height: 40,
                          color: Colors.grey[300],
                          child: const Icon(Icons.image, size: 20, color: Colors.grey),
                        ),
                        const SizedBox(width: 8),
                        Container(
                          width: 40,
                          height: 40,
                          color: Colors.grey[300],
                          child: const Icon(Icons.image, size: 20, color: Colors.grey),
                        ),
                      ],
                    )
                  ],
                ),
              )
            ],
          )
        ],
      ),
    );
  }

  Widget _buildDescriptionSection() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(16),
      width: double.infinity,
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Mô tả sản phẩm', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
          SizedBox(height: 12),
          Text('Chất liệu: 100% Cotton Compact 240GSM', style: TextStyle(fontSize: 13, height: 1.5)),
          Text('Xuất xứ: Việt Nam', style: TextStyle(fontSize: 13, height: 1.5)),
          Text('Kiểu dáng: Oversized Relaxed Fit', style: TextStyle(fontSize: 13, height: 1.5)),
          Text('Chính sách bảo hành: Đổi trả 15 ngày miễn phí', style: TextStyle(fontSize: 13, height: 1.5)),
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
              onTap: () {},
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
              onTap: () {},
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
