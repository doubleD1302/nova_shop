import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shopnova/screens/main_screen.dart';
import 'package:shopnova/theme/app_theme.dart';

import 'package:shopnova/services/cart_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
    ),
  );
  await CartService().loadFromPrefs();
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
