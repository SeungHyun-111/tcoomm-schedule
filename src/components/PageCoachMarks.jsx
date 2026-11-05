import React, { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { pageGuideSteps } from '../utils/pageGuides'
import './PageCoachMarks.css'

export default function PageCoachMarks({ view, session }) {
  const [step, setStep] = useState(-1)
  const [position, setPosition] = useState(null)
  const card = useRef(null), trigger = useRef(null)
  const steps = pageGuideSteps(view, session)
  const close = () => { setStep(-1); setPosition(null); trigger.current?.focus() }
  useLayoutEffect(() => {
    if (step < 0) return
    let frame, target
    function update() {
      const item = steps[step]
      const found = [...document.querySelectorAll(item.selector)].find(element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden')
      if (found && found !== target) {
        target = found
        target.scrollIntoView({ block: target.offsetHeight > innerHeight / 2 ? 'start' : 'center', inline: 'nearest', behavior: 'instant' })
      }
      const rect = found?.getBoundingClientRect()
      const top = Math.max(8, Math.min(innerHeight - 8, (rect?.top || 8) - 6))
      const left = Math.max(8, Math.min(innerWidth - 8, (rect?.left || 8) - 6))
      const right = Math.max(left, Math.min(innerWidth - 8, (rect?.right || innerWidth - 8) + 6))
      const bottom = Math.max(top, Math.min(innerHeight - 8, (rect?.bottom || 8) + 6))
      const width = Math.min(360, innerWidth - 32), height = Math.min(card.current?.offsetHeight || 260, innerHeight - 32)
      const desired = innerHeight - bottom >= height + 30 ? bottom + 14 : top - height - 14
      const next = { top, left, width: right - left, height: bottom - top, cardLeft: Math.max(16, Math.min(innerWidth - width - 16, (left + right - width) / 2)), cardTop: Math.max(16, Math.min(innerHeight - height - 16, desired)), found: !!found }
      setPosition(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next)
    }
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update) }
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true })
    const resize = new ResizeObserver(schedule)
    if (card.current) resize.observe(card.current)
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, true)
    update(); schedule()
    card.current?.focus()
    return () => { observer.disconnect(); resize.disconnect(); cancelAnimationFrame(frame); window.removeEventListener('resize', schedule); window.removeEventListener('scroll', schedule, true) }
  }, [step, view, session.role])
  return <>
    <button ref={trigger} className="page-guide-trigger" onClick={() => { setPosition(null); setStep(0) }}>도움말</button>
    {step >= 0 && createPortal(<div className="page-guide-overlay" onKeyDown={event => {
      if (event.key === 'Escape') close()
      if (event.key === 'Tab') {
        const controls = [...card.current.querySelectorAll('button')], first = controls[0], last = controls.at(-1)
        if (event.shiftKey && (document.activeElement === first || document.activeElement === card.current)) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === card.current)) { event.preventDefault(); first.focus() }
      }
    }}>
      {position?.found && <div className="page-guide-target" style={{ top: position.top, left: position.left, width: position.width, height: position.height }} />}
      <section ref={card} className="page-guide-card" tabIndex={-1} role="dialog" aria-modal="true" aria-label="화면 사용 안내" style={{ top: position?.cardTop || 16, left: position?.cardLeft || 16 }}>
        <small>{session.canManageAccess ? '관리자' : session.canViewRevenue ? '매출 권한' : '일반 뷰어'} 안내 · {step + 1} / {steps.length}</small>
        <h2>{steps[step].title}</h2><p>{steps[step].description}</p>
        {!position?.found && <p className="page-guide-wait">해당 영역이 표시되면 위치를 안내합니다.</p>}
        <footer><button onClick={close}>닫기</button><div>{step > 0 && <button onClick={() => setStep(value => value - 1)}>이전</button>}<button onClick={() => step === steps.length - 1 ? close() : setStep(value => value + 1)}>{step === steps.length - 1 ? '완료' : '다음'}</button></div></footer>
      </section>
    </div>, document.body)}
  </>
}
