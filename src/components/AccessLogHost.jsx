import React, { useEffect, useRef, useState } from 'react'
import { loadScreen } from '../services/screenAssets'

export default function AccessLogHost() {
  const element = useRef(null)
  const [ready, setReady] = useState(!!window.__MSM_LOGS__)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    loadScreen('logs', '__MSM_LOGS__').then(() => { if (active) setReady(true) }).catch(error => { if (active) setError(error.message) })
    return () => { active = false }
  }, [])
  useEffect(() => {
    const ready = () => setReady(true)
    window.addEventListener('msm-logs-ready', ready)
    return () => window.removeEventListener('msm-logs-ready', ready)
  }, [])
  useEffect(() => {
    if (ready) return window.__MSM_LOGS__.mount(element.current)
  }, [ready])
  return <>{error && <div className="gas-notice is-error">{error}<button onClick={() => { setError(''); loadScreen('logs', '__MSM_LOGS__').then(() => setReady(true)).catch(error => setError(error.message)) }}>{'\uB2E4\uC2DC \uC2DC\uB3C4'}</button></div>}{!ready && <div className="gas-notice">접속 로그 화면을 불러오는 중…</div>}<div ref={element} className="gas-logs-root" /></>
}
