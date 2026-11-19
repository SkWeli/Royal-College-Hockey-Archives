// Depth effects shared across the site. Each one switches itself off for touch-only screens
// (tilt) and for people who ask their device to reduce motion (everything).
import { useEffect } from 'react'

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches

// 3D tilt: cards lean towards the mouse, with a soft gold light under the pointer.
const TILT = 'a.card, .stat, .honour, .squad-row'
export function useTilt() {
  useEffect(() => {
    if (reduced() || !matchMedia('(hover: hover) and (pointer: fine)').matches) return
    let el = null, raf = 0, ev = null
    const apply = () => {
      raf = 0
      if (!el || !ev) return
      const r = el.getBoundingClientRect()
      const px = (ev.clientX - r.left) / r.width, py = (ev.clientY - r.top) / r.height
      const max = el.matches('.squad-row, .honour') ? 3 : 7
      el.style.setProperty('--ry', `${((px - 0.5) * 2 * max).toFixed(2)}deg`)
      el.style.setProperty('--rx', `${((0.5 - py) * 2 * max).toFixed(2)}deg`)
      el.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`)
      el.style.setProperty('--my', `${(py * 100).toFixed(1)}%`)
    }
    const reset = (x) => { if (x) { x.style.removeProperty('--rx'); x.style.removeProperty('--ry') } }
    const move = (e) => {
      const t = e.target.closest?.(TILT)
      if (t !== el) { reset(el); el = t }
      ev = e
      if (el && !raf) raf = requestAnimationFrame(apply)
    }
    const leave = () => { reset(el); el = null }
    document.addEventListener('pointermove', move, { passive: true })
    document.addEventListener('pointerleave', leave)
    return () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerleave', leave); cancelAnimationFrame(raf) }
  }, [])
}

// Scroll reveal: blocks below the fold rise into place with depth as they come into view.
const REVEAL = 'main h2, main .grid > *, main .stats > *, main .honour, main .squad-row, main table, main .viz, main .season-card, main .graph-wrap, main .scroll-x'
export function useScrollReveal(key, enabled) {
  useEffect(() => {
    if (!enabled || reduced() || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('rv-in'); io.unobserve(e.target) }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 })
    const tag = () => {
      const fold = window.innerHeight * 0.92
      document.querySelectorAll(REVEAL).forEach((el, i) => {
        if (el.dataset.rv) return
        el.dataset.rv = '1'
        if (el.getBoundingClientRect().top < fold) return // already on screen: leave it to the page animation
        el.classList.add('rv')
        if (!el.style.getPropertyValue('--i')) el.style.setProperty('--i', String(i % 6))
        io.observe(el)
      })
    }
    const t = setTimeout(tag, 60)
    const mo = new MutationObserver(() => tag())
    const main = document.querySelector('main') || document.body
    mo.observe(main, { childList: true, subtree: true })
    return () => { clearTimeout(t); mo.disconnect(); io.disconnect() }
  }, [key, enabled])
}
