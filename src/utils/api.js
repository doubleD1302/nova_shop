/**
 * Cấu hình và tiện ích gọi HTTP API kết nối tới Backend ShopNova.
 * Sử dụng biến môi trường VITE_API_BASE_URL làm base URL.
 */

const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '')
const isLoopbackApiUrl = (() => {
  if (!configuredApiBaseUrl) return false

  try {
    const hostname = new URL(configuredApiBaseUrl).hostname.toLowerCase()
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1'
  } catch {
    return false
  }
})()

// A production build must never send visitors to their own machine. With an
// empty base URL, the host can route /api and /uploads to the deployed backend.
export const API_BASE_URL = import.meta.env.PROD && isLoopbackApiUrl ? '' : configuredApiBaseUrl
const TOKEN_KEY = 'novashop_token'
export const REFRESH_TOKEN_KEY = 'novashop_refresh_token'

let inflightRefreshPromise = null

export async function refreshAccessToken() {
  if (inflightRefreshPromise) return inflightRefreshPromise

  inflightRefreshPromise = (async () => {
    try {
      const refreshToken = sessionStorage.getItem(REFRESH_TOKEN_KEY) || localStorage.getItem(REFRESH_TOKEN_KEY)
      if (!refreshToken) return null

      const res = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.success || !data?.data?.token) {
        sessionStorage.removeItem(TOKEN_KEY)
        sessionStorage.removeItem(REFRESH_TOKEN_KEY)
        localStorage.removeItem(REFRESH_TOKEN_KEY)
        return null
      }

      sessionStorage.setItem(TOKEN_KEY, data.data.token)
      if (data.data.refreshToken) {
        sessionStorage.setItem(REFRESH_TOKEN_KEY, data.data.refreshToken)
        localStorage.setItem(REFRESH_TOKEN_KEY, data.data.refreshToken)
      }
      return data.data
    } catch {
      return null
    } finally {
      inflightRefreshPromise = null
    }
  })()

  return inflightRefreshPromise
}
const PUBLIC_GET_TTL_MS = 20_000
const MAX_PUBLIC_GET_CACHE = 40
const publicGetCache = new Map()
const publicGetInflight = new Map()
const privateGetInflight = new Map()

function abortError() {
  return new DOMException('The request was aborted.', 'AbortError')
}

function publicGet(path, ttl = PUBLIC_GET_TTL_MS, signal) {
  const key = `/api/v1${path}`
  const now = Date.now()
  if (signal?.aborted) return Promise.reject(abortError())
  const cached = publicGetCache.get(key)
  if (cached && cached.expiresAt > now) return Promise.resolve(cached.response.clone())
  if (cached) publicGetCache.delete(key)

  let entry = publicGetInflight.get(key)
  if (!entry) {
    const controller = new AbortController()
    const promise = fetch(`${API_BASE_URL}${key}`, { signal: controller.signal }).then((response) => {
      if (response.ok) {
        publicGetCache.set(key, { response: response.clone(), expiresAt: Date.now() + ttl })
        while (publicGetCache.size > MAX_PUBLIC_GET_CACHE) publicGetCache.delete(publicGetCache.keys().next().value)
      }
      return response
    }).finally(() => publicGetInflight.delete(key))
    entry = { controller, promise, subscribers: 0 }
    publicGetInflight.set(key, entry)
  }
  entry.subscribers += 1

  return new Promise((resolve, reject) => {
    let settled = false
    const release = () => {
      if (settled) return
      settled = true
      signal?.removeEventListener('abort', onAbort)
      entry.subscribers = Math.max(0, entry.subscribers - 1)
    }
    const onAbort = () => {
      release()
      reject(abortError())
      if (!entry.subscribers) queueMicrotask(() => {
        if (!entry.subscribers && publicGetInflight.get(key) === entry) entry.controller.abort()
      })
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    entry.promise.then((response) => {
      if (signal?.aborted) return onAbort()
      release()
      resolve(response.clone())
    }, (error) => {
      release()
      reject(error)
    })
  })
}

export function invalidatePublicApiCache(prefix = '') {
  for (const key of publicGetCache.keys()) {
    if (!prefix || key.startsWith(`/api/v1${prefix}`)) publicGetCache.delete(key)
  }
}

function authHeaders(token = sessionStorage.getItem(TOKEN_KEY)) {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function apiRequest(path, { method = 'GET', body, token, headers = {}, signal } = {}) {
  const isPublicCatalogGet = method === 'GET' && !signal && (
    path.startsWith('/products?') || /^\/products\/[^/]+$/.test(path) ||
    path.startsWith('/products/') && !path.includes('/eligible') && !path.includes('/reviews/eligible') ||
    path === '/shops' || path.startsWith('/shops?') || path.startsWith('/shops/') ||
    path === '/categories'
  )
  if (isPublicCatalogGet) return publicGet(path, PUBLIC_GET_TTL_MS, signal)
  const url = `${API_BASE_URL}/api/v1${path}`
  const requestHeaders = {
    ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    ...authHeaders(token),
    ...headers,
  }
  if (method === 'GET' && !signal) {
    const key = `${url}|${requestHeaders.Authorization || 'anonymous'}`
    if (privateGetInflight.has(key)) return privateGetInflight.get(key).then((response) => response.clone())
    const request = fetch(url, { method, headers: requestHeaders }).finally(() => privateGetInflight.delete(key))
    privateGetInflight.set(key, request)
    return request.then((response) => response.clone())
  }
  return fetch(url, {
    method,
    headers: requestHeaders,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal,
  })
}

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

export function apiGoogleLogin(idToken, options = {}) {
  return apiRequest('/auth/google', {
    method: 'POST',
    body: { idToken },
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

export function apiRefreshToken(refreshToken) {
  return fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })
}

export function apiLogout(refreshToken) {
  return fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ refreshToken }),
  })
}

export function apiChangePassword(currentPassword, newPassword) {
  return apiRequest('/auth/change-password', {
    method: 'POST',
    body: { currentPassword, newPassword },
  })
}

export function apiRegister(payload) {
  return apiRequest('/auth/register', { method: 'POST', body: payload })
}

export function apiUpdateProfile(payload) {
  return apiRequest('/auth/profile', { method: 'PUT', body: payload })
}

export function apiCreateSellerShop(shopName) {
  return apiRequest('/auth/seller-shop', { method: 'POST', body: { shopName } })
}

export function apiGetProducts(options = {}) {
  const { limit = 20, offset = 0, signal, ...filters } = options
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '' && value !== false) params.set(key, String(value))
  }
  return apiRequest(`/products?${params}`, { signal })
}

export function apiGetProduct(productKey, options = {}) {
  const params = new URLSearchParams({ slug: String(productKey), limit: '1', fullImages: '1' })
  return apiRequest(`/products?${params}`, options)
}

export function apiGetShops({ limit, offset, featured, mall, q, signal } = {}) {
  const params = new URLSearchParams()
  if (limit) params.set('limit', String(limit))
  if (offset) params.set('offset', String(offset))
  if (featured) params.set('featured', '1')
  if (mall) params.set('mall', '1')
  if (q) params.set('q', String(q))
  return apiRequest(`/shops${params.size ? `?${params}` : ''}`, { signal })
}

export function apiGetShop(shopId, options = {}) {
  return apiRequest(`/shops/${encodeURIComponent(shopId)}`, options)
}

export function apiGetCategories(options = {}) {
  return apiRequest('/categories', options)
}

export function apiUpdateSellerShop(payload) {
  return apiRequest('/seller/shop', { method: 'PUT', body: payload })
}

export function apiGetSellerProducts(options = {}) {
  const { limit = 50, offset = 0, productId, signal } = options
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  if (productId) params.set('productId', String(productId))
  return apiRequest(`/seller/products?${params}`, { signal })
}

export function apiSearchSellerImages(query) {
  return apiRequest(`/seller/images/search?q=${encodeURIComponent(query)}`)
}

export function apiSaveSellerProduct(payload, productId) {
  return apiRequest(productId ? `/seller/products/${encodeURIComponent(productId)}` : '/seller/products', {
    method: productId ? 'PUT' : 'POST',
    body: payload,
  })
}

export function apiDeleteSellerProduct(productId) {
  return apiRequest(`/seller/products/${encodeURIComponent(productId)}`, { method: 'DELETE', body: {} })
}

export async function apiUploadSellerImage(file) {
  const dataUrl = typeof file === 'string' ? file : await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Không thể đọc tệp ảnh.'))
    reader.onload = () => resolve(reader.result)
    reader.readAsDataURL(file)
  })
  return apiRequest('/uploads/images', { method: 'POST', body: { dataUrl } })
}

export function apiGetProductReviews(productId) {
  return apiRequest(`/products/${encodeURIComponent(productId)}/reviews`)
}

export function apiGetEligibleReviewItems(productId) {
  return apiRequest(`/products/${encodeURIComponent(productId)}/reviews/eligible`)
}

export function apiCreateProductReview(productId, payload) {
  return apiRequest(`/products/${encodeURIComponent(productId)}/reviews`, { method: 'POST', body: payload })
}

export function apiCreateOrder(payload, idempotencyKey) {
  return apiRequest('/orders', {
    method: 'POST',
    body: payload,
    headers: { 'Idempotency-Key': idempotencyKey },
  })
}

export function apiGetOrders(options = {}) {
  const { limit = 50, offset = 0, orderId, signal } = options
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  if (orderId) params.set('orderId', String(orderId))
  return apiRequest(`/orders?${params}`, { signal })
}

export function apiCancelOrder(orderId) {
  return apiRequest(`/orders/${encodeURIComponent(orderId)}/cancel`, { method: 'POST', body: {} })
}

export function apiConfirmOrderReceived(orderId) {
  return apiRequest(`/orders/${encodeURIComponent(orderId)}/confirm-received`, { method: 'POST', body: {} })
}

export function apiGetSellerOrders(options = {}) {
  const { limit = 50, offset = 0, signal } = options
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  return apiRequest(`/seller/orders?${params}`, { signal })
}

export function apiUpdateSellerOrderStatus(shopOrderId, status) {
  return apiRequest(`/seller/orders/${encodeURIComponent(shopOrderId)}/status`, {
    method: 'PATCH',
    body: { status },
  })
}

export function apiCreateContentReport(payload) {
  return apiRequest('/reports', { method: 'POST', body: payload })
}

export function apiGetAdminResource(resource) {
  return apiRequest(`/admin/${encodeURIComponent(resource)}`)
}

export async function apiUpdateAdminResource(resource, id, status, extraBody = {}) {
  const body = typeof status === 'object' && status !== null ? status : { status, ...extraBody }
  const response = await apiRequest(`/admin/${encodeURIComponent(resource)}/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body,
  })
  if (response.ok) {
    if (resource === 'products' || resource === 'reviews' || resource === 'users' || resource === 'shops') invalidatePublicApiCache('/products')
    if (resource === 'shops' || resource === 'reviews' || resource === 'users') invalidatePublicApiCache('/shops')
  }
  return response
}

export async function apiUpdateAdminProductFlashSale(productId, enabled) {
  const response = await apiRequest(`/admin/products/${encodeURIComponent(productId)}/flash-sale`, {
    method: 'PATCH',
    body: { enabled },
  })
  if (response.ok) invalidatePublicApiCache('/products')
  return response
}

export async function apiUpdateAdminProductApproval(productId, { approvalStatus, rejectionReason }) {
  const response = await apiRequest(`/admin/products/${encodeURIComponent(productId)}/approval`, {
    method: 'PATCH',
    body: { approvalStatus, rejectionReason },
  })
  if (response.ok) invalidatePublicApiCache('/products')
  return response
}

export function apiRetryViolationEmail(violationId) {
  return apiRequest(`/admin/violations/${encodeURIComponent(violationId)}/retry-email`, {
    method: 'POST',
  })
}

export function apiGetShopViolations(shopId) {
  return apiRequest(`/admin/shops/${encodeURIComponent(shopId)}/violations`)
}

export function apiGetAdminEmailStatus() {
  return apiRequest('/admin/email-status')
}

export async function apiSendAiMessage(message, context = {}) {
  const response = await apiRequest('/ai/chat', {
    method: 'POST',
    body: JSON.stringify({ message, context }),
  })
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData?.message || 'Không thể kết nối đến trợ lý AI')
  }
  return response.json()
}

export async function apiGetAiBrainProfile() {
  const response = await apiRequest('/ai/brain/profile')
  if (!response.ok) return null
  return response.json()
}

export async function apiSendAiBrainFeedback(feedbackData) {
  const response = await apiRequest('/ai/brain/feedback', {
    method: 'POST',
    body: JSON.stringify(feedbackData),
  })
  if (!response.ok) return null
  return response.json()
}

export async function apiResetAiBrain() {
  const response = await apiRequest('/ai/brain/reset', {
    method: 'DELETE',
  })
  if (!response.ok) return null
  return response.json()
}


/**
 * API Giỏ hàng lưu trữ phía máy chủ (Server-side Cart).
 */
export function apiGetCart(options = {}) {
  return apiRequest("/cart", options)
}

export function apiAddToCart({ variantId, productId, qty = 1, selected = true, replaceQty }, options = {}) {
  return apiRequest("/cart/items", {
    method: "POST",
    body: { variantId, productId, qty, selected, replaceQty },
    ...options,
  })
}

export function apiUpdateCartItem(itemId, { qty, selected }, options = {}) {
  return apiRequest(`/cart/items/${encodeURIComponent(itemId)}`, {
    method: "PATCH",
    body: { qty, selected },
    ...options,
  })
}

export function apiRemoveCartItem(itemId, options = {}) {
  return apiRequest(`/cart/items/${encodeURIComponent(itemId)}`, {
    method: "DELETE",
    ...options,
  })
}

export function apiClearCart(options = {}) {
  const query = options?.selectedOnly ? "?selected=true" : ""
  return apiRequest(`/cart/items${query}`, {
    method: "DELETE",
    ...options,
  })
}

export function apiSyncCart(items, options = {}) {
  return apiRequest("/cart/sync", {
    method: "POST",
    body: { items },
    ...options,
  })
}

export function apiUpdateCartSelection(selected, shopId, options = {}) {
  return apiRequest("/cart/selection", {
    method: "PATCH",
    body: { selected, shopId },
    ...options,
  })
}

/**
 * 1. Vận chuyển (Shipping)
 */
export function apiCalculateShipping(payload, options = {}) {
  return apiRequest('/shipping/calculate', {
    method: 'POST',
    body: payload,
    ...options,
  })
}

export function apiUpdateOrderTracking(shopOrderId, payload, options = {}) {
  return apiRequest(`/seller/orders/${encodeURIComponent(shopOrderId)}/tracking`, {
    method: 'PATCH',
    body: payload,
    ...options,
  })
}

export function apiGetOrderTracking(orderId, options = {}) {
  return apiRequest(`/orders/${encodeURIComponent(orderId)}/tracking`, options)
}

/**
 * 2. Hậu mãi (Returns & Refunds)
 */
export function apiCreateOrderReturn(orderId, payload, options = {}) {
  return apiRequest(`/orders/${encodeURIComponent(orderId)}/returns`, {
    method: 'POST',
    body: payload,
    ...options,
  })
}

export function apiGetOrderReturns(orderId, options = {}) {
  return apiRequest(`/orders/${encodeURIComponent(orderId)}/returns`, options)
}

export function apiGetSellerReturns(options = {}) {
  const { status, limit, offset, ...rest } = options
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (limit) params.set('limit', String(limit))
  if (offset) params.set('offset', String(offset))
  const query = params.toString() ? `?${params.toString()}` : ''
  return apiRequest(`/seller/returns${query}`, rest)
}

export function apiUpdateSellerReturnStatus(returnId, payload, options = {}) {
  return apiRequest(`/seller/returns/${encodeURIComponent(returnId)}/status`, {
    method: 'PATCH',
    body: payload,
    ...options,
  })
}

/**
 * 3. Giao tiếp (Chat)
 */
export function apiGetChatConversations(options = {}) {
  return apiRequest('/chat/conversations', options)
}

export function apiStartChatConversation(shopId, options = {}) {
  return apiRequest('/chat/conversations', {
    method: 'POST',
    body: { shopId },
    ...options,
  })
}

export function apiGetChatMessages(conversationId, options = {}) {
  const { limit, offset, ...rest } = options
  const params = new URLSearchParams()
  if (limit) params.set('limit', String(limit))
  if (offset) params.set('offset', String(offset))
  const query = params.toString() ? `?${params.toString()}` : ''
  return apiRequest(`/chat/conversations/${encodeURIComponent(conversationId)}/messages${query}`, rest)
}

export function apiSendChatMessage(conversationId, payload, options = {}) {
  return apiRequest(`/chat/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: 'POST',
    body: payload,
    ...options,
  })
}
