import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { saveEdits } from '../services/saveEdits'

export default function MonthlyBrandEditModal({ month, company, brand, categoryFilter, rows, version, onClose, onSaved }) {
  const targets = rows.map((row, index) => ({ row, index })).filter(({ row }) => String(row.brand || '').trim() === brand && (categoryFilter === 'ALL' || row.mdCategory === categoryFilter))
  const [name, setName] = useState(brand)
  const [changeCategory, setChangeCategory] = useState(false)
  const [category, setCategory] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const categories = [...new Set(rows.map(row => row.mdCategory).filter(Boolean))]
  async function save(event) {
    event.preventDefault()
    if (busy) return
    try {
      if (!name.trim()) throw new Error('브랜드명을 입력해 주세요.')
      const fields = {}
      if (name.trim() !== brand) fields.brand = name.trim()
      if (changeCategory) {
        if (!category.trim()) throw new Error('변경할 카테고리를 입력해 주세요.')
        fields.mdCategory = category.trim()
      }
      if (!Object.keys(fields).length) throw new Error('변경할 내용을 입력해 주세요.')
      setBusy(true); setError('')
      const result = await saveEdits({ kind: 'brand', changes: targets.map(({ index }) => ({ month, company, index, version, fields })) })
      if (result.applied) onSaved(result)
      const messages = [...(result.errors || []), ...(result.warnings || [])]
      if (messages.length || !result.applied) setError(messages.join('\n') || '변경된 항목이 없습니다.')
      else onClose()
    } catch (error) { setError(error.message) }
    finally { setBusy(false) }
  }
  return createPortal(<div className="monthly-edit-overlay"><section className="monthly-edit-dialog" role="dialog" aria-modal="true" aria-label="브랜드·카테고리 일괄 변경">
    <h2>브랜드·카테고리 변경</h2>
    <p>{month.slice(0, 4)}년 {month.slice(4)}월 · {company === 'SK' ? 'SK스토아' : company} · {brand}</p>
    <p>MD분류: {categoryFilter === 'ALL' ? '전체' : categoryFilter}</p>
    <p>현재 그룹에 포함된 원본 방송 행 <strong>{targets.length}건</strong>에만 적용합니다. 다른 MD분류의 방송은 변경하지 않습니다.</p>
    <form onSubmit={save}><label>변경 브랜드명<input aria-label="월간 변경 브랜드명" value={name} disabled={busy} onChange={event => setName(event.target.value)} /></label>
      <label><span><input type="checkbox" checked={changeCategory} disabled={busy} onChange={event => setChangeCategory(event.target.checked)} /> 카테고리도 변경</span></label>
      {changeCategory && <label>변경 카테고리<input aria-label="월간 변경 카테고리" list="monthly-edit-categories" value={category} disabled={busy} onChange={event => setCategory(event.target.value)} /><datalist id="monthly-edit-categories">{categories.map(value => <option key={value} value={value} />)}</datalist></label>}
      {error && <p role="alert">{error}</p>}<footer><button type="button" disabled={busy} onClick={onClose}>취소</button><button disabled={busy || !targets.length}>{busy ? '저장 중…' : '전체 방송에 적용'}</button></footer>
    </form>
  </section></div>, document.body)
}
