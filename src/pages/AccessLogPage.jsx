import React, { useEffect, useState } from 'react'
import { callGas } from '../services/gasApi'
import DataChangeLogPanel from '../components/DataChangeLogPanel'

const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const range = days => { const end = today(); return { start: new Date(Date.parse(end) - (days - 1) * 86400000).toISOString().slice(0, 10), end } }
const format = value => Number(value || 0).toLocaleString('ko-KR')
const time = value => new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false })

export default function AccessLogPage() {
  const [draft, setDraft] = useState(() => ({ ...range(7), email: '', result: 'all' }))
  const [query, setQuery] = useState(() => ({ ...range(7), email: '', result: 'all', page: 1 }))
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    callGas('getAccessLogReport', query).then(result => { if (active) setReport(result) })
      .catch(error => { if (active) { setReport(null); setError(error.message) } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [query])
  const change = (key, value) => setDraft(previous => ({ ...previous, [key]: value }))
  const apply = event => { event.preventDefault(); setQuery({ ...draft, page: 1 }) }
  const preset = days => { const next = { ...draft, ...range(days) }; setDraft(next); setQuery({ ...next, page: 1 }) }
  const maximum = Math.max(1, ...(report?.daily || []).map(item => item.total))
  return <main className="logs-page">
    <header><span>ACCESS ANALYTICS</span><h1>접속 로그</h1><p>최초 페이지 접속과 새로고침 이력입니다. 메뉴 이동과 데이터 재조회는 접속 횟수에 포함하지 않습니다.</p></header>
    <form className="logs-card logs-filters" onSubmit={apply}>
      <label>시작일<input type="date" required aria-label="로그 시작일" value={draft.start} max={draft.end} onChange={event => change('start', event.target.value)} /></label>
      <label>종료일<input type="date" required aria-label="로그 종료일" value={draft.end} min={draft.start} onChange={event => change('end', event.target.value)} /></label>
      <label className="logs-email">이메일<input type="search" aria-label="로그 이메일 검색" placeholder="이메일 전체 또는 일부" maxLength={128} value={draft.email} onChange={event => change('email', event.target.value)} /></label>
      <label>접속 결과<select aria-label="로그 접속 결과" value={draft.result} onChange={event => change('result', event.target.value)}><option value="all">전체</option><option value="allowed">허용</option><option value="denied">거부</option></select></label>
      <button className="logs-submit" disabled={loading}>조회</button>
      <div className="logs-presets">{[[1, '오늘'], [7, '7일'], [30, '30일']].map(([days, label]) => <button type="button" key={days} disabled={loading} onClick={() => preset(days)}>{label}</button>)}</div>
    </form>
    {error && <p className="logs-error" role="alert">{error}</p>}
    {loading && <p className="logs-loading" role="status">접속 로그를 조회하는 중…</p>}
    {report && <div aria-busy={loading} className={loading ? 'logs-results is-loading' : 'logs-results'}>
      <p className="logs-range">{report.range.start} ~ {report.range.end} · 한국 시간 기준{report.range.email ? ` · 이메일: ${report.range.email}` : ''}{report.range.result !== 'all' ? ` · ${report.range.result === 'allowed' ? '허용' : '거부'}` : ''}</p>
      <section className="logs-stats" aria-label="접속 통계">{[['총 접속', report.stats.total, '건'], ['접속 사용자', report.stats.uniqueUsers, '명'], ['허용', report.stats.allowed, '건'], ['거부', report.stats.denied, '건'], ['일평균', report.stats.dailyAverage, '건']].map(([label, value, unit]) => <article className="logs-card" key={label}><span>{label}</span><strong>{format(value)}<small>{unit}</small></strong></article>)}</section>
      <section className="logs-card"><h2>일별 접속 추이</h2><div className="logs-chart" aria-label="일별 접속 막대 그래프">{report.daily.map(item => <div className="logs-chart-day" key={item.date} title={`${item.date}: ${item.total}건 (허용 ${item.allowed}, 거부 ${item.denied})`}><b>{item.total || ''}</b><div className="logs-chart-track"><div className="logs-chart-bar" style={{ height: `${item.total / maximum * 100}%`, minHeight: item.total ? 3 : 0 }} /></div><span>{item.date.slice(5)}</span></div>)}</div></section>
      <section className="logs-card"><h2>사용자별 접속 통계 <small>{report.users.length}명</small></h2><div className="logs-user-scroll"><table><thead><tr><th>이메일</th><th>접속</th><th>허용</th><th>거부</th><th>마지막 접속</th></tr></thead><tbody>{report.users.map(item => <tr key={item.email}><td>{item.email}</td><td>{format(item.total)}</td><td>{format(item.allowed)}</td><td>{format(item.denied)}</td><td>{time(item.lastAccessedAt)}</td></tr>)}{!report.users.length && <tr><td colSpan={5}>검색 조건에 해당하는 사용자가 없습니다.</td></tr>}</tbody></table></div></section>
      <section className="logs-card"><div className="logs-table-heading"><h2>접속 이력 <small>{format(report.stats.total)}건</small></h2><span>최근 접속 순 · 페이지당 {report.pageSize}건</span></div><div className="logs-table-scroll"><table><thead><tr><th>접속 일시 (KST)</th><th>이메일</th><th>접속 결과</th></tr></thead><tbody>{report.rows.map(item => <tr key={item.id}><td>{time(item.accessedAt)}</td><td>{item.email || '이메일 확인 불가'}</td><td><span className={`logs-badge ${item.result}`}>{item.result === 'allowed' ? '허용' : '거부'}</span></td></tr>)}{!report.rows.length && <tr><td colSpan={3}>검색 조건에 해당하는 접속 로그가 없습니다.</td></tr>}</tbody></table></div><nav className="logs-pagination" aria-label="접속 로그 페이지"><button disabled={loading || report.page <= 1} onClick={() => setQuery(previous => ({ ...previous, page: report.page - 1 }))}>이전</button><span>{report.page} / {report.pages}</span><button disabled={loading || report.page >= report.pages} onClick={() => setQuery(previous => ({ ...previous, page: report.page + 1 }))}>다음</button></nav></section>
    </div>}
    <DataChangeLogPanel query={query} />
  </main>
}
