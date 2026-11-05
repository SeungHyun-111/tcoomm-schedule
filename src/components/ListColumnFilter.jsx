import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export default function ListColumnFilter({ column, rows, filter, anchor, onApply, onSort, onClose, display }) {
  const root = useRef(null)
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState(filter?.mode || 'exclude')
  const [values, setValues] = useState(() => new Set(filter?.values || []))
  const options = useMemo(() => [...new Set(rows.map(row => display(row, column)))].sort((a, b) => a.localeCompare(b, 'ko', { numeric: true })), [rows, column, display])
  const visible = options.filter(value => value.toLocaleLowerCase('ko-KR').includes(search.toLocaleLowerCase('ko-KR')))
  useEffect(() => {
    const close = event => { if (event.type === 'keydown' ? event.key === 'Escape' : !root.current?.contains(event.target)) onClose() }
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', close)
    window.addEventListener('resize', onClose)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close); window.removeEventListener('resize', onClose) }
  }, [onClose])
  const selected = value => mode === 'exclude' ? !values.has(value) : values.has(value)
  const toggle = value => setValues(previous => { const next = new Set(previous); if (next.has(value)) next.delete(value); else next.add(value); return next })
  const top = Math.max(8, Math.min(anchor.bottom + 4, window.innerHeight - 420))
  return createPortal(<section ref={root} role="dialog" aria-label={`${column.label} 필터 설정`} className="list-column-filter" style={{ top, left: Math.max(8, Math.min(anchor.left, window.innerWidth - 290)) }}>
    <header><strong>{column.label}</strong><button aria-label="열 필터 닫기" onClick={onClose}>×</button></header>
    <div className="list-filter-sort"><button onClick={() => { onSort('asc'); onClose() }}>오름차순 ↑</button><button onClick={() => { onSort('desc'); onClose() }}>내림차순 ↓</button></div>
    <input type="search" aria-label={`${column.label} 필터 값 검색`} placeholder="값 검색" value={search} onChange={event => setSearch(event.target.value)} autoFocus />
    <div className="list-filter-actions"><button onClick={() => { setMode('exclude'); setValues(new Set()) }}>모두 선택</button><button onClick={() => { setMode('include'); setValues(new Set()) }}>모두 해제</button><span>{visible.length}개 값</span></div>
    <div className="list-filter-values">{visible.slice(0, 200).map(value => <label key={value}><input type="checkbox" checked={selected(value)} onChange={() => toggle(value)} /><span>{value || '(빈 값)'}</span></label>)}{visible.length > 200 && <p>200개까지 표시합니다. 검색으로 좁혀주세요.</p>}</div>
    <footer><button onClick={() => { onApply(null); onClose() }}>필터 지우기</button><button className="list-primary" onClick={() => { onApply(mode === 'exclude' && !values.size ? null : { mode, values: [...values] }); onClose() }}>적용</button></footer>
  </section>, document.body)
}
