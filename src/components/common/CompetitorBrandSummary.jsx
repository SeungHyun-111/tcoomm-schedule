import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import dayjs from 'dayjs'
import { fetchScheduleWeek } from '../../services/competitorSchedule'
import { createBrandSummaryAccumulator, getBrandSummaryRows, getBrandSummaryTotal } from '../../utils/competitorBrandSummary'
import { inferCompetitorChannels } from '../../utils/competitorTimeline'
import CompetitorBrandBroadcastTooltip from './CompetitorBrandBroadcastTooltip'

const format = value => Number(value || 0).toLocaleString('ko-KR', { maximumFractionDigits: 2 })
const signed = value => `${value > 0 ? '+' : ''}${format(value)}`

function MetricChange({ value, unit, unavailable, children }) {
  const rounded = value == null ? null : Number(value.toFixed(unit === '%p' ? 1 : 2))
  return <small className={rounded > 0 ? 'brand-growth-positive' : rounded < 0 ? 'brand-growth-negative' : ''}>({rounded === null ? unavailable : `${signed(rounded)}${unit}`}{children})</small>
}

function BrandMetrics({ item, unavailable, canViewRevenue }) {
  return <>
    <td>{format(item.weightedMin)}분<MetricChange value={item.weightedDifference} unit="분" unavailable={unavailable} canViewRevenue={canViewRevenue} /></td>
    <td>{item.share.toFixed(1)}%<MetricChange value={item.shareDifference} unit="%p" unavailable={unavailable} canViewRevenue={canViewRevenue} /></td>
    <td>{item.overallShare === null ? '—' : `${item.overallShare.toFixed(1)}%`}<MetricChange value={item.overallShareDifference} unit="%p" unavailable={unavailable} canViewRevenue={canViewRevenue} /></td>
    {canViewRevenue && <td>{format(item.revenue)}원<MetricChange value={item.difference} unit="원" unavailable={unavailable}>{item.difference !== null && (item.growth !== null ? ` · ${signed(Number(item.growth.toFixed(1)))}%` : item.revenue !== 0 ? ' · 신규' : '')}</MetricChange></td>}
  </>
}

function BrandSummaryPanel({ anchor, panelRef, id, company, week, rows, loading, revision, preferredOrganization, boundaryRef, onClose, email, canViewRevenue = false }) {
  const [selectedOrganization, setSelectedOrganization] = useState(preferredOrganization || '')
  const [result, setResult] = useState(null)
  const [retry, setRetry] = useState(0)
  const [hovered, setHovered] = useState(null)
  const hideTimer = useRef(null)
  const tooltipId = useId()
  const keepTooltip = () => clearTimeout(hideTimer.current)
  const hideTooltip = () => { clearTimeout(hideTimer.current); hideTimer.current = setTimeout(() => setHovered(null), 180) }
  useEffect(() => () => clearTimeout(hideTimer.current), [])
  const requestKey = `${company}-${week}-${revision}-${retry}`
  const previous = result?.key === requestKey ? result.summary : null
  const error = result?.key === requestKey ? result.error : ''
  const current = useMemo(() => {
    const summary = createBrandSummaryAccumulator()
    const end = dayjs(week).add(6, 'day').format('YYYY-MM-DD')
    for (const row of rows) if (row.date >= week && row.date <= end) summary.accept(row)
    return summary
  }, [rows, week])
  useEffect(() => {
    if (!week) return
    const controller = new AbortController()
    const dates = Array.from({ length: 7 }, (_, i) => dayjs(week).add(i - 7, 'day').format('YYYY-MM-DD'))
    const summary = createBrandSummaryAccumulator()
    // Aggregate each small response; never retain the previous week's raw broadcasts.
    fetchScheduleWeek(email, company, dates, controller.signal, summary.accept).then(() => {
      if (!controller.signal.aborted) setResult({ key: requestKey, summary: { organizations: summary.organizations, count: summary.count, weightedMin: summary.weightedMin } })
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ key: requestKey, error: error.message })
    })
    return () => controller.abort()
  }, [email, company, week, requestKey])
  const previousOrganizations = previous?.organizations
  const currentOrganizations = current.organizations
  const organizations = useMemo(() => [...new Set([...currentOrganizations.keys(), ...(previousOrganizations?.keys() || [])])].sort((a, b) => a.localeCompare(b, 'ko')), [currentOrganizations, previousOrganizations])
  const organization = organizations.includes(selectedOrganization) ? selectedOrganization : organizations[0] || ''
  const team = currentOrganizations.get(organization)
  const previousTeam = previousOrganizations?.get(organization)
  const brandRows = useMemo(() => getBrandSummaryRows(team, previousTeam, previous?.count > 0, current.weightedMin, previous?.weightedMin), [team, previousTeam, previous?.count, current.weightedMin, previous?.weightedMin])
  const total = getBrandSummaryTotal(team, previousTeam, previous?.count > 0, current.weightedMin, previous?.weightedMin)
  const unavailable = error ? '조회 실패' : !previous ? '조회 중…' : '전주 없음'
  const channels = useMemo(() => inferCompetitorChannels(rows, company), [rows, company])
  const broadcasts = useMemo(() => {
    if (!hovered) return []
    const end = dayjs(week).add(6, 'day').format('YYYY-MM-DD')
    return rows.filter(row => row.date >= week && row.date <= end
      && (String(row.org || '').trim() || '조직 미등록') === organization
      && (String(row.brand || '').trim() || '브랜드 미등록') === hovered.brand)
      .sort((a, b) => a.date.localeCompare(b.date) || a.hour - b.hour || a.minute - b.minute || (channels.get(a) === 'CA' ? 0 : 1) - (channels.get(b) === 'CA' ? 0 : 1))
  }, [rows, week, organization, hovered, channels])
  const showTooltip = (event, brand) => { keepTooltip(); setHovered({ brand, anchor: event.currentTarget.getBoundingClientRect() }) }
  useLayoutEffect(() => {
    const position = () => {
      const rect = anchor.current.getBoundingClientRect()
      const bounds = boundaryRef?.current?.getBoundingClientRect() || { left: 0, top: rect.bottom, right: window.innerWidth, bottom: window.innerHeight, width: window.innerWidth }
      const panel = panelRef.current
      panel.style.maxWidth = `${Math.max(0, bounds.width - 16)}px`
      const width = panel.getBoundingClientRect().width
      const top = Math.max(bounds.top + 8, Math.min(rect.bottom + 6, bounds.bottom - 180))
      panel.style.left = `${Math.max(bounds.left + 8, Math.min(rect.left, bounds.right - width - 8))}px`
      panel.style.top = `${top}px`
      const availableHeight = Math.max(0, bounds.bottom - top - 8)
      panel.style.maxHeight = `${availableHeight}px`
      panel.classList.toggle('is-height-compact', availableHeight < 300)
    }
    position()
    const observer = new ResizeObserver(position)
    if (boundaryRef?.current) observer.observe(boundaryRef.current)
    window.addEventListener('resize', position)
    return () => { observer.disconnect(); window.removeEventListener('resize', position) }
  }, [anchor, panelRef, boundaryRef])
  return createPortal(<section id={id} ref={panelRef} className="competitor-brand-summary-panel" role="dialog" aria-label="조직별 브랜드 요약">
    <header><strong>{company} 브랜드 요약</strong><span>{dayjs(week).format('YYYY년 M월 D일')} 주차</span><button type="button" aria-label="브랜드 요약 닫기" onClick={onClose}>×</button></header>
    <div className="competitor-brand-summary-controls"><label>조직명 <select aria-label="브랜드 요약 조직명" value={organization} onChange={event => { setHovered(null); setSelectedOrganization(event.target.value) }}>{organizations.map(name => <option key={name} value={name}>{name}</option>)}</select></label><span>팀 가중분 <b>{format(team?.weightedMin)}</b>분{canViewRevenue && <> · 매출 <b>{format(team?.revenue)}</b>원</>}</span></div>
    {loading && <p role="status">금주 데이터를 불러오는 중…</p>}
    {!previous && !error && <p role="status">전주 데이터를 불러오는 중…</p>}
    {error && <p role="alert">전주 조회 실패: {error} <button type="button" onClick={() => setRetry(value => value + 1)}>다시 시도</button></p>}
    <div className="competitor-brand-summary-table-scroll" onScroll={() => setHovered(null)}><table><thead><tr><th scope="col">브랜드</th><th scope="col">가중분</th><th scope="col">팀 내 비중</th><th scope="col">전체 편성비중</th>{canViewRevenue && <th scope="col">매출액</th>}</tr></thead><tbody>
      {brandRows.map(item => <tr key={item.brand}><th scope="row"><button className="competitor-brand-name" aria-describedby={hovered?.brand === item.brand ? tooltipId : undefined} onPointerEnter={event => showTooltip(event, item.brand)} onPointerLeave={hideTooltip} onFocus={event => showTooltip(event, item.brand)} onBlur={hideTooltip}>{item.brand}</button></th>
        <BrandMetrics item={item} unavailable={unavailable} canViewRevenue={canViewRevenue} />
      </tr>)}
      {!loading && !brandRows.length && <tr><td colSpan={canViewRevenue ? 5 : 4}>선택한 조직의 브랜드 데이터가 없습니다.</td></tr>}
    </tbody><tfoot><tr className="competitor-brand-summary-total"><th scope="row">계</th><BrandMetrics item={total} unavailable={unavailable} canViewRevenue={canViewRevenue} /></tr></tfoot></table></div>
    <footer>팀 내 비중: 조직 가중분 기준 · 전체 편성비중: {company} 전체 가중분 기준 · 괄호: 전주 대비</footer>
    {hovered && <CompetitorBrandBroadcastTooltip canViewRevenue={canViewRevenue} id={tooltipId} brand={hovered.brand} company={company} broadcasts={broadcasts} channels={channels} anchor={hovered.anchor} boundaryRef={boundaryRef} onKeepOpen={keepTooltip} onLeave={hideTooltip} />}
  </section>, document.body)
}

export default function CompetitorBrandSummary(props) {
  const [open, setOpen] = useState(false)
  const visible = open && props.active !== false
  const anchor = useRef(null)
  const panel = useRef(null)
  const id = useId()
  useEffect(() => {
    if (!visible) return
    const closeOutside = event => {
      if (props.boundaryRef) return
      if (!anchor.current?.contains(event.target) && !panel.current?.contains(event.target) && !event.target.closest?.('.competitor-brand-broadcast-tooltip')) setOpen(false)
    }
    const closeEscape = event => { if (event.key === 'Escape') { setOpen(false); anchor.current?.focus() } }
    const closeResize = () => { if (!props.boundaryRef) setOpen(false) }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeEscape)
    window.addEventListener('resize', closeResize)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeEscape)
      window.removeEventListener('resize', closeResize)
    }
  }, [visible, props.boundaryRef])
  return <><button ref={anchor} type="button" className="competitor-brand-summary-trigger" aria-expanded={visible} aria-controls={id} aria-haspopup="dialog" disabled={!props.week} onClick={() => { if (props.active === false) { setOpen(true); props.onActivate?.() } else setOpen(value => !value) }}>요약</button>
    {visible && <BrandSummaryPanel {...props} anchor={anchor} panelRef={panel} id={id} onClose={() => setOpen(false)} />}
  </>
}
