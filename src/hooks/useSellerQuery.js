import { useCallback, useEffect, useState } from 'react'

/** Đọc phản hồi API Backend: trả data khi thành công, ném lỗi có thông báo tiếng Việt khi thất bại. */
export async function readApi(response, fallbackMessage = 'Không thể tải dữ liệu.') {
  const body = await response.json().catch(() => null)
  if (!response.ok || !body?.success) {
    throw new Error(body?.message || fallbackMessage)
  }
  return body.data
}

/**
 * Tải dữ liệu cho trang Kênh Người Bán.
 * fetcher({ signal }) trả về Response của apiRequest; hook tự đọc JSON và quản lý loading/error.
 * Gọi reload() để tải lại sau khi thay đổi dữ liệu.
 */
export function useSellerQuery(fetcher, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: '' })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setState((prev) => ({ ...prev, loading: true, error: '' }))
    Promise.resolve()
      .then(() => fetcher({ signal: controller.signal }))
      .then((response) => readApi(response))
      .then((data) => {
        if (!controller.signal.aborted) setState({ data, loading: false, error: '' })
      })
      .catch((err) => {
        if (controller.signal.aborted || err?.name === 'AbortError') return
        setState({ data: null, loading: false, error: err?.message || 'Không thể tải dữ liệu.' })
      })
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version])

  const reload = useCallback(() => setVersion((v) => v + 1), [])
  return { ...state, reload }
}
