import 'package:flutter/foundation.dart';
import 'auth_service.dart';

/// Chế độ giao diện hiện tại của ứng dụng thống nhất ShopNova.
/// Mô phỏng chính xác cơ chế phân luồng Route của Website (App.jsx & LoginPage.jsx):
/// - buyer: Trang Mua Sắm Người Mua (MainScreen)
/// - seller: Kênh Người Bán (SellerHubScreen)
/// - admin: Trang Quản Trị Hệ Thống (AdminScreen)
enum PortalMode { buyer, seller, admin }

class PortalController extends ChangeNotifier {
  static final PortalController _instance = PortalController._internal();
  factory PortalController() => _instance;

  PortalController._internal() {
    AuthService().addListener(_onAuthChanged);
    syncFromAuth(forceResetToRole: true);
  }

  PortalMode _mode = PortalMode.buyer;
  String? _lastUserId;
  String? _lastUserRole;

  PortalMode get mode => _mode;

  void _onAuthChanged() {
    syncFromAuth(forceResetToRole: false);
  }

  /// Đồng bộ giao diện gốc theo tài khoản hiện tại.
  /// Khi đăng nhập mới / chuyển tài khoản / đăng xuất -> tự động chuyển vào đúng cổng vai trò (giống LoginPage.jsx).
  void syncFromAuth({bool forceResetToRole = false}) {
    final auth = AuthService();
    final user = auth.currentUser;

    if (!auth.isAuthenticated || user == null) {
      final changed = _mode != PortalMode.buyer || _lastUserId != null || _lastUserRole != null;
      _mode = PortalMode.buyer;
      _lastUserId = null;
      _lastUserRole = null;
      if (changed) notifyListeners();
      return;
    }

    final userChanged = forceResetToRole || user.id != _lastUserId || user.role != _lastUserRole;
    _lastUserId = user.id;
    _lastUserRole = user.role;

    if (userChanged) {
      final target = _defaultModeForUser(user.role, user.shopId);
      if (_mode != target) {
        _mode = target;
      }
      notifyListeners();
    }
  }

  PortalMode _defaultModeForUser(String role, String? shopId) {
    if (role == 'admin') return PortalMode.admin;
    if (role == 'seller' || (shopId != null && shopId.isNotEmpty)) {
      return PortalMode.seller;
    }
    return PortalMode.buyer;
  }

  /// Chuyển về giao diện Mua sắm (giống "Về trang mua sắm" / "Về cửa hàng" trên Website)
  void switchToBuyer() {
    if (_mode != PortalMode.buyer) {
      _mode = PortalMode.buyer;
      notifyListeners();
    }
  }

  /// Chuyển sang Kênh Người Bán (giống link "/nguoi-ban" trên Website)
  void switchToSeller() {
    final user = AuthService().currentUser;
    if (user != null && (user.isSeller || user.isAdmin || (user.shopId != null && user.shopId!.isNotEmpty))) {
      if (_mode != PortalMode.seller) {
        _mode = PortalMode.seller;
        notifyListeners();
      }
    }
  }

  /// Chuyển sang Trang Quản Trị (giống link "/admin" trên Website)
  void switchToAdmin() {
    final user = AuthService().currentUser;
    if (user != null && user.isAdmin) {
      if (_mode != PortalMode.admin) {
        _mode = PortalMode.admin;
        notifyListeners();
      }
    }
  }
}
