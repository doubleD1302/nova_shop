import 'package:flutter/material.dart';
import 'services/auth_service.dart';
import 'screens/login_screen.dart';
import 'screens/seller_main_screen.dart';
import 'theme/seller_theme.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await AuthService().restoreSession();
  runApp(const ShopNovaSellerApp());
}

class ShopNovaSellerApp extends StatelessWidget {
  const ShopNovaSellerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ShopNova Seller Centre',
      debugShowCheckedModeBanner: false,
      theme: SellerTheme.lightTheme,
      home: AuthService().isAuthenticated
          ? const SellerMainScreen()
          : const LoginScreen(),
    );
  }
}
