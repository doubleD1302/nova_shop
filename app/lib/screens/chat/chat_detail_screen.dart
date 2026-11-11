import 'dart:async';
import 'package:flutter/material.dart';
import '../../services/auth_service.dart';
import '../../services/chat_service.dart';
import '../../theme/app_colors.dart';

/// Màn hình Chi Tiết Live Chat với Gian Hàng (/api/v1/chat + /ws/chat)
class ChatDetailScreen extends StatefulWidget {
  final ChatConversation? conversation;
  final String? shopId;
  final String? initialShopName;
  final String? initialPrompt;

  const ChatDetailScreen({
    super.key,
    this.conversation,
    this.shopId,
    this.initialShopName,
    this.initialPrompt,
  });

  @override
  State<ChatDetailScreen> createState() => _ChatDetailScreenState();
}

class _ChatDetailScreenState extends State<ChatDetailScreen> {
  final ChatService _chatService = ChatService();
  final TextEditingController _msgCtrl = TextEditingController();
  final ScrollController _scrollCtrl = ScrollController();

  ChatConversation? _conv;
  List<ChatMessageItem> _messages = [];
  bool _isLoading = true;
  bool _isSending = false;
  String? _error;
  StreamSubscription? _wsSub;

  @override
  void initState() {
    super.initState();
    _conv = widget.conversation;
    if (widget.initialPrompt != null && widget.initialPrompt!.isNotEmpty) {
      _msgCtrl.text = widget.initialPrompt!;
    }
    _initChat();
  }

  Future<void> _initChat() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    if (_conv == null && widget.shopId != null) {
      _conv = await _chatService.getOrCreateConversation(widget.shopId!);
    }

    if (_conv == null) {
      if (mounted) {
        setState(() {
          _error = _chatService.lastError ?? 'Không thể mở cuộc trò chuyện.';
          _isLoading = false;
        });
      }
      return;
    }

    final list = await _chatService.getMessages(_conv!.id);
    if (mounted) {
      setState(() {
        _messages = list;
        _isLoading = false;
      });
      _scrollToBottom();
    }

    await _chatService.connectSocket();
    _wsSub = _chatService.events.listen((event) {
      final type = event['type']?.toString();
      final convId = event['conversationId']?.toString();
      if ((type == 'new_message' || type == 'message_sent') &&
          convId == _conv?.id &&
          event['message'] is Map<String, dynamic>) {
        final msg = ChatMessageItem.fromJson(event['message'] as Map<String, dynamic>);
        if (mounted && !_messages.any((m) => m.id == msg.id)) {
          setState(() => _messages.add(msg));
          _scrollToBottom();
        }
      }
    });
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollCtrl.hasClients) {
        _scrollCtrl.animateTo(
          _scrollCtrl.position.maxScrollExtent,
          duration: const Duration(milliseconds: 220),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  void dispose() {
    _wsSub?.cancel();
    _msgCtrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _msgCtrl.text.trim();
    if (text.isEmpty || _conv == null || _isSending) return;
    setState(() => _isSending = true);
    _msgCtrl.clear();

    final created = await _chatService.sendMessage(_conv!.id, text);
    if (!mounted) return;
    setState(() => _isSending = false);

    if (created != null) {
      if (!_messages.any((m) => m.id == created.id)) {
        setState(() => _messages.add(created));
      }
      _scrollToBottom();
    } else {
      _msgCtrl.text = text;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_chatService.lastError ?? 'Gửi tin nhắn thất bại.'),
          backgroundColor: const Color(0xFFDC2626),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final shopName = _conv?.shopName ?? widget.initialShopName ?? 'Gian Hàng';
    final currentUserId = AuthService().currentUser?.id;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: AppColors.border, height: 1),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: AppColors.textPrimary, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Row(
          children: [
            const Icon(Icons.storefront_rounded, color: AppColors.primary, size: 20),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    shopName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w700, fontSize: 15),
                  ),
                  Text(
                    _chatService.isSocketConnected ? 'Trực tuyến (Live)' : 'Chat cùng gian hàng',
                    style: const TextStyle(color: Color(0xFF00BFA5), fontSize: 11),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                : _error != null
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.textSecondary)),
                              const SizedBox(height: 12),
                              ElevatedButton(
                                onPressed: _initChat,
                                style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.white),
                                child: const Text('Thử lại'),
                              ),
                            ],
                          ),
                        ),
                      )
                    : _messages.isEmpty
                        ? const Center(
                            child: Text(
                              'Hãy gửi lời chào đến gian hàng!',
                              style: TextStyle(color: AppColors.textSecondary, fontSize: 13.5),
                            ),
                          )
                        : ListView.builder(
                            controller: _scrollCtrl,
                            padding: const EdgeInsets.all(14),
                            itemCount: _messages.length,
                            itemBuilder: (_, i) {
                              final m = _messages[i];
                              final isMe = m.senderRole == 'buyer' ||
                                  (currentUserId != null && m.senderId == currentUserId);
                              return Align(
                                alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
                                child: Container(
                                  constraints: BoxConstraints(
                                    maxWidth: MediaQuery.of(context).size.width * 0.74,
                                  ),
                                  margin: const EdgeInsets.only(bottom: 10),
                                  padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 9),
                                  decoration: BoxDecoration(
                                    color: isMe ? AppColors.primary : AppColors.surface,
                                    borderRadius: BorderRadius.circular(14),
                                    border: isMe ? null : Border.all(color: AppColors.border),
                                  ),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        m.message,
                                        style: TextStyle(
                                          color: isMe ? Colors.white : AppColors.textPrimary,
                                          fontSize: 13.5,
                                          height: 1.35,
                                        ),
                                      ),
                                      if (m.createdAt != null && m.createdAt!.length >= 16) ...[
                                        const SizedBox(height: 4),
                                        Text(
                                          m.createdAt!.substring(11, 16),
                                          style: TextStyle(
                                            fontSize: 10,
                                            color: isMe ? Colors.white70 : AppColors.textSecondary,
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
          ),
          SafeArea(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: const BoxDecoration(
                color: AppColors.surface,
                border: Border(top: BorderSide(color: AppColors.border)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Container(
                      decoration: BoxDecoration(
                        color: AppColors.background,
                        borderRadius: BorderRadius.circular(22),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: TextField(
                        controller: _msgCtrl,
                        textInputAction: TextInputAction.send,
                        onSubmitted: (_) => _send(),
                        decoration: const InputDecoration(
                          hintText: 'Nhập tin nhắn cho gian hàng...',
                          hintStyle: TextStyle(fontSize: 13, color: AppColors.textSecondary),
                          border: InputBorder.none,
                          contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filled(
                    onPressed: _isSending ? null : _send,
                    style: IconButton.styleFrom(backgroundColor: AppColors.primary),
                    icon: _isSending
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                          )
                        : const Icon(Icons.send_rounded, color: Colors.white, size: 19),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

