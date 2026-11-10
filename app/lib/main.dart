import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shopnova/screens/admin/admin_screen.dart';
import 'package:shopnova/screens/main_screen.dart';
import 'package:shopnova/screens/seller/seller_hub_screen.dart';
import 'package:shopnova/theme/app_theme.dart';

import 'package:shopnova/services/auth_service.dart';
import 'package:shopnova/config/api_config.dart';
import 'package:shopnova/services/cart_service.dart';
import 'package:shopnova/services/portal_controller.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
    ),
  );
  // Dò tìm Base URL và khôi phục đồng thời phiên đăng nhập và giỏ hàng trước khi khởi chạy giao diện
  await Future.wait([
    ApiConfig.autoDetectBaseUrl(),
    CartService().loadFromPrefs(),
    AuthService().restoreSession(),
  ]);
  PortalController().syncFromAuth(forceResetToRole: true);
  runApp(const ShopNovaApp());
}

class ShopNovaApp extends StatelessWidget {
  const ShopNovaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ShopNova',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      home: const AppRootScreen(),
    );
  }
}

/// Điều phối không gian làm việc gốc theo vai trò tài khoản (giống 100% cơ chế Route Website):
/// - buyer / guest -> App Mua sắm (MainScreen)
/// - seller -> Kênh Người Bán độc lập (SellerHubScreen)
/// - admin -> Cổng Quản Trị Hệ Thống độc lập (AdminScreen)
class AppRootScreen extends StatelessWidget {
  const AppRootScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final portal = PortalController();
    return AnimatedBuilder(
      animation: portal,
      builder: (context, _) {
        switch (portal.mode) {
          case PortalMode.admin:
            return const AdminScreen();
          case PortalMode.seller:
            return const SellerHubScreen();
          case PortalMode.buyer:
            return const MainScreen();
        }
      },
    );
  }
}
