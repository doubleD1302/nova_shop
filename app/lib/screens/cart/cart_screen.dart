import 'package:flutter/material.dart';
import 'package:shopnova/screens/checkout/checkout_screen.dart';

class CartScreen extends StatefulWidget {
  const CartScreen({super.key});

  @override
  State<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends State<CartScreen> {
  final Color primaryColor = const Color(0xFFEE4D2D);
  bool selectAll = true;
  bool shop1Selected = true;
  bool shop2Selected = true;
  bool item1Selected = true;
  bool item2Selected = true;
  bool item3Selected = true;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F5),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leadingWidth: 130,
        leading: const Padding(
          padding: EdgeInsets.only(left: 12),
          child: Row(
            children: [
              Icon(Icons.shopping_bag, color: Color(0xFFEE4D2D)),
              SizedBox(width: 4),
              Text('ShopNova', style: TextStyle(color: Color(0xFFEE4D2D), fontWeight: FontWeight.bold)),
            ],
          ),
        ),
        title: Container(
          height: 36,
          decoration: BoxDecoration(
            color: Colors.grey[100],
            borderRadius: BorderRadius.circular(4),
          ),
          child: const TextField(
            decoration: InputDecoration(
              hintText: 'Tìm...',
              hintStyle: TextStyle(fontSize: 14),
              prefixIcon: Icon(Icons.search, size: 20),
              border: InputBorder.none,
              contentPadding: EdgeInsets.symmetric(vertical: 8),
            ),
          ),
        ),
        actions: [
          IconButton(icon: const Icon(Icons.notifications_none, color: Colors.black87), onPressed: () {}),
          Stack(
            alignment: Alignment.center,
            children: [
              IconButton(icon: const Icon(Icons.shopping_cart_outlined, color: Colors.black87), onPressed: () {}),
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
                  child: const Text('3', style: TextStyle(color: Colors.white, fontSize: 10), textAlign: TextAlign.center),
                ),
              )
            ],
          ),
        ],
      ),
      body: Column(
        children: [
          Container(
            color: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Giỏ hàng (3 món)', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                Text('Sửa', style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold)),
              ],
            ),
          ),
          Expanded(
            child: SingleChildScrollView(
              child: Column(
                children: [
                  _buildFreeshipBanner(),
                  const SizedBox(height: 8),
                  _buildShop1(),
                  const SizedBox(height: 8),
                  _buildShop2(),
                  const SizedBox(height: 8),
                  _buildAiBanner(),
                  const SizedBox(height: 8),
                  _buildVouchers(),
                  const SizedBox(height: 16),
                ],
              ),
            ),
          ),
          _buildBottomBar(),
        ],
      ),
    );
  }

  Widget _buildFreeshipBanner() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(12),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(color: Colors.red[50], shape: BoxShape.circle),
            child: Icon(Icons.local_shipping, color: primaryColor, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                RichText(
                  text: TextSpan(
                    style: const TextStyle(color: Colors.black87, fontSize: 13),
                    children: [
                      const TextSpan(text: 'Mua thêm '),
                      TextSpan(text: '51.000đ', style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold)),
                      const TextSpan(text: ' để được Miễn phí vận chuyển'),
                    ],
                  ),
                ),
                const SizedBox(height: 4),
                const Text('Áp dụng Freeship Xtra toàn quốc...', style: TextStyle(color: Colors.grey, fontSize: 12)),
                const SizedBox(height: 8),
                LinearProgressIndicator(
                  value: 0.7,
                  backgroundColor: Colors.grey[200],
                  valueColor: AlwaysStoppedAnimation<Color>(primaryColor),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Text('Mua thêm', style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold, fontSize: 13)),
        ],
      ),
    );
  }

  Widget _buildShop1() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(12),
      child: Column(
        children: [
          Row(
            children: [
              Checkbox(
                value: shop1Selected,
                onChanged: (val) => setState(() => shop1Selected = val!),
                activeColor: primaryColor,
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                decoration: BoxDecoration(color: const Color(0xFF003366), borderRadius: BorderRadius.circular(2)),
                child: const Text('MALL', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
              ),
              const SizedBox(width: 8),
              const Text('Nova Official Store', style: TextStyle(fontWeight: FontWeight.bold)),
              const Icon(Icons.chevron_right, color: Colors.grey),
              const Spacer(),
              const Text('Voucher shop', style: TextStyle(color: Color(0xFF003366), fontSize: 12)),
            ],
          ),
          _buildCartItem(
            selected: item1Selected,
            onChanged: (val) => setState(() => item1Selected = val!),
            title: 'Áo Thun Cotton Form Rộn...',
            variant: 'Phân loại: Đen, L',
            price: '99.000đ',
            originalPrice: '150.000đ',
          ),
          const SizedBox(height: 12),
          _buildCartItem(
            selected: item2Selected,
            onChanged: (val) => setState(() => item2Selected = val!),
            title: 'Quần Short Kaki Ống Rộn...',
            variant: 'Phân loại: Be, M',
            price: '165.000đ',
            originalPrice: '220.000đ',
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(color: Colors.red[50], borderRadius: BorderRadius.circular(4)),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                  decoration: BoxDecoration(color: Colors.red[200], borderRadius: BorderRadius.circular(2)),
                  child: const Text('GIẢM 15K', style: TextStyle(color: Colors.red, fontSize: 10, fontWeight: FontWeight.bold)),
                ),
                const SizedBox(width: 8),
                const Text('Đơn từ 200k từ Nova Official', style: TextStyle(fontSize: 12)),
                const Spacer(),
                const Text('Đã lưu', style: TextStyle(color: Colors.red, fontSize: 12, fontWeight: FontWeight.bold)),
              ],
            ),
          )
        ],
      ),
    );
  }

  Widget _buildShop2() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(12),
      child: Column(
        children: [
          Row(
            children: [
              Checkbox(
                value: shop2Selected,
                onChanged: (val) => setState(() => shop2Selected = val!),
                activeColor: primaryColor,
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                decoration: BoxDecoration(color: primaryColor, borderRadius: BorderRadius.circular(2)),
                child: const Text('Yêu Thích+', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
              ),
              const SizedBox(width: 8),
              const Text('TechNova Phụ ...', style: TextStyle(fontWeight: FontWeight.bold)),
              const Icon(Icons.chevron_right, color: Colors.grey),
              const Spacer(),
              const Text('Voucher shop', style: TextStyle(color: Color(0xFF003366), fontSize: 12)),
            ],
          ),
          _buildCartItem(
            selected: item3Selected,
            onChanged: (val) => setState(() => item3Selected = val!),
            title: 'Củ sạc nhanh GaN 30W...',
            variant: 'Phân loại: Trắng bóng',
            price: '145.000đ',
            originalPrice: '190.000đ',
          ),
        ],
      ),
    );
  }

  Widget _buildCartItem({
    required bool selected,
    required Function(bool?) onChanged,
    required String title,
    required String variant,
    required String price,
    required String originalPrice,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Checkbox(
          value: selected,
          onChanged: onChanged,
          activeColor: primaryColor,
        ),
        Container(
          width: 80,
          height: 80,
          decoration: BoxDecoration(
            color: Colors.grey[300],
            borderRadius: BorderRadius.circular(4),
          ),
          child: const Icon(Icons.image, color: Colors.grey),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text(title, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13)),
                  ),
                  const Icon(Icons.close, size: 16, color: Colors.grey),
                ],
              ),
              const SizedBox(height: 4),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(color: Colors.grey[100], borderRadius: BorderRadius.circular(2)),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(variant, style: const TextStyle(color: Colors.grey, fontSize: 11)),
                    const Icon(Icons.keyboard_arrow_down, size: 12, color: Colors.grey),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Text(price, style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold, fontSize: 14)),
                      const SizedBox(width: 4),
                      Text(originalPrice, style: const TextStyle(color: Colors.grey, decoration: TextDecoration.lineThrough, fontSize: 12)),
                    ],
                  ),
                  Row(
                    children: [
                      Container(
                        width: 24, height: 24,
                        decoration: BoxDecoration(border: Border.all(color: Colors.grey[300]!)),
                        child: const Icon(Icons.remove, size: 14, color: Colors.black54),
                      ),
                      Container(
                        width: 32, height: 24,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(border: Border.symmetric(horizontal: BorderSide(color: Colors.grey[300]!))),
                        child: const Text('1', style: TextStyle(fontSize: 13)),
                      ),
                      Container(
                        width: 24, height: 24,
                        decoration: BoxDecoration(border: Border.all(color: Colors.grey[300]!)),
                        child: const Icon(Icons.add, size: 14, color: Colors.black54),
                      ),
                    ],
                  )
                ],
              )
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildAiBanner() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(12),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.red[50],
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: const BoxDecoration(color: Color(0xFFEE4D2D), shape: BoxShape.circle),
                  child: const Icon(Icons.auto_awesome, color: Colors.white, size: 16),
                ),
                const SizedBox(width: 8),
                const Text('Nova AI Khuyên Dùng', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF6B1B1B))),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(color: const Color(0xFFEE4D2D).withOpacity(0.2), borderRadius: BorderRadius.circular(4)),
                  child: const Text('TỐI ƯU TIẾT KIỆM', style: TextStyle(color: Color(0xFF6B1B1B), fontSize: 10, fontWeight: FontWeight.bold)),
                )
              ],
            ),
            const SizedBox(height: 8),
            RichText(
              text: const TextSpan(
                style: TextStyle(color: Colors.black87, fontSize: 13, height: 1.4),
                children: [
                  TextSpan(text: 'Bạn đang chọn 2 món cùng Shop! Gợi ý thêm '),
                  TextSpan(text: 'Túi Canvas Đen (65.000đ)', style: TextStyle(color: Color(0xFFEE4D2D), fontWeight: FontWeight.bold)),
                  TextSpan(text: ' để kích hoạt mã giảm '),
                  TextSpan(text: '30k toàn sàn.', style: TextStyle(fontWeight: FontWeight.bold)),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                ElevatedButton.icon(
                  onPressed: () {},
                  icon: const Icon(Icons.add_shopping_cart, size: 16),
                  label: const Text('Thêm nhanh (65k)', style: TextStyle(fontSize: 12)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFEE4D2D),
                    foregroundColor: Colors.white,
                    minimumSize: const Size(0, 36),
                  ),
                ),
                const SizedBox(width: 12),
                const Text('Xem chi tiết', style: TextStyle(color: Color(0xFF003366), fontWeight: FontWeight.bold, fontSize: 13)),
              ],
            )
          ],
        ),
      ),
    );
  }

  Widget _buildVouchers() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          Row(
            children: [
              const Icon(Icons.local_activity, color: Color(0xFFEE4D2D)),
              const SizedBox(width: 8),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('ShopNova Voucher', style: TextStyle(fontWeight: FontWeight.bold)),
                    SizedBox(height: 2),
                    Text('Miễn Phí Vận Chuyển Xtra', style: TextStyle(color: Colors.green, fontSize: 12)),
                  ],
                ),
              ),
              const Text('Chọn hoặc nhập mã >', style: TextStyle(color: Colors.grey, fontSize: 13)),
            ],
          ),
          const Divider(height: 24),
          Row(
            children: [
              const Icon(Icons.monetization_on, color: Colors.blue),
              const SizedBox(width: 8),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text('Dùng 15.000 Nova Xu', style: TextStyle(fontWeight: FontWeight.bold)),
                        SizedBox(width: 8),
                        Text('[-15.000đ]', style: TextStyle(color: Color(0xFFEE4D2D))),
                      ],
                    ),
                    SizedBox(height: 2),
                    Text('Số dư khả dụng: 15.000 xu', style: TextStyle(color: Colors.grey, fontSize: 12)),
                  ],
                ),
              ),
              Switch(
                value: true,
                onChanged: (val) {},
                activeColor: primaryColor,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildBottomBar() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Colors.grey[300]!)),
      ),
      child: SafeArea(
        child: Row(
          children: [
            Row(
              children: [
                Checkbox(
                  value: selectAll,
                  onChanged: (val) => setState(() => selectAll = val!),
                  activeColor: primaryColor,
                ),
                const Text('Tất cả\n(3)', style: TextStyle(fontSize: 12), textAlign: TextAlign.center),
              ],
            ),
            const Spacer(),
            Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Row(
                  children: [
                    const Text('Tổng: ', style: TextStyle(fontSize: 13)),
                    Text(
                      '394.000đ',
                      style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold, fontSize: 16),
                    ),
                  ],
                ),
                const Row(
                  children: [
                    Text('Tiết kiệm 76.000đ', style: TextStyle(color: Colors.green, fontSize: 11)),
                    SizedBox(width: 4),
                    Icon(Icons.info_outline, size: 12, color: Colors.green),
                  ],
                ),
              ],
            ),
            const SizedBox(width: 12),
            GestureDetector(
              onTap: () {
                Navigator.push(context, MaterialPageRoute(builder: (context) => const CheckoutScreen()));
              },
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                color: primaryColor,
                child: const Text(
                  'Mua Hàng (3)',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
