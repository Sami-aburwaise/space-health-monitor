export type AppView = 'chat' | 'vitals' | 'sources' | 'settings'

/** Where the crew is — changes comms delay and how "contact ground" is phrased. */
export type MissionEnvironment = 'station' | 'moon' | 'mars' | 'rover'

export type MessageRole = 'user' | 'assistant' | 'system'

export type AvatarEmotion = 'happy' | 'sad' | 'cheering' | 'excited' | 'emergency'
export type AvatarMood = 'neutral' | 'happy' | 'sad' | 'emergency'

/** Agentic coach state machine for microgravity training sessions. */
export type CoachState =
  | 'idle'
  | 'greet'
  | 'collect_vitals'
  | 'prescribe_exercise'
  | 'coach_set'
  | 'measure_strength'
  | 'measure_hr'
  | 'debrief'
  /** Daily check-in, one indicator at a time */
  | 'checkin'

export type MeasureKind =
  | 'heart_rate'
  | 'temperature'
  | 'blood_pressure'
  | 'glucose'
  | 'sleep'
  | 'mood'
  | 'spo2'
  | 'strength'

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

export interface ExerciseVideo {
  url: string
  format?: string
  resolution?: string
  aspectRatio?: string
  durationSeconds?: number
}

export interface ExerciseCardData {
  id: string
  name: string
  equipment: string | null
  level?: string
  category?: string
  primaryMuscles: string[]
  overview?: string
  instructions: string[]
  exerciseTips: string[]
  commonMistakes: string[]
  safetyInfo?: string
  imageUrl?: string
  /** Start/end position frames, cycled as a looping demo when there is no video. */
  imageUrls?: string[]
  videoUrl?: string
  aspectRatio?: string
}

export interface MeasurePromptData {
  kind: MeasureKind
  title: string
  hint: string
  /** Prefills the chat composer when the crew taps the prompt */
  starterText?: string
  unit?: string
  /** Future: 'arduino' | 'manual' — UI is ready for serial sensors */
  source?: 'manual' | 'arduino'
}

/** A reply button; tapping it sends `message` as the user. */
export interface ChoiceData {
  label: string
  message: string
}

export type MessageBlock =
  | { type: 'text'; text: string }
  | { type: 'exercise'; exercise: ExerciseCardData }
  | { type: 'measure_prompt'; prompt: MeasurePromptData }
  | { type: 'procedure'; procedure: ProcedureCardData }
  | { type: 'choices'; choices: ChoiceData[] }
  /** What Normal / Watch / Alert mean — an explanation, never a result */
  | { type: 'status_key' }
  /** Today's overall vitals level, shown as a color-coded badge in chat */
  | {
      type: 'overall_status'
      level: 'normal' | 'watch' | 'alert'
      sentence: string
      notes: string[]
    }

export interface ProcedureCardData {
  title: string
  /** Critical readings that triggered it, e.g. ["Temp 40°C", "HR 210 bpm"] */
  readings: string[]
  steps: string[]
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
  /** Rich bubble blocks (exercise media, measure prompts, procedures) */
  blocks?: MessageBlock[]
  /** Claude-selected emotion for the 3D avatar on this turn */
  avatarEmotion?: AvatarEmotion
  avatarMood?: AvatarMood
  /** Short line for TTS (falls back to content) */
  speakText?: string
  coachState?: CoachState
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
  /** Fasting blood glucose, mg/dL */
  glucoseMgDl?: number
  /** Hours slept last night */
  sleepHours?: number
  /** Self-rated mood, 1 (very low) to 5 (very good) */
  moodScore?: number
  /** Short excerpt of the chat message that produced this reading */
  rawExcerpt?: string
}

export type VitalMetrics = Omit<VitalReading, 'id' | 'recordedAt' | 'source'>

/** UI preferences only — API keys live in `.env.local`, never here. */
export interface AppSettings {
  /** @deprecated Migrated into CrewProfile.name */
  crewName?: string
  simulateDelayMs: number
  sidebarCollapsed: boolean
  environment: MissionEnvironment
  /** Speak assistant replies and game commentary. */
  ttsEnabled: boolean
  /** Display name for the Arduino port, e.g. COM3 or /dev/ttyUSB0. */
  arduinoPort: string
  arduinoBaudRate: number
  /** Optional WebSocket bridge. Empty uses the browser Web Serial picker. */
  arduinoBridgeUrl: string
}

export interface CrewProfile {
  id: string
  name: string
  createdAt: string
}

export interface ProfilesState {
  activeId: string
  profiles: CrewProfile[]
}

export interface CoachSession {
  state: CoachState
  /** Next routine exercise index (0-based) for the active profile */
  routineSlot: number
  updatedAt: string
}
