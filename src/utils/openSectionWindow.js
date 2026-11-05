export function openSectionWindow(event, title, options = {}) {
  event.preventDefault()
  event.stopPropagation()

  const source = event.currentTarget
  const popupFeatures = options.fullscreen
    ? `left=0,top=0,width=${window.screen.availWidth},height=${window.screen.availHeight}`
    : 'width=1280,height=900'
  const popup = window.open('', '_blank', popupFeatures)

  if (!popup) return

  if (options.fullscreen) {
    popup.moveTo?.(0, 0)
    popup.resizeTo?.(window.screen.availWidth, window.screen.availHeight)
  }

  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((node) => node.outerHTML)
    .join('\n')
  const baseHref = `${window.location.origin}${window.location.pathname}`
  const contentHtml = source.matches('.strategy-plans article')
    ? `<section class="strategy-plans">${source.outerHTML}</section>`
    : source.outerHTML
  const popupClass = [
    source.matches('.strategy-plans article') ? 'is-strategy-plan' : '',
    source.matches('.month-calendar') ? 'is-month-calendar' : '',
  ].filter(Boolean).join(' ')

  popup.document.write(`<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <base href="${escapeHtml(baseHref)}" />
  <title>${escapeHtml(title)}</title>
  ${styles}
  <style>
    body {
      margin: 0;
      padding: 28px;
      background: #f5f5f7;
      color: #1d1d1f;
      box-sizing: border-box;
    }
    .popup-root {
      width: 100%;
      max-width: none;
      margin: 0;
    }
    .popup-root.is-strategy-plan,
    .popup-root.is-month-calendar {
      min-height: calc(100vh - 56px);
    }
    .popup-root > * {
      width: 100% !important;
      max-width: none !important;
      margin: 0 !important;
      box-sizing: border-box;
    }
    .popup-root .company-card,
    .popup-root .strategy-plans article,
    .popup-root .month-calendar,
    .popup-root .request-details,
    .popup-root .broadcast-section {
      box-shadow: 0 16px 34px rgba(0, 0, 0, 0.1);
    }
    .popup-root .strategy-plans {
      display: block;
    }
    .popup-root .strategy-plans article {
      height: calc(100vh - 56px);
      min-height: 520px;
      overflow: auto;
    }
    .popup-root.is-month-calendar .month-calendar {
      min-height: calc(100vh - 56px);
      display: flex;
      flex-direction: column;
    }
    .popup-root.is-month-calendar .calendar-grid {
      flex: 0 0 auto;
      align-content: start;
      grid-template-rows: 38px;
      grid-auto-rows: minmax(146px, auto);
      background: #fff;
    }
    .popup-root.is-month-calendar .calendar-day {
      border-top: 1px solid rgba(0, 0, 0, 0.06);
      border-left: 1px solid rgba(0, 0, 0, 0.06);
    }
    .popup-root.is-month-calendar .calendar-day:nth-child(7n + 1) {
      border-left: 0;
    }
    .popup-root.is-month-calendar .calendar-day.is-blank {
      min-height: 0;
      padding: 0;
      background: transparent;
      box-shadow: none;
    }
    .popup-root.is-month-calendar .calendar-day.is-blank .calendar-day-head {
      display: none;
    }
    .popup-root .broadcast-section,
    .popup-root .request-details,
    .popup-root .month-calendar {
      overflow: auto;
    }
    @media print {
      body {
        padding: 0;
        background: #fff;
      }
      .popup-root > * {
        box-shadow: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="popup-root ${popupClass}">${contentHtml}</div>
</body>
</html>`)
  popup.document.close()
  popup.focus()
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
