import 'package:flutter/material.dart';
import 'services/auth_service.dart';
import 'screens/login_screen.dart';
import 'screens/admin_dashboard_screen.dart';
import 'theme/admin_theme.dart';

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
      theme: AdminTheme.lightTheme,
      home: AuthService().isAuthenticated
          ? const AdminDashboardScreen()
          : const LoginScreen(),
    );
  }
}
