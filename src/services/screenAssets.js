import { callGas } from './gasApi'
const screens = globalThis.__MSM_SCREEN_ASSETS__ ||= new Map()
export function loadScreen(screen, globalName) {
  if (window[globalName]) return Promise.resolve()
  if (screens.has(screen)) return screens.get(screen)
  const pending = callGas('getDashboardScreenAssets', screen).then(assets => {
    const template = document.createElement('template')
    template.innerHTML = assets.css
    document.head.appendChild(template.content)
    const source = document.createElement('template')
    source.innerHTML = assets.script
    for (const item of source.content.querySelectorAll('script')) {
      const script = document.createElement('script')
      script.textContent = item.textContent
      document.body.appendChild(script)
    }
    if (!window[globalName]) throw new Error('화면을 불러오지 못했습니다. 다시 시도해 주세요.')
  }).catch(error => { screens.delete(screen); throw error })
  screens.set(screen, pending)
  return pending
}
