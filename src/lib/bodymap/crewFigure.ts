import * as THREE from 'three'
import type { BodyRegion, StatusLevel } from '@/lib/health/indicators'

export interface FigureState {
  levels: Record<BodyRegion, StatusLevel | null>
  selected: BodyRegion | null
  /** Drives the face: low mood frowns, good mood smiles */
  mood: StatusLevel | null
}

/** Hotspot position in container pixels, for the HTML labels. */
export type RegionPoints = Record<BodyRegion, { x: number; y: number }>

const REGIONS: BodyRegion[] = ['brain', 'heart', 'core', 'fingertip']

const LEVEL_HEX: Record<StatusLevel | 'none', number> = {
  normal: 0x34d399,
  watch: 0xfbbf24,
  alert: 0xef4444,
  none: 0x71717a,
}

/** Pulse speed (Hz) and base glow per level; alerts beat fast, unmeasured stays dim. */
const LEVEL_GLOW: Record<StatusLevel | 'none', { hz: number; base: number; swing: number }> = {
  normal: { hz: 0.35, base: 1.1, swing: 0.25 },
  watch: { hz: 0.9, base: 1.1, swing: 0.6 },
  alert: { hz: 2.4, base: 1.6, swing: 1.4 },
  none: { hz: 0, base: 0.35, swing: 0 },
}

const C = {
  suit: 0x334155,
  suitDark: 0x1e293b,
  trim: 0x475569,
  skin: 0xd9a77c,
  hair: 0x1c1917,
  boot: 0x27272a,
  white: 0xf4f4f5,
  ink: 0x18181b,
  patch: 0x10b981,
}

interface Hotspot {
  group: THREE.Group
  glow: THREE.MeshStandardMaterial[]
  /** Where the label leader line points */
  anchor: THREE.Object3D
  spin?: THREE.Object3D
  /** Large markers (the base rim) brighten instead of growing when selected */
  fixedSize?: boolean
}

/**
 * Voxel crew member for the body map. Built only from boxes; each body region
 * carries a glowing marker in its status color. Click a marker to select it.
 */
export class CrewFigure {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50)
  private readonly timer = new THREE.Timer()
  private readonly raycaster = new THREE.Raycaster()
  private readonly pointer = new THREE.Vector2()
  private readonly resizeObserver: ResizeObserver
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  private readonly geometries = new Map<string, THREE.BoxGeometry>()
  private readonly disposables: { dispose(): void }[] = []

  private readonly body = new THREE.Group()
  private readonly torso = new THREE.Group()
  private readonly head = new THREE.Group()
  private readonly eyes: THREE.Group[] = []
  private readonly brows: THREE.Mesh[] = []
  private readonly mouthCorners: THREE.Mesh[] = []
  private readonly hotspots = {} as Record<BodyRegion, Hotspot>
  private readonly hitTargets: THREE.Object3D[] = []

  private state: FigureState = {
    levels: { brain: null, heart: null, core: null, fingertip: null },
    selected: null,
    mood: null,
  }
  private hovered: BodyRegion | null = null
  private width = 1
  private height = 1
  private frame = 0
  private running = false

  private readonly container: HTMLElement
  private readonly onSelect: (region: BodyRegion) => void
  private readonly onLayout: (points: RegionPoints) => void

  constructor(
    container: HTMLElement,
    onSelect: (region: BodyRegion) => void,
    onLayout: (points: RegionPoints) => void,
  ) {
    this.container = container
    this.onSelect = onSelect
    this.onLayout = onLayout
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    const canvas = this.renderer.domElement
    canvas.style.display = 'block'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.setAttribute('aria-hidden', 'true')
    container.appendChild(canvas)

    this.camera.position.set(0, 1.7, 8.4)
    this.camera.lookAt(0, 1.55, 0)

    this.buildLights()
    this.buildFloor()
    this.buildCharacter()
    this.scene.add(this.body)

    canvas.addEventListener('pointermove', this.handlePointerMove)
    canvas.addEventListener('pointerleave', this.handlePointerLeave)
    canvas.addEventListener('click', this.handleClick)
    document.addEventListener('visibilitychange', this.handleVisibility)

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.resize()
    this.start()
  }

  setState(state: FigureState) {
    this.state = state
    this.applyFace()
    if (this.reducedMotion) this.render(0)
  }

  dispose() {
    this.running = false
    cancelAnimationFrame(this.frame)
    this.resizeObserver.disconnect()
    document.removeEventListener('visibilitychange', this.handleVisibility)
    const canvas = this.renderer.domElement
    canvas.removeEventListener('pointermove', this.handlePointerMove)
    canvas.removeEventListener('pointerleave', this.handlePointerLeave)
    canvas.removeEventListener('click', this.handleClick)
    this.geometries.forEach((g) => g.dispose())
    this.disposables.forEach((d) => d.dispose())
    this.timer.dispose()
    this.renderer.dispose()
    canvas.remove()
  }

  // ── Building ────────────────────────────────────────────────────────────

  private material(color: number, emissive = false) {
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: emissive ? 0.4 : 0.75,
      flatShading: true,
      ...(emissive ? { emissive: color, emissiveIntensity: 1 } : {}),
    })
    this.disposables.push(mat)
    return mat
  }

  private box(
    w: number,
    h: number,
    d: number,
    mat: THREE.Material,
    x = 0,
    y = 0,
    z = 0,
    parent: THREE.Object3D = this.body,
  ) {
    const key = `${w}|${h}|${d}`
    let geo = this.geometries.get(key)
    if (!geo) {
      geo = new THREE.BoxGeometry(w, h, d)
      this.geometries.set(key, geo)
    }
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    parent.add(mesh)
    return mesh
  }

  private ring(radius: number, tube: number, mat: THREE.Material) {
    const geo = new THREE.TorusGeometry(radius, tube, 4, 10)
    this.disposables.push(geo)
    const mesh = new THREE.Mesh(geo, mat)
    mesh.rotation.x = Math.PI / 2
    return mesh
  }

  /** Invisible box that makes a marker easy to click. */
  private hitBox(region: BodyRegion, w: number, h: number, d: number, parent: THREE.Object3D) {
    const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    this.disposables.push(mat)
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
    this.disposables.push(mesh.geometry)
    mesh.userData.region = region
    parent.add(mesh)
    this.hitTargets.push(mesh)
    return mesh
  }

  private buildLights() {
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x1a1a1e, 1.15))
    const key = new THREE.DirectionalLight(0xffffff, 2.1)
    key.position.set(2.5, 5.5, 4.5)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    key.shadow.radius = 6
    key.shadow.camera.left = -2
    key.shadow.camera.right = 2
    key.shadow.camera.top = 4
    key.shadow.camera.bottom = -1
    key.shadow.bias = -0.0008
    this.scene.add(key)
    const rim = new THREE.DirectionalLight(0x34d399, 0.9)
    rim.position.set(-3, 2.5, -3)
    this.scene.add(rim)
  }

  private buildFloor() {
    const shadowMat = new THREE.ShadowMaterial({ opacity: 0.35 })
    const floorGeo = new THREE.CircleGeometry(1.5, 24)
    this.disposables.push(shadowMat, floorGeo)
    const floor = new THREE.Mesh(floorGeo, shadowMat)
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    this.scene.add(floor)

    const padMat = new THREE.MeshStandardMaterial({ color: 0x111113, roughness: 0.9, flatShading: true })
    const padGeo = new THREE.CylinderGeometry(1.15, 1.2, 0.08, 10)
    this.disposables.push(padMat, padGeo)
    const pad = new THREE.Mesh(padGeo, padMat)
    pad.position.y = -0.04
    pad.receiveShadow = true
    this.scene.add(pad)
  }

  private buildCharacter() {
    const suit = this.material(C.suit)
    const suitDark = this.material(C.suitDark)
    const trim = this.material(C.trim)
    const skin = this.material(C.skin)
    const hair = this.material(C.hair)
    const boot = this.material(C.boot)
    const white = this.material(C.white)
    const ink = this.material(C.ink)
    const patch = this.material(C.patch, true)

    this.body.rotation.y = -0.22

    // Legs and boots
    for (const side of [-1, 1]) {
      this.box(0.34, 0.2, 0.46, boot, side * 0.2, 0.1, 0.04)
      this.box(0.3, 0.72, 0.32, suit, side * 0.2, 0.56, 0)
      this.box(0.32, 0.08, 0.34, suitDark, side * 0.2, 0.36, 0)
    }
    this.box(0.78, 0.24, 0.4, suit, 0, 1.0, 0)

    // Torso (breathes), with zipper, patch and collar
    this.torso.position.y = 1.12
    this.body.add(this.torso)
    this.box(0.86, 0.86, 0.46, suit, 0, 0.43, 0, this.torso)
    this.box(0.04, 0.7, 0.02, trim, 0, 0.42, 0.235, this.torso)
    this.box(0.17, 0.17, 0.02, patch, -0.22, 0.62, 0.235, this.torso)
    this.box(0.5, 0.08, 0.5, suitDark, 0, 0.88, 0, this.torso)
    for (const side of [-1, 1]) this.box(0.16, 0.1, 0.48, trim, side * 0.36, 0.82, 0, this.torso)

    // Neck and head
    this.box(0.24, 0.14, 0.24, skin, 0, 0.94, 0, this.torso)
    this.head.position.set(0, 2.08, 0)
    this.body.add(this.head)
    this.box(0.86, 0.8, 0.78, skin, 0, 0.4, 0, this.head)
    this.box(0.92, 0.16, 0.84, hair, 0, 0.84, 0, this.head)
    this.box(0.92, 0.5, 0.12, hair, 0, 0.6, -0.38, this.head)
    for (const side of [-1, 1]) {
      this.box(0.08, 0.3, 0.7, hair, side * 0.46, 0.66, -0.03, this.head)
      this.box(0.08, 0.18, 0.14, skin, side * 0.47, 0.38, 0, this.head)

      const eye = new THREE.Group()
      eye.position.set(side * 0.18, 0.42, 0.395)
      this.head.add(eye)
      this.box(0.16, 0.18, 0.03, white, 0, 0, 0, eye)
      this.box(0.08, 0.11, 0.02, ink, side * -0.02, -0.01, 0.022, eye)
      this.eyes.push(eye)

      const brow = this.box(0.2, 0.05, 0.03, hair, side * 0.18, 0.6, 0.4, this.head)
      this.brows.push(brow)
    }
    this.box(0.1, 0.12, 0.08, this.material(0xc8946a), 0, 0.3, 0.42, this.head)
    this.box(0.16, 0.045, 0.03, ink, 0, 0.17, 0.4, this.head)
    for (const side of [-1, 1]) {
      this.mouthCorners.push(this.box(0.06, 0.045, 0.03, ink, side * 0.105, 0.19, 0.4, this.head))
    }

    // Arms: the figure's right hand (viewer's left) holds out an index finger
    const arms: { side: number; tilt: number }[] = [
      { side: -1, tilt: -0.3 },
      { side: 1, tilt: 0.16 },
    ]
    let fingerTip: THREE.Object3D | null = null
    for (const { side, tilt } of arms) {
      const arm = new THREE.Group()
      arm.position.set(side * 0.55, 1.92, 0)
      arm.rotation.z = tilt
      this.body.add(arm)
      this.box(0.26, 0.3, 0.3, suit, 0, -0.1, 0, arm)
      this.box(0.24, 0.42, 0.26, suit, 0, -0.42, 0, arm)
      this.box(0.26, 0.06, 0.28, suitDark, 0, -0.62, 0, arm)
      this.box(0.2, 0.18, 0.22, skin, 0, -0.74, 0, arm)
      if (side === -1) {
        this.box(0.06, 0.14, 0.06, skin, 0.04, -0.89, 0.07, arm)
        fingerTip = new THREE.Object3D()
        fingerTip.position.set(0.04, -0.98, 0.07)
        arm.add(fingerTip)
      }
    }

    this.buildHotspots(fingerTip!)
  }

  private buildHotspots(fingerTip: THREE.Object3D) {
    const glowFor = () => this.material(LEVEL_HEX.none, true)

    // Brain: a scan ring floating around the top of the head
    {
      const mat = glowFor()
      const group = new THREE.Group()
      group.position.set(0, 0.98, 0)
      this.head.add(group)
      const ring = this.ring(0.58, 0.035, mat)
      group.add(ring)
      const spark = this.box(0.08, 0.08, 0.08, mat, 0.58, 0, 0, ring)
      spark.rotation.z = Math.PI / 4
      this.hitBox('brain', 1.2, 0.5, 1.2, group)
      this.hotspots.brain = { group, glow: [mat], anchor: group, spin: ring }
    }

    // Heart: a pixel heart on the left chest
    {
      const mat = glowFor()
      const group = new THREE.Group()
      group.position.set(0.21, 0.58, 0.245)
      this.torso.add(group)
      const rows = ['.X.X.', 'XXXXX', 'XXXXX', '.XXX.', '..X..']
      const u = 0.045
      rows.forEach((row, r) =>
        [...row].forEach((c, col) => {
          if (c === 'X') this.box(u, u, 0.03, mat, (col - 2) * u, (2 - r) * u, 0, group)
        }),
      )
      this.hitBox('heart', 0.36, 0.36, 0.2, group)
      this.hotspots.heart = { group, glow: [mat], anchor: group }
    }

    // Core temperature: the rim of the base the figure stands on, with a light at the front
    {
      const mat = glowFor()
      const group = new THREE.Group()
      group.position.set(0, 0.01, 0)
      this.scene.add(group)
      const rim = this.ring(1.18, 0.03, mat)
      group.add(rim)
      const spark = this.box(0.1, 0.06, 0.1, mat, 1.18, 0, 0, rim)
      spark.rotation.z = Math.PI / 4
      this.box(0.22, 0.05, 0.06, mat, 0, 0, 1.19, group)
      this.hitBox('core', 2.5, 0.25, 2.5, group)
      const anchor = new THREE.Object3D()
      anchor.position.set(0, 0, 1.19)
      group.add(anchor)
      this.hotspots.core = { group, glow: [mat], anchor, spin: rim, fixedSize: true }
    }

    // Fingertip: a light on the index finger with a small ring
    {
      const mat = glowFor()
      const group = new THREE.Group()
      fingerTip.add(group)
      this.box(0.08, 0.08, 0.08, mat, 0, 0, 0, group)
      const ring = this.ring(0.13, 0.018, mat)
      group.add(ring)
      this.hitBox('fingertip', 0.4, 0.4, 0.4, group)
      this.hotspots.fingertip = { group, glow: [mat], anchor: group, spin: ring }
    }
  }

  // ── Face ────────────────────────────────────────────────────────────────

  private applyFace() {
    const mood = this.state.mood
    const curve = mood === 'alert' ? -1 : mood === 'watch' ? -0.3 : 1
    this.mouthCorners.forEach((m) => (m.position.y = 0.19 + 0.03 * curve - 0.02))
    const sad = mood === 'alert' ? 0.3 : mood === 'watch' ? 0.12 : 0
    this.brows.forEach((b, i) => {
      const side = i === 0 ? -1 : 1
      b.rotation.z = side * -sad
      b.position.y = 0.6 + (sad ? 0.02 : 0)
    })
  }

  // ── Loop ────────────────────────────────────────────────────────────────

  private start() {
    if (this.running) return
    this.running = true
    if (this.reducedMotion) {
      this.render(0)
      return
    }
    const loop = (ms: number) => {
      if (!this.running) return
      this.timer.update(ms)
      this.render(this.timer.getElapsed())
      this.frame = requestAnimationFrame(loop)
    }
    this.frame = requestAnimationFrame(loop)
  }

  private render(t: number) {
    // Idle: breathing, a gentle sway, a head bob and a blink every few seconds
    this.torso.scale.y = 1 + Math.sin(t * 1.6) * 0.012
    this.body.rotation.y = -0.22 + Math.sin(t * 0.45) * 0.05
    this.head.rotation.z = Math.sin(t * 0.7) * 0.03
    this.head.position.y = 2.08 + Math.sin(t * 1.6) * 0.01
    const blink = t % 3.8 < 0.12 ? 0.1 : 1
    this.eyes.forEach((e) => (e.scale.y = blink))

    for (const region of REGIONS) {
      const spot = this.hotspots[region]
      const level = this.state.levels[region] ?? 'none'
      const glow = LEVEL_GLOW[level]
      const active = this.state.selected === region || this.hovered === region
      const wave = glow.hz ? (Math.sin(t * Math.PI * 2 * glow.hz) + 1) / 2 : 0
      for (const mat of spot.glow) {
        // Dark base keeps the hue pure; lit color would wash the glow toward white
        mat.color.setHex(LEVEL_HEX[level]).multiplyScalar(0.2)
        mat.emissive.setHex(LEVEL_HEX[level])
        mat.emissiveIntensity = glow.base + glow.swing * wave + (active ? 0.8 : 0)
      }
      const beat = level === 'alert' ? 0.08 * wave : 0
      if (!spot.fixedSize) spot.group.scale.setScalar((active ? 1.15 : 1) + beat)
      if (spot.spin) spot.spin.rotation.z = t * 0.6
    }

    this.renderer.render(this.scene, this.camera)
    this.onLayout(this.project())
  }

  private project(): RegionPoints {
    const points = {} as RegionPoints
    const v = new THREE.Vector3()
    for (const region of REGIONS) {
      this.hotspots[region].anchor.getWorldPosition(v).project(this.camera)
      points[region] = {
        x: ((v.x + 1) / 2) * this.width,
        y: ((1 - v.y) / 2) * this.height,
      }
    }
    return points
  }

  private resize() {
    const { width, height } = this.container.getBoundingClientRect()
    if (!width || !height) return
    this.width = width
    this.height = height
    this.camera.aspect = width / height
    // Narrow panels pull the camera back so the whole figure fits
    this.camera.position.z = width / height < 0.75 ? 8.4 * (0.75 / (width / height)) : 8.4
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height, false)
    this.render(this.timer.getElapsed())
  }

  // ── Input ───────────────────────────────────────────────────────────────

  private regionAt(event: PointerEvent | MouseEvent): BodyRegion | null {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    )
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hit = this.raycaster.intersectObjects(this.hitTargets, false)[0]
    return (hit?.object.userData.region as BodyRegion | undefined) ?? null
  }

  private handlePointerMove = (event: PointerEvent) => {
    this.hovered = this.regionAt(event)
    this.renderer.domElement.style.cursor = this.hovered ? 'pointer' : 'default'
    if (this.reducedMotion) this.render(0)
  }

  private handlePointerLeave = () => {
    this.hovered = null
    this.renderer.domElement.style.cursor = 'default'
    if (this.reducedMotion) this.render(0)
  }

  private handleClick = (event: MouseEvent) => {
    const region = this.regionAt(event)
    if (region) this.onSelect(region)
  }

  private handleVisibility = () => {
    if (document.hidden) {
      this.running = false
      cancelAnimationFrame(this.frame)
    } else {
      this.start()
    }
  }
}
