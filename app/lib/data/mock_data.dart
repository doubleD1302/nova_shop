import 'package:flutter/material.dart';
import 'package:shopnova/models/product.dart';
import 'package:shopnova/models/flash_sale_item.dart';
import 'package:shopnova/models/category_item.dart';
import 'package:shopnova/models/banner_item.dart';

class MockData {
  static const List<BannerItem> banners = [
    BannerItem(
      id: '1',
      title: 'Freeship Toàn Quốc',
      subtitle: 'Voucher giảm 50% & hoàn 100K...',
      backgroundColor: Color(0xFFEE4D2D),
      imageUrl: '',
    ),
    BannerItem(
      id: '2',
      title: 'Ưu Đãi Thành Viên',
      subtitle: 'Giảm thêm 20% cho đơn từ 200K',
      backgroundColor: Color(0xFF1A237E),
      imageUrl: '',
    ),
    BannerItem(
      id: '3',
      title: 'Deal Sốc Mỗi Ngày',
      subtitle: 'Flash Sale từ 1K - 12h hôm nay',
      backgroundColor: Color(0xFFE91E63),
      imageUrl: '',
    ),
  ];

  static final List<CategoryItem> categories = [
    CategoryItem(
      id: '1',
      name: 'Mã Giảm Giá',
      icon: Icons.confirmation_number_outlined,
    ),
    CategoryItem(
      id: '2',
      name: 'Flash Sale',
      icon: Icons.flash_on,
    ),
    CategoryItem(
      id: '3',
      name: 'Nova Mall',
      icon: Icons.store,
    ),
    CategoryItem(
      id: '4',
      name: 'Xu Thưởng',
      icon: Icons.monetization_on_outlined,
    ),
    CategoryItem(
      id: '5',
      name: 'Freeship Xtra',
      icon: Icons.local_shipping_outlined,
    ),
    CategoryItem(
      id: '6',
      name: 'Đồ Điện Tử',
      icon: Icons.phone_android,
    ),
    CategoryItem(
      id: '7',
      name: 'Quốc Tế',
      icon: Icons.public,
    ),
    CategoryItem(
      id: '8',
      name: 'Nạp Xu 100%',
      icon: Icons.account_balance_wallet_outlined,
    ),
  ];

  static const List<FlashSaleItem> flashSaleItems = [
    FlashSaleItem(
      id: '1',
      name: 'Tai nghe Bluetooth',
      price: 289000,
      discount: 48,
      soldPercentage: 0.85,
      soldLabel: 'SẮP CHÁY HÀNG',
      imageUrl: '',
    ),
    FlashSaleItem(
      id: '2',
      name: 'Loa không dây',
      price: 499000,
      discount: 62,
      soldPercentage: 0.70,
      soldLabel: 'ĐANG BÁN CHẠY',
      imageUrl: '',
    ),
    FlashSaleItem(
      id: '3',
      name: 'Bàn phím cơ',
      price: 145000,
      discount: 35,
      soldPercentage: 0.45,
      soldLabel: 'ĐÃ BÁN',
      imageUrl: '',
    ),
    FlashSaleItem(
      id: '4',
      name: 'Chuột gaming',
      price: 199000,
      discount: 55,
      soldPercentage: 0.60,
      soldLabel: 'ĐANG BÁN CHẠY',
      imageUrl: '',
    ),
    FlashSaleItem(
      id: '5',
      name: 'Ốp điện thoại',
      price: 39000,
      discount: 70,
      soldPercentage: 0.90,
      soldLabel: 'SẮP CHÁY HÀNG',
      imageUrl: '',
    ),
  ];

  static const List<Product> suggestedProducts = [
    Product(
      id: '1',
      name: 'Áo thun cotton Unisex form rộng tròn thoáng...',
      price: 99000,
      originalPrice: 189000,
      discount: 0,
      rating: 4.9,
      soldCount: 'Đã bán 3.4k',
      badges: ['YÊU THÍCH+', 'Freeship Xtra'],
      imageUrl: '',
    ),
    Product(
      id: '2',
      name: 'Son kem lì mềm mịn mỏi lâu trôi màu đỏ cam đất...',
      price: 168000,
      originalPrice: 259000,
      discount: 35,
      rating: 4.8,
      soldCount: 'Đã bán 8.2k',
      badges: ['MALL', 'Freeship Xtra'],
      imageUrl: '',
    ),
    Product(
      id: '3',
      name: 'Sạc dự phòng 20000mAh sạc nhanh 22.5W chuẩn...',
      price: 329000,
      originalPrice: 650000,
      discount: 0,
      rating: 5.0,
      soldCount: 'Đã bán 1.1k',
      badges: ['MALL'],
      imageUrl: '',
    ),
    Product(
      id: '4',
      name: 'Túi vải Canvas đeo vai cỡ lớn đựng vừa laptop di...',
      price: 75000,
      originalPrice: 100000,
      discount: 25,
      rating: 4.7,
      soldCount: 'Đã bán 5.9k',
      badges: ['YÊU THÍCH+', 'Freeship Xtra'],
      imageUrl: '',
    ),
    Product(
      id: '5',
      name: 'Quần short nam thể thao dáng rộng thoải mái...',
      price: 89000,
      originalPrice: 150000,
      discount: 41,
      rating: 4.6,
      soldCount: 'Đã bán 2.3k',
      badges: ['YÊU THÍCH+', 'Freeship Xtra'],
      imageUrl: '',
    ),
    Product(
      id: '6',
      name: 'Bộ 10 khẩu trang y tế 4 lớp kháng khuẩn...',
      price: 25000,
      originalPrice: 50000,
      discount: 50,
      rating: 4.5,
      soldCount: 'Đã bán 15k',
      badges: ['MALL', 'Freeship Xtra'],
      imageUrl: '',
    ),
  ];
}
