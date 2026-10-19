/**
 * Cấu hình và tiện ích gọi HTTP API kết nối tới Backend ShopNova.
 * Sử dụng biến môi trường VITE_API_BASE_URL làm base URL.
 */

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')

/**
 * Gọi POST /api/v1/auth/login để đăng nhập tài khoản.
 * @param {string} username Tên đăng nhập
 * @param {string} password Mật khẩu
 * @param {RequestInit} [options] Tùy chọn fetch bổ sung (như signal)
 * @returns {Promise<Response>}
 */
export async function apiLogin(username, password, options = {}) {
  const url = `${API_BASE_URL}/api/v1/auth/login`
  return await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: JSON.stringify({
      username: String(username || '').trim(),
      password: String(password || ''),
    }),
    signal: options.signal,
  })
}

/**
 * Gọi GET /api/v1/auth/me để lấy thông tin hồ sơ tài khoản từ JWT token.
 * @param {string} token Access token dạng Bearer JWT
 * @param {RequestInit} [options] Tùy chọn fetch bổ sung (như signal)
 * @returns {Promise<Response>}
 */
export async function apiGetMe(token, options = {}) {
  const url = `${API_BASE_URL}/api/v1/auth/me`
  return await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
    signal: options.signal,
  })
}

/**
 * Gọi POST /api/v1/auth/register để đăng ký tài khoản mới.
 * @param {Object} userData Dữ liệu đăng ký
 * @param {RequestInit} [options] Tùy chọn fetch bổ sung
 * @returns {Promise<Response>}
 */
export async function apiRegister(userData, options = {}) {
  const url = `${API_BASE_URL}/api/v1/auth/register`
  return await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: JSON.stringify(userData),
    signal: options.signal,
  })
}
