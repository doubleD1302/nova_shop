import 'package:flutter/material.dart';

class OrdersScreen extends StatefulWidget {
  final int initialTabIndex;

  const OrdersScreen({super.key, this.initialTabIndex = 0});

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final Color primaryColor = const Color(0xFFEE4D2D);

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 5, vsync: this, initialIndex: widget.initialTabIndex);
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
        elevation: 0,
        leadingWidth: 40,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.black87),
          onPressed: () => Navigator.pop(context),
        ),
        title: Row(
          children: [
            const Icon(Icons.shopping_bag, color: Color(0xFFEE4D2D)),
            const SizedBox(width: 4),
            const Expanded(
              child: Text(
                'Orders Pending Confirmation',
                style: TextStyle(color: Colors.black87, fontSize: 16, fontWeight: FontWeight.bold),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(icon: const Icon(Icons.search, color: Colors.black87), onPressed: () {}),
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
          Container(
            margin: const EdgeInsets.only(right: 12, left: 4),
            width: 28, height: 28,
            decoration: BoxDecoration(color: primaryColor, shape: BoxShape.circle),
            child: const Icon(Icons.person, color: Colors.white, size: 18),
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
            Tab(text: 'Đánh giá'),
            Tab(text: 'Trả hàng/Hoàn tiền'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildPendingConfirmationTab(),
          _buildPendingPickupTab(),
          _buildInTransitTab(),
          const Center(child: Text('Đánh giá')),
          const Center(child: Text('Trả hàng/Hoàn tiền')),
        ],
      ),
    );
  }

  Widget _buildInTransitTab() {
    return Stack(
      children: [
        SingleChildScrollView(
          padding: const EdgeInsets.only(bottom: 100), // Space for bottom action bar
          child: Column(
            children: [
              _buildLiveMapViewport(),
              _buildShipperProfileCard(),
              _buildTrackingTimeline(),
              _buildDeliveryAddressDetails(),
              _buildOrderParcelBreakdown(),
              _buildAssuranceTrustBadge(),
              const SizedBox(height: 24),
            ],
          ),
        ),
        _buildBottomFloatingActionBar(),
      ],
    );
  }

  Widget _buildLiveMapViewport() {
    return Container(
      height: 280,
      width: double.infinity,
      color: Colors.blue[50], // Map placeholder background
      child: Stack(
        children: [
          // Simulated map background (just a grid or pattern, we'll use simple shapes)
          Positioned.fill(
            child: CustomPaint(
              painter: MapPlaceholderPainter(),
            ),
          ),
          // Top Left Badge
          Positioned(
            top: 12, left: 12,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(color: Colors.white.withOpacity(0.9), borderRadius: BorderRadius.circular(20), boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.1), blurRadius: 4)]),
              child: Row(
                children: [
                  Container(width: 8, height: 8, decoration: BoxDecoration(color: primaryColor, shape: BoxShape.circle)),
                  const SizedBox(width: 6),
                  Text('Hỏa Tốc 2H', style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold, fontSize: 12)),
                  const SizedBox(width: 4),
                  const Text('• Đang giao', style: TextStyle(color: Colors.grey, fontSize: 11, fontWeight: FontWeight.w500)),
                ],
              ),
            ),
          ),
          // Re-focus button
          Positioned(
            top: 12, right: 12,
            child: Container(
              width: 36, height: 36,
              decoration: BoxDecoration(color: Colors.white.withOpacity(0.95), shape: BoxShape.circle, boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.1), blurRadius: 4)]),
              child: Icon(Icons.my_location, color: primaryColor, size: 20),
            ),
          ),
          // Floating Live ETA Card
          Positioned(
            bottom: 12, left: 12, right: 12,
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: Colors.white.withOpacity(0.95), borderRadius: BorderRadius.circular(16), boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.1), blurRadius: 8, offset: const Offset(0, 4))]),
              child: Row(
                children: [
                  Container(
                    width: 40, height: 40,
                    decoration: BoxDecoration(color: Colors.red[50], borderRadius: BorderRadius.circular(10)),
                    child: Icon(Icons.electric_moped, color: primaryColor),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Text('Cách bạn 1.8 km', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(color: Colors.green[50], borderRadius: BorderRadius.circular(4)),
                              child: const Text('Đúng giờ', style: TextStyle(color: Colors.green, fontSize: 10, fontWeight: FontWeight.bold)),
                            )
                          ],
                        ),
                        const SizedBox(height: 2),
                        RichText(
                          text: const TextSpan(
                            style: TextStyle(color: Colors.grey, fontSize: 12),
                            children: [
                              TextSpan(text: 'Dự kiến giao trước '),
                              TextSpan(text: '16:15 hôm nay', style: TextStyle(color: Colors.black87, fontWeight: FontWeight.bold)),
                            ]
                          )
                        )
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text('TRỰC TIẾP', style: TextStyle(color: primaryColor, fontSize: 10, fontWeight: FontWeight.bold)),
                      const Text('~ 12 phút', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                    ],
                  )
                ],
              ),
            ),
          )
        ],
      ),
    );
  }

  Widget _buildShipperProfileCard() {
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 16, 12, 6),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 4, offset: const Offset(0, 2))]),
      child: Column(
        children: [
          Row(
            children: [
              Stack(
                children: [
                  CircleAvatar(radius: 24, backgroundColor: Colors.grey[200], child: const Icon(Icons.person, color: Colors.grey, size: 30)),
                  Positioned(
                    bottom: 0, right: 0,
                    child: Container(
                      width: 16, height: 16,
                      decoration: const BoxDecoration(color: Colors.green, shape: BoxShape.circle),
                      child: const Icon(Icons.check, color: Colors.white, size: 10),
                    ),
                  )
                ],
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Text('Phạm Văn Đức', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(color: Colors.grey[100], borderRadius: BorderRadius.circular(4)),
                          child: const Text('Nova Express', style: TextStyle(color: Colors.grey, fontSize: 10)),
                        )
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Icon(Icons.star, color: primaryColor, size: 14),
                        const SizedBox(width: 2),
                        Text('4.9', style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold, fontSize: 12)),
                        const Padding(padding: EdgeInsets.symmetric(horizontal: 6), child: Text('•', style: TextStyle(color: Colors.grey))),
                        const Text('1.4k chuyến', style: TextStyle(color: Colors.grey, fontSize: 12)),
                        const Padding(padding: EdgeInsets.symmetric(horizontal: 6), child: Text('•', style: TextStyle(color: Colors.grey))),
                        const Text('59-P1 884.29', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                      ],
                    )
                  ],
                ),
              )
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () {},
                  icon: const Icon(Icons.call, color: Colors.green, size: 18),
                  label: const Text('Gọi Tài Xế', style: TextStyle(color: Colors.black87, fontWeight: FontWeight.bold)),
                  style: OutlinedButton.styleFrom(
                    backgroundColor: Colors.grey[50],
                    side: BorderSide(color: Colors.grey[200]!),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () {},
                  icon: Icon(Icons.chat_bubble, color: primaryColor, size: 18),
                  label: const Text('Nhắn Tin', style: TextStyle(color: Colors.black87, fontWeight: FontWeight.bold)),
                  style: OutlinedButton.styleFrom(
                    backgroundColor: Colors.grey[50],
                    side: BorderSide(color: Colors.grey[200]!),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              )
            ],
          )
        ],
      ),
    );
  }

  Widget _buildTrackingTimeline() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 4, offset: const Offset(0, 2))]),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('MÃ VẬN ĐƠN', style: TextStyle(color: Colors.grey, fontSize: 10, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      const Text('NOVA-EXP-992184', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, letterSpacing: 0.5)),
                      const SizedBox(width: 8),
                      Icon(Icons.copy, size: 16, color: primaryColor),
                    ],
                  )
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(color: Colors.red[50], borderRadius: BorderRadius.circular(12)),
                child: Text('Đang trên đường giao', style: TextStyle(color: primaryColor, fontSize: 11, fontWeight: FontWeight.bold)),
              )
            ],
          ),
          const SizedBox(height: 20),
          // Custom vertical stepper
          _buildTimelineItem('Đang giao hàng đến bạn', '15:45', 'Shipper Phạm Văn Đức đã nhận kiện hàng từ Kho trung chuyển Quận 1 và đang di chuyển tới địa chỉ nhận.', isCurrent: true),
          _buildTimelineItem('Rời trung tâm phân loại', '15:10', 'Kiện hàng đã xuất kho trung chuyển Tổng Hub Tân Bình sang Bưu cục Quận 1.'),
          _buildTimelineItem('Đã lấy hàng thành công', '14:30', 'Tài xế Nova Express đã nhận hàng tại kho Người bán (Shop Nova Official Store).'),
          _buildTimelineItem('Đóng gói hoàn tất', '12:30', 'Người bán đã đóng gói kiện hàng và bàn giao mã vận đơn cho đơn vị vận chuyển.', isLast: true),
        ],
      ),
    );
  }

  Widget _buildTimelineItem(String title, String time, String desc, {bool isCurrent = false, bool isLast = false}) {
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 24,
            child: Stack(
              alignment: Alignment.topCenter,
              children: [
                if (!isLast)
                  Container(
                    margin: const EdgeInsets.only(top: 12),
                    width: 2,
                    color: Colors.grey[300],
                  ),
                Container(
                  margin: const EdgeInsets.only(top: 2),
                  width: isCurrent ? 24 : 12,
                  height: isCurrent ? 24 : 12,
                  decoration: BoxDecoration(
                    color: isCurrent ? primaryColor : Colors.grey[300],
                    shape: BoxShape.circle,
                  ),
                  child: isCurrent ? const Icon(Icons.local_shipping, color: Colors.white, size: 12) : null,
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(title, style: TextStyle(fontWeight: isCurrent ? FontWeight.bold : FontWeight.w600, fontSize: 13, color: isCurrent ? primaryColor : Colors.black87)),
                      Text(time, style: TextStyle(color: isCurrent ? primaryColor : Colors.grey, fontSize: 12, fontWeight: isCurrent ? FontWeight.bold : FontWeight.normal)),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(desc, style: TextStyle(color: isCurrent ? Colors.black87 : Colors.grey, fontSize: 12, height: 1.4)),
                ],
              ),
            ),
          )
        ],
      ),
    );
  }

  Widget _buildDeliveryAddressDetails() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 4, offset: const Offset(0, 2))]),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(color: Colors.grey[100], shape: BoxShape.circle),
            child: Icon(Icons.location_on, color: primaryColor, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Địa Chỉ Nhận Hàng', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                    const Text('Mặc định', style: TextStyle(color: Colors.grey, fontSize: 11)),
                  ],
                ),
                const SizedBox(height: 4),
                RichText(
                  text: const TextSpan(
                    style: TextStyle(color: Colors.black87, fontSize: 14, fontWeight: FontWeight.bold),
                    children: [
                      TextSpan(text: 'Nguyễn Văn A '),
                      TextSpan(text: '(+84) 098 765 4321', style: TextStyle(fontWeight: FontWeight.normal, color: Colors.grey)),
                    ]
                  )
                ),
                const SizedBox(height: 4),
                const Text(
                  'Phòng 2205, Tháp Landmark 81, Vinhomes Central Park, 720A Điện Biên Phủ, Phường 22, Quận Bình Thạnh (giáp Quận 1), TP. Hồ Chí Minh',
                  style: TextStyle(color: Colors.black54, fontSize: 12, height: 1.4),
                )
              ],
            ),
          )
        ],
      ),
    );
  }

  Widget _buildOrderParcelBreakdown() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 4, offset: const Offset(0, 2))]),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                    decoration: BoxDecoration(color: primaryColor, borderRadius: BorderRadius.circular(2)),
                    child: const Text('MALL', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold)),
                  ),
                  const SizedBox(width: 6),
                  const Text('Shop Nova Official Store', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                  const Icon(Icons.chevron_right, size: 16, color: Colors.grey),
                ],
              ),
              Row(
                children: [
                  Icon(Icons.chat, size: 14, color: primaryColor),
                  const SizedBox(width: 4),
                  Text('Chat', style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold, fontSize: 12)),
                ],
              )
            ],
          ),
          const Divider(height: 24, color: Color(0xFFEEEEEE)),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 72, height: 72,
                decoration: BoxDecoration(color: Colors.grey[200], borderRadius: BorderRadius.circular(8)),
                child: const Icon(Icons.image, color: Colors.grey),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Áo Croptop Linen Cổ Vuông Thanh Lịch Thiết Kế Cao Cấp Dáng Ôm Tinh Tế', style: TextStyle(fontWeight: FontWeight.w500, fontSize: 13), maxLines: 2, overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 4),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(color: Colors.grey[100], borderRadius: BorderRadius.circular(4)),
                          child: const Text('Trắng Tinh Khôi, Size M', style: TextStyle(fontSize: 11, color: Colors.black87)),
                        ),
                        const Text('x2', style: TextStyle(color: Colors.grey, fontSize: 12)),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('318.000₫', style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold, fontSize: 14)),
                        const Text('420.000₫', style: TextStyle(color: Colors.grey, decoration: TextDecoration.lineThrough, fontSize: 12)),
                      ],
                    )
                  ],
                ),
              )
            ],
          ),
          const Divider(height: 24, color: Color(0xFFEEEEEE)),
          Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Phương thức thanh toán', style: TextStyle(color: Colors.grey, fontSize: 12)),
                  Row(
                    children: [
                      const Icon(Icons.circle, color: Colors.green, size: 8),
                      const SizedBox(width: 6),
                      const Text('Đã thanh toán (Ví NovaPay)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                    ],
                  )
                ],
              ),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Số tiền cần thanh toán khi nhận:', style: TextStyle(color: Colors.grey, fontSize: 12)),
                  const Text('0₫ (Đã trả trước)', style: TextStyle(color: Colors.green, fontWeight: FontWeight.bold, fontSize: 14)),
                ],
              )
            ],
          )
        ],
      ),
    );
  }

  Widget _buildAssuranceTrustBadge() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.blue[50]?.withOpacity(0.5), borderRadius: BorderRadius.circular(12)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.verified_user, color: Colors.green, size: 24),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Đồng kiểm khi nhận hàng', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                const SizedBox(height: 4),
                const Text(
                  'Bạn được quyền mở gói hàng kiểm tra ngoại quan cùng tài xế trước khi nhận. Đơn hàng được bảo vệ 100% đổi trả miễn phí trong 15 ngày bởi ShopNova.',
                  style: TextStyle(color: Colors.black54, fontSize: 12, height: 1.4),
                )
              ],
            ),
          )
        ],
      ),
    );
  }

  Widget _buildBottomFloatingActionBar() {
    return Positioned(
      bottom: 0, left: 0, right: 0,
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.95),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, -4))]
        ),
        child: Row(
          children: [
            OutlinedButton.icon(
              onPressed: () {},
              icon: const Icon(Icons.report_problem, color: Colors.grey, size: 18),
              label: const Text('Hỗ Trợ', style: TextStyle(color: Colors.black87, fontWeight: FontWeight.bold)),
              style: OutlinedButton.styleFrom(
                backgroundColor: Colors.grey[100],
                side: BorderSide.none,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: ElevatedButton.icon(
                onPressed: () {},
                icon: const Icon(Icons.task_alt, size: 20),
                label: const Text('Đã Nhận Hàng', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: primaryColor,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
              ),
            )
          ],
        ),
      ),
    );
  }




  Widget _buildPendingPickupTab() {
    return SingleChildScrollView(
      child: Column(
        children: [
          _buildPickupStatusNoticeBanner(),
          _buildPickupOrderCard1(),
          _buildPickupOrderCard2(),
          _buildBuyerProtectionBanner(),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _buildPickupStatusNoticeBanner() {
    return Container(
      margin: const EdgeInsets.all(12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.blue[50],
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36, height: 36,
            decoration: BoxDecoration(color: primaryColor, shape: BoxShape.circle),
            child: const Icon(Icons.inventory_2, color: Colors.white, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Expanded(
                      child: Text('Người bán đang chuẩn bị hàng', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14), maxLines: 1, overflow: TextOverflow.ellipsis),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      width: 8, height: 8,
                      decoration: BoxDecoration(color: primaryColor, shape: BoxShape.circle),
                    )
                  ],
                ),
                const SizedBox(height: 4),
                const Text(
                  'Đơn hàng đã được xác nhận. Đơn vị vận chuyển sẽ sớm tiếp nhận bưu kiện và cập nhật mã định vị trực tiếp cho bạn!',
                  style: TextStyle(color: Colors.black54, fontSize: 12, height: 1.4),
                ),
              ],
            ),
          )
        ],
      ),
    );
  }

  Widget _buildPickupOrderCard1() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 4, offset: const Offset(0, 2))
        ]
      ),
      child: Column(
        children: [
          // Shop Header
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: Colors.grey[50], borderRadius: const BorderRadius.vertical(top: Radius.circular(12))),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                        decoration: BoxDecoration(color: Colors.black87, borderRadius: BorderRadius.circular(2)),
                        child: const Text('MALL', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold)),
                      ),
                      const SizedBox(width: 6),
                      const Expanded(
                        child: Text('Nova Official Store', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13), maxLines: 1, overflow: TextOverflow.ellipsis),
                      ),
                      const Icon(Icons.chevron_right, size: 16, color: Colors.grey),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(color: Colors.blue[50], borderRadius: BorderRadius.circular(12)),
                  child: const Text('Chuẩn bị hàng', style: TextStyle(color: Color(0xFF003366), fontSize: 11, fontWeight: FontWeight.bold)),
                )
              ],
            ),
          ),
          // Order Meta
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Text('#SN20241025-8849', style: TextStyle(color: Colors.black87, fontWeight: FontWeight.bold, fontSize: 12)),
                    const SizedBox(width: 4),
                    Icon(Icons.copy, size: 14, color: Colors.grey[600]),
                  ],
                ),
                const Text('Đặt lúc: 12:30 hôm nay', style: TextStyle(color: Colors.grey, fontSize: 11)),
              ],
            ),
          ),
          // Tracking Stepper
          Container(
            margin: const EdgeInsets.all(12),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: Colors.grey[50], borderRadius: BorderRadius.circular(8)),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    _buildStepIcon(Icons.check, 'Đã đặt', true),
                    Expanded(child: Container(height: 2, color: primaryColor)),
                    _buildStepIcon(Icons.check, 'Xác nhận', true),
                    Expanded(child: Container(height: 2, color: primaryColor)),
                    _buildStepIcon(Icons.hourglass_top, 'Chờ lấy hàng', true, isActive: true),
                    Expanded(child: Container(height: 2, color: Colors.grey[300])),
                    _buildStepIcon(null, 'Đang giao', false),
                    Expanded(child: Container(height: 2, color: Colors.grey[300])),
                    _buildStepIcon(null, 'Hoàn tất', false),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Icon(Icons.bolt, color: primaryColor, size: 16),
                    const SizedBox(width: 4),
                    Expanded(
                      child: RichText(
                        overflow: TextOverflow.ellipsis,
                        text: TextSpan(
                          children: [
                            TextSpan(text: 'Nova Express - Hỏa Tốc 2H', style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold, fontSize: 11)),
                            const TextSpan(text: ' | Dự kiến giao: 16:00 - 17:00 hôm nay', style: TextStyle(color: Colors.grey, fontSize: 11)),
                          ],
                        ),
                      ),
                    ),
                  ],
                )
              ],
            ),
          ),
          // Items
          _buildOrderItem('Áo Croptop Linen Cổ Vuông Thanh Lịch', 'Trắng Tinh Khôi, Size M', '318.000₫', 'x2'),
          const Divider(height: 1, color: Color(0xFFEEEEEE)),
          // Total
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(Icons.circle, color: Colors.green, size: 8),
                    const SizedBox(width: 6),
                    const Text('Đã thanh toán VNPay', style: TextStyle(color: Colors.grey, fontSize: 12)),
                  ],
                ),
                Row(
                  children: [
                    const Text('2 sản phẩm: ', style: TextStyle(color: Colors.grey, fontSize: 12)),
                    Text('318.000₫', style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold, fontSize: 16)),
                  ],
                )
              ],
            ),
          ),
          // Actions
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: Colors.grey[50], borderRadius: const BorderRadius.vertical(bottom: Radius.circular(12))),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                OutlinedButton(
                  onPressed: () {},
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.black87,
                    side: BorderSide(color: Colors.grey[300]!),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    minimumSize: const Size(0, 36)
                  ),
                  child: const Text('Mua Lại', style: TextStyle(fontSize: 12)),
                ),
                const SizedBox(width: 4),
                OutlinedButton.icon(
                  onPressed: () {},
                  icon: const Icon(Icons.chat, size: 14),
                  label: const Text('Liên hệ', style: TextStyle(fontSize: 12)),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.black87,
                    side: BorderSide(color: Colors.grey[300]!),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    minimumSize: const Size(0, 36)
                  ),
                ),
                const SizedBox(width: 4),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () {},
                    style: ElevatedButton.styleFrom(
                      backgroundColor: primaryColor,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      minimumSize: const Size(0, 36)
                    ),
                    child: const Text('Theo Dõi', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold), maxLines: 1),
                  ),
                )
              ],
            ),
          )
        ],
      ),
    );
  }

  Widget _buildStepIcon(IconData? icon, String label, bool isCompleted, {bool isActive = false}) {
    return Column(
      children: [
        Container(
          width: 20, height: 20,
          decoration: BoxDecoration(
            color: isCompleted ? primaryColor : Colors.grey[300],
            shape: BoxShape.circle,
            border: isActive ? Border.all(color: primaryColor.withOpacity(0.3), width: 3) : null,
          ),
          child: icon != null ? Icon(icon, color: Colors.white, size: 12) : (isCompleted ? null : Center(child: Container(width: 6, height: 6, decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle)))),
        ),
        const SizedBox(height: 4),
        Text(label, style: TextStyle(color: isActive ? primaryColor : (isCompleted ? Colors.black87 : Colors.grey), fontSize: 9, fontWeight: isActive ? FontWeight.bold : FontWeight.normal)),
      ],
    );
  }

  Widget _buildPickupOrderCard2() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 4, offset: const Offset(0, 2))
        ]
      ),
      child: Column(
        children: [
          // Shop Header
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: Colors.grey[50], borderRadius: const BorderRadius.vertical(top: Radius.circular(12))),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                        decoration: BoxDecoration(color: primaryColor, borderRadius: BorderRadius.circular(2)),
                        child: const Row(
                          children: [
                            Icon(Icons.star, color: Colors.white, size: 10),
                            SizedBox(width: 2),
                            Text('Yêu Thích+', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold)),
                          ],
                        ),
                      ),
                      const SizedBox(width: 6),
                      const Expanded(
                        child: Text('Gốm Xinh Studio & Decor', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13), maxLines: 1, overflow: TextOverflow.ellipsis),
                      ),
                      const Icon(Icons.chevron_right, size: 16, color: Colors.grey),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(color: Colors.green[50], borderRadius: BorderRadius.circular(12)),
                  child: const Text('Chờ bưu tá', style: TextStyle(color: Colors.green, fontSize: 11, fontWeight: FontWeight.bold)),
                )
              ],
            ),
          ),
          // Order Meta
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Text('#SN20241025-8801', style: TextStyle(color: Colors.black87, fontWeight: FontWeight.bold, fontSize: 12)),
                    const SizedBox(width: 4),
                    Icon(Icons.copy, size: 14, color: Colors.grey[600]),
                  ],
                ),
                const Text('Đặt lúc: 09:15 hôm nay', style: TextStyle(color: Colors.grey, fontSize: 11)),
              ],
            ),
          ),
          // Pickup Box
          Container(
            margin: const EdgeInsets.all(12),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: Colors.grey[50], borderRadius: BorderRadius.circular(8)),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.local_shipping, color: Colors.green, size: 20),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Nova Tiêu Chuẩn', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                          const SizedBox(width: 4),
                          Flexible(
                            child: const Text('Bưu tá hẹn lấy: Chiều nay < 16:30', style: TextStyle(color: Colors.green, fontSize: 11, fontWeight: FontWeight.bold), textAlign: TextAlign.right),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      RichText(
                        text: const TextSpan(
                          style: TextStyle(color: Colors.grey, fontSize: 11),
                          children: [
                            TextSpan(text: 'Dự kiến giao tới bạn: '),
                            TextSpan(text: 'Ngày mai, 26/10', style: TextStyle(color: Colors.black87, fontWeight: FontWeight.bold)),
                          ]
                        )
                      )
                    ],
                  ),
                )
              ],
            ),
          ),
          // Items
          _buildOrderItem('Ly Gốm Men Hoả Biến Dáng Nhật 350ml', 'Xanh Khói, Dung tích 350ml', '150.000₫', 'x2'),
          const Divider(height: 1, color: Color(0xFFEEEEEE)),
          // Total
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(Icons.circle, color: Colors.green, size: 8),
                    const SizedBox(width: 6),
                    const Text('Đã thanh toán Ví NovaPay', style: TextStyle(color: Colors.grey, fontSize: 12)),
                  ],
                ),
                Row(
                  children: [
                    const Text('2 sản phẩm: ', style: TextStyle(color: Colors.grey, fontSize: 12)),
                    Text('150.000₫', style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold, fontSize: 16)),
                  ],
                )
              ],
            ),
          ),
          // Actions
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: Colors.grey[50], borderRadius: const BorderRadius.vertical(bottom: Radius.circular(12))),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                OutlinedButton.icon(
                  onPressed: () {},
                  icon: const Icon(Icons.chat, size: 14),
                  label: const Text('Nhắn Tin Với Shop', style: TextStyle(fontSize: 12)),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.black87,
                    side: BorderSide(color: Colors.grey[300]!),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    minimumSize: const Size(0, 36)
                  ),
                ),
                const SizedBox(width: 8),
                ElevatedButton(
                  onPressed: () {},
                  style: ElevatedButton.styleFrom(
                    backgroundColor: primaryColor,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    minimumSize: const Size(0, 36)
                  ),
                  child: const Text('Xem Chi Tiết Đơn', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                )
              ],
            ),
          )
        ],
      ),
    );
  }

  Widget _buildBuyerProtectionBanner() {
    return Container(
      margin: const EdgeInsets.all(12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 4, offset: const Offset(0, 2))
        ]
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 32, height: 32,
            decoration: BoxDecoration(color: Colors.green[50], shape: BoxShape.circle),
            child: const Icon(Icons.verified_user, color: Colors.green, size: 18),
          ),
          const SizedBox(width: 12),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Bảo vệ Người Mua ShopNova', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                    Icon(Icons.help_outline, size: 16, color: Colors.grey),
                  ],
                ),
                SizedBox(height: 4),
                Text(
                  'Đảm bảo quyền lợi tối đa: Hoàn tiền 100% nếu sản phẩm không đúng mô tả hoặc không nhận được hàng trong vòng 15 ngày.',
                  style: TextStyle(color: Colors.grey, fontSize: 11, height: 1.4),
                )
              ],
            ),
          )
        ],
      ),
    );
  }

  Widget _buildPendingConfirmationTab() {
    return SingleChildScrollView(
      child: Column(
        children: [
          _buildTopSummaryBanner(),
          _buildOrderCard1(),
          _buildOrderCard2(),
          _buildRecommendedSection(),
          _buildFooter(),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _buildTopSummaryBanner() {
    return Container(
      margin: const EdgeInsets.all(12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 4, offset: const Offset(0, 2))
        ]
      ),
      child: Column(
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 36, height: 36,
                decoration: BoxDecoration(color: Colors.red[50], shape: BoxShape.circle),
                child: Icon(Icons.pending_actions, color: primaryColor, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Text('Có 2 đơn hàng đang chờ xác nhận', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(color: Colors.red[50], borderRadius: BorderRadius.circular(12)),
                          child: Text('2 đơn', style: TextStyle(color: primaryColor, fontSize: 10, fontWeight: FontWeight.bold)),
                        )
                      ],
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Shop thường xác nhận đơn trong vòng 1-2 giờ. Bạn có thể yêu cầu đổi địa chỉ hoặc hủy đơn trước khi Shop bấm chuẩn bị hàng.',
                      style: TextStyle(color: Colors.grey, fontSize: 12, height: 1.4),
                    ),
                  ],
                ),
              )
            ],
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
            decoration: BoxDecoration(color: Colors.blue[50]?.withOpacity(0.5), borderRadius: BorderRadius.circular(8)),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Icon(Icons.check_circle, color: primaryColor, size: 16),
                    const SizedBox(width: 4),
                    const Text('Đã đặt đơn', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11)),
                  ],
                ),
                Container(width: 24, height: 2, color: primaryColor),
                Row(
                  children: [
                    Stack(
                      alignment: Alignment.center,
                      children: [
                        Container(width: 12, height: 12, decoration: BoxDecoration(color: primaryColor.withOpacity(0.3), shape: BoxShape.circle)),
                        Container(width: 6, height: 6, decoration: BoxDecoration(color: primaryColor, shape: BoxShape.circle)),
                      ],
                    ),
                    const SizedBox(width: 4),
                    const Text('Chờ Shop duyệt', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11)),
                  ],
                ),
                Container(width: 24, height: 2, color: Colors.grey[300]),
                const Row(
                  children: [
                    Icon(Icons.inventory_2, color: Colors.grey, size: 16),
                    SizedBox(width: 4),
                    Text('Chuẩn bị hàng', style: TextStyle(color: Colors.grey, fontSize: 11)),
                  ],
                )
              ],
            ),
          )
        ],
      ),
    );
  }

  Widget _buildOrderCard1() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 4, offset: const Offset(0, 2))
        ]
      ),
      child: Column(
        children: [
          // Shop Header
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: Colors.grey[50], borderRadius: const BorderRadius.vertical(top: Radius.circular(12))),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    CircleAvatar(radius: 14, backgroundColor: Colors.blue[100], child: Text('N', style: TextStyle(color: Colors.blue[900], fontSize: 12, fontWeight: FontWeight.bold))),
                    const SizedBox(width: 8),
                    const Text('Nova Official Store', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                      decoration: BoxDecoration(color: const Color(0xFF003366), borderRadius: BorderRadius.circular(2)),
                      child: const Text('MALL', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold)),
                    ),
                    const Icon(Icons.chevron_right, size: 16, color: Colors.grey),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(color: Colors.red[50], borderRadius: BorderRadius.circular(12)),
                  child: Text('Chờ xác nhận', style: TextStyle(color: primaryColor, fontSize: 11, fontWeight: FontWeight.bold)),
                )
              ],
            ),
          ),
          // Order Meta
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                RichText(
                  text: const TextSpan(
                    style: TextStyle(color: Colors.grey, fontSize: 11),
                    children: [
                      TextSpan(text: 'Mã đơn: '),
                      TextSpan(text: '#SN20241025-9912', style: TextStyle(color: Colors.black87, fontWeight: FontWeight.bold)),
                    ]
                  )
                ),
                const Text('Đặt lúc: 14:15 hôm nay', style: TextStyle(color: Colors.grey, fontSize: 11)),
              ],
            ),
          ),
          // Items
          _buildOrderItem('Áo Thun Cotton Unisex Form Rộng', 'Phân loại: Trắng Basic, Size L', '99.000₫', 'x1'),
          _buildOrderItem('Quần Short Kaki Ống Rộng', 'Phân loại: Be Vintage, Size M', '165.000₫', 'x1'),
          // Delivery Banner
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(color: Colors.green[50]?.withOpacity(0.5), borderRadius: BorderRadius.circular(8)),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(4),
                  decoration: const BoxDecoration(color: Colors.green, shape: BoxShape.circle),
                  child: const Icon(Icons.bolt, color: Colors.white, size: 14),
                ),
                const SizedBox(width: 8),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Nova Express - Hỏa Tốc 2H', style: TextStyle(color: Colors.green, fontWeight: FontWeight.bold, fontSize: 12)),
                      SizedBox(height: 2),
                      Text('Giao trước 17:00 hôm nay sau khi shop xác nhận', style: TextStyle(color: Colors.grey, fontSize: 11)),
                    ],
                  ),
                )
              ],
            ),
          ),
          const Divider(height: 1, color: Color(0xFFEEEEEE)),
          // Total
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('2 sản phẩm (Ví NovaPay)', style: TextStyle(color: Colors.grey, fontSize: 12)),
                Row(
                  children: [
                    const Text('Thành tiền: ', style: TextStyle(color: Colors.grey, fontSize: 12)),
                    Text('264.000₫', style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold, fontSize: 16)),
                  ],
                )
              ],
            ),
          ),
          // Actions
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: Colors.grey[50], borderRadius: const BorderRadius.vertical(bottom: Radius.circular(12))),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                OutlinedButton(
                  onPressed: () {},
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.black87,
                    side: BorderSide(color: Colors.grey[300]!),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    minimumSize: const Size(0, 36)
                  ),
                  child: const Text('Hủy đơn', style: TextStyle(fontSize: 12)),
                ),
                const SizedBox(width: 8),
                OutlinedButton.icon(
                  onPressed: () {},
                  icon: const Icon(Icons.edit_location, size: 14),
                  label: const Text('Đổi địa chỉ', style: TextStyle(fontSize: 12)),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.black87,
                    side: BorderSide(color: Colors.grey[300]!),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    minimumSize: const Size(0, 36)
                  ),
                ),
                const SizedBox(width: 8),
                ElevatedButton.icon(
                  onPressed: () {},
                  icon: const Icon(Icons.chat, size: 14),
                  label: const Text('Liên hệ Shop', style: TextStyle(fontSize: 12)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: primaryColor,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    minimumSize: const Size(0, 36)
                  ),
                )
              ],
            ),
          )
        ],
      ),
    );
  }

  Widget _buildOrderCard2() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 4, offset: const Offset(0, 2))
        ]
      ),
      child: Column(
        children: [
          // Shop Header
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: Colors.grey[50], borderRadius: const BorderRadius.vertical(top: Radius.circular(12))),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    CircleAvatar(radius: 14, backgroundColor: Colors.blue[100], child: Text('T', style: TextStyle(color: Colors.blue[900], fontSize: 12, fontWeight: FontWeight.bold))),
                    const SizedBox(width: 8),
                    const Text('TechNova Global Store', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                      decoration: BoxDecoration(color: const Color(0xFF003366), borderRadius: BorderRadius.circular(2)),
                      child: const Text('MALL', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold)),
                    ),
                    const Icon(Icons.chevron_right, size: 16, color: Colors.grey),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(color: Colors.red[50], borderRadius: BorderRadius.circular(12)),
                  child: Text('Đang chờ duyệt', style: TextStyle(color: primaryColor, fontSize: 11, fontWeight: FontWeight.bold)),
                )
              ],
            ),
          ),
          // Order Meta
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                RichText(
                  text: const TextSpan(
                    style: TextStyle(color: Colors.grey, fontSize: 11),
                    children: [
                      TextSpan(text: 'Mã đơn: '),
                      TextSpan(text: '#SN20241025-9850', style: TextStyle(color: Colors.black87, fontWeight: FontWeight.bold)),
                    ]
                  )
                ),
                const Text('Đặt lúc: 13:40 hôm nay', style: TextStyle(color: Colors.grey, fontSize: 11)),
              ],
            ),
          ),
          // Items
          _buildOrderItem('Củ sạc nhanh GaN 65W Đa Cổng', 'Phân loại: Đen Nhám, Chân gập', '249.000₫', 'x1'),
          const Divider(height: 1, color: Color(0xFFEEEEEE)),
          // Total
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('1 sản phẩm (Thanh toán COD)', style: TextStyle(color: Colors.grey, fontSize: 12)),
                Row(
                  children: [
                    const Text('Thành tiền: ', style: TextStyle(color: Colors.grey, fontSize: 12)),
                    Text('249.000₫', style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold, fontSize: 16)),
                  ],
                )
              ],
            ),
          ),
          // Actions
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: Colors.grey[50], borderRadius: const BorderRadius.vertical(bottom: Radius.circular(12))),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                OutlinedButton(
                  onPressed: () {},
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.black87,
                    side: BorderSide(color: Colors.grey[300]!),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    minimumSize: const Size(0, 36)
                  ),
                  child: const Text('Hủy đơn', style: TextStyle(fontSize: 12)),
                ),
                const SizedBox(width: 8),
                ElevatedButton.icon(
                  onPressed: () {},
                  icon: const Icon(Icons.chat, size: 14),
                  label: const Text('Liên hệ Người bán', style: TextStyle(fontSize: 12)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: primaryColor,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    minimumSize: const Size(0, 36)
                  ),
                )
              ],
            ),
          )
        ],
      ),
    );
  }

  Widget _buildOrderItem(String title, String variant, String price, String qty) {
    return Padding(
      padding: const EdgeInsets.all(12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 60, height: 60,
            decoration: BoxDecoration(color: Colors.grey[200], borderRadius: BorderRadius.circular(8)),
            child: const Icon(Icons.image, color: Colors.grey),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13), maxLines: 1, overflow: TextOverflow.ellipsis),
                const SizedBox(height: 4),
                Text(variant, style: const TextStyle(color: Colors.grey, fontSize: 11)),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(price, style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold, fontSize: 13)),
                    Text(qty, style: const TextStyle(color: Colors.grey, fontSize: 12)),
                  ],
                )
              ],
            ),
          )
        ],
      ),
    );
  }

  Widget _buildRecommendedSection() {
    return Container(
      margin: const EdgeInsets.only(top: 16),
      padding: const EdgeInsets.all(12),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(width: 4, height: 16, decoration: BoxDecoration(color: primaryColor, borderRadius: BorderRadius.circular(2))),
                  const SizedBox(width: 8),
                  const Text('Có Thể Bạn Cũng Thích', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                ],
              ),
              Row(
                children: [
                  Text('Xem tất cả', style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold, fontSize: 12)),
                  Icon(Icons.chevron_right, size: 16, color: primaryColor),
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
            childAspectRatio: 0.72,
            children: [
              _buildProductCard('Giày Sneaker Canvas Cổ Thấp Vintage Phong Cách Hàn Quốc', '4.9', '1.8k đã bán', '189.000₫', tag: '-35%'),
              _buildProductCard('Đệm Ngồi Văn Phòng Công Thái Học Chống Mỏi Lưng Êm Ái', '5.0', '840 đã bán', '145.000₫', isMall: true),
              _buildProductCard('Bình Giữ Nhiệt Inox 316 Cao Cấp 800ml Giữ Nhiệt 24H', '4.8', '3.2k đã bán', '129.000₫', tag: '-20%'),
              _buildProductCard('Bộ Kẹp Dây Cáp Silicon Dán Bàn Chống Rối Gọn Gàng', '4.9', '950 đã bán', '32.000₫'),
            ],
          )
        ],
      ),
    );
  }

  Widget _buildProductCard(String title, String rating, String sold, String price, {String? tag, bool isMall = false}) {
    return Container(
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: Colors.grey[200]!)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Stack(
              children: [
                Container(
                  decoration: const BoxDecoration(color: Color(0xFFEEEEEE), borderRadius: BorderRadius.vertical(top: Radius.circular(12))),
                  width: double.infinity,
                  child: const Icon(Icons.image, color: Colors.grey, size: 40),
                ),
                if (tag != null)
                  Positioned(
                    top: 8, left: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(color: primaryColor, borderRadius: BorderRadius.circular(4)),
                      child: Text(tag, style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                    ),
                  ),
                if (isMall)
                  Positioned(
                    top: 8, left: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(color: const Color(0xFF003366), borderRadius: BorderRadius.circular(4)),
                      child: const Text('MALL', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                    ),
                  ),
                Positioned(
                  top: 8, right: 8,
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(color: Colors.white.withOpacity(0.8), shape: BoxShape.circle),
                    child: const Icon(Icons.favorite_border, size: 16, color: Colors.grey),
                  ),
                )
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, height: 1.3)),
                const SizedBox(height: 4),
                Row(
                  children: [
                    const Icon(Icons.star, color: Colors.amber, size: 12),
                    Text(' $rating', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 10)),
                    Text(' ($sold)', style: const TextStyle(color: Colors.grey, fontSize: 10)),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(price, style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold, fontSize: 14)),
                    Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(color: Colors.red[50], shape: BoxShape.circle),
                      child: Icon(Icons.add_shopping_cart, color: primaryColor, size: 14),
                    )
                  ],
                )
              ],
            ),
          )
        ],
      ),
    );
  }

  Widget _buildFooter() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.verified_user, color: Colors.green, size: 16),
          const SizedBox(width: 6),
          const Expanded(
            child: Text(
              'Đơn hàng được bảo vệ 100% bởi Chính sách Trả hàng & Hoàn tiền Nova',
              style: TextStyle(color: Colors.grey, fontSize: 11),
              textAlign: TextAlign.center,
            ),
          )
        ],
      ),
    );
  }
}

class MapPlaceholderPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white
      ..strokeWidth = 4;
    
    // Draw some grid lines
    canvas.drawLine(Offset(0, size.height * 0.3), Offset(size.width, size.height * 0.3), paint);
    canvas.drawLine(Offset(0, size.height * 0.7), Offset(size.width, size.height * 0.7), paint);
    canvas.drawLine(Offset(size.width * 0.4, 0), Offset(size.width * 0.4, size.height), paint);

    // Draw route line
    final routePaint = Paint()
      ..color = const Color(0xFFEE4D2D).withOpacity(0.5)
      ..strokeWidth = 4
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    final path = Path();
    path.moveTo(size.width * 0.2, size.height * 0.2);
    path.quadraticBezierTo(size.width * 0.5, size.height * 0.3, size.width * 0.6, size.height * 0.6);
    canvas.drawPath(path, routePaint);
    
    // Draw driver dot
    final dotPaint = Paint()..color = const Color(0xFFEE4D2D);
    canvas.drawCircle(Offset(size.width * 0.6, size.height * 0.6), 8, dotPaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
