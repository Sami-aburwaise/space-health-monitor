import { formatExtractedMetrics } from '@/lib/extractVitals'
import type { ChatMessage, TriageLevel, VitalMetrics, VitalReading } from '@/types/health'

export function isPlayIntent(text: string): boolean {
  const lower = text.trim().toLowerCase()
  if (
    lower === 'play' ||
    lower === 'game' ||
    lower === 'games' ||
    lower === 'play game' ||
    lower === 'start game' ||
    lower === 'launch game' ||
    lower === 'play asteroid run' ||
    lower === 'play asteroid' ||
    lower === 'asteroid run' ||
    lower === 'grip test' ||
    lower === 'grip assessment'
  ) {
    return true
  }
  return (
    /^(play|launch|start)\b/i.test(lower) ||
    /\b(play (a |the )?game|grip test|asteroid run)\b/i.test(lower)
  )
}

const EMERGENCY = [
  'chest pain',
  "can't breathe",
  'cannot breathe',
  'severe bleeding',
  'unconscious',
  'stroke',
  'seizure',
  'anaphylaxis',
]

const URGENT = [
  'high fever',
  'dizziness',
  'fainting',
  'shortness of breath',
  'severe headache',
  'vomiting blood',
]

const MONITOR = [
  'headache',
  'nausea',
  'fatigue',
  'sore throat',
  'cough',
  'fever',
  'pain',
  'insomnia',
]

function detectLevel(text: string): TriageLevel {
  const lower = text.toLowerCase()
  if (EMERGENCY.some((k) => lower.includes(k))) return 'emergency'
  if (URGENT.some((k) => lower.includes(k))) return 'urgent'
  if (MONITOR.some((k) => lower.includes(k))) return 'monitor'
  return 'info'
}

function summarizeVitals(vitals: VitalReading[]): string {
  if (!vitals.length) return 'No vitals logged from chat yet.'
  const latest = vitals[0]
  return `Latest logged vitals — ${formatExtractedMetrics(latest) || 'partial reading'}.`
}

export function simulateHealthReply(
  userText: string,
  vitals: VitalReading[],
  extracted: VitalMetrics | null,
): Pick<ChatMessage, 'content' | 'triageLevel' | 'gameAction'> {
  if (isPlayIntent(userText)) {
    return {
      content:
        'Want a quick grip workout? **Asteroid Run & Shield Charge** is a fitness game: squeeze to dodge asteroids and hold to charge the shield. It is for fun and training, not a medical test.',
      triageLevel: 'info',
      gameAction: {
        gameId: 'asteroid-run',
        title: 'Asteroid Run & Shield Charge',
        description: 'Grip fitness game. 30-rep goal with a shield hold. Not a medical test.',
        url: '/games/asteroid-run.html',
        badge: 'FITNESS GAME',
      },
    }
  }

  const level = detectLevel(userText)
  const context = summarizeVitals(vitals)

  const intros: Record<TriageLevel, string> = {
    info:
      'I reviewed your note against your locally stored vitals. This is general guidance only — not a diagnosis.',
    monitor:
      'Your description suggests something worth watching. Mention updated vitals in chat so trends stay current.',
    urgent:
      'Your description raises concern. Stop exercising and contact the flight surgeon. This app cannot replace a clinician.',
    emergency:
      'This may be an emergency. Stop exercising and contact the flight surgeon and your Crew Medical Officer now.',
  }

  const nextSteps: Record<TriageLevel, string> = {
    info: 'Tap **Daily check-in** to log heart rate, blood pressure, glucose, temperature, sleep and mood.',
    monitor: 'Rest, drink water, and re-check your vitals in 1–2 hours, then tell me the numbers here.',
    urgent: 'Rest and measure your heart rate and temperature. Tell the flight surgeon if it gets worse.',
    emergency: 'Go to the medical bay. Do not wait for more chat replies.',
  }

  const lines = [intros[level], '']

  if (extracted) {
    lines.push(`Logged from chat → ${formatExtractedMetrics(extracted)}`)
    lines.push('Saved locally for the Vitals History dashboard.')
    lines.push('')
  }

  lines.push(
    `Local context: ${context}`,
    '',
    `Suggested next step: ${nextSteps[level]}`,
  )

  return { content: lines.join('\n'), triageLevel: level }
}

export function triageBadgeLabel(level: TriageLevel): string {
  switch (level) {
    case 'emergency':
      return 'Emergency'
    case 'urgent':
      return 'Urgent'
    case 'monitor':
      return 'Monitor'
    default:
      return 'Info'
  }
}
