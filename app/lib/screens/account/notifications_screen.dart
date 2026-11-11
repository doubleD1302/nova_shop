import 'package:flutter/material.dart';
import '../../services/auth_service.dart';
import '../../services/notification_service.dart';
import '../../theme/app_colors.dart';
import '../auth/login_screen.dart' as shopnova_auth;

/// Màn hình Hộp Thư Thông Báo (GET / PATCH /api/v1/notifications)
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  final NotificationService _service = NotificationService();
  List<NotificationItem> _items = [];
  int _unreadCount = 0;
  bool _isLoading = true;
  bool? _isReadFilter;
  String? _typeFilter;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (!AuthService().isAuthenticated) {
      if (mounted) setState(() => _isLoading = false);
      return;
    }
    setState(() => _isLoading = true);
    final page = await _service.fetchNotifications(
      page: 1,
      limit: 50,
      isRead: _isReadFilter,
      type: _typeFilter,
    );
    if (mounted) {
      setState(() {
        _items = page.items;
        _unreadCount = page.unreadCount;
        _isLoading = false;
      });
    }
  }

  Future<void> _markAllRead() async {
    final ok = await _service.markAllAsRead();
    if (!mounted) return;
    if (ok) {
      setState(() {
        _unreadCount = 0;
        _items = _items.map((e) => e.copyWith(isRead: true)).toList();
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Đã đánh dấu tất cả thông báo là đã đọc.')),
      );
    }
  }

  Future<void> _openNotification(NotificationItem item) async {
    if (!item.isRead) {
      final ok = await _service.markAsRead(item.id);
      if (ok && mounted) {
        setState(() {
          if (_unreadCount > 0) _unreadCount--;
          final idx = _items.indexWhere((e) => e.id == item.id);
          if (idx >= 0) _items[idx] = _items[idx].copyWith(isRead: true);
        });
      }
    }
    if (!mounted) return;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(item.title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(item.content, style: const TextStyle(fontSize: 13.5, height: 1.45)),
            if (item.createdAt.isNotEmpty) ...[
              const SizedBox(height: 10),
              Text(
                item.createdAt.length >= 16
                    ? item.createdAt.substring(0, 16).replaceAll('T', ' ')
                    : item.createdAt,
                style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
              ),
            ],
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Đóng'),
          ),
        ],
      ),
    );
  }

  IconData _iconForType(String type) {
    switch (type.toLowerCase()) {
      case 'order':
        return Icons.local_shipping_outlined;
      case 'chat':
        return Icons.chat_bubble_outline_rounded;
      case 'return':
        return Icons.assignment_return_outlined;
      case 'promo':
      case 'marketing':
        return Icons.local_offer_outlined;
      default:
        return Icons.notifications_active_outlined;
    }
  }

  @override
  Widget build(BuildContext context) {
    final loggedIn = AuthService().isAuthenticated;

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
        title: Text(
          _unreadCount > 0 ? 'Thông Báo ($_unreadCount mới)' : 'Thông Báo',
          style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w700, fontSize: 17),
        ),
        actions: [
          if (loggedIn && _items.isNotEmpty)
            TextButton(
              onPressed: _markAllRead,
              child: const Text('Đọc tất cả', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.w700, fontSize: 12.5)),
            ),
        ],
      ),
      body: !loggedIn
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.notifications_off_outlined, size: 56, color: AppColors.textSecondary),
                    const SizedBox(height: 12),
                    const Text('Đăng nhập để xem thông báo đơn hàng và tin nhắn mới nhất.', textAlign: TextAlign.center, style: TextStyle(color: AppColors.textSecondary)),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      onPressed: () async {
                        await Navigator.push(context, MaterialPageRoute(builder: (_) => const shopnova_auth.LoginScreen()));
                        _load();
                      },
                      style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.white),
                      child: const Text('Đăng Nhập Ngay'),
                    ),
                  ],
                ),
              ),
            )
          : Column(
              children: [
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  child: Row(
                    children: [
                      _buildFilterChip('Tất cả', _isReadFilter == null && _typeFilter == null, () {
                        setState(() {
                          _isReadFilter = null;
                          _typeFilter = null;
                        });
                        _load();
                      }),
                      _buildFilterChip('Chưa đọc', _isReadFilter == false, () {
                        setState(() {
                          _isReadFilter = false;
                          _typeFilter = null;
                        });
                        _load();
                      }),
                      _buildFilterChip('Đơn hàng', _typeFilter == 'order', () {
                        setState(() {
                          _isReadFilter = null;
                          _typeFilter = 'order';
                        });
                        _load();
                      }),
                      _buildFilterChip('Tin nhắn', _typeFilter == 'chat', () {
                        setState(() {
                          _isReadFilter = null;
                          _typeFilter = 'chat';
                        });
                        _load();
                      }),
                      _buildFilterChip('Trả hàng', _typeFilter == 'return', () {
                        setState(() {
                          _isReadFilter = null;
                          _typeFilter = 'return';
                        });
                        _load();
                      }),
                    ],
                  ),
                ),
                Expanded(
                  child: _isLoading
                      ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                      : RefreshIndicator(
                          onRefresh: _load,
                          color: AppColors.primary,
                          child: _items.isEmpty
                              ? ListView(
                                  children: const [
                                    SizedBox(height: 90),
                                    Icon(Icons.notifications_none_rounded, size: 56, color: AppColors.textSecondary),
                                    SizedBox(height: 12),
                                    Center(
                                      child: Text(
                                        'Chưa có thông báo nào phù hợp.',
                                        style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
                                      ),
                                    ),
                                  ],
                                )
                              : ListView.separated(
                                  padding: const EdgeInsets.fromLTRB(12, 4, 12, 20),
                                  itemCount: _items.length,
                                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                                  itemBuilder: (_, i) {
                                    final item = _items[i];
                                    return InkWell(
                                      borderRadius: BorderRadius.circular(12),
                                      onTap: () => _openNotification(item),
                                      child: Container(
                                        padding: const EdgeInsets.all(14),
                                        decoration: BoxDecoration(
                                          color: item.isRead ? AppColors.surface : AppColors.surfaceAlt.withValues(alpha: 0.75),
                                          borderRadius: BorderRadius.circular(12),
                                          border: Border.all(
                                            color: item.isRead ? AppColors.border : AppColors.primary.withValues(alpha: 0.35),
                                          ),
                                        ),
                                        child: Row(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Container(
                                              padding: const EdgeInsets.all(9),
                                              decoration: BoxDecoration(
                                                color: item.isRead ? AppColors.background : AppColors.primary.withValues(alpha: 0.12),
                                                shape: BoxShape.circle,
                                              ),
                                              child: Icon(
                                                _iconForType(item.type),
                                                color: item.isRead ? AppColors.textSecondary : AppColors.primary,
                                                size: 20,
                                              ),
                                            ),
                                            const SizedBox(width: 12),
                                            Expanded(
                                              child: Column(
                                                crossAxisAlignment: CrossAxisAlignment.start,
                                                children: [
                                                  Row(
                                                    children: [
                                                      Expanded(
                                                        child: Text(
                                                          item.title,
                                                          style: TextStyle(
                                                            fontWeight: item.isRead ? FontWeight.w600 : FontWeight.w800,
                                                            fontSize: 13.5,
                                                            color: AppColors.textPrimary,
                                                          ),
                                                        ),
                                                      ),
                                                      if (!item.isRead)
                                                        Container(
                                                          width: 8,
                                                          height: 8,
                                                          decoration: const BoxDecoration(
                                                            color: AppColors.primary,
                                                            shape: BoxShape.circle,
                                                          ),
                                                        ),
                                                    ],
                                                  ),
                                                  const SizedBox(height: 4),
                                                  Text(
                                                    item.content,
                                                    maxLines: 3,
                                                    overflow: TextOverflow.ellipsis,
                                                    style: const TextStyle(color: AppColors.textSecondary, fontSize: 12.5, height: 1.35),
                                                  ),
                                                  const SizedBox(height: 6),
                                                  Text(
                                                    item.createdAt.length >= 16
                                                        ? item.createdAt.substring(0, 16).replaceAll('T', ' ')
                                                        : item.createdAt,
                                                    style: const TextStyle(color: AppColors.textSecondary, fontSize: 11),
                                                  ),
                                                ],
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    );
                                  },
                                ),
                        ),
                ),
              ],
            ),
    );
  }

  Widget _buildFilterChip(String label, bool selected, VoidCallback onTap) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        label: Text(label, style: TextStyle(fontSize: 12, fontWeight: selected ? FontWeight.bold : FontWeight.w500, color: selected ? Colors.white : AppColors.textPrimary)),
        selected: selected,
        selectedColor: AppColors.primary,
        backgroundColor: AppColors.surface,
        side: BorderSide(color: selected ? AppColors.primary : AppColors.border),
        onSelected: (_) => onTap(),
      ),
    );
  }
}

