/**
 * Cấu hình và tiện ích gọi HTTP API kết nối tới Backend ShopNova.
 * Sử dụng biến môi trường VITE_API_BASE_URL làm base URL.
 */

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')

/**
 * Gọi POST /api/v1/auth/login để đăng nhập tài khoản.
 * @param {string} username Tên đăng nhập
 * @param {string} password Mật khẩu
 * @returns {Promise<Response>}
 */
export async function apiLogin(username, password) {
  const url = `${API_BASE_URL}/api/v1/auth/login`
  return await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: String(username || '').trim(),
      password: String(password || ''),
    }),
  })
}

/**
 * Gọi GET /api/v1/auth/me để lấy thông tin hồ sơ tài khoản từ JWT token.
 * @param {string} token Access token dạng Bearer JWT
 * @returns {Promise<Response>}
 */
export async function apiGetMe(token) {
  const url = `${API_BASE_URL}/api/v1/auth/me`
  return await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}
