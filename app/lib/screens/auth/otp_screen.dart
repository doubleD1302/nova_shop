import 'package:flutter/material.dart';
import '../../theme/app_colors.dart';

class OtpScreen extends StatefulWidget {
  const OtpScreen({super.key});

  @override
  State<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends State<OtpScreen> {
  final List<String> _otp = [];
  final int _maxLength = 6;
  int _remainingSeconds = 54;
  bool _isProcessing = false;

  void _handleSubmitOtp() async {
    if (_otp.length < _maxLength || _isProcessing) return;
    setState(() => _isProcessing = true);
    await Future.delayed(const Duration(milliseconds: 600));
    if (!mounted) return;
    setState(() => _isProcessing = false);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Xác thực OTP thành công! Đang chuyển hướng...'),
        backgroundColor: Color(0xFF00BFA5),
        duration: Duration(seconds: 1),
      ),
    );
    await Future.delayed(const Duration(milliseconds: 500));
    if (mounted) {
      Navigator.pop(context, true);
    }
  }

  void _onKeypadPressed(String val) {
    if (_otp.length < _maxLength) {
      setState(() {
        _otp.add(val);
        if (_otp.length == _maxLength) {
          _handleSubmitOtp();
        }
      });
    }
  }

  void _onBackspacePressed() {
    if (_otp.isNotEmpty) {
      setState(() {
        _otp.removeLast();
        _isProcessing = false;
      });
    }
  }

  void _onPastePressed() {
    setState(() {
      _otp.clear();
      _otp.addAll(['9', '8', '2', '4', '1', '7']);
      _handleSubmitOtp();
    });
  }

  PreferredSizeWidget _buildAppBar() {
    return AppBar(
      backgroundColor: Colors.white,
      elevation: 0,
      surfaceTintColor: Colors.transparent,
      bottom: PreferredSize(
        preferredSize: const Size.fromHeight(1),
        child: Container(color: const Color(0xFFEEEEF0), height: 1),
      ),
      leading: IconButton(
        icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20, color: Color(0xFF1E2022)),
        onPressed: () => Navigator.pop(context),
      ),
      title: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(5),
            decoration: BoxDecoration(
              color: AppColors.surfaceAlt,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.border, width: 0.8),
            ),
            child: const Icon(Icons.shopping_bag_rounded, color: AppColors.primary, size: 20),
          ),
          const SizedBox(width: 8),
          RichText(
            text: const TextSpan(
              children: [
                TextSpan(
                  text: 'Nova',
                  style: TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 19,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -0.5,
                  ),
                ),
                TextSpan(
                  text: 'Shop',
                  style: TextStyle(
                    color: AppColors.primary,
                    fontSize: 19,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -0.5,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      centerTitle: true,
      actions: [
        IconButton(
          icon: const Icon(Icons.help_outline_rounded, color: Color(0xFF555770), size: 22),
          onPressed: () {
            showDialog(
              context: context,
              builder: (ctx) => AlertDialog(
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                title: const Text('Hỗ trợ xác thực OTP', style: TextStyle(fontWeight: FontWeight.bold)),
                content: const Text(
                  'Mã xác thực OTP gồm 6 chữ số được gửi tới số điện thoại của bạn.\n\nNếu chưa nhận được mã sau 60 giây, vui lòng bấm "Gửi qua Zalo ZNS" hoặc "Cuộc gọi thoại", hoặc liên hệ tổng đài 1900 1234.',
                ),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.pop(ctx),
                    child: const Text('Đã hiểu', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            );
          },
        ),
        const SizedBox(width: 4),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: _buildAppBar(),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Column(
          children: [
            _buildTrustIndicator(),
            _buildHeroContent(),
            _buildOtpInputGrid(),
            _buildStatusHelper(),
            _buildResendActions(),
            _buildSubmitButton(),
            _buildKeypad(),
            _buildSecurityDisclaimer(),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _buildTrustIndicator() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: const [
              Icon(Icons.verified_user_rounded, color: Color(0xFF00BFA5), size: 18),
              SizedBox(width: 6),
              Text('BẢO MẬT ĐA TẦNG 256-BIT', style: TextStyle(color: Color(0xFF00897B), fontSize: 11, fontWeight: FontWeight.bold)),
            ],
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(color: AppColors.surfaceAlt, borderRadius: BorderRadius.circular(10)),
            child: const Text('Bước 2/2', style: TextStyle(color: AppColors.textSecondary, fontSize: 11, fontWeight: FontWeight.bold)),
          )
        ],
      ),
    );
  }

  Widget _buildHeroContent() {
    return Column(
      children: [
        const SizedBox(height: 12),
        Stack(
          clipBehavior: Clip.none,
          children: [
            Container(
              width: 60,
              height: 60,
              decoration: BoxDecoration(
                color: AppColors.surfaceAlt,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: AppColors.border),
                boxShadow: [
                  BoxShadow(color: AppColors.primary.withValues(alpha: 0.15), blurRadius: 12, offset: const Offset(0, 4)),
                ],
              ),
              child: const Icon(Icons.phonelink_lock_rounded, color: AppColors.primary, size: 32),
            ),
            Positioned(
              bottom: -4,
              right: -4,
              child: Container(
                width: 24,
                height: 24,
                decoration: const BoxDecoration(color: Color(0xFF00BFA5), shape: BoxShape.circle),
                child: const Icon(Icons.shield_rounded, color: Colors.white, size: 14),
              ),
            )
          ],
        ),
        const SizedBox(height: 16),
        const Text(
          'Xác thực số điện thoại 🔐',
          style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: Color(0xFF1E2022)),
        ),
        const SizedBox(height: 6),
        const Text(
          'Mã xác thực gồm 6 chữ số đã được gửi qua SMS / Zalo đến số:',
          textAlign: TextAlign.center,
          style: TextStyle(color: Color(0xFF8F90A6), fontSize: 13, height: 1.4),
        ),
        const SizedBox(height: 10),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          decoration: BoxDecoration(
            color: const Color(0xFFF0F4FF),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFFD0E1FD)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('+84 098 765 4321', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF1E2022))),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: () => Navigator.pop(context),
                child: Row(
                  children: const [
                    Text('Đổi số', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 12)),
                    SizedBox(width: 2),
                    Icon(Icons.edit_rounded, color: AppColors.primary, size: 14),
                  ],
                ),
              )
            ],
          ),
        ),
        const SizedBox(height: 20),
      ],
    );
  }

  Widget _buildOtpInputGrid() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(_maxLength, (index) {
        bool isActive = index == _otp.length;
        bool hasValue = index < _otp.length;
        String text = hasValue ? _otp[index] : '';

        return Container(
          margin: const EdgeInsets.symmetric(horizontal: 5),
          width: 48,
          height: 56,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isActive ? AppColors.primary : (hasValue ? const Color(0xFF28293D) : const Color(0xFFE2E2E6)),
              width: isActive ? 2 : 1,
            ),
            boxShadow: isActive
                ? [
                    BoxShadow(color: AppColors.primary.withOpacity(0.2), blurRadius: 8, offset: const Offset(0, 3)),
                  ]
                : const [
                    BoxShadow(color: Color(0x06000000), blurRadius: 4, offset: Offset(0, 2)),
                  ],
          ),
          child: Center(
            child: isActive
                ? Container(width: 2, height: 22, color: AppColors.primary)
                : Text(text, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: Color(0xFF1E2022))),
          ),
        );
      }),
    );
  }

  Widget _buildStatusHelper() {
    return Padding(
      padding: const EdgeInsets.only(top: 12, bottom: 16),
      child: _otp.length == _maxLength
          ? Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.verified_rounded, color: Color(0xFF00BFA5), size: 16),
                const SizedBox(width: 6),
                Text(
                  _isProcessing ? 'Đang xác thực...' : 'Đã nhập đủ 6 chữ số.',
                  style: const TextStyle(color: Color(0xFF00BFA5), fontSize: 12, fontWeight: FontWeight.bold),
                ),
              ],
            )
          : Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: const [
                Icon(Icons.check_circle_outline_rounded, color: Color(0xFF8F90A6), size: 16),
                SizedBox(width: 6),
                Text('Tự động kiểm tra sau khi điền đủ 6 số', style: TextStyle(color: Color(0xFF8F90A6), fontSize: 12)),
              ],
            ),
    );
  }

  Widget _buildResendActions() {
    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.schedule_rounded, color: Color(0xFF8F90A6), size: 16),
            const SizedBox(width: 4),
            const Text('Gửi lại mã sau: ', style: TextStyle(color: Color(0xFF8F90A6), fontSize: 12)),
            Text('00:$_remainingSeconds s', style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 13)),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            InkWell(
              onTap: () {
                setState(() => _remainingSeconds = 60);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Mã OTP mới đã được gửi qua Zalo ZNS thành công!'),
                    backgroundColor: Color(0xFF00BFA5),
                    duration: Duration(seconds: 2),
                  ),
                );
              },
              child: Row(
                children: const [
                  Icon(Icons.chat_bubble_outline_rounded, color: AppColors.primary, size: 16),
                  SizedBox(width: 4),
                  Text('Gửi qua Zalo ZNS', style: TextStyle(color: Color(0xFF1E2022), fontSize: 12, fontWeight: FontWeight.w600)),
                ],
              ),
            ),
            const SizedBox(width: 14),
            Container(width: 4, height: 4, decoration: const BoxDecoration(color: Color(0xFF8F90A6), shape: BoxShape.circle)),
            const SizedBox(width: 14),
            InkWell(
              onTap: () {
                setState(() => _remainingSeconds = 60);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Hệ thống đang kết nối cuộc gọi thoại đọc mã OTP...'),
                    duration: Duration(seconds: 2),
                  ),
                );
              },
              child: Row(
                children: const [
                  Icon(Icons.phone_forwarded_rounded, color: AppColors.primary, size: 16),
                  SizedBox(width: 4),
                  Text('Cuộc gọi thoại', style: TextStyle(color: Color(0xFF1E2022), fontSize: 12, fontWeight: FontWeight.w600)),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 20),
      ],
    );
  }

  Widget _buildSubmitButton() {
    final canSubmit = _otp.length == _maxLength && !_isProcessing;
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        gradient: canSubmit
            ? const LinearGradient(
                colors: [AppColors.primary, AppColors.earth],
              )
            : null,
        borderRadius: BorderRadius.circular(12),
        boxShadow: canSubmit
            ? [
                BoxShadow(color: AppColors.primary.withValues(alpha: 0.3), blurRadius: 8, offset: const Offset(0, 3)),
              ]
            : null,
      ),
      child: ElevatedButton(
        onPressed: canSubmit ? _handleSubmitOtp : null,
        style: ElevatedButton.styleFrom(
          backgroundColor: canSubmit ? Colors.transparent : const Color(0xFFE2E2E6),
          shadowColor: Colors.transparent,
          foregroundColor: Colors.white,
          disabledForegroundColor: const Color(0xFF8F90A6),
          minimumSize: const Size(double.infinity, 50),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              _isProcessing ? 'Đang xác thực...' : 'Xác Nhận & Hoàn Tất Đăng Ký',
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
            ),
            const SizedBox(width: 8),
            if (_isProcessing)
              const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
              )
            else
              const Icon(Icons.arrow_forward_rounded, size: 18),
          ],
        ),
      ),
    );
  }

  Widget _buildKeypad() {
    return Container(
      margin: const EdgeInsets.only(top: 20),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFEEEEF0)),
        boxShadow: const [
          BoxShadow(color: Color(0x06000000), blurRadius: 10, offset: Offset(0, 3))
        ],
      ),
      child: GridView.count(
        crossAxisCount: 3,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        childAspectRatio: 2.1,
        mainAxisSpacing: 8,
        crossAxisSpacing: 8,
        children: [
          _buildKey('1'), _buildKey('2'), _buildKey('3'),
          _buildKey('4'), _buildKey('5'), _buildKey('6'),
          _buildKey('7'), _buildKey('8'), _buildKey('9'),
          _buildPasteKey(), _buildKey('0'), _buildBackspaceKey(),
        ],
      ),
    );
  }

  Widget _buildKey(String text) {
    return Material(
      color: const Color(0xFFF7F7F8),
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        onTap: () => _onKeypadPressed(text),
        borderRadius: BorderRadius.circular(10),
        child: Center(
          child: Text(
            text,
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Color(0xFF1E2022)),
          ),
        ),
      ),
    );
  }

  Widget _buildPasteKey() {
    return Material(
      color: const Color(0xFFF7F7F8),
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        onTap: _onPastePressed,
        borderRadius: BorderRadius.circular(10),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: const [
            Icon(Icons.content_paste_rounded, color: Color(0xFF555770), size: 18),
            SizedBox(height: 2),
            Text('DÁN MÃ', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Color(0xFF555770))),
          ],
        ),
      ),
    );
  }

  Widget _buildBackspaceKey() {
    return Material(
      color: const Color(0xFFF7F7F8),
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        onTap: _onBackspacePressed,
        borderRadius: BorderRadius.circular(10),
        child: const Center(child: Icon(Icons.backspace_outlined, color: Color(0xFF1E2022), size: 20)),
      ),
    );
  }

  Widget _buildSecurityDisclaimer() {
    return Container(
      margin: const EdgeInsets.only(top: 16),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF0FDF4),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFBBF7D0)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: const [
          Icon(Icons.security_rounded, color: Color(0xFF16A34A), size: 20),
          SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Cam kết an toàn ShopNova Security', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Color(0xFF15803D))),
                SizedBox(height: 3),
                Text(
                  'Mã OTP có hiệu lực trong 5 phút. Vui lòng không chia sẻ mã cho bất kỳ ai kể cả nhân viên ShopNova.',
                  style: TextStyle(color: Color(0xFF166534), fontSize: 11, height: 1.4),
                )
              ],
            ),
          )
        ],
      ),
    );
  }
}
