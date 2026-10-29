import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shopnova/screens/main_screen.dart';
import 'package:shopnova/theme/app_theme.dart';

import 'package:shopnova/services/auth_service.dart';
import 'package:shopnova/services/cart_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
    ),
  );
  // Khôi phục đồng thời phiên đăng nhập và giỏ hàng trước khi khởi chạy giao diện
  await Future.wait([
    CartService().loadFromPrefs(),
    AuthService().restoreSession(),
  ]);
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
      home: const MainScreen(),
    );
  }
}
