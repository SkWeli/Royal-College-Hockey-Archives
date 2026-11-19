// The home page's 3D pitch: a floodlit hockey field at night, seen from the stand.
// Loaded on its own (Three.js is large), only drawn while on screen, and still for reduced motion.
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

const L = 9.14, Wd = 5.5          // pitch length and width (1 unit = 10 m)
const HL = L / 2, HW = Wd / 2

function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')) } catch { return false }
}

// Field markings drawn onto a texture: back lines, centre line, 23 m lines, shooting circles, dotted 5 m lines, spots.
function pitchTexture() {
  const S = 224, cw = Math.round(L * S), ch = Math.round(Wd * S)
  const c = document.createElement('canvas'); c.width = cw; c.height = ch
  const g = c.getContext('2d')
  const grad = g.createLinearGradient(0, 0, 0, ch)
  grad.addColorStop(0, '#1b4aa6'); grad.addColorStop(1, '#14398a')
  g.fillStyle = grad; g.fillRect(0, 0, cw, ch)
  for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.05)'; g.fillRect((cw / 12) * i, 0, cw / 12, ch) }
  const m = (v) => v * S / 10          // metres → pixels
  const X = (x) => cw / 2 + m(x), Y = (y) => ch / 2 + m(y)
  g.strokeStyle = 'rgba(255,255,255,0.92)'; g.lineWidth = m(0.075) * 1.6; g.lineCap = 'round'
  g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, cw - g.lineWidth, ch - g.lineWidth)
  const line = (x1, y1, x2, y2) => { g.beginPath(); g.moveTo(X(x1), Y(y1)); g.lineTo(X(x2), Y(y2)); g.stroke() }
  line(0, -27.5, 0, 27.5); line(-22.85, -27.5, -22.85, 27.5); line(22.85, -27.5, 22.85, 27.5)
  for (const side of [-1, 1]) {
    const bx = side * 45.7, dir = -side, r = 14.63, post = 1.83
    // Shooting circle: quarter circles round each post, joined by a straight line
    const d = (rad, dashed) => {
      g.setLineDash(dashed ? [m(0.3), m(2.7)] : [])
      g.beginPath()
      if (side < 0) { g.arc(X(bx), Y(-post), m(rad), -Math.PI / 2, 0, false); g.lineTo(X(bx + rad), Y(post)); g.arc(X(bx), Y(post), m(rad), 0, Math.PI / 2, false) }
      else { g.arc(X(bx), Y(-post), m(rad), -Math.PI / 2, -Math.PI, true); g.lineTo(X(bx - rad), Y(post)); g.arc(X(bx), Y(post), m(rad), Math.PI, Math.PI / 2, true) }
      g.stroke()
    }
    d(r, false); d(r + 5, true)
    g.setLineDash([])
    g.fillStyle = '#fff'; g.beginPath(); g.arc(X(bx + dir * 6.475), Y(0), m(0.15), 0, Math.PI * 2); g.fill()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

function glowTexture(inner, outer) {
  const c = document.createElement('canvas'); c.width = c.height = 256
  const g = c.getContext('2d'), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128)
  gr.addColorStop(0, inner); gr.addColorStop(1, outer)
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
  return t
}

export default function Hero3D({ onFail }) {
  const host = useRef(null)
  useEffect(() => {
    const el = host.current
    if (!el) return
    if (!hasWebGL()) { onFail?.(); return }
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    let renderer
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }) } catch { onFail?.(); return }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.fog = new THREE.Fog(0x030a1c, 10, 24)
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100)
    const field = new THREE.Group(); scene.add(field)   // everything on the pitch, turned as one
    const disposables = []
    const keep = (x) => (disposables.push(x), x)

    // Lights: cool floodlights from above, gold light travelling with the ball
    scene.add(new THREE.HemisphereLight(0xa9c3ff, 0x02081a, 1.1))
    const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(3, 9, 5); scene.add(sun)
    const ballLight = new THREE.PointLight(0xf5c842, 3, 3.2, 1.6); field.add(ballLight)

    // Pitch, with a soft glow underneath and a gold rim
    const tex = keep(pitchTexture())
    const pitch = new THREE.Mesh(keep(new THREE.PlaneGeometry(L, Wd)), keep(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0.05, emissive: 0x0a2a6a, emissiveIntensity: 0.35 })))
    pitch.rotation.x = -Math.PI / 2
    field.add(pitch)
    const under = new THREE.Mesh(keep(new THREE.PlaneGeometry(L * 1.9, Wd * 2.4)), keep(new THREE.MeshBasicMaterial({ map: keep(glowTexture('rgba(42,84,176,0.55)', 'rgba(42,84,176,0)')), transparent: true, depthWrite: false })))
    under.rotation.x = -Math.PI / 2; under.position.y = -0.02; field.add(under)
    const rimPts = [[-HL, -HW], [HL, -HW], [HL, HW], [-HL, HW]].map(([x, z]) => new THREE.Vector3(x * 1.012, 0.004, z * 1.02))
    const rim = new THREE.LineLoop(keep(new THREE.BufferGeometry().setFromPoints(rimPts)), keep(new THREE.LineBasicMaterial({ color: 0xf5c842, transparent: true, opacity: 0.75 })))
    field.add(rim)

    // Goals
    for (const s of [-1, 1]) {
      const box = keep(new THREE.BoxGeometry(0.12, 0.214, 0.366))
      const goal = new THREE.LineSegments(keep(new THREE.EdgesGeometry(box)), keep(new THREE.LineBasicMaterial({ color: 0xffffff })))
      goal.position.set(s * (HL + 0.06), 0.107, 0); field.add(goal)
    }

    // Players: Royal in navy with gold rings, opponents in white
    const small = innerWidth < 700
    const capsule = keep(new THREE.CapsuleGeometry(0.045, 0.13, 4, 10))
    const ring = keep(new THREE.TorusGeometry(0.11, 0.012, 8, 32))
    const shadowGeo = keep(new THREE.CircleGeometry(0.1, 24))
    const shadowMat = keep(new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }))
    const royalMat = keep(new THREE.MeshStandardMaterial({ color: 0x16337a, roughness: 0.4, metalness: 0.3, emissive: 0x0a1a45, emissiveIntensity: 0.6 }))
    const ringMat = keep(new THREE.MeshBasicMaterial({ color: 0xf5c842 }))
    const oppMat = keep(new THREE.MeshStandardMaterial({ color: 0xdfe6f5, roughness: 0.5 }))
    const homes = [
      [-3.6, 0, true], [-2.2, -1.4, true], [-2.0, 1.5, true], [-0.6, -0.3, true], [0.9, 1.1, true], [2.2, -0.9, true], [3.3, 0.6, true],
      [3.9, -0.4, false], [2.6, 1.6, false], [1.2, -1.7, false], [-0.4, 1.9, false], [-1.6, -0.2, false], [4.35, 0.1, false],
    ]
    const players = homes.map(([x, z, royal]) => {
      const g = new THREE.Group()
      const body = new THREE.Mesh(capsule, royal ? royalMat : oppMat); body.position.y = 0.11; g.add(body)
      const sh = new THREE.Mesh(shadowGeo, shadowMat); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.003; g.add(sh)
      if (royal) { const r = new THREE.Mesh(ring, ringMat); r.rotation.x = -Math.PI / 2; r.position.y = 0.01; g.add(r) }
      g.position.set(x, 0, z); field.add(g)
      return { g, home: new THREE.Vector3(x, 0, z), phase: Math.random() * Math.PI * 2, royal }
    })

    // Ball, its path (passing move ending in a goal), and a glowing trail
    const path = new THREE.CatmullRomCurve3([
      [-3.4, -0.6], [-2.1, 1.2], [-0.7, -0.2], [0.8, 1.0], [2.0, -0.7], [3.2, 0.5], [4.05, 0.05], [4.55, 0.0],
      [3.0, -1.6], [0.6, -1.9], [-1.8, -1.6], [-3.9, -1.2],
    ].map(([x, z]) => new THREE.Vector3(x, 0.07, z)), true, 'centripetal', 0.5)
    const ball = new THREE.Mesh(keep(new THREE.SphereGeometry(0.07, 24, 16)), keep(new THREE.MeshStandardMaterial({ color: 0xfff1c2, emissive: 0xf5c842, emissiveIntensity: 1.6, roughness: 0.3 })))
    field.add(ball)
    const halo = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: keep(glowTexture('rgba(245,200,66,0.9)', 'rgba(245,200,66,0)')), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })))
    halo.scale.set(0.6, 0.6, 1); field.add(halo)
    const TRAIL = 46
    const trailPos = new Float32Array(TRAIL * 3), trailCol = new Float32Array(TRAIL * 3)
    for (let i = 0; i < TRAIL; i++) { const f = 1 - i / TRAIL; trailCol.set([0.96 * f, 0.78 * f, 0.26 * f], i * 3) }
    const trailGeo = keep(new THREE.BufferGeometry())
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3))
    trailGeo.setAttribute('color', new THREE.BufferAttribute(trailCol, 3))
    const trail = new THREE.Line(trailGeo, keep(new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })))
    field.add(trail)

    // Floating light particles over the stadium
    const N = small ? 220 : 520
    const pPos = new Float32Array(N * 3), pSpd = new Float32Array(N)
    for (let i = 0; i < N; i++) { pPos.set([(Math.random() - 0.5) * 16, Math.random() * 4.5, (Math.random() - 0.5) * 11], i * 3); pSpd[i] = 0.05 + Math.random() * 0.18 }
    const pGeo = keep(new THREE.BufferGeometry()); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3))
    const dust = new THREE.Points(pGeo, keep(new THREE.PointsMaterial({ size: 0.035, color: 0xffe08a, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, map: keep(glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)')) })))
    scene.add(dust)

    // Camera framing: pitch to the right on wide screens (text sits on the left), centred at the top on phones
    const view = { pos: new THREE.Vector3(), look: new THREE.Vector3() }
    const frame = () => {
      const w = el.clientWidth, h = el.clientHeight
      renderer.setSize(w, h, false)
      camera.aspect = w / Math.max(h, 1)
      const a = camera.aspect
      if (w >= 860) {
        camera.fov = 30; view.pos.set(0, 7.4, 13.2); view.look.set(0, 0, 0)
        field.rotation.y = -0.36
        camera.setViewOffset(w, h, -w * 0.2, h * 0.04, w, h)   // pitch to the right of the headline
      } else {
        // narrow screens look down the length of the pitch from behind a goal
        const d = a < 0.75 ? 12 : a < 1.2 ? 11.5 : 11
        camera.fov = 46; view.pos.set(0, d * 0.78, d * 0.62); view.look.set(0, 0, 0)
        field.rotation.y = Math.PI / 2 + 0.14
        camera.setViewOffset(w, h, 0, h * 0.03, w, h)   // pitch above the headline
      }
      const dist = view.pos.length()
      scene.fog.near = dist * 0.75; scene.fog.far = dist * 2.1
      camera.updateProjectionMatrix()
    }
    frame()
    let step = () => {}
    const ro = new ResizeObserver(() => { frame(); if (reduced) step(performance.now()) }); ro.observe(el)

    // Mouse parallax and scroll tilt
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 }
    const onMove = (e) => { mouse.tx = (e.clientX / innerWidth) * 2 - 1; mouse.ty = (e.clientY / innerHeight) * 2 - 1 }
    if (!reduced) addEventListener('pointermove', onMove, { passive: true })

    let u = 0.05, last = performance.now(), raf = 0, visible = true, t = 0
    const tmp = new THREE.Vector3(), camPos = new THREE.Vector3(), look = new THREE.Vector3()
    const history = Array.from({ length: TRAIL }, () => path.getPointAt(u).clone())
    step = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05); last = now; t += dt
      if (!reduced) u = (u + dt / 15) % 1
      const p = path.getPointAt(u)
      const nearGoal = p.x > 4.2
      ball.position.copy(p); halo.position.copy(p)
      ballLight.position.set(p.x, 0.35, p.z); ballLight.intensity = nearGoal ? 6 : 3
      history.pop(); history.unshift(p.clone())
      for (let i = 0; i < TRAIL; i++) trailPos.set([history[i].x, 0.05, history[i].z], i * 3)
      trailGeo.attributes.position.needsUpdate = true
      for (const pl of players) {   // drift with the play, with a little run in their step
        tmp.copy(pl.home).lerp(p, pl.royal ? 0.32 : 0.26)
        pl.g.position.lerp(tmp, reduced ? 1 : Math.min(1, dt * 1.6))
        pl.g.position.y = Math.abs(Math.sin(t * 6 + pl.phase)) * 0.015
      }
      if (!reduced) for (let i = 0; i < N; i++) { const y = pPos[i * 3 + 1] + pSpd[i] * dt; pPos[i * 3 + 1] = y > 4.5 ? 0 : y }
      pGeo.attributes.position.needsUpdate = true
      mouse.x += (mouse.tx - mouse.x) * 0.04; mouse.y += (mouse.ty - mouse.y) * 0.04
      const sc = Math.min(scrollY / Math.max(el.clientHeight, 1), 1)
      camPos.copy(view.pos).add(tmp.set(mouse.x * 0.9 + Math.sin(t * 0.12) * 0.35, -mouse.y * 0.45 + sc * 1.6, sc * -1.2))
      camera.position.copy(camPos)
      look.copy(view.look); look.x += mouse.x * 0.25
      camera.lookAt(look)
      renderer.render(scene, camera)
    }
    const loop = (now) => { step(now); raf = visible && !document.hidden && !reduced ? requestAnimationFrame(loop) : 0 }
    const start = () => { if (!raf && !reduced) { last = performance.now(); raf = requestAnimationFrame(loop) } }
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start() })
    io.observe(el)
    const onVis = () => { if (!document.hidden) start() }
    document.addEventListener('visibilitychange', onVis)
    if (reduced) { for (let i = 0; i < 60; i++) step(performance.now()) } else start()

    return () => {
      cancelAnimationFrame(raf); io.disconnect(); ro.disconnect()
      removeEventListener('pointermove', onMove); document.removeEventListener('visibilitychange', onVis)
      disposables.forEach((d) => d.dispose?.())
      renderer.dispose(); renderer.forceContextLoss?.()
      renderer.domElement.remove()
    }
  }, [onFail])
  return <div className="hero-canvas" ref={host} aria-hidden="true" />
}
