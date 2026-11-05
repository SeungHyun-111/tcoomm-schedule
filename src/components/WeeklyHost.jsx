import React, { useEffect, useRef, useState } from 'react'
import { loadScreen } from '../services/screenAssets'

export default function WeeklyHost({ session }) {
  const element = useRef(null)
  const [ready, setReady] = useState(!!window.__MSM_WEEKLY__)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    loadScreen('weekly', '__MSM_WEEKLY__').then(() => { if (active) setReady(true) }).catch(error => { if (active) setError(error.message) })
    return () => { active = false }
  }, [])
  useEffect(() => {
    const ready = () => setReady(true)
    window.addEventListener('msm-weekly-ready', ready)
    return () => window.removeEventListener('msm-weekly-ready', ready)
  }, [])
  useEffect(() => {
    if (ready) return window.__MSM_WEEKLY__.mount(element.current, session)
  }, [ready, session])
  return <>{error && <div className="gas-notice is-error">{error}<button onClick={() => { setError(''); loadScreen('weekly', '__MSM_WEEKLY__').then(() => setReady(true)).catch(error => setError(error.message)) }}>{'\uB2E4\uC2DC \uC2DC\uB3C4'}</button></div>}{!ready && <div className="gas-notice">주간 편성표를 불러오는 중…</div>}<div ref={element} className="gas-weekly-root" /></>
}
