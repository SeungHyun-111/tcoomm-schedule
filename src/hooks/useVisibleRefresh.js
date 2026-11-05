import { useEffect, useRef } from 'react'

// 브라우저 탭으로 돌아올 때만 확인합니다. 주기적 폴링은 하지 않습니다.
export default function useVisibleRefresh(enabled, refresh) {
  const callback = useRef(refresh)
  callback.current = refresh
  useEffect(() => {
    if (!enabled) return
    const check = () => { if (document.visibilityState === 'visible') callback.current() }
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', check)
    return () => {
      window.removeEventListener('focus', check)
      document.removeEventListener('visibilitychange', check)
    }
  }, [enabled])
}
