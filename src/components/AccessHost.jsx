import React, { useEffect, useRef, useState } from 'react'
import { loadScreen } from '../services/screenAssets'

export default function AccessHost({ session }) {
  const element = useRef(null)
  const [ready, setReady] = useState(!!window.__MSM_ACCESS__)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    loadScreen('access', '__MSM_ACCESS__').then(() => { if (active) setReady(true) }).catch(error => { if (active) setError(error.message) })
    return () => { active = false }
  }, [])
  useEffect(() => {
    const ready = () => setReady(true)
    window.addEventListener('msm-access-ready', ready)
    return () => window.removeEventListener('msm-access-ready', ready)
  }, [])
  useEffect(() => {
    if (ready) return window.__MSM_ACCESS__.mount(element.current, session)
  }, [ready, session])
  return <>{error && <div className="gas-notice is-error">{error}<button onClick={() => { setError(''); loadScreen('access', '__MSM_ACCESS__').then(() => setReady(true)).catch(error => setError(error.message)) }}>{'\uB2E4\uC2DC \uC2DC\uB3C4'}</button></div>}{!ready && <div className="gas-notice">권한 관리 화면을 불러오는 중…</div>}<div ref={element} className="gas-access-root" /></>
}
