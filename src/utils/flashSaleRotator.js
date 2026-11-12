/**
 * Bộ điều phối xoay tua sản phẩm Flash Sale theo thời gian thực và sự kiện ngày lễ kiểu Shopee (Web)
 */

export function getCurrentCampaign() {
  const now = new Date()
  const day = now.getDate()
  const month = now.getMonth() + 1

  // 1. Ngày Đôi (1.1, 2.2, ..., 11.11, 12.12)
  if (day === month || (day >= month - 1 && day <= month + 1 && month <= 12)) {
    return {
      title: `${month}.${month} SIÊU SALE`,
      subtitle: 'Đại tiệc ngày đôi · Săn deal hủy diệt',
      badge: 'ĐẠI LỄ',
      bonusDiscount: 10,
    }
  }

  // 2. Siêu Sale Giữa Tháng (14 - 16 hàng tháng)
  if (day >= 14 && day <= 16) {
    return {
      title: 'SALE GIỮA THÁNG',
      subtitle: 'Lương về rộn ràng · Săn sale nửa giá',
      badge: 'LƯƠNG VỀ',
      bonusDiscount: 8,
    }
  }

  // 3. Sale Cuối Tháng (25 - 28 hàng tháng)
  if (day >= 25 && day <= 28) {
    return {
      title: 'SALE CUỐI THÁNG',
      subtitle: 'Lương đã về · Xả kho sập giá sàn',
      badge: 'XẢ KHO',
      bonusDiscount: 7,
    }
  }

  // 4. Cuối tuần
  const weekday = now.getDay()
  if (weekday === 0 || weekday === 6) {
    return {
      title: 'SIÊU SALE CUỐI TUẦN',
      subtitle: 'Cuối tuần thảnh thơi · Săn deal chớp nhoáng',
      badge: 'WEEKEND',
      bonusDiscount: 5,
    }
  }

  // 5. Ngày thường
  return {
    title: 'GIỜ VÀNG GIÁ SỐC',
    subtitle: 'Xoay tua sản phẩm mới mỗi 2 giờ',
    badge: 'CHỚP NHOÁNG',
    bonusDiscount: 0,
  }
}

export function getSessionLabel() {
  const hour = new Date().getHours()
  const start = Math.floor(hour / 2) * 2
  const end = start + 2
  const startStr = String(start).padStart(2, '0')
  const endStr = String(end % 24).padStart(2, '0')

  const slotNames = {
    0: 'Đêm Cuồng Nhiệt',
    2: 'Săn Deal Nửa Đêm',
    4: 'Bình Minh Đón Deal',
    6: 'Khởi Đầu Ngày Mới',
    8: 'Hàng Hiệu Buổi Sáng',
    10: 'Giờ Vàng Giá Rẻ',
    12: 'Nửa Ngày Săn Sale',
    14: 'Deal Chớp Nhoáng',
    16: 'Giờ Vàng Công Nghệ',
    18: 'Top Deal Bán Chạy',
    20: 'Đại Tiệc Tối Siêu Giảm',
    22: 'Xả Kho Cuối Ngày',
  }

  const title = slotNames[start] || 'Deal Chớp Nhoáng'
  return `${startStr}:00 - ${endStr}:00 · ${title}`
}

export function rotateFlashProducts(products = [], count = 6) {
  if (!Array.isArray(products) || !products.length) return []

  const validProducts = products.filter((p) => {
    const name = (p.name || '').toLowerCase()
    return !name.includes('lỗi') && !name.includes('test seller') && !name.includes('ao test') && Number(p.price) > 0
  })

  if (!validProducts.length) return products.slice(0, count)

  const now = new Date()
  const daySeed = now.getFullYear() * 372 + (now.getMonth() + 1) * 31 + now.getDate()
  const slot = Math.floor(now.getHours() / 2)
  const sessionSeed = daySeed * 12 + slot

  const offset = sessionSeed % validProducts.length
  const selected = []
  const usedCats = new Set()

  for (let i = 0; i < validProducts.length; i++) {
    const p = validProducts[(offset + i) % validProducts.length]
    const cat = p.categoryId || p.category || p.categoryName || 'general'
    if (!usedCats.has(cat) || usedCats.size >= 5) {
      selected.push(p)
      usedCats.add(cat)
      if (selected.length >= count) break
    }
  }

  if (selected.length < count) {
    for (let i = 0; i < validProducts.length && selected.length < count; i++) {
      const p = validProducts[(offset + i) % validProducts.length]
      if (!selected.some((s) => s.id === p.id)) {
        selected.push(p)
      }
    }
  }

  const campaign = getCurrentCampaign()

  return selected.map((p, idx) => {
    // 1. Xác định giá gốc (originalPrice) chuẩn của sản phẩm
    const rawPrice = Number(p.price) || 0
    const rawOriginalPrice = Number(p.originalPrice) || 0
    const originalPrice = rawOriginalPrice > rawPrice ? rawOriginalPrice : rawPrice

    // 2. Xác định % giảm giá Flash Sale mục tiêu (25% - 75%)
    let targetDiscount = Number(p.discount) || 0
    if (targetDiscount < 25) {
      targetDiscount = 30 + ((idx * 7 + slot * 3) % 35)
    }
    targetDiscount = Math.min(75, Math.max(25, targetDiscount + campaign.bonusDiscount))

    // 3. Tính giá đã giảm Flash Sale: làm tròn đến hàng nghìn (1.000₫) cho đúng thực tế mua sắm
    let flashPrice = Math.round((originalPrice * (1 - targetDiscount / 100)) / 1000) * 1000
    if (flashPrice >= originalPrice && originalPrice > 10000) {
      flashPrice = originalPrice - 10000
    } else if (flashPrice <= 0) {
      flashPrice = Math.max(1000, Math.round(originalPrice * 0.5))
    }

    // 4. Tính % giảm thực tế từ 2 mức giá để đảm bảo giá gốc, giá giảm và % khớp tuyệt đối
    const exactDiscount = Math.round(((originalPrice - flashPrice) / originalPrice) * 100)

    // 5. Tiến độ bán hàng: nếu sản phẩm chưa có thì mô phỏng tỷ lệ bán tự nhiên
    let soldPercent = Number(p.soldPercent) || 0
    if (soldPercent === 0) {
      const simulated = (idx * 23 + slot * 17) % 85
      soldPercent = idx % 2 === 0 ? 0 : Math.max(8, simulated)
    }

    const variants = (p.variants && p.variants.length > 0)
      ? p.variants.map((v) => {
          const vRaw = Number(v.price) || originalPrice
          const vOrig = Number(v.originalPrice) > vRaw ? Number(v.originalPrice) : vRaw
          const vFlash = Math.round((vOrig * (1 - exactDiscount / 100)) / 1000) * 1000
          return {
            ...v,
            price: vFlash,
            originalPrice: vOrig,
          }
        })
      : [{
          id: `sku_flash_${p.id}`,
          name: 'Mặc định',
          price: flashPrice,
          originalPrice,
          stock: Number(p.stock) || 50,
        }]

    return {
      ...p,
      price: flashPrice,
      originalPrice,
      discount: exactDiscount,
      soldPercent,
      flash: true,
      is_flash_sale: true,
      variants,
    }
  })
}

