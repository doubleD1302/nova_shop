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
import '../../widgets/common/nova_logo.dart';

/// Screen Nova AI - Trợ lý mua sắm thông minh kết nối trực tiếp API AI của Backend
/// Các API được kết nối:
/// - POST   /api/v1/ai/chat
/// - GET    /api/v1/ai/brain/profile
/// - POST   /api/v1/ai/brain/feedback
/// - DELETE /api/v1/ai/brain/reset
class NovaAIScreen extends StatefulWidget {
  final bool isStandalone;
  final String? initialQuery;

  const NovaAIScreen({
    super.key,
    this.isStandalone = false,
    this.initialQuery,
  });

  static void resetSession() => _NovaAIScreenState.resetSessionForTest();

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

  static const Color colorTertiary = Color(0xFF00BFA5);
  static const Color colorTertiaryContainer = Color(0xFF008654);

  static const Color colorSurface = AppColors.background;
  static const Color colorSurfaceContainerLow = AppColors.surfaceAlt;
  static const Color colorOnSurface = AppColors.textPrimary;

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
  String get _currentOwner => '${AuthService().currentUser?.id ?? 'guest'}:${AuthService().currentUser?.role ?? 'guest'}';
  List<_AiChatMessage> get _messages => _sessionMessages;

  static void resetSessionForTest() {
    _sessionMessages.clear();
  }



  @override
  void initState() {
    super.initState();
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
      final res = await http.get(
        Uri.parse(ApiConfig.aiBrainProfileUrl),
        headers: {
          'Accept': 'application/json',
          'Authorization': 'Bearer $token',
        },
      ).timeout(const Duration(seconds: 8));

      if (res.statusCode == 200 && mounted) {
        final decoded = jsonDecode(utf8.decode(res.bodyBytes));
        final data = decoded['data'] as Map<String, dynamic>?;
        if (data != null) {
          final profile = data['profile'] as Map<String, dynamic>? ?? data;
          final stats = data['stats'] as Map<String, dynamic>? ?? {};
          final facts = (profile['learnedFacts'] as List<dynamic>? ?? []).map((e) => e.toString()).toList();
          final styles = (profile['preferredStyles'] as List<dynamic>? ?? []).map((e) => e.toString()).toList();
          setState(() {
            _learnedFacts = facts;
            _preferredStyles = styles;
            _learnedLocation = profile['location']?.toString();
            _totalInteractions = (stats['totalInteractions'] as num?)?.toInt() ?? _totalInteractions;
            _acceptedRecommendations = (stats['acceptedRecommendations'] as num?)?.toInt() ?? _acceptedRecommendations;
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
      final res = await http.post(
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
      ).timeout(const Duration(seconds: 8));

      if (res.statusCode == 200 && mounted) {
        final decoded = jsonDecode(utf8.decode(res.bodyBytes));
        final stats = decoded['data']?['stats'] as Map<String, dynamic>?;
        if (stats != null) {
          setState(() {
            _totalInteractions = (stats['totalInteractions'] as num?)?.toInt() ?? _totalInteractions;
            _acceptedRecommendations = (stats['acceptedRecommendations'] as num?)?.toInt() ?? _acceptedRecommendations;
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
        await http.delete(
          Uri.parse(ApiConfig.aiBrainResetUrl),
          headers: {
            'Accept': 'application/json',
            'Authorization': 'Bearer $token',
          },
        ).timeout(const Duration(seconds: 8));
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
        content: Text('Đã làm mới cuộc trò chuyện và bộ nhớ AI.'),
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
    final prodId = item['id']?.toString() ?? 'p_${DateTime.now().millisecondsSinceEpoch}';
    final prodName = item['name']?.toString() ?? 'Sản phẩm ShopNova';
    final priceNum = (item['price'] is num) ? (item['price'] as num).toDouble() : 0.0;
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

    unawaited(_sendBrainFeedback(
      action: 'add_to_cart',
      query: prodName,
      productId: prodId,
      helpful: true,
    ));

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
    final timeStr = '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';

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
      final pageQuery = RegExp(r'^\s*(?:xem\s+)?trang\s+\d+\s*$', caseSensitive: false);
      final recentMessages = _messages.reversed.take(5).toList().reversed.toList();
      if (pageQuery.hasMatch(query)) {
        for (final message in _messages.reversed) {
          if (message.isUser && !pageQuery.hasMatch(message.text)) {
            if (!recentMessages.contains(message)) recentMessages.insert(0, message);
            break;
          }
        }
      }
      final recentHistory = recentMessages
          .map((m) => {
                'isUser': m.isUser,
                'text': m.text,
              })
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
        if (AuthService().token != null) 'Authorization': 'Bearer ${AuthService().token}',
      };

      String usedBaseUrl = ApiConfig.baseUrl;
      http.Response res;
      try {
        res = await http
            .post(
              Uri.parse(ApiConfig.aiChatUrl),
              headers: headers,
              body: requestBody,
            )
            .timeout(const Duration(seconds: 25));
      } catch (_) {
        // Nếu kết nối local bị ngắt, chuyển sang máy chủ Cloud
        usedBaseUrl = ApiConfig.productionUrl;
        res = await http
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
          final cloudRes = await http
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

      final Map<String, dynamic> decoded = jsonDecode(utf8.decode(res.bodyBytes));
      if (res.statusCode == 200 && decoded['success'] == true) {
        final data = decoded['data'] as Map<String, dynamic>?;
        if (data != null) {
          final reply = data['reply']?.toString() ?? 'Nova đã xử lý yêu cầu của bạn thành công!';
          final intentTitle = data['intentTitle']?.toString() ?? 'Tư vấn mua sắm ShopNova';
          final poweredBy = data['poweredBy']?.toString();
          final intentMatch = data['intentMatch']?.toString() ?? (poweredBy ?? 'AI Brain');
          final orderInfo = data['orderInfo'] as Map<String, dynamic>?;
          final budget = data['budget'] as Map<String, dynamic>?;
          final rawProducts = data['products'] as List<dynamic>? ?? [];
          final dynamicProducts = rawProducts
              .whereType<Map>()
              .map((p) {
                final map = Map<String, dynamic>.from(p);
                map['_sourceBaseUrl'] = usedBaseUrl;
                map['imageUrl'] = _resolveProductImageUrl(
                  map['imageUrl']?.toString(),
                  sourceBaseUrl: usedBaseUrl,
                );
                return map;
              })
              .toList();

          final nextPageNum = ((data['catalogPage'] ?? data['pagination']?['page'] ?? 1) as num).toInt() + 1;
          final hasMore = data['catalogHasMore'] == true ||
              (data['pagination'] is Map && data['pagination']['hasMore'] == true);
          final List<String> suggestions = hasMore ? ['Xem trang $nextPageNum'] : const [];

          // Cập nhật dữ liệu AI Brain từ response
          final brain = data['brain'] as Map<String, dynamic>?;
          List<String> newlyLearned = [];
          if (brain != null) {
            final facts = (brain['learnedFacts'] as List<dynamic>? ?? []).map((e) => e.toString()).toList();
            final styles = (brain['preferredStyles'] as List<dynamic>? ?? []).map((e) => e.toString()).toList();
            final stats = brain['stats'] as Map<String, dynamic>? ?? {};
            newlyLearned = (brain['newlyLearned'] as List<dynamic>? ?? []).map((e) => e.toString()).toList();
            if (facts.isNotEmpty) _learnedFacts = facts;
            if (styles.isNotEmpty) _preferredStyles = styles;
            if (brain['location'] != null) _learnedLocation = brain['location'].toString();
            _totalInteractions = (stats['totalInteractions'] as num?)?.toInt() ?? _totalInteractions;
            _acceptedRecommendations = (stats['acceptedRecommendations'] as num?)?.toInt() ?? _acceptedRecommendations;
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
        final serverMsg = decoded['message']?.toString() ??
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
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    final avatarUrl = AuthService().currentUser?.avatarUrl;

    return Scaffold(
      backgroundColor: colorSurface,
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(60),
        child: Container(
          decoration: const BoxDecoration(
            color: AppColors.surface,
            border: Border(bottom: BorderSide(color: AppColors.border)),
          ),
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              child: Row(
                children: [
                  if (widget.isStandalone) ...[
                    IconButton(
                      icon: const Icon(Icons.arrow_back_ios_new_rounded, color: colorOnSurface, size: 18),
                      onPressed: () => Navigator.pop(context),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                    ),
                    const SizedBox(width: 8),
                  ],
                  NovaLogo(
                    size: 28,
                    fontSize: 16,
                    showText: !widget.isStandalone,
                  ),
                  const SizedBox(width: 10),
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
                                'Tìm sản phẩm trên ShopNova...',
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
                  ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: Container(
                      width: 32,
                      height: 32,
                      color: colorPrimaryFixed,
                      child: (avatarUrl != null && avatarUrl.isNotEmpty)
                          ? Image.network(
                              ApiConfig.resolveImageUrl(avatarUrl),
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => const Icon(Icons.person, color: colorPrimary, size: 20),
                            )
                          : const Icon(Icons.person, color: colorPrimary, size: 20),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
      body: Column(
        children: [
          _buildAiStatusHeader(),
          Expanded(
            child: (_messages.isEmpty && !_isThinking)
                ? _buildEmptyAiCanvas()
                : ListView.builder(
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
          Padding(
            padding: EdgeInsets.only(bottom: bottomInset),
            child: _buildChatInputPanel(),
          ),
        ],
      ),
    );
  }

  /// Header trạng thái Nova AI
  Widget _buildAiStatusHeader() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: const BoxDecoration(
        color: Color(0xFFF5E7D4),
        border: Border(bottom: BorderSide(color: Color(0xFFE6D5C2))),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: colorPrimary,
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Center(
              child: Text('✨', style: TextStyle(fontSize: 20)),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Flexible(
                      child: Text(
                        'Nova AI',
                        style: TextStyle(fontWeight: FontWeight.w900, fontSize: 15, color: Color(0xFF49352D)),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: colorPrimary,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Text(
                        '24/7',
                        style: TextStyle(color: Colors.white, fontSize: 9.5, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Container(
                      width: 7,
                      height: 7,
                      decoration: const BoxDecoration(
                        color: Color(0xFF10B981),
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 5),
                    const Flexible(
                      child: Text(
                        'Trực tuyến • Trợ lý AI thông minh',
                        style: TextStyle(color: Color(0xFF8B7566), fontSize: 11),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          if (_learnedFacts.isNotEmpty || _preferredStyles.isNotEmpty || _learnedLocation != null || _totalInteractions > 0)
            IconButton(
              tooltip: 'Ngữ cảnh AI đã học',
              visualDensity: VisualDensity.compact,
              onPressed: _showBrainProfileModal,
              icon: const Icon(Icons.psychology_outlined, color: AppColors.earth, size: 20),
            ),
          if (_messages.isNotEmpty)
            IconButton(
              tooltip: 'Cuộc trò chuyện mới',
              visualDensity: VisualDensity.compact,
              onPressed: _resetBrainProfile,
              icon: const Icon(Icons.refresh_rounded, color: AppColors.primary, size: 20),
            ),
        ],
      ),
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
              'Ngữ cảnh cá nhân hóa (AI Brain)',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
            ),
            const SizedBox(height: 8),
            Text(
              'Số tương tác: $_totalInteractions • Đề xuất đã chọn: $_acceptedRecommendations',
              style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary),
            ),
            if (_learnedLocation != null && _learnedLocation!.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text('Khu vực: $_learnedLocation', style: const TextStyle(fontSize: 12.5, color: AppColors.textPrimary)),
            ],
            if (_preferredStyles.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text('Phong cách: ${_preferredStyles.join(", ")}', style: const TextStyle(fontSize: 12.5, color: AppColors.textPrimary)),
            ],
            if (_learnedFacts.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text('Thông tin đã ghi nhớ: ${_learnedFacts.join(" • ")}', style: const TextStyle(fontSize: 12.5, color: AppColors.textPrimary)),
            ],
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () {
                  Navigator.pop(ctx);
                  _resetBrainProfile();
                },
                icon: const Icon(Icons.delete_outline_rounded, color: AppColors.flashSaleRed),
                label: const Text('Đặt lại cuộc trò chuyện & ký ức', style: TextStyle(color: AppColors.flashSaleRed)),
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
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppColors.primary, AppColors.earth],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(18),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withValues(alpha: 0.22),
                    blurRadius: 16,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: const Icon(Icons.auto_awesome_rounded, color: Colors.white, size: 32),
            ),
            const SizedBox(height: 16),
            const Text(
              'Tôi có thể giúp gì cho bạn?',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Hỏi bất kỳ điều gì về sản phẩm, tư vấn chọn size, so sánh mức giá hoặc tra cứu tình trạng đơn hàng của bạn.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                color: AppColors.textSecondary,
                height: 1.45,
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Bong bóng tin nhắn người dùng
  Widget _buildUserMessage(_AiChatMessage msg) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.end,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(width: 40),
          Flexible(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [colorPrimary, Color(0xFFA95532)],
                ),
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(16),
                  bottomLeft: Radius.circular(16),
                  bottomRight: Radius.circular(16),
                  topRight: Radius.circular(4),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    msg.text,
                    style: const TextStyle(color: Colors.white, fontSize: 13.5, height: 1.45),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    msg.time ?? '',
                    style: TextStyle(color: Colors.white.withOpacity(0.8), fontSize: 10),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Bong bóng phản hồi từ Nova AI (hiển thị dữ liệu thật từ API)
  Widget _buildAiResponseUnit(_AiChatMessage msg) {
    final products = msg.products ?? const [];
    final feedbackState = _feedbackGivenMap[msg.id];

    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
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
            child: const Icon(Icons.auto_awesome, color: Colors.white, size: 17),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFFCF7),
                    borderRadius: const BorderRadius.only(
                      topLeft: Radius.circular(4),
                      topRight: Radius.circular(18),
                      bottomLeft: Radius.circular(18),
                      bottomRight: Radius.circular(18),
                    ),
                    border: Border.all(color: const Color(0xFFE6D5C2)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (msg.intentTitle != null) ...[
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Row(
                                children: [
                                  const Text('✨ ', style: TextStyle(fontSize: 13)),
                                  Flexible(
                                    child: Text(
                                      msg.intentTitle!,
                                      style: const TextStyle(
                                        color: Color(0xFF80513B),
                                        fontWeight: FontWeight.bold,
                                        fontSize: 12.5,
                                      ),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            if (msg.intentMatch != null) ...[
                              const SizedBox(width: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFECFDF5),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: const Color(0xFFA7F3D0)),
                                ),
                                child: Text(
                                  msg.intentMatch!,
                                  style: const TextStyle(
                                    color: Color(0xFF047857),
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                        const Divider(height: 14, color: Color(0xFFF0E2D2)),
                      ],

                      _buildFormattedAiText(msg.text),

                      // Hiển thị thẻ đơn hàng nếu API trả về orderInfo
                      if (msg.orderData != null) ...[
                        const SizedBox(height: 12),
                        _buildOrderTrackingCard(msg.orderData!),
                      ],

                      // Hiển thị danh sách sản phẩm thực tế do AI đề xuất từ kho ShopNova
                      if (products.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        const Text(
                          'SẢN PHẨM ĐỀ XUẤT:',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF80513B),
                            letterSpacing: 0.4,
                          ),
                        ),
                        const SizedBox(height: 8),
                        ...products.map((item) => _buildRecommendedProductCard(item)),
                      ],

                      // Thanh phản hồi học hỏi dành cho AI (POST /api/v1/ai/brain/feedback)
                      const Divider(height: 18, color: Color(0xFFF0E2D2)),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Flexible(
                            child: Text(
                              msg.time ?? '',
                              style: const TextStyle(fontSize: 10.5, color: Colors.grey),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          Flexible(
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Flexible(
                                  child: Text(
                                    'Phản hồi:',
                                    style: TextStyle(fontSize: 10.5, color: Colors.grey),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                const SizedBox(width: 6),
                                InkWell(
                                  onTap: () {
                                    setState(() => _feedbackGivenMap[msg.id] = true);
                                    _sendBrainFeedback(
                                      action: 'like',
                                      query: msg.text,
                                      helpful: true,
                                    );
                                  },
                                  borderRadius: BorderRadius.circular(6),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: feedbackState == true ? const Color(0xFFD1FAE5) : Colors.transparent,
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: const Text('👍', style: TextStyle(fontSize: 12)),
                                  ),
                                ),
                                const SizedBox(width: 4),
                                InkWell(
                                  onTap: () {
                                    setState(() => _feedbackGivenMap[msg.id] = false);
                                    _sendBrainFeedback(
                                      action: 'dislike',
                                      query: msg.text,
                                      helpful: false,
                                    );
                                  },
                                  borderRadius: BorderRadius.circular(6),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: feedbackState == false ? const Color(0xFFFEE2E2) : Colors.transparent,
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: const Text('👎', style: TextStyle(fontSize: 12)),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                // Các gợi ý câu hỏi tiếp theo
                if (msg.suggestions != null && msg.suggestions!.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: msg.suggestions!
                        .map(
                          (sug) => InkWell(
                            onTap: () => _handleSendMessage(sug),
                            borderRadius: BorderRadius.circular(16),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: const Color(0xFFE6D5C2)),
                              ),
                              child: Text(
                                sug,
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFF80513B),
                                ),
                              ),
                            ),
                          ),
                        )
                        .toList(),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// Thẻ hiển thị sản phẩm được Nova AI gợi ý từ dữ liệu thật của Backend
  Widget _buildRecommendedProductCard(Map<String, dynamic> item) {
    final prodId = item['id']?.toString() ?? '';
    final name = item['name']?.toString() ?? 'Sản phẩm ShopNova';
    final categoryName = item['categoryName']?.toString() ?? item['tag']?.toString() ?? '';
    final priceNum = (item['price'] is num) ? (item['price'] as num) : 0;
    final origPriceNum = (item['originalPrice'] is num) ? (item['originalPrice'] as num) : null;
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
                    discount: (origPriceNum != null && origPriceNum > priceNum && origPriceNum > 0)
                        ? (((origPriceNum - priceNum) / origPriceNum) * 100).round()
                        : 0,
                    rating: (item['rating'] is num && (item['rating'] as num) > 0)
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
                        errorBuilder: (_, __, ___) =>
                            const Icon(Icons.image_outlined, color: colorSecondary, size: 24),
                      )
                    : const Icon(Icons.image_outlined, color: colorSecondary, size: 24),
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
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF5E7D4),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        categoryName,
                        style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.bold, color: colorPrimary),
                      ),
                    ),
                  Text(
                    name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12.5, color: Color(0xFF49352D)),
                  ),
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      Text(
                        _formatVND(priceNum),
                        style: const TextStyle(color: colorPrimary, fontWeight: FontWeight.w900, fontSize: 12.5),
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
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                decoration: BoxDecoration(
                  color: isAdded ? const Color(0xFF059669) : const Color(0xFFF5E7D4),
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
    final statusText = order['statusText']?.toString() ?? order['status']?.toString() ?? '';
    final location = order['location']?.toString();
    final eta = order['eta']?.toString();
    final shipper = order['shipper']?.toString();

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFBEB),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFFDE68A)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '📦 Đơn hàng: $code',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12.5, color: colorPrimary),
              ),
              if (statusText.isNotEmpty)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF3C7),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    statusText,
                    style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: Color(0xFF92400E)),
                  ),
                ),
            ],
          ),
          if (location != null || eta != null || shipper != null) ...[
            const SizedBox(height: 6),
            if (location != null && location.isNotEmpty)
              Text('📍 $location', style: const TextStyle(fontSize: 11.5, color: Color(0xFF8B7566))),
            if (eta != null && eta.isNotEmpty)
              Text('⏰ $eta', style: const TextStyle(fontSize: 11.5, color: Color(0xFF8B7566))),
            if (shipper != null && shipper.isNotEmpty)
              Text('🛵 Bưu tá: $shipper', style: const TextStyle(fontSize: 11.5, color: Color(0xFF8B7566))),
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
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              child: const Text('Xem chi tiết đơn', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
            ),
          ),
        ],
      ),
    );
  }

  /// Bong bóng trạng thái chờ AI trả lời
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
            child: const Icon(Icons.auto_awesome, color: Colors.white, size: 17),
          ),
          const SizedBox(width: 10),
          Flexible(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFFFFFCF7),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE6D5C2)),
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
                  Flexible(
                    child: Text(
                      'Nova AI đang suy nghĩ & tìm kiếm sản phẩm phù hợp...',
                      style: TextStyle(fontSize: 12, color: Color(0xFF8B7566)),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Thanh nhập tin nhắn
  Widget _buildChatInputPanel() {
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 8, 14, 12),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Color(0xFFE6D5C2))),
      ),
      child: Row(
        children: [
          Expanded(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
              decoration: BoxDecoration(
                color: const Color(0xFFFAF4EB),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: const Color(0xFFE6D5C2)),
              ),
              child: TextField(
                controller: _textController,
                focusNode: _focusNode,
                enabled: !_isThinking,
                textInputAction: TextInputAction.send,
                onSubmitted: _handleSendMessage,
                style: const TextStyle(fontSize: 13.5, color: Color(0xFF49352D)),
                decoration: const InputDecoration(
                  hintText: 'Nhắn tin với Nova AI...',
                  hintStyle: TextStyle(fontSize: 12.5, color: Colors.grey),
                  border: InputBorder.none,
                  contentPadding: EdgeInsets.symmetric(vertical: 8),
                  isDense: true,
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          InkWell(
            onTap: _isThinking ? null : () => _handleSendMessage(_textController.text),
            borderRadius: BorderRadius.circular(20),
            child: Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: _isThinking ? Colors.grey.shade400 : colorPrimary,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.send_rounded, color: Colors.white, size: 18),
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
              style: const TextStyle(fontWeight: FontWeight.bold, color: colorPrimary),
            ),
          );
        } else {
          spans.add(TextSpan(text: parts[i]));
        }
      }
      return RichText(
        text: TextSpan(
          style: const TextStyle(color: Color(0xFF49352D), fontSize: 13.5, height: 1.45),
          children: spans,
        ),
      );
    }

    return Text(
      text,
      style: const TextStyle(color: Color(0xFF49352D), fontSize: 13.5, height: 1.45),
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
