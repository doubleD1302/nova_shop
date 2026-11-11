import 'dart:async';
import 'package:flutter/material.dart';
import '../services/seller_feature_service.dart';
import '../theme/seller_theme.dart';

/// Màn hình Chăm Sóc Khách Hàng (Live Chat WebSocket) & Thông Báo Seller
class SellerChatNotificationsScreen extends StatefulWidget {
  final int initialTab;
  const SellerChatNotificationsScreen({super.key, this.initialTab = 0});

  @override
  State<SellerChatNotificationsScreen> createState() =>
      _SellerChatNotificationsScreenState();
}

class _SellerChatNotificationsScreenState
    extends State<SellerChatNotificationsScreen>
    with SingleTickerProviderStateMixin {
  final SellerFeatureService _service = SellerFeatureService();
  late TabController _tabCtrl;

  List<Map<String, dynamic>> _conversations = [];
  List<Map<String, dynamic>> _notifications = [];
  int _unreadCount = 0;
  bool _isLoading = true;
  StreamSubscription? _wsSub;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 2, vsync: this, initialIndex: widget.initialTab);
    _init();
  }

  Future<void> _init() async {
    await _load();
    await _service.connectSocket();
    _wsSub = _service.wsEvents.listen((ev) {
      if (ev['type'] == 'new_message' || ev['type'] == 'message_sent') {
        _load();
      }
    });
  }

  @override
  void dispose() {
    _wsSub?.cancel();
    _service.disconnectSocket();
    _tabCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _isLoading = true);
    final res = await Future.wait([
      _service.getConversations(),
      _service.getNotifications(),
    ]);
    if (mounted) {
      final convs = res[0] as List<Map<String, dynamic>>;
      final notifMap = res[1] as Map<String, dynamic>;
      setState(() {
        _conversations = convs;
        _notifications = (notifMap['items'] as List? ?? [])
            .whereType<Map<String, dynamic>>()
            .toList();
        _unreadCount = (notifMap['unreadCount'] as num?)?.toInt() ?? 0;
        _isLoading = false;
      });
    }
  }

  void _openConversation(Map<String, dynamic> conv) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => _SellerChatRoomScreen(conversation: conv),
      ),
    ).then((_) => _load());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: SellerTheme.background,
      appBar: AppBar(
        title: const Text('CSKH & Thông Báo', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17)),
        bottom: TabBar(
          controller: _tabCtrl,
          labelColor: SellerTheme.primary,
          unselectedLabelColor: SellerTheme.textSecondary,
          indicatorColor: SellerTheme.primary,
          tabs: [
            Tab(text: 'Tin nhắn (${_conversations.length})'),
            Tab(text: 'Thông báo ($_unreadCount)'),
          ],
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: SellerTheme.primary))
          : TabBarView(
              controller: _tabCtrl,
              children: [
                RefreshIndicator(
                  onRefresh: _load,
                  child: _conversations.isEmpty
                      ? ListView(children: const [SizedBox(height: 80), Center(child: Text('Chưa có khách hàng nhắn tin.'))])
                      : ListView.separated(
                          padding: const EdgeInsets.all(14),
                          itemCount: _conversations.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 8),
                          itemBuilder: (_, i) {
                            final c = _conversations[i];
                            final unread = (c['unreadCount'] as num?)?.toInt() ?? 0;
                            return ListTile(
                              onTap: () => _openConversation(c),
                              tileColor: SellerTheme.card,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: const BorderSide(color: SellerTheme.border)),
                              leading: const CircleAvatar(backgroundColor: SellerTheme.surfaceSubtle, child: Icon(Icons.person_outline, color: SellerTheme.primary)),
                              title: Text(c['buyerName']?.toString() ?? 'Khách hàng', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                              subtitle: Text(c['lastMessage']?.toString() ?? '...', maxLines: 1, overflow: TextOverflow.ellipsis),
                              trailing: unread > 0
                                  ? CircleAvatar(
                                      radius: 11,
                                      backgroundColor: SellerTheme.primary,
                                      child: Text('$unread', style: const TextStyle(color: Colors.white, fontSize: 11)),
                                    )
                                  : const Icon(Icons.chevron_right_rounded),
                            );
                          },
                        ),
                ),
                Column(
                  children: [
                    if (_notifications.isNotEmpty)
                      Align(
                        alignment: Alignment.centerRight,
                        child: TextButton(
                          onPressed: () async {
                            await _service.markAllNotificationsRead();
                            _load();
                          },
                          child: const Text('Đọc tất cả'),
                        ),
                      ),
                    Expanded(
                      child: RefreshIndicator(
                        onRefresh: _load,
                        child: _notifications.isEmpty
                            ? ListView(children: const [SizedBox(height: 80), Center(child: Text('Không có thông báo mới.'))])
                            : ListView.separated(
                                padding: const EdgeInsets.all(14),
                                itemCount: _notifications.length,
                                separatorBuilder: (_, __) => const SizedBox(height: 8),
                                itemBuilder: (_, i) {
                                  final n = _notifications[i];
                                  final isRead = n['isRead'] == true || n['isRead'] == 1;
                                  return ListTile(
                                    onTap: () async {
                                      if (!isRead) {
                                        await _service.markNotificationRead(n['id'].toString());
                                        _load();
                                      }
                                    },
                                    tileColor: isRead ? SellerTheme.card : SellerTheme.surfaceSubtle,
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: const BorderSide(color: SellerTheme.border)),
                                    title: Text(n['title']?.toString() ?? '', style: TextStyle(fontWeight: isRead ? FontWeight.w600 : FontWeight.bold, fontSize: 13.5)),
                                    subtitle: Text(n['content']?.toString() ?? '', style: const TextStyle(fontSize: 12)),
                                  );
                                },
                              ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
    );
  }
}

class _SellerChatRoomScreen extends StatefulWidget {
  final Map<String, dynamic> conversation;
  const _SellerChatRoomScreen({required this.conversation});

  @override
  State<_SellerChatRoomScreen> createState() => _SellerChatRoomScreenState();
}

class _SellerChatRoomScreenState extends State<_SellerChatRoomScreen> {
  final SellerFeatureService _service = SellerFeatureService();
  final TextEditingController _msgCtrl = TextEditingController();
  final ScrollController _scrollCtrl = ScrollController();

  List<Map<String, dynamic>> _messages = [];
  bool _loading = true;
  bool _sending = false;
  StreamSubscription? _wsSub;

  String get _convId => widget.conversation['id'].toString();

  @override
  void initState() {
    super.initState();
    _load();
    _wsSub = _service.wsEvents.listen((ev) {
      if ((ev['type'] == 'new_message' || ev['type'] == 'message_sent') &&
          ev['conversationId']?.toString() == _convId &&
          ev['message'] is Map) {
        final msg = Map<String, dynamic>.from(ev['message'] as Map);
        if (mounted && !_messages.any((m) => m['id']?.toString() == msg['id']?.toString())) {
          setState(() => _messages.add(msg));
          _scrollDown();
        }
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

  Future<void> _load() async {
    final list = await _service.getMessages(_convId);
    if (mounted) {
      setState(() {
        _messages = list;
        _loading = false;
      });
      _scrollDown();
    }
  }

  void _scrollDown() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollCtrl.hasClients) {
        _scrollCtrl.jumpTo(_scrollCtrl.position.maxScrollExtent);
      }
    });
  }

  Future<void> _send() async {
    final text = _msgCtrl.text.trim();
    if (text.isEmpty || _sending) return;
    setState(() => _sending = true);
    _msgCtrl.clear();
    final created = await _service.sendMessage(_convId, text);
    if (!mounted) return;
    setState(() => _sending = false);
    if (created != null) {
      if (!_messages.any((m) => m['id']?.toString() == created['id']?.toString())) {
        setState(() => _messages.add(created));
      }
      _scrollDown();
    } else {
      _msgCtrl.text = text;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: SellerTheme.background,
      appBar: AppBar(title: Text(widget.conversation['buyerName']?.toString() ?? 'Khách hàng')),
      body: Column(
        children: [
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : ListView.builder(
                    controller: _scrollCtrl,
                    padding: const EdgeInsets.all(14),
                    itemCount: _messages.length,
                    itemBuilder: (_, i) {
                      final m = _messages[i];
                      final isMe = m['senderRole']?.toString() == 'seller';
                      return Align(
                        alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
                        child: Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                          decoration: BoxDecoration(
                            color: isMe ? SellerTheme.primary : SellerTheme.card,
                            borderRadius: BorderRadius.circular(14),
                            border: isMe ? null : Border.all(color: SellerTheme.border),
                          ),
                          child: Text(
                            m['message']?.toString() ?? '',
                            style: TextStyle(color: isMe ? Colors.white : SellerTheme.textPrimary, fontSize: 13.5),
                          ),
                        ),
                      );
                    },
                  ),
          ),
          SafeArea(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              color: SellerTheme.card,
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _msgCtrl,
                      onSubmitted: (_) => _send(),
                      decoration: const InputDecoration(hintText: 'Trả lời khách hàng...', border: OutlineInputBorder(), isDense: true),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filled(onPressed: _sending ? null : _send, icon: const Icon(Icons.send_rounded)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

