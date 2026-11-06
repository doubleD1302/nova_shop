import 'package:flutter/material.dart';
import 'services/auth_service.dart';
import 'screens/login_screen.dart';
import 'screens/admin_dashboard_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await AuthService().restoreSession();
  runApp(const ShopNovaAdminApp());
}

class ShopNovaAdminApp extends StatelessWidget {
  const ShopNovaAdminApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ShopNova Admin',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFFC62828)),
        useMaterial3: true,
        scaffoldBackgroundColor: const Color(0xFFF4F6F8),
      ),
      home: AuthService().isAuthenticated
          ? const AdminDashboardScreen()
          : const LoginScreen(),
    );
  }
}
