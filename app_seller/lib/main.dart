import 'package:flutter/material.dart';
import 'services/auth_service.dart';
import 'screens/login_screen.dart';
import 'screens/seller_main_screen.dart';

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
      title: 'ShopNova Seller',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF00796B)),
        useMaterial3: true,
        scaffoldBackgroundColor: const Color(0xFFF4F6F8),
      ),
      home: AuthService().isAuthenticated
          ? const SellerMainScreen()
          : const LoginScreen(),
    );
  }
}
