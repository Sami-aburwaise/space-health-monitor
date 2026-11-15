import * as THREE from 'three'

/** Measuring instruments the avatar can demonstrate. */
export type AvatarTool =
  | 'temperature'
  | 'heart_rate'
  | 'blood_pressure'
  | 'glucose'
  | 'sleep'
  | 'mood'

export const AVATAR_TOOLS: AvatarTool[] = [
  'temperature',
  'heart_rate',
  'blood_pressure',
  'glucose',
  'sleep',
  'mood',
]

export interface ArmPose {
  x: number
  z: number
}

export interface Instrument {
  /** Parts held in the hands, in body space */
  group: THREE.Group
  /** Parts worn on the left arm (cuff, watch), in left-arm space */
  leftArm?: THREE.Group
  right?: ArmPose
  left?: ArmPose
  head: { x: number; y: number }
  update(t: number): void
}

const SHOULDER_X = 0.62
const SHOULDER_Y = 0.9
/** Shoulder to palm along the arm */
const REACH = 0.97
const UP = new THREE.Vector3(0, 1, 0)
const FOREHEAD = new THREE.Vector3(0, 1.97, 0.58)
/** Instruments are drawn a little oversized so they read in the small avatar panel. */
const TOOL_SCALE = 1.35
/** Held devices face the viewer, like showing the screen to the user. */
const VIEWER = new THREE.Vector3(0, 1.6, 8)

/** Arm rotation (Euler XYZ, no twist) that points the hand at `target`, plus where the palm lands. */
function aimArm(side: 1 | -1, target: THREE.Vector3): { pose: ArmPose; hand: THREE.Vector3 } {
  const shoulder = new THREE.Vector3(SHOULDER_X * side, SHOULDER_Y, 0)
  const d = target.clone().sub(shoulder).normalize()
  const z = Math.asin(THREE.MathUtils.clamp(d.x, -1, 1))
  const c = Math.cos(z)
  const x = Math.atan2(-d.z / c, -d.y / c)
  return { pose: { x, z }, hand: shoulder.addScaledVector(d, REACH) }
}

/** Rotates `object` so its +z axis points from its position toward `target`. */
function pointAt(object: THREE.Object3D, target: THREE.Vector3) {
  const m = new THREE.Matrix4().lookAt(target, object.position, UP)
  object.quaternion.setFromRotationMatrix(m)
}

function emissive(color: number, intensity = 1.6, transparent = false) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
    transparent,
    side: transparent ? THREE.DoubleSide : THREE.FrontSide,
  })
}

/** Device casing in the same colour as its measure card. */
function casing(color: number) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.5, flatShading: true })
}

const pulse = (t: number, hz: number) => Math.max(0, Math.sin(t * Math.PI * 2 * hz))

export function buildInstruments(joint: THREE.Material) {
  const screen = emissive(0x2dd4bf, 1.4)
  const red = emissive(0xef4444, 2)
  const beam = emissive(0xef4444, 2, true)
  const cuffMat = new THREE.MeshStandardMaterial({
    color: 0x1e3a5f,
    roughness: 0.9,
    flatShading: true,
    side: THREE.DoubleSide,
  })
  const strip = new THREE.MeshStandardMaterial({ color: 0xf4f4f5, roughness: 0.6 })
  const watchGlow = emissive(0x818cf8, 1.2, true)
  const dots = [0, 1, 2, 3, 4].map(() => emissive(0x2dd4bf, 0.4))

  const box = (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    return mesh
  }

  const tools = {} as Record<AvatarTool, Instrument>

  // Contactless thermometer aimed at the forehead, with a pulsing beam
  {
    const { pose, hand } = aimArm(1, new THREE.Vector3(0.22, 1.62, 1.05))
    const gun = new THREE.Group()
    gun.position.copy(hand).add(new THREE.Vector3(-0.02, 0.1, 0.16))
    pointAt(gun, FOREHEAD)
    gun.add(
      box(0.11, 0.12, 0.3, casing(0xf59e0b), 0, 0, 0),
      box(0.08, 0.2, 0.1, joint, 0, -0.14, -0.08),
      box(0.07, 0.07, 0.02, red, 0, 0, 0.16),
      box(0.08, 0.06, 0.02, screen, 0, 0.02, -0.16),
    )
    gun.scale.setScalar(TOOL_SCALE)
    const length = gun.position.distanceTo(FOREHEAD) / TOOL_SCALE - 0.17
    const ray = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.025, length, 6), beam)
    ray.rotation.x = Math.PI / 2
    ray.position.z = 0.17 + length / 2
    gun.add(ray)
    const group = new THREE.Group()
    group.add(gun)
    tools.temperature = {
      group,
      right: pose,
      head: { x: -0.1, y: 0 },
      update: (t) => {
        beam.opacity = 0.15 + 0.55 * pulse(t, 0.8)
        screen.emissiveIntensity = 1 + 0.6 * pulse(t, 0.8)
      },
    }
  }

  // Pulse oximeter clipped on a left fingertip, with a heartbeat blip
  {
    const { pose, hand } = aimArm(-1, new THREE.Vector3(-0.15, 1.05, 1.05))
    const clip = new THREE.Group()
    clip.position.copy(hand)
    pointAt(clip, hand.clone().multiplyScalar(2).sub(new THREE.Vector3(-SHOULDER_X, SHOULDER_Y, 0)))
    clip.translateZ(0.1)
    const heart = box(0.04, 0.04, 0.02, red, 0.04, 0.081, 0)
    heart.rotation.x = -Math.PI / 2
    clip.add(
      box(0.16, 0.08, 0.2, casing(0xf43f5e), 0, 0.03, 0),
      box(0.16, 0.06, 0.2, joint, 0, -0.04, 0),
      box(0.08, 0.005, 0.12, screen, -0.02, 0.071, 0),
      heart,
    )
    clip.scale.setScalar(TOOL_SCALE)
    const group = new THREE.Group()
    group.add(clip)
    tools.heart_rate = {
      group,
      left: pose,
      head: { x: 0.28, y: -0.18 },
      update: (t) => {
        const beat = Math.pow(pulse(t, 1.2), 6)
        heart.scale.setScalar(0.6 + beat * 0.8)
      },
    }
  }

  // Blood pressure cuff on the upper left arm, monitor in the right hand
  {
    const left = aimArm(-1, new THREE.Vector3(-0.4, 0.8, 1.0))
    const right = aimArm(1, new THREE.Vector3(0.18, 0.95, 1.05))
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.26, 10, 1, true), cuffMat)
    cuff.position.y = -0.28
    const leftArm = new THREE.Group()
    leftArm.add(cuff)

    const monitor = new THREE.Group()
    monitor.position.copy(right.hand).add(new THREE.Vector3(-0.04, 0.2, 0.2))
    pointAt(monitor, VIEWER)
    const reading = box(0.16, 0.08, 0.01, screen, 0, 0.02, 0.035)
    monitor.add(
      box(0.24, 0.18, 0.06, casing(0xef4444)),
      reading,
      box(0.05, 0.03, 0.01, joint, 0, -0.06, 0.035),
    )
    monitor.scale.setScalar(TOOL_SCALE)
    const group = new THREE.Group()
    group.add(monitor)
    tools.blood_pressure = {
      group,
      leftArm,
      left: left.pose,
      right: right.pose,
      head: { x: 0.25, y: 0.05 },
      update: (t) => {
        const phase = (t % 4) / 4
        const inflate = phase < 0.7 ? phase / 0.7 : 1 - (phase - 0.7) / 0.3
        cuff.scale.set(1 + inflate * 0.18, 1, 1 + inflate * 0.18)
        screen.emissiveIntensity = 0.8 + inflate
      },
    }
  }

  // Glucose meter in the right hand, strip touching a blood drop on the left fingertip
  {
    const right = aimArm(1, new THREE.Vector3(0.2, 0.95, 1.05))
    const left = aimArm(-1, new THREE.Vector3(-0.12, 1.0, 1.05))
    const meter = new THREE.Group()
    meter.position.copy(right.hand).add(new THREE.Vector3(-0.04, 0.2, 0.2))
    pointAt(meter, VIEWER)
    meter.add(box(0.13, 0.22, 0.05, casing(0x8b5cf6)), box(0.09, 0.07, 0.01, screen, 0, 0.04, 0.03))
    meter.scale.setScalar(TOOL_SCALE)
    const stripEnd = left.hand.clone().add(new THREE.Vector3(0.05, 0.06, 0.14))
    const start = meter.position.clone().add(new THREE.Vector3(-0.05, 0.08, 0))
    const stripLength = start.distanceTo(stripEnd)
    const testStrip = box(0.035, 0.008, stripLength, strip)
    testStrip.position.copy(start).lerp(stripEnd, 0.5)
    pointAt(testStrip, stripEnd)
    const drop = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), red)
    drop.position.copy(stripEnd)
    const group = new THREE.Group()
    group.add(meter, testStrip, drop)
    tools.glucose = {
      group,
      right: right.pose,
      left: left.pose,
      head: { x: 0.3, y: 0 },
      update: (t) => {
        drop.scale.setScalar(0.8 + 0.3 * pulse(t, 0.6))
        screen.emissiveIntensity = 0.8 + 0.8 * pulse(t, 0.6)
      },
    }
  }

  // Sleep watch on the left wrist, raised to read it
  {
    const { pose } = aimArm(-1, new THREE.Vector3(-0.12, 1.3, 1.05))
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.14, 10, 1, true), watchGlow)
    band.position.y = -0.74
    const leftArm = new THREE.Group()
    leftArm.add(
      band,
      box(0.24, 0.2, 0.08, joint, 0, -0.74, 0.25),
      box(0.18, 0.14, 0.01, watchGlow, 0, -0.74, 0.295),
    )
    tools.sleep = {
      group: new THREE.Group(),
      leftArm,
      left: pose,
      head: { x: 0.18, y: -0.22 },
      update: (t) => {
        watchGlow.emissiveIntensity = 0.6 + 0.9 * (0.5 + 0.5 * Math.sin(t * 1.5))
      },
    }
  }

  // Mood tablet held in both hands, a 1–5 scale lighting up in turn
  {
    const right = aimArm(1, new THREE.Vector3(0.3, 1.0, 1.0))
    const left = aimArm(-1, new THREE.Vector3(-0.3, 1.0, 1.0))
    const tablet = new THREE.Group()
    tablet.position.copy(right.hand).lerp(left.hand, 0.5).add(new THREE.Vector3(0, 0.16, 0.2))
    pointAt(tablet, VIEWER)
    tablet.add(box(0.56, 0.36, 0.03, joint), box(0.6, 0.4, 0.02, casing(0x14b8a6), 0, 0, -0.02))
    dots.forEach((mat, i) => tablet.add(box(0.07, 0.07, 0.01, mat, -0.2 + i * 0.1, 0, 0.02)))
    const group = new THREE.Group()
    group.add(tablet)
    tools.mood = {
      group,
      right: right.pose,
      left: left.pose,
      head: { x: 0.28, y: 0 },
      update: (t) => {
        const lit = Math.floor(t * 1.2) % 5
        dots.forEach((mat, i) => (mat.emissiveIntensity = i === lit ? 2.4 : 0.35))
      },
    }
  }

  return tools
}
