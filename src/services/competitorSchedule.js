import { callGas } from './gasApi'
import { readMonthCache, writeMonthCache, monthRecentlyChecked, monthKnownMissing, markMonthChecked } from './monthCache'

const preferences = new Map()
export function saveScheduleWeek(email, week) {
  const write = (preferences.get(email) || Promise.resolve()).catch(() => {}).then(() => callGas('saveCompetitorWeek', week))
  preferences.set(email, write)
  write.finally(() => { if (preferences.get(email) === write) preferences.delete(email) }).catch(() => {})
  return write
}

export async function fetchScheduleWeek(email, company, dates, signal, onRow, onCached) {
  const started = performance.now()
  if (!['SSG', 'K'].includes(company)) throw new Error('지원하지 않는 경쟁사 채널입니다.')
  signal?.throwIfAborted()
  const months = [...new Set(dates.map(date => date.slice(0, 7).replace('-', '')))].sort()
  const cached = new Map(await Promise.all(months.map(async month => [month, await readMonthCache(email, month)])))
  signal?.throwIfAborted()
  for (const month of months) if (monthKnownMissing(email, month)) cached.set(month, null)
  const usable = months.every(month => cached.get(month) || monthKnownMissing(email, month))
  if (usable) {
    const localRows = scheduleRows_(cached, months, company, dates)
    onCached?.(localRows)
    if (months.every(month => monthRecentlyChecked(email, month))) {
      if (onRow) for (const row of localRows) onRow(row)
      console.info(`[MSM CACHE] 주간 ${company}: 공통 메모리/브라우저 캐시 즉시 표시, GAS 요청 없음 (${Math.round(performance.now() - started)}ms)`)
      return onRow ? [] : localRows
    }
    console.info(`[MSM CACHE] 주간 ${company}: 캐시 먼저 표시, 뒤에서 버전 확인`)
  }
  const versions = Object.fromEntries(months.filter(month => cached.get(month)?.updatedAt).map(month => [month, cached.get(month).updatedAt]))
  const response = await callGas('getCompetitorMonths', months, versions)
  signal?.throwIfAborted()
  if (response.email !== email) throw new Error('접속 계정이 변경되었습니다. 페이지를 새로고침하세요.')
  const dateSet = new Set(dates)
  const rows = []
  let reused = 0, downloaded = 0
  for (const month of months) {
    signal?.throwIfAborted()
    const item = response.months[month]
    if (!item) { markMonthChecked(email, month, false); continue }
    let payload = item
    if (item.unchanged) {
      payload = cached.get(month)
      if (!payload || payload.updatedAt !== item.updatedAt) throw new Error('캐시 버전이 일치하지 않습니다. 다시 조회하세요.')
      reused++
    } else {
      void writeMonthCache(email, month, payload)
      downloaded++
    }
    markMonthChecked(email, month, true)
    for (const [index, row] of (payload.data[company] || []).entries()) {
      if (!row || !dateSet.has(row.date)) continue
      const record = { ...row, id: `${month}-${company}-${index}` }
      if (onRow) onRow(record)
      else rows.push(record)
    }
  }
  console.info(`[MSM CACHE] 주간 ${company}: 원본 재사용 ${reused}개월, 새 원본 ${downloaded}개월 (${Math.round(performance.now() - started)}ms)`)
  signal?.throwIfAborted()
  return rows
}

function scheduleRows_(cached, months, company, dates) {
  const selected = new Set(dates)
  const rows = []
  for (const month of months) for (const [index, row] of (cached.get(month)?.data[company] || []).entries()) {
    if (row && selected.has(row.date)) rows.push({ ...row, id: `${month}-${company}-${index}` })
  }
  return rows
}
