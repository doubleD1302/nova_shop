import { env } from '../config/env.js'
import { verifyCredentials } from '../clients/data.client.js'

export async function listDemoAccounts(req, res) {
  // Mật khẩu demo được công khai có chủ đích, chỉ trên môi trường trải nghiệm.
  res.set('Cache-Control', 'no-store')
  if (!env.demoLoginEnabled) {
    return res.json({ success: true, data: { accounts: [] } })
  }

  try {
    const users = await Promise.all(env.demoAccounts.map((account) => (
      verifyCredentials(account.username, account.password)
    )))
    const valid = users.every((user, index) => user?.role === env.demoAccounts[index].role)
    if (!valid) {
      return res.status(503).json({ success: false, error: { code: 'DEMO_UNAVAILABLE' }, message: 'Tài khoản trải nghiệm đang được cập nhật.' })
    }
    return res.json({ success: true, data: { accounts: env.demoAccounts } })
  } catch (error) {
    // Không trả credential đã cấu hình khi database chưa xác minh được tài khoản.
    return res.status(503).json({ success: false, error: { code: 'DEMO_UNAVAILABLE' }, message: 'Tài khoản trải nghiệm đang được cập nhật.' })
  }
}
