import React, { useEffect, useRef, useState } from 'react'
import Dashboard from './pages/Dashboard'
import { callGas } from './services/gasApi'
import { safeStorage } from './services/storage'
import { loadDashboard } from './services/dashboardRepository'
import WeeklyHost from './components/WeeklyHost'
import { invalidateMonthChecks } from './services/monthCache'
import AccessHost from './components/AccessHost'
import useVisibleRefresh from './hooks/useVisibleRefresh'
import AccessLogHost from './components/AccessLogHost'
import FullListHost from './components/FullListHost'
import { configureDataAccess } from './services/dataAccess'
import PageCoachMarks from './components/PageCoachMarks'

export default function App() {
  const [session, setSession] = useState(null)
  const [displayName, setDisplayName] = useState('')
  const [month, setMonth] = useState('')
  const [payload, setPayload] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [revision, setRevision] = useState(0)
  const [dataRevision, setDataRevision] = useState(0)
  const [view, setView] = useState(() => safeStorage.getItem('gas-msm:view') === 'weekly' ? 'weekly' : 'monthly')
  const requestId = useRef(0)
  useVisibleRefresh(!!session && view === 'monthly', () => setDataRevision(value => value + 1))
  useEffect(() => {
    document.documentElement.dataset.glass = 'on'
    const reload = () => { setSession(null); setPayload(null); setRevision(value => value + 1) }
    window.addEventListener('msm-permissions-changed', reload)
    // 권한 분리 전 캐시는 다시 읽지 않고 삭제합니다.
    try { indexedDB.deleteDatabase('msm-gas-months-v1') } catch {}
    return () => window.removeEventListener('msm-permissions-changed', reload)
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setPayload(null)
    setSession(null)
    setDisplayName('')
    setRefreshing(false)
    callGas('getDashboardBootstrap').then(result => {
      if (!active) return
      const saved = safeStorage.getItem(`gas-msm:month:${result.email}`)
      if (revision > 0) invalidateMonthChecks(result.email)
      configureDataAccess(result)
      setSession(result)
      void callGas('getDashboardIdentity').then(identity => {
        if (active && identity.email === result.email) setDisplayName(identity.displayName || '')
      }).catch(() => {})
      if (!globalThis.__MSM_VISIT_RECORDED__) {
        globalThis.__MSM_VISIT_RECORDED__ = true
        void callGas('recordDashboardVisit').catch(() => {})
      }
      if (['access', 'logs'].includes(view) && !result.canManageAccess) setView('monthly')
      setMonth(result.months.includes(saved) ? saved : result.months.at(-1) || result.currentMonth)
    }).catch(error => { if (active) { setError(error.message); setLoading(false) } })
    return () => { active = false }
  }, [revision])

  useEffect(() => {
    if (!session || !month) return
    if (view !== 'monthly') { setLoading(false); setRefreshing(false); return }
    const id = ++requestId.current
    let active = true
    const alreadyShown = payload?.month === month
    setPayload(previous => previous?.month === month ? previous : null)
    setLoading(!alreadyShown)
    setRefreshing(alreadyShown)
    setError('')
    loadDashboard(session.email, month, { onCached: result => {
      if (!active || id !== requestId.current) return
      setPayload(result)
      setLoading(false)
      setRefreshing(true)
    } }).then(result => {
      if (!active || id !== requestId.current) return
      setPayload(result)
      safeStorage.setItem(`gas-msm:month:${session.email}`, month)
    }).catch(error => { if (active && id === requestId.current) { setPayload(null); setError(error.message) } })
      .finally(() => { if (active && id === requestId.current) { setLoading(false); setRefreshing(false) } })
    return () => { active = false }
  }, [session, month, view, dataRevision])

  return <>
    <header className="gas-header"><div><strong>경쟁사 분석</strong><nav className="gas-view-nav" aria-label="분석 화면">{[['monthly', '월간 대시보드'], ['weekly', '주간 편성표'], ['list', '전체 목록'], ...(session?.canManageAccess ? [['access', '권한 관리'], ['logs', '접속 로그']] : [])].map(([key, label]) => <button key={key} aria-pressed={view === key} onClick={() => { if (['monthly', 'weekly'].includes(key)) safeStorage.setItem('gas-msm:view', key); setView(key) }}>{label}</button>)}</nav></div>
      <div>{session && view === 'monthly' && <label>조회 월 <select aria-label="조회 가능한 월" value={month} onChange={event => setMonth(event.target.value)}>
        {!session.months.includes(month) && <option value={month}>{month}</option>}
        {session.months.map(value => <option key={value} value={value}>{value.slice(0, 4)}년 {value.slice(4)}월</option>)}
      </select></label>}{session && <><PageCoachMarks key={`${view}:${session.role}`} view={view} session={session} /><span className="gas-user-identity"><strong>{displayName || session.email}</strong>{displayName && <span className="gas-user-email">{session.email}</span>}<span className="gas-user-role">{session.canManageAccess ? '관리자' : session.canViewRevenue ? '매출 권한' : '일반 뷰어'}</span></span></>}</div>
    </header>
    {loading && <div className="gas-notice" role="status">경쟁사 데이터를 불러오는 중…</div>}
    {refreshing && view === 'monthly' && <div className="gas-cache-status" role="status">저장된 데이터 표시 중 · 최신 버전 확인 중…</div>}
    {error && <div className="gas-notice is-error" role="alert">{error}<button onClick={() => setRevision(value => value + 1)}>다시 시도</button></div>}
    {view === 'weekly' && session && <WeeklyHost session={session} />}
    {view === 'access' && session?.canManageAccess && <AccessHost session={session} />}
    {view === 'logs' && session?.canManageAccess && <AccessLogHost />}
    {view === 'list' && session && <FullListHost session={session} />}
    <div className="gas-monthly-pane" hidden={view !== 'monthly'}>
    {payload && payload.month === month && <>
      {!payload.previous && <div className="gas-notice">전월 데이터가 없어 전월 비교를 표시하지 않습니다.</div>}
      <Dashboard key={session.email} month={month} data={payload.current.data} previousData={payload.previous?.data || null} canViewRevenue={session.canViewRevenue === true} canManageAccess={session.canManageAccess === true} version={payload.current.updatedAt} onDataSaved={() => { invalidateMonthChecks(session.email); setDataRevision(value => value + 1) }} />
    </>}
    </div>
  </>
}
