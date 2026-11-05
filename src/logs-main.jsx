import React from 'react'
import { createRoot } from 'react-dom/client'
import AccessLogPage from './pages/AccessLogPage'
import './pages/AccessLogPage.css'

window.__MSM_LOGS__ = {
  mount(element) {
    const root = createRoot(element, {
      onUncaughtError(error, info) {
        window.__MSM_DIAGNOSTICS__?.report('logs-render', { message: error.message, stack: `${error.stack || ''}\n${info.componentStack || ''}` })
      },
    })
    root.render(<AccessLogPage />)
    return () => root.unmount()
  },
}
window.dispatchEvent(new Event('msm-logs-ready'))
