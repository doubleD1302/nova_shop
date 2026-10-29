import 'package:flutter/material.dart';
import '../../services/api_client.dart';
import '../../services/auth_service.dart';
import '../../screens/auth/login_screen.dart';
import '../../theme/app_colors.dart';

class ReportReasonOption {
  final String id;
  final String label;
  final String desc;
  final IconData icon;

  const ReportReasonOption({
    required this.id,
    required this.label,
    required this.desc,
    required this.icon,
  });
}

class ReportContentSheet extends StatefulWidget {
  final String targetType; // 'product' | 'shop' | 'review' | 'user'
  final String targetId;
  final String targetName;
  final String? shopName;

  const ReportContentSheet({
    super.key,
    required this.targetType,
    required this.targetId,
    required this.targetName,
    this.shopName,
  });

  static Future<void> show(
    BuildContext context, {
    required String targetType,
    required String targetId,
    required String targetName,
    String? shopName,
  }) {
    if (!AuthService().isAuthenticated) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Vui lòng đăng nhập để gửi báo cáo vi phạm nội dung.'),
          duration: Duration(seconds: 2),
        ),
      );
      return Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
    }

    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => ReportContentSheet(
        targetType: targetType,
        targetId: targetId,
        targetName: targetName,
        shopName: shopName,
      ),
    );
  }

  @override
  State<ReportContentSheet> createState() => _ReportContentSheetState();
}

class _ReportContentSheetState extends State<ReportContentSheet> {
  final ApiClient _client = ApiClient();
  final TextEditingController _detailsController = TextEditingController();
  final TextEditingController _evidenceUrlController = TextEditingController();

  static const List<ReportReasonOption> _reasons = [
    ReportReasonOption(
      id: 'Nghi ngờ hàng giả, hàng nhái, vi phạm thương hiệu',
      label: 'Hàng giả, hàng nhái, vi phạm thương hiệu',
      desc: 'Sản phẩm có dấu hiệu làm giả nhãn hiệu, tem mác, logo hoặc xuất xứ không chính hãng.',
      icon: Icons.gavel_rounded,
    ),
    ReportReasonOption(
      id: 'Hàng cấm kinh doanh hoặc vi phạm pháp luật',
      label: 'Hàng cấm hoặc vi phạm pháp luật',
      desc: 'Hàng hóa nằm trong danh mục cấm theo luật hoặc quy chế sàn ShopNova.',
      icon: Icons.block_rounded,
    ),
    ReportReasonOption(
      id: 'Mô tả sai lệch, hàng không đúng thực tế',
      label: 'Mô tả sai lệch, gian dối thông tin',
      desc: 'Thông số kỹ thuật, hình ảnh minh họa hoặc công dụng bị phóng đại quá mức.',
      icon: Icons.error_outline_rounded,
    ),
    ReportReasonOption(
      id: 'Hình ảnh hoặc nội dung phản cảm',
      label: 'Hình ảnh hoặc nội dung phản cảm',
      desc: 'Chứa từ ngữ bạo lực, xúc phạm, không phù hợp thuần phong mỹ tục.',
      icon: Icons.visibility_off_outlined,
    ),
    ReportReasonOption(
      id: 'Lý do vi phạm khác',
      label: 'Lý do vi phạm chính sách khác',
      desc: 'Hành vi vi phạm quy định sàn chưa có trong các danh mục trên.',
      icon: Icons.flag_outlined,
    ),
  ];

  String _selectedReason = 'Nghi ngờ hàng giả, hàng nhái, vi phạm thương hiệu';
  bool _isSubmitting = false;

  @override
  void dispose() {
    _detailsController.dispose();
    _evidenceUrlController.dispose();
    super.dispose();
  }

  Future<void> _submitReport() async {
    final details = _detailsController.text.trim();
    final evidenceUrl = _evidenceUrlController.text.trim();

    setState(() => _isSubmitting = true);

    try {
      final response = await _client.post(
        '/api/v1/reports',
        body: {
          'targetType': widget.targetType,
          'targetId': widget.targetId,
          'reason': _selectedReason,
          if (details.isNotEmpty) 'details': details,
          if (evidenceUrl.isNotEmpty) 'evidenceUrl': evidenceUrl,
        },
      );

      if (!mounted) return;
      setState(() => _isSubmitting = false);

      if (response.success) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: Color(0xFF1E2022),
            content: Row(
              children: [
                Icon(Icons.check_circle_rounded, color: Color(0xFF00BFA5)),
                SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Đã gửi báo cáo vi phạm thành công. Ban Quản Trị sẽ tiến hành xác minh trong 24h!',
                    style: TextStyle(fontSize: 13),
                  ),
                ),
              ],
            ),
            duration: Duration(seconds: 4),
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: Colors.red.shade800,
            content: Text(
              response.message.isNotEmpty
                  ? response.message
                  : 'Gửi báo cáo thất bại. Vui lòng thử lại sau.',
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSubmitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: Colors.red,
            content: Text('Không thể kết nối máy chủ. Vui lòng kiểm tra lại mạng.'),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Tiêu đề & Đóng
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceAlt,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.shield_outlined, color: AppColors.primary, size: 22),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Báo Cáo Vi Phạm Nội Dung',
                        style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
                      ),
                      Text(
                        'Chung tay bảo vệ người mua và môi trường mua sắm an toàn',
                        style: TextStyle(fontSize: 11, color: Colors.grey),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close_rounded),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
            const Divider(height: 24),

            // Thông tin đối tượng bị báo cáo
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF8F9FA),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFEEEEEE)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.inventory_2_outlined, size: 20, color: Color(0xFF555555)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.targetName,
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (widget.shopName != null && widget.shopName!.isNotEmpty)
                          Text(
                            'Gian hàng: ${widget.shopName}',
                            style: const TextStyle(color: Colors.grey, fontSize: 11),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            const Text(
              'Chọn lý do vi phạm:',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
            ),
            const SizedBox(height: 8),

            // Danh sách lý do
            ..._reasons.map((opt) {
              final isSelected = _selectedReason == opt.id;
              return InkWell(
                onTap: () => setState(() => _selectedReason = opt.id),
                borderRadius: BorderRadius.circular(10),
                child: Container(
                  margin: const EdgeInsets.symmetric(vertical: 4),
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: isSelected ? AppColors.surfaceAlt : Colors.white,
                    border: Border.all(
                      color: isSelected ? AppColors.primary : AppColors.border,
                      width: isSelected ? 1.5 : 1,
                    ),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        opt.icon,
                        size: 20,
                        color: isSelected ? AppColors.primary : Colors.grey,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              opt.label,
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                                color: isSelected ? AppColors.primary : AppColors.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              opt.desc,
                              style: const TextStyle(fontSize: 11, color: Colors.grey),
                            ),
                          ],
                        ),
                      ),
                      Radio<String>(
                        value: opt.id,
                        groupValue: _selectedReason,
                        activeColor: AppColors.primary,
                        onChanged: (v) {
                          if (v != null) setState(() => _selectedReason = v);
                        },
                      ),
                    ],
                  ),
                ),
              );
            }),

            const SizedBox(height: 14),
            const Text(
              'Mô tả chi tiết vi phạm (tùy chọn):',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
            ),
            const SizedBox(height: 6),
            TextField(
              controller: _detailsController,
              maxLines: 3,
              decoration: InputDecoration(
                hintText: 'Cung cấp thêm chi tiết dấu hiệu vi phạm để hỗ trợ BQT xác minh nhanh hơn...',
                hintStyle: const TextStyle(fontSize: 12, color: Colors.grey),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                contentPadding: const EdgeInsets.all(12),
              ),
            ),

            const SizedBox(height: 12),
            const Text(
              'Link hình ảnh bằng chứng (nếu có):',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
            ),
            const SizedBox(height: 6),
            TextField(
              controller: _evidenceUrlController,
              decoration: InputDecoration(
                hintText: 'https://...',
                hintStyle: const TextStyle(fontSize: 12, color: Colors.grey),
                prefixIcon: const Icon(Icons.link_rounded, size: 20),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              ),
            ),

            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: _isSubmitting ? null : _submitReport,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: _isSubmitting
                    ? const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                      )
                    : const Text(
                        'Gửi Báo Cáo Vi Phạm',
                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
