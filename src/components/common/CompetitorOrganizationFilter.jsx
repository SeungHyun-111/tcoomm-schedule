import React, { useEffect, useRef } from 'react'

export default function CompetitorOrganizationFilter({ options, selected, onChange }) {
  const root = useRef(null)
  useEffect(() => {
    const close = event => {
      if (event.type === 'keydown' && event.key !== 'Escape') return
      if (event.type === 'pointerdown' && root.current?.contains(event.target)) return
      if (root.current) root.current.open = false
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close) }
  }, [])
  return <details ref={root} className="competitor-org-filter">
    <summary>조직명 · {selected.length ? `${selected.length}개 강조` : '전체'}</summary>
    <div className="competitor-org-dropdown">
      <div><span>Ctrl + 클릭으로 다중 선택</span><button type="button" onClick={() => onChange([])}>전체</button></div>
      <p className="competitor-org-hint">선택한 조직은 강조하고 나머지는 연하게 표시합니다.</p>
      <select multiple size={Math.min(8, Math.max(3, options.length))} aria-label="조직명 다중 선택" value={selected}
        onChange={event => onChange(Array.from(event.target.selectedOptions, option => option.value))}>
        {options.map(org => <option key={org} value={org}>{org}</option>)}
      </select>
      {!options.length && <span>조회된 조직이 없습니다.</span>}
    </div>
  </details>
}
