// MSM source reader; Spreadsheet ID is configured in Script Properties.
const GAS_TIME_ZONE = 'Asia/Seoul'

function buildMonthlyPayload_(month) {
  const ss = SpreadsheetApp.openById(dashboardProperties_().getProperty('COMPETITOR_SOURCE_SPREADSHEET_ID'))
  const sheetNames = ['SSG', 'K', 'SK']
  const result = {}

  sheetNames.forEach(name => {
    const sheet = ss.getSheetByName(name)
    if (!sheet) throw new Error(name + ' source sheet not found')

    const lastRow = sheet.getLastRow()
    if (lastRow < 2) {
      result[name] = []
      return
    }

    const data = sheet.getRange(2, 1, lastRow - 1, 19).getValues()

    result[name] = data
      .map(row => {
        const originalHour = row[5]
        const effectiveDate = formatBroadcastDate_(row[4])
        const effectiveMonth = getMonthFromDate_(effectiveDate)

        return { row, effectiveDate, effectiveMonth }
      })
      .filter(item => {
        if (item.effectiveMonth) return item.effectiveMonth === String(month)
        return String(item.row[0]) === String(month)
      })
      .map(item => {
        const row = item.row
        const originalHour = row[5]
        const normalizedHour = normalizeHour_(originalHour)
        const normalizedMinute = normalizeMinute_(row[6])

        return {
          month:            month,
          week:             row[1],
          weightedMin:      row[2],
          org:              row[3],
          date:             item.effectiveDate,
          hour:             normalizedHour,
          minute:           normalizedMinute,
          time:             `${normalizedHour}:${pad2_(normalizedMinute)}`,
          originalHour:     originalHour,
          originalTime:     `${originalHour}:${pad2_(row[6])}`,
          simpleMin:        row[7],
          mdCategory:       row[8],
          brand:            row[9],
          productName:      row[10],
          price:            row[11],
          company:          row[12],
          brandWeightedMin: row[13],
          dataProductName:  row[14],
          salesQty:         row[15],
          revenue:          row[16],
          errorCode:        row[17],
          channel:          ['SSG', 'SK'].includes(name) ? row[18] : '',
        }
      })
  })

  return {
    month,
    updatedAt: new Date().toISOString(),
    data: result,
  }
}

function countRowsBySheet_(data) {
  const counts = {}
  Object.keys(data).forEach(name => {
    counts[name] = data[name].length
  })
  return counts
}

function normalizeHour_(value) {
  const hour = Number(value)
  if (!Number.isFinite(hour)) return value
  return hour === 24 ? 0 : hour
}

function formatBroadcastDate_(dateValue) {
  const date = coerceDate_(dateValue)
  if (!date) return String(dateValue || '').trim().split('T')[0].replace(/\//g, '-')

  return Utilities.formatDate(date, GAS_TIME_ZONE, 'yyyy-MM-dd')
}

function coerceDate_(value) {
  if (value instanceof Date) return value

  const text = String(value || '').trim()
  if (!text) return null

  const normalized = text.split('T')[0].replace(/\./g, '-').replace(/\//g, '-')
  const matched = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (matched) {
    const [, year, month, day] = matched
    return new Date(Number(year), Number(month) - 1, Number(day))
  }

  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date
}

function getMonthFromDate_(dateText) {
  const matched = String(dateText || '').match(/^(\d{4})-(\d{2})-\d{2}$/)
  return matched ? `${matched[1]}${matched[2]}` : ''
}

function normalizeMinute_(value) {
  const minute = Number(value)
  return Number.isFinite(minute) ? minute : value
}

function pad2_(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return String(value || '').padStart(2, '0')
  return String(num).padStart(2, '0')
}

