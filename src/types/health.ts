export type AppView = 'chat' | 'vitals' | 'symptoms' | 'settings'

export type MessageRole = 'user' | 'assistant' | 'system'

export interface GameAction {
  gameId: string
  title: string
  description: string
  url: string
  badge?: string
}

export interface GameTelemetryMetrics {
  totalGripReps: number
  emergencyRespawnsUsed: number
  isometricShieldHoldSeconds: number
  survivalDurationSeconds: number
  averageSqueezeRatePerMin: number
  solarStormsDeflected: number
  telemetryScore: number
}

export interface GameTelemetryPayload {
  timestamp: string
  missionStatus: string
  targetRepGoal: number
  goalAchieved: boolean
  terminationCause: string
  metrics: GameTelemetryMetrics
}

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  createdAt: string
  triageLevel?: TriageLevel
  /** True when this assistant reply saved vitals extracted from the user's message */
  loggedVitals?: boolean
  gameAction?: GameAction
  gameTelemetry?: GameTelemetryPayload
}

export type TriageLevel = 'info' | 'monitor' | 'urgent' | 'emergency'

/** Partial metrics are allowed — chat may mention only one measurement. */
export interface VitalReading {
  id: string
  recordedAt: string
  source: 'chat'
  heartRate?: number
  systolic?: number
  diastolic?: number
  spo2?: number
  temperatureC?: number
  weightKg?: number
  /** Short excerpt of the chat message that produced this reading */
  rawExcerpt?: string
}

export type VitalMetrics = Omit<VitalReading, 'id' | 'recordedAt' | 'source'>

export interface SymptomEntry {
  id: string
  recordedAt: string
  symptom: string
  severity: 1 | 2 | 3 | 4 | 5
  duration: string
  notes?: string
}

export interface AppSettings {
  crewName: string
  disclaimerAccepted: boolean
  simulateDelayMs: number
  /** Optional LLM / provider key — stored only in localStorage */
  apiKey: string
  sidebarCollapsed: boolean
}
