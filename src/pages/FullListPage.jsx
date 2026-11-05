import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { defaultListRange, parseListDate, listMonths } from '../utils/listDates'
import { loadFullList } from '../services/fullList'
import { safeStorage } from '../services/storage'
import useVisibleRefresh from '../hooks/useVisibleRefresh'
import ListColumnFilter from '../components/ListColumnFilter'
import DataEditModal from '../components/DataEditModal'
import EditableListCell from '../components/EditableListCell'
import { invalidateMonthChecks } from '../services/monthCache'

const ALL_COLUMNS = [
  { key: 'org', label: '조직', width: 130 }, { key: 'date', label: 'DATE', width: 120 },
  { key: 'hour', label: 'HOUR', width: 85, numeric: true }, { key: 'minute', label: 'MINUTE', width: 95, numeric: true },
  { key: 'simpleMin', label: '단순분', width: 90, numeric: true }, { key: 'mdCategory', label: 'MD분류', width: 120 },
  { key: 'brand', label: '브랜드', width: 150 }, { key: 'productName', label: '상품명', width: 300 },
  { key: 'price', label: '판매가격(대표)', width: 145, numeric: true }, { key: 'company', label: '회사명', width: 130 },
  { key: 'weight', label: '가중분', width: 90, numeric: true }, { key: 'dataProductName', label: '라방바상품명', width: 300 },
  { key: 'salesQty', label: '판매수량', width: 110, numeric: true }, { key: 'revenue', label: '매출액(원)', width: 160, numeric: true },
]
const number = value => Number(value || 0).toLocaleString('ko-KR', { maximumFractionDigits: 0 })
const display = (row, column) => row[column.key] == null ? '—' : column.numeric ? number(row[column.key]) : String(row[column.key] || '')
const fold = value => String(value || '').normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/\s+/g, '')
function settings(email) { try { return JSON.parse(safeStorage.getItem(`gas-full-list:${email}`) || '{}') || {} } catch { return {} } }

export default function FullListPage({ session }) {
  const columns = ALL_COLUMNS.filter(column => session.canViewRevenue === true || column.key !== 'revenue')
  const [initial] = useState(() => settings(session.email))
  const [range, setRange] = useState(defaultListRange)
  const [start, setStart] = useState(() => range.start.replaceAll('-', '/'))
  const [end, setEnd] = useState(() => range.end.replaceAll('-', '/'))
  const [search, setSearch] = useState(initial.search || '')
  const [company, setCompany] = useState(initial.company === 'K' ? 'K' : 'SSG')
  const [allFilters, setAllFilters] = useState(initial.filtersByCompany || {})
  const filters = allFilters[company] || {}
  const setFilters = updater => setAllFilters(previous => ({ ...previous, [company]: typeof updater === 'function' ? updater(previous[company] || {}) : updater }))
  const [sort, setSort] = useState(initial.sort || { key: 'date', direction: 'desc' })
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [open, setOpen] = useState(null)
  const [page, setPage] = useState(1)
  const [edit, setEdit] = useState(null)
  const activeEditors = useRef(new Set())
  const [editingCount, setEditingCount] = useState(0)
  const paused = !!edit || editingCount > 0
  const modalOpen = useRef(!!edit)
  modalOpen.current = !!edit
  const editing = useRef(paused)
  editing.current = paused
  const buffered = useRef(null)
  const loadedRange = useRef('')
  const onEditingChange = useCallback((id, active) => {
    if (active) activeEditors.current.add(id)
    else activeEditors.current.delete(id)
    editing.current = modalOpen.current || activeEditors.current.size > 0
    setEditingCount(activeEditors.current.size)
  }, [])
  const requestRefresh = useVisibleRefresh(true, () => setRevision(value => value + 1), paused)
  useEffect(() => {
    if (!paused && buffered.current) { setRows(buffered.current); buffered.current = null }
  }, [paused])
  const closeFilter = useCallback(() => setOpen(null), [])
  useEffect(() => { safeStorage.setItem(`gas-full-list:${session.email}`, JSON.stringify({ search, company, filtersByCompany: allFilters, sort })) }, [session.email, search, company, allFilters, sort])
  useEffect(() => {
    const controller = new AbortController()
    const rangeKey = `${session.email}|${range.start}|${range.end}`
    if (loadedRange.current !== rangeKey) { setRows([]); buffered.current = null; loadedRange.current = rangeKey }
    setLoading(true); setError('')
    const publish = data => {
      if (controller.signal.aborted) return
      if (editing.current) buffered.current = data
      else setRows(data)
    }
    loadFullList(session.email, range.start, range.end, controller.signal, data => {
      if (!controller.signal.aborted) { publish(data); setLoading(false) }
    }).then(publish)
      .catch(error => { if (!controller.signal.aborted) setError(error.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [session.email, range, revision])
  useEffect(() => { setPage(1); setOpen(null) }, [search, allFilters, company, sort, range])
  const companyRows = useMemo(() => rows.filter(row => row.sourceCompany === company), [rows, company])
  const selected = useMemo(() => {
    const query = fold(search)
    const entries = Object.entries(filters).filter(([, filter]) => filter).map(([key, filter]) => ({ column: columns.find(column => column.key === key), mode: filter.mode, values: new Set(filter.values) })).filter(item => item.column)
    const data = companyRows.filter(row => (!query || fold([row.company, row.brand, row.productName, row.dataProductName, row.mdCategory, row.org, row.time, row.channel].join(' ')).includes(query)) && entries.every(({ column, mode, values }) => mode === 'include' ? values.has(display(row, column)) : !values.has(display(row, column))))
    const column = columns.find(column => column.key === sort.key) || columns[1]
    const direction = sort.direction === 'asc' ? 1 : -1
    return data.sort((a, b) => (column.numeric ? (a[column.key] ?? -Infinity) - (b[column.key] ?? -Infinity) : display(a, column).localeCompare(display(b, column), 'ko', { numeric: true })) * direction || a.id.localeCompare(b.id))
  }, [companyRows, search, allFilters, company, sort])
  const pages = Math.max(1, Math.ceil(selected.length / 100)), currentPage = Math.min(page, pages)
  const totals = useMemo(() => selected.reduce((sum, row) => ({ weight: sum.weight + row.weight, revenue: sum.revenue + row.revenue }), { weight: 0, revenue: 0 }), [selected])
  function applyRange(event) {
    event.preventDefault()
    try {
      const next = { start: parseListDate(start), end: parseListDate(end) }
      listMonths(next.start, next.end)
      setStart(next.start.replaceAll('-', '/')); setEnd(next.end.replaceAll('-', '/')); setRange(next)
    } catch (error) { setError(error.message) }
  }
  const normalize = (value, setValue) => { try { setValue(parseListDate(value).replaceAll('-', '/')); setError('') } catch (error) { setError(error.message) } }
  return <main className="full-list-page">
    <header><h1>전체 목록</h1><div className="list-company-tabs" role="group" aria-label="전체 목록 회사 선택">{['SSG', 'K'].map(value => <button key={value} aria-pressed={company === value} onClick={() => setCompany(value)}>{value}</button>)}</div>{session.canManageAccess && <button onClick={() => setEdit({ mode: 'brand' })} disabled={loading || !companyRows.length}>브랜드명 일괄 수정</button>}</header>
    <form className="list-toolbar" onSubmit={applyRange}>
      <label className="list-search">검색<input type="search" aria-label="전체 목록 검색" placeholder="브랜드·상품명·카테고리·조직 검색" value={search} onChange={event => setSearch(event.target.value)} /></label>
      <div className="list-range"><span>조회 범위</span><input type="text" inputMode="numeric" aria-label="전체 목록 시작일" placeholder="YYYY/MM/DD" value={start} onChange={event => setStart(event.target.value)} onBlur={() => normalize(start, setStart)} /><b>~</b><input type="text" inputMode="numeric" aria-label="전체 목록 종료일" placeholder="YYYY/MM/DD" value={end} onChange={event => setEnd(event.target.value)} onBlur={() => normalize(end, setEnd)} /><button className="list-primary">조회</button></div>
    </form>
    {error && <p className="list-error" role="alert">{error}</p>}
    <div className="list-summary"><span>{range.start.replaceAll('-', '/')} ~ {range.end.replaceAll('-', '/')}</span><strong>{number(selected.length)}건</strong><span>가중분 {number(totals.weight)}분</span>{session.canViewRevenue === true && <span>매출액 {number(totals.revenue)}원</span>}{loading && <span role="status">데이터 확인 중…</span>}<button onClick={() => { setFilters({}); setSearch('') }}>검색·필터 초기화</button></div>
    <div className="list-table-scroll" onScroll={closeFilter} aria-busy={loading}><table><colgroup>{columns.map(column => <col key={column.key} style={{ width: column.width }} />)}{session.canManageAccess && <col style={{width:70}} />}</colgroup><thead><tr>{columns.map(column => <th key={column.key} title={column.key === 'salesQty' ? '페이지 소스의 방송시작 재고수량 - 방송종료 재고수량' : undefined}><div><button className="list-sort" onClick={() => setSort({ key: column.key, direction: sort.key === column.key && sort.direction === 'asc' ? 'desc' : 'asc' })}>{column.label}{sort.key === column.key ? sort.direction === 'asc' ? ' ↑' : ' ↓' : ''}</button><button className={filters[column.key] ? 'list-filter-button active' : 'list-filter-button'} aria-label={`${column.label} 필터`} aria-expanded={open?.column.key === column.key} onClick={event => { const anchor = event.currentTarget.getBoundingClientRect(); setOpen(previous => previous?.column.key === column.key ? null : { column, anchor }) }}>▽</button></div></th>)}{session.canManageAccess && <th>수정</th>}</tr></thead><tbody>{selected.slice((currentPage - 1) * 100, currentPage * 100).map(row => <tr key={row.id}>{columns.map(column => <td key={column.key} className={column.numeric ? 'numeric' : undefined} title={column.key === 'salesQty' ? '페이지 소스의 방송시작 재고수량 - 방송종료 재고수량' : display(row, column)}>{session.canManageAccess ? <EditableListCell row={row} column={column} onEditingChange={onEditingChange} onSaved={() => { invalidateMonthChecks(session.email); requestRefresh() }}><span className={column.key === 'company' ? `list-company ${row.company === 'SSG' ? 'ssg' : row.company === 'K' ? 'k' : 'sk'}` : undefined}>{display(row, column)}</span></EditableListCell> : <span className={column.key === 'company' ? `list-company ${row.company === 'SSG' ? 'ssg' : row.company === 'K' ? 'k' : 'sk'}` : undefined}>{display(row, column)}</span>}</td>)}{session.canManageAccess && <td><button aria-label={`${row.brand} 행 수정`} onClick={() => setEdit({mode:'row',row})}>수정</button></td>}</tr>)}{!selected.length && <tr><td colSpan={columns.length + (session.canManageAccess ? 1 : 0)}>{loading ? '데이터를 불러오는 중…' : '조건에 맞는 방송이 없습니다.'}</td></tr>}</tbody></table></div>
    <nav className="list-pagination" aria-label="전체 목록 페이지"><span>100건씩 표시</span><button disabled={currentPage <= 1} onClick={() => setPage(value => value - 1)}>이전</button><b>{currentPage} / {pages}</b><button disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>다음</button></nav>
    {open && <ListColumnFilter key={open.column.key} {...open} rows={companyRows} display={display} filter={filters[open.column.key]} onClose={closeFilter} onSort={direction => setSort({ key: open.column.key, direction })} onApply={filter => setFilters(previous => ({ ...previous, [open.column.key]: filter }))} />}
    {edit && <DataEditModal {...edit} rows={companyRows} company={company} onClose={() => setEdit(null)} onSaved={() => { invalidateMonthChecks(session.email); requestRefresh() }} />}
  </main>
}
