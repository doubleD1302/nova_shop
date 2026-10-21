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

/**
 * Gọi PUT /api/v1/auth/profile để cập nhật hồ sơ tài khoản.
 */
export async function apiUpdateProfile(token, profileData, options = {}) {
  const url = `${API_BASE_URL}/api/v1/auth/profile`
  return await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
    body: JSON.stringify(profileData),
    signal: options.signal,
  })
}

/**
 * Gọi GET /api/v1/addresses để lấy danh sách sổ địa chỉ nhận hàng.
 */
export async function apiGetAddresses(token, options = {}) {
  const url = `${API_BASE_URL}/api/v1/addresses`
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
 * Gọi POST /api/v1/addresses để lưu địa chỉ nhận hàng mới.
 */
export async function apiCreateAddress(token, addressData, options = {}) {
  const url = `${API_BASE_URL}/api/v1/addresses`
  return await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
    body: JSON.stringify(addressData),
    signal: options.signal,
  })
}

/**
 * Gọi GET /api/v1/favorites để lấy danh sách sản phẩm yêu thích.
 */
export async function apiGetFavorites(token, options = {}) {
  const url = `${API_BASE_URL}/api/v1/favorites`
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
 * Gọi POST /api/v1/favorites/:productId để thêm yêu thích.
 */
export async function apiAddFavorite(token, productId, options = {}) {
  const url = `${API_BASE_URL}/api/v1/favorites/${productId}`
  return await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
    signal: options.signal,
  })
}

/**
 * Gọi DELETE /api/v1/favorites/:productId để bỏ yêu thích.
 */
export async function apiRemoveFavorite(token, productId, options = {}) {
  const url = `${API_BASE_URL}/api/v1/favorites/${productId}`
  return await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
    signal: options.signal,
  })
}

/**
 * Gọi GET /api/v1/products/:productId/reviews để lấy danh sách đánh giá.
 */
export async function apiGetReviews(productId, page = 1, limit = 10, options = {}) {
  const url = `${API_BASE_URL}/api/v1/products/${productId}/reviews?page=${page}&limit=${limit}`
  return await fetch(url, {
    method: 'GET',
    headers: {
      ...options.headers,
    },
    signal: options.signal,
  })
}

/**
 * Gọi POST /api/v1/reviews để gửi đánh giá sản phẩm.
 */
export async function apiCreateReview(token, reviewData, options = {}) {
  const url = `${API_BASE_URL}/api/v1/reviews`
  return await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
    body: JSON.stringify(reviewData),
    signal: options.signal,
  })
}

/**
 * Gọi GET /api/v1/seller/dashboard để lấy dữ liệu thống kê gian hàng.
 */
export async function apiGetSellerDashboard(token, options = {}) {
  const url = `${API_BASE_URL}/api/v1/seller/dashboard`
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
 * Gọi GET /api/v1/seller/products để lấy danh sách sản phẩm của gian hàng.
 */
export async function apiGetSellerProducts(token, { status, page = 1, limit = 50 } = {}, options = {}) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (status) params.append('status', status)
  const url = `${API_BASE_URL}/api/v1/seller/products?${params.toString()}`
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
 * Gọi POST /api/v1/seller/products để tạo sản phẩm mới.
 */
export async function apiCreateSellerProduct(token, productData, options = {}) {
  const url = `${API_BASE_URL}/api/v1/seller/products`
  return await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
    body: JSON.stringify(productData),
    signal: options.signal,
  })
}

/**
 * Gọi PUT /api/v1/seller/products/:id để cập nhật sản phẩm.
 */
export async function apiUpdateSellerProduct(token, productId, updateData, options = {}) {
  const url = `${API_BASE_URL}/api/v1/seller/products/${productId}`
  return await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
    body: JSON.stringify(updateData),
    signal: options.signal,
  })
}

/**
 * Gọi DELETE /api/v1/seller/products/:id để xóa/lưu trữ sản phẩm.
 */
export async function apiDeleteSellerProduct(token, productId, options = {}) {
  const url = `${API_BASE_URL}/api/v1/seller/products/${productId}`
  return await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
    signal: options.signal,
  })
}

/**
 * Gọi GET /api/v1/seller/orders để lấy danh sách đơn hàng của shop.
 */
export async function apiGetSellerOrders(token, { status, page = 1, limit = 50 } = {}, options = {}) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (status) params.append('status', status)
  const url = `${API_BASE_URL}/api/v1/seller/orders?${params.toString()}`
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
 * Gọi PATCH /api/v1/seller/orders/:shopOrderId/status để đổi trạng thái đơn hàng.
 */
export async function apiUpdateSellerOrderStatus(token, shopOrderId, data, options = {}) {
  const url = `${API_BASE_URL}/api/v1/seller/orders/${shopOrderId}/status`
  return await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
    body: JSON.stringify(data),
    signal: options.signal,
  })
}

/**
 * Gọi POST /api/v1/seller/register-shop để đăng ký mở gian hàng người bán.
 */
export async function apiRegisterSellerShop(token, shopData, options = {}) {
  const url = `${API_BASE_URL}/api/v1/seller/register-shop`
  return await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
    body: JSON.stringify(shopData),
    signal: options.signal,
  })
}

/**
 * Gọi GET /api/v1/seller/shop để lấy thông tin gian hàng.
 */
export async function apiGetSellerShop(token, options = {}) {
  const url = `${API_BASE_URL}/api/v1/seller/shop`
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
 * Gọi PUT /api/v1/seller/shop để cập nhật thông tin gian hàng.
 */
export async function apiUpdateSellerShop(token, shopData, options = {}) {
  const url = `${API_BASE_URL}/api/v1/seller/shop`
  return await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
    body: JSON.stringify(shopData),
    signal: options.signal,
  })
}


