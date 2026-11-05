import React, { useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { fitCalendarTooltip } from '../../utils/fitCalendarTooltip'

const format = value => Number(value || 0).toLocaleString('ko-KR', { maximumFractionDigits: 2 })
const time = row => `${String(row.hour).padStart(2, '0')}:${String(row.minute).padStart(2, '0')}`

export default function CompetitorBrandBroadcastTooltip({ id, brand, company, broadcasts, channels, anchor, boundaryRef, onKeepOpen, onLeave, canViewRevenue = false }) {
  const root = useRef(null)
  useLayoutEffect(() => {
    const position = () => fitCalendarTooltip(root.current, anchor, boundaryRef?.current)
    position()
    const observer = new ResizeObserver(position)
    if (boundaryRef?.current) observer.observe(boundaryRef.current)
    window.addEventListener('resize', position)
    return () => { observer.disconnect(); window.removeEventListener('resize', position) }
  }, [anchor, broadcasts, boundaryRef])
  return createPortal(<section ref={root} id={id} role="tooltip" className="competitor-brand-broadcast-tooltip" onPointerEnter={onKeepOpen} onPointerLeave={onLeave} onFocusCapture={onKeepOpen}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) onLeave() }}>
    <header><strong>{brand}</strong><span>{company} · 금주 방송 {broadcasts.length}건</span></header>
    <div className="competitor-brand-broadcast-list" tabIndex={0} aria-label={`${brand} 방송 상세 목록`}><table><thead><tr><th scope="col">방송일시{company === 'SSG' ? ' · 채널' : ''}</th><th scope="col">상품명</th><th scope="col">가중분</th><th scope="col">판매가격</th><th scope="col" title="페이지 소스의 방송시작 재고수량 - 방송종료 재고수량">판매수량</th>{canViewRevenue && <th scope="col">매출액</th>}</tr></thead><tbody>
      {broadcasts.map(row => <tr key={row.id}><td>{row.date} {time(row)}{company === 'SSG' ? ` · ${channels.get(row) || '전체'}` : ''}</td><td>{row.productName || row.dataProductName || '상품명 없음'}</td><td>{row.weightedMin == null ? '—' : `${format(row.weightedMin)}분`}</td><td>{format(row.price)}원</td><td title="페이지 소스의 방송시작 재고수량 - 방송종료 재고수량">{format(row.salesQty)}개</td>{canViewRevenue && <td>{format(row.revenue)}원</td>}</tr>)}
      {!broadcasts.length && <tr><td colSpan={canViewRevenue ? 6 : 5}>금주 방송이 없는 브랜드입니다.</td></tr>}
    </tbody></table></div>
  </section>, document.body)
}
