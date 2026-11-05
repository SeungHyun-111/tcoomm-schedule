import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { saveEdits } from '../services/saveEdits'
import { parseListDate } from '../utils/listDates'

const fields = [['org','조직'],['date','DATE'],['hour','HOUR'],['minute','MINUTE'],['simpleMin','단순분'],['mdCategory','MD분류'],['brand','브랜드'],['productName','상품명'],['price','판매가격(대표)'],['company','회사명'],['brandWeightedMin','가중분'],['dataProductName','라방바상품명'],['salesQty','판매수량'],['revenue','매출액(원)']]
const numeric = new Set(['hour','minute','simpleMin','price','brandWeightedMin','salesQty','revenue'])
export default function DataEditModal({ mode, row, rows, company, onClose, onSaved }) {
  const brands = [...new Set(rows.map(item => String(item.brand || '').trim()).filter(Boolean))].sort((a,b) => a.localeCompare(b,'ko'))
  const [oldBrand, setOldBrand] = useState('')
  const [newBrand, setNewBrand] = useState('')
  const [draft, setDraft] = useState(() => Object.fromEntries(fields.map(([key]) => [key, String(row?.sourceRow?.[key] ?? '')])))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const targets = mode === 'brand' ? rows.filter(item => String(item.brand || '').trim() === oldBrand.trim()) : [row]
  async function save(event) {
    event.preventDefault()
    if (busy) return
    setMessage('')
    try {
      let changed
      if (mode === 'brand') {
        if (!brands.includes(oldBrand.trim()) || !newBrand.trim() || oldBrand.trim() === newBrand.trim()) throw new Error('기존 브랜드를 선택하고 다른 변경 브랜드명을 입력하세요.')
        changed = { brand: newBrand.trim() }
      } else {
        changed = {}
        for (const [key] of fields) {
          let value = draft[key].trim()
          if (key === 'date') value = parseListDate(value)
          if (String(row.sourceRow[key] ?? '') === value) continue
          changed[key] = numeric.has(key) ? value === '' ? null : Number(value.replaceAll(',','')) : value
          if (numeric.has(key) && value !== '' && !Number.isFinite(changed[key])) throw new Error('숫자 입력을 확인하세요.')
        }
        if (!Object.keys(changed).length) throw new Error('변경한 항목이 없습니다.')
      }
      setBusy(true)
      const result = await saveEdits({ kind: mode, changes: targets.map(item => ({ month: item.sourceMonth, company: item.sourceCompany, index: item.sourceIndex, version: item.sourceVersion, fields: changed })) })
      if (result.applied) onSaved()
      const text = `${result.applied}건 RTDB 반영${[...result.errors, ...result.warnings].length ? '\n' + [...result.errors, ...result.warnings].join('\n') : ''}`
      setMessage(text)
      if (result.applied && !result.errors.length && !result.warnings.length) onClose()
    } catch (error) { setMessage(error.message) }
    finally { setBusy(false) }
  }
  return createPortal(<div className="data-edit-overlay"><section className="data-edit-modal" role="dialog" aria-modal="true" aria-label={mode === 'brand' ? '브랜드명 일괄 수정' : '목록 내용 수정'}><header><h2>{mode === 'brand' ? '브랜드명 일괄 수정' : '목록 내용 수정'}</h2><button disabled={busy} onClick={onClose} aria-label="수정 창 닫기">×</button></header><p>{company} · 현재 조회 범위에만 적용합니다. 저장 즉시 RTDB에 반영됩니다.</p><form onSubmit={save}>
    {mode === 'brand' ? <><label>기존 브랜드 검색·선택<input list="edit-existing-brands" aria-label="기존 브랜드명" value={oldBrand} disabled={busy} onChange={event => setOldBrand(event.target.value)} required /></label><label>변경 브랜드 선택 또는 새로 입력<input list="edit-existing-brands" aria-label="변경 브랜드명" value={newBrand} disabled={busy} onChange={event => setNewBrand(event.target.value)} required /></label><datalist id="edit-existing-brands">{brands.map(brand => <option key={brand} value={brand} />)}</datalist><strong className="data-edit-count">변경 대상 {targets.length.toLocaleString()}건</strong></> : <><div className="data-edit-fields">{fields.map(([key,label]) => <label key={key}>{label}<input aria-label={`수정 ${label}`} type="text" value={draft[key]} disabled={busy} onChange={event => setDraft(previous => ({...previous,[key]:event.target.value}))} /></label>)}</div><p>방송일은 기존과 같은 월 안에서 수정할 수 있습니다.</p></>}
    {message && <pre className="data-edit-message" role="status">{message}</pre>}<footer><button type="button" disabled={busy} onClick={onClose}>닫기</button><button className="list-primary" disabled={busy || !targets.length}>{busy ? '저장 중…' : 'RTDB에 저장'}</button></footer></form></section></div>, document.body)
}
