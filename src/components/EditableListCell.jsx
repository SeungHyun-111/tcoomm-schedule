import React, { useEffect, useRef, useState } from 'react'
import { saveEdits } from '../services/saveEdits'
import { parseListDate } from '../utils/listDates'

const numeric = new Set(['hour', 'minute', 'simpleMin', 'price', 'brandWeightedMin', 'salesQty', 'revenue'])
export default function EditableListCell({ row, column, children, onSaved, onEditingChange }) {
  const key = column.key === 'weight' ? 'brandWeightedMin' : column.key
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const saving = useRef(false)
  useEffect(() => {
    if (!editing) return
    const id = `${row.id}:${column.key}`
    onEditingChange?.(id, true)
    return () => onEditingChange?.(id, false)
  }, [editing, row.id, column.key, onEditingChange])
  function begin() {
    if (busy) return
    setDraft(String(row.sourceRow[key] ?? '')); setError(''); setEditing(true)
  }
  async function save() {
    if (saving.current) return
    try {
      let value = draft.trim()
      if (key === 'date') value = parseListDate(value)
      if (numeric.has(key)) {
        value = value === '' ? null : Number(value.replaceAll(',', ''))
        if (value !== null && !Number.isFinite(value)) throw new Error('숫자를 입력해 주세요.')
      }
      if (String(value ?? '') === String(row.sourceRow[key] ?? '')) { setEditing(false); return }
      saving.current = true; setBusy(true); setError('')
      const result = await saveEdits({ kind: 'row', changes: [{ month: row.sourceMonth, company: row.sourceCompany, index: row.sourceIndex, version: row.sourceVersion, fields: { [key]: value } }] })
      if (result.applied) { setEditing(false); onSaved() }
      const messages = [...(result.errors || []), ...(result.warnings || [])]
      if (messages.length || !result.applied) setError(messages.join('\n') || '저장하지 못했습니다.')
    } catch (error) { setError(error.message) }
    finally { saving.current = false; setBusy(false) }
  }
  return <div className="list-editable-cell" tabIndex={editing ? -1 : 0} aria-label={`${column.label} 셀 수정`} onDoubleClick={begin} onKeyDown={event => {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === 'F2') { event.preventDefault(); begin() }
  }}>
    {editing ? <div className="list-cell-editor"><input autoFocus aria-label={`셀 수정 ${column.label}`} value={draft} disabled={busy} onFocus={event => event.target.select()} onChange={event => setDraft(event.target.value)} onKeyDown={event => {
      if (event.key === 'Enter') { event.preventDefault(); void save() }
      if (event.key === 'Escape' && !busy) { event.preventDefault(); setEditing(false); setError('') }
    }} /><button disabled={busy} onClick={save}>{busy ? '저장 중…' : '저장'}</button><button disabled={busy} onClick={() => { setEditing(false); setError('') }}>취소</button></div> : children}
    {error && <div className="list-cell-error" role="alert">{error}</div>}
  </div>
}
