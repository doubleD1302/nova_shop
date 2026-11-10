import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const dbPath = path.join(rootDir, 'data-api', 'data', 'shopnova_local.sqlite')

if (!fs.existsSync(dbPath)) {
  console.error(`Không tìm thấy database tại: ${dbPath}`);
  process.exit(1);
}

const db = new DatabaseSync(dbPath)

async function syncCloudToLocal() {
  console.log('[Sync] Đang tải danh mục, gian hàng và sản phẩm từ Cloud Render...')

  const baseUrl = 'https://novashop-api-952u.onrender.com'
  const [catsRes, shopsRes, prodsRes] = await Promise.all([
    fetch(`${baseUrl}/api/v1/categories`).then(r => r.json()),
    fetch(`${baseUrl}/api/v1/shops`).then(r => r.json()),
    fetch(`${baseUrl}/api/v1/products?limit=100`).then(r => r.json()),
  ])

  const categories = catsRes.data?.categories || []
  const shops = shopsRes.data?.shops || []
  const products = prodsRes.data?.products || []

  console.log(`[Sync] Đã nhận: ${categories.length} danh mục, ${shops.length} gian hàng, ${products.length} sản phẩm từ Cloud.`)

  // 1. Cập nhật Categories
  const catStmt = db.prepare(`
    INSERT OR REPLACE INTO categories (id, slug, name, sort_order)
    VALUES (?, ?, ?, ?)
  `)
  for (let i = 0; i < categories.length; i++) {
    const c = categories[i]
    catStmt.run(i + 1, c.slug || c.id, c.name, i + 1)
  }

  // 2. Cập nhật Shop Owners & Shops
  const userStmt = db.prepare(`
    INSERT OR IGNORE INTO users (id, username, password_hash, full_name, email, role, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  const shopStmt = db.prepare(`
    INSERT OR REPLACE INTO shops (id, owner_id, slug, name, tagline, description, province, status, is_mall)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  for (const s of shops) {
    const shopId = Number(s.id) || 1
    const ownerId = Number(s.ownerId) || 2
    userStmt.run(
      ownerId,
      `owner_${ownerId}`,
      '$2b$10$dummyhashnotusedforlogininlocaldemo1234567890',
      s.ownerName || s.name,
      `owner_${ownerId}@shopnova.local`,
      'seller',
      'active'
    )
    shopStmt.run(
      shopId,
      ownerId,
      s.slug,
      s.name,
      s.tagline || '',
      s.description || '',
      s.location || 'TP. Hồ Chí Minh',
      s.status || 'active',
      s.mall ? 1 : 0
    )
  }

  // 3. Cập nhật Products, Variants, Images
  const prodStmt = db.prepare(`
    INSERT OR REPLACE INTO products (
      id, shop_id, category_id, slug, name, description, specs, badges,
      status, is_featured, is_flash_sale, free_shipping, approval_status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const variantStmt = db.prepare(`
    INSERT OR REPLACE INTO product_variants (
      id, product_id, sku, variant_key, name, attributes, price, original_price, stock_qty
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const delImgStmt = db.prepare(`DELETE FROM product_images WHERE product_id = ?`)
  const imgStmt = db.prepare(`
    INSERT INTO product_images (product_id, url, sort_order, is_primary)
    VALUES (?, ?, ?, ?)
  `)

  // Ánh xạ slug category sang id
  const catMap = new Map()
  for (let i = 0; i < categories.length; i++) {
    catMap.set(categories[i].id, i + 1)
    catMap.set(categories[i].slug, i + 1)
  }

  for (const p of products) {
    const prodId = Number(p.id)
    const shopId = Number(p.shopId) || 1
    const catId = catMap.get(p.categoryId) || 1
    const price = Number(p.price) || 100000
    const origPrice = p.originalPrice ? Number(p.originalPrice) : price * 1.2

    prodStmt.run(
      prodId,
      shopId,
      catId,
      p.slug || `prod-${prodId}`,
      p.name,
      p.description || '',
      JSON.stringify(p.specs || {}),
      JSON.stringify(p.badges || []),
      'active',
      p.featured ? 1 : 0,
      p.flash ? 1 : 0,
      p.freeship ? 1 : 0,
      'approved',
      p.createdAt || new Date().toISOString()
    )

    // Variant
    variantStmt.run(
      prodId,
      prodId,
      `SKU-${prodId}`,
      'default',
      'Tiêu chuẩn',
      '{}',
      price,
      origPrice,
      p.stock || 50
    )

    // Images
    delImgStmt.run(prodId)
    const images = p.images || []
    if (images.length > 0) {
      for (let idx = 0; idx < images.length; idx++) {
        imgStmt.run(prodId, images[idx].url, idx, idx === 0 ? 1 : 0)
      }
    } else {
      imgStmt.run(prodId, 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=600&q=80', 0, 1)
    }
  }

  const finalCount = db.prepare('SELECT COUNT(*) as c FROM products').get()?.c || 0
  console.log(`[Sync] THÀNH CÔNG! Đã đồng bộ ${finalCount} sản phẩm vào database cục bộ SQLite!`)
}

syncCloudToLocal().catch(err => {
  console.error('[Sync] Lỗi:', err)
  process.exit(1)
})
