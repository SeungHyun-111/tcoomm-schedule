import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './base.css'
import './shell.css'
import './corporate-slate.css'

globalThis.__MSM_DIAGNOSTICS__?.stage('react-render')
createRoot(document.getElementById('root'), {
  onUncaughtError(error, info) {
    globalThis.__MSM_DIAGNOSTICS__?.report('react-render', {
      message: error?.message || String(error),
      stack: `${error?.stack || ''}\n컴포넌트 위치:${info?.componentStack || ''}`,
    })
  },
}).render(<App />)
