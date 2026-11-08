import bcrypt from 'bcryptjs'
import { executeTransaction, closeDatabase } from '../src/config/database.js'

async function seedDemo() {
  if (process.env.DEMO_SEED_ENABLED !== 'true') {
    throw new Error('Chỉ tạo tài khoản khi DEMO_SEED_ENABLED=true trên database trải nghiệm.')
  }
  const labels = { buyer: 'Người mua', seller: 'Người bán', admin: 'Quản trị viên' }
  const accounts = await Promise.all(Object.entries(labels).map(async ([role, label]) => {
    const key = `DEMO_${role.toUpperCase()}_PASSWORD`
    const password = process.env[key]
    if (!password || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
      throw new Error(`${key} phải có từ 8 ký tự và tối đa 72 byte.`)
    }
    return {
      role, password, hash: await bcrypt.hash(password, 12),
      username: `demo_${role}_guest`, email: `demo-${role}@shopnova.example.test`, name: `DEMO - ${label}`,
    }
  }))

  await executeTransaction(async (query) => {
    for (const account of accounts) {
      const rows = await query('SELECT * FROM users WHERE username = ? OR email = ? FOR UPDATE', [account.username, account.email])
      if (rows.length) {
        const user = rows[0]
        if (rows.length !== 1 || user.username !== account.username || user.email !== account.email
            || user.full_name !== account.name || user.role !== account.role || user.status !== 'active'
            || !await bcrypt.compare(account.password, user.password_hash)) {
          throw new Error(`Tài khoản ${account.username} đã tồn tại với dữ liệu khác; giữ nguyên và dừng.`)
        }
        account.id = user.id
      } else {
        const result = await query('INSERT INTO users (username, password_hash, full_name, email, role) VALUES (?, ?, ?, ?, ?)',
          [account.username, account.hash, account.name, account.email, account.role])
        account.id = result.insertId
      }
    }
    const seller = accounts.find((account) => account.role === 'seller')
    const admin = accounts.find((account) => account.role === 'admin')
    const shops = await query('SELECT id, slug, status FROM shops WHERE owner_id = ?', [seller.id])
    if (shops.length && (shops[0].slug !== 'demo-shop-guest' || shops[0].status !== 'active')) {
      throw new Error('Shop của tài khoản demo đã được thay đổi; giữ nguyên và dừng.')
    }
    if (!shops.length) {
      const shop = await query("INSERT INTO shops (owner_id, slug, name, tagline, description, province, status) VALUES (?, 'demo-shop-guest', ?, ?, ?, ?, 'active')",
        [seller.id, 'DEMO - Gian hàng trải nghiệm', 'Gian hàng mẫu', 'Gian hàng dùng để trải nghiệm chức năng người bán.', 'TP. Hồ Chí Minh'])
      await query("INSERT INTO shop_approval_events (shop_id, actor_id, action, profile_version, reason) VALUES (?, ?, 'approved', 1, ?)",
        [shop.insertId, admin.id, 'Gian hàng mẫu phục vụ môi trường trải nghiệm.'])
    }
  }, 20000)
  console.log('Đã bảo đảm 3 tài khoản demo buyer/seller/admin và shop demo đang hoạt động. Không sửa tài khoản khác.')
}

try {
  await seedDemo()
} catch (error) {
  console.error(error.code ? `Tạo tài khoản demo thất bại (${error.code}).` : error.message)
  process.exitCode = 1
} finally {
  await closeDatabase()
}
