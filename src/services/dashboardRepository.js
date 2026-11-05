import { callGas } from './gasApi'
import { readMonthCache, writeMonthCache, monthRecentlyChecked, monthKnownMissing, markMonthChecked } from './monthCache'

function previousMonth(month) {
  const year = Number(month.slice(0, 4))
  const number = Number(month.slice(4))
  return number === 1 ? `${year - 1}12` : `${year}${String(number - 1).padStart(2, '0')}`
}

export async function loadDashboard(email, month, { onCached } = {}) {
  const started = performance.now()
  const months = [month, previousMonth(month)]
  const cached = await Promise.all(months.map(value => readMonthCache(email, value)))
  if (monthKnownMissing(email, months[1])) cached[1] = null
  const usable = !!cached[0] && (!!cached[1] || monthKnownMissing(email, months[1]))
  if (usable) {
    const result = { email, month, current: cached[0], previous: cached[1] }
    onCached?.(result)
    if (months.every(value => monthRecentlyChecked(email, value))) {
      console.info(`[MSM CACHE] 월간 ${month}: 공통 메모리/브라우저 캐시 즉시 표시, GAS 요청 없음 (${Math.round(performance.now() - started)}ms)`)
      return result
    }
    console.info(`[MSM CACHE] 월간 ${month}: 캐시 먼저 표시, 뒤에서 버전 확인`)
  }
  const versions = Object.fromEntries(months.flatMap((value, index) => cached[index]?.updatedAt ? [[value, cached[index].updatedAt]] : []))
  // 초기 계정 확인은 bootstrap이 수행하며, 30초 경과 후 서버 권한·버전 재확인.
  const result = await callGas('getDashboardData', month, versions)
  if (result.email !== email) throw new Error('접속 계정이 변경되었습니다. 페이지를 새로고침하세요.')
  let reused = 0
  const payloads = await Promise.all([result.current, result.previous].map(async (value, index) => {
    if (!value) { markMonthChecked(email, months[index], false); return null }
    if (value.unchanged) {
      if (!cached[index] || cached[index].updatedAt !== value.updatedAt) throw new Error('캐시 버전이 일치하지 않습니다. 다시 조회하세요.')
      reused++
      markMonthChecked(email, months[index], true)
      return cached[index]
    }
    void writeMonthCache(email, months[index], value)
    markMonthChecked(email, months[index], true)
    return value
  }))
  console.info(`[MSM CACHE] ${month}: 원본 재사용 ${reused}개월, 새 원본 ${[result.current, result.previous].filter(value => value && !value.unchanged).length}개월 (${Math.round(performance.now() - started)}ms)`)
  return { ...result, current: payloads[0], previous: payloads[1] }
}
