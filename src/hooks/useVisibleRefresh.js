import { useCallback, useEffect, useRef } from 'react'

// 브라우저 탭으로 돌아올 때만 확인합니다. 주기적 폴링은 하지 않습니다.
export default function useVisibleRefresh(enabled, refresh, paused = false) {
  const callback = useRef(refresh)
  const pause = useRef(paused)
  const pending = useRef(false)
  const timer = useRef(null)
  const available = useRef(enabled)
  callback.current = refresh
  pause.current = paused
  available.current = enabled
  const requestRefresh = useCallback(() => {
    if (!available.current || document.visibilityState !== 'visible') return
    clearTimeout(timer.current)
    if (pause.current) { pending.current = true; return }
    timer.current = setTimeout(() => {
      if (!available.current || document.visibilityState !== 'visible') { pending.current = true; return }
      if (pause.current) pending.current = true
      else { pending.current = false; callback.current() }
    }, 180)
  }, [])
  useEffect(() => {
    if (enabled && !paused && pending.current) {
      requestRefresh()
    }
  }, [enabled, paused, requestRefresh])
  useEffect(() => {
    if (!enabled) return
    const check = requestRefresh
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', check)
    return () => {
      clearTimeout(timer.current)
      pending.current = false
      window.removeEventListener('focus', check)
      document.removeEventListener('visibilitychange', check)
    }
  }, [enabled, requestRefresh])
  return requestRefresh
}
