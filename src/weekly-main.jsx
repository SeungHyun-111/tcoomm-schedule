import React from 'react'
import { createRoot } from 'react-dom/client'
import CompetitorPage from './pages/CompetitorPage'
import './corporate-slate.css'

window.__MSM_WEEKLY__ = {
  mount(element, session) {
    const root = createRoot(element, {
      onUncaughtError(error, info) {
        window.__MSM_DIAGNOSTICS__?.report('weekly-render', { message: error.message, stack: `${error.stack || ''}\n${info.componentStack || ''}` })
      },
    })
    document.body.classList.add('gas-urban')
    root.render(<CompetitorPage session={session} />)
    return () => { root.unmount(); document.body.classList.remove('gas-urban') }
  },
}
window.dispatchEvent(new Event('msm-weekly-ready'))
