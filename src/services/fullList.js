import { callGas } from './gasApi'
import { listMonths } from '../utils/listDates'
import { readMonthCache, writeMonthCache, monthKnownMissing, monthRecentlyChecked, markMonthChecked } from './monthCache'

const numeric = value => Number(String(value ?? '').replace(/,/g, '')) || 0
function flatten(data, start, end) {
  const rows = []
  for (const [month, payload] of data) for (const company of ['SSG', 'K']) {
    for (const [index, row] of (payload?.data[company] || []).entries()) {
      if (!row || typeof row.date !== 'string' || row.date < start || row.date > end) continue
      // 요청한 원본 열 순서의 '가중분'은 회사명 다음 N열(brandWeightedMin).
      const weight = row.brandWeightedMin == null || row.brandWeightedMin === '' ? null : numeric(row.brandWeightedMin)
      const revenue = numeric(row.revenue)
      rows.push({ ...row, sourceRow: row, id: `${month}-${company}-${index}`, sourceMonth: month, sourceIndex: index, sourceVersion: payload.updatedAt, sourceCompany: company, company: row.company || company,
        hour: numeric(row.hour), minute: numeric(row.minute), simpleMin: numeric(row.simpleMin), price: numeric(row.price), salesQty: numeric(row.salesQty),
        time: `${row.date.replaceAll('-', '/')} ${String(row.hour ?? 0).padStart(2, '0')}:${String(row.minute ?? 0).padStart(2, '0')}`,
        channel: row.channel || '전체', dataProductName: row.dataProductName || '',
        weight, revenue, revenuePerMinute: weight > 0 ? revenue / weight : null })
    }
  }
  return rows
}
export async function loadFullList(email, start, end, signal, onCached) {
  const months = listMonths(start, end)
  const data = new Map(await Promise.all(months.map(async month => [month, await readMonthCache(email, month)])))
  signal.throwIfAborted()
  for (const month of months) if (monthKnownMissing(email, month)) data.set(month, null)
  if (months.every(month => data.get(month) || monthKnownMissing(email, month))) onCached(flatten(data, start, end))
  const pending = months.filter(month => !monthRecentlyChecked(email, month) || (!data.get(month) && !monthKnownMissing(email, month)))
  for (let index = 0; index < pending.length; index += 3) {
    signal.throwIfAborted()
    const batch = pending.slice(index, index + 3)
    const versions = Object.fromEntries(batch.filter(month => data.get(month)?.updatedAt).map(month => [month, data.get(month).updatedAt]))
    const result = await callGas('getCompetitorMonths', batch, versions)
    signal.throwIfAborted()
    if (result.email !== email) throw new Error('접속 계정이 변경되었습니다. 새로고침하세요.')
    for (const month of batch) {
      const item = result.months[month]
      if (item?.unchanged) {
        if (!data.get(month) || data.get(month).updatedAt !== item.updatedAt) throw new Error('캐시 버전 불일치. 다시 조회하세요.')
      } else {
        data.set(month, item || null)
        if (item) void writeMonthCache(email, month, item)
      }
      markMonthChecked(email, month, !!item)
    }
  }
  return flatten(data, start, end)
}
