import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import '../../config/api_config.dart';
import '../../services/auth_service.dart';
import '../../services/cart_service.dart';
import '../cart/cart_screen.dart';
import '../orders/orders_screen.dart';
import '../product_detail/product_detail_screen.dart';
import '../search/search_screen.dart';
import '../../models/product.dart';
import '../../theme/app_colors.dart';
import '../../widgets/common/nova_assets.dart';

/// Screen Nova AI - Trợ lý mua sắm thông minh kết nối trực tiếp API AI của Backend
/// Các API được kết nối:
/// - POST   /api/v1/ai/chat
/// - GET    /api/v1/ai/brain/profile
/// - POST   /api/v1/ai/brain/feedback
/// - DELETE /api/v1/ai/brain/reset
class NovaAIScreen extends StatefulWidget {
  final bool isStandalone;
  final String? initialQuery;
  final http.Client? httpClient;

  const NovaAIScreen({
    super.key,
    this.isStandalone = false,
    this.initialQuery,
    this.httpClient,
  });

  static void resetSession() => _NovaAIScreenState.resetSessionForTest();

  @override
  State<NovaAIScreen> createState() => _NovaAIScreenState();
}

class _NovaAIScreenState extends State<NovaAIScreen>
    with TickerProviderStateMixin {
  // Theme Color Tokens (Chuẩn theo thiết kế ShopNova Brand Terracotta & Cream)
  static const Color colorPrimary = AppColors.primary;

  static const Color colorSecondary = AppColors.textSecondary;

  late final http.Client _httpClient;

  // Controllers
  final TextEditingController _textController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final FocusNode _focusNode = FocusNode();

  // State
  bool _isThinking = false;
  final Map<String, bool> _addedProductMap = {};
  final Map<String, bool> _feedbackGivenMap = {};

  // Dữ liệu thực từ AI Brain (GET /api/v1/ai/brain/profile & POST /api/v1/ai/chat)
  List<String> _learnedFacts = [];
  List<String> _preferredStyles = [];
  String? _learnedLocation;
  int _totalInteractions = 0;
  int _acceptedRecommendations = 0;

  // Lưu lịch sử hội thoại trong phiên theo tài khoản đang đăng nhập
  static final List<_AiChatMessage> _sessionMessages = [];
  static String? _sessionOwner;
  String get _currentOwner =>
      '${AuthService().currentUser?.id ?? 'guest'}:${AuthService().currentUser?.role ?? 'guest'}';
  List<_AiChatMessage> get _messages => _sessionMessages;

  static void resetSessionForTest() {
    _sessionMessages.clear();
  }

  @override
  void initState() {
    super.initState();
    _httpClient = widget.httpClient ?? http.Client();
    if (_sessionOwner != _currentOwner) {
      _sessionMessages.clear();
      _sessionOwner = _currentOwner;
    }
    AuthService().addListener(_onAuthChanged);

    _loadBrainProfile();

    if (widget.initialQuery != null && widget.initialQuery!.trim().isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _handleSendMessage(widget.initialQuery!);
      });
    }
  }

  @override
  void dispose() {
    AuthService().removeListener(_onAuthChanged);
    if (widget.httpClient == null) _httpClient.close();
    _textController.dispose();
    _scrollController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _onAuthChanged() {
    if (_sessionOwner == _currentOwner) return;
    _sessionOwner = _currentOwner;
    if (!mounted) return;
    setState(() {
      _sessionMessages.clear();
      _isThinking = false;
      _learnedFacts = [];
      _preferredStyles = [];
      _learnedLocation = null;
      _totalInteractions = 0;
      _acceptedRecommendations = 0;
    });
    _loadBrainProfile();
  }

  /// Tải hồ sơ bộ não AI thực tế từ Backend: GET /api/v1/ai/brain/profile
  Future<void> _loadBrainProfile() async {
    final token = AuthService().token;
    if (token == null) return;
    try {
      final res = await _httpClient
          .get(
            Uri.parse(ApiConfig.aiBrainProfileUrl),
            headers: {
              'Accept': 'application/json',
              'Authorization': 'Bearer $token',
            },
          )
          .timeout(const Duration(seconds: 8));

      if (res.statusCode == 200 && mounted) {
        final decoded = jsonDecode(utf8.decode(res.bodyBytes));
        final data = decoded['data'] as Map<String, dynamic>?;
        if (data != null) {
          final profile = data['profile'] as Map<String, dynamic>? ?? data;
          final stats = data['stats'] as Map<String, dynamic>? ?? {};
          final facts = (profile['learnedFacts'] as List<dynamic>? ?? [])
              .map((e) => e.toString())
              .toList();
          final styles = (profile['preferredStyles'] as List<dynamic>? ?? [])
              .map((e) => e.toString())
              .toList();
          setState(() {
            _learnedFacts = facts;
            _preferredStyles = styles;
            _learnedLocation = profile['location']?.toString();
            _totalInteractions =
                (stats['totalInteractions'] as num?)?.toInt() ??
                _totalInteractions;
            _acceptedRecommendations =
                (stats['acceptedRecommendations'] as num?)?.toInt() ??
                _acceptedRecommendations;
          });
        }
      }
    } catch (_) {}
  }

  /// Gửi phản hồi học hỏi tới AI Brain: POST /api/v1/ai/brain/feedback
  Future<void> _sendBrainFeedback({
    required String action,
    required String query,
    String? productId,
    required bool helpful,
  }) async {
    final token = AuthService().token;
    if (token == null) return;
    try {
      final res = await _httpClient
          .post(
            Uri.parse(ApiConfig.aiBrainFeedbackUrl),
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer $token',
            },
            body: jsonEncode({
              'action': action,
              'query': query.length > 3500 ? query.substring(0, 3500) : query,
              'productId': productId,
              'helpful': helpful,
            }),
          )
          .timeout(const Duration(seconds: 8));

      if (res.statusCode == 200 && mounted) {
        final decoded = jsonDecode(utf8.decode(res.bodyBytes));
        final stats = decoded['data']?['stats'] as Map<String, dynamic>?;
        if (stats != null) {
          setState(() {
            _totalInteractions =
                (stats['totalInteractions'] as num?)?.toInt() ??
                _totalInteractions;
            _acceptedRecommendations =
                (stats['acceptedRecommendations'] as num?)?.toInt() ??
                _acceptedRecommendations;
          });
        }
      }
    } catch (_) {}
  }

  /// Xóa ký ức bộ não AI trên Backend: DELETE /api/v1/ai/brain/reset
  Future<void> _resetBrainProfile() async {
    final token = AuthService().token;
    if (token != null) {
      try {
        await _httpClient
            .delete(
              Uri.parse(ApiConfig.aiBrainResetUrl),
              headers: {
                'Accept': 'application/json',
                'Authorization': 'Bearer $token',
              },
            )
            .timeout(const Duration(seconds: 8));
      } catch (_) {}
    }

    if (!mounted) return;
    setState(() {
      _learnedFacts = [];
      _preferredStyles = [];
      _learnedLocation = null;
      _totalInteractions = 0;
      _acceptedRecommendations = 0;
      _feedbackGivenMap.clear();
      _sessionMessages.clear();
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Đã bắt đầu cuộc trò chuyện mới.'),
        backgroundColor: AppColors.primary,
      ),
    );
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

  String _resolveProductImageUrl(String? rawUrl, {String? sourceBaseUrl}) {
    if (rawUrl == null || rawUrl.trim().isEmpty) return '';
    final trimmed = rawUrl.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    final cleanPath = trimmed.startsWith('/') ? trimmed : '/$trimmed';
    final base = sourceBaseUrl ?? ApiConfig.baseUrl;
    return '$base$cleanPath';
  }

  /// Thêm 1 sản phẩm được AI đề xuất vào giỏ hàng và gửi tín hiệu học tập lên POST /api/v1/ai/brain/feedback
  Future<void> _addProductToCart(Map<String, dynamic> item) async {
    final prodId =
        item['id']?.toString() ?? 'p_${DateTime.now().millisecondsSinceEpoch}';
    final prodName = item['name']?.toString() ?? 'Sản phẩm ShopNova';
    final priceNum = (item['price'] is num)
        ? (item['price'] as num).toDouble()
        : 0.0;
    final origPriceNum = (item['originalPrice'] is num)
        ? (item['originalPrice'] as num).toDouble()
        : priceNum;
    final imageUrl = _resolveProductImageUrl(
      item['imageUrl']?.toString(),
      sourceBaseUrl: item['_sourceBaseUrl']?.toString(),
    );

    await CartService().addToCart(
      productId: prodId,
      productName: prodName,
      variantName: item['categoryName']?.toString() ?? 'Tiêu chuẩn',
      price: priceNum,
      originalPrice: origPriceNum,
      imageUrl: imageUrl,
      qty: 1,
      shopName: item['mall'] == true ? 'ShopNova Mall' : 'Gian hàng ShopNova',
      shopMall: item['mall'] == true,
    );

    unawaited(
      _sendBrainFeedback(
        action: 'add_to_cart',
        query: prodName,
        productId: prodId,
        helpful: true,
      ),
    );

    if (mounted) {
      setState(() {
        _addedProductMap[prodId] = true;
      });
      Timer(const Duration(seconds: 2), () {
        if (mounted) {
          setState(() {
            _addedProductMap[prodId] = false;
          });
        }
      });
    }
  }

  /// Gửi tin nhắn tới POST /api/v1/ai/chat
  Future<void> _handleSendMessage(String text) async {
    final query = text.trim();
    if (query.isEmpty || _isThinking) return;

    _textController.clear();
    final now = DateTime.now();
    final timeStr =
        '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';

    setState(() {
      _messages.add(
        _AiChatMessage(
          id: 'usr_${now.millisecondsSinceEpoch}',
          isUser: true,
          text: query,
          time: timeStr,
        ),
      );
      _isThinking = true;
    });
    _scrollToBottom();

    final requestOwner = _currentOwner;
    _AiChatMessage? aiResponse;

    try {
      final pageQuery = RegExp(
        r'^\s*(?:xem\s+)?trang\s+\d+\s*$',
        caseSensitive: false,
      );
      final recentMessages = _messages.reversed
          .take(5)
          .toList()
          .reversed
          .toList();
      if (pageQuery.hasMatch(query)) {
        for (final message in _messages.reversed) {
          if (message.isUser && !pageQuery.hasMatch(message.text)) {
            if (!recentMessages.contains(message)) {
              recentMessages.insert(0, message);
            }
            break;
          }
        }
      }
      final recentHistory = recentMessages
          .map((m) => {'isUser': m.isUser, 'text': m.text})
          .toList();

      final requestBody = jsonEncode({
        'message': query,
        'context': {
          'role': AuthService().currentUser?.role ?? 'buyer',
          'history': recentHistory,
        },
        'history': recentHistory,
      });

      final headers = <String, String>{
        'Content-Type': 'application/json',
        if (AuthService().token != null)
          'Authorization': 'Bearer ${AuthService().token}',
      };

      String usedBaseUrl = ApiConfig.baseUrl;
      http.Response res;
      try {
        res = await _httpClient
            .post(
              Uri.parse(ApiConfig.aiChatUrl),
              headers: headers,
              body: requestBody,
            )
            .timeout(const Duration(seconds: 25));
      } catch (_) {
        // Nếu kết nối local bị ngắt, chuyển sang máy chủ Cloud
        usedBaseUrl = ApiConfig.productionUrl;
        res = await _httpClient
            .post(
              Uri.parse('${ApiConfig.productionUrl}/api/v1/ai/chat'),
              headers: headers,
              body: requestBody,
            )
            .timeout(const Duration(seconds: 25));
      }

      // Nếu máy chủ local trả về 503 (do chưa cấu hình GEMINI_API_KEY trên máy local),
      // tự động gọi API AI trực tiếp trên máy chủ Cloud của dự án
      if (res.statusCode == 503 && usedBaseUrl != ApiConfig.productionUrl) {
        try {
          final cloudHeaders = <String, String>{
            'Content-Type': 'application/json',
          };
          final cloudRes = await _httpClient
              .post(
                Uri.parse('${ApiConfig.productionUrl}/api/v1/ai/chat'),
                headers: cloudHeaders,
                body: requestBody,
              )
              .timeout(const Duration(seconds: 25));
          if (cloudRes.statusCode == 200) {
            res = cloudRes;
            usedBaseUrl = ApiConfig.productionUrl;
          }
        } catch (_) {}
      }

      final Map<String, dynamic> decoded = jsonDecode(
        utf8.decode(res.bodyBytes),
      );
      if (res.statusCode == 200 && decoded['success'] == true) {
        final data = decoded['data'] as Map<String, dynamic>?;
        if (data != null) {
          final reply =
              data['reply']?.toString() ??
              'Nova đã xử lý yêu cầu của bạn thành công!';
          final intentTitle =
              data['intentTitle']?.toString() ?? 'Tư vấn mua sắm ShopNova';
          final poweredBy = data['poweredBy']?.toString();
          final intentMatch =
              data['intentMatch']?.toString() ?? (poweredBy ?? 'AI Brain');
          final orderInfo = data['orderInfo'] as Map<String, dynamic>?;
          final budget = data['budget'] as Map<String, dynamic>?;
          final rawProducts = data['products'] as List<dynamic>? ?? [];
          final dynamicProducts = rawProducts.whereType<Map>().map((p) {
            final map = Map<String, dynamic>.from(p);
            map['_sourceBaseUrl'] = usedBaseUrl;
            map['imageUrl'] = _resolveProductImageUrl(
              map['imageUrl']?.toString(),
              sourceBaseUrl: usedBaseUrl,
            );
            return map;
          }).toList();

          final nextPageNum =
              ((data['catalogPage'] ?? data['pagination']?['page'] ?? 1) as num)
                  .toInt() +
              1;
          final hasMore =
              data['catalogHasMore'] == true ||
              (data['pagination'] is Map &&
                  data['pagination']['hasMore'] == true);
          final List<String> suggestions = hasMore
              ? ['Xem trang $nextPageNum']
              : const [];

          // Cập nhật dữ liệu AI Brain từ response
          final brain = data['brain'] as Map<String, dynamic>?;
          List<String> newlyLearned = [];
          if (brain != null) {
            final facts = (brain['learnedFacts'] as List<dynamic>? ?? [])
                .map((e) => e.toString())
                .toList();
            final styles = (brain['preferredStyles'] as List<dynamic>? ?? [])
                .map((e) => e.toString())
                .toList();
            final stats = brain['stats'] as Map<String, dynamic>? ?? {};
            newlyLearned = (brain['newlyLearned'] as List<dynamic>? ?? [])
                .map((e) => e.toString())
                .toList();
            if (facts.isNotEmpty) _learnedFacts = facts;
            if (styles.isNotEmpty) _preferredStyles = styles;
            if (brain['location'] != null) {
              _learnedLocation = brain['location'].toString();
            }
            _totalInteractions =
                (stats['totalInteractions'] as num?)?.toInt() ??
                _totalInteractions;
            _acceptedRecommendations =
                (stats['acceptedRecommendations'] as num?)?.toInt() ??
                _acceptedRecommendations;
          }

          aiResponse = _AiChatMessage(
            id: 'ai_${DateTime.now().millisecondsSinceEpoch}',
            isUser: false,
            text: reply,
            time: timeStr,
            intentTitle: intentTitle,
            intentMatch: intentMatch,
            products: dynamicProducts,
            orderData: orderInfo,
            budget: budget,
            newlyLearned: newlyLearned,
            suggestions: suggestions,
          );
        }
      } else {
        final serverMsg =
            decoded['message']?.toString() ??
            'Nova AI hiện không khả dụng. Bạn vui lòng thử lại sau.';
        aiResponse = _AiChatMessage(
          id: 'ai_err_${DateTime.now().millisecondsSinceEpoch}',
          isUser: false,
          text: serverMsg,
          time: timeStr,
          intentTitle: 'Nova AI',
        );
      }
    } catch (_) {
      aiResponse = _AiChatMessage(
        id: 'ai_fallback_${DateTime.now().millisecondsSinceEpoch}',
        isUser: false,
        text: 'Nova AI hiện không kết nối được với máy chủ. Bạn vui lòng thử lại sau.',
        time: timeStr,
        intentTitle: 'Thông Báo Kết Nối',
      );
    }

    if (requestOwner != _currentOwner) return;
    if (mounted) {
      setState(() {
        _isThinking = false;
        if (aiResponse != null) {
          _messages.add(aiResponse);
        }
      });
      _scrollToBottom();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      resizeToAvoidBottomInset: true,
      appBar: AppBar(
        automaticallyImplyLeading: false,
        toolbarHeight: 76,
        titleSpacing: widget.isStandalone ? 0 : 16,
        leading: widget.isStandalone
            ? IconButton(
                tooltip: 'Quay lại',
                icon: const Icon(Icons.arrow_back_rounded),
                onPressed: () => Navigator.maybePop(context),
              )
            : null,
        title: _buildAiStatusHeader(),
        actions: [
          IconButton(
            tooltip: 'Tìm sản phẩm',
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const SearchScreen()),
            ),
            icon: const Icon(Icons.search_rounded, size: 21),
          ),
          ListenableBuilder(
            listenable: CartService(),
            builder: (context, _) => IconButton(
              tooltip: 'Giỏ hàng',
              onPressed: () => Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const CartScreen()),
              ),
              icon: Badge(
                isLabelVisible: CartService().itemCount > 0,
                label: Text(
                  CartService().itemCount > 99
                      ? '99+'
                      : '${CartService().itemCount}',
                ),
                backgroundColor: AppColors.primary,
                child: const Icon(Icons.shopping_cart_outlined, size: 21),
              ),
            ),
          ),
          if (_messages.isNotEmpty ||
              _learnedFacts.isNotEmpty ||
              _preferredStyles.isNotEmpty ||
              _learnedLocation != null ||
              _totalInteractions > 0)
            PopupMenuButton<String>(
              tooltip: 'Tùy chọn trò chuyện',
              icon: const Icon(
                Icons.more_horiz_rounded,
                color: AppColors.textSecondary,
              ),
              onSelected: (value) {
                if (value == 'context') {
                  _showBrainProfileModal();
                }
                if (value == 'reset') {
                  _resetBrainProfile();
                }
              },
              itemBuilder: (_) => [
                const PopupMenuItem(
                  value: 'context',
                  child: Text('Thông tin đã ghi nhớ'),
                ),
                if (_messages.isNotEmpty)
                  const PopupMenuItem(
                    value: 'reset',
                    child: Text('Cuộc trò chuyện mới'),
                  ),
              ],
            ),
        ],
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(1),
          child: Divider(height: 1, color: AppColors.border),
        ),
      ),
      body: SafeArea(
        top: false,
        child: Column(
          children: [
            Expanded(
              child: (_messages.isEmpty && !_isThinking)
                  ? _buildEmptyAiCanvas()
                  : ListView.builder(
                      controller: _scrollController,
                      keyboardDismissBehavior:
                          ScrollViewKeyboardDismissBehavior.onDrag,
                      padding: const EdgeInsets.fromLTRB(18, 22, 18, 16),
                      itemCount: _messages.length + (_isThinking ? 1 : 0),
                      itemBuilder: (context, index) {
                        if (index == _messages.length) {
                          return _buildThinkingBubble();
                        }
                        final message = _messages[index];
                        return message.isUser
                            ? _buildUserMessage(message)
                            : _buildAiResponseUnit(message);
                      },
                    ),
            ),
            _buildChatInputPanel(),
          ],
        ),
      ),
    );
  }

  Widget _buildAiStatusHeader() {
    return Row(
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: const Color(0xFFF5EFE7),
            borderRadius: BorderRadius.circular(12),
          ),
          child: const Center(child: NovaMark()),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  const Flexible(
                    child: Text(
                      'Nova',
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),
                  const SizedBox(width: 7),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 5,
                      vertical: 1,
                    ),
                    decoration: BoxDecoration(
                      border: Border.all(color: AppColors.border),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: const Text(
                      'AI',
                      style: TextStyle(
                        fontSize: 9,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 3),
              const Text(
                'Trợ lý mua sắm ShopNova',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
              ),
            ],
          ),
        ),
      ],
    );
  }

  void _showBrainProfileModal() {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Thông tin đã ghi nhớ',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Số tương tác: $_totalInteractions • Đề xuất đã chọn: $_acceptedRecommendations',
              style: const TextStyle(
                fontSize: 12.5,
                color: AppColors.textSecondary,
              ),
            ),
            if (_learnedLocation != null && _learnedLocation!.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(
                'Khu vực: $_learnedLocation',
                style: const TextStyle(
                  fontSize: 12.5,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
            if (_preferredStyles.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(
                'Phong cách: ${_preferredStyles.join(", ")}',
                style: const TextStyle(
                  fontSize: 12.5,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
            if (_learnedFacts.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(
                'Thông tin đã ghi nhớ: ${_learnedFacts.join(" • ")}',
                style: const TextStyle(
                  fontSize: 12.5,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () {
                  Navigator.pop(ctx);
                  _resetBrainProfile();
                },
                icon: const Icon(
                  Icons.delete_outline_rounded,
                  color: AppColors.flashSaleRed,
                ),
                label: const Text(
                  'Đặt lại cuộc trò chuyện & ký ức',
                  style: TextStyle(color: AppColors.flashSaleRed),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Trạng thái trống tự nhiên trước khi người dùng đặt câu hỏi với AI
  Widget _buildEmptyAiCanvas() {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const NovaNotes(),
            const SizedBox(height: 24),
            const Text(
              'BẮT ĐẦU TỪ ĐIỀU BẠN CẦN',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 9,
                letterSpacing: 1.3,
                fontWeight: FontWeight.w600,
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'Bạn đang tìm gì hôm nay?',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 21,
                fontWeight: FontWeight.w600,
                letterSpacing: -0.6,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'Mô tả món đồ, ngân sách hoặc điều bạn muốn biết. Nova sẽ cùng bạn tìm trong ShopNova.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 12,
                height: 1.85,
                color: AppColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Bong bóng tin nhắn người dùng
  Widget _buildUserMessage(_AiChatMessage msg) {
    return Align(
      alignment: Alignment.centerRight,
      child: Padding(
        padding: const EdgeInsets.only(left: 35, bottom: 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 12),
              decoration: const BoxDecoration(
                color: Color(0xFFEEE3D6),
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(12),
                  topRight: Radius.circular(12),
                  bottomLeft: Radius.circular(12),
                  bottomRight: Radius.circular(3),
                ),
              ),
              child: Text(
                msg.text,
                style: const TextStyle(
                  fontSize: 13.5,
                  height: 1.8,
                  color: AppColors.textPrimary,
                ),
              ),
            ),
            const SizedBox(height: 5),
            Text(
              msg.time ?? '',
              style: const TextStyle(
                fontSize: 10,
                color: AppColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Bong bóng phản hồi từ Nova AI (hiển thị dữ liệu thật từ API)
  Widget _buildAiResponseUnit(_AiChatMessage msg) {
    final products = msg.products ?? const [];
    final feedbackState = _feedbackGivenMap[msg.id];
    final total = msg.budget?['total'];
    return Padding(
      padding: const EdgeInsets.only(bottom: 26),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              NovaMark(size: 21),
              SizedBox(width: 7),
              Text(
                'Nova',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: AppColors.earth,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          if (msg.intentTitle != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 7),
              child: Text(
                msg.intentTitle!,
                style: const TextStyle(
                  fontSize: 10,
                  color: AppColors.textSecondary,
                ),
              ),
            ),
          _buildFormattedAiText(msg.text),
          if (msg.orderData != null) ...[
            const SizedBox(height: 14),
            _buildOrderTrackingCard(msg.orderData!),
          ],
          if (total is num) ...[
            const SizedBox(height: 14),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFFAF6F0),
                border: Border.all(color: AppColors.border),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Wrap(
                spacing: 12,
                runSpacing: 6,
                alignment: WrapAlignment.spaceBetween,
                children: [
                  const Text(
                    'Tổng các món gợi ý',
                    style: TextStyle(
                      fontSize: 12,
                      color: AppColors.textSecondary,
                    ),
                  ),
                  Text(
                    _formatVND(total),
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.earth,
                    ),
                  ),
                ],
              ),
            ),
          ],
          if (products.isNotEmpty) ...[
            const SizedBox(height: 14),
            ...products.map(_buildRecommendedProductCard),
          ],
          Row(
            children: [
              Expanded(
                child: Text(
                  msg.time ?? '',
                  style: const TextStyle(
                    fontSize: 10,
                    color: AppColors.textSecondary,
                  ),
                ),
              ),
              IconButton(
                tooltip: 'Câu trả lời hữu ích',
                isSelected: feedbackState == true,
                icon: const Icon(Icons.thumb_up_outlined, size: 16),
                selectedIcon: const Icon(
                  Icons.thumb_up_rounded,
                  size: 16,
                  color: AppColors.earth,
                ),
                color: AppColors.textSecondary,
                onPressed: () {
                  setState(() => _feedbackGivenMap[msg.id] = true);
                  _sendBrainFeedback(
                    action: 'like',
                    query: msg.text,
                    helpful: true,
                  );
                },
              ),
              IconButton(
                tooltip: 'Câu trả lời chưa hữu ích',
                isSelected: feedbackState == false,
                icon: const Icon(Icons.thumb_down_outlined, size: 16),
                selectedIcon: const Icon(
                  Icons.thumb_down_rounded,
                  size: 16,
                  color: AppColors.earth,
                ),
                color: AppColors.textSecondary,
                onPressed: () {
                  setState(() => _feedbackGivenMap[msg.id] = false);
                  _sendBrainFeedback(
                    action: 'dislike',
                    query: msg.text,
                    helpful: false,
                  );
                },
              ),
            ],
          ),
          if (msg.suggestions?.isNotEmpty == true)
            Wrap(
              spacing: 7,
              runSpacing: 7,
              children: msg.suggestions!
                  .take(4)
                  .map(
                    (suggestion) => OutlinedButton(
                      onPressed: _isThinking
                          ? null
                          : () => _handleSendMessage(suggestion),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.earth,
                        side: const BorderSide(color: AppColors.border),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(7),
                        ),
                      ),
                      child: Text(
                        suggestion,
                        style: const TextStyle(fontSize: 11),
                      ),
                    ),
                  )
                  .toList(),
            ),
        ],
      ),
    );
  }

  /// Thẻ hiển thị sản phẩm được Nova AI gợi ý từ dữ liệu thật của Backend
  Widget _buildRecommendedProductCard(Map<String, dynamic> item) {
    final prodId = item['id']?.toString() ?? '';
    final name = item['name']?.toString() ?? 'Sản phẩm ShopNova';
    final categoryName =
        item['categoryName']?.toString() ?? item['tag']?.toString() ?? '';
    final priceNum = (item['price'] is num) ? (item['price'] as num) : 0;
    final origPriceNum = (item['originalPrice'] is num)
        ? (item['originalPrice'] as num)
        : null;
    final imageUrl = item['imageUrl']?.toString() ?? '';
    final isAdded = _addedProductMap[prodId] == true;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE6D5C2)),
      ),
      child: InkWell(
        onTap: () {
          if (prodId.isNotEmpty) {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => ProductDetailScreen(
                  productId: prodId,
                  initialProduct: Product(
                    id: prodId,
                    name: name,
                    price: priceNum.toDouble(),
                    originalPrice: (origPriceNum ?? priceNum).toDouble(),
                    discount:
                        (origPriceNum != null &&
                            origPriceNum > priceNum &&
                            origPriceNum > 0)
                        ? (((origPriceNum - priceNum) / origPriceNum) * 100)
                              .round()
                        : 0,
                    rating:
                        (item['rating'] is num && (item['rating'] as num) > 0)
                        ? (item['rating'] as num).toDouble()
                        : 5.0,
                    soldCount: 'Đã bán ${item['sold'] ?? 0}',
                    imageUrl: imageUrl,
                    badges: item['mall'] == true ? const ['MALL'] : const [],
                  ),
                ),
              ),
            );
          }
        },
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Container(
                width: 58,
                height: 58,
                color: const Color(0xFFFAF4EB),
                child: imageUrl.isNotEmpty
                    ? Image.network(
                        imageUrl,
                        fit: BoxFit.cover,
                        errorBuilder: (context, error, stackTrace) =>
                            const Icon(
                              Icons.image_outlined,
                              color: colorSecondary,
                              size: 24,
                            ),
                      )
                    : const Icon(
                        Icons.image_outlined,
                        color: colorSecondary,
                        size: 24,
                      ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (categoryName.isNotEmpty)
                    Container(
                      margin: const EdgeInsets.only(bottom: 3),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 1.5,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF5E7D4),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        categoryName,
                        style: const TextStyle(
                          fontSize: 9.5,
                          fontWeight: FontWeight.bold,
                          color: colorPrimary,
                        ),
                      ),
                    ),
                  Text(
                    name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 12.5,
                      color: Color(0xFF49352D),
                    ),
                  ),
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      Text(
                        _formatVND(priceNum),
                        style: const TextStyle(
                          color: colorPrimary,
                          fontWeight: FontWeight.w900,
                          fontSize: 12.5,
                        ),
                      ),
                      if (origPriceNum != null && origPriceNum > priceNum) ...[
                        const SizedBox(width: 6),
                        Flexible(
                          child: Text(
                            _formatVND(origPriceNum),
                            style: const TextStyle(
                              color: Colors.grey,
                              fontSize: 10.5,
                              decoration: TextDecoration.lineThrough,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            InkWell(
              onTap: () => _addProductToCart(item),
              borderRadius: BorderRadius.circular(8),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 7,
                ),
                decoration: BoxDecoration(
                  color: isAdded
                      ? const Color(0xFF059669)
                      : const Color(0xFFF5E7D4),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  isAdded ? '✓ Đã thêm' : '+ Giỏ',
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.bold,
                    color: isAdded ? Colors.white : colorPrimary,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Thẻ thông tin đơn hàng thực tế khi người dùng hỏi tra cứu đơn
  Widget _buildOrderTrackingCard(Map<String, dynamic> order) {
    final code = order['code']?.toString() ?? '';
    final statusText =
        order['statusText']?.toString() ?? order['status']?.toString() ?? '';
    final location = order['location']?.toString();
    final eta = order['eta']?.toString();
    final shipper = order['shipper']?.toString();

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFFAF6F0),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 12,
            runSpacing: 6,
            alignment: WrapAlignment.spaceBetween,
            children: [
              Text(
                'Đơn hàng: $code',
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 12.5,
                  color: colorPrimary,
                ),
              ),
              if (statusText.isNotEmpty)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF3C7),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    statusText,
                    style: const TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF92400E),
                    ),
                  ),
                ),
            ],
          ),
          if (location != null || eta != null || shipper != null) ...[
            const SizedBox(height: 6),
            if (location != null && location.isNotEmpty)
              Text(
                'Vị trí: $location',
                style: const TextStyle(
                  fontSize: 11.5,
                  color: Color(0xFF8B7566),
                ),
              ),
            if (eta != null && eta.isNotEmpty)
              Text(
                'Dự kiến: $eta',
                style: const TextStyle(
                  fontSize: 11.5,
                  color: Color(0xFF8B7566),
                ),
              ),
            if (shipper != null && shipper.isNotEmpty)
              Text(
                'Người giao: $shipper',
                style: const TextStyle(
                  fontSize: 11.5,
                  color: Color(0xFF8B7566),
                ),
              ),
          ],
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            height: 34,
            child: ElevatedButton(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const OrdersScreen()),
                );
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: colorPrimary,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              child: const Text(
                'Xem chi tiết đơn',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Bong bóng trạng thái chờ AI trả lời
  Widget _buildThinkingBubble() {
    return const Padding(
      padding: EdgeInsets.only(bottom: 18),
      child: Row(
        children: [
          SizedBox(
            width: 12,
            height: 12,
            child: CircularProgressIndicator(
              strokeWidth: 1.5,
              color: AppColors.earth,
            ),
          ),
          SizedBox(width: 9),
          Text(
            'Đang trả lời…',
            style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
          ),
        ],
      ),
    );
  }

  Widget _buildChatInputPanel() {
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(5),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFD8C8B7)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _textController,
                    focusNode: _focusNode,
                    enabled: !_isThinking,
                    textInputAction: TextInputAction.send,
                    onSubmitted: _handleSendMessage,
                    style: const TextStyle(
                      fontSize: 14,
                      color: AppColors.textPrimary,
                    ),
                    decoration: const InputDecoration(
                      hintText: 'Bạn cần tìm gì?',
                      labelText: 'Tin nhắn cho Nova',
                      floatingLabelBehavior: FloatingLabelBehavior.never,
                      hintStyle: TextStyle(
                        color: AppColors.textHint,
                        fontSize: 13,
                      ),
                      border: InputBorder.none,
                      contentPadding: EdgeInsets.symmetric(
                        horizontal: 9,
                        vertical: 10,
                      ),
                      isDense: true,
                    ),
                  ),
                ),
                ValueListenableBuilder<TextEditingValue>(
                  valueListenable: _textController,
                  builder: (context, value, _) => IconButton.filled(
                    tooltip: 'Gửi tin nhắn',
                    onPressed: _isThinking || value.text.trim().isEmpty
                        ? null
                        : () => _handleSendMessage(value.text),
                    style: IconButton.styleFrom(
                      backgroundColor: AppColors.earth,
                      disabledBackgroundColor: const Color(0xFFEEE6DC),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    icon: const Icon(Icons.arrow_upward_rounded, size: 19),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 9),
          const Text(
            'Nova sử dụng AI. Bạn có thể kiểm tra lại thông tin tại trang sản phẩm.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 9,
              height: 1.65,
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }

  /// Định dạng Markdown in đậm (**...**) từ phản hồi của Gemini AI
  Widget _buildFormattedAiText(String text) {
    if (text.contains('**')) {
      final spans = <TextSpan>[];
      final parts = text.split('**');
      for (int i = 0; i < parts.length; i++) {
        if (i % 2 == 1) {
          spans.add(
            TextSpan(
              text: parts[i],
              style: const TextStyle(
                fontWeight: FontWeight.bold,
                color: colorPrimary,
              ),
            ),
          );
        } else {
          spans.add(TextSpan(text: parts[i]));
        }
      }
      return RichText(
        text: TextSpan(
          style: const TextStyle(
            color: Color(0xFF49352D),
            fontSize: 13.5,
            height: 1.45,
          ),
          children: spans,
        ),
      );
    }

    return Text(
      text,
      style: const TextStyle(
        color: Color(0xFF49352D),
        fontSize: 13.5,
        height: 1.45,
      ),
    );
  }
}

class _AiChatMessage {
  final String id;
  final bool isUser;
  final String text;
  final String? time;
  final String? intentTitle;
  final String? intentMatch;
  final Map<String, dynamic>? orderData;
  final Map<String, dynamic>? budget;
  final List<Map<String, dynamic>>? products;
  final List<String>? newlyLearned;
  final List<String>? suggestions;

  _AiChatMessage({
    required this.id,
    required this.isUser,
    required this.text,
    this.time,
    this.intentTitle,
    this.intentMatch,
    this.orderData,
    this.budget,
    this.products,
    this.newlyLearned,
    this.suggestions,
  });
}
