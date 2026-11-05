import React, { useEffect, useRef, useState } from 'react'
import { loadScreen } from '../services/screenAssets'

export default function FullListHost({ session }) {
  const element = useRef(null)
  const [ready, setReady] = useState(!!window.__MSM_LIST__)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    loadScreen('list', '__MSM_LIST__').then(() => { if (active) setReady(true) }).catch(error => { if (active) setError(error.message) })
    return () => { active = false }
  }, [])
  useEffect(() => {
    const ready = () => setReady(true)
    window.addEventListener('msm-list-ready', ready)
    return () => window.removeEventListener('msm-list-ready', ready)
  }, [])
  useEffect(() => {
    if (ready) return window.__MSM_LIST__.mount(element.current, session)
  }, [ready, session])
  return <>{error && <div className="gas-notice is-error">{error}<button onClick={() => { setError(''); loadScreen('list', '__MSM_LIST__').then(() => setReady(true)).catch(error => setError(error.message)) }}>{'\uB2E4\uC2DC \uC2DC\uB3C4'}</button></div>}{!ready && <div className="gas-notice">전체 목록을 불러오는 중…</div>}<div ref={element} className="gas-list-root" /></>
}
