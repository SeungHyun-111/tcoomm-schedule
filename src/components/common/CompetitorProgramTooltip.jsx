import React, { useEffect, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { fitCalendarTooltip } from '../../utils/fitCalendarTooltip'

export default function CompetitorProgramTooltip({ detail, id, onClose, boundaryRef, canViewRevenue = false }) {
  const element = useRef(null)
  useLayoutEffect(() => {
    let pointer = detail.pointer
    let frame
    const position = () => {
      const anchor = pointer ? { left: pointer.x, right: pointer.x, top: pointer.y, bottom: pointer.y } : detail.anchor
      fitCalendarTooltip(element.current, anchor, boundaryRef?.current, 'below')
    }
    const followPointer = event => {
      if (!detail.pointer) return
      pointer = { x: event.clientX, y: event.clientY }
      if (frame) return
      frame = requestAnimationFrame(() => { frame = null; position() })
    }
    position()
    const observer = new ResizeObserver(position)
    if (boundaryRef?.current) observer.observe(boundaryRef.current)
    document.addEventListener('pointermove', followPointer)
    return () => { observer.disconnect(); document.removeEventListener('pointermove', followPointer); cancelAnimationFrame(frame) }
  }, [detail, boundaryRef])
  useEffect(() => {
    const close = () => onClose(null)
    const escape = event => { if (event.key === 'Escape') close() }
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    window.addEventListener('keydown', escape)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
      window.removeEventListener('keydown', escape)
    }
  }, [onClose])
  const { row, company, channel, label, duration, continuation } = detail
  const fields = [
    ...(company === 'SSG' || channel ? [['채널', channel || '전체']] : []),
    ['브랜드', row.brand],
    ['상품명', row.productName || row.dataProductName],
    ...(row.dataProductName && row.dataProductName !== row.productName ? [['데이터 상품명', row.dataProductName]] : []),
    ['카테고리', row.mdCategory],
    ['조직명', row.org],
    ...(canViewRevenue ? [['매출액', `${Number(row.revenue || 0).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}원`]] : []),
    ['판매가격', `${Number(row.price || 0).toLocaleString('ko-KR')}원`],
    ['판매수량', `${Number(row.salesQty || 0).toLocaleString('ko-KR')}개`],
    ['방송일', row.date],
    ['방송시간', `${label}${continuation ? ' · 전날 시작' : ''}`],
    ['방송 길이', duration ? `${duration}분` : '미등록'],
    ['가중분', row.weightedMin != null ? `${row.weightedMin}분` : '미등록'],
  ]
  return createPortal(<div ref={element} id={id} role="tooltip" className="competitor-program-tooltip">
    <strong>방송 상세</strong>
    <dl>{fields.map(([name, value]) => <div key={name} title={name === '판매수량' ? '페이지 소스의 방송시작 재고수량 - 방송종료 재고수량' : undefined}><dt>{name}</dt><dd>{value || '—'}</dd></div>)}</dl>
  </div>, document.body)
}
