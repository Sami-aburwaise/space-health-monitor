import { formatExtractedMetrics } from '@/lib/extractVitals'
import type { ChatMessage, SymptomEntry, TriageLevel, VitalMetrics, VitalReading } from '@/types/health'

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

function summarizeSymptoms(symptoms: SymptomEntry[]): string {
  if (!symptoms.length) return 'No symptoms logged yet.'
  const recent = symptoms.slice(0, 3).map((s) => `${s.symptom} (sev ${s.severity}/5)`)
  return `Recent symptoms: ${recent.join('; ')}.`
}

export function simulateHealthReply(
  userText: string,
  vitals: VitalReading[],
  symptoms: SymptomEntry[],
  extracted: VitalMetrics | null,
): Pick<ChatMessage, 'content' | 'triageLevel' | 'gameAction'> {
  if (isPlayIntent(userText)) {
    return {
      content:
        'Ready for crew neuromuscular & motor telemetry assessment. Launch the **Asteroid Run & Shield Charge** protocol to evaluate grip strength, response times, and isometric endurance in simulated microgravity.',
      triageLevel: 'info',
      gameAction: {
        gameId: 'asteroid-run',
        title: 'Asteroid Run & Shield Charge',
        description:
          'NASA Bio-Telemetry Grip & Neuromuscular Assessment. 30-rep quota with isometric solar shield hold.',
        url: '/games/asteroid-run.html',
        badge: 'NASA BIO-SYS // CREW EXERCISE',
      },
    }
  }

  const level = detectLevel(userText)
  const context = `${summarizeVitals(vitals)} ${summarizeSymptoms(symptoms)}`

  const intros: Record<TriageLevel, string> = {
    info:
      'I reviewed your note against locally stored vitals and symptoms. This is general guidance only — not a diagnosis.',
    monitor:
      'Your description suggests something worth watching. Mention updated vitals in chat so trends stay current.',
    urgent:
      'Your description raises concern. If symptoms worsen, seek medical evaluation promptly. This app cannot replace a clinician.',
    emergency:
      'This may be an emergency. Stop using this chat as your primary aid — contact emergency / medical services immediately if available.',
  }

  const nextSteps: Record<TriageLevel, string> = {
    info: 'Share heart rate, blood pressure, SpO₂, or temperature in chat to build your vitals history.',
    monitor: 'Rest, hydrate, and re-check vitals in 1–2 hours — then tell me the numbers here.',
    urgent: 'Avoid strenuous activity. Escalate if breathing difficulty, chest pain, or confusion appear.',
    emergency: 'Call emergency services or your mission medical officer now. Do not delay for further chat replies.',
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
    '',
    'Disclaimer: Simulated local triage for hackathon demo. Not medical advice.',
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
