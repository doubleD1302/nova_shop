import { executeQuery } from '../src/config/database.js'

async function grantAdmin() {
  const target = process.argv[2]?.trim()
  if (!target) {
    console.log(`
===============================================================
 LỆNH THIẾT LẬP QUYỀN QUẢN TRỊ VIÊN (ADMIN) CHO NOVA SHOP
===============================================================
Cách sử dụng:
  node scripts/grant-admin.mjs <username_hoặc_email>

Ví dụ:
  node scripts/grant-admin.mjs voducbinh
  node scripts/grant-admin.mjs admin@shopnova.vn
===============================================================
`)
    process.exit(1)
  }

  console.log(`[Grant Admin] Đang tìm kiếm tài khoản với định danh: "${target}"...`)
  const rows = await executeQuery(
    `SELECT id, username, full_name, email, role, status FROM users WHERE username = ? OR email = ? LIMIT 1`,
    [target.toLowerCase(), target.toLowerCase()],
  )

  if (!rows || rows.length === 0) {
    console.error(`❌ Không tìm thấy tài khoản nào khớp với username hoặc email "${target}".`)
    console.error(`Vui lòng kiểm tra lại danh sách người dùng trong bảng users hoặc đăng ký tài khoản trước.`)
    process.exit(1)
  }

  const user = rows[0]
  if (user.role === 'admin') {
    console.log(`ℹ️ Tài khoản "${user.username}" (ID: ${user.id}, Họ tên: ${user.full_name}) ĐÃ LÀ QUẢN TRỊ VIÊN (admin) từ trước.`)
    process.exit(0)
  }

  await executeQuery(`UPDATE users SET role = 'admin' WHERE id = ?`, [user.id])
  console.log(`
===============================================================
🎉 THÀNH CÔNG!
Đã nâng cấp quyền Quản Trị Viên (admin) cho tài khoản:
  - ID: ${user.id}
  - Tên đăng nhập: ${user.username}
  - Họ và tên: ${user.full_name}
  - Email: ${user.email || '(Chưa có)'}
  - Vai trò mới: admin

Tài khoản này hiện đã có đầy đủ quyền truy cập bảng điều khiển /quan-tri.
===============================================================
`)
  process.exit(0)
}

grantAdmin().catch((err) => {
  console.error('Lỗi khi nâng quyền admin:', err)
  process.exit(1)
})

