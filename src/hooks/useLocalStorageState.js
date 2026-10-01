import { useEffect, useRef, useState } from 'react'
import { readStorage, writeStorage } from '../utils/storage'

/**
 * useState + tự động đồng bộ vào localStorage.
 * Dùng cho giỏ hàng / đơn hàng / sản phẩm của người bán / phiên đăng nhập.
 */
export function useLocalStorageState(key, initialValue) {
  const [value, setValue] = useState(() => {
    const stored = readStorage(key, undefined)
    if (stored === undefined) return typeof initialValue === 'function' ? initialValue() : initialValue
    return stored
  })

  const firstRun = useRef(true)
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
    }
    writeStorage(key, value)
  }, [key, value])

  return [value, setValue]
}

export default useLocalStorageState
