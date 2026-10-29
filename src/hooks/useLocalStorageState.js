import { useCallback, useEffect, useRef, useState } from 'react'
import { readStorage, writeStorage } from '../utils/storage'

function initialForKey(key, initialValue) {
  const stored = readStorage(key, undefined)
  if (stored !== undefined) return stored
  return typeof initialValue === 'function' ? initialValue() : initialValue
}

/** useState mirrored to localStorage, with immediate isolation when the key changes. */
export function useLocalStorageState(key, initialValue) {
  const initialValueRef = useRef(initialValue)
  initialValueRef.current = initialValue
  const [storedState, setStoredState] = useState(() => ({ key, value: initialForKey(key, initialValue) }))

  if (storedState.key !== key) {
    setStoredState({ key, value: initialForKey(key, initialValueRef.current) })
  }

  useEffect(() => {
    if (storedState.key === key) writeStorage(key, storedState.value)
  }, [key, storedState])

  const setValue = useCallback((nextValue) => {
    setStoredState((current) => {
      const currentValue = current.key === key ? current.value : initialForKey(key, initialValueRef.current)
      return { key, value: typeof nextValue === 'function' ? nextValue(currentValue) : nextValue }
    })
  }, [key])

  return [storedState.value, setValue]
}

export default useLocalStorageState
