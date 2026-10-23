import 'package:flutter/material.dart';

/// Bộ phân giải hình ảnh sản phẩm thực tế cho ShopNova.
/// Đảm bảo mọi sản phẩm từ WebsiteData, Backend API MySQL hoặc Mock
/// đều luôn có hình ảnh chụp thật sắc nét, chuyên nghiệp, chuẩn sàn thương mại điện tử.
class ProductImageResolver {
  static const Map<String, String> _productImages = {
    'p01': 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80',
    'p02': 'https://images.unsplash.com/photo-1518640467707-6811f4a6ab73?auto=format&fit=crop&w=600&q=80',
    'p03': 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=600&q=80',
    'p04': 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=600&q=80',
    'p05': 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80',
    'p06': 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=600&q=80',
    'p07': 'https://images.unsplash.com/photo-1588508065123-287b28e013da?auto=format&fit=crop&w=600&q=80',
    'p08': 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?auto=format&fit=crop&w=600&q=80',
    'p09': 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80',
    'p10': 'https://images.unsplash.com/photo-1608248597359-53e77f0a8c2f?auto=format&fit=crop&w=600&q=80',
    'p11': 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=600&q=80',
    'p12': 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=600&q=80',
    'p13': 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=600&q=80',
    'p14': 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=600&q=80',
    'p15': 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=600&q=80',
    'p16': 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=600&q=80',
    'p17': 'https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?auto=format&fit=crop&w=600&q=80',
    'p18': 'https://images.unsplash.com/photo-1584990347449-397a61be6b8e?auto=format&fit=crop&w=600&q=80',
    'p19': 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=600&q=80',
    'p20': 'https://images.unsplash.com/photo-1622445262464-84b14e32452e?auto=format&fit=crop&w=600&q=80',
    'p21': 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=600&q=80',
    'p22': 'https://images.unsplash.com/photo-1594213114663-dd9f85c490a6?auto=format&fit=crop&w=600&q=80',
    'p23': 'https://images.unsplash.com/photo-1603487742131-4160ec999306?auto=format&fit=crop&w=600&q=80',
    'p24': 'https://images.unsplash.com/photo-1511707171634-5f897ff02560?auto=format&fit=crop&w=600&q=80',
    'p25': 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=600&q=80',
    'p26': 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=600&q=80',
    'p27': 'https://images.unsplash.com/photo-1599669454699-248893623440?auto=format&fit=crop&w=600&q=80',
    'p28': 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=600&q=80',
    'p29': 'https://images.unsplash.com/photo-1618556450994-a6a128ef0d9d?auto=format&fit=crop&w=600&q=80',
    'p30': 'https://images.unsplash.com/photo-1622445262464-84b14e32452e?auto=format&fit=crop&w=600&q=80',
    'p31': 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=600&q=80',
    'p32': 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=600&q=80',
    'p33': 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=600&q=80',
    'p34': 'https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=600&q=80',
    'p35': 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=600&q=80',
    'p36': 'https://images.unsplash.com/photo-1556228722-d0b5d5b7db5b?auto=format&fit=crop&w=600&q=80',
    'p37': 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=600&q=80',
    'p38': 'https://images.unsplash.com/photo-1558317374-067fb5f30001?auto=format&fit=crop&w=600&q=80',
    'p39': 'https://images.unsplash.com/photo-1585515320310-259814833e62?auto=format&fit=crop&w=600&q=80',
    'p40': 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?auto=format&fit=crop&w=600&q=80',
    'p41': 'https://images.unsplash.com/photo-1584990347449-397a61be6b8e?auto=format&fit=crop&w=600&q=80',
    'p42': 'https://images.unsplash.com/photo-1593618998160-e34014e67546?auto=format&fit=crop&w=600&q=80',
    'p43': 'https://images.unsplash.com/photo-1594026112284-02bb6f3352fe?auto=format&fit=crop&w=600&q=80',
    'p44': 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=600&q=80',
    'p45': 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=600&q=80',
    'p46': 'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=600&q=80',
    'p47': 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=600&q=80',
    'p48': 'https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=600&q=80',
    'p49': 'https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&w=600&q=80',
    'p50': 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=600&q=80',
    'p51': 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=600&q=80',
    'p52': 'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?auto=format&fit=crop&w=600&q=80',
    'p53': 'https://images.unsplash.com/photo-1600121848594-d8644e57abab?auto=format&fit=crop&w=600&q=80',
    'p54': 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?auto=format&fit=crop&w=600&q=80',
    'p55': 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=600&q=80',
    'p56': 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=600&q=80',
    'p57': 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=600&q=80',
    'p58': 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?auto=format&fit=crop&w=600&q=80',
    'p59': 'https://images.unsplash.com/photo-1580481077111-96860d5b51c1?auto=format&fit=crop&w=600&q=80',
    'p60': 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?auto=format&fit=crop&w=600&q=80',
    'p61': 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=600&q=80',
    'p62': 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=600&q=80',
    'p63': 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=600&q=80',
  };

  static const Map<String, String> _categoryImages = {
    'thoi-trang-nam': 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=600&q=80',
    'thoi-trang-nu': 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=600&q=80',
    'dien-thoai': 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=600&q=80',
    'may-tinh': 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80',
    'thiet-bi-gia-dung': 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=600&q=80',
    'sac-dep': 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=600&q=80',
    'nha-cua': 'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?auto=format&fit=crop&w=600&q=80',
    'me-be': 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=600&q=80',
    'bach-hoa': 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80',
    'the-thao': 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=600&q=80',
    'o-to-xe-may': 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=600&q=80',
    'may-anh': 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=600&q=80',
  };

  /// Tra cứu hình ảnh thực tế chất lượng cao phù hợp nhất cho sản phẩm
  static String resolve({
    String? id,
    String? imageUrl,
    String? categoryId,
    String? name,
  }) {
    // 1. Nếu đã có URL ảnh hợp lệ bắt đầu bằng http/https
    if (imageUrl != null && imageUrl.trim().startsWith('http')) {
      return imageUrl.trim();
    }

    // 2. Tra theo mã định danh sản phẩm (p01 - p63)
    if (id != null && _productImages.containsKey(id)) {
      return _productImages[id]!;
    }

    // 3. Tra thông minh theo từ khóa trong tên sản phẩm
    final n = (name ?? '').toLowerCase();
    if (n.contains('tai nghe') || n.contains('headphone') || n.contains('earphone') || n.contains('sound pro')) {
      return 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80';
    }
    if (n.contains('robot') || n.contains('hút bụi') || n.contains('cleaner')) {
      return 'https://images.unsplash.com/photo-1518640467707-6811f4a6ab73?auto=format&fit=crop&w=600&q=80';
    }
    if (n.contains('bàn phím') || n.contains('keyboard') || n.contains('hotswap')) {
      return 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=600&q=80';
    }
    if (n.contains('sữa tắm') || n.contains('dưỡng') || n.contains('serum') || n.contains('kem') || n.contains('son') || n.contains('nước hoa') || n.contains('mỹ phẩm')) {
      return 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=600&q=80';
    }
    if (n.contains('giày') || n.contains('sneaker') || n.contains('dép')) {
      return 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80';
    }
    if (n.contains('sạc') || n.contains('cáp') || n.contains('pin dự phòng') || n.contains('gan 65w')) {
      return 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=600&q=80';
    }
    if (n.contains('chuột') || n.contains('mouse')) {
      return 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=600&q=80';
    }
    if (n.contains('màn hình') || n.contains('monitor')) {
      return 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=600&q=80';
    }
    if (n.contains('nồi') || n.contains('chảo') || n.contains('bếp') || n.contains('chiên không dầu')) {
      return 'https://images.unsplash.com/photo-1584990347449-397a61be6b8e?auto=format&fit=crop&w=600&q=80';
    }
    if (n.contains('quạt') || n.contains('lọc không khí')) {
      return 'https://images.unsplash.com/photo-1594026112284-02bb6f3352fe?auto=format&fit=crop&w=600&q=80';
    }
    if (n.contains('mũ bảo hiểm') || n.contains('xe máy') || n.contains('ô tô') || n.contains('bơm lốp')) {
      return 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=600&q=80';
    }
    if (n.contains('máy ảnh') || n.contains('camera') || n.contains('tripod')) {
      return 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=600&q=80';
    }
    if (n.contains('áo') || n.contains('polo') || n.contains('sơ mi') || n.contains('thun') || n.contains('hoodie')) {
      return 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=600&q=80';
    }
    if (n.contains('quần') || n.contains('jean') || n.contains('short') || n.contains('kaki')) {
      return 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=600&q=80';
    }
    if (n.contains('váy') || n.contains('đầm')) {
      return 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=600&q=80';
    }

    // 4. Tra theo danh mục ngành hàng
    final cat = (categoryId ?? '').toLowerCase();
    for (final entry in _categoryImages.entries) {
      if (cat.contains(entry.key)) return entry.value;
    }
    if (cat == '1') return _categoryImages['thoi-trang-nam']!;
    if (cat == '2') return _categoryImages['thoi-trang-nu']!;
    if (cat == '3') return _categoryImages['dien-thoai']!;
    if (cat == '4') return _categoryImages['may-tinh']!;
    if (cat == '5') return _categoryImages['thiet-bi-gia-dung']!;
    if (cat == '6') return _categoryImages['sac-dep']!;
    if (cat == '7') return _categoryImages['nha-cua']!;
    if (cat == '8') return _categoryImages['me-be']!;
    if (cat == '9') return _categoryImages['bach-hoa']!;
    if (cat == '10') return _categoryImages['the-thao']!;
    if (cat == '11') return _categoryImages['o-to-xe-may']!;
    if (cat == '12') return _categoryImages['may-anh']!;

    // 5. Ảnh mặc định tổng quan cực đẹp
    return 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80';
  }

  /// Ảnh mặc định cho từng danh mục
  static String getCategoryImage(String categorySlug) {
    return _categoryImages[categorySlug] ?? 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=600&q=80';
  }
}
