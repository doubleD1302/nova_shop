import 'package:flutter/material.dart';

class ShopScreen extends StatelessWidget {
  const ShopScreen({super.key});
  final Color primaryColor = const Color(0xFFEE4D2D);

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
          decoration: BoxDecoration(color: Colors.grey[100], borderRadius: BorderRadius.circular(4)),
          child: const TextField(
            decoration: InputDecoration(
              hintText: 'Tìm kiếm gian hàng, thương hi...',
              hintStyle: TextStyle(fontSize: 13),
              prefixIcon: Icon(Icons.storefront, size: 18),
              border: InputBorder.none,
              contentPadding: EdgeInsets.symmetric(vertical: 8),
            ),
          ),
        ),
        actions: [
          Stack(
            alignment: Alignment.center,
            children: [
              IconButton(icon: const Icon(Icons.shopping_cart_outlined, color: Colors.black87), onPressed: () {}),
              Positioned(
                right: 8, top: 8,
                child: Container(
                  padding: const EdgeInsets.all(2),
                  decoration: BoxDecoration(color: primaryColor, borderRadius: BorderRadius.circular(10)),
                  constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                  child: const Text('0', style: TextStyle(color: Colors.white, fontSize: 10), textAlign: TextAlign.center),
                ),
              )
            ],
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(84),
          child: Column(
            children: [
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                child: Row(
                  children: [
                    _buildFilterChip('Nova Mall', Icons.stars, Colors.red),
                    _buildFilterChip('Yêu Thích+', Icons.favorite_border, Colors.grey),
                    _buildFilterChip('Giao 2H', Icons.bolt, Colors.green),
                    _buildFilterChip('Đánh giá 4*+', Icons.star_border, Colors.orange),
                  ],
                ),
              ),
              Container(
                decoration: BoxDecoration(border: Border(bottom: BorderSide(color: Colors.grey[200]!))),
                child: Row(
                  children: [
                    _buildTab('Tất cả Shop', true),
                    _buildTab('Nova Mall', false),
                    _buildTab('Shop Yêu Thích', false),
                    _buildTab('Giao Hỏa Tốc', false),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            _buildMainBanner(),
            _buildAiBanner(),
            _buildOfficialStores(),
            _buildTrendingShops(),
            _buildAllShops(),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterChip(String label, IconData icon, Color iconColor) {
    return Container(
      margin: const EdgeInsets.only(right: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: Colors.grey[300]!),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        children: [
          Icon(icon, size: 14, color: iconColor),
          const SizedBox(width: 4),
          Text(label, style: const TextStyle(fontSize: 12)),
        ],
      ),
    );
  }

  Widget _buildTab(String title, bool isActive) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border(bottom: BorderSide(color: isActive ? primaryColor : Colors.transparent, width: 2)),
        ),
        child: Text(
          title,
          textAlign: TextAlign.center,
          style: TextStyle(
            color: isActive ? primaryColor : Colors.grey[600],
            fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
            fontSize: 13,
          ),
        ),
      ),
    );
  }

  Widget _buildMainBanner() {
    return Container(
      margin: const EdgeInsets.all(12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(colors: [Colors.red[800]!, Colors.orange[800]!]),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(4)),
                child: const Text('SIÊU ĐẠI HỘI THƯƠNG HIỆU', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
              ),
              const Icon(Icons.stars, color: Colors.amber),
            ],
          ),
          const SizedBox(height: 8),
          const Text('Tuần Lễ Thương Hiệu & Siêu Sale Gian Hàng', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          const Text('Voucher đến 100k, đại tiệc giảm giá tới 50% + Freeship...', style: TextStyle(color: Colors.white70, fontSize: 12)),
          const SizedBox(height: 12),
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(color: Colors.amber, borderRadius: BorderRadius.circular(4)),
                child: const Text('MÃ: MALLWEEK80', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Text('Hạn dùng: 23:59 hôm nay', style: TextStyle(color: Colors.white, fontSize: 12)),
              ),
              ElevatedButton(
                onPressed: () {},
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: primaryColor,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                ),
                child: const Text('Lấy Mã Ngay', style: TextStyle(fontWeight: FontWeight.bold)),
              )
            ],
          )
        ],
      ),
    );
  }

  Widget _buildAiBanner() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.red[100]!),
      ),
      child: Column(
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: const BoxDecoration(color: Color(0xFFEE4D2D), shape: BoxShape.circle),
                child: const Icon(Icons.auto_awesome, color: Colors.white, size: 16),
              ),
              const SizedBox(width: 8),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text('Nova AI • Gợi Ý Gian Hàng Cho Bạn', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                        SizedBox(width: 4),
                        Text('ĐỀ XUẤT', style: TextStyle(color: Colors.red, fontSize: 9, fontWeight: FontWeight.bold)),
                      ],
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Dựa vào các sản phẩm bạn vừa xem, Nova AI đề xuất 3 shop thời trang tối giản & phụ kiện công nghệ có hỗ trợ giao hỏa tốc 2H.',
                      style: TextStyle(color: Colors.grey, fontSize: 11),
                    )
                  ],
                ),
              )
            ],
          ),
          const SizedBox(height: 12),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _buildAiShopChip('Nova Official Store', Icons.store),
                _buildAiShopChip('Baseus Vietnam', Icons.headphones),
                _buildAiShopChip('Coolmate', Icons.checkroom),
              ],
            ),
          )
        ],
      ),
    );
  }

  Widget _buildAiShopChip(String name, IconData icon) {
    return Container(
      margin: const EdgeInsets.only(right: 8),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(border: Border.all(color: Colors.grey[300]!), borderRadius: BorderRadius.circular(16)),
      child: Row(
        children: [
          Icon(icon, size: 12, color: primaryColor),
          const SizedBox(width: 4),
          Text(name, style: const TextStyle(fontSize: 11)),
        ],
      ),
    );
  }

  Widget _buildOfficialStores() {
    return Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.symmetric(vertical: 12),
      color: Colors.white,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Row(
                  children: [
                    Icon(Icons.verified, color: Colors.red, size: 18),
                    SizedBox(width: 4),
                    Text('Thương Hiệu Chính Hãng Nova Mall', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                  ],
                ),
                Text('Xem tất cả (48) >', style: TextStyle(color: primaryColor, fontSize: 12)),
              ],
            ),
          ),
          const SizedBox(height: 12),
          _buildStoreCard('Nova Official Store', '1.2M', 'Giảm 50.000đ đơn từ 300k', ['99.000đ', '165.000đ', '65.000đ']),
          const Divider(),
          _buildStoreCard('TechNova Global', '850k', 'Giảm 20% phụ kiện sạc nhanh', ['249.000đ', '490.000đ', '89.000đ']),
          const Divider(),
          _buildStoreCard('Coolmate Official', '420k', 'Freeship Xtra mọi đơn hàng từ 99k', ['149.000đ', '199.000đ', '129.000đ']),
        ],
      ),
    );
  }

  Widget _buildStoreCard(String name, String followers, String voucher, List<String> prices) {
    return Padding(
      padding: const EdgeInsets.all(12),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                width: 48, height: 48,
                decoration: BoxDecoration(color: Colors.grey[200], borderRadius: BorderRadius.circular(4), border: Border.all(color: Colors.grey[300]!)),
                child: const Icon(Icons.store, color: Colors.grey),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(Icons.star, color: Colors.amber, size: 12),
                        const Text(' 4.9 • ', style: TextStyle(fontSize: 12)),
                        Text('$followers theo dõi • TP.HCM', style: const TextStyle(fontSize: 12, color: Colors.grey)),
                      ],
                    ),
                  ],
                ),
              ),
              OutlinedButton(
                onPressed: () {},
                style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 8), minimumSize: const Size(0, 32)),
                child: const Text('+ Theo dõi', style: TextStyle(color: Color(0xFFEE4D2D), fontSize: 12)),
              ),
              const SizedBox(width: 8),
              ElevatedButton(
                onPressed: () {},
                style: ElevatedButton.styleFrom(backgroundColor: primaryColor, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(horizontal: 8), minimumSize: const Size(0, 32)),
                child: const Text('Vào Shop', style: TextStyle(fontSize: 12)),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
            decoration: BoxDecoration(color: Colors.red[50], borderRadius: BorderRadius.circular(4)),
            child: Row(
              children: [
                const Icon(Icons.local_activity, color: Colors.red, size: 14),
                const SizedBox(width: 8),
                Expanded(child: Text('Voucher shop: $voucher', style: const TextStyle(color: Colors.red, fontSize: 12))),
                const Text('Lưu mã', style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold, fontSize: 12)),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: prices.map((price) => Expanded(
              child: Container(
                margin: const EdgeInsets.only(right: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    AspectRatio(
                      aspectRatio: 1,
                      child: Container(color: Colors.grey[200], child: const Icon(Icons.image, color: Colors.grey)),
                    ),
                    const SizedBox(height: 4),
                    Text(price, style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold, fontSize: 13)),
                  ],
                ),
              ),
            )).toList(),
          )
        ],
      ),
    );
  }

  Widget _buildTrendingShops() {
    return Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.symmetric(vertical: 12),
      color: Colors.white,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Icon(Icons.thumb_up, color: Colors.red, size: 18),
                    SizedBox(width: 4),
                    Text('Shop Yêu Thích Nổi Bật Tuần Này', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                  ],
                ),
                Text('Xem thêm >', style: TextStyle(color: Color(0xFFEE4D2D), fontSize: 12)),
              ],
            ),
          ),
          const SizedBox(height: 12),
          _buildTrendingTile('Gốm Xinh Studio & Decor', '4.9', '12.5k', 'Giảm 15k'),
          _buildTrendingTile('Bếp Chay An Lạc - Thực Phẩm...', '5.0', '8.5k', 'Freeship 0đ'),
          _buildTrendingTile('Tiệm Giày Sneaker 247', '4.8', '15.2k', 'Giảm 30k'),
        ],
      ),
    );
  }

  Widget _buildTrendingTile(String name, String rating, String sold, String tag) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: Row(
        children: [
          Container(
            width: 40, height: 40,
            decoration: BoxDecoration(color: Colors.grey[200], borderRadius: BorderRadius.circular(4)),
            child: const Icon(Icons.store, color: Colors.grey),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                const SizedBox(height: 4),
                Row(
                  children: [
                    const Icon(Icons.star, color: Colors.amber, size: 12),
                    Text(' $rating', style: const TextStyle(fontSize: 11)),
                    Text(' • Đã bán $sold', style: const TextStyle(color: Colors.grey, fontSize: 11)),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                      decoration: BoxDecoration(color: Colors.red[50], borderRadius: BorderRadius.circular(2)),
                      child: Text(tag, style: const TextStyle(color: Colors.red, fontSize: 9)),
                    )
                  ],
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(color: Colors.grey[100], borderRadius: BorderRadius.circular(4)),
            child: const Text('Vào Shop', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
          )
        ],
      ),
    );
  }

  Widget _buildAllShops() {
    return Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.all(12),
      color: Colors.white,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Tất Cả Gian Hàng Đang Có Ưu Đãi Lớn', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
              Row(
                children: [
                  const Text('Lọc:', style: TextStyle(fontSize: 12, color: Colors.grey)),
                  const SizedBox(width: 4),
                  const Text('Gần bạn', style: TextStyle(fontSize: 12, color: Color(0xFFEE4D2D))),
                  Icon(Icons.keyboard_arrow_down, size: 14, color: primaryColor),
                ],
              )
            ],
          ),
          const SizedBox(height: 12),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: 8,
            mainAxisSpacing: 8,
            childAspectRatio: 1.5,
            children: [
              _buildSmallShopCard('Arden & Vinamik', 'TP. Hồ Chí Minh', 'Mã -40.000đ'),
              _buildSmallShopCard('Baseus Vietnam', 'Hà Nội', 'Mã -50.000đ'),
              _buildSmallShopCard('X-Street Studio', 'Đà Nẵng', 'Mã -15%'),
              _buildSmallShopCard('Cosmetics Korea', 'TP. Hồ Chí Minh', 'Freeship 0đ'),
            ],
          ),
          const SizedBox(height: 16),
          Center(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              decoration: BoxDecoration(color: Colors.grey[100], borderRadius: BorderRadius.circular(20)),
              child: const Text('Xem thêm 3.420 gian hàng v', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
            ),
          )
        ],
      ),
    );
  }

  Widget _buildSmallShopCard(String name, String loc, String promo) {
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        border: Border.all(color: Colors.grey[200]!),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 24, height: 24,
                decoration: BoxDecoration(color: Colors.grey[200], borderRadius: BorderRadius.circular(4)),
                child: const Icon(Icons.store, size: 14, color: Colors.grey),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
              ),
            ],
          ),
          const Spacer(),
          Text(loc, style: const TextStyle(color: Colors.grey, fontSize: 10)),
          const SizedBox(height: 4),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(promo, style: TextStyle(color: primaryColor, fontSize: 11, fontWeight: FontWeight.bold)),
              const Text('Xem Shop', style: TextStyle(color: Colors.blue, fontSize: 10)),
            ],
          )
        ],
      ),
    );
  }
}
