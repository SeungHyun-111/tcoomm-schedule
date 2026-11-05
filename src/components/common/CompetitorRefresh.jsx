import React, { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { callGas } from '../../services/gasApi'

export default function CompetitorRefresh({ onComplete, session }) {
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit' }).format(new Date()))
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [failed, setFailed] = useState(false)
  const lock = useRef(false)
  const run = async () => {
    if (lock.current || !month) return
    lock.current = true
    setBusy(true)
    setFailed(false)
    try {
      setStatus('원본 조회 및 RTDB 갱신 중…')
      const counts = await callGas('refreshCompetitorData', month.replace('-', ''))
      setStatus(`${month} 갱신 완료 · ${Object.entries(counts).map(([company, count]) => `${company} ${count.toLocaleString()}건`).join(' / ')}`)
      onComplete(month)
    } catch (error) {
      setFailed(true)
      setStatus(error.message)
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return <>
    <button disabled={!session.canRefresh} title={session.canRefresh ? undefined : '원본 갱신 권한 또는 원본 시트 설정이 필요합니다'} onClick={() => setOpen(value => !value)} aria-expanded={open}>RTDB 갱신</button>
    {open && createPortal(<div className="competitor-refresh-overlay"><div className="competitor-refresh-panel" role="dialog" aria-modal="true" aria-label="경쟁사 RTDB 갱신">
      <strong>경쟁사 원본 데이터 갱신</strong>
      <span>선택한 월의 SSG·K·SK 원본과 검색 인덱스를 MSM 원본 기준으로 교체합니다.</span>
      <div><input type="month" aria-label="RTDB 갱신 월" value={month} disabled={busy} onChange={event => setMonth(event.target.value)} /> <button disabled={busy || !month} onClick={run}>{busy ? '갱신 중…' : '원본 가져와 갱신'}</button> <button disabled={busy} onClick={() => setOpen(false)}>닫기</button></div>
      {status && <p role={failed ? 'alert' : 'status'}>{status}</p>}
    </div></div>, document.body)}
  </>
}
