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
        backgroundColor: Colors.green,
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[50],
      body: Column(
        children: [
          _buildAppBar(),
          Expanded(
            child: SingleChildScrollView(
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
          )
        ],
      ),
    );
  }

  Widget _buildAppBar() {
    return Container(
      padding: EdgeInsets.only(top: MediaQuery.of(context).padding.top),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.9),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 1),
          )
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                GestureDetector(
                  onTap: () => Navigator.pop(context),
                  child: const Icon(Icons.arrow_back_ios_new, size: 24, color: Colors.black87),
                ),
                const SizedBox(width: 8),
                const Icon(Icons.shopping_bag, color: AppColors.primary, size: 28),
                const SizedBox(width: 4),
                const Text(
                  'ShopNova',
                  style: TextStyle(color: AppColors.primary, fontSize: 18, fontWeight: FontWeight.bold, letterSpacing: -0.5),
                ),
              ],
            ),
            Row(
              children: [
                GestureDetector(
                  onTap: () {
                    showDialog(
                      context: context,
                      builder: (ctx) => AlertDialog(
                        title: const Text('Hỗ trợ xác thực OTP'),
                        content: const Text(
                          'Mã xác thực OTP gồm 6 chữ số được gửi tới số điện thoại của bạn.\n\nNếu chưa nhận được mã sau 60 giây, vui lòng bấm "Gửi qua Zalo ZNS" hoặc "Cuộc gọi thoại", hoặc liên hệ tổng đài 1900 1234.',
                        ),
                        actions: [
                          TextButton(
                            onPressed: () => Navigator.pop(ctx),
                            child: const Text('Đã hiểu'),
                          ),
                        ],
                      ),
                    );
                  },
                  child: const Icon(Icons.help_outline, color: Colors.grey, size: 24),
                ),
                const SizedBox(width: 12),
                Container(
                  width: 32, height: 32,
                  decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
                  child: const Icon(Icons.person, color: Colors.white, size: 18),
                )
              ],
            )
          ],
        ),
      ),
    );
  }

  Widget _buildTrustIndicator() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              const Icon(Icons.verified_user, color: Colors.green, size: 18),
              const SizedBox(width: 4),
              Text('BẢO MẬT ĐA TẦNG 256-BIT', style: TextStyle(color: Colors.green[700], fontSize: 10, fontWeight: FontWeight.bold)),
            ],
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(color: Colors.grey[200], borderRadius: BorderRadius.circular(12)),
            child: const Text('Bước 2/2', style: TextStyle(color: Colors.grey, fontSize: 10, fontWeight: FontWeight.bold)),
          )
        ],
      ),
    );
  }

  Widget _buildHeroContent() {
    return Column(
      children: [
        const SizedBox(height: 8),
        Stack(
          clipBehavior: Clip.none,
          children: [
            Container(
              width: 56, height: 56,
              decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(16)),
              child: const Icon(Icons.phonelink_lock, color: AppColors.primary, size: 30),
            ),
            Positioned(
              bottom: -4, right: -4,
              child: Container(
                width: 24, height: 24,
                decoration: const BoxDecoration(color: Colors.green, shape: BoxShape.circle),
                child: const Icon(Icons.shield, color: Colors.white, size: 14),
              ),
            )
          ],
        ),
        const SizedBox(height: 16),
        const Text('Xác thực số điện thoại 🔐', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.black87)),
        const SizedBox(height: 8),
        const Text(
          'Mã xác thực gồm 6 chữ số đã được gửi qua tin nhắn SMS / Zalo đến số:',
          textAlign: TextAlign.center,
          style: TextStyle(color: Colors.grey, fontSize: 14, height: 1.4),
        ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(color: Colors.blue[50], borderRadius: BorderRadius.circular(24)),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('+84 098 765 4321', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, letterSpacing: 0.5)),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: () => Navigator.pop(context),
                child: Row(
                  children: [
                    Text('Đổi số', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.w600, fontSize: 12)),
                    const SizedBox(width: 2),
                    Icon(Icons.edit, color: AppColors.primary, size: 14),
                  ],
                ),
              )
            ],
          ),
        ),
        const SizedBox(height: 24),
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
          margin: const EdgeInsets.symmetric(horizontal: 4),
          width: 48,
          height: 56,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            boxShadow: isActive ? [
              BoxShadow(color: Colors.black.withValues(alpha: 0.1), blurRadius: 8, offset: const Offset(0, 4))
            ] : [
              BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 4, offset: const Offset(0, 2))
            ],
            border: isActive ? Border.all(color: AppColors.primary, width: 2) : Border.all(color: Colors.transparent),
          ),
          child: Center(
            child: isActive
              ? Container(width: 2, height: 24, color: AppColors.primary) // caret
              : Text(text, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.black87)),
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
                const Icon(Icons.verified, color: Colors.green, size: 16),
                const SizedBox(width: 4),
                Text(_isProcessing ? 'Đang xử lý...' : 'Đã nhập đủ 6 chữ số.', style: const TextStyle(color: Colors.green, fontSize: 12, fontWeight: FontWeight.bold)),
              ],
            )
          : const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.check_circle, color: Colors.green, size: 16),
                SizedBox(width: 4),
                Text('Tự động kiểm tra sau khi điền đủ 6 số', style: TextStyle(color: Colors.grey, fontSize: 12)),
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
            const Icon(Icons.schedule, color: Colors.grey, size: 16),
            const SizedBox(width: 4),
            const Text('Gửi lại mã sau:', style: TextStyle(color: Colors.grey, fontSize: 12)),
            const SizedBox(width: 4),
            Text('00:$_remainingSeconds\s', style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 14)),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            GestureDetector(
              onTap: () {
                setState(() => _remainingSeconds = 60);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Mã OTP mới đã được gửi qua Zalo ZNS thành công!'),
                    backgroundColor: Colors.green,
                    duration: Duration(seconds: 2),
                  ),
                );
              },
              child: const Row(
                children: [
                  Icon(Icons.chat_bubble_outline, color: AppColors.primary, size: 16),
                  SizedBox(width: 4),
                  Text('Gửi qua Zalo ZNS', style: TextStyle(color: Colors.black87, fontSize: 12, fontWeight: FontWeight.w500)),
                ],
              ),
            ),
            const SizedBox(width: 16),
            Container(width: 4, height: 4, decoration: const BoxDecoration(color: Colors.grey, shape: BoxShape.circle)),
            const SizedBox(width: 16),
            GestureDetector(
              onTap: () {
                setState(() => _remainingSeconds = 60);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Hệ thống đang kết nối cuộc gọi thoại đọc mã OTP...'),
                    duration: Duration(seconds: 2),
                  ),
                );
              },
              child: const Row(
                children: [
                  Icon(Icons.phone_forwarded, color: AppColors.primary, size: 16),
                  SizedBox(width: 4),
                  Text('Cuộc gọi thoại', style: TextStyle(color: Colors.black87, fontSize: 12, fontWeight: FontWeight.w500)),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 24),
      ],
    );
  }

  Widget _buildSubmitButton() {
    return ElevatedButton(
      onPressed: (_otp.length == _maxLength && !_isProcessing) ? _handleSubmitOtp : null,
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        disabledBackgroundColor: AppColors.primary.withValues(alpha: 0.5),
        disabledForegroundColor: Colors.white70,
        minimumSize: const Size(double.infinity, 50),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        elevation: 2,
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            _isProcessing ? 'Đang xác thực...' : 'Xác Nhận & Hoàn Tất Đăng Ký',
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
          ),
          const SizedBox(width: 8),
          if (_isProcessing)
            const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
            )
          else
            const Icon(Icons.arrow_forward, size: 20),
        ],
      ),
    );
  }

  Widget _buildKeypad() {
    return Container(
      margin: const EdgeInsets.only(top: 24),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.blue[50]?.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(16),
      ),
      child: GridView.count(
        crossAxisCount: 3,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        childAspectRatio: 2,
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
      color: Colors.white,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: () => _onKeypadPressed(text),
        borderRadius: BorderRadius.circular(12),
        child: Center(child: Text(text, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold))),
      ),
    );
  }

  Widget _buildPasteKey() {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: _onPastePressed,
        borderRadius: BorderRadius.circular(12),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.content_paste, color: Colors.grey[700], size: 20),
            const SizedBox(height: 2),
            Text('DÁN MÃ', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.grey[700])),
          ],
        ),
      ),
    );
  }

  Widget _buildBackspaceKey() {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: _onBackspacePressed,
        borderRadius: BorderRadius.circular(12),
        child: const Center(child: Icon(Icons.backspace, color: Colors.black87)),
      ),
    );
  }

  Widget _buildSecurityDisclaimer() {
    return Container(
      margin: const EdgeInsets.only(top: 24),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: Colors.blue[50], borderRadius: BorderRadius.circular(12)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.security, color: AppColors.primary, size: 20),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Cam kết an toàn ShopNova Security', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.black87)),
                const SizedBox(height: 4),
                const Text(
                  'Mã OTP có hiệu lực trong 5 phút. Vui lòng không chia sẻ mã cho bất kỳ ai kể cả nhân viên ShopNova.',
                  style: TextStyle(color: Colors.grey, fontSize: 12, height: 1.4),
                )
              ],
            ),
          )
        ],
      ),
    );
  }
}
