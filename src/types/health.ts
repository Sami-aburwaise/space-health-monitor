export type AppView = 'chat' | 'vitals' | 'symptoms' | 'settings'

export type MessageRole = 'user' | 'assistant' | 'system'

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  createdAt: string
  triageLevel?: TriageLevel
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
}
