// 3D view of the network: rotate, zoom and fly to any player, team or achievement.
// Loaded on its own (it brings Three.js), and only when someone opens the 3D view.
import { useEffect, useRef } from 'react'
import ForceGraph3D from '3d-force-graph'
import SpriteText from 'three-spritetext'

const SIZE = { team: 7, achievement: 6, player: 3, opponent: 4 }

export default function Graph3D({ graph, colors, apiRef, onSelect }) {
  const host = useRef(null)
  useEffect(() => {
    const el = host.current
    if (!el) return
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const data = { nodes: graph.nodes.map((n) => ({ ...n })), links: graph.links.map((l) => ({ ...l })) }
    const neighbours = new Map(data.nodes.map((n) => [n.id, new Set()]))
    for (const l of data.links) { neighbours.get(l.source)?.add(l.target); neighbours.get(l.target)?.add(l.source) }
    let focus = null
    const lit = (id) => !focus || id === focus || neighbours.get(focus)?.has(id)
    const linkLit = (l) => !focus || (l.source.id ?? l.source) === focus || (l.target.id ?? l.target) === focus

    const fg = new ForceGraph3D(el, { controlType: 'orbit' })
      .backgroundColor('rgba(0,0,0,0)')
      .showNavInfo(false)
      .width(el.clientWidth).height(el.clientHeight)
      .graphData(data)
      .nodeId('id')
      .nodeVal((n) => SIZE[n.kind] || 3)
      .nodeColor((n) => (lit(n.id) ? colors[n.kind] : 'rgba(120,140,190,0.18)'))
      .nodeOpacity(0.95)
      .nodeResolution(16)
      .nodeLabel((n) => `<div class="g3-tip">${n.label}</div>`)
      // Teams and achievements carry floating labels; players show theirs on hover, to keep it readable
      .nodeThreeObjectExtend(true)
      .nodeThreeObject((n) => {
        if (n.kind === 'player' && graph.nodes.length > 60) return null
        const t = new SpriteText(n.label)
        t.color = n.kind === 'team' ? '#ffe08a' : n.kind === 'achievement' ? '#ffd1bd' : '#dfe6ff'
        t.textHeight = n.kind === 'player' ? 2.6 : 3.4
        t.fontFace = 'Inter, system-ui, sans-serif'
        t.backgroundColor = 'rgba(3,10,28,0.55)'; t.padding = 1.2; t.borderRadius = 2
        t.position.y = (SIZE[n.kind] || 3) + 5
        return t
      })
      .linkColor((l) => (l.captain ? '#f5c842' : '#8fa6e0'))
      .linkOpacity(0.35)
      .linkWidth((l) => (l.captain ? 1.2 : 0.25))
      .linkVisibility((l) => linkLit(l))
      .linkDirectionalParticles((l) => (reduced ? 0 : l.captain ? 3 : 1))
      .linkDirectionalParticleWidth((l) => (l.captain ? 2 : 1))
      .linkDirectionalParticleSpeed(0.005)
      .linkDirectionalParticleColor((l) => (l.captain ? '#ffe08a' : '#a9c3ff'))
      .warmupTicks(40)
      .cooldownTicks(reduced ? 0 : 200)
      .onNodeHover((n) => { el.style.cursor = n ? 'pointer' : 'grab' })
      .onNodeClick((n) => select(n))
      .onBackgroundClick(() => select(null))

    fg.d3Force('charge').strength(-60)
    fg.d3Force('link').distance((l) => (l.target.kind === 'achievement' || l.source.kind === 'achievement' ? 55 : 38))

    const refresh = () => { fg.nodeColor(fg.nodeColor()); fg.linkVisibility(fg.linkVisibility()) }
    const select = (n) => {
      focus = n?.id || null
      refresh()
      if (n) {
        const d = 90, r = 1 + d / Math.hypot(n.x || 1, n.y || 1, n.z || 1)
        fg.cameraPosition({ x: (n.x || 0) * r, y: (n.y || 0) * r, z: (n.z || 0) * r }, n, reduced ? 0 : 1200)
        onSelect?.({ id: n.id, label: n.label, kind: n.kind, href: n.href, count: neighbours.get(n.id)?.size || 0 })
      } else { onSelect?.(null); fg.zoomToFit(reduced ? 0 : 900, 40) }
    }

    // Slow orbit until someone touches the view
    const controls = fg.controls()
    if (controls && !reduced) { controls.autoRotate = true; controls.autoRotateSpeed = 0.6; controls.addEventListener('start', () => { controls.autoRotate = false }) }
    setTimeout(() => fg.zoomToFit(reduced ? 0 : 900, 40), 500)

    if (apiRef) apiRef.current = {
      find: (q) => { const n = data.nodes.find((x) => x.label.toLowerCase().includes(q.toLowerCase())); if (n) select(n); return !!n },
      reset: () => select(null),
    }

    const ro = new ResizeObserver(() => fg.width(el.clientWidth).height(el.clientHeight)); ro.observe(el)
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? fg.resumeAnimation() : fg.pauseAnimation()))
    io.observe(el)
    return () => { ro.disconnect(); io.disconnect(); fg._destructor?.(); el.innerHTML = '' }
  }, [graph, colors, apiRef, onSelect])
  return <div ref={host} style={{ width: '100%', height: '100%' }} aria-label="3D network of players, teams and achievements" />
}
