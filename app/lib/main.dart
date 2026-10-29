import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shopnova/screens/main_screen.dart';
import 'package:shopnova/theme/app_theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
    ),
  );
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
