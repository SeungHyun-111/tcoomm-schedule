const numeric = value => Number.isFinite(Number(value)) ? Number(value) : 0

export function createBrandSummaryAccumulator() {
  const result = { organizations: new Map(), count: 0, weightedMin: 0, revenue: 0 }
  result.accept = row => {
    const organization = String(row.org || '').trim() || '조직 미등록'
    const brand = String(row.brand || '').trim() || '브랜드 미등록'
    if (!result.organizations.has(organization)) result.organizations.set(organization, { weightedMin: 0, revenue: 0, brands: new Map() })
    const team = result.organizations.get(organization)
    if (!team.brands.has(brand)) team.brands.set(brand, { weightedMin: 0, revenue: 0, count: 0 })
    const item = team.brands.get(brand)
    const weightedMin = numeric(row.weightedMin), revenue = numeric(row.revenue)
    team.weightedMin += weightedMin
    team.revenue += revenue
    item.weightedMin += weightedMin
    item.revenue += revenue
    item.count++
    result.count++
    result.weightedMin += weightedMin
    result.revenue += revenue
  }
  return result
}

export function getBrandSummaryRows(current, previous, hasPreviousData, currentTotal = 0, previousTotal = 0) {
  const names = new Set([...(current?.brands.keys() || []), ...(previous?.brands.keys() || [])])
  return [...names].map(brand => {
    const now = current?.brands.get(brand)
    const before = previous?.brands.get(brand)
    return { brand, ...summaryMetrics(now, before, current?.weightedMin, previous?.weightedMin, hasPreviousData, currentTotal, previousTotal) }
  }).sort((a, b) => b.weightedMin - a.weightedMin || b.revenue - a.revenue || a.brand.localeCompare(b.brand, 'ko'))
}

function summaryMetrics(now, before, teamTotal, previousTeamTotal, hasPreviousData, currentTotal, previousTotal) {
    const weightedMin = now?.weightedMin || 0, revenue = now?.revenue || 0
    const previousRevenue = before?.revenue || 0
    const share = teamTotal > 0 ? weightedMin / teamTotal * 100 : 0
    const previousShare = previousTeamTotal > 0 ? (before?.weightedMin || 0) / previousTeamTotal * 100 : 0
    const overallShare = currentTotal > 0 ? weightedMin / currentTotal * 100 : null
    const previousOverallShare = previousTotal > 0 ? (before?.weightedMin || 0) / previousTotal * 100 : null
    return {
      weightedMin, revenue, previousRevenue,
      share, overallShare,
      weightedDifference: hasPreviousData ? weightedMin - (before?.weightedMin || 0) : null,
      shareDifference: hasPreviousData ? share - previousShare : null,
      overallShareDifference: hasPreviousData && overallShare !== null && previousOverallShare !== null ? overallShare - previousOverallShare : null,
      difference: hasPreviousData ? revenue - previousRevenue : null,
      growth: hasPreviousData && previousRevenue !== 0 ? (revenue - previousRevenue) / Math.abs(previousRevenue) * 100 : null,
    }
}

export function getBrandSummaryTotal(current, previous, hasPreviousData, currentTotal = 0, previousTotal = 0) {
  return summaryMetrics(current, previous, current?.weightedMin, previous?.weightedMin, hasPreviousData, currentTotal, previousTotal)
}
