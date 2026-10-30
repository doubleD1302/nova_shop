import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../../services/api_config.dart';
import '../../services/auth_service.dart';
import '../../services/cart_service.dart';
import '../../services/order_service.dart';
import '../cart/cart_screen.dart';
import '../orders/orders_screen.dart';
import '../search/search_screen.dart';
import '../../theme/app_colors.dart';
import '../../widgets/common/nova_logo.dart';

/// Screen Nova AI - Trợ lý mua sắm và theo dõi đơn hàng thông minh
class NovaAIScreen extends StatefulWidget {
  final bool isStandalone;
  final String? initialQuery;

  const NovaAIScreen({
    super.key,
    this.isStandalone = false,
    this.initialQuery,
  });

  @override
  State<NovaAIScreen> createState() => _NovaAIScreenState();
}

class _NovaAIScreenState extends State<NovaAIScreen> with TickerProviderStateMixin {
  // Theme Color Tokens (Chuẩn theo thiết kế ShopNova Brand Terracotta & Cream)
  static const Color colorPrimary = AppColors.primary;
  static const Color colorPrimaryContainer = AppColors.earth;
  static const Color colorPrimaryFixed = AppColors.surfaceAlt;
  static const Color colorOnPrimaryFixed = AppColors.textPrimary;

  static const Color colorSecondary = Color(0xFF515F7A);
  static const Color colorSecondaryContainer = Color(0xFFE8EEF8);
  static const Color colorSecondaryFixed = Color(0xFFD7E3FF);

  static const Color colorTertiary = Color(0xFF00BFA5);
  static const Color colorTertiaryContainer = Color(0xFF008654);

  static const Color colorSurface = Color(0xFFF6F6F9);
  static const Color colorSurfaceContainerLowest = Color(0xFFFFFFFF);
  static const Color colorSurfaceContainerLow = Color(0xFFF1F3F5);
  static const Color colorSurfaceContainer = Color(0xFFE9ECEF);
  static const Color colorSurfaceContainerHigh = Color(0xFFDEE2E6);
  static const Color colorSurfaceContainerHighest = Color(0xFFCED4DA);

  static const Color colorOnSurface = Color(0xFF1E2022);
  static const Color colorOnSurfaceVariant = Color(0xFF5B403B);

  // Controllers
  final TextEditingController _textController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final FocusNode _focusNode = FocusNode();

  // State
  bool _isAddingCombo = false;
  bool _comboAddedSuccess = false;
  bool _isThinking = false;
  bool _isListeningVoice = false;
  String _activeContextText = 'Nova AI đang lắng nghe theo ngữ cảnh thời trang TP.HCM';

  // Demo Outfit Items
  final List<Map<String, dynamic>> _outfitItems = [
    {
      'id': 'p_crop_top',
      'name': 'Áo Croptop Linen Cổ Vuông Pastel',
      'tag': 'Áo chính',
      'mall': true,
      'badge': 'MALL',
      'subTag': 'Giao 2h',
      'subTagIcon': Icons.bolt,
      'rating': '4.9',
      'sold': '1.8k đã bán',
      'price': 159000,
      'originalPrice': 220000,
      'imageUrl':
          'https://lh3.googleusercontent.com/aida-public/AB6AXuDZa8TRdntKGsw2N-fWJbGloBsrw_CpH7if_ujn0V_ir0CocXq7qFUTncw-tGuVJvKzzyrh5e8zMQPJMudxgrzuiWJXRl3HWG5bzXCV18dX2GDyGUlvUzAVWyRDap2SLNbfzlCjk-B5_oS99LaynlUqH9cprNTMkSelP3yKZtculWbSEpV0l7tTqGfs1v8TTldlAVxI8scwsQcfvPSIW-mmQZx9zqmP67hygJILIlNchUdcW4ueWFzO',
    },
    {
      'id': 'p_shorts_kaki',
      'name': 'Quần Short Kaki Ống Rộng Cạp Cao',
      'tag': 'Phối kèm',
      'mall': false,
      'badge': 'Yêu thích+',
      'subTag': 'Freeship',
      'subTagIcon': Icons.local_shipping,
      'rating': '4.8',
      'sold': '950 đã bán',
      'price': 165000,
      'originalPrice': 210000,
      'imageUrl':
          'https://lh3.googleusercontent.com/aida-public/AB6AXuCRjTtu8-z7-5eNNv8NDoDu3DP6DQcOEi56LSwMZH5zTqNhNI0nY1oO_QVpVo0W_yWH_yUCZDiTDXGXgIRHyctUXCuhyBvHXMih8krlh23uNDLa7QI_COq2jVvIUMPbI_nJml95wzv_22OwhuLoB5q3G3ewQubzggeuq9KfN4lHyl0AilhduUuMMJUJvAOWyOBPiddz2X1ParUxftguReV1Cfy1XU0M5QUXuERORR0lccHwqdQfUdzw',
    },
    {
      'id': 'p_tote_canvas',
      'name': 'Túi Vải Tote Mini Canvas Dạo Phố',
      'tag': 'Phụ kiện',
      'mall': false,
      'badge': '',
      'subTag': 'Giảm thêm 15k',
      'subTagIcon': null,
      'rating': '5.0',
      'sold': '420 đã bán',
      'price': 65000,
      'originalPrice': 95000,
      'imageUrl':
          'https://lh3.googleusercontent.com/aida-public/AB6AXuAhNog0rlfMxpueGjZlY3M3TFPmVU1-UBQAIbH7UO2oj6xNrZV6zW_Bx7_8R1KH8BKaiwkjRb-8c44SAEEXs2I3xRKcsEFV12TGDMHFh8HxpSXi6dvSICrCc63XHLaDMnU1jrHDgYJEeX0YGS3fVArfIy8MhFX3q1wxsFxE1mU5la2lWUjU5gtmwlKYLuXXwNr-4lm2XllTAWngSjksoLwmAvD2KbmuCVUqEIKF2Lh1mZfEpfU7SrEx',
    },
  ];

  // List of chat dialogues
  final List<_AiChatMessage> _messages = [];

  final List<String> _quickPrompts = [
    '👗 Phối đồ đi tiệc < 500k',
    '🎁 Quà sinh nhật bạn trai',
    '⚡ Săn deal hỏa tốc hôm nay',
    '🔍 So sánh tai nghe chống ồn',
    '📦 Tra cứu đơn hàng của tôi',
    '🚚 Khi nào đơn hàng được giao?',
  ];

  @override
  void initState() {
    super.initState();
    // Khởi tạo đoạn hội thoại mẫu đúng như giao diện HTML
    _messages.add(
      _AiChatMessage(
        isUser: true,
        text: 'Tìm giúp mình set đồ dạo phố mùa hè thoáng mát, tone pastel, ngân sách dưới 450.000đ giao hỏa tốc tại TP.HCM nha Nova!',
        time: '14:24',
      ),
    );

    _messages.add(
      _AiChatMessage(
        isUser: false,
        text: 'Nova đã hiểu! Đã quét và chọn lọc từ 142 sản phẩm có sẵn kho TP.HCM, cam kết hỗ trợ giao Hỏa Tốc 2h và tự động ghép Voucher Freeship Xtra cho bạn.',
        intentMatch: 'Khớp 98%',
        intentTitle: 'Nova Phân Tích Ý Định',
        budgetMax: '450.000đ',
        budgetSaved: 'Tiết kiệm 61.000đ',
        budgetPercent: 0.864,
        comboPrice: '389.000đ',
        isOutfitCombo: true,
      ),
    );

    if (widget.initialQuery != null && widget.initialQuery!.trim().isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _handleSendMessage(widget.initialQuery!);
      });
    }
  }

  @override
  void dispose() {
    _textController.dispose();
    _scrollController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 350),
          curve: Curves.easeOut,
        );
      }
    });
  }

  String _formatVND(num amount) {
    final str = amount.round().toString();
    final reg = RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))');
    return '${str.replaceAllMapped(reg, (Match m) => '${m[1]}.')}đ';
  }

  // Thêm trọn bộ combo 3 món vào giỏ hàng
  Future<void> _addComboToCart() async {
    if (_isAddingCombo) return;
    setState(() => _isAddingCombo = true);

    final cart = CartService();
    for (final item in _outfitItems) {
      await cart.addToCart(
        productId: item['id'],
        productName: item['name'],
        variantName: 'Màu Pastel - Size M',
        price: (item['price'] as int).toDouble(),
        originalPrice: (item['originalPrice'] as int).toDouble(),
        imageUrl: item['imageUrl'] ?? '',
        qty: 1,
        shopName: item['mall'] == true ? 'ShopNova Mall' : 'Shop Thời Trang Sài Gòn',
        shopMall: item['mall'] == true,
      );
    }

    if (mounted) {
      setState(() {
        _isAddingCombo = false;
        _comboAddedSuccess = true;
      });

      Timer(const Duration(milliseconds: 2500), () {
        if (mounted) {
          setState(() => _comboAddedSuccess = false);
        }
      });
    }
  }

  // Xử lý gửi tin nhắn của người dùng
  Future<void> _handleSendMessage(String text) async {
    final query = text.trim();
    if (query.isEmpty) return;

    _textController.clear();
    final now = DateTime.now();
    final timeStr = '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';

    setState(() {
      _messages.add(
        _AiChatMessage(
          isUser: true,
          text: query,
          time: timeStr,
        ),
      );
      _isThinking = true;
    });
    _scrollToBottom();

    _AiChatMessage? aiResponse;

    // 1. Thử gọi API Backend Nova AI (đã tích hợp Gemini + AI Brain)
    try {
      final uri = Uri.parse('${ApiConfig.baseUrl}/api/v1/ai/chat');
      final res = await http.post(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'message': query,
          'context': {
            'role': AuthService().currentUser?.role ?? 'buyer',
          },
        }),
      ).timeout(const Duration(milliseconds: 10000));

      if (res.statusCode == 200) {
        final decoded = jsonDecode(res.body);
        final data = decoded['data'] as Map<String, dynamic>?;
        if (data != null) {
          final reply = data['reply'] as String? ?? 'Nova đã hiểu yêu cầu của bạn!';
          final intentTitle = data['intentTitle'] as String? ?? 'Nova AI Đề Xuất';
          final intentMatch = data['intentMatch'] as String? ?? 'Khớp 98%';
          final orderInfo = data['orderInfo'] as Map<String, dynamic>?;
          final budget = data['budget'] as Map<String, dynamic>?;

          aiResponse = _AiChatMessage(
            isUser: false,
            text: reply,
            intentTitle: intentTitle,
            intentMatch: intentMatch,
            orderData: orderInfo != null
                ? {
                    'code': orderInfo['code'] ?? 'ORD-NOVA-882',
                    'status': orderInfo['status'] ?? 'shipping',
                    'total': orderInfo['total'] ?? 389000,
                    'shipper': orderInfo['shipper'] ?? 'Nguyễn Văn Minh (0912.888.xxx)',
                    'location': orderInfo['location'] ?? 'Bưu cục Quận 1 - TP.HCM',
                    'eta': orderInfo['eta'] ?? 'Dự kiến giao trước 17:30 hôm nay',
                    'step': orderInfo['step'] ?? 3,
                  }
                : null,
            budgetMax: budget != null ? _formatVND(budget['max'] ?? 500000) : null,
            budgetSaved: budget != null && budget['saved'] != null ? 'Tiết kiệm ${_formatVND(budget['saved'])}' : null,
            budgetPercent: 0.88,
            comboPrice: budget != null ? _formatVND(budget['total'] ?? 389000) : null,
            isOutfitCombo: data['intent'] == 'outfit_combo',
          );

          // Cập nhật dải ngữ cảnh học tập từ AI Brain
          final brain = data['brain'] as Map<String, dynamic>?;
          if (brain != null) {
            final facts = brain['learnedFacts'] as List<dynamic>?;
            if (facts != null && facts.isNotEmpty) {
              _activeContextText = '🧠 Nova AI đã học: ${facts.take(3).join(' • ')}';
            }
          }
        }
      }
    } catch (_) {
      // Tiếp tục xuống gọi trực tiếp Gemini nếu backend offline
    }

    // 2. Nếu máy chủ chưa phản hồi, kiểm tra API key trực tiếp từ môi trường compile
    if (aiResponse == null) {
      try {
        const geminiKey = String.fromEnvironment('GEMINI_API_KEY', defaultValue: '');
        if (geminiKey.isNotEmpty) {
          final geminiUrl = Uri.parse(
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=$geminiKey',
          );
          final gRes = await http.post(
            geminiUrl,
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'contents': [
                {
                  'role': 'user',
                  'parts': [
                    {
                      'text':
                          'Bạn là Nova AI - Trợ lý mua sắm AI thông minh của sàn thương mại điện tử NovaShop. Hãy tự tư duy sâu sắc, trả lời tự nhiên, nhiệt tình và cụ thể theo câu hỏi của khách hàng: "$query". Tuyệt đối không dùng văn mẫu rập khuôn.'
                    }
                  ]
                }
              ],
            'generationConfig': {
              'temperature': 0.75,
              'maxOutputTokens': 400,
            }
          }),
        ).timeout(const Duration(milliseconds: 9000));

        if (gRes.statusCode == 200) {
          final gDecoded = jsonDecode(gRes.body);
          final candidates = gDecoded['candidates'] as List<dynamic>?;
          String? text;
          if (candidates != null && candidates.isNotEmpty) {
            final firstCandidate = candidates.first;
            if (firstCandidate is Map) {
              final content = firstCandidate['content'];
              if (content is Map) {
                final parts = content['parts'];
                if (parts is List && parts.isNotEmpty) {
                  final firstPart = parts.first;
                  if (firstPart is Map) {
                    text = firstPart['text']?.toString();
                  }
                }
              }
            }
          }

          if (text != null && text.trim().isNotEmpty) {
            aiResponse = _AiChatMessage(
              isUser: false,
              text: text.trim(),
              intentTitle: 'Tư Vấn Trực Tiếp Từ Gemini AI',
              intentMatch: 'Khớp 99%',
            );
          }
        }
      }
      } catch (_) {
        // Mạng ngoại tuyến hoàn toàn
      }
    }

    // 3. Fallback chỉ kích hoạt khi mất toàn bộ kết nối mạng
    if (aiResponse == null) {
      aiResponse = _AiChatMessage(
        isUser: false,
        text: 'Nova đã lắng nghe câu hỏi "$query" của bạn. Kết nối mạng hiện đang chập chờn, bạn vui lòng kiểm tra lại đường truyền internet và thử lại nhé!',
        intentTitle: 'Thông Báo Kết Nối',
        intentMatch: '95%',
      );
    }


    if (mounted && aiResponse != null) {
      setState(() {
        _isThinking = false;
        _messages.add(aiResponse!);
      });
      _scrollToBottom();
    } else if (mounted) {
      setState(() {
        _isThinking = false;
      });
    }
  }

  // Dialog Ướm thử ảo (AI Virtual Try-On)
  void _showVirtualTryOnDialog() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(20),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(2))),
            const SizedBox(height: 16),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(color: colorPrimaryFixed, shape: BoxShape.circle),
                  child: const Icon(Icons.view_in_ar, color: colorPrimary, size: 24),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Ướm Thử Ảo - AI Virtual Try-On', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                      Text('Công nghệ quét 3D & giả lập số đo vóc dáng', style: TextStyle(color: colorSecondary, fontSize: 12)),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            Container(
              height: 220,
              width: double.infinity,
              decoration: BoxDecoration(
                color: colorSurfaceContainerLow,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: colorSecondaryContainer),
              ),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  const Icon(Icons.accessibility_new, size: 100, color: colorSecondaryFixed),
                  Positioned(
                    top: 24,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), boxShadow: [
                        BoxShadow(color: Colors.black.withOpacity(0.08), blurRadius: 8),
                      ]),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.auto_awesome, color: colorPrimary, size: 16),
                          SizedBox(width: 6),
                          Text('Độ tương thích vóc dáng: 98.4%', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: colorPrimary)),
                        ],
                      ),
                    ),
                  ),
                  Positioned(
                    bottom: 16,
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        _buildTryOnTag('Cao: 1m62'),
                        const SizedBox(width: 8),
                        _buildTryOnTag('Nặng: 49kg'),
                        const SizedBox(width: 8),
                        _buildTryOnTag('Size M vừa vặn'),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              height: 46,
              child: ElevatedButton.icon(
                onPressed: () {
                  Navigator.pop(ctx);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Đã lưu thông số vóc dáng vào hồ sơ gợi ý AI!')),
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: colorPrimary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                icon: const Icon(Icons.camera_alt_outlined, size: 20),
                label: const Text('Chụp ảnh cập nhật dáng người mới', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTryOnTag(String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade300),
      ),
      child: Text(text, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: colorOnSurface)),
    );
  }

  // Dialog So sánh giá & Đánh giá
  void _showPriceComparisonDialog() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(20),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(2)))),
            const SizedBox(height: 16),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(color: colorSecondaryFixed, shape: BoxShape.circle),
                  child: const Icon(Icons.insights, color: colorSecondary, size: 24),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('AI So Sánh Giá & Đánh Giá Thực', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                      Text('Tóm tắt tự động từ 1.250 nhận xét mua hàng', style: TextStyle(color: colorSecondary, fontSize: 12)),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: colorSurfaceContainerLow, borderRadius: BorderRadius.circular(12)),
              child: Column(
                children: [
                  _buildReviewBar('Vải mát, đường may chuẩn', 0.92, '92% hài lòng'),
                  const SizedBox(height: 8),
                  _buildReviewBar('Màu pastel đúng như hình chụp', 0.88, '88% khen'),
                  const SizedBox(height: 8),
                  _buildReviewBar('Đóng gói & giao hỏa tốc 2h', 0.95, '95% cực nhanh'),
                ],
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              '💡 Lời khuyên của Nova: Set đồ này có mức giá rẻ hơn thị trường 18%, kho sẵn sàng giao ngay tại TP.HCM.',
              style: TextStyle(fontSize: 13, color: colorOnSurface, height: 1.4),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              height: 44,
              child: OutlinedButton(
                onPressed: () => Navigator.pop(ctx),
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: colorPrimary),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text('Đã hiểu, quay lại đoạn chat', style: TextStyle(color: colorPrimary, fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildReviewBar(String label, double percent, String note) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
            Text(note, style: const TextStyle(fontSize: 11, color: colorTertiary, fontWeight: FontWeight.bold)),
          ],
        ),
        const SizedBox(height: 4),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: percent,
            minHeight: 6,
            backgroundColor: colorSurfaceContainerHighest,
            valueColor: const AlwaysStoppedAnimation<Color>(colorTertiaryContainer),
          ),
        ),
      ],
    );
  }

  // Dialog Cài đặt sở thích
  void _showSettingsDialog() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Cài đặt sở thích mua sắm Nova AI', style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              activeColor: colorPrimary,
              title: const Text('Ưu tiên giao hàng Hỏa Tốc TP.HCM'),
              subtitle: const Text('Tự động chọn các shop gần kho bạn nhất'),
              value: true,
              onChanged: (v) {},
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              activeColor: colorPrimary,
              title: const Text('Tự động ghép Voucher giảm giá sâu nhất'),
              subtitle: const Text('Tối ưu chi phí thanh toán cho mỗi combo'),
              value: true,
              onChanged: (v) {},
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(ctx),
                style: ElevatedButton.styleFrom(
                  backgroundColor: colorPrimary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                child: const Text('Lưu tùy chọn'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // Dialog Lịch sử tư vấn
  void _showHistoryDialog() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Lịch sử tư vấn gần đây', style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            _buildHistoryItem('Set đồ dạo phố mùa hè tone pastel (14:24 hôm nay)'),
            _buildHistoryItem('So sánh tai nghe Bluetooth chống ồn (Hôm qua)'),
            _buildHistoryItem('Gợi ý quà tặng sinh nhật bạn trai (3 ngày trước)'),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Đóng'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHistoryItem(String title) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: const Icon(Icons.chat_bubble_outline, color: colorSecondary),
      title: Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
      trailing: const Icon(Icons.chevron_right, size: 20),
      onTap: () {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Đang tải phiên: $title')),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Scaffold(
      backgroundColor: colorSurface,
      // 1. Header (Cố định chuẩn như bản mẫu)
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(60),
        child: Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(bottom: BorderSide(color: Color(0xFFEEEEF0))),
          ),
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              child: Row(
                children: [
                  // Back button nếu mở từ màn hình khác (như Quản lý đơn hàng)
                  if (widget.isStandalone) ...[
                    IconButton(
                      icon: const Icon(Icons.arrow_back_ios_new_rounded, color: colorOnSurface, size: 18),
                      onPressed: () => Navigator.pop(context),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                    ),
                    const SizedBox(width: 8),
                  ],

                  // Logo & Brand
                  NovaLogo(
                    size: 28,
                    fontSize: 16,
                    showText: !widget.isStandalone,
                  ),
                  const SizedBox(width: 10),

                  // Search Capsule: "Nova Ai"
                  Expanded(
                    child: InkWell(
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const SearchScreen()),
                        );
                      },
                      borderRadius: BorderRadius.circular(20),
                      child: Container(
                        height: 38,
                        padding: const EdgeInsets.symmetric(horizontal: 10),
                        decoration: BoxDecoration(
                          color: colorSurfaceContainerLow,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.search, color: colorSecondary, size: 18),
                            SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                'Nova Ai',
                                style: TextStyle(color: colorSecondary, fontSize: 13),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),

                  // Chat Icon
                  IconButton(
                    icon: const Icon(Icons.chat_bubble_outline, color: colorOnSurface, size: 22),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                    onPressed: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Đang kết nối trung tâm tư vấn viên ShopNova')),
                      );
                    },
                  ),

                  // Cart Icon With Badge
                  ListenableBuilder(
                    listenable: CartService(),
                    builder: (context, _) {
                      final count = CartService().itemCount;
                      return Stack(
                        clipBehavior: Clip.none,
                        children: [
                          IconButton(
                            icon: const Icon(Icons.shopping_bag_outlined, color: colorOnSurface, size: 22),
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                            onPressed: () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(builder: (_) => const CartScreen()),
                              );
                            },
                          ),
                          if (count > 0)
                            Positioned(
                              top: 2,
                              right: 2,
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                                decoration: const BoxDecoration(
                                  color: colorPrimary,
                                  borderRadius: BorderRadius.all(Radius.circular(10)),
                                ),
                                constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                                child: Text(
                                  count > 99 ? '99+' : count.toString(),
                                  style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold),
                                  textAlign: TextAlign.center,
                                ),
                              ),
                            ),
                        ],
                      );
                    },
                  ),
                  const SizedBox(width: 4),

                  // User Avatar
                  ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: Container(
                      width: 32,
                      height: 32,
                      color: colorPrimaryFixed,
                      child: Image.network(
                        'https://lh3.googleusercontent.com/aida-public/AB6AXuBJfJSNM_N6Sn4nLcQqQyJ_J2_3QosDRumutKsauG8Rva5sBbPanKFtu7qnqm7G71z9MDzZn22EZLLXlxIwJ3bDiDt-2xcc0B1G7KOIXfELUi0tKtK8lRc-y9QAoPhSVlBUKZ8BSuvD2F8GBy1pptow1KlYsgq1lskZDRfpFiXZi-V6pPxfH7b4oPskA1NRgPSgb-IFDghAW80wZtxNHzBoVsFa-gH2rjenCuVX48OPJ1dTTXEO_qyb',
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => const Icon(Icons.person, color: colorPrimary, size: 20),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),

      // 2. Nội dung hội thoại & Control Panel
      body: Column(
        children: [
          // Banner thông báo chưa có API kết nối
          _buildNoApiAiBanner(),

          // Nova AI Status & Quick Control Header
          _buildAiStatusHeader(),

          // Smart Quick Prompts Bar (Horizontal Scroll)
          _buildQuickPromptsBar(),

          // Dialogue Main Stream
          Expanded(
            child: ListView.builder(
              controller: _scrollController,
              padding: const EdgeInsets.fromLTRB(14, 12, 14, 16),
              itemCount: _messages.length + (_isThinking ? 1 : 0),
              itemBuilder: (context, index) {
                if (index == _messages.length) {
                  return _buildThinkingBubble();
                }
                final msg = _messages[index];
                return msg.isUser ? _buildUserMessage(msg) : _buildAiResponseUnit(msg);
              },
            ),
          ),

          // Interactive Fixed Chat Input Floating Panel (Kèm padding bàn phím an toàn)
          Padding(
            padding: EdgeInsets.only(bottom: bottomInset),
            child: _buildChatInputPanel(),
          ),
        ],
      ),
    );
  }

  // Banner thông báo chưa có API kết nối Backend
  Widget _buildNoApiAiBanner() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: const BoxDecoration(
        color: Color(0xFFFFF8E1),
        border: Border(bottom: BorderSide(color: Color(0xFFFFECB3))),
      ),
      child: const Row(
        children: [
          Icon(Icons.info_outline, size: 16, color: Color(0xFF856404)),
          SizedBox(width: 8),
          Expanded(
            child: Text(
              'Chưa có API kết nối: Tính năng Trợ lý Nova AI đang ở chế độ giao diện mẫu do hệ thống Backend website thương mại chưa kết nối API Nova AI.',
              style: TextStyle(
                color: Color(0xFF856404),
                fontSize: 11,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // Nova AI Status Header
  Widget _buildAiStatusHeader() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: colorSurfaceContainerLow,
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 4, offset: const Offset(0, 1)),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Row(
              children: [
                Stack(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          colors: [colorPrimary, colorPrimaryContainer],
                          begin: Alignment.bottomLeft,
                          end: Alignment.topRight,
                        ),
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(color: Color(0x33BD6E49), blurRadius: 8, offset: Offset(0, 2)),
                        ],
                      ),
                      child: const Icon(Icons.auto_awesome, color: Colors.white, size: 24),
                    ),
                    Positioned(
                      bottom: 0,
                      right: 0,
                      child: Container(
                        width: 13,
                        height: 13,
                        decoration: BoxDecoration(
                          color: colorTertiaryContainer,
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 2),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Flexible(
                            child: Text(
                              'Nova AI',
                              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: colorOnSurface),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          SizedBox(width: 4),
                          Icon(Icons.verified, color: colorPrimary, size: 17),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: colorTertiaryContainer,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Text(
                              'Trực tuyến 24/7',
                              style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                            ),
                          ),
                          const SizedBox(width: 6),
                          const Flexible(
                            child: Text(
                              '• Mua sắm thông minh',
                              style: TextStyle(color: colorSecondary, fontSize: 11),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          // Quick Action Icons
          Row(
            children: [
              _buildHeaderCircleBtn(Icons.refresh, 'Làm mới phiên chat', () {
                setState(() {
                  _messages.clear();
                  _messages.add(
                    _AiChatMessage(
                      isUser: false,
                      text: 'Xin chào! Nova AI đã sẵn sàng hỗ trợ bạn săn deal, phối đồ và theo dõi đơn hàng 24/7.',
                      intentMatch: 'Sẵn sàng',
                      intentTitle: 'Phiên Chat Mới',
                    ),
                  );
                });
              }),
              const SizedBox(width: 6),
              _buildHeaderCircleBtn(Icons.history_toggle_off, 'Lịch sử tư vấn', _showHistoryDialog),
              const SizedBox(width: 6),
              _buildHeaderCircleBtn(Icons.tune, 'Cài đặt sở thích', _showSettingsDialog),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildHeaderCircleBtn(IconData icon, String tooltip, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: Colors.white,
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 4, offset: const Offset(0, 1)),
          ],
        ),
        child: Icon(icon, color: colorSecondary, size: 19),
      ),
    );
  }

  // Smart Quick Prompts Bar (Horizontal Scroll)
  Widget _buildQuickPromptsBar() {
    return Container(
      height: 48,
      color: colorSurface,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        itemCount: _quickPrompts.length + 1,
        itemBuilder: (context, index) {
          if (index == 0) {
            return const Row(
              children: [
                Icon(Icons.lightbulb_outline, color: colorPrimary, size: 18),
                SizedBox(width: 4),
                Text('Gợi ý:', style: TextStyle(color: colorPrimary, fontWeight: FontWeight.bold, fontSize: 12)),
                SizedBox(width: 8),
              ],
            );
          }
          final prompt = _quickPrompts[index - 1];
          final isHighlighted = prompt.contains('hỏa tốc');

          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: InkWell(
              onTap: () {
                _textController.text = prompt;
                _handleSendMessage(prompt);
              },
              borderRadius: BorderRadius.circular(20),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: isHighlighted ? colorPrimaryFixed : colorSurfaceContainerHigh,
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 3),
                  ],
                ),
                child: Center(
                  child: Text(
                    prompt,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: isHighlighted ? colorOnPrimaryFixed : colorOnSurface,
                    ),
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  // Bong bóng tin nhắn người dùng (Right aligned)
  Widget _buildUserMessage(_AiChatMessage msg) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.end,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(width: 40),
          Flexible(
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: const BoxDecoration(
                color: colorPrimary,
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(18),
                  bottomLeft: Radius.circular(18),
                  bottomRight: Radius.circular(18),
                  topRight: Radius.circular(4),
                ),
                boxShadow: [
                  BoxShadow(color: Color(0x22BD6E49), blurRadius: 6, offset: Offset(0, 2)),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    msg.text,
                    style: const TextStyle(color: Colors.white, fontSize: 14, height: 1.45),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        msg.time ?? '14:24',
                        style: TextStyle(color: Colors.white.withOpacity(0.75), fontSize: 10),
                      ),
                      const SizedBox(width: 4),
                      Icon(Icons.done_all, color: Colors.white.withOpacity(0.85), size: 14),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: Container(
              width: 32,
              height: 32,
              color: colorPrimaryFixed,
              child: Image.network(
                'https://lh3.googleusercontent.com/aida-public/AB6AXuAcMWtFDS3S2alrAYHdnp8NDP4yJ8cLWZiLL40EQjbjpXO_saVzb1uqwuXNjkkmdUGAsGMcI0TeVrPgWNPPEW9Mbeil4nJHtkO01ggz2AzT7tQ1iG_Pb_tzbTXWL17bPPFto1v1YgKP1hvKYEtXgtpCeBsxSz7UZCvjX66pHdGrSAl6yCu5FfHZO8p7bRLvZwuDvc9JkqNZ-k2P6dU4oRJGNsxarCJw1gdJCPuZaaffCorSjC29nb-P',
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => const Icon(Icons.person, color: colorPrimary, size: 20),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // AI Response Unit (Left aligned)
  Widget _buildAiResponseUnit(_AiChatMessage msg) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Nova AI Avatar
          Container(
            width: 32,
            height: 32,
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [colorPrimary, colorPrimaryContainer],
                begin: Alignment.bottomLeft,
                end: Alignment.topRight,
              ),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.auto_awesome, color: Colors.white, size: 18),
          ),
          const SizedBox(width: 10),

          // Main Content Stream
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 1. Text Insight Bubble
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: colorSurfaceContainerLowest,
                    borderRadius: const BorderRadius.only(
                      topLeft: Radius.circular(4),
                      topRight: Radius.circular(18),
                      bottomLeft: Radius.circular(18),
                      bottomRight: Radius.circular(18),
                    ),
                    boxShadow: [
                      BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 6, offset: const Offset(0, 2)),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Header: Nova Phân Tích Ý Định - Khớp 98%
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Row(
                              children: [
                                const Icon(Icons.psychology, color: colorPrimary, size: 17),
                                const SizedBox(width: 4),
                                Flexible(
                                  child: Text(
                                    msg.intentTitle ?? 'Nova Phân Tích Ý Định',
                                    style: const TextStyle(color: colorPrimary, fontWeight: FontWeight.bold, fontSize: 13),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: colorSurfaceContainer,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              msg.intentMatch ?? 'Khớp 98%',
                              style: const TextStyle(color: colorSecondary, fontSize: 11, fontWeight: FontWeight.bold),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),

                      // Nội dung phân tích
                      _buildFormattedAiText(msg.text),

                      // Budget Analysis Card (Nếu có)
                      if (msg.budgetMax != null) ...[
                        const SizedBox(height: 12),
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: colorSurfaceContainerLow,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Flexible(
                                    child: Text(
                                      'Ngân sách tối đa: ${msg.budgetMax}',
                                      style: const TextStyle(color: colorSecondary, fontSize: 11),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                  const SizedBox(width: 6),
                                  Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      const Icon(Icons.savings, color: colorTertiary, size: 14),
                                      const SizedBox(width: 4),
                                      Text(
                                        msg.budgetSaved ?? '',
                                        style: const TextStyle(color: colorTertiary, fontWeight: FontWeight.bold, fontSize: 11.5),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              ClipRRect(
                                borderRadius: BorderRadius.circular(6),
                                child: LinearProgressIndicator(
                                  value: msg.budgetPercent ?? 0.86,
                                  minHeight: 8,
                                  backgroundColor: colorSurfaceContainerHighest,
                                  valueColor: const AlwaysStoppedAnimation<Color>(colorPrimary),
                                ),
                              ),
                              const SizedBox(height: 8),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  const Expanded(
                                    child: Text(
                                      'Tổng combo gợi ý:',
                                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: colorOnSurface),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                  Text(
                                    msg.comboPrice ?? '',
                                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: colorPrimary),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
                ),

                // 2. Order Live Tracking Card (Nếu là tin nhắn tra cứu đơn hàng)
                if (msg.orderData != null) ...[
                  const SizedBox(height: 10),
                  _buildOrderTrackingCard(msg.orderData!),
                ],

                // 3. Co-ordinated Outfit Cards Stream (Nếu là tin nhắn gợi ý combo)
                if (msg.isOutfitCombo == true) ...[
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Expanded(
                        child: Row(
                          children: [
                            Icon(Icons.style, color: colorPrimary, size: 18),
                            SizedBox(width: 6),
                            Flexible(
                              child: Text(
                                'Set Đồ Phối Chuẩn Gu Mùa Hè',
                                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text('${_outfitItems.length} món kết hợp', style: const TextStyle(color: colorSecondary, fontSize: 11)),
                    ],
                  ),
                  const SizedBox(height: 8),

                  // Danh sách 3 sản phẩm
                  ..._outfitItems.map((item) => _buildOutfitItemCard(item)),

                  // Smart Action Buttons For Combo
                  const SizedBox(height: 6),
                  _buildComboActionButtons(),

                  // Floating AI Exclusive Micro Feature Cards (Grid 2-Col)
                  const SizedBox(height: 10),
                  _buildMicroFeaturesGrid(),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  // Card hiển thị thông tin tra cứu đơn hàng thông minh
  Widget _buildOrderTrackingCard(Map<String, dynamic> order) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colorSecondaryContainer),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 6, offset: const Offset(0, 2)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  const Icon(Icons.local_shipping, color: colorTertiary, size: 20),
                  const SizedBox(width: 6),
                  Text('Đơn hàng #${order['code']}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: colorTertiaryContainer.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Text('Đang vận chuyển', style: TextStyle(color: colorTertiary, fontSize: 11, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: colorSurfaceContainerLow,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.access_time_filled, color: colorPrimary, size: 15),
                    const SizedBox(width: 6),
                    Text(order['eta'] ?? 'Dự kiến hôm nay', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: colorPrimary)),
                  ],
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    const Icon(Icons.location_on, color: colorSecondary, size: 15),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(order['location'] ?? '', style: const TextStyle(fontSize: 11.5, color: colorOnSurface)),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    const Icon(Icons.phone_android, color: colorSecondary, size: 15),
                    const SizedBox(width: 6),
                    Text('Shipper: ${order['shipper']}', style: const TextStyle(fontSize: 11.5, color: colorSecondary)),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            height: 38,
            child: ElevatedButton.icon(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const OrdersScreen(initialTabIndex: 2)),
                );
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: colorPrimary,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              icon: const Icon(Icons.visibility_outlined, size: 18),
              label: const Text('Mở toàn bộ danh sách đơn mua', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
            ),
          ),
        ],
      ),
    );
  }

  // Từng sản phẩm trong Combo
  Widget _buildOutfitItemCard(Map<String, dynamic> item) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: colorSurfaceContainerLowest,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 4, offset: const Offset(0, 1)),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Ảnh sản phẩm kèm Badge MALL / Yêu thích
          Stack(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  width: 86,
                  height: 86,
                  color: colorSurfaceContainerHigh,
                  child: Image.network(
                    item['imageUrl'] ?? '',
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => const Center(
                      child: Icon(Icons.image_outlined, color: colorSecondary, size: 30),
                    ),
                  ),
                ),
              ),
              if ((item['badge'] as String).isNotEmpty)
                Positioned(
                  top: 4,
                  left: 4,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                    decoration: BoxDecoration(
                      color: item['mall'] == true ? const Color(0xFF28313F) : colorPrimary,
                      borderRadius: BorderRadius.circular(3),
                    ),
                    child: Text(
                      item['badge'],
                      style: const TextStyle(color: Colors.white, fontSize: 8.5, fontWeight: FontWeight.w800, letterSpacing: 0.3),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(width: 10),

          // Thông tin sản phẩm
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                // Tags
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                      decoration: BoxDecoration(
                        color: colorPrimaryFixed,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        item['tag'],
                        style: const TextStyle(color: colorOnPrimaryFixed, fontSize: 9.5, fontWeight: FontWeight.bold),
                      ),
                    ),
                    const SizedBox(width: 4),
                    if (item['subTagIcon'] != null)
                      Icon(item['subTagIcon'] as IconData, size: 12, color: colorTertiary),
                    if (item['subTagIcon'] != null) const SizedBox(width: 2),
                    Flexible(
                      child: Text(
                        item['subTag'],
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: (item['subTag'] as String).contains('Giảm') ? colorPrimary : colorTertiary,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),

                // Tiêu đề
                Text(
                  item['name'],
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: colorOnSurface),
                ),
                const SizedBox(height: 2),

                // Rating & Sold
                Row(
                  children: [
                    const Icon(Icons.star, color: colorPrimary, size: 13),
                    const SizedBox(width: 3),
                    Text(item['rating'], style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11)),
                    const SizedBox(width: 4),
                    Text('(${item['sold']})', style: const TextStyle(color: colorSecondary, fontSize: 11)),
                  ],
                ),
                const SizedBox(height: 4),

                // Giá tiền & nút swap
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.baseline,
                        textBaseline: TextBaseline.alphabetic,
                        children: [
                          Text(
                            _formatVND(item['price'] as int),
                            style: const TextStyle(color: colorPrimary, fontWeight: FontWeight.w800, fontSize: 13.5),
                          ),
                          const SizedBox(width: 4),
                          Flexible(
                            child: Text(
                              _formatVND(item['originalPrice'] as int),
                              style: const TextStyle(color: colorSecondary, fontSize: 10.5, decoration: TextDecoration.lineThrough),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                    InkWell(
                      onTap: () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('Nova đang tìm món tương đương để thay thế "${item['name']}"...')),
                        );
                      },
                      borderRadius: BorderRadius.circular(15),
                      child: Container(
                        width: 28,
                        height: 28,
                        decoration: const BoxDecoration(
                          color: colorSurfaceContainer,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.cached, color: colorOnSurface, size: 16),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // Buttons Thao tác Combo
  Widget _buildComboActionButtons() {
    return Column(
      children: [
        // Main Button: Thêm trọn bộ combo
        SizedBox(
          width: double.infinity,
          height: 46,
          child: ElevatedButton(
            onPressed: _addComboToCart,
            style: ElevatedButton.styleFrom(
              backgroundColor: _comboAddedSuccess ? colorTertiaryContainer : colorPrimary,
              foregroundColor: Colors.white,
              elevation: 2,
              padding: const EdgeInsets.symmetric(horizontal: 10),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: _isAddingCombo
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                : Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(_comboAddedSuccess ? Icons.check_circle : Icons.shopping_bag, size: 18),
                      const SizedBox(width: 6),
                      Flexible(
                        child: Text(
                          _comboAddedSuccess ? 'Đã thêm 3 sản phẩm vào giỏ hàng!' : 'Thêm trọn bộ combo vào giỏ (-15%)',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12.5),
                          overflow: TextOverflow.ellipsis,
                          maxLines: 1,
                        ),
                      ),
                    ],
                  ),
          ),
        ),
        const SizedBox(height: 8),

        // Sub Row: Tùy chỉnh & Chia sẻ
        Row(
          children: [
            Expanded(
              child: SizedBox(
                height: 38,
                child: ElevatedButton.icon(
                  onPressed: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Mở bảng phối phụ kiện và màu sắc khác...')),
                    );
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: colorSurfaceContainerHigh,
                    foregroundColor: colorOnSurface,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  icon: const Icon(Icons.tune, size: 15),
                  label: const Text('Tùy chỉnh đổi món', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600), overflow: TextOverflow.ellipsis),
                ),
              ),
            ),
            const SizedBox(width: 8),
            SizedBox(
              height: 38,
              child: ElevatedButton.icon(
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Đã sao chép liên kết chia sẻ set đồ phong cách mùa hè!')),
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: colorSurfaceContainerHigh,
                  foregroundColor: colorOnSurface,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                icon: const Icon(Icons.share, size: 15),
                label: const Text('Chia sẻ', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600)),
              ),
            ),
          ],
        ),
      ],
    );
  }

  // Micro Features Grid (Ướm thử ảo & So sánh giá)
  Widget _buildMicroFeaturesGrid() {
    return Row(
      children: [
        Expanded(
          child: InkWell(
            onTap: _showVirtualTryOnDialog,
            borderRadius: BorderRadius.circular(12),
            child: Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [colorPrimaryFixed, colorSurfaceContainerLow],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(12),
                boxShadow: [
                  BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 4),
                ],
              ),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                    child: const Icon(Icons.view_in_ar, color: colorPrimary, size: 20),
                  ),
                  const SizedBox(width: 8),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Ướm thử ảo', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: colorOnSurface)),
                        Text('AI Virtual Try-On', style: TextStyle(fontSize: 10, color: colorSecondary), overflow: TextOverflow.ellipsis),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: InkWell(
            onTap: _showPriceComparisonDialog,
            borderRadius: BorderRadius.circular(12),
            child: Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [colorSecondaryFixed, colorSurfaceContainerLow],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(12),
                boxShadow: [
                  BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 4),
                ],
              ),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                    child: const Icon(Icons.insights, color: colorSecondary, size: 20),
                  ),
                  const SizedBox(width: 8),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('So sánh giá', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: colorOnSurface)),
                        Text('Tóm tắt 1.2k review', style: TextStyle(fontSize: 10, color: colorSecondary), overflow: TextOverflow.ellipsis),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  // Thinking Bubble Animation
  Widget _buildThinkingBubble() {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: const BoxDecoration(
              gradient: LinearGradient(colors: [colorPrimary, colorPrimaryContainer]),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.auto_awesome, color: Colors.white, size: 18),
          ),
          const SizedBox(width: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: colorSurfaceContainerLowest,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 6),
              ],
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(color: colorPrimary, strokeWidth: 2),
                ),
                SizedBox(width: 8),
                Text('Nova AI đang phân tích dữ liệu & quét ưu đãi...', style: TextStyle(fontSize: 12, color: colorSecondary)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // Interactive Fixed Chat Input Floating Panel
  Widget _buildChatInputPanel() {
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 8, 14, 12),
      decoration: BoxDecoration(
        color: colorSurface.withOpacity(0.97),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.06),
            blurRadius: 16,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Active Prompt Indicator Capsule
          Padding(
            padding: const EdgeInsets.only(bottom: 6, left: 4, right: 4),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Row(
                    children: [
                      const Icon(Icons.auto_fix_high, color: colorPrimary, size: 14),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          _activeContextText,
                          style: const TextStyle(color: colorPrimary, fontSize: 10.5, fontWeight: FontWeight.bold),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
                GestureDetector(
                  onTap: () {
                    setState(() {
                      _activeContextText = 'Nova AI lắng nghe mọi nhu cầu mua sắm toàn quốc';
                    });
                  },
                  child: const Text(
                    'Xóa tiêu chí',
                    style: TextStyle(color: colorSecondary, fontSize: 10.5),
                  ),
                ),
              ],
            ),
          ),

          // Main Input Capsule
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
            decoration: BoxDecoration(
              color: colorSurfaceContainerLowest,
              borderRadius: BorderRadius.circular(28),
              boxShadow: [
                BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 4, offset: const Offset(0, 1)),
              ],
            ),
            child: Row(
              children: [
                // Camera Button (Tìm bằng hình ảnh)
                InkWell(
                  onTap: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Tính năng tìm kiếm bằng hình ảnh AI: Vui lòng chụp hoặc chọn ảnh từ thư viện!')),
                    );
                  },
                  borderRadius: BorderRadius.circular(18),
                  child: Container(
                    width: 36,
                    height: 36,
                    decoration: const BoxDecoration(
                      color: colorSurfaceContainerLow,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.photo_camera_outlined, color: colorSecondary, size: 19),
                  ),
                ),
                const SizedBox(width: 6),

                // Text Input Field
                Expanded(
                  child: TextField(
                    controller: _textController,
                    focusNode: _focusNode,
                    textInputAction: TextInputAction.send,
                    onSubmitted: _handleSendMessage,
                    style: const TextStyle(fontSize: 13.5, color: colorOnSurface),
                    decoration: const InputDecoration(
                      hintText: 'Hỏi Nova về sản phẩm, phong cách, giá cả...',
                      hintStyle: TextStyle(fontSize: 13, color: Color(0x99515F7A)),
                      border: InputBorder.none,
                      contentPadding: EdgeInsets.symmetric(vertical: 8),
                      isDense: true,
                    ),
                  ),
                ),

                // Mic Button (Nhập giọng nói)
                IconButton(
                  icon: Icon(
                    _isListeningVoice ? Icons.mic : Icons.mic_none,
                    color: _isListeningVoice ? colorPrimary : colorSecondary,
                    size: 20,
                  ),
                  onPressed: () {
                    setState(() => _isListeningVoice = !_isListeningVoice);
                    if (_isListeningVoice) {
                      _textController.text = 'Tìm cho mình giày sneaker đi học giá sinh viên';
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Đang lắng nghe: "Tìm cho mình giày sneaker đi học giá sinh viên"')),
                      );
                    }
                  },
                ),

                // Send Button
                InkWell(
                  onTap: () => _handleSendMessage(_textController.text),
                  borderRadius: BorderRadius.circular(18),
                  child: Container(
                    width: 36,
                    height: 36,
                    decoration: const BoxDecoration(
                      color: colorPrimary,
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(color: Color(0x33BD6E49), blurRadius: 4, offset: Offset(0, 2)),
                      ],
                    ),
                    child: const Icon(Icons.arrow_upward, color: Colors.white, size: 19),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // Định dạng text cho AI với highlight màu sắc các từ khóa chuẩn theo HTML mẫu
  Widget _buildFormattedAiText(String text) {
    if (text.contains('142 sản phẩm') || text.contains('Hỏa Tốc 2h')) {
      return RichText(
        text: const TextSpan(
          style: TextStyle(color: colorOnSurface, fontSize: 13.5, height: 1.45),
          children: [
            TextSpan(text: 'Nova đã hiểu! Đã quét và chọn lọc từ '),
            TextSpan(
              text: '142 sản phẩm',
              style: TextStyle(color: colorPrimary, fontWeight: FontWeight.bold),
            ),
            TextSpan(text: ' có sẵn kho TP.HCM, cam kết hỗ trợ giao '),
            TextSpan(
              text: 'Hỏa Tốc 2h',
              style: TextStyle(color: colorTertiary, fontWeight: FontWeight.bold),
            ),
            TextSpan(text: ' và tự động ghép '),
            TextSpan(
              text: 'Voucher Freeship Xtra',
              style: TextStyle(color: colorPrimaryContainer, fontWeight: FontWeight.bold),
            ),
            TextSpan(text: ' cho bạn.'),
          ],
        ),
      );
    }

    if (text.contains('**')) {
      final spans = <TextSpan>[];
      final parts = text.split('**');
      for (int i = 0; i < parts.length; i++) {
        if (i % 2 == 1) {
          spans.add(
            TextSpan(
              text: parts[i],
              style: const TextStyle(fontWeight: FontWeight.bold, color: colorPrimary),
            ),
          );
        } else {
          spans.add(TextSpan(text: parts[i]));
        }
      }
      return RichText(
        text: TextSpan(
          style: const TextStyle(color: colorOnSurface, fontSize: 13.5, height: 1.45),
          children: spans,
        ),
      );
    }

    return Text(
      text,
      style: const TextStyle(color: colorOnSurface, fontSize: 13.5, height: 1.45),
    );
  }
}

// Data model for messages
class _AiChatMessage {
  final bool isUser;
  final String text;
  final String? time;
  final String? intentTitle;
  final String? intentMatch;
  final String? budgetMax;
  final String? budgetSaved;
  final double? budgetPercent;
  final String? comboPrice;
  final bool? isOutfitCombo;
  final Map<String, dynamic>? orderData;

  _AiChatMessage({
    required this.isUser,
    required this.text,
    this.time,
    this.intentTitle,
    this.intentMatch,
    this.budgetMax,
    this.budgetSaved,
    this.budgetPercent,
    this.comboPrice,
    this.isOutfitCombo,
    this.orderData,
  });
}
