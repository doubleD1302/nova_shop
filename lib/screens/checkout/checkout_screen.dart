import 'package:flutter/material.dart';

class CheckoutScreen extends StatelessWidget {
  const CheckoutScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F5),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFFEE4D2D)),
          onPressed: () {},
        ),
        title: const Text(
          'Shopnova Thanh Toán Đặt H...',
          style: TextStyle(color: Colors.black, fontSize: 18),
          overflow: TextOverflow.ellipsis,
        ),
        actions: [
          Stack(
            alignment: Alignment.center,
            children: [
              IconButton(
                icon: const Icon(Icons.shopping_cart_outlined, color: Color(0xFFEE4D2D)),
                onPressed: () {},
              ),
              Positioned(
                right: 8,
                top: 8,
                child: Container(
                  padding: const EdgeInsets.all(2),
                  decoration: BoxDecoration(
                    color: Colors.red,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  constraints: const BoxConstraints(
                    minWidth: 16,
                    minHeight: 16,
                  ),
                  child: const Text(
                    '3',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 10,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ),
              )
            ],
          ),
          IconButton(
            icon: const Icon(Icons.home_outlined, color: Color(0xFFEE4D2D)),
            onPressed: () {},
          ),
        ],
      ),
      body: Column(
        children: [
          Container(
            height: 3,
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [Colors.red, Colors.blue],
                stops: [0.5, 0.5],
                tileMode: TileMode.repeated,
              ),
            ),
          ),
          Expanded(
            child: SingleChildScrollView(
              child: Column(
                children: [
                  _buildAddressSection(),
                  const SizedBox(height: 8),
                  _buildShopSection(),
                  const SizedBox(height: 8),
                  _buildPaymentMethods(),
                  const SizedBox(height: 8),
                  _buildVouchers(),
                  const SizedBox(height: 8),
                  _buildPaymentDetails(),
                  const SizedBox(height: 8),
                  _buildSecurityNotice(),
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

  Widget _buildAddressSection() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.location_on, color: Color(0xFFEE4D2D)),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Địa Chỉ Nhận Hàng',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    const Text(
                      'Nguyễn Văn A (+84) 0987654321',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                      decoration: BoxDecoration(
                        border: Border.all(color: const Color(0xFFEE4D2D)),
                        borderRadius: BorderRadius.circular(2),
                      ),
                      child: const Text(
                        '[Mặc định]',
                        style: TextStyle(color: Color(0xFFEE4D2D), fontSize: 10),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                const Text(
                  'Tòa nhà Landmark 81, P. 2205, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
                  style: TextStyle(color: Colors.black54),
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_right, color: Colors.grey),
        ],
      ),
    );
  }

  Widget _buildShopSection() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0xFFEE4D2D),
                  borderRadius: BorderRadius.circular(2),
                ),
                child: const Text(
                  'MALL',
                  style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                ),
              ),
              const SizedBox(width: 8),
              const Text('Nova Official Store', style: TextStyle(fontWeight: FontWeight.bold)),
              const Spacer(),
              const Icon(Icons.chat, color: Colors.green, size: 16),
              const SizedBox(width: 4),
              const Text('Chat ngay', style: TextStyle(color: Colors.green, fontSize: 12)),
            ],
          ),
          const SizedBox(height: 12),
          _buildItem(
            'Tai Nghe Không Dây Nova Sound...',
            'Màu: Đen Huyền Bí',
            '299.000đ',
            'x1',
          ),
          const SizedBox(height: 12),
          _buildItem(
            'Ly Giữ Nhiệt Nova Steel 550ml Inox...',
            'Màu: Xám Titan',
            '110.000đ',
            'x1',
          ),
          const Divider(),
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.green.shade50,
              borderRadius: BorderRadius.circular(4),
              border: Border.all(color: Colors.green.shade200),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.local_shipping, color: Colors.green, size: 16),
                    const SizedBox(width: 8),
                    const Text('Nova Express - Hỏa Tốc 2H', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.green)),
                    const Spacer(),
                    const Text(
                      '25.000đ',
                      style: TextStyle(decoration: TextDecoration.lineThrough, color: Colors.grey, fontSize: 12),
                    ),
                    const SizedBox(width: 4),
                    const Text('0đ', style: TextStyle(fontWeight: FontWeight.bold)),
                  ],
                ),
                const SizedBox(height: 4),
                const Text('Cam kết nhận hàng trước 16:30 hôm nay', style: TextStyle(color: Colors.green, fontSize: 12)),
                const SizedBox(height: 4),
                const Text('Đã áp voucher Freeship -25.000đ', style: TextStyle(color: Colors.grey, fontSize: 12)),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              const Text('Tin nhắn:', style: TextStyle(fontWeight: FontWeight.w500)),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  decoration: InputDecoration(
                    hintText: 'Lưu ý cho shop...',
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                    border: OutlineInputBorder(
                      borderSide: BorderSide(color: Colors.grey.shade300),
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              Text('Tổng số tiền (2 sản phẩm): '),
              Text(
                '409.000đ',
                style: TextStyle(color: Color(0xFFEE4D2D), fontWeight: FontWeight.bold),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildItem(String title, String variant, String price, String qty) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 60,
          height: 60,
          color: Colors.grey.shade300,
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, maxLines: 2, overflow: TextOverflow.ellipsis),
              const SizedBox(height: 4),
              Text(variant, style: const TextStyle(color: Colors.grey, fontSize: 12)),
              const SizedBox(height: 4),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(price, style: const TextStyle(fontWeight: FontWeight.bold)),
                  Text(qty, style: const TextStyle(color: Colors.grey)),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildPaymentMethods() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Phương Thức Thanh Toán', style: TextStyle(fontWeight: FontWeight.bold)),
              Text('4 tùy chọn >', style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
            ],
          ),
          const SizedBox(height: 12),
          _buildPaymentOption('Ví NovaPay', '+10k Xu, 350.000đ', isSelected: true),
          _buildPaymentOption('VNPay / QR Code', ''),
          _buildPaymentOption('Ví Điện Tử MoMo', ''),
          _buildPaymentOption('Thanh Toán Khi Nhận Hàng (COD)', ''),
        ],
      ),
    );
  }

  Widget _buildPaymentOption(String title, String subtitle, {bool isSelected = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(
            isSelected ? Icons.radio_button_checked : Icons.radio_button_unchecked,
            color: isSelected ? const Color(0xFFEE4D2D) : Colors.grey,
          ),
          const SizedBox(width: 8),
          Text(title, style: TextStyle(color: isSelected ? const Color(0xFFEE4D2D) : Colors.black)),
          if (subtitle.isNotEmpty) ...[
            const SizedBox(width: 4),
            Text('($subtitle)', style: const TextStyle(color: Colors.grey, fontSize: 12)),
          ],
        ],
      ),
    );
  }

  Widget _buildVouchers() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(12),
      child: Column(
        children: [
          Row(
            children: [
              const Icon(Icons.monetization_on, color: Colors.orange, size: 20),
              const SizedBox(width: 8),
              const Text('Dùng 15.000 Nova Xu'),
              const Spacer(),
              const Text('-15.000đ', style: TextStyle(color: Colors.grey)),
              const SizedBox(width: 8),
              Switch(
                value: true,
                onChanged: (val) {},
                activeColor: const Color(0xFFEE4D2D),
              ),
            ],
          ),
          const Divider(),
          Row(
            children: [
              const Icon(Icons.local_activity, color: Color(0xFFEE4D2D), size: 20),
              const SizedBox(width: 8),
              const Text('ShopNova Voucher'),
              const Spacer(),
              const Text('Giảm 30.000đ >', style: TextStyle(color: Color(0xFFEE4D2D))),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentDetails() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Chi Tiết Thanh Toán', style: TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          _buildDetailRow('Tổng tiền hàng', '409.000đ'),
          _buildDetailRow('Phí vận chuyển', '25.000đ'),
          _buildDetailRow('Giảm giá phí vận chuyển', '-25.000đ'),
          _buildDetailRow('Voucher giảm giá', '-30.000đ'),
          _buildDetailRow('Sử dụng Xu', '-15.000đ'),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Tổng thanh toán', style: TextStyle(fontWeight: FontWeight.bold)),
              const Text(
                '364.000đ',
                style: TextStyle(color: Color(0xFFEE4D2D), fontWeight: FontWeight.bold, fontSize: 18),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildDetailRow(String title, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(title, style: const TextStyle(color: Colors.grey)),
          Text(value),
        ],
      ),
    );
  }

  Widget _buildSecurityNotice() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(12),
      child: Row(
        children: [
          Icon(Icons.shield, color: Colors.blue.shade300, size: 20),
          const SizedBox(width: 8),
          const Text('Nova Bảo Hiểm Toàn Diện...', style: TextStyle(color: Colors.grey)),
        ],
      ),
    );
  }

  Widget _buildBottomBar() {
    return Container(
      color: Colors.white,
      child: SafeArea(
        child: Row(
          children: [
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    const Text('Tổng thanh toán', style: TextStyle(fontSize: 12)),
                    const Text(
                      '364.000đ',
                      style: TextStyle(color: Color(0xFFEE4D2D), fontWeight: FontWeight.bold, fontSize: 18),
                    ),
                    const Text('Tiết kiệm 70.000đ', style: TextStyle(color: Colors.orange, fontSize: 12)),
                  ],
                ),
              ),
            ),
            GestureDetector(
              onTap: () {},
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                color: const Color(0xFFEE4D2D),
                child: const Row(
                  children: [
                    Text(
                      'Đặt Hàng',
                      style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                    ),
                    Icon(Icons.arrow_right_alt, color: Colors.white),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
