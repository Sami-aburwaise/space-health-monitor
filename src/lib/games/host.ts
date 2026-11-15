import type { AvatarEmotion, AvatarMood, GameTelemetryPayload, TriageLevel } from '@/types/health'

export interface NormalizedGameResult {
  score: number | null
  status: 'won' | 'lost' | 'finished'
  telemetry: GameTelemetryPayload | null
}

export type GameWindowAction =
  | { action: 'close' }
  | { action: 'finish'; result: NormalizedGameResult }

const FINISH_TYPES = new Set(['GAME_FINISHED', 'GAME_OVER', 'MISSION_TELEMETRY'])
const CLOSE_TYPES = new Set(['RETURN_TO_CHAT', 'GAME_CLOSED'])

function normalizeType(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim().toUpperCase().replace(/[\s-]+/g, '_')
}

function asScore(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Number(value)
  }
  return null
}

function isTelemetry(value: unknown): value is GameTelemetryPayload {
  if (!value || typeof value !== 'object') return false
  const metrics = (value as GameTelemetryPayload).metrics
  return (
    !!metrics &&
    typeof metrics.telemetryScore === 'number' &&
    typeof metrics.totalGripReps === 'number' &&
    typeof metrics.survivalDurationSeconds === 'number'
  )
}

function resultStatus(
  raw: unknown,
  telemetry: GameTelemetryPayload | null,
): NormalizedGameResult['status'] {
  const text = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  if (text === 'won' || text === 'win') return 'won'
  if (text === 'lost' || text === 'lose' || text === 'loss') return 'lost'
  if (telemetry?.goalAchieved) return 'won'
  return 'finished'
}

/** Translate a game iframe postMessage into a close or a scored finish. */
export function parseGameWindowMessage(data: unknown): GameWindowAction | null {
  if (!data || typeof data !== 'object') return null
  const record = data as Record<string, unknown>
  const type = normalizeType(record.type)
  if (!FINISH_TYPES.has(type) && !CLOSE_TYPES.has(type)) return null

  const telemetry = isTelemetry(record.telemetry) ? record.telemetry : null
  const score = asScore(record.score) ?? (telemetry ? telemetry.metrics.telemetryScore : null)
  if (score == null && !telemetry) return { action: 'close' }

  return {
    action: 'finish',
    result: {
      score,
      status: resultStatus(record.status ?? telemetry?.missionStatus, telemetry),
      telemetry,
    },
  }
}

export function gameResultKey(result: NormalizedGameResult): string {
  if (result.telemetry?.timestamp) return `telemetry:${result.telemetry.timestamp}`
  return `score:${result.score ?? 'none'}:${result.status}`
}

export interface GameCommentary {
  display: string
  speakText: string
  avatarEmotion: AvatarEmotion
  avatarMood: AvatarMood
  triageLevel: TriageLevel
}

function plural(count: number, word: string): string {
  const rounded = Number.isInteger(count) ? count : Math.round(count)
  return `${rounded} ${word}${rounded === 1 ? '' : 's'}`
}

function outcomePhrase(cause: string): string {
  const head = cause.split(':')[0] ?? cause
  const nice = head.replace(/_+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
  return nice || 'session complete'
}

const DISCLAIMER = 'This is a fitness game, not a medical test.'

/** Natural commentary for a finished round. Returns null when there is no score to react to. */
export function buildGameCommentary(result: NormalizedGameResult): GameCommentary | null {
  const telemetry = result.telemetry
  if (telemetry) {
    const score = Math.round(telemetry.metrics.telemetryScore)
    const reps = telemetry.metrics.totalGripReps
    const hold = telemetry.metrics.isometricShieldHoldSeconds
    const storms = telemetry.metrics.solarStormsDeflected
    const seconds = Math.round(telemetry.metrics.survivalDurationSeconds)
    const respawns = telemetry.metrics.emergencyRespawnsUsed
    const won = telemetry.goalAchieved || result.status === 'won'
    const strong = won && score >= 1000 && respawns === 0
    const goal = telemetry.targetRepGoal

    let lead: string
    if (strong) {
      lead = `That was a sharp run. Score ${score}, ${plural(reps, 'grip squeeze')}, and you deflected ${plural(storms, 'solar storm')} without a respawn.`
    } else if (won) {
      lead = `You hit the ${goal}-rep goal. Score ${score} in ${plural(seconds, 'second')}, with ${plural(reps, 'squeeze')} and ${plural(storms, 'storm')} deflected.`
    } else {
      lead = `The run ended at score ${score} with ${plural(reps, 'squeeze')}. The ${goal}-rep goal is still open, so rest your hand and go again when you want.`
    }

    const holdBit = hold > 0 ? ` Shield hold was ${hold.toFixed(1)} seconds.` : ''
    const detail = `Score ${score} · ${reps} squeezes · ${telemetry.metrics.averageSqueezeRatePerMin} per minute · ${storms} storms · ${telemetry.metrics.survivalDurationSeconds}s survived.`
    const outcome = `Outcome: ${telemetry.terminationCause}.`
    const speakText = `${lead}${holdBit} It ended on ${outcomePhrase(telemetry.terminationCause)}. ${DISCLAIMER}`

    return {
      display: [lead + holdBit, detail, outcome, DISCLAIMER].join('\n\n'),
      speakText: speakText.replace(/\s+/g, ' ').trim(),
      avatarEmotion: strong ? 'cheering' : 'excited',
      avatarMood: 'happy',
      triageLevel: won ? 'info' : 'monitor',
    }
  }

  if (result.score == null) return null
  const score = Math.round(result.score)
  const lead =
    result.status === 'won'
      ? `You won that round. Final score ${score}.`
      : result.status === 'lost'
        ? `Game over. You finished with a score of ${score}.`
        : `Game finished. Your score was ${score}.`

  return {
    display: `${lead}\n\n${DISCLAIMER}`,
    speakText: `${lead} ${DISCLAIMER}`,
    avatarEmotion: result.status === 'won' ? 'cheering' : 'excited',
    avatarMood: 'happy',
    triageLevel: result.status === 'won' ? 'info' : 'monitor',
  }
}
