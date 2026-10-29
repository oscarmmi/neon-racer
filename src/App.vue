<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { advanceDistance, clampLane, rectanglesOverlap, scoreFromDistance, type Rectangle } from './game'

type TrafficCar = { lane: number; progress: number; color: string; name: string; id: number }
type RunState = 'ready' | 'running' | 'crashed'

const canvas = ref<HTMLCanvasElement | null>(null)
const state = ref<RunState>('ready')
const lane = ref(1)
const score = ref(0)
const best = ref(0)
const distance = ref(0)
const elapsed = ref(0)
const speed = ref(1)
const trafficCount = ref(0)
const displaySpeed = computed(() => `${Math.round(112 + (speed.value - 1) * 28)} km/h`)

const traffic: TrafficCar[] = []
const carPalette = [
  { color: '#ff496f', name: 'Comet' },
  { color: '#ffbf4b', name: 'Sundown' },
  { color: '#7d8cff', name: 'Bluebird' },
  { color: '#e5edf6', name: 'Ghost' },
  { color: '#57e8c2', name: 'Mint' },
]

let frame = 0
let lastFrame = 0
let spawnClock = 0
let roadMotion = 0
let nextCarId = 0
let lastHudUpdate = 0
let pointerStart: { x: number; y: number } | null = null
let context: CanvasRenderingContext2D | null = null
let viewWidth = 0
let viewHeight = 0

function readBest(): number {
  try {
    return Number(window.localStorage.getItem('volt-lane-best') ?? 0) || 0
  } catch {
    return 0
  }
}

function writeBest(value: number): void {
  try {
    window.localStorage.setItem('volt-lane-best', String(value))
  } catch {
    // The game remains playable when browser storage is unavailable.
  }
}

function resizeCanvas(): void {
  const element = canvas.value
  if (!element) return
  const bounds = element.getBoundingClientRect()
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  viewWidth = bounds.width
  viewHeight = bounds.height
  element.width = Math.round(viewWidth * dpr)
  element.height = Math.round(viewHeight * dpr)
  context = element.getContext('2d')
  context?.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function startRun(): void {
  lane.value = 1
  distance.value = 0
  elapsed.value = 0
  score.value = 0
  speed.value = 1
  traffic.length = 0
  spawnClock = 0.8
  roadMotion = 0
  lastHudUpdate = 0
  state.value = 'running'
}

function shiftLane(direction: number): void {
  lane.value = clampLane(lane.value + direction)
}

function onKeyDown(event: KeyboardEvent): void {
  const key = event.key.toLowerCase()
  if (['arrowleft', 'arrowright', ' '].includes(key)) event.preventDefault()

  if (key === 'r' && state.value !== 'running') {
    startRun()
    return
  }
  if (key === ' ' && state.value !== 'running') {
    startRun()
    return
  }
  if (state.value !== 'running') return
  if (key === 'arrowleft' || key === 'a') shiftLane(-1)
  if (key === 'arrowright' || key === 'd') shiftLane(1)
}

function onPointerDown(event: PointerEvent): void {
  pointerStart = { x: event.clientX, y: event.clientY }
  ;(event.currentTarget as HTMLCanvasElement).setPointerCapture(event.pointerId)
}

function onPointerUp(event: PointerEvent): void {
  if (!pointerStart) return
  if (state.value !== 'running') {
    pointerStart = null
    return
  }
  const delta = event.clientX - pointerStart.x
  if (Math.abs(delta) > 22) {
    shiftLane(delta < 0 ? -1 : 1)
  } else {
    const bounds = canvas.value?.getBoundingClientRect()
    if (bounds) shiftLane(event.clientX < bounds.left + bounds.width / 2 ? -1 : 1)
  }
  pointerStart = null
}

function roadEdges(y: number): { left: number; right: number } {
  const horizon = viewHeight * 0.22
  const progress = Math.max(0, Math.min(1, (y - horizon) / (viewHeight - horizon)))
  const topHalf = viewWidth * 0.17
  const bottomHalf = viewWidth * 0.43
  const half = topHalf + (bottomHalf - topHalf) * progress
  return { left: viewWidth / 2 - half, right: viewWidth / 2 + half }
}

function laneCenter(whichLane: number, y: number): number {
  const edges = roadEdges(y)
  return edges.left + (edges.right - edges.left) * ((whichLane + 0.5) / 3)
}

function drawCar(x: number, y: number, width: number, height: number, color: string, isPlayer: boolean): Rectangle {
  if (!context) return { x, y, width, height }
  const ctx = context
  const left = x - width / 2
  const top = y - height / 2

  ctx.save()
  ctx.shadowColor = color
  ctx.shadowBlur = isPlayer ? 25 : 15
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(left + width * 0.19, top + height * 0.06)
  ctx.quadraticCurveTo(left + width * 0.5, top - height * 0.02, left + width * 0.81, top + height * 0.06)
  ctx.lineTo(left + width * 0.96, top + height * 0.77)
  ctx.quadraticCurveTo(left + width * 0.94, top + height * 0.95, left + width * 0.78, top + height * 0.97)
  ctx.lineTo(left + width * 0.22, top + height * 0.97)
  ctx.quadraticCurveTo(left + width * 0.06, top + height * 0.95, left + width * 0.04, top + height * 0.77)
  ctx.closePath()
  ctx.fill()
  ctx.shadowBlur = 0

  ctx.fillStyle = isPlayer ? '#142231' : '#1b2634'
  ctx.beginPath()
  ctx.moveTo(left + width * 0.28, top + height * 0.2)
  ctx.lineTo(left + width * 0.72, top + height * 0.2)
  ctx.lineTo(left + width * 0.81, top + height * 0.47)
  ctx.lineTo(left + width * 0.19, top + height * 0.47)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = 'rgba(221, 244, 255, 0.72)'
  ctx.fillRect(left + width * 0.25, top + height * 0.53, width * 0.5, height * 0.035)
  ctx.fillStyle = isPlayer ? '#fff0b3' : '#fff1da'
  ctx.fillRect(left + width * 0.12, top + height * 0.8, width * 0.15, height * 0.055)
  ctx.fillRect(left + width * 0.73, top + height * 0.8, width * 0.15, height * 0.055)
  if (isPlayer) {
    ctx.fillStyle = 'rgba(252, 84, 142, 0.9)'
    ctx.fillRect(left + width * 0.43, top + height * 0.67, width * 0.14, height * 0.05)
  }
  ctx.restore()
  return { x: left + width * 0.12, y: top + height * 0.13, width: width * 0.76, height: height * 0.76 }
}

function drawBackground(): void {
  if (!context) return
  const ctx = context
  const w = viewWidth
  const h = viewHeight
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, '#0b1027')
  sky.addColorStop(0.5, '#211747')
  sky.addColorStop(1, '#32182f')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)

  const glow = ctx.createRadialGradient(w * 0.5, h * 0.3, 0, w * 0.5, h * 0.3, w * 0.43)
  glow.addColorStop(0, 'rgba(235, 73, 138, .24)')
  glow.addColorStop(1, 'rgba(235, 73, 138, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, w, h * 0.8)

  const skylineY = h * 0.4
  for (let i = 0; i < 24; i++) {
    const blockW = w * (0.025 + (i % 4) * 0.009)
    const blockH = h * (0.08 + ((i * 37) % 19) / 100)
    const x = (i / 24) * w
    ctx.fillStyle = i % 3 === 0 ? '#10172d' : '#15152e'
    ctx.fillRect(x, skylineY - blockH, blockW, blockH + h * 0.08)
    ctx.fillStyle = i % 2 ? 'rgba(80, 229, 234, .42)' : 'rgba(255, 94, 153, .4)'
    for (let row = 0; row < 4; row++) {
      ctx.fillRect(x + blockW * 0.2, skylineY - blockH + row * blockH * 0.18, blockW * 0.1, h * 0.009)
      ctx.fillRect(x + blockW * 0.62, skylineY - blockH + row * blockH * 0.18, blockW * 0.1, h * 0.009)
    }
  }
  ctx.fillStyle = 'rgba(254, 91, 154, .08)'
  ctx.fillRect(0, skylineY, w, h * 0.1)

  const horizon = h * 0.22
  const edges = roadEdges(h)
  ctx.fillStyle = '#121625'
  ctx.beginPath()
  ctx.moveTo(w / 2 - w * 0.17, horizon)
  ctx.lineTo(w / 2 + w * 0.17, horizon)
  ctx.lineTo(edges.right, h)
  ctx.lineTo(edges.left, h)
  ctx.closePath()
  ctx.fill()

  const roadShade = ctx.createLinearGradient(0, horizon, 0, h)
  roadShade.addColorStop(0, 'rgba(34, 34, 58, .55)')
  roadShade.addColorStop(1, 'rgba(11, 17, 27, .92)')
  ctx.fillStyle = roadShade
  ctx.fill()

  // Neon road shoulders follow the same vanishing point as the lanes.
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(w / 2 + side * w * 0.17, horizon)
    ctx.lineTo(w / 2 + side * w * 0.43, h)
    ctx.strokeStyle = side < 0 ? 'rgba(80, 231, 233, .8)' : 'rgba(255, 79, 144, .8)'
    ctx.lineWidth = Math.max(1, w * 0.003)
    ctx.shadowColor = ctx.strokeStyle
    ctx.shadowBlur = 12
    ctx.stroke()
    ctx.shadowBlur = 0
  }

  for (let divider = 1; divider < 3; divider++) {
    const xTop = w / 2 - w * 0.17 + w * 0.34 * (divider / 3)
    const xBottom = w / 2 - w * 0.43 + w * 0.86 * (divider / 3)
    const dashCount = 10
    for (let dash = 0; dash < dashCount; dash++) {
      const travel = (dash / dashCount + (roadMotion % 1)) % 1
      const y1 = horizon + travel * (h - horizon)
      const y2 = Math.min(h, y1 + (h - horizon) * (0.018 + travel * 0.036))
      const p1 = (y1 - horizon) / (h - horizon)
      const p2 = (y2 - horizon) / (h - horizon)
      const x1 = xTop + (xBottom - xTop) * p1
      const x2 = xTop + (xBottom - xTop) * p2
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.strokeStyle = `rgba(123, 220, 235, ${0.25 + travel * 0.58})`
      ctx.lineWidth = Math.max(1, w * (0.0014 + travel * 0.003))
      ctx.shadowColor = '#57dfeb'
      ctx.shadowBlur = 6 * travel
      ctx.stroke()
    }
  }
  ctx.shadowBlur = 0

  // Roadside lights add depth without obscuring the traffic.
  for (let light = 0; light < 7; light++) {
    const travel = (light / 7 + (roadMotion * 0.7 % 1)) % 1
    const y = horizon + travel * (h - horizon)
    const roadEdge = roadEdges(y)
    const size = 1 + travel * 4
    for (const side of [-1, 1]) {
      ctx.fillStyle = side < 0 ? 'rgba(73, 233, 242, .75)' : 'rgba(255, 97, 158, .72)'
      ctx.shadowColor = ctx.fillStyle
      ctx.shadowBlur = 8
      ctx.beginPath()
      ctx.arc(roadEdge.left - size * 3 * (side < 0 ? 1 : -1), y, size, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(roadEdge.right + size * 3 * (side < 0 ? -1 : 1), y, size, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.shadowBlur = 0
}

function render(): void {
  if (!context || !viewWidth || !viewHeight) return
  drawBackground()
  const horizon = viewHeight * 0.22
  const playerY = viewHeight * 0.81
  const baseCarWidth = Math.min(viewWidth * 0.105, viewHeight * 0.18)
  const playerRect = drawCar(laneCenter(lane.value, playerY), playerY, baseCarWidth * 0.82, baseCarWidth * 1.18, '#58f0dc', true)

  for (const car of [...traffic].sort((a, b) => a.progress - b.progress)) {
    const y = horizon + car.progress * (viewHeight - horizon)
    const scale = 0.43 + car.progress * 0.73
    const bounds = drawCar(laneCenter(car.lane, y), y, baseCarWidth * 0.76 * scale, baseCarWidth * 1.13 * scale, car.color, false)
    if (car.progress > 0.64 && car.progress < 1.04 && rectanglesOverlap(playerRect, bounds)) {
      crashRun()
      break
    }
  }
}

function crashRun(): void {
  if (state.value !== 'running') return
  state.value = 'crashed'
  if (score.value > best.value) {
    best.value = score.value
    writeBest(best.value)
  }
}

function spawnTraffic(): void {
  const pick = carPalette[Math.floor(Math.random() * carPalette.length)]!
  let openLanes = [0, 1, 2]
  const nearest = traffic.filter((car) => car.progress < 0.24)
  if (nearest.length) openLanes = openLanes.filter((candidate) => nearest.every((car) => car.lane !== candidate))
  const selectedLane = openLanes.length ? openLanes[Math.floor(Math.random() * openLanes.length)]! : Math.floor(Math.random() * 3)
  traffic.push({ lane: selectedLane, progress: 0, color: pick.color, name: pick.name, id: nextCarId++ })
  trafficCount.value = traffic.length
}

function update(delta: number): void {
  if (state.value !== 'running') return
  elapsed.value += delta
  speed.value = 1 + Math.min(elapsed.value * 0.035, 1.7)
  distance.value = advanceDistance(distance.value, delta, 18 * speed.value)
  roadMotion += delta * (0.55 + speed.value * 0.22)
  spawnClock -= delta
  if (spawnClock <= 0) {
    spawnTraffic()
    spawnClock = Math.max(0.62, 1.18 - elapsed.value * 0.009) + Math.random() * 0.24
  }
  const travelRate = 0.24 + (speed.value - 1) * 0.085
  for (const car of traffic) car.progress += delta * travelRate
  while (traffic[0]?.progress > 1.16) traffic.shift()
  if (performance.now() - lastHudUpdate > 90) {
    score.value = scoreFromDistance(distance.value)
    trafficCount.value = traffic.length
    lastHudUpdate = performance.now()
  }
}

function tick(now: number): void {
  const delta = lastFrame ? Math.min((now - lastFrame) / 1000, 0.05) : 0
  lastFrame = now
  update(delta)
  render()
  frame = requestAnimationFrame(tick)
}

onMounted(() => {
  best.value = readBest()
  resizeCanvas()
  window.addEventListener('resize', resizeCanvas)
  window.addEventListener('keydown', onKeyDown)
  frame = requestAnimationFrame(tick)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  window.removeEventListener('resize', resizeCanvas)
  window.removeEventListener('keydown', onKeyDown)
})
</script>

<template>
  <main class="arcade-shell">
    <header class="topbar">
      <a class="wordmark" href="#top" aria-label="Volt Lane home">
        <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
        <span>VOLT<span class="wordmark-light">LANE</span></span>
      </a>
      <div class="topbar-meta">
        <span class="live-dot"></span>
        <span>NEON DISTRICT <b>·</b> NIGHT SHIFT</span>
      </div>
      <a class="about-link" href="#how-to-play">HOW TO PLAY <span aria-hidden="true">↗</span></a>
    </header>

    <section id="top" class="intro-row" aria-labelledby="game-title">
      <div class="intro-copy">
        <p class="eyebrow"><span>01</span> THE MIDNIGHT RUN</p>
        <h1 id="game-title">Own the <em>afterglow.</em></h1>
        <p class="intro-subtitle">Three lanes. One way forward. How far can you take it?</p>
      </div>
      <div class="scoreboard" aria-live="polite">
        <div class="score-cell score-current">
          <span class="stat-label">DISTANCE SCORE</span>
          <strong>{{ String(score).padStart(6, '0') }}</strong>
        </div>
        <div class="score-divider"></div>
        <div class="score-cell">
          <span class="stat-label">PERSONAL BEST</span>
          <strong class="best-score">{{ String(best).padStart(6, '0') }}<span> M</span></strong>
        </div>
      </div>
    </section>

    <section class="play-layout" aria-label="Volt Lane arcade game">
      <div class="cabinet">
        <div class="cabinet-topline">
          <span class="cabinet-label"><span class="status-indicator" :class="`is-${state}`"></span>{{ state === 'running' ? 'RUN IN PROGRESS' : state === 'crashed' ? 'RUN ENDED' : 'READY WHEN YOU ARE' }}</span>
          <div class="cabinet-readouts">
            <span><i class="readout-icon speed-icon">↗</i>{{ displaySpeed }}</span>
            <span><i class="readout-icon">▤</i>{{ String(trafficCount).padStart(2, '0') }} TRAFFIC</span>
          </div>
        </div>

        <div class="screen-frame">
          <canvas
            ref="canvas"
            class="game-canvas"
            aria-label="Three lane neon highway. Tap or swipe left and right to dodge traffic."
            @pointerdown="onPointerDown"
            @pointerup="onPointerUp"
            @pointercancel="pointerStart = null"
          ></canvas>
          <div class="screen-vignette" aria-hidden="true"></div>
          <div v-if="state !== 'running'" class="game-overlay">
            <div class="overlay-card" :class="{ 'overlay-card-end': state === 'crashed' }">
              <div class="overlay-kicker"><span>{{ state === 'ready' ? 'VOL. 01' : 'RUN COMPLETE' }}</span><span class="overlay-line"></span></div>
              <template v-if="state === 'ready'">
                <h2>Find your<br /><em>own rhythm.</em></h2>
                <p>Slip through the city lights.<br />Just don't blink.</p>
                <button class="start-button" type="button" @click="startRun">START YOUR RUN <span>→</span></button>
                <span class="overlay-note">PRESS SPACE TO START</span>
              </template>
              <template v-else>
                <h2>That was a<br /><em>close call.</em></h2>
                <p>Your run reached <strong>{{ score }} m</strong>.<br />The city is still waiting.</p>
                <button class="start-button" type="button" @click="startRun">RUN IT BACK <span>↻</span></button>
                <span class="overlay-note">PRESS R TO RESTART</span>
              </template>
            </div>
          </div>
          <div v-else class="lane-hint" aria-hidden="true"><span>←</span><span>SWITCH LANES</span><span>→</span></div>
        </div>
        <div class="cabinet-footer">
          <span><i class="footer-led"></i> {{ state === 'running' ? 'SYSTEM LIVE' : 'VOLT LANE / BUILD 01' }}</span>
          <span class="lane-indicator" aria-label="Current lane">
            <i v-for="index in 3" :key="index" :class="{ active: lane === index - 1 }"></i>
          </span>
          <span>NO. {{ String(score).padStart(5, '0') }}</span>
        </div>
      </div>

      <aside id="how-to-play" class="side-panel">
        <div class="panel-head">
          <span class="panel-index">01 / CONTROLS</span>
          <span class="panel-spark" aria-hidden="true">✳</span>
        </div>
        <h2>Stay in<br /><em>the flow.</em></h2>
        <p class="panel-description">Switch lanes to miss the traffic. The longer you ride, the faster the city moves.</p>
        <div class="control-list">
          <div class="control-item">
            <span class="control-icon keyboard-icon" aria-hidden="true"><kbd>←</kbd><kbd>→</kbd></span>
            <span><b>KEYBOARD</b><small>ARROWS OR A / D</small></span>
          </div>
          <div class="control-item">
            <span class="control-icon swipe-icon" aria-hidden="true"><span>↔</span></span>
            <span><b>TOUCH</b><small>TAP OR SWIPE TO STEER</small></span>
          </div>
          <div class="control-item">
            <span class="control-icon restart-icon" aria-hidden="true">R</span>
            <span><b>RESTART</b><small>ANYTIME AFTER A WIPEOUT</small></span>
          </div>
        </div>
        <div class="panel-bottom">
          <span class="micro-label">THE NIGHT IS YOURS</span>
          <span class="panel-arrow" aria-hidden="true">↘</span>
        </div>
      </aside>
    </section>

    <footer class="page-footer">
      <span>BUILT FOR THE LONG WAY HOME.</span>
      <span class="footer-center"><i></i> ENDLESS RUN · LOCAL HIGH SCORE</span>
      <span>VOLT LANE <b>© 2025</b></span>
    </footer>
  </main>
</template>
