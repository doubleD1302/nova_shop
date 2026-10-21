import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

class DepositScreen extends StatefulWidget {
  const DepositScreen({super.key});

  @override
  State<DepositScreen> createState() => _DepositScreenState();
}

class _DepositScreenState extends State<DepositScreen> {
  final Color primaryColor = const Color(0xFFEE4D2D);
  bool _isBalanceVisible = true;
  final String _realBalance = "350.000";
  
  final TextEditingController _amountController = TextEditingController(text: "500.000");
  final FocusNode _amountFocus = FocusNode();
  
  int _selectedAmount = 500000;
  final List<int> _quickAmounts = [50000, 100000, 200000, 500000, 1000000, 2000000];
  
  String _selectedSource = 'vcb';

  @override
  void initState() {
    super.initState();
    _amountController.addListener(_onAmountChanged);
  }

  @override
  void dispose() {
    _amountController.dispose();
    _amountFocus.dispose();
    super.dispose();
  }

  void _onAmountChanged() {
    String text = _amountController.text.replaceAll(RegExp(r'\D'), '');
    if (text.isEmpty) {
      if (_selectedAmount != 0) setState(() => _selectedAmount = 0);
      return;
    }
    
    int value = int.parse(text);
    String formatted = NumberFormat.currency(locale: 'vi_VN', symbol: '', decimalDigits: 0).format(value).trim();
    
    if (_amountController.text != formatted) {
      _amountController.value = TextEditingValue(
        text: formatted,
        selection: TextSelection.collapsed(offset: formatted.length),
      );
    }
    
    if (_selectedAmount != value) {
      setState(() {
        _selectedAmount = value;
      });
    }
  }
  
  void _selectQuickAmount(int amount) {
    String formatted = NumberFormat.currency(locale: 'vi_VN', symbol: '', decimalDigits: 0).format(amount).trim();
    _amountController.value = TextEditingValue(
      text: formatted,
      selection: TextSelection.collapsed(offset: formatted.length),
    );
    setState(() {
      _selectedAmount = amount;
    });
    _amountFocus.unfocus();
  }

  void _clearAmount() {
    _amountController.clear();
    setState(() {
      _selectedAmount = 0;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF9F9FF),
      appBar: AppBar(
        backgroundColor: Colors.white.withValues(alpha: 0.85),
        elevation: 0,
        scrolledUnderElevation: 4,
        shadowColor: Colors.black.withValues(alpha: 0.1),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.black87),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('Nạp Tiền Ví NovaPay', style: TextStyle(color: Colors.black87, fontWeight: FontWeight.bold, fontSize: 16)),
        actions: [
          IconButton(
            icon: const Icon(Icons.history, color: Colors.black54),
            tooltip: 'Lịch sử giao dịch',
            onPressed: () {
              showModalBottomSheet(
                context: context,
                shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
                builder: (ctx) => Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Lịch Sử Nạp / Rút Ví', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                      const SizedBox(height: 12),
                      ListTile(
                        leading: const Icon(Icons.arrow_downward, color: Colors.green),
                        title: const Text('+500.000 ₫ (Nạp qua Vietcombank)'),
                        subtitle: const Text('Hôm nay • Thành công'),
                        trailing: const Text('Ví NovaPay', style: TextStyle(color: Colors.grey, fontSize: 11)),
                      ),
                      ListTile(
                        leading: const Icon(Icons.shopping_bag_outlined, color: Colors.red),
                        title: const Text('-180.000 ₫ (Thanh toán đơn hàng)'),
                        subtitle: const Text('Hôm qua • Đã quyết toán'),
                        trailing: const Text('Đơn #ORD1203', style: TextStyle(color: Colors.grey, fontSize: 11)),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.support_agent, color: Colors.black54),
            tooltip: 'Hỗ trợ khách hàng',
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Tổng đài hỗ trợ Ví NovaPay: 1900 1228 (Miễn phí 24/7)')),
              );
            },
          ),
          Container(
            margin: const EdgeInsets.only(right: 16),
            width: 32, height: 32,
            decoration: BoxDecoration(color: Colors.grey[300], shape: BoxShape.circle),
            child: const Icon(Icons.person, color: Colors.white, size: 20),
          )
        ],
      ),
      body: Stack(
        children: [
          SingleChildScrollView(
            padding: const EdgeInsets.only(bottom: 120),
            child: Column(
              children: [
                _buildWalletCard(),
                _buildAmountInputSection(),
                _buildVoucherBanner(),
                _buildPaymentSources(),
                _buildSecurityAssurance(),
                const SizedBox(height: 24),
              ],
            ),
          ),
          _buildBottomActionBar(),
        ],
      ),
    );
  }

  Widget _buildWalletCard() {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topRight,
          end: Alignment.bottomLeft,
          colors: [Color(0xFFEE4D2D), Color(0xFFD63C1E), Color(0xFFFF5722)],
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(color: primaryColor.withValues(alpha: 0.3), blurRadius: 12, offset: const Offset(0, 6))
        ]
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    width: 32, height: 32,
                    decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(8)),
                    child: const Icon(Icons.account_balance_wallet, color: Colors.white, size: 20),
                  ),
                  const SizedBox(width: 12),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('NovaPay', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16, letterSpacing: -0.5)),
                      Text('ShopNova Ecosystem'.toUpperCase(), style: TextStyle(color: Colors.white.withValues(alpha: 0.8), fontSize: 9, letterSpacing: 1)),
                    ],
                  )
                ],
              ),
              Row(
                children: [
                  Icon(Icons.contactless, color: Colors.white.withValues(alpha: 0.8), size: 20),
                  const SizedBox(width: 8),
                  Container(
                    width: 32, height: 24,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Colors.amber[200]!, Colors.amber[400]!]),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      children: [
                        Container(height: 1.5, color: Colors.amber[700]!.withValues(alpha: 0.4)),
                        Container(height: 1.5, color: Colors.amber[700]!.withValues(alpha: 0.4)),
                      ],
                    ),
                  )
                ],
              )
            ],
          ),
          const SizedBox(height: 24),
          Row(
            children: [
              Text('Số dư hiện tại', style: TextStyle(color: Colors.white.withValues(alpha: 0.8), fontSize: 12, fontWeight: FontWeight.w500)),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: () => setState(() => _isBalanceVisible = !_isBalanceVisible),
                child: Icon(_isBalanceVisible ? Icons.visibility : Icons.visibility_off, color: Colors.white.withValues(alpha: 0.9), size: 16),
              )
            ],
          ),
          const SizedBox(height: 4),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(_isBalanceVisible ? _realBalance : '••••••••', style: const TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.w900, letterSpacing: -0.5)),
              const SizedBox(width: 4),
              Text('đ', style: TextStyle(color: Colors.white.withValues(alpha: 0.9), fontSize: 16, fontWeight: FontWeight.bold)),
            ],
          ),
          const SizedBox(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('MÃ SỐ VÍ ĐIỆN TỬ', style: TextStyle(color: Colors.white.withValues(alpha: 0.75), fontSize: 10, letterSpacing: 1)),
                  const SizedBox(height: 2),
                  const Text('NOVAPAY •••• 6879', style: TextStyle(color: Colors.white, fontSize: 14, fontFamily: 'monospace', letterSpacing: 2)),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(20)),
                child: Row(
                  children: [
                    Icon(Icons.verified_user, color: Colors.greenAccent[400], size: 14),
                    const SizedBox(width: 4),
                    const Text('PCI-DSS L1 • Chính chủ', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold)),
                  ],
                ),
              )
            ],
          )
        ],
      ),
    );
  }

  Widget _buildAmountInputSection() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 8, offset: const Offset(0, 2))]),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Icon(Icons.payments, color: primaryColor, size: 18),
                  const SizedBox(width: 6),
                  const Text('Số tiền muốn nạp', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                ],
              ),
              const Text('Hạn mức 50M/ngày', style: TextStyle(color: Colors.grey, fontSize: 11, fontWeight: FontWeight.w500)),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            decoration: BoxDecoration(
              color: const Color(0xFFF3F4F6),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: _amountFocus.hasFocus ? primaryColor.withValues(alpha: 0.3) : Colors.transparent, width: 2)
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _amountController,
                    focusNode: _amountFocus,
                    keyboardType: TextInputType.number,
                    style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.black87),
                    decoration: const InputDecoration(
                      border: InputBorder.none,
                      hintText: '0',
                      hintStyle: TextStyle(color: Colors.grey),
                    ),
                  ),
                ),
                Text('đ', style: TextStyle(color: primaryColor, fontSize: 20, fontWeight: FontWeight.bold)),
                if (_amountController.text.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(left: 12),
                    child: GestureDetector(
                      onTap: _clearAmount,
                      child: Container(
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(color: Colors.grey[300], shape: BoxShape.circle),
                        child: const Icon(Icons.close, size: 14, color: Colors.black54),
                      ),
                    ),
                  )
              ],
            ),
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Tối thiểu: 10.000đ', style: TextStyle(color: Colors.grey, fontSize: 11)),
              Row(
                children: [
                  Icon(Icons.check_circle, color: Colors.green[700], size: 12),
                  const SizedBox(width: 4),
                  Text('Miễn phí nạp 100%', style: TextStyle(color: Colors.green[800], fontSize: 11, fontWeight: FontWeight.w500)),
                ],
              )
            ],
          ),
          const SizedBox(height: 16),
          const Text('Gợi ý mệnh giá nạp nhanh', style: TextStyle(color: Colors.grey, fontSize: 12, fontWeight: FontWeight.w500)),
          const SizedBox(height: 8),
          GridView.count(
            crossAxisCount: 3,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            childAspectRatio: 2.2,
            children: _quickAmounts.map((amount) {
              bool isSelected = _selectedAmount == amount;
              return GestureDetector(
                onTap: () => _selectQuickAmount(amount),
                child: Container(
                  decoration: BoxDecoration(
                    color: isSelected ? primaryColor.withValues(alpha: 0.1) : const Color(0xFFF3F4F6),
                    borderRadius: BorderRadius.circular(8),
                    border: isSelected ? Border.all(color: primaryColor.withValues(alpha: 0.8), width: 2) : null,
                  ),
                  alignment: Alignment.center,
                  child: Stack(
                    clipBehavior: Clip.none,
                    children: [
                      Center(
                        child: Text(
                          '${NumberFormat.currency(locale: 'vi_VN', symbol: '', decimalDigits: 0).format(amount).trim()}đ',
                          style: TextStyle(
                            color: isSelected ? primaryColor : Colors.black87,
                            fontWeight: isSelected ? FontWeight.w900 : FontWeight.bold,
                            fontSize: 13,
                          ),
                        ),
                      ),
                      if (isSelected)
                        Positioned(
                          top: -8, right: -4,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(color: primaryColor, borderRadius: BorderRadius.circular(10), boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.1), blurRadius: 2)]),
                            child: const Text('Đang chọn', style: TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.bold)),
                          ),
                        ),
                      if (!isSelected && amount == 1000000)
                        Positioned(
                          top: -8, right: -4,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(color: Colors.green[600], borderRadius: BorderRadius.circular(10), boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.1), blurRadius: 2)]),
                            child: const Text('Phổ biến', style: TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.bold)),
                          ),
                        ),
                    ],
                  ),
                ),
              );
            }).toList(),
          )
        ],
      ),
    );
  }

  Widget _buildVoucherBanner() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(colors: [primaryColor.withValues(alpha: 0.15), Colors.blue[50]!]),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36, height: 36,
            decoration: BoxDecoration(color: primaryColor, shape: BoxShape.circle),
            child: const Icon(Icons.local_activity, color: Colors.white, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(color: primaryColor, borderRadius: BorderRadius.circular(4)),
                      child: const Text('ĐỘC QUYỀN VÍ', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold)),
                    ),
                    const SizedBox(width: 6),
                    const Text('Voucher giảm 30.000đ', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                  ],
                ),
                const SizedBox(height: 6),
                RichText(
                  text: TextSpan(
                    style: const TextStyle(color: Colors.black87, fontSize: 12, height: 1.4),
                    children: [
                      const TextSpan(text: 'Áp dụng mã '),
                      TextSpan(text: 'NOVAPAY500K', style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold, backgroundColor: primaryColor.withValues(alpha: 0.1))),
                      const TextSpan(text: ' cho đơn từ 200k khi nạp thành công mốc 500.000đ.'),
                    ]
                  )
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Icon(Icons.stars, color: Colors.green[700], size: 14),
                    const SizedBox(width: 4),
                    Text('Tự động kích hoạt hoàn 1% Xu tại ShopNova Mall', style: TextStyle(color: Colors.green[800], fontSize: 11, fontWeight: FontWeight.w500)),
                  ],
                )
              ],
            ),
          )
        ],
      ),
    );
  }

  Widget _buildPaymentSources() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 8, offset: const Offset(0, 2))]),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Nguồn tiền nạp', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
              const Text('4 phương thức', style: TextStyle(color: Colors.grey, fontSize: 12, fontWeight: FontWeight.w500)),
            ],
          ),
          const SizedBox(height: 12),
          _buildPaymentSourceTile(
            id: 'vcb',
            title: 'Vietcombank',
            subtitle: 'Tài khoản: •••• 8829\nSố dư khả dụng: 8.520.000đ',
            iconWidget: Container(
              width: 40, height: 40,
              decoration: BoxDecoration(color: Colors.green[700], borderRadius: BorderRadius.circular(8)),
              child: const Center(child: Text('VCB', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 11))),
            ),
            badge: 'Miễn phí',
            badgeColor: Colors.green,
          ),
          const SizedBox(height: 8),
          _buildPaymentSourceTile(
            id: 'tcb',
            title: 'Techcombank',
            subtitle: 'Thẻ ATM liên kết: •••• 4216',
            iconWidget: Container(
              width: 40, height: 40,
              decoration: BoxDecoration(color: Colors.red[600], borderRadius: BorderRadius.circular(8)),
              child: const Center(child: Text('TCB', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 11))),
            ),
            badge: 'Miễn phí',
            badgeColor: Colors.green,
          ),
          const SizedBox(height: 8),
          _buildPaymentSourceTile(
            id: 'vietqr',
            title: 'VNPAY-QR / VietQR',
            subtitle: 'Quét mã bằng mọi ứng dụng ngân hàng',
            iconWidget: Container(
              width: 40, height: 40,
              decoration: BoxDecoration(color: Colors.blue[600], borderRadius: BorderRadius.circular(8)),
              child: const Icon(Icons.qr_code_scanner, color: Colors.white, size: 22),
            ),
            badge: 'Nhanh',
            badgeColor: Colors.blue,
          ),
          const SizedBox(height: 8),
          _buildPaymentSourceTile(
            id: 'card',
            title: 'Thẻ Quốc Tế Visa / Master',
            subtitle: 'Hỗ trợ thẻ tín dụng, ghi nợ quốc tế',
            iconWidget: Container(
              width: 40, height: 40,
              decoration: BoxDecoration(color: Colors.blueGrey[800], borderRadius: BorderRadius.circular(8)),
              child: const Icon(Icons.credit_card, color: Colors.white, size: 22),
            ),
            badge: 'Phí 1.5%',
            badgeColor: Colors.red,
          ),
          const SizedBox(height: 12),
          InkWell(
            onTap: _showLinkBankAccountDialog,
            borderRadius: BorderRadius.circular(12),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(color: const Color(0xFFF3F4F6), borderRadius: BorderRadius.circular(12)),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.add_circle, color: primaryColor, size: 20),
                  const SizedBox(width: 8),
                  Text('Liên kết thêm tài khoản ngân hàng mới', style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold, fontSize: 13)),
                ],
              ),
            ),
          )
        ],
      ),
    );
  }

  Widget _buildPaymentSourceTile({required String id, required String title, required String subtitle, required Widget iconWidget, required String badge, required MaterialColor badgeColor}) {
    bool isSelected = _selectedSource == id;
    return GestureDetector(
      onTap: () => setState(() => _selectedSource = id),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isSelected ? primaryColor.withValues(alpha: 0.05) : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: isSelected ? primaryColor.withValues(alpha: 0.6) : Colors.transparent, width: 1.5),
        ),
        child: Row(
          children: [
            iconWidget,
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(child: Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13), overflow: TextOverflow.ellipsis)),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(color: badgeColor[50], borderRadius: BorderRadius.circular(4)),
                        child: Text(badge, style: TextStyle(color: badgeColor[700], fontSize: 9, fontWeight: FontWeight.bold)),
                      )
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(subtitle, style: const TextStyle(color: Colors.grey, fontSize: 11, height: 1.3)),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Container(
              width: 20, height: 20,
              decoration: BoxDecoration(
                color: isSelected ? primaryColor : Colors.grey[200],
                shape: BoxShape.circle,
              ),
              child: isSelected ? const Icon(Icons.check, color: Colors.white, size: 14) : null,
            )
          ],
        ),
      ),
    );
  }

  Widget _buildSecurityAssurance() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: const Color(0xFFF3F4F6), borderRadius: BorderRadius.circular(12)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40, height: 40,
            decoration: BoxDecoration(color: Colors.green.withValues(alpha: 0.15), shape: BoxShape.circle),
            child: Icon(Icons.gpp_good, color: Colors.green[700], size: 24),
          ),
          const SizedBox(width: 12),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Bảo mật giao dịch tối đa', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                SizedBox(height: 4),
                Text('Xác thực kép sinh trắc học FaceID/Vân tay & OTP. Giám sát an ninh 24/7 theo quy chuẩn Ngân hàng Nhà nước Việt Nam.', style: TextStyle(color: Colors.black54, fontSize: 11, height: 1.4)),
              ],
            ),
          )
        ],
      ),
    );
  }

  Widget _buildBottomActionBar() {
    String sourceLabel = 'Vietcombank (•••• 8829)';
    if (_selectedSource == 'tcb') sourceLabel = 'Techcombank (•••• 4216)';
    if (_selectedSource == 'vietqr') sourceLabel = 'Mã VNPAY-QR / VietQR';
    if (_selectedSource == 'card') sourceLabel = 'Thẻ Quốc Tế Visa/Master';

    return Positioned(
      bottom: 0, left: 0, right: 0,
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.95),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 24, offset: const Offset(0, -4))]
        ),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Text('Nguồn nạp: ', style: TextStyle(color: Colors.grey, fontSize: 12)),
                    Text(sourceLabel, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                  ],
                ),
                Row(
                  children: [
                    const Text('Phí giao dịch: ', style: TextStyle(color: Colors.grey, fontSize: 12)),
                    Text(_selectedSource == 'card' ? '1.5%' : '0đ (Miễn phí)', style: TextStyle(color: Colors.green[700], fontWeight: FontWeight.bold, fontSize: 12)),
                  ],
                )
              ],
            ),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('TỔNG THANH TOÁN', style: TextStyle(color: Colors.grey, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 0.5)),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Text(_amountController.text.isEmpty ? '0' : _amountController.text, style: TextStyle(color: primaryColor, fontWeight: FontWeight.w900, fontSize: 24)),
                        const SizedBox(width: 2),
                        Text('đ', style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold, fontSize: 16)),
                      ],
                    )
                  ],
                ),
                ElevatedButton.icon(
                  onPressed: _selectedAmount > 0 ? _handleDeposit : null,
                  icon: const Icon(Icons.lock, size: 20),
                  label: Text('Nạp ${_amountController.text.isEmpty ? '0' : _amountController.text}đ', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: primaryColor,
                    foregroundColor: Colors.white,
                    disabledBackgroundColor: Colors.grey[300],
                    disabledForegroundColor: Colors.grey[500],
                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    elevation: 4,
                    shadowColor: primaryColor.withValues(alpha: 0.5),
                  ),
                )
              ],
            )
          ],
        ),
      ),
    );
  }

  void _handleDeposit() {
    final amountStr = _amountController.text.trim();
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(color: Colors.green.shade50, shape: BoxShape.circle),
              child: const Icon(Icons.check_circle, color: Colors.green, size: 44),
            ),
            const SizedBox(height: 16),
            const Text(
              'Nạp Tiền Thành Công!',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
            ),
            const SizedBox(height: 8),
            Text(
              '+$amountStr đ',
              style: TextStyle(color: primaryColor, fontWeight: FontWeight.bold, fontSize: 22),
            ),
            const SizedBox(height: 8),
            Text(
              'Đã nạp thành công vào Ví ShopNova từ nguồn ${_selectedSource.toUpperCase()}.\nMã GD: #TXN${DateTime.now().millisecondsSinceEpoch.toRadixString(36).toUpperCase()}',
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.grey, fontSize: 12),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.pop(ctx);
                  Navigator.pop(context);
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: primaryColor,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
                child: const Text('Hoàn tất'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showLinkBankAccountDialog() {
    final bankCtrl = TextEditingController();
    final accCtrl = TextEditingController();
    final nameCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Liên kết Ngân hàng Mới', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: bankCtrl,
                decoration: const InputDecoration(
                  labelText: 'Tên Ngân Hàng',
                  hintText: 'Ví dụ: MB Bank, Techcombank...',
                  border: OutlineInputBorder(),
                  contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: accCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Số tài khoản ngân hàng',
                  border: OutlineInputBorder(),
                  contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: nameCtrl,
                textCapitalization: TextCapitalization.characters,
                decoration: const InputDecoration(
                  labelText: 'Tên chủ tài khoản',
                  border: OutlineInputBorder(),
                  contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Hủy', style: TextStyle(color: Colors.grey)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Đã liên kết tài khoản ngân hàng thành công!'),
                  backgroundColor: Colors.green,
                ),
              );
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: primaryColor,
              foregroundColor: Colors.white,
            ),
            child: const Text('Liên kết ngay'),
          ),
        ],
      ),
    );
  }
}
