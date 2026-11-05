import { useEffect, useState } from 'react'

function resolveDefault(defaultValue) {
  return typeof defaultValue === 'function' ? defaultValue() : defaultValue
}

function readStoredValue(key, defaultValue) {
  try {
    const raw = window.localStorage.getItem(key)
    if (raw != null) return JSON.parse(raw)
  } catch {
    // Ignore broken or unavailable localStorage and fall back to defaults.
  }
  return resolveDefault(defaultValue)
}

export default function useLocalStorageState(key, defaultValue) {
  const [state, setState] = useState(() => ({
    key,
    value: readStoredValue(key, defaultValue),
  }))

  useEffect(() => {
    try {
      window.localStorage.setItem(state.key, JSON.stringify(state.value))
    } catch {
      // Local UI restore is optional; storage failures should not break the app.
    }
  }, [state])

  if (state.key !== key) {
    const nextState = {
      key,
      value: readStoredValue(key, defaultValue),
    }
    setState(nextState)
    return [
      nextState.value,
      updater => setState(prev => ({
        key: prev.key,
        value: typeof updater === 'function' ? updater(prev.value) : updater,
      })),
    ]
  }

  const setValue = updater => setState(prev => ({
    key: prev.key,
    value: typeof updater === 'function' ? updater(prev.value) : updater,
  }))

  return [state.value, setValue]
}
