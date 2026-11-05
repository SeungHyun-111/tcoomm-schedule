import React from 'react'
import { createRoot } from 'react-dom/client'
import FullListPage from './pages/FullListPage'
import './pages/FullListPage.css'

window.__MSM_LIST__ = {
  mount(element, session) {
    const root = createRoot(element, { onUncaughtError(error, info) {
      window.__MSM_DIAGNOSTICS__?.report('list-render', { message: error.message, stack: `${error.stack || ''}\n${info.componentStack || ''}` })
    } })
    root.render(<FullListPage session={session} />)
    return () => root.unmount()
  },
}
window.dispatchEvent(new Event('msm-list-ready'))
