export const koreaToday = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
export function parseListDate(value, year = Number(koreaToday().slice(0, 4))) {
  const text = String(value).trim().replace(/[.\s-]+/g, '/')
  let parts
  if (/^\d{8}$/.test(text)) parts = [text.slice(0, 4), text.slice(4, 6), text.slice(6)]
  else if (/^\d{4}$/.test(text)) parts = [year, text.slice(0, 2), text.slice(2)]
  else {
    parts = text.split('/')
    if (parts.length === 2) parts.unshift(year)
  }
  if (parts.length !== 3 || !parts.every(part => /^\d+$/.test(String(part)))) throw new Error('날짜를 10/1 또는 2026/10/01 형식으로 입력하세요.')
  let [y, m, d] = parts.map(Number)
  if (y < 100) y += 2000
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) throw new Error('날짜 범위를 확인하세요.')
  const date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  if (new Date(date).toISOString().slice(0, 10) !== date) throw new Error('존재하지 않는 날짜입니다.')
  return date
}
export function defaultListRange(end = koreaToday()) {
  const [year, month, day] = end.split('-').map(Number)
  const last = new Date(Date.UTC(year, month - 1, 0)).getUTCDate()
  return { start: new Date(Date.UTC(year, month - 2, Math.min(day, last))).toISOString().slice(0, 10), end }
}
export function listMonths(start, end) {
  if (start > end) throw new Error('시작일은 종료일보다 늦을 수 없습니다.')
  if ((Date.parse(end) - Date.parse(start)) / 86400000 > 366) throw new Error('한 번에 최대 1년까지 조회할 수 있습니다.')
  const months = []
  const current = new Date(start.slice(0, 7) + '-01T00:00:00Z')
  while (current.toISOString().slice(0, 7) <= end.slice(0, 7)) {
    months.push(current.toISOString().slice(0, 7).replace('-', ''))
    current.setUTCMonth(current.getUTCMonth() + 1)
  }
  return months
}
