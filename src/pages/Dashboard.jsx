import React, { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './Dashboard.css'
import MonthlyBrandEditModal from '../components/MonthlyBrandEditModal'
import { safeStorage } from '../services/storage'
import { openSectionWindow } from '../utils/openSectionWindow'
import { MD_CATEGORY_ORDER, sortByConfiguredOrder } from '../constants/competitorDropdownOrder'

const VIEW_STATE_CACHE_KEY = 'msm:dashboard-view'
const TOOLTIP_WIDTH = 268
const TOOLTIP_MAX_HEIGHT = 178
const TOOLTIP_OFFSET = 18
const SHEETS = [
  { key: 'SSG', label: 'SSG', accent: '#ff6b00' },
  { key: 'K', label: 'K', accent: '#2f6fd6' },
  { key: 'SK', label: 'SK스토아', accent: '#e12d39' },
]
const BROADCAST_COLUMNS = [
  { key: 'time', label: '방송일시', width: 170 },
  { key: 'channel', label: '채널', width: 90 },
  { key: 'brand', label: '브랜드', width: 150 },
  { key: 'dataProductName', label: '라방바 상품명', width: 640 },
  { key: 'weight', label: '가중분', width: 100 },
  { key: 'revenue', label: '매출액', width: 170 },
  { key: 'revenuePerMinute', label: '분당 매출액', width: 170 },
]
function readCachedViewState() {
  try {
    const value = JSON.parse(safeStorage.getItem(VIEW_STATE_CACHE_KEY) || '{}')
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  } catch {
    safeStorage.removeItem(VIEW_STATE_CACHE_KEY)
    return {}
  }
}

function previousMonth(month) {
  const year = Number(month.slice(0, 4))
  const monthNumber = Number(month.slice(4, 6))
  const date = new Date(year, monthNumber - 2, 1)
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`
}

function toNumber(value) {
  const number = Number(String(value ?? '').replace(/,/g, ''))
  return Number.isFinite(number) ? number : 0
}

function getWeight(row) {
  return toNumber(row.weightedMin)
}

function getRevenue(row) {
  return toNumber(row.revenue)
}

function getPgmKey(row) {
  return [row.date, row.hour, row.minute, row.brand, row.productName].join('|')
}

function getChannel(row) {
  return String(row.channel || '').trim()
}

function getPgmCount(rows) {
  return new Set(rows.map(getPgmKey)).size
}

function buildBroadcastsByBrand(rows) {
  const map = new Map()

  rows.forEach((row) => {
    const brand = String(row.brand || '').trim()
    if (!brand) return

    const key = [getPgmKey(row), getChannel(row)].join('|')
    const brandRows = map.get(brand) || new Map()
    const current =
      brandRows.get(key) || {
        key,
        brand,
        month: row.month,
        date: row.date,
        hour: row.hour,
        minute: row.minute,
        productName: row.productName,
        dataProductName: row.dataProductName,
        channel: getChannel(row),
        weight: 0,
        revenue: 0,
      }

    if (!current.dataProductName && row.dataProductName) current.dataProductName = row.dataProductName
    if (!current.channel && getChannel(row)) current.channel = getChannel(row)
    current.weight += getWeight(row)
    current.revenue += getRevenue(row)
    brandRows.set(key, current)
    map.set(brand, brandRows)
  })

  return Object.fromEntries(
    [...map.entries()].map(([brand, rowsByPgm]) => [
      brand,
      [...rowsByPgm.values()].sort((a, b) =>
        [a.date, a.hour, a.minute, a.channel, a.productName].join('|').localeCompare(
          [b.date, b.hour, b.minute, b.channel, b.productName].join('|'),
        ),
      ),
    ]),
  )
}

function uniqueValues(rows, key) {
  return [...new Set(rows.map((row) => row[key]).filter(Boolean))].sort()
}

function aggregateByBrand(rows) {
  const map = new Map()

  rows.forEach((row) => {
    const brand = String(row.brand || '').trim()
    if (!brand) return
    const current = map.get(brand) || { brand, weight: 0, revenue: 0, pgmKeys: new Set(), month: row.month }
    current.weight += getWeight(row)
    current.revenue += getRevenue(row)
    current.pgmKeys.add(getPgmKey(row))
    map.set(brand, current)
  })

  return [...map.values()]
    .map((row) => ({ ...row, pgmCount: row.pgmKeys.size, pgmKeys: undefined }))
    .sort((a, b) => b.weight - a.weight)
}

function aggregateMdCategoryShareSegments(rows, selectedMdCategory, selectedColor) {
  const monthlyWeight = rows.reduce((sum, row) => sum + getWeight(row), 0)

  if (selectedMdCategory === 'ALL') {
    return [{ category: 'ALL', share: monthlyWeight ? 100 : 0, color: selectedColor, isSelected: true }]
  }

  const map = new Map()
  rows.forEach((row) => {
    const category = String(row.mdCategory || '').trim()
    if (!category) return
    map.set(category, (map.get(category) || 0) + getWeight(row))
  })

  const selected = {
    category: selectedMdCategory,
    share: monthlyWeight ? ((map.get(selectedMdCategory) || 0) / monthlyWeight) * 100 : 0,
    color: selectedColor,
    isSelected: true,
  }

  const remaining = [...map.entries()]
    .filter(([category]) => category !== selectedMdCategory)
    .map(([category, weight]) => ({
      category,
      share: monthlyWeight ? (weight / monthlyWeight) * 100 : 0,
      color: '#d7d7d7',
      isSelected: false,
    }))
    .sort((a, b) => b.share - a.share)

  return [selected, ...remaining]
}

function buildAnalysis(data, mdCategory) {
  const allRowsBySheet = Object.fromEntries(SHEETS.map(({ key }) => [key, data?.[key] || []]))
  const selectedRowsBySheet = Object.fromEntries(
    SHEETS.map(({ key }) => [
      key,
      allRowsBySheet[key].filter((row) => mdCategory === 'ALL' || row.mdCategory === mdCategory),
    ]),
  )
  const brandRows = Object.fromEntries(SHEETS.map(({ key }) => [key, aggregateByBrand(selectedRowsBySheet[key])]))
  const skBrands = new Set(brandRows.SK.map((row) => row.brand))
  const competitorBrands = new Set([...brandRows.SSG, ...brandRows.K].map((row) => row.brand))

  return SHEETS.map((sheet) => {
    const rows = brandRows[sheet.key].map((row) => {
      const isOperated = sheet.key === 'SK' ? competitorBrands.has(row.brand) : skBrands.has(row.brand)
      return { ...row, isOperated }
    })
    const selectedWeight = selectedRowsBySheet[sheet.key].reduce((sum, row) => sum + getWeight(row), 0)
    const monthlyWeight = allRowsBySheet[sheet.key].reduce((sum, row) => sum + getWeight(row), 0)
    const operatedCount = rows.filter((row) => row.isOperated).length

    return {
      ...sheet,
      rows,
      selectedWeight,
      monthlyWeight,
      share: monthlyWeight ? (selectedWeight / monthlyWeight) * 100 : 0,
      shareSegments: aggregateMdCategoryShareSegments(allRowsBySheet[sheet.key], mdCategory, '#426a8c'),
      brandCount: rows.length,
      operatedCount,
      broadcastsByBrand: buildBroadcastsByBrand(selectedRowsBySheet[sheet.key]),
    }
  })
}

function getMonthlyStats(data, mdCategory, sheetKey) {
  const rows = (data?.[sheetKey] || []).filter((row) => mdCategory === 'ALL' || row.mdCategory === mdCategory)
  return {
    pgmCount: getPgmCount(rows),
    weight: rows.reduce((sum, row) => sum + getWeight(row), 0),
    revenue: rows.reduce((sum, row) => sum + getRevenue(row), 0),
  }
}

function getBrandStats(data, mdCategory, sheetKey) {
  const rows = (data?.[sheetKey] || []).filter((row) => mdCategory === 'ALL' || row.mdCategory === mdCategory)
  return Object.fromEntries(
    aggregateByBrand(rows).map((row) => [
      row.brand,
      {
        pgmCount: row.pgmCount,
        weight: row.weight,
        revenue: row.revenue,
      },
    ]),
  )
}

function formatDelta(value, unit = '') {
  const rounded = Math.round(value)
  if (rounded === 0) return `0${unit}`
  return `${rounded > 0 ? '+' : ''}${rounded.toLocaleString()}${unit}`
}

function formatShare(value) {
  return `${value.toFixed(1)}%`
}

function formatMoney(value) {
  return `${Math.round(value / 1000000).toLocaleString()}백만`
}

function formatMoneyDelta(value) {
  const rounded = Math.round(value / 1000000)
  if (rounded === 0) return '0백만'
  return `${rounded > 0 ? '+' : ''}${rounded.toLocaleString()}백만`
}

function formatWon(value) {
  return `${Math.round(value).toLocaleString()}원`
}

function formatWonPerMinute(revenue, minutes) {
  if (!minutes) return '-'
  return `${Math.round(revenue / minutes).toLocaleString()}원/분`
}

function formatBroadcastTime(row) {
  const weekdays = ['일', '월', '화', '수', '목', '금', '토']
  const rawDate = String(row.date || '')
  const datePart = rawDate.split('T')[0]
  const parsedDate = datePart ? new Date(`${datePart}T00:00:00`) : null
  const weekday =
    parsedDate && !Number.isNaN(parsedDate.getTime()) ? `(${weekdays[parsedDate.getDay()]})` : ''
  const time =
    row.hour !== undefined && row.minute !== undefined
      ? `${String(row.hour).padStart(2, '0')}:${String(row.minute).padStart(2, '0')}`
      : ''
  return [datePart, weekday, time].filter(Boolean).join(' ')
}

function getSelectedChannelOrder(selectedCompanyKey) {
  return [
    selectedCompanyKey,
    ...SHEETS.map((sheet) => sheet.key).filter((key) => key !== selectedCompanyKey),
  ]
}

function normalizeSelectedBrands(value) {
  if (Array.isArray(value)) return value
  return value ? [value] : []
}

function getBroadcastSortValue(row, sortKey) {
  if (sortKey === 'time') {
    const date = String(row.date || '').split('T')[0]
    const hour = String(row.hour ?? '').padStart(2, '0')
    const minute = String(row.minute ?? '').padStart(2, '0')
    return `${date} ${hour}:${minute}`
  }
  if (sortKey === 'channel') return getChannel(row).toLowerCase()
  if (sortKey === 'brand') return String(row.brand || '').toLowerCase()
  if (sortKey === 'dataProductName') return String(row.dataProductName || '').toLowerCase()
  if (sortKey === 'weight') return row.weight
  if (sortKey === 'revenue') return row.revenue
  if (sortKey === 'revenuePerMinute') return row.weight ? row.revenue / row.weight : 0
  return ''
}

function brandNameClass(brand) {
  const length = String(brand || '').length
  if (length >= 14) return 'brand-name is-tiny'
  if (length >= 10) return 'brand-name is-small'
  return 'brand-name'
}

function makeTooltipRows(current, previous) {
  return [
    {
      label: 'PGM수',
      value: `${current.pgmCount.toLocaleString()}건`,
      delta: formatDelta(current.pgmCount - previous.pgmCount, '건'),
    },
    {
      label: '가중분',
      value: `${Math.round(current.weight).toLocaleString()}분`,
      delta: formatDelta(current.weight - previous.weight, '분'),
    },
    {
      label: '매출액',
      value: formatMoney(current.revenue),
      delta: formatMoneyDelta(current.revenue - previous.revenue),
    },
  ]
}

function getTooltipPosition(x, y) {
  const maxLeft = window.innerWidth - TOOLTIP_WIDTH - TOOLTIP_OFFSET
  const maxTop = window.innerHeight - TOOLTIP_MAX_HEIGHT - TOOLTIP_OFFSET

  return {
    left: Math.max(TOOLTIP_OFFSET, Math.min(x + TOOLTIP_OFFSET, maxLeft)),
    top: Math.max(TOOLTIP_OFFSET, Math.min(y + TOOLTIP_OFFSET, maxTop)),
  }
}

const emptyStats = { pgmCount: 0, weight: 0, revenue: 0 }

export default function Dashboard({ month, data, previousData, canViewRevenue = false, canManageAccess = false, version, onDataSaved }) {
  const [brandEdit, setBrandEdit] = useState(null)
  const broadcastColumns = BROADCAST_COLUMNS.filter(column => canViewRevenue || !['revenue', 'revenuePerMinute'].includes(column.key))
  const [cachedViewState] = useState(readCachedViewState)
  const rawData = data
  const [mdCategory, setMdCategory] = useState(cachedViewState.mdCategory || 'ALL')
  const [activeTooltip, setActiveTooltip] = useState(null)
  const [selectedBrands, setSelectedBrands] = useState(() =>
    normalizeSelectedBrands(cachedViewState.selectedBrands || cachedViewState.selectedBrand),
  )
  const [broadcastSort, setBroadcastSort] = useState(
    cachedViewState.broadcastSort || { key: 'time', direction: 'asc' },
  )
  const [broadcastColumnWidths, setBroadcastColumnWidths] = useState(
    {
      ...Object.fromEntries(broadcastColumns.map((column) => [column.key, column.width])),
      ...(cachedViewState.broadcastColumnWidths || {}),
    },
  )

  useEffect(() => {
    safeStorage.setItem(
      VIEW_STATE_CACHE_KEY,
      JSON.stringify({ mdCategory, selectedBrands, broadcastSort, broadcastColumnWidths }),
    )
  }, [mdCategory, selectedBrands, broadcastSort, broadcastColumnWidths])

  const allRows = useMemo(() => Object.values(rawData || {}).flat(), [rawData])
  const mdCategories = useMemo(
    () => sortByConfiguredOrder(uniqueValues(allRows, 'mdCategory'), MD_CATEGORY_ORDER),
    [allRows],
  )
  const visibleMdCategory =
    mdCategory !== 'ALL' && mdCategories.length > 0 && !mdCategories.includes(mdCategory) ? 'ALL' : mdCategory

  const analysis = useMemo(() => buildAnalysis(rawData, visibleMdCategory), [rawData, visibleMdCategory])
  const currentStats = useMemo(
    () => Object.fromEntries(SHEETS.map(({ key }) => [key, getMonthlyStats(rawData, visibleMdCategory, key)])),
    [visibleMdCategory, rawData],
  )
  const previousStats = useMemo(
    () => Object.fromEntries(SHEETS.map(({ key }) => [key, getMonthlyStats(previousData, visibleMdCategory, key)])),
    [visibleMdCategory, previousData],
  )
  const previousBrandStats = useMemo(
    () => Object.fromEntries(SHEETS.map(({ key }) => [key, getBrandStats(previousData, visibleMdCategory, key)])),
    [visibleMdCategory, previousData],
  )
  const rankedCompanies = useMemo(
    () => analysis.slice().sort((a, b) => b.brandCount - a.brandCount),
    [analysis],
  )
  const maxBrandRows = useMemo(
    () => Math.max(0, ...analysis.map((company) => company.rows.length)),
    [analysis],
  )
  const showBrandDetail = visibleMdCategory !== 'ALL'
  const activeSelectedBrands = selectedBrands.filter(
    (item) => item?.month === month && item?.mdCategory === visibleMdCategory,
  )
  const primarySelectedBrand = activeSelectedBrands[0] || null
  const selectedBrandNames = [...new Set(activeSelectedBrands.map((item) => item.brand))]
  const selectedCompany = primarySelectedBrand
    ? analysis.find((company) => company.key === primarySelectedBrand.companyKey)
    : null
  const selectedChannelOrder = primarySelectedBrand ? getSelectedChannelOrder(primarySelectedBrand.companyKey) : []
  const selectedBroadcastGroups = primarySelectedBrand
    ? selectedChannelOrder.map((companyKey) => {
        const company = analysis.find((item) => item.key === companyKey)
        const broadcasts = selectedBrandNames.flatMap((brand) => company?.broadcastsByBrand[brand] || [])

        return {
          key: companyKey,
          label: company?.label || companyKey,
          accent: company?.accent || '#6e6e73',
          broadcasts: broadcasts.map((broadcast) => ({
            ...broadcast,
            key: `${companyKey}-${broadcast.brand}-${broadcast.key}`,
          })),
        }
      })
    : []
  const sortedBroadcastGroups = selectedBroadcastGroups.map((group) => ({
    ...group,
    broadcasts: group.broadcasts.slice().sort((a, b) => {
      const aValue = getBroadcastSortValue(a, broadcastSort.key)
      const bValue = getBroadcastSortValue(b, broadcastSort.key)
      const direction = broadcastSort.direction === 'asc' ? 1 : -1

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return (aValue - bValue) * direction
      }
      return String(aValue).localeCompare(String(bValue), 'ko') * direction
    }),
  }))

  const showTooltip = (event, tooltip) => {
    if (Array.isArray(tooltip.rows) && !tooltip.rows.length) return
    setActiveTooltip({ ...tooltip, x: event.clientX, y: event.clientY })
  }

  const moveTooltip = (event) => {
    setActiveTooltip((current) => current && { ...current, x: event.clientX, y: event.clientY })
  }

  const hideTooltip = () => {
    setActiveTooltip(null)
  }

  const tooltipElement = activeTooltip
    ? createPortal(
        <div
          className={`floating-tooltip ${activeTooltip.compact ? 'is-compact' : ''}`}
          style={getTooltipPosition(activeTooltip.x, activeTooltip.y)}
          role="tooltip"
        >
          <b>{activeTooltip.title}</b>
          {activeTooltip.value ? (
            <strong className="tooltip-primary-value">{activeTooltip.value}</strong>
          ) : (
            activeTooltip.rows.filter(row => canViewRevenue || row.label !== '매출액').map((row) => (
              <em key={row.label}>
                <span>{row.label}</span>
                <strong>
                  {row.value} ({row.delta})
                </strong>
              </em>
            ))
          )}
        </div>,
        document.body,
      )
    : null

  const isBrandSelected = (companyKey, brand) =>
    activeSelectedBrands.some((item) => item.companyKey === companyKey && item.brand === brand)

  const selectBrand = (companyKey, brand, event) => {
    const nextItem = { companyKey, brand, month, mdCategory: visibleMdCategory }
    const isMultiSelect = event?.ctrlKey || event?.metaKey

    setSelectedBrands((current) => {
      const activeItems = normalizeSelectedBrands(current).filter(
        (item) => item?.month === month && item?.mdCategory === visibleMdCategory,
      )
      const exists = activeItems.some((item) => item.companyKey === companyKey && item.brand === brand)

      if (!isMultiSelect) {
        return exists && activeItems.length === 1 ? [] : [nextItem]
      }

      return exists
        ? activeItems.filter((item) => !(item.companyKey === companyKey && item.brand === brand))
        : [...activeItems, nextItem]
    })
  }

  const sortBroadcasts = (columnKey) => {
    setBroadcastSort((current) => ({
      key: columnKey,
      direction: current.key === columnKey && current.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const resizeBroadcastColumn = (columnKey, event) => {
    event.preventDefault()
    event.stopPropagation()

    const startX = event.clientX
    const startWidth = broadcastColumnWidths[columnKey]

    const onMouseMove = (moveEvent) => {
      const nextWidth = Math.max(70, startWidth + moveEvent.clientX - startX)
      setBroadcastColumnWidths((current) => ({ ...current, [columnKey]: nextWidth }))
    }

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  return (
    <main data-month={month} className={`dashboard${previousData ? '' : ' no-previous'}`}>
      <section className="sheet-top">
        <div className="selector-sheet" aria-label="MD분류 선택">
          <div className="selector-values">
            <label>
              <span>MD분류</span>
              <select aria-label="MD분류" value={visibleMdCategory} onChange={(event) => setMdCategory(event.target.value)}>
                <option value="ALL">전체</option>
                {mdCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <table className="brand-rank" aria-label="회사별 브랜드수">
          <thead>
            <tr>
              <th />
              <th>회사명</th>
              <th>브랜드수</th>
            </tr>
          </thead>
          <tbody>
            {rankedCompanies.map((company, index) => (
              <tr key={company.key}>
                <td>{index + 1}</td>
                <td>{company.label}</td>
                <td>{company.brandCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="competitor-board" aria-label="브랜드별 편성 현황">
        {analysis.map((company) => {
          return (
          <article
            className="company-card"
            style={{ '--company-accent': company.accent }}
            key={company.key}
            onContextMenu={(event) => openSectionWindow(event, `${month} ${company.label}`)}
            title="우클릭하면 새창으로 열립니다"
          >
            <div className="share-strip">
              <h3 className="card-company-title" style={{ color: company.accent }}>
                {company.label}
              </h3>
              <span>편성비중 <small>(전체 카테고리 대비)</small></span>
              <strong style={{ color: company.accent }}>{formatShare(company.share)}</strong>
              <button
                className="delta-trigger"
                type="button"
                aria-label={`${company.label} 전월대비 증감`}
                onMouseEnter={(event) =>
                  showTooltip(event, {
                    title: `${company.label} · ${previousMonth(month)} 대비`,
                    rows: previousData ? makeTooltipRows(currentStats[company.key], previousStats[company.key]) : [],
                  })
                }
                onMouseMove={moveTooltip}
                onMouseLeave={hideTooltip}
                onFocus={(event) =>
                  showTooltip(event, {
                    title: `${company.label} · ${previousMonth(month)} 대비`,
                    rows: previousData ? makeTooltipRows(currentStats[company.key], previousStats[company.key]) : [],
                  })
                }
                onBlur={hideTooltip}
              >
                전월대비
              </button>
              <div className="share-progress" aria-label={`${company.label} ${formatShare(company.share)}`}>
                {company.shareSegments.map((segment) => (
                  <button
                    className={`share-progress-segment ${segment.isSelected ? 'is-selected' : ''}`}
                    type="button"
                    key={`${company.key}-${segment.category}`}
                    style={{
                      flexBasis: `${segment.share}%`,
                      backgroundColor: segment.color,
                    }}
                    aria-label={`${segment.category} ${formatShare(segment.share)}`}
                    onMouseEnter={(event) =>
                      showTooltip(event, {
                        title: segment.category,
                        value: formatShare(segment.share),
                        compact: true,
                      })
                    }
                    onMouseMove={moveTooltip}
                    onMouseLeave={hideTooltip}
                    onFocus={(event) =>
                      showTooltip(event, {
                        title: segment.category,
                        value: formatShare(segment.share),
                        compact: true,
                      })
                    }
                    onBlur={hideTooltip}
                  />
                ))}
              </div>
              <div
                className="share-selected-marker"
                style={{
                  '--marker-color': '#426a8c',
                  '--marker-left': `clamp(4px, ${company.share / 2}%, 96%)`,
                }}
              >
                <span>{visibleMdCategory === 'ALL' ? '전체' : visibleMdCategory}</span>
              </div>
            </div>

            <div className="company-metrics">
              <p>
                <span>전체브랜드</span>
                <strong>{company.brandCount}</strong>
              </p>
              <p>
                <span>{company.key === 'SK' ? '경쟁사운영브랜드' : '당사운영브랜드'}</span>
                <strong>{company.operatedCount}</strong>
              </p>
            </div>

            {showBrandDetail && (
              <div className="brand-table-wrap">
                <table className="brand-table">
                  <thead>
                    <tr>
                      <th>브랜드</th>
                      <th>가중분(계)</th>
                      <th>방송횟수</th>
                      <th>병행여부</th>
                    </tr>
                  </thead>
                  <tbody>
                    {company.rows.map((row) => {
                      const previous = previousBrandStats[company.key][row.brand] || emptyStats
                      const isSelected = isBrandSelected(company.key, row.brand)

                      return (
                        <tr
                          className={`brand-row ${row.isOperated ? '' : 'not-operated'} ${isSelected ? 'is-selected' : ''}`}
                          key={`${company.key}-${row.brand}`}
                          tabIndex="0"
                          aria-pressed={isSelected}
                          onClick={(event) => selectBrand(company.key, row.brand, event)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              selectBrand(company.key, row.brand, event)
                            }
                          }}
                        >
                          <td
                            className="brand-cell"
                            onContextMenu={canManageAccess ? event => { event.preventDefault(); event.stopPropagation(); hideTooltip(); setBrandEdit({ company: company.key, brand: row.brand, categoryFilter: visibleMdCategory, rows: data[company.key] || [], month, version }) } : undefined}
                            tabIndex="0"
                            onMouseEnter={(event) =>
                              showTooltip(event, {
                                title: `${row.brand} · ${previousMonth(month)} 대비`,
                                rows: previousData ? makeTooltipRows(row, previous) : [],
                              })
                            }
                            onMouseMove={moveTooltip}
                            onMouseLeave={hideTooltip}
                            onFocus={(event) =>
                              showTooltip(event, {
                                title: `${row.brand} · ${previousMonth(month)} 대비`,
                                rows: previousData ? makeTooltipRows(row, previous) : [],
                              })
                            }
                            onBlur={hideTooltip}
                          >
                          <strong className={brandNameClass(row.brand)}>{row.brand}</strong>
                          </td>
                          <td>{Math.round(row.weight).toLocaleString()}</td>
                          <td>{row.pgmCount.toLocaleString()}</td>
                          <td className={row.isOperated ? 'yes' : 'no'}>{row.isOperated ? 'Y' : 'N'}</td>
                        </tr>
                      )
                    })}
                    {Array.from({ length: Math.max(0, maxBrandRows - company.rows.length) }).map((_, index) => (
                      <tr className="empty-row" key={`${company.key}-empty-${index}`}>
                        <td />
                        <td />
                        <td />
                        <td />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
          )
        })}
      </section>

      {showBrandDetail && (
        <section
          className="broadcast-section"
          aria-label="선택 브랜드 방송 목록"
          onContextMenu={(event) =>
            openSectionWindow(event, `${month} ${selectedCompany?.label || ''} ${selectedBrandNames.join(', ')}`)
          }
          title="우클릭하면 새창으로 열립니다"
        >
          {activeSelectedBrands.length === 0 ? (
            <p className="broadcast-empty">브랜드 행을 클릭하세요</p>
          ) : (
            <>
              <div className="broadcast-summary">
                <strong>
                  {selectedCompany?.label} · {selectedBrandNames.join(', ')}
                </strong>
              </div>
              <table className="broadcast-table">
                <colgroup>
                  {broadcastColumns.map((column) => (
                    <col key={column.key} style={{ width: `${broadcastColumnWidths[column.key]}px` }} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    {broadcastColumns.map((column) => (
                      <th
                        aria-sort={
                          broadcastSort.key === column.key
                            ? broadcastSort.direction === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : 'none'
                        }
                        key={column.key}
                      >
                        <button className="broadcast-sort-button" type="button" onClick={() => sortBroadcasts(column.key)}>
                          <span>{column.label}</span>
                          {broadcastSort.key === column.key && (
                            <b aria-hidden="true">{broadcastSort.direction === 'asc' ? '▲' : '▼'}</b>
                          )}
                        </button>
                        <span
                          className="broadcast-resize-handle"
                          onMouseDown={(event) => resizeBroadcastColumn(column.key, event)}
                        />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedBroadcastGroups.map((group) => (
                    <Fragment key={group.key}>
                      <tr className="broadcast-channel-row" style={{ '--channel-accent': group.accent }}>
                        <td colSpan={broadcastColumns.length}>
                          <div className="broadcast-channel-summary" style={canViewRevenue ? undefined : { gridTemplateColumns: 'minmax(0,1fr) auto auto' }}>
                            <strong>{group.label}</strong>
                            <span>{group.broadcasts.length.toLocaleString()}회</span>
                            <span>
                              {Math.round(group.broadcasts.reduce((sum, row) => sum + row.weight, 0)).toLocaleString()}분
                            </span>
                            {canViewRevenue && <>
                            <span>
                              {formatWon(group.broadcasts.reduce((sum, row) => sum + row.revenue, 0))}
                            </span>
                            <span>
                              {formatWonPerMinute(
                                group.broadcasts.reduce((sum, row) => sum + row.revenue, 0),
                                group.broadcasts.reduce((sum, row) => sum + row.weight, 0),
                              )}
                            </span>
                            </>}
                          </div>
                        </td>
                      </tr>
                      {group.broadcasts.length ? (
                        group.broadcasts.map((broadcast) => (
                          <tr key={broadcast.key}>
                            <td>{formatBroadcastTime(broadcast)}</td>
                            <td>{getChannel(broadcast) || '-'}</td>
                            <td>{broadcast.brand || selectedBrandNames.join(', ')}</td>
                            <td>{broadcast.dataProductName || '-'}</td>
                            <td>{Math.round(broadcast.weight).toLocaleString()}</td>
                            {canViewRevenue && <td>{formatWon(broadcast.revenue)}</td>}
                            {canViewRevenue && <td>{formatWonPerMinute(broadcast.revenue, broadcast.weight)}</td>}
                          </tr>
                        ))
                      ) : (
                        <tr className="not-operated-channel">
                          <td colSpan={broadcastColumns.length}>미운영</td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>
      )}

      {brandEdit && canManageAccess && <MonthlyBrandEditModal {...brandEdit} onClose={() => setBrandEdit(null)} onSaved={result => {
        const changed = result.committedMonths?.find(item => item.month === brandEdit.month)?.changes.find(item => item.company === brandEdit.company)?.after
        if (changed) setSelectedBrands(previous => previous.map(item => item.month === brandEdit.month && item.companyKey === brandEdit.company && item.brand === brandEdit.brand && (brandEdit.categoryFilter === 'ALL' || item.mdCategory === brandEdit.categoryFilter) ? { ...item, brand: changed.brand || item.brand, mdCategory: changed.mdCategory || item.mdCategory } : item))
        onDataSaved(result)
      }} />}
      {tooltipElement}
    </main>
  )
}
