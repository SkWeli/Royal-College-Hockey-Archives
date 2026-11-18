import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as d3 from 'd3'
import { useData } from '../App.jsx'

const COLORS = { player: '#8fb0ff', team: '#f2c230', honour: '#f08a5d', opponent: '#9aa3c0' }

// Honours become shared nodes (e.g. one "Royal Colours" node), so players who share them cluster together.
function buildGraph(db, { from, to, showHonours, showOpponents, fullRange }) {
  const nodes = new Map(), links = []
  const add = (id, label, kind, href) => nodes.has(id) || nodes.set(id, { id, label, kind, href })
  const teams = db.teams.filter((t) => t.season >= from && t.season <= to)
  for (const t of teams) {
    add(t.id, db.teamLabel(t), 'team', `/teams/${t.id}`)
    for (const m of db.membershipsByTeam[t.id] || []) {
      const p = db.player[m.player_id]; if (!p) continue
      add(p.id, p.full_name, 'player', `/players/${p.id}`)
      links.push({ source: p.id, target: t.id, captain: m.role === 'Captain' })
    }
    if (showHonours) for (const a of db.teamAchByTeam[t.id] || []) {
      add('ta:' + a.id, `${a.title}: ${a.finish}`, 'honour'); links.push({ source: t.id, target: 'ta:' + a.id })
    }
    if (showOpponents) for (const m of db.matchesByTeam[t.id] || []) {
      const o = db.opponent[m.opponent_id]; if (!o) continue
      add('o:' + o.id, o.name, 'opponent', `/opponents/${o.id}`); links.push({ source: t.id, target: 'o:' + o.id })
    }
  }
  if (showHonours) {
    const seen = new Set()
    for (const a of db.achievements) {
      const p = db.player[a.player_id]; if (!p) continue
      // Dated honours show when in range. Undated ones show for players already in view, or when viewing all years.
      const ok = a.season ? a.season >= from && a.season <= to : nodes.has(p.id) || fullRange
      if (!ok) continue
      add(p.id, p.full_name, 'player', `/players/${p.id}`)
      const key = `h:${a.sport}:${a.title}`
      add(key, !a.sport || a.sport === 'Hockey' ? a.title : `${a.sport}: ${a.title}`, 'honour')
      if (!seen.has(p.id + key)) { seen.add(p.id + key); links.push({ source: p.id, target: key }) }
    }
  }
  return { nodes: [...nodes.values()], links }
}

export default function Graph() {
  const { db } = useData()
  const nav = useNavigate()
  const years = [...db.teams.map((t) => t.season), ...db.achievements.map((a) => a.season).filter(Boolean)]
  const minY = years.length ? Math.min(...years) : 2000, maxY = years.length ? Math.max(...years) : 2000
  const [from, setFrom] = useState(minY), [to, setTo] = useState(maxY)
  const [showHonours, setShowHonours] = useState(true), [showOpponents, setShowOpponents] = useState(false)
  const [q, setQ] = useState(''), [info, setInfo] = useState('Click a dot to highlight its links. Double-click to open its page.')
  const ref = useRef(), api = useRef({})
  const graph = useMemo(() => buildGraph(db, { from, to, showHonours, showOpponents, fullRange: from <= minY && to >= maxY }), [db, from, to, showHonours, showOpponents, minY, maxY])

  useEffect(() => {
    const W = 1000, H = 640, svg = d3.select(ref.current)
    svg.selectAll('*').remove()
    const g = svg.append('g')
    svg.call(d3.zoom().scaleExtent([0.3, 4]).on('zoom', (e) => g.attr('transform', e.transform)))
    const nodes = graph.nodes.map((d) => ({ ...d })), links = graph.links.map((d) => ({ ...d }))
    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d) => d.id).distance(55))
      .force('charge', d3.forceManyBody().strength(-180))
      .force('x', d3.forceX(W / 2).strength(0.05)).force('y', d3.forceY(H / 2).strength(0.07))
      .force('collide', d3.forceCollide(14))
    const link = g.append('g').selectAll('line').data(links).join('line')
      .attr('stroke', (d) => (d.captain ? '#f2c230' : '#8fa0cc')).attr('stroke-width', (d) => (d.captain ? 3 : 1.2)).attr('stroke-opacity', 0.45)
    const node = g.append('g').selectAll('g').data(nodes).join('g').attr('class', 'node').style('cursor', 'pointer')
      .call(d3.drag()
        .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
        .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y })
        .on('end', (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null }))
    node.append('circle').attr('r', (d) => ({ player: 8, team: 10, honour: 9, opponent: 7 }[d.kind])).attr('fill', (d) => COLORS[d.kind]).attr('stroke', '#050f2c').attr('stroke-width', 1.5)
    node.append('text').text((d) => d.label).attr('x', 12).attr('y', 4).attr('font-size', 11).attr('fill', '#e6ebf7').attr('paint-order', 'stroke').attr('stroke', '#050f2c').attr('stroke-width', 3)

    const focus = (d) => {
      if (!d) { node.transition().duration(250).style('opacity', 1); link.transition().duration(250).style('opacity', 1); return }
      const nb = new Set([d.id])
      links.forEach((l) => { if (l.source.id === d.id) nb.add(l.target.id); if (l.target.id === d.id) nb.add(l.source.id) })
      node.transition().duration(250).style('opacity', (x) => (nb.has(x.id) ? 1 : 0.12))
      link.transition().duration(250).style('opacity', (l) => (l.source.id === d.id || l.target.id === d.id ? 1 : 0.04))
      setInfo(`${d.label}: ${nb.size - 1} connection${nb.size === 2 ? '' : 's'}${d.href ? ' · double-click to open' : ''}`)
    }
    node.on('click', (e, d) => { e.stopPropagation(); focus(d) })
    node.on('dblclick', (e, d) => d.href && nav(d.href))
    svg.on('click', () => { focus(null); setInfo('Click a dot to highlight its links. Double-click to open its page.') })
    sim.on('tick', () => {
      link.attr('x1', (d) => d.source.x).attr('y1', (d) => d.source.y).attr('x2', (d) => d.target.x).attr('y2', (d) => d.target.y)
      node.attr('transform', (d) => `translate(${d.x},${d.y})`)
    })
    api.current = { nodes, focus }
    return () => sim.stop()
  }, [graph, nav])

  const search = (e) => {
    e.preventDefault()
    const d = api.current.nodes?.find((n) => n.label.toLowerCase().includes(q.toLowerCase()))
    if (d) api.current.focus(d); else setInfo(`No match for "${q}" in this range.`)
  }

  return (
    <>
      <h1>Network</h1>
      <p className="lead">How players, teams and honours connect. Players who share an honour gather around it.</p>
      <div className="row">
        <label className="small">From <input type="number" value={from} min={minY} max={to} onChange={(e) => setFrom(+e.target.value)} style={{ width: 90 }} /></label>
        <label className="small">To <input type="number" value={to} min={from} max={maxY} onChange={(e) => setTo(+e.target.value)} style={{ width: 90 }} /></label>
        <label className="small"><input type="checkbox" checked={showHonours} onChange={(e) => setShowHonours(e.target.checked)} /> Honours</label>
        <label className="small"><input type="checkbox" checked={showOpponents} onChange={(e) => setShowOpponents(e.target.checked)} /> Opponents</label>
        <form onSubmit={search} className="row" style={{ margin: 0 }}>
          <input placeholder="Find a name" value={q} onChange={(e) => setQ(e.target.value)} /><button>Find</button>
        </form>
      </div>
      <div className="legend row">
        {Object.entries(COLORS).map(([k, c]) => <span key={k}><i style={{ background: c }} />{k[0].toUpperCase() + k.slice(1)}</span>)}
        <span><i style={{ background: '#d4a017', borderRadius: 0, height: 3, width: 16 }} />Captain link</span>
        <span className="muted" style={{ marginLeft: 'auto' }}>{info}</span>
      </div>
      <svg ref={ref} className="viz dark" viewBox="0 0 1000 640" style={{ height: 'min(70vh, 640px)' }} />
      <p className="small muted">Scroll to zoom, drag the background to pan, and drag dots to rearrange.</p>
    </>
  )
}
