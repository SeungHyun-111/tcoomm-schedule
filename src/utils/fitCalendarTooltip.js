export function fitCalendarTooltip(element, anchor, boundary, placement = 'side') {
  const margin = 8
  const bounds = boundary?.getBoundingClientRect() || { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight, width: window.innerWidth, height: window.innerHeight }
  element.style.maxWidth = `${Math.max(0, bounds.width - margin * 2)}px`
  element.style.maxHeight = `${Math.max(0, bounds.height - margin * 2)}px`
  const { width, height } = element.getBoundingClientRect()
  let left = anchor.right + width + margin * 2 <= bounds.right ? anchor.right + margin : anchor.left - width - margin
  let top = Math.max(bounds.top + margin, Math.min(anchor.top, bounds.bottom - height - margin))
  if (placement === 'below') {
    left = anchor.left + margin
    const below = bounds.bottom - anchor.bottom - margin * 2
    const above = anchor.top - bounds.top - margin * 2
    if (below < Math.min(height, 100) && above > below) {
      element.style.maxHeight = `${Math.max(0, above)}px`
      top = anchor.top - element.getBoundingClientRect().height - margin
    } else {
      element.style.maxHeight = `${Math.max(0, below)}px`
      top = anchor.bottom + margin
    }
  }
  element.style.left = `${Math.max(bounds.left + margin, Math.min(left, bounds.right - width - margin))}px`
  element.style.top = `${top}px`
}
