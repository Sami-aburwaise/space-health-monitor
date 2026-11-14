import * as THREE from 'three'

export type AvatarState = 'idle' | 'thinking' | 'speaking'
export type AvatarMood = 'neutral' | 'happy' | 'sad'
export type AvatarEmotion = 'happy' | 'sad' | 'cheering' | 'excited'

const EMOTIONS: AvatarEmotion[] = ['happy', 'sad', 'cheering', 'excited']

const EMOTION_SECONDS: Record<AvatarEmotion, number> = {
  happy: 2.5,
  sad: 2.5,
  cheering: 2.8,
  excited: 2.2,
}

const COLORS = {
  shell: 0xe8e8eb,
  joint: 0x27272c,
  visor: 0x0a1518,
  glow: 0x2dd4bf,
  sadGlow: 0x60a5fa,
}

const FRAME_HEIGHT = 3.9
const FRAME_WIDTH = 2.4
const FRAME_CENTER_Y = 1.75
const HIP_Y = 1.1
const HEAD_CENTER_Y = 0.58

function easeTo(current: number, target: number, rate: number, dt: number) {
  return current + (target - current) * (1 - Math.exp(-rate * dt))
}

function lerp(from: number, to: number, amount: number) {
  return from + (to - from) * amount
}

export class RobotAstronaut {
  private readonly container: HTMLElement
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50)
  private readonly timer = new THREE.Timer()
  private readonly resizeObserver: ResizeObserver
  private readonly reducedMotion: boolean

  private readonly root = new THREE.Group()
  private readonly body = new THREE.Group()
  private readonly head = new THREE.Group()
  private readonly face = new THREE.Group()
  private readonly armRight = new THREE.Group()
  private readonly armLeft = new THREE.Group()
  private readonly legRight = new THREE.Group()
  private readonly legLeft = new THREE.Group()
  private readonly eyes: THREE.Mesh[] = []
  private readonly glints: THREE.Mesh[] = []
  private readonly joyEyes: THREE.Group[] = []
  private readonly brows: THREE.Mesh[] = []
  private readonly mouthCorners: THREE.Mesh[] = []
  private mouth!: THREE.Mesh

  private readonly glowColor = new THREE.Color(COLORS.glow)
  private readonly sadColor = new THREE.Color(COLORS.sadGlow)

  private readonly shellMat = new THREE.MeshStandardMaterial({
    color: COLORS.shell,
    roughness: 0.55,
    metalness: 0.05,
    flatShading: true,
  })
  private readonly jointMat = new THREE.MeshStandardMaterial({
    color: COLORS.joint,
    roughness: 0.75,
    flatShading: true,
  })
  private readonly visorMat = new THREE.MeshStandardMaterial({
    color: COLORS.visor,
    roughness: 0.18,
    metalness: 0.35,
    flatShading: true,
    side: THREE.DoubleSide,
  })
  private readonly glowMat = new THREE.MeshStandardMaterial({
    color: COLORS.glow,
    emissive: COLORS.glow,
    emissiveIntensity: 1.4,
  })
  private readonly faceMat = new THREE.MeshStandardMaterial({
    color: COLORS.glow,
    emissive: COLORS.glow,
    emissiveIntensity: 2,
  })
  private readonly glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff })

  private state: AvatarState = 'idle'
  private mood: AvatarMood = 'neutral'
  private override: { emotion: AvatarEmotion; remaining: number } | null = null
  private readonly weights = {
    thinking: 0,
    speaking: 0,
    happy: 0,
    sad: 0,
    cheering: 0,
    excited: 0,
  }

  private frameId = 0
  private running = false
  private time = 0
  private mouthOpen = 0
  private wordPulse = 0
  private blinkTimer = 2
  private blinkRemaining = 0

  constructor(container: HTMLElement) {
    this.container = container
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.domElement.style.display = 'block'
    this.renderer.domElement.style.width = '100%'
    this.renderer.domElement.style.height = '100%'
    container.appendChild(this.renderer.domElement)

    this.buildLights()
    this.buildCharacter()
    this.buildGround()
    this.scene.add(this.root)

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.resize()

    document.addEventListener('visibilitychange', this.handleVisibility)
    this.start()
  }

  setState(state: AvatarState) {
    this.state = state
  }

  /** Baseline expression held between one-shot emotions. */
  setMood(mood: AvatarMood) {
    this.mood = mood
  }

  /** Play an emotion for a few seconds, then fall back to the mood. */
  play(emotion: AvatarEmotion, seconds = EMOTION_SECONDS[emotion]) {
    this.override = { emotion, remaining: seconds }
  }

  /** Called on each spoken word boundary to kick the mouth open. */
  pulse() {
    this.wordPulse = 1
  }

  dispose() {
    this.stop()
    this.resizeObserver.disconnect()
    document.removeEventListener('visibilitychange', this.handleVisibility)

    const geometries = new Set<THREE.BufferGeometry>()
    const materials = new Set<THREE.Material>()
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        geometries.add(object.geometry)
        const mats = Array.isArray(object.material) ? object.material : [object.material]
        mats.forEach((m) => materials.add(m))
      }
    })
    geometries.forEach((g) => g.dispose())
    materials.forEach((m) => m.dispose())

    this.timer.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  private handleVisibility = () => {
    if (document.hidden) this.stop()
    else this.start()
  }

  private start() {
    if (this.running || document.hidden) return
    this.running = true
    this.timer.reset()
    this.frameId = requestAnimationFrame(this.tick)
  }

  private stop() {
    this.running = false
    cancelAnimationFrame(this.frameId)
  }

  private tick = (timestamp: number) => {
    if (!this.running) return
    this.frameId = requestAnimationFrame(this.tick)
    this.timer.update(timestamp)
    const dt = Math.min(this.timer.getDelta(), 0.05)
    this.time += dt
    this.animate(dt)
    this.renderer.render(this.scene, this.camera)
  }

  private resize() {
    const width = this.container.clientWidth
    const height = this.container.clientHeight
    if (width === 0 || height === 0) return

    this.renderer.setSize(width, height, false)
    const aspect = width / height
    this.camera.aspect = aspect

    const halfFov = THREE.MathUtils.degToRad(this.camera.fov) / 2
    const visibleHeight = Math.max(FRAME_HEIGHT, FRAME_WIDTH / aspect)
    const distance = visibleHeight / 2 / Math.tan(halfFov)
    this.camera.position.set(0, FRAME_CENTER_Y + distance * 0.08, distance)
    this.camera.lookAt(0, FRAME_CENTER_Y, 0)
    this.camera.updateProjectionMatrix()
  }

  private updateWeights(dt: number) {
    if (this.override) {
      this.override.remaining -= dt
      if (this.override.remaining <= 0) this.override = null
    }
    const emotion = this.override?.emotion ?? this.mood

    const w = this.weights
    w.thinking = easeTo(w.thinking, this.state === 'thinking' ? 1 : 0, 7, dt)
    w.speaking = easeTo(w.speaking, this.state === 'speaking' ? 1 : 0, 7, dt)
    for (const e of EMOTIONS) {
      w[e] = easeTo(w[e], emotion === e ? 1 : 0, 6, dt)
    }
  }

  private animate(dt: number) {
    this.updateWeights(dt)

    const t = this.time
    const motion = this.reducedMotion ? 0.25 : 1
    const {
      thinking: think,
      speaking: speak,
      happy,
      sad,
      cheering: cheer,
      excited: excite,
    } = this.weights
    const joy = Math.min(1, happy + cheer)

    // Browser speech can't feed an analyser, so the mouth follows word
    // boundary pulses plus a wobble while speaking.
    this.wordPulse = Math.max(0, this.wordPulse - dt / 0.14)
    let mouthTarget = 0
    if (this.state === 'speaking') {
      const wobble = 0.3 + 0.25 * Math.sin(t * 17) * Math.sin(t * 5.3)
      mouthTarget = Math.max(this.wordPulse, wobble)
    }
    mouthTarget = Math.max(
      mouthTarget,
      cheer * (0.55 + 0.2 * Math.sin(t * 9)),
      excite * (0.35 + 0.15 * Math.sin(t * 16)),
    )
    this.mouthOpen = easeTo(this.mouthOpen, mouthTarget, 22, dt)
    const mouth = this.mouthOpen

    this.animateFace(dt, { think, speak, happy, sad, cheer, excite, joy, mouth })

    this.faceMat.emissive.lerpColors(this.glowColor, this.sadColor, sad * 0.8)
    this.faceMat.color.copy(this.faceMat.emissive)
    this.faceMat.emissiveIntensity = (2 + mouth * 0.8 + excite * 0.6) * (1 - sad * 0.3)
    this.glowMat.emissiveIntensity =
      (1.3 +
        Math.sin(t * 2.4) * 0.3 +
        speak * mouth * 0.8 +
        cheer * 0.5 +
        excite * (0.5 + 0.5 * Math.sin(t * 20)) * 0.8) *
      (1 - sad * 0.45)

    const float = Math.sin(t * 1.3) * 0.035 * (1 - sad * 0.6)
    const hop =
      cheer * Math.abs(Math.sin(t * 6)) * 0.28 +
      excite * Math.abs(Math.sin(t * 9)) * 0.12 +
      happy * Math.abs(Math.sin(t * 2.6)) * 0.03
    this.root.position.y = (float + hop) * motion
    this.root.rotation.y = -0.22 + excite * Math.sin(t * 7) * 0.08 * motion

    const breathe =
      Math.sin(t * 2.1) * 0.012 * motion +
      speak * mouth * 0.02 +
      excite * Math.sin(t * 18) * 0.02 * motion -
      sad * 0.03
    this.body.scale.set(1 - breathe * 0.5, 1 + breathe, 1 - breathe * 0.5)
    this.body.rotation.x = sad * 0.1

    this.head.rotation.y =
      Math.sin(t * 0.45) * 0.18 * motion * (1 - think) * (1 - sad * 0.5) -
      0.25 * think +
      excite * Math.sin(t * 14) * 0.12 * motion
    this.head.rotation.z =
      0.16 * think +
      Math.sin(t * 0.7) * 0.03 * motion +
      happy * Math.sin(t * 2.6) * 0.08 * motion
    this.head.rotation.x =
      -0.12 * think +
      speak * Math.sin(t * 7) * 0.05 * mouth * motion +
      sad * 0.28 -
      cheer * 0.18 -
      excite * 0.06

    const sway = Math.sin(t * 1.1) * 0.03 * motion
    const gesture = (0.35 + Math.sin(t * 3.2) * 0.25) * speak * motion
    const shake = Math.sin(t * 20) * 0.35 * excite * motion
    const pump = Math.sin(t * 12) * 0.25 * motion

    this.armRight.rotation.set(
      lerp(-1.6 * think - gesture * 0.4 + shake, -0.2, cheer),
      0,
      lerp(0.12 + sway - 0.5 * think + happy * 0.15 - sad * 0.08, 2.85 + pump, cheer),
    )
    this.armLeft.rotation.set(
      lerp(-gesture - shake, -0.2, cheer),
      0,
      lerp(-0.12 - sway - happy * 0.15 + sad * 0.08, -2.85 - pump, cheer),
    )

    const kick = Math.sin(t * 12) * 0.25 * cheer * motion
    this.legRight.rotation.x = Math.sin(t * 1.3) * 0.03 * motion + kick
    this.legLeft.rotation.x = Math.sin(t * 1.3 + 1) * 0.03 * motion - kick
  }

  private animateFace(
    dt: number,
    w: {
      think: number
      speak: number
      happy: number
      sad: number
      cheer: number
      excite: number
      joy: number
      mouth: number
    },
  ) {
    this.blinkTimer -= dt
    if (this.blinkTimer <= 0) {
      this.blinkRemaining = 0.14
      this.blinkTimer = 2 + Math.random() * 3
    }
    let blink = 1
    if (this.blinkRemaining > 0) {
      this.blinkRemaining -= dt
      const progress = 1 - Math.max(0, this.blinkRemaining) / 0.14
      blink = Math.max(0.1, Math.abs(Math.cos(progress * Math.PI)))
    }

    const eyeOpen =
      blink * (1 - w.think * 0.3) * (1 - w.sad * 0.35) * (1 + w.excite * 0.35)
    this.eyes.forEach((eye) => {
      eye.scale.set(1 + w.excite * 0.2, Math.max(0.001, eyeOpen * (1 - w.joy)), 1)
      eye.position.y = eye.userData.baseY - w.sad * 0.025
    })
    this.glints.forEach((glint) => glint.scale.setScalar(1 + w.excite * 0.8))
    this.joyEyes.forEach((group) => group.scale.setScalar(Math.max(0.001, w.joy)))

    this.face.position.set(w.think * 0.05, w.think * 0.04, 0)

    this.brows.forEach((brow, i) => {
      const side = i === 0 ? 1 : -1
      brow.position.y =
        brow.userData.baseY +
        w.think * 0.03 +
        w.speak * w.mouth * 0.015 +
        w.joy * 0.02 +
        w.excite * 0.04 -
        w.sad * 0.01
      brow.rotation.z = side * w.think * 0.22 - side * w.sad * 0.35
    })

    this.mouth.scale.set(1 - w.mouth * 0.25, 1 + w.mouth * 2.6, 1)
    const curve = w.happy * 0.9 + w.cheer + w.excite * 0.7 - w.sad
    this.mouthCorners.forEach((corner, i) => {
      const side = i === 0 ? 1 : -1
      corner.rotation.z = side * curve * 0.55
      corner.position.y = corner.userData.baseY + curve * 0.02
    })
  }

  private buildLights() {
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x1a1a1e, 1.1))

    const key = new THREE.DirectionalLight(0xffffff, 2.2)
    key.position.set(2.5, 5, 4)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    key.shadow.camera.left = -3
    key.shadow.camera.right = 3
    key.shadow.camera.top = 4
    key.shadow.camera.bottom = -1
    key.shadow.radius = 4
    this.scene.add(key)

    const rim = new THREE.DirectionalLight(COLORS.glow, 1.2)
    rim.position.set(-3, 2.5, -3)
    this.scene.add(rim)
  }

  private buildGround() {
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 6),
      new THREE.ShadowMaterial({ opacity: 0.35 }),
    )
    shadow.rotation.x = -Math.PI / 2
    shadow.receiveShadow = true
    this.scene.add(shadow)

    const pad = new THREE.Mesh(
      new THREE.RingGeometry(0.82, 0.88, 6),
      new THREE.MeshBasicMaterial({
        color: COLORS.glow,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
      }),
    )
    pad.rotation.x = -Math.PI / 2
    pad.position.y = 0.005
    this.scene.add(pad)
  }

  private buildCharacter() {
    this.root.rotation.y = -0.22

    this.buildLeg(this.legRight, 0.28)
    this.buildLeg(this.legLeft, -0.28)
    this.root.add(this.legRight, this.legLeft)

    this.body.position.y = HIP_Y
    this.root.add(this.body)

    this.body.add(
      this.box(0.7, 0.26, 0.46, this.jointMat, 0, 0.08, 0),
      this.box(0.62, 0.3, 0.44, this.jointMat, 0, 0.32, 0),
      this.box(0.98, 0.62, 0.58, this.shellMat, 0, 0.72, 0),
      this.box(0.8, 0.7, 0.3, this.shellMat, 0, 0.7, -0.42),
      this.box(0.36, 0.14, 0.36, this.jointMat, 0, 1.08, 0),
      this.box(0.14, 0.04, 0.02, this.glowMat, 0.3, 0.9, 0.295),
      this.box(0.04, 0.12, 0.02, this.glowMat, -0.36, 0.62, 0.295),
    )

    const coreRim = this.mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.05, 8), this.jointMat)
    coreRim.rotation.x = Math.PI / 2
    coreRim.position.set(0, 0.74, 0.3)
    const core = this.mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 8), this.glowMat)
    core.rotation.x = Math.PI / 2
    core.position.set(0, 0.74, 0.32)
    this.body.add(coreRim, core)

    this.buildArm(this.armRight, 1)
    this.buildArm(this.armLeft, -1)
    this.body.add(this.armRight, this.armLeft)

    this.head.position.y = 1.12
    this.body.add(this.head)
    this.buildHead()
  }

  private buildLeg(leg: THREE.Group, x: number) {
    leg.position.set(x, HIP_Y, 0)
    leg.add(
      this.box(0.36, 0.42, 0.38, this.shellMat, 0, -0.22, 0),
      this.box(0.3, 0.16, 0.32, this.jointMat, 0, -0.48, 0),
      this.box(0.38, 0.38, 0.4, this.shellMat, 0, -0.72, 0),
      this.box(0.04, 0.03, 0.02, this.glowMat, 0, -0.62, 0.205),
      this.box(0.46, 0.2, 0.6, this.shellMat, 0, -0.96, 0.08),
      this.box(0.48, 0.06, 0.62, this.jointMat, 0, -1.07, 0.08),
    )
  }

  private buildArm(arm: THREE.Group, side: 1 | -1) {
    arm.position.set(0.62 * side, 0.9, 0)
    arm.add(
      this.box(0.42, 0.34, 0.46, this.shellMat, 0, -0.02, 0),
      this.box(0.24, 0.34, 0.26, this.jointMat, 0, -0.3, 0),
      this.box(0.32, 0.4, 0.34, this.shellMat, 0, -0.62, 0),
      this.box(0.02, 0.2, 0.06, this.glowMat, 0.17 * side, -0.62, 0),
      this.box(0.24, 0.22, 0.26, this.jointMat, 0, -0.92, 0),
    )
  }

  private buildHead() {
    const centerY = HEAD_CENTER_Y

    const helmet = this.mesh(new THREE.SphereGeometry(0.62, 10, 8), this.shellMat)
    helmet.position.y = centerY
    this.head.add(helmet)

    const visor = this.mesh(
      new THREE.SphereGeometry(
        0.66,
        6,
        4,
        Math.PI / 2 - 0.78,
        1.56,
        Math.PI / 2 - 0.55,
        1.0,
      ),
      this.visorMat,
    )
    visor.position.y = centerY
    visor.castShadow = false
    this.head.add(visor)

    for (const side of [1, -1] as const) {
      const pod = this.mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.12, 8), this.shellMat)
      pod.rotation.z = Math.PI / 2
      pod.position.set(0.64 * side, centerY, 0)
      const light = this.mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 8), this.glowMat)
      light.rotation.z = Math.PI / 2
      light.position.set(0.71 * side, centerY, 0)
      this.head.add(pod, light)
    }

    this.head.add(
      this.box(0.04, 0.3, 0.04, this.jointMat, 0.6, centerY + 0.4, 0),
      this.box(0.08, 0.08, 0.08, this.glowMat, 0.6, centerY + 0.57, 0),
    )

    this.head.add(this.face)

    for (const side of [1, -1] as const) {
      const eye = this.faceBox(0.13, 0.11, 0.17 * side, centerY + 0.08, 0.645)
      eye.userData.baseY = eye.position.y
      const glint = this.box(0.03, 0.03, 0.01, this.glintMat, -0.035, 0.025, 0.012)
      glint.castShadow = false
      eye.add(glint)
      this.eyes.push(eye)
      this.glints.push(glint)

      // Happy "^" eye built from two angled bars.
      const joyEye = new THREE.Group()
      joyEye.position.set(0.17 * side, centerY + 0.08, 0.648)
      for (const half of [1, -1] as const) {
        const bar = this.faceBox(0.085, 0.028, 0.03 * half, 0, 0)
        bar.rotation.z = -half * 0.65
        joyEye.add(bar)
      }
      this.joyEyes.push(joyEye)

      const brow = this.faceBox(0.14, 0.025, 0.17 * side, centerY + 0.2, 0.635)
      brow.userData.baseY = brow.position.y
      this.brows.push(brow)

      this.face.add(eye, joyEye, brow)
    }

    const mouthY = centerY - 0.12
    this.mouth = this.faceBox(0.16, 0.05, 0, mouthY, 0.645)
    this.head.add(this.mouth)

    for (const side of [1, -1] as const) {
      const corner = this.faceBox(0.08, 0.04, 0.11 * side, mouthY, 0.643)
      corner.userData.baseY = corner.position.y
      this.mouthCorners.push(corner)
      this.head.add(corner)
    }
  }

  private faceBox(width: number, height: number, x: number, y: number, z: number) {
    const mesh = this.box(width, height, 0.02, this.faceMat, x, y, z)
    mesh.castShadow = false
    return mesh
  }

  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material) {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  }

  private box(
    width: number,
    height: number,
    depth: number,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
  ) {
    const mesh = this.mesh(new THREE.BoxGeometry(width, height, depth), material)
    mesh.position.set(x, y, z)
    return mesh
  }
}
