import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import dayjs from 'dayjs'
import { fetchScheduleWeek, saveScheduleWeek } from '../services/competitorSchedule'
import './CompetitorPage.css'
import CompetitorProgramTooltip from '../components/common/CompetitorProgramTooltip'
import { buildCompetitorTimeline, PIXELS_PER_MINUTE } from '../utils/competitorTimeline'
import CompetitorOrganizationFilter from '../components/common/CompetitorOrganizationFilter'
import { summarizeCompetitorHighlights } from '../utils/competitorHighlight'
import CompetitorBrandSummary from '../components/common/CompetitorBrandSummary'
import useLocalStorageState from '../hooks/useLocalStorageState'
import './CompetitorGas.css'
import useVisibleRefresh from '../hooks/useVisibleRefresh'

const DAYS = ['월', '화', '수', '목', '금', '토', '일']
const HOURS = Array.from({ length: 24 }, (_, hour) => hour)
const organization = row => String(row.org || '').trim() || '조직 미등록'
const number = value => Number(value || 0).toLocaleString('ko-KR', { maximumFractionDigits: 0 })
const monday = value => {
  const date = dayjs(value)
  return date.subtract((date.day() + 6) % 7, 'day').format('YYYY-MM-DD')
}

export default function CompetitorPage({ session }) {
  const [company, setCompany] = useLocalStorageState(`gas-weekly:${session.email}:company`, 'SSG')
  const calendarBoundary = useRef(null)
  const [highlightSearch, setHighlightSearch] = useState('')
  const [selectedOrganizations, setSelectedOrganizations] = useState([])
  const [verticalScale, setVerticalScale] = useState(100)
  const [scaleInput, setScaleInput] = useState('100')
  const pixelsPerMinute = PIXELS_PER_MINUTE * verticalScale / 100
  const [savedWeek, saveWeek] = useLocalStorageState(`gas-weekly:${session.email}:week`, session.competitorWeek || '')
  const [preferenceError, setPreferenceError] = useState('')
  const week = /^\d{4}-\d{2}-\d{2}$/.test(savedWeek) && dayjs(savedWeek).isValid() ? monday(savedWeek) : monday(`${session.months.at(-1)?.slice(0, 4) || new Date().getFullYear()}-${session.months.at(-1)?.slice(4) || '01'}-01`)
  const setWeek = value => {
    saveWeek(value)
    setPreferenceError('')
    saveScheduleWeek(session.email, value).catch(error => setPreferenceError(error.message))
  }
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const rowsKey = useRef('')
  useVisibleRefresh(true, () => setRevision(value => value + 1))
  const [tooltip, setTooltip] = useState(null)
  const tooltipId = useId()
  useEffect(() => {
    if (!week) return
    const controller = new AbortController()
    const dates = Array.from({ length: 8 }, (_, i) => dayjs(week).add(i - 1, 'day').format('YYYY-MM-DD'))
    const key = `${session.email}|${company}|${week}`
    if (rowsKey.current !== key) { setLoading(true); setRows([]) }
    setError('')
    fetchScheduleWeek(session.email, company, dates, controller.signal, undefined, data => {
      if (!controller.signal.aborted) { rowsKey.current = key; setRows(data); setLoading(false) }
    }).then(data => {
      if (!controller.signal.aborted) { rowsKey.current = key; setRows(data) }
    }).catch(e => { if (!controller.signal.aborted && e.name !== 'AbortError') { rowsKey.current = ''; setRows([]); setError(e.message) } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [session.email, company, week, revision])
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => dayjs(week || undefined).add(i, 'day')), [week])
  const organizations = useMemo(() => [...new Set(rows.map(organization))].sort((a, b) => a.localeCompare(b, 'ko')), [rows])
  const weekRows = useMemo(() => rows.filter(row => row.date >= week), [rows, week])
  // Organization selection only changes emphasis; every broadcast keeps its position.
  const timeline = useMemo(() => buildCompetitorTimeline(rows, days.map(date => date.format('YYYY-MM-DD')), company), [rows, days, company])
  const highlights = useMemo(() => summarizeCompetitorHighlights(timeline, highlightSearch, selectedOrganizations), [timeline, highlightSearch, selectedOrganizations])
  const reset = () => { setLoading(true); setError(''); setRows([]); setTooltip(null) }
  const showTooltip = (event, detail) => setTooltip({ ...detail, company, anchor: event.currentTarget.getBoundingClientRect(), pointer: Number.isFinite(event.clientX) && !(event.type === 'click' && event.detail === 0) ? { x: event.clientX, y: event.clientY } : null })
  const changeWeek = value => { if (value === week) return; reset(); setWeek(value) }
  const refresh = () => { reset(); setRevision(value => value + 1) }
  const move = offset => changeWeek(dayjs(week).add(offset, 'week').format('YYYY-MM-DD'))
  return <section className="competitor-page forecast-page is-urban">
    <header className="competitor-toolbar">
      <div className="competitor-toolbar-left">
      <h2>경쟁사 주간 편성표</h2>
      <div className="competitor-channels" role="group" aria-label="경쟁사 채널">{['SSG', 'K'].map(channel => <button key={channel} aria-pressed={company === channel} onClick={() => { if (company !== channel) { reset(); setSelectedOrganizations([]); setCompany(channel) } }}>{channel}</button>)}</div>
      <CompetitorOrganizationFilter options={organizations} selected={selectedOrganizations} onChange={value => { setTooltip(null); setSelectedOrganizations(value) }} />
      <CompetitorBrandSummary company={company} week={week} rows={rows} loading={loading} revision={revision} preferredOrganization={selectedOrganizations[0]} boundaryRef={calendarBoundary} email={session.email} canViewRevenue={session.canViewRevenue === true} />
      <label className="competitor-scale">세로 배율 <input type="number" min="0" step="any" aria-label="편성표 세로 배율" value={scaleInput}
        onChange={event => {
          const value = event.target.value
          setScaleInput(value)
          const scale = Number(value)
          if (Number.isFinite(scale) && scale > 0) { setTooltip(null); setVerticalScale(scale) }
        }}
        onBlur={() => setScaleInput(String(verticalScale))}
        onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }} />%</label>
      </div>
      <div className="competitor-toolbar-center">
        <div className="competitor-week"><button disabled={!week} onClick={() => move(-1)} aria-label="이전 주">‹</button><label className="competitor-week-picker"><span>{week ? `${dayjs(week).format('YYYY년 M월 D일')} 주차` : '주차 선택'}</span><input type="date" aria-label="조회 주차" value={week} onChange={e => { if (e.target.value) changeWeek(monday(e.target.value)) }} /></label><button disabled={!week} onClick={() => move(1)} aria-label="다음 주">›</button></div>

        <div className="competitor-highlight-search" role="search" aria-label="편성표 하이라이트 검색">
          <input type="search" aria-label="편성표 하이라이트 검색어" placeholder="브랜드·상품·카테고리·조직 검색" value={highlightSearch}
            onChange={event => { setTooltip(null); setHighlightSearch(event.target.value) }}
            onKeyDown={event => { if (event.key === 'Escape') setHighlightSearch('') }} />
          {highlightSearch && <button type="button" aria-label="하이라이트 검색 지우기" onClick={() => setHighlightSearch('')}>×</button>}
          {highlights.query && <div className="competitor-highlight-summary" role="status" aria-live="polite">
            <strong>“{highlightSearch.trim()}”</strong>
            {loading ? <span>불러오는 중…</span> : <><span>PGM <b>{number(highlights.count)}</b>건</span><span>가중분 <b>{highlights.weightedMin.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}</b>분</span>{session.canViewRevenue === true && <span>매출액 <b>{number(highlights.revenue)}</b>원</span>}{highlights.count === 0 && <span>일치하는 방송이 없습니다.</span>}</>}
            <small>현재 채널·주차·조직 기준</small>
          </div>}
        </div>
      </div>
    </header>
    {preferenceError && <div className="competitor-message" role="status">{preferenceError} · 이 브라우저의 선택은 유지됩니다.</div>}
    {error && <div className="competitor-message" role="alert">{error} <button onClick={refresh}>다시 시도</button></div>}
    {!loading && !error && ![...timeline.values()].some(blocks => blocks.length) && <div className="competitor-message">선택한 주에 저장된 방송이 없습니다.</div>}
    <div className="competitor-schedule-layout">
    <div ref={calendarBoundary} className="competitor-grid-scroll" aria-busy={loading}>
      <div className="competitor-timeline" style={{ '--hour-height': `${60 * pixelsPerMinute}px` }}>
        <div className="competitor-timeline-head"><div>시간</div>{days.map((date, i) => <div key={i} className={i > 4 ? 'weekend' : ''}>{date.format('MM.DD')} ({DAYS[i]})<small>{loading ? '—' : `${weekRows.filter(row => row.date === date.format('YYYY-MM-DD')).length}건`}</small></div>)}</div>
        <div className="competitor-timeline-body" style={{ height: 1440 * pixelsPerMinute }}>
          <div className="competitor-time-axis">{HOURS.map(hour => <span key={hour} style={{ top: hour * 60 * pixelsPerMinute }}>{String(hour).padStart(2, '0')}:00</span>)}</div>
          {days.map(date => <div className="competitor-day-track" key={date.format('YYYY-MM-DD')} aria-label={date.format('YYYY-MM-DD')}>
            {(timeline.get(date.format('YYYY-MM-DD')) || []).map(({ row, channel, start, end, duration, label, continuation, lane, lanes }) => <article className={`competitor-program${end - start < 35 ? ' compact' : ''}${duration ? '' : ' unknown-duration'}${selectedOrganizations.length ? selectedOrganizations.includes(organization(row)) ? ' organization-hit' : ' organization-miss' : ''}${highlights.query ? highlights.matchedIds.has(row.id) ? ' search-hit' : ' search-miss' : ''}`} key={`${row.id}-${continuation}`} tabIndex={0}
              data-organization={organization(row)}
              data-channel={company === 'SSG' ? channel || 'ALL' : undefined}
              aria-label={row.brand || '브랜드 미등록'}
              aria-describedby={tooltip?.row.id === row.id && tooltip?.continuation === continuation ? tooltipId : undefined}
              onPointerEnter={event => showTooltip(event, { row, channel, label, duration, continuation })}
              onPointerLeave={() => setTooltip(null)}
              onFocus={event => showTooltip(event, { row, channel, label, duration, continuation })}
              onBlur={() => setTooltip(null)}
              onClick={event => showTooltip(event, { row, channel, label, duration, continuation })}
              style={{ top: start * pixelsPerMinute, height: (end - start) * pixelsPerMinute, left: `calc(${lane / lanes * 100}% + 2px)`, width: `calc(${100 / lanes}% - 4px)` }}>
              <div className="competitor-program-meta"><b>{channel ? `${channel} · ` : ''}{continuation ? '전날 시작 · ' : ''}{label} · 단순 {duration ? `${duration}분` : '미등록'}</b><span>가중 {row.weightedMin != null ? `${number(row.weightedMin)}분` : '미등록'}</span></div>
              <div className="competitor-program-main"><strong className="competitor-program-brand">{row.brand || '브랜드 미등록'}</strong><b className="competitor-program-revenue">{session.canViewRevenue === true ? `${number(row.revenue)}원` : `판매가 ${number(row.price)}원 · 수량 ${number(row.salesQty)}개`}</b></div>
              <div className="competitor-program-footer"><span>{row.mdCategory || row.org}</span></div>
            </article>)}
          </div>)}
        </div>
      </div>
    </div>
    </div>
    {tooltip && <CompetitorProgramTooltip detail={tooltip} id={tooltipId} onClose={setTooltip} boundaryRef={calendarBoundary} canViewRevenue={session.canViewRevenue === true} />}
  </section>
}
