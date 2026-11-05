import React from 'react'
import { createRoot } from 'react-dom/client'
import AccessPage from './pages/AccessPage'
import './pages/AccessPage.css'

window.__MSM_ACCESS__ = {
  mount(element, session) {
    const root = createRoot(element, {
      onUncaughtError(error, info) {
        window.__MSM_DIAGNOSTICS__?.report('access-render', { message: error.message, stack: `${error.stack || ''}\n${info.componentStack || ''}` })
      },
    })
    root.render(<AccessPage session={session} />)
    return () => root.unmount()
  },
}
window.dispatchEvent(new Event('msm-access-ready'))
