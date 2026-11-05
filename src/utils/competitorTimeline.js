import dayjs from 'dayjs'

export const PIXELS_PER_MINUTE = 2.4 * 0.66
export const formatMinute = minute => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(Math.floor(minute % 60)).padStart(2, '0')}`

export function inferCompetitorChannels(rows, company) {
  const channels = new Map()
  if (company === 'SSG') {
    const groups = new Map()
    for (const row of rows) {
      const key = `${row.date}-${Number(row.hour)}-${Number(row.minute)}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(row)
    }
    for (const group of groups.values()) {
      if (group.length < 2 || group.some(row => row.weightedMin == null || !Number.isFinite(Number(row.weightedMin)))) continue
      const weights = group.map(row => Number(row.weightedMin))
      const min = Math.min(...weights), max = Math.max(...weights)
      if (min === max) continue
      for (const row of group) {
        if (Number(row.weightedMin) === min) channels.set(row, 'CA')
        else if (Number(row.weightedMin) === max) channels.set(row, 'IP')
      }
    }
  }
  return channels
}

export function buildCompetitorTimeline(rows, dates, company) {
  const days = new Map(dates.map(date => [date, []]))
  const channels = inferCompetitorChannels(rows, company)
  for (const row of rows) {
    const start = Number(row.hour) * 60 + Number(row.minute)
    if (!Number.isFinite(start) || start < 0 || start >= 1440) continue
    // simpleMin is elapsed broadcast time; weightedMin measures exposure, not duration.
    const rawDuration = Number(row.simpleMin)
    const duration = Number.isFinite(rawDuration) && rawDuration > 0 ? Math.min(rawDuration, 1440) : 0
    const end = start + duration
    const channel = channels.get(row)
    const label = `${formatMinute(start)}–${formatMinute(end % 1440)}${end >= 1440 ? ' (+1일)' : ''}`
    if (days.has(row.date)) days.get(row.date).push({ row, channel, start, end: Math.min(1440, duration ? end : start + 10), duration, label, continuation: false })
    const nextDate = dayjs(row.date).add(1, 'day').format('YYYY-MM-DD')
    if (end > 1440 && days.has(nextDate)) days.get(nextDate).push({ row, channel, start: 0, end: end - 1440, duration, label, continuation: true })
  }
  for (const blocks of days.values()) {
    const channelOrder = { CA: 0, IP: 1 }
    blocks.sort((a, b) => a.start - b.start || (channelOrder[a.channel] ?? 2) - (channelOrder[b.channel] ?? 2) || b.end - a.end)
    let cluster = [], clusterEnd = -1, laneEnds = []
    const finish = () => { for (const block of cluster) block.lanes = laneEnds.length }
    for (const block of blocks) {
      if (block.start >= clusterEnd) { finish(); cluster = []; laneEnds = []; clusterEnd = -1 }
      let lane = block.channel ? channelOrder[block.channel] : laneEnds.findIndex(end => end <= block.start)
      if (block.channel && laneEnds[lane] > block.start) {
        lane = laneEnds.findIndex((end, index) => index >= 2 && end <= block.start)
        if (lane < 0) lane = Math.max(2, laneEnds.length)
      }
      if (lane < 0) lane = laneEnds.length
      if (block.channel && laneEnds.length < 2) {
        while (laneEnds.length < 2) laneEnds.push(-1)
      }
      laneEnds[lane] = block.end
      block.lane = lane
      cluster.push(block)
      clusterEnd = Math.max(clusterEnd, block.end)
    }
    finish()
  }
  return days
}
