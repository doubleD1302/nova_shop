/**
 * Bọc localStorage an toàn (SSR / private mode / JSON lỗi đều không crash).
 */
const PREFIX = 'shopnova:'

export function readStorage(key, fallback) {
  try {
    const raw = window.localStorage.getItem(PREFIX + key)
    if (raw == null) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

export function writeStorage(key, value) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    /* bỏ qua: chế độ ẩn danh có thể chặn ghi */
  }
}

export function removeStorage(key) {
  try {
    window.localStorage.removeItem(PREFIX + key)
  } catch {
    /* ignore */
  }
}
