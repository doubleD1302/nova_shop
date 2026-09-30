import 'package:flutter/material.dart';

class AccountScreen extends StatelessWidget {
  const AccountScreen({super.key});
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
              hintText: 'Tìm...',
              hintStyle: TextStyle(fontSize: 14),
              prefixIcon: Icon(Icons.search, size: 20),
              border: InputBorder.none,
              contentPadding: EdgeInsets.symmetric(vertical: 8),
            ),
          ),
        ),
        actions: [
          Stack(
            alignment: Alignment.center,
            children: [
              IconButton(icon: const Icon(Icons.notifications_none, color: Colors.black87), onPressed: () {}),
              Positioned(
                right: 12, top: 12,
                child: Container(
                  width: 8, height: 8,
                  decoration: const BoxDecoration(color: Colors.red, shape: BoxShape.circle),
                ),
              )
            ],
          ),
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
                  child: const Text('3', style: TextStyle(color: Colors.white, fontSize: 10), textAlign: TextAlign.center),
                ),
              )
            ],
          ),
        ],
      ),
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            children: [
              _buildProfileSection(),
              const SizedBox(height: 12),
              _buildFinanceSection(),
              const SizedBox(height: 12),
              _buildDeliveryStatusSection(),
              const SizedBox(height: 12),
              _buildMyOrdersSection(),
              const SizedBox(height: 12),
              _buildAiBanner(),
              const SizedBox(height: 12),
              _buildServicesSection(),
              const SizedBox(height: 16),
              _buildLogoutButton(),
              const SizedBox(height: 16),
              const Text('ShopNova Mobile App v3.4.1(Build 2024.10)', style: TextStyle(color: Colors.grey, fontSize: 12)),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildProfileSection() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
      child: Column(
        children: [
          Row(
            children: [
              Stack(
                children: [
                  const CircleAvatar(
                    radius: 30,
                    backgroundColor: Colors.grey,
                    child: Icon(Icons.person, size: 40, color: Colors.white),
                  ),
                  Positioned(
                    right: 0, bottom: 0,
                    child: Container(
                      padding: const EdgeInsets.all(2),
                      decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                      child: const Icon(Icons.verified, color: Colors.red, size: 16),
                    ),
                  )
                ],
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Nguyễn Văn A', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 4),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(color: Colors.blue[50], borderRadius: BorderRadius.circular(12)),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.workspace_premium, color: Colors.red, size: 12),
                          SizedBox(width: 4),
                          Text('Thành viên Vàng', style: TextStyle(color: Color(0xFF003366), fontSize: 10, fontWeight: FontWeight.bold)),
                        ],
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Text('Mã giới thiệu: ', style: TextStyle(color: Colors.grey, fontSize: 12)),
                        const Text('NOVA9882', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                        const SizedBox(width: 4),
                        Icon(Icons.copy, size: 12, color: primaryColor),
                      ],
                    )
                  ],
                ),
              ),
              IconButton(icon: const Icon(Icons.help_outline), onPressed: () {}),
              IconButton(icon: const Icon(Icons.settings_outlined), onPressed: () {}),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              _buildStatItem('24', 'Đã mua'),
              _buildStatItem('15', 'Yêu thích'),
              _buildStatItem('3', 'Theo dõi Shop'),
            ],
          )
        ],
      ),
    );
  }

  Widget _buildStatItem(String count, String label) {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 4),
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(color: Colors.blue[50], borderRadius: BorderRadius.circular(8)),
        child: Column(
          children: [
            Text(count, style: TextStyle(color: primaryColor, fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 2),
            Text(label, style: const TextStyle(color: Color(0xFF003366), fontSize: 11)),
          ],
        ),
      ),
    );
  }

  Widget _buildFinanceSection() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Icon(Icons.account_balance_wallet, color: primaryColor, size: 20),
                  const SizedBox(width: 8),
                  const Text('Tài Chính ShopNova', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                ],
              ),
              const Row(
                children: [
                  Icon(Icons.security, color: Colors.green, size: 14),
                  SizedBox(width: 4),
                  Text('Bảo mật 100%', style: TextStyle(color: Colors.green, fontSize: 12, fontWeight: FontWeight.bold)),
                ],
              )
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              _buildFinanceCard('Ví NovaPay', Icons.credit_card, '350.000', 'đ', 'Nạp tiền', Colors.red[800]!),
              _buildFinanceCard('Kho Nova Xu', Icons.monetization_on, '1.420', ' Xu', 'Nhận xu', Colors.blue[100]!, btnTextColor: Colors.blue[900]!),
              _buildFinanceCard('Kho Voucher', Icons.local_activity, '12', ' Mã còn', 'Dùng ngay', const Color(0xFF003366)),
            ],
          )
        ],
      ),
    );
  }

  Widget _buildFinanceCard(String title, IconData icon, String amount, String unit, String btnText, Color btnColor, {Color btnTextColor = Colors.white}) {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 4),
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(color: Colors.grey[50], borderRadius: BorderRadius.circular(8), border: Border.all(color: Colors.grey[200]!)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(child: Text(title, style: const TextStyle(fontSize: 10, color: Colors.grey, fontWeight: FontWeight.bold), maxLines: 1, overflow: TextOverflow.ellipsis)),
                Icon(icon, size: 12, color: primaryColor),
              ],
            ),
            const SizedBox(height: 4),
            Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Text(amount, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                Text(unit, style: const TextStyle(fontSize: 10)),
              ],
            ),
            const SizedBox(height: 8),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 4),
              decoration: BoxDecoration(color: btnColor, borderRadius: BorderRadius.circular(4)),
              alignment: Alignment.center,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.add_circle_outline, size: 10, color: btnTextColor),
                  const SizedBox(width: 2),
                  Text(btnText, style: TextStyle(color: btnTextColor, fontSize: 10, fontWeight: FontWeight.bold)),
                ],
              ),
            )
          ],
        ),
      ),
    );
  }

  Widget _buildDeliveryStatusSection() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  const Icon(Icons.circle, color: Colors.green, size: 10),
                  const SizedBox(width: 8),
                  const Text('Đơn hàng đang giao hỏa tốc', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                ],
              ),
              const Text('Dự kiến 16:30', style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold, fontSize: 12)),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Mã đơn: SN20241025-8849', style: TextStyle(color: Colors.grey, fontSize: 11)),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(color: Colors.green[50], borderRadius: BorderRadius.circular(2)),
                child: const Text('Hỏa tốc 2H', style: TextStyle(color: Colors.green, fontSize: 10, fontWeight: FontWeight.bold)),
              )
            ],
          ),
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(border: Border.all(color: Colors.red[100]!), borderRadius: BorderRadius.circular(8)),
                child: const Icon(Icons.local_shipping, color: Colors.red),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Shop Nova Official Store', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                    SizedBox(height: 4),
                    Text('Tài xế Nova Express đang giao hỏa tốc 2h - Dự kiến nhận trước 16:30 hôm nay', style: TextStyle(color: Colors.grey, fontSize: 11)),
                  ],
                ),
              )
            ],
          ),
          const SizedBox(height: 12),
          LinearProgressIndicator(value: 0.7, backgroundColor: Colors.grey[200], valueColor: const AlwaysStoppedAnimation<Color>(Colors.green)),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              ElevatedButton.icon(
                onPressed: () {},
                icon: const Icon(Icons.phone, size: 14),
                label: const Text('Gọi tài xế'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.grey[200],
                  foregroundColor: Colors.black87,
                  elevation: 0,
                  minimumSize: const Size(0, 32),
                ),
              ),
              const SizedBox(width: 8),
              ElevatedButton.icon(
                onPressed: () {},
                icon: const Icon(Icons.my_location, size: 14),
                label: const Text('Theo dõi đơn'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.red[800],
                  foregroundColor: Colors.white,
                  minimumSize: const Size(0, 32),
                ),
              ),
            ],
          )
        ],
      ),
    );
  }

  Widget _buildMyOrdersSection() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Đơn Mua Của Tôi', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
              Row(
                children: [
                  const Text('Xem tất cả lịch sử mua', style: TextStyle(color: Colors.grey, fontSize: 12)),
                  const SizedBox(width: 4),
                  Icon(Icons.chevron_right, size: 16, color: Colors.grey[400]),
                ],
              )
            ],
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _buildOrderIcon(Icons.assignment, 'Chờ xác nhận', '1'),
              _buildOrderIcon(Icons.inventory_2, 'Chờ lấy hàng', '2'),
              _buildOrderIcon(Icons.local_shipping, 'Đang giao', '1', isHighlight: true),
              _buildOrderIcon(Icons.rate_review, 'Đánh giá', '5'),
              _buildOrderIcon(Icons.replay, 'Trả hàng', ''),
            ],
          )
        ],
      ),
    );
  }

  Widget _buildOrderIcon(IconData icon, String label, String badge, {bool isHighlight = false}) {
    return Column(
      children: [
        Stack(
          clipBehavior: Clip.none,
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: Colors.grey[50], shape: BoxShape.circle),
              child: Icon(icon, color: isHighlight ? Colors.red : Colors.black87, size: 24),
            ),
            if (badge.isNotEmpty)
              Positioned(
                right: -4, top: -4,
                child: Container(
                  padding: const EdgeInsets.all(4),
                  decoration: const BoxDecoration(color: Colors.red, shape: BoxShape.circle),
                  constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
                  child: Text(badge, style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold), textAlign: TextAlign.center),
                ),
              )
          ],
        ),
        const SizedBox(height: 8),
        Text(
          label,
          style: TextStyle(fontSize: 10, fontWeight: isHighlight ? FontWeight.bold : FontWeight.normal, color: isHighlight ? Colors.red : Colors.black87),
          textAlign: TextAlign.center,
        )
      ],
    );
  }

  Widget _buildAiBanner() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(colors: [Colors.red[800]!, Colors.orange[800]!]),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(16)),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.auto_awesome, color: Colors.white, size: 12),
                SizedBox(width: 4),
                Text('Nova AI Stylist', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Lịch sử tư vấn phối đồ', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                    SizedBox(height: 4),
                    Text('3 gợi ý thời trang Thu Đông theo phong cách của bạn đã sẵn sàng', style: TextStyle(color: Colors.white70, fontSize: 11)),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              ElevatedButton(
                onPressed: () {},
                style: ElevatedButton.styleFrom(backgroundColor: Colors.white, foregroundColor: primaryColor, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20))),
                child: const Row(
                  children: [
                    Text('Xem ngay', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                    Icon(Icons.arrow_forward, size: 14),
                  ],
                ),
              )
            ],
          )
        ],
      ),
    );
  }

  Widget _buildServicesSection() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Dịch Vụ & Tiện Ích', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
          const SizedBox(height: 12),
          _buildServiceItem(Icons.storefront, 'Kênh Người Bán', 'Mở gian hàng cá nhân, đăng bán miễn phí', trailingLabel: 'Đăng bán ngay'),
          _buildServiceItem(Icons.sync, 'Đổi trả hàng 15 ngày', 'Chính sách bảo vệ người mua an tâm tối đa'),
          _buildServiceItem(Icons.location_on, 'Sổ địa chỉ nhận hàng', '2 địa chỉ khả dụng (1 mặc định)'),
          _buildServiceItem(Icons.security, 'Bảo mật tài khoản 2 lớp', 'Đã kích hoạt OTP & Sinh trắc học', highlightSubtitle: true),
        ],
      ),
    );
  }

  Widget _buildServiceItem(IconData icon, String title, String subtitle, {String? trailingLabel, bool highlightSubtitle = false}) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: Colors.blue[50]?.withOpacity(0.5), borderRadius: BorderRadius.circular(8)),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(color: Colors.grey[200], shape: BoxShape.circle),
            child: Icon(icon, size: 20, color: Colors.black87),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                const SizedBox(height: 2),
                Row(
                  children: [
                    if (highlightSubtitle) const Icon(Icons.check_circle, color: Colors.green, size: 12),
                    if (highlightSubtitle) const SizedBox(width: 4),
                    Expanded(child: Text(subtitle, style: TextStyle(color: highlightSubtitle ? Colors.green : Colors.grey, fontSize: 11))),
                  ],
                ),
              ],
            ),
          ),
          if (trailingLabel != null) ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(color: Colors.red[100], borderRadius: BorderRadius.circular(12)),
              child: Text(trailingLabel, style: const TextStyle(color: Colors.red, fontSize: 10, fontWeight: FontWeight.bold)),
            ),
            const SizedBox(width: 8),
          ],
          const Icon(Icons.chevron_right, color: Colors.grey, size: 16),
        ],
      ),
    );
  }

  Widget _buildLogoutButton() {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton.icon(
        onPressed: () {},
        icon: const Icon(Icons.logout, color: Color(0xFFEE4D2D), size: 18),
        label: const Text('Đăng xuất tài khoản', style: TextStyle(color: Color(0xFFEE4D2D), fontWeight: FontWeight.bold)),
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.white,
          elevation: 0,
          padding: const EdgeInsets.symmetric(vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
      ),
    );
  }
}
