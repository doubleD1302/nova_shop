import fs from 'node:fs';
import path from 'node:path';

const PRODUCTS = [
  {
    name: 'Tai nghe Bluetooth Sony WH-1000XM4 Không dây Chống ồn Đỉnh cao',
    category: 'dien-thoai',
    price: 6490000,
    originalPrice: 8490000,
    stock: 25,
    description: 'Tai nghe chụp tai chống ồn đỉnh cao Sony WH-1000XM4 chính hãng. Bộ xử lý chống ồn HD QN1 chuyên biệt mang đến trải nghiệm âm thanh tĩnh lặng vượt trội. Thời lượng pin 30 giờ liên tục, công nghệ sạc nhanh 10 phút dùng 5 giờ. Cảm biến thông minh Speak-to-Chat tự động dừng nhạc khi người dùng cất giọng nói.',
    images: [
      'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80',
    ]
  },
  {
    name: 'Giày Sneaker Converse Chuck Taylor All Star Classic High Top Đen',
    category: 'giay-dep',
    price: 1650000,
    originalPrice: 1900000,
    stock: 40,
    description: 'Giày sneaker cổ cao Converse Chuck Taylor All Star kinh điển chất liệu vải canvas cao cấp thoáng khí, đế cao su lưu hóa chống trơn trượt tối đa. Logo tròn kinh điển in sắc nét bên hông cổ giày. Thiết kế phong cách thời trang vượt thời gian, dễ dàng phối hợp trang phục dạo phố.',
    images: [
      'https://images.unsplash.com/photo-1607522370275-f14206abe5d3?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1514989940723-e8e51635b782?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=800&q=80',
    ]
  },
  {
    name: 'Bình giữ nhiệt Stanley Classic Legendary Bottle 1.0L Thép không gỉ',
    category: 'nha-cua-doi-song',
    price: 1150000,
    originalPrice: 1350000,
    stock: 18,
    description: 'Bình giữ nhiệt chân không Stanley Classic Legendary Bottle dung tích 1.0 lít màu xanh Hammertone kinh điển. Chất liệu thép không gỉ 18/8 không chứa BPA an toàn sức khỏe. Cách nhiệt chân không hai lớp giữ nóng 24h và giữ lạnh 24h (giữ đá 120h). Nắp vặn tích hợp cốc uống nước tiện dụng dã ngoại.',
    images: [
      'https://images.unsplash.com/photo-1577937927133-66ef06acdf18?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1536939459926-301728717817?auto=format&fit=crop&w=800&q=80',
    ]
  },
  {
    name: 'Balo Fjallraven Kanken Classic 16L Chống Thấm Nước Thụy Điển',
    category: 'tui-xach',
    price: 2190000,
    originalPrice: 2450000,
    stock: 15,
    description: 'Balo Fjallraven Kanken Classic thiết kế Thụy Điển kinh điển từ năm 1978. Chất liệu vải Vinylon F độc quyền bền bỉ, nhẹ và chống thấm nước tự nhiên. Dung tích 16L vừa vặn laptop 13 inch cùng ngăn phụ hai bên hông. Logo tròn phản quang hình cáo Bắc Cực tăng độ an toàn khi di chuyển.',
    images: [
      'https://images.unsplash.com/photo-1546938576-6e6a64f317cc?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1581605405669-fcdf81165afa?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?auto=format&fit=crop&w=800&q=80',
    ]
  },
  {
    name: 'Tinh chất Dưỡng Ẩm và Phục Hồi Da Chuyên Sâu Tự Nhiên 50ml',
    category: 'my-pham',
    price: 345000,
    originalPrice: 420000,
    stock: 35,
    description: 'Serum tinh chất dưỡng ẩm phục hồi da với chiết xuất thực vật hữu cơ cùng Hyaluronic Acid đa phân tử và Vitamin B5. Thẩm thấu nhanh không nhờn rít, cấp ẩm tức thì và củng cố hàng rào bảo vệ da tự nhiên. 100% thuần chay, không cồn, không hương liệu nhân tạo.',
    images: [
      'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1601049541289-9b1b7bbbfe19?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1617897903246-719242758050?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=800&q=80',
    ]
  },
  {
    name: 'Áo Thun Nam Cổ Tròn 100% Cotton Supima Thoáng Khí',
    category: 'thoi-trang-nam',
    price: 299000,
    originalPrice: 350000,
    stock: 60,
    description: 'Áo thun nam basic cổ tròn dệt từ 100% sợi bông Supima cao cấp với độ bền vượt trội và cảm giác mềm mại tối đa trên da. Form áo suông Regular Fit thoải mái vận động, bo cổ dệt tinh tế không bị bai dão sau nhiều lần giặt. Thấm hút mồ hôi tối ưu cho khí hậu nhiệt đới.',
    images: [
      'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1562157873-818bc0726f68?auto=format&fit=crop&w=800&q=80',
    ]
  }
];

async function downloadImages() {
  const downloadDir = path.resolve('d:/download/nova_shop-main/nova_shop-main/product_images_cache');
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  }

  for (let pIdx = 0; pIdx < PRODUCTS.length; pIdx++) {
    const prod = PRODUCTS[pIdx];
    prod.localFiles = [];
    console.log(`Downloading images for: ${prod.name}`);
    for (let iIdx = 0; iIdx < prod.images.length; iIdx++) {
      const url = prod.images[iIdx];
      const filename = `prod_${pIdx + 1}_img_${iIdx + 1}.jpg`;
      const filepath = path.join(downloadDir, filename);

      if (!fs.existsSync(filepath)) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
        const buffer = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(filepath, buffer);
        console.log(`  Saved ${filename} (${buffer.length} bytes)`);
      } else {
        console.log(`  Existing ${filename}`);
      }
      prod.localFiles.push(filepath);
    }
  }

  fs.writeFileSync('d:/download/nova_shop-main/nova_shop-main/products_to_add.json', JSON.stringify(PRODUCTS, null, 2), 'utf8');
  console.log('Finished downloading all real product images and wrote products_to_add.json');
}

downloadImages().catch(console.error);

