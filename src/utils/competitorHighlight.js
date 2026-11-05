export function normalizeHighlightText(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/\s+/g, '')
}

export function summarizeCompetitorHighlights(timeline, searchText, selectedOrganizations = []) {
  const query = normalizeHighlightText(searchText)
  const matchedIds = new Set()
  let weightedMin = 0, revenue = 0
  if (query) {
    for (const blocks of timeline.values()) {
      for (const { row } of blocks) {
        // Overnight continuations are displayed twice but represent one broadcast.
        if (matchedIds.has(row.id)) continue
        if (selectedOrganizations.length && !selectedOrganizations.includes(String(row.org || '').trim() || '조직 미등록')) continue
        const matches = [row.brand, row.productName, row.dataProductName, row.mdCategory, row.org]
          .some(value => normalizeHighlightText(value).includes(query))
        if (!matches) continue
        matchedIds.add(row.id)
        const minutes = Number(row.weightedMin)
        const sales = Number(row.revenue)
        if (Number.isFinite(minutes)) weightedMin += minutes
        if (Number.isFinite(sales)) revenue += sales
      }
    }
  }
  return { query, matchedIds, count: matchedIds.size, weightedMin, revenue }
}
