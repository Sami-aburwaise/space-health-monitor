import { PLAUSIBLE } from '@/lib/extractVitals'

/** Hall circuit from the Arduino: 0 = magnet present, 1 = magnet removed. */
export type HallCircuit = 0 | 1

/** One JSON packet from the controller. A null heart rate means the sensor has no beat yet. */
export interface SensorSample {
  hall: HallCircuit | null
  /**
   * Set when the packet includes `heart_rate_bpm`.
   * A number is a usable pulse. Null means the sensor sent null or a value we can't log.
   * Left unset when the packet has no heart-rate field.
   */
  heartRateBpm?: number | null
}

export function hallCircuitLabel(state: HallCircuit | null): 'Closed' | 'Opened' | 'Waiting' {
  if (state === 0) return 'Closed'
  if (state === 1) return 'Opened'
  return 'Waiting'
}

function readCircuit(value: unknown): HallCircuit | null {
  if (value === 0 || value === '0') return 0
  if (value === 1 || value === '1') return 1
  return null
}

/** Null, blank, and out-of-range values are "no pulse", never a stored reading. */
export function readHeartRateBpm(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isFinite(n)) return null
  const bpm = Math.round(n)
  const range = PLAUSIBLE.heart_rate
  if (bpm < range.min || bpm > range.max) return null
  return bpm
}

function readSample(raw: string): SensorSample | null {
  try {
    const data = JSON.parse(raw) as Record<string, unknown>
    const legacyHall = data.event === 'hall_change' && 'state' in data
    const hasHall = 'hall_state' in data || legacyHall
    const hasHeart = 'heart_rate_bpm' in data
    if (!hasHall && !hasHeart) return null

    const hall = 'hall_state' in data ? readCircuit(data.hall_state) : legacyHall ? readCircuit(data.state) : null
    const sample: SensorSample = { hall }
    if (hasHeart) sample.heartRateBpm = readHeartRateBpm(data.heart_rate_bpm)
    return sample
  } catch {
    return null
  }
}

/** Pull complete sensor packets out of a serial text buffer. Keeps a partial trailing object. */
export function pullSensorSamples(buffer: string): { samples: SensorSample[]; rest: string } {
  const samples: SensorSample[] = []
  const re = /\{[^{}]*\}/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = re.exec(buffer))) {
    lastIndex = match.index + match[0].length
    const sample = readSample(match[0])
    if (sample) samples.push(sample)
  }

  const open = buffer.lastIndexOf('{')
  if (open >= lastIndex && !buffer.slice(open).includes('}')) {
    return { samples, rest: buffer.slice(open) }
  }
  if (lastIndex > 0) return { samples, rest: buffer.slice(lastIndex) }
  if (!buffer.includes('{') && buffer.length > 256) return { samples, rest: '' }
  return { samples, rest: buffer }
}
