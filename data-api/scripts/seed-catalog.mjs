import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import bcrypt from 'bcryptjs'
import { env } from '../src/config/env.js'
import { executeQuery, executeTransaction, closeDatabase } from '../src/config/database.js'
import { validUploadedImage } from '../src/utils/seller-product.validation.js'

const catalogUrl = new URL('../seeders/catalog.json', import.meta.url)
const cacheUrl = new URL('../data/catalog-uploads.json', import.meta.url)
const shops = [
  { category: 'me-be', categoryName: 'Mẹ & Bé yêu', username: 'shopmebe', slug: 'may-nho-me-be', name: 'Mây Nhỏ Mẹ & Bé', tagline: 'Đồ dùng, tã bỉm và đồ chơi cho bé' },
  { category: 'bach-hoa', categoryName: 'Bách hóa Online', username: 'shopbachhoa', slug: 'an-nhien-bach-hoa', name: 'An Nhiên Bách Hóa', tagline: 'Sữa, bánh kẹo và thực phẩm đóng gói' },
  { category: 'the-thao', categoryName: 'Thể thao & Du lịch', username: 'shopthethao', slug: 'nang-dong-sports', name: 'Năng Động Sports', tagline: 'Dụng cụ tập luyện, thể thao và dã ngoại' },
]

function settings() {
  if (process.env.CATALOG_SEED_ENABLED !== 'true' || env.nodeEnv === 'production' || env.allowLocalDbFallback) {
    throw new Error('Chỉ seed trên MySQL dev/test, không dùng SQLite; cần CATALOG_SEED_ENABLED=true.')
  }
  if (process.env.CATALOG_SEED_DB !== env.dbName) {
    throw new Error('CATALOG_SEED_DB phải khớp chính xác DB_NAME đang sử dụng.')
  }
  const password = process.env.CATALOG_SEED_PASSWORD
  if (!password || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('CATALOG_SEED_PASSWORD phải có từ 8 ký tự, tối đa 72 byte.')
  }
  const backend = new URL(process.env.CATALOG_BACKEND_URL || 'http://127.0.0.1:3000')
  if (backend.username || backend.password || backend.pathname !== '/' || backend.search || backend.hash ||
      !(backend.protocol === 'https:' || backend.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(backend.hostname))) {
    throw new Error('CATALOG_BACKEND_URL phải là HTTPS origin hoặc HTTP loopback.')
  }
  return { password, backend: backend.origin }
}

function validateCatalog(catalog) {
  if (!Array.isArray(catalog) || catalog.length !== shops.length) throw new Error('Catalog phải gồm đúng 3 danh mục.')
  const slugs = new Set()
  const imageHosts = ['cdn1.concung.com', 'contents.mediadecathlon.com']
  for (const shop of shops) {
    const groups = catalog.filter((group) => group.category === shop.category)
    if (groups.length !== 1 || groups[0].products?.length !== 50) throw new Error(`Cần đúng 50 sản phẩm cho ${shop.category}.`)
    for (const product of groups[0].products) {
      if (typeof product.name !== 'string' || !product.name.trim() || product.name.length > 200 ||
          typeof product.brand !== 'string' || product.brand.length > 120 || !/^\d+$/.test(String(product.sourceId)) ||
          !Number.isSafeInteger(product.price) || product.price < 1 || product.price > 999999999999999 ||
          !Array.isArray(product.images) || product.images.length !== 4 || new Set(product.images).size !== 4) {
        throw new Error('Tên, giá, thương hiệu hoặc bộ 4 ảnh không hợp lệ.')
      }
      const source = new URL(product.sourceUrl)
      if (source.protocol !== 'https:' || !['concung.com', 'www.decathlon.vn'].includes(source.hostname) || source.username || source.password) {
        throw new Error('Nguồn tham khảo không hợp lệ.')
      }
      for (const image of product.images) {
        const url = new URL(image)
        if (url.protocol !== 'https:' || !imageHosts.includes(url.hostname) || url.username || url.password || image.length > 1024) {
          throw new Error('URL ảnh nguồn không hợp lệ.')
        }
      }
      product.slug = `${shop.slug}-${product.sourceId}`
      if (slugs.has(product.slug)) throw new Error('Trùng mã sản phẩm trong catalog.')
      slugs.add(product.slug)
    }
    shop.products = groups[0].products
  }
}

async function prepareShops(password) {
  const hash = await bcrypt.hash(password, 12)
  await executeTransaction(async (query) => {
    const admins = await query("SELECT id FROM users WHERE role = 'admin' AND status = 'active' ORDER BY id LIMIT 1")
    if (!admins.length) throw new Error('Cần một tài khoản quản trị đang hoạt động để ghi nhận dữ liệu mẫu.')
    for (const [index, shop] of shops.entries()) {
      shop.adminId = admins[0].id
      const email = `${shop.username}@shopnova.example.test`
      const users = await query('SELECT * FROM users WHERE username = ? OR email = ? FOR UPDATE', [shop.username, email])
      if (users.length) {
        const user = users[0]
        if (users.length !== 1 || user.username !== shop.username || user.email !== email || user.full_name !== shop.name ||
            user.role !== 'seller' || user.status !== 'active' || !await bcrypt.compare(password, user.password_hash)) {
          throw new Error(`Tài khoản ${shop.username} đã tồn tại với dữ liệu khác; giữ nguyên và dừng.`)
        }
        shop.userId = user.id
      } else {
        const user = await query("INSERT INTO users (username, password_hash, full_name, email, role) VALUES (?, ?, ?, ?, 'seller')", [shop.username, hash, shop.name, email])
        shop.userId = user.insertId
      }
      const categories = await query('SELECT id, is_active FROM categories WHERE slug = ? FOR UPDATE', [shop.category])
      if (categories.length) {
        if (!categories[0].is_active) throw new Error(`Danh mục ${shop.category} đang tắt; giữ nguyên và dừng.`)
        shop.categoryId = categories[0].id
      } else {
        const category = await query('INSERT INTO categories (slug, name, sort_order) VALUES (?, ?, ?)', [shop.category, shop.categoryName, 20 + index])
        shop.categoryId = category.insertId
      }
      const owned = await query('SELECT id, owner_id, slug, name, status FROM shops WHERE owner_id = ? OR slug = ? FOR UPDATE', [shop.userId, shop.slug])
      if (owned.length) {
        const existing = owned[0]
        if (owned.length !== 1 || String(existing.owner_id) !== String(shop.userId) || existing.slug !== shop.slug || existing.name !== shop.name || existing.status !== 'active') {
          throw new Error(`Shop ${shop.slug} đã tồn tại với dữ liệu khác; giữ nguyên và dừng.`)
        }
        shop.id = existing.id
      } else {
        const result = await query("INSERT INTO shops (owner_id, slug, name, tagline, description, province, address_detail, status) VALUES (?, ?, ?, ?, ?, 'TP. Hồ Chí Minh', 'Địa chỉ mô phỏng phục vụ thực hành', 'active')",
          [shop.userId, shop.slug, shop.name, shop.tagline, `${shop.tagline}. Gian hàng mẫu phục vụ học tập, không kinh doanh thực tế.`])
        shop.id = result.insertId
        await query("INSERT INTO shop_approval_events (shop_id, actor_id, action, profile_version, reason) VALUES (?, ?, 'approved', 1, ?)", [shop.id, shop.adminId, 'Khởi tạo gian hàng mẫu phục vụ học tập.'])
      }
    }
  }, 30000)
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(60000) })
  const payload = await response.json().catch(() => null)
  if (!response.ok || payload?.success !== true) throw new Error(`HTTP ${response.status}: ${payload?.error?.code || 'INVALID_RESPONSE'}`)
  return payload.data
}

async function seedCatalog() {
  const { password, backend } = settings()
  const catalog = JSON.parse(await readFile(catalogUrl, 'utf8'))
  validateCatalog(catalog)
  // Phát hiện xung đột trước khi tạo tài khoản hoặc tải ảnh.
  const expected = new Map(shops.flatMap((shop) => shop.products.map((product) => [product.slug, { shop, product }])))
  const slugs = [...expected.keys()]
  const existing = await executeQuery(`SELECT p.id, p.slug, p.name, p.category_id, s.slug shop_slug FROM products p JOIN shops s ON s.id=p.shop_id WHERE p.slug IN (${slugs.map(() => '?').join(',')})`, slugs, 15000)
  for (const row of existing) {
    const { shop, product } = expected.get(row.slug)
    if (row.shop_slug !== shop.slug || row.name !== product.name) throw new Error(`Trùng slug ${row.slug}; giữ nguyên và dừng.`)
  }
  await prepareShops(password)

  let cache = { version: 1, backend, database: env.dbName, uploads: {} }
  try {
    cache = JSON.parse(await readFile(cacheUrl, 'utf8'))
    if (cache.version !== 1 || cache.backend !== backend || cache.database !== env.dbName || !cache.uploads) {
      throw new Error('Cache ảnh thuộc môi trường khác; giữ nguyên và dừng.')
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  await mkdir(new URL('../data/', import.meta.url), { recursive: true })
  let cacheWrite = Promise.resolve()
  const remember = () => {
    cacheWrite = cacheWrite.then(() => writeFile(cacheUrl, `${JSON.stringify(cache, null, 2)}\n`))
    return cacheWrite
  }

  for (const shop of shops) {
    const login = await requestJson(`${backend}/api/v1/auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: shop.username, password }),
    })
    if (String(login.user?.id) !== String(shop.userId) || String(login.user?.shopId) !== String(shop.id)) {
      throw new Error('Backend không trỏ đến cùng tài khoản/shop trong database đã chọn.')
    }
    const headers = { 'content-type': 'application/json', authorization: `Bearer ${login.token}` }
    let created = 0
    let preserved = 0
    try {
      for (const product of shop.products) {
        const old = existing.find((row) => row.slug === product.slug)
        if (old) {
          if (String(old.category_id) !== String(shop.categoryId)) throw new Error('Sản phẩm hiện có đã đổi danh mục; giữ nguyên và dừng.')
          preserved += 1
          continue
        }
        const preparedImages = await Promise.all(product.images.map(async (source, index) => {
          const key = createHash('sha256').update(`${shop.userId}:${source}`).digest('hex')
          const prefix = `/uploads/product-${shop.userId}-`
          const cachedUrl = cache.uploads[key]
          if (cachedUrl) {
            if (!validUploadedImage(cache.uploads[key]) || !cache.uploads[key].startsWith(prefix)) throw new Error('Cache ảnh không thuộc tài khoản.')
          }
          const response = await fetch(cachedUrl ? `${backend}${cachedUrl}` : source, { signal: AbortSignal.timeout(30000) })
          const mime = response.headers.get('content-type')?.split(';')[0]
          if (!response.ok || !['image/jpeg', 'image/png', 'image/webp'].includes(mime)) throw new Error(`Ảnh nguồn không hợp lệ: ${product.slug}, ảnh ${index + 1}.`)
          const bytes = Buffer.from(await response.arrayBuffer())
          if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new Error('Ảnh nguồn rỗng hoặc vượt quá 5 MiB.')
          return { key, prefix, cachedUrl, mime, bytes }
        }))
        if (new Set(preparedImages.map((image) => createHash('sha256').update(image.bytes).digest('hex'))).size !== 4) {
          throw new Error(`${product.slug}: bộ ảnh có file trùng nội dung; chưa ghi sản phẩm.`)
        }
        const images = await Promise.all(preparedImages.map(async ({ key, prefix, cachedUrl, mime, bytes }) => {
          if (cachedUrl) return cachedUrl
          const uploaded = await requestJson(`${backend}/api/v1/uploads/images`, {
            method: 'POST', headers, body: JSON.stringify({ purpose: 'product', dataUrl: `data:${mime};base64,${bytes.toString('base64')}` }),
          })
          if (!validUploadedImage(uploaded.url) || !uploaded.url.startsWith(prefix)) throw new Error('Backend trả URL ảnh không hợp lệ.')
          cache.uploads[key] = uploaded.url
          await remember()
          return uploaded.url
        }))
        await executeTransaction(async (query) => {
          const inserted = await query("INSERT INTO products (shop_id, category_id, slug, name, description, specs, badges, status, approval_status, reviewed_by, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, '[]', 'active', 'approved', ?, UTC_TIMESTAMP(3))", [
            shop.id, shop.categoryId, product.slug, product.name,
            `${product.name}. ${shop.tagline}.\n\nDữ liệu mẫu phục vụ học tập: giá và tồn kho dùng để thực hành xem hàng, giỏ hàng và đặt hàng. Không áp dụng cho giao dịch thực tế.`,
            JSON.stringify({ 'Thương hiệu': product.brand || 'Xem bao bì sản phẩm', 'Mã tham khảo': String(product.sourceId), 'Loại dữ liệu': 'Sản phẩm mẫu học tập' }), shop.adminId,
          ])
          await query("INSERT INTO product_variants (product_id, sku, variant_key, name, attributes, price, stock_qty) VALUES (?, ?, 'default', 'Mặc định', '{}', ?, 100)", [inserted.insertId, `DEMO-${shop.category}-${product.sourceId}`, product.price])
          await query(`INSERT INTO product_images (product_id, url, alt_text, sort_order, author, license_name) VALUES ${images.map(() => '(?, ?, ?, ?, ?, ?)').join(',')}`, images.flatMap((url, index) => [inserted.insertId, url, `${product.name} - ảnh ${index + 1}`.slice(0, 200), index, 'Ảnh do người bán tải lên', 'Ảnh do người bán cung cấp']))
        }, 15000)
        created += 1
        if (created % 10 === 0) console.log(`${shop.username}: đã thêm ${created}/50 sản phẩm.`)
      }
      // Dùng ảnh đã tải lên để logo/banner cũng đọc được qua Backend trên web và app.
      await executeQuery(`UPDATE shops s JOIN products p ON p.shop_id=s.id AND p.slug=? JOIN product_images i ON i.product_id=p.id AND i.sort_order=0 SET s.logo_url=COALESCE(s.logo_url,i.url), s.banner_url=COALESCE(s.banner_url,i.url) WHERE s.id=? AND (s.logo_url IS NULL OR s.banner_url IS NULL)`, [shop.products[0].slug, shop.id], 15000)
      await executeQuery(`UPDATE categories c JOIN products p ON p.category_id=c.id AND p.slug=? JOIN product_images i ON i.product_id=p.id AND i.sort_order=0 SET c.image_url=i.url WHERE c.id=? AND c.image_url IS NULL`, [shop.products[0].slug, shop.categoryId], 15000)
      console.log(`${shop.username}: thêm ${created}, giữ nguyên ${preserved}; shop ${shop.slug}.`)
    } finally {
      // Không giữ phiên seed đăng nhập sau khi đã hoàn thành hoặc bị gián đoạn.
      if (login.refreshToken) await requestJson(`${backend}/api/v1/auth/logout`, { method: 'POST', headers, body: JSON.stringify({ refreshToken: login.refreshToken }) }).catch(() => {})
    }
  }
  console.log('Đã xử lý 3 shop. Chạy kiểm tra catalog qua Backend trước khi bàn giao.')
}

try {
  await seedCatalog()
} catch (error) {
  console.error(error.code ? `Seed catalog thất bại (${error.code}).` : error.message)
  process.exitCode = 1
} finally {
  await closeDatabase()
}
