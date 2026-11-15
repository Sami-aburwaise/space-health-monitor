import type { HazardId, HrpRiskId } from '@/lib/health/sources'
import type { MeasureKind, VitalMetrics } from '@/types/health'

export type IndicatorId =
  | 'heart_rate'
  | 'blood_pressure'
  | 'glucose'
  | 'temperature'
  | 'sleep'
  | 'mood'
  | 'spo2'

export type StatusLevel = 'normal' | 'watch' | 'alert'

export type BodyRegion = 'brain' | 'heart' | 'core' | 'fingertip'

export interface Assessment {
  level: StatusLevel
  /** "Normal", "High", "Low" — shown next to the value */
  label: string
  /** Short spoken line for the chat reply */
  line: string
  /** What to do now */
  action: string
}

export interface Indicator {
  id: IndicatorId
  name: string
  unit: string
  /** One of the six indicators the challenge brief requires */
  core: boolean
  region: BodyRegion
  measureKind: MeasureKind
  whatItIs: string
  howToMeasure: string
  whySpace: string
  hazards: HazardId[]
  risks: HrpRiskId[]
  /** Human-readable range for each level */
  bands: Record<StatusLevel, string>
  /** General guidance for each level */
  actions: Record<StatusLevel, string>
  /** Everyday habits that keep it in range */
  prevent: string
  /** When to message the flight surgeon */
  contactGround: string
  /** When the daily check-in asks for it */
  schedule: string
  /** Trend chart y-axis and shaded normal band */
  chart: { min: number; max: number; normal: [number, number]; step: number }
  value: (m: VitalMetrics) => number | undefined
  format: (m: VitalMetrics) => string | null
  assess: (m: VitalMetrics) => Assessment | null
}

function a(level: StatusLevel, label: string, line: string, action: string): Assessment {
  return { level, label, line, action }
}

const heartRate: Indicator = {
  id: 'heart_rate',
  name: 'Heart rate',
  unit: 'bpm',
  core: true,
  region: 'heart',
  measureKind: 'heart_rate',
  whatItIs:
    'How many times your heart beats each minute. It goes up with effort, stress, heat, illness or dehydration.',
  howToMeasure:
    'Rest for 5 minutes, held in place by foot loops or a seat strap. Use the chest strap or pulse oximeter, or count your wrist pulse for 30 seconds and double it.',
  whySpace:
    'Without gravity the heart works less and body fluid moves toward the head, so the heart and blood vessels adapt and lose fitness. Fast or irregular rhythms are harder to treat far from Earth.',
  hazards: ['gravity', 'isolation', 'environment'],
  risks: ['cardiovascular', 'fitness'],
  bands: {
    normal: '50–90 bpm at rest',
    watch: '91–110 bpm, or 40–49 bpm',
    alert: 'Above 110 bpm, or below 40 bpm',
  },
  actions: {
    normal: 'Carry on with your day and your routine.',
    watch: 'Rest 10 minutes, drink water, re-measure, and keep exercise easy today.',
    alert: 'Stop exercising, rest held in place, re-measure in 5 minutes, and contact the flight surgeon.',
  },
  prevent: 'Keep up daily cardio and resistance exercise, drink enough water, and take breaks when stressed.',
  contactGround:
    'Resting heart rate above 110 or below 40, or chest pain, a racing or skipping heartbeat, dizziness or fainting at any rate.',
  schedule: 'Every morning at rest, and before and after exercise.',
  chart: { min: 30, max: 150, normal: [50, 90], step: 30 },
  value: (m) => m.heartRate,
  format: (m) => (m.heartRate != null ? `${m.heartRate} bpm` : null),
  assess: (m) => {
    const v = m.heartRate
    if (v == null) return null
    if (v > 110)
      return a('alert', 'High', 'Your heart rate is too high.', 'Stop exercising, rest held in place, and re-measure in 5 minutes.')
    if (v < 40)
      return a('alert', 'Low', 'Your heart rate is too low.', 'Stay at rest and have a crewmate check on you. Re-measure in 5 minutes.')
    if (v > 90)
      return a('watch', 'A bit high', 'Your heart rate is a bit high.', 'Rest for 10 minutes, drink some water, then re-measure. Keep exercise easy today.')
    if (v < 50)
      return a('watch', 'A bit low', 'Your heart rate is a bit low.', 'This can be normal if you are very fit. Re-measure later and tell me if you feel dizzy or tired.')
    return a('normal', 'Normal', 'Your heart rate looks good.', 'Nothing to do. Carry on with your day.')
  },
}

const bloodPressure: Indicator = {
  id: 'blood_pressure',
  name: 'Blood pressure',
  unit: 'mmHg',
  core: true,
  region: 'heart',
  measureKind: 'blood_pressure',
  whatItIs:
    'The push of blood on your arteries. The top number is when the heart beats, the bottom number is when it rests between beats.',
  howToMeasure:
    'Sit strapped in and rest for 5 minutes. Put the cuff on your bare upper arm at heart level, stay still and quiet, and take two readings 1 minute apart.',
  whySpace:
    'In weightlessness fluid shifts toward the head and the body changes how it controls blood pressure. On return to gravity, pressure can drop when you stand up.',
  hazards: ['gravity', 'distance', 'isolation'],
  risks: ['cardiovascular'],
  bands: {
    normal: 'Below 120 / below 80 mmHg',
    watch: '120–139 or 80–89 mmHg (or top number below 90)',
    alert: '140 / 90 mmHg or higher, or top number below 80',
  },
  actions: {
    normal: 'No action. Keep up your exercise.',
    watch: 'Re-measure tomorrow morning, go easy on salty food, and keep exercising.',
    alert: 'Rest 5 minutes, measure again, and send both readings to the flight surgeon.',
  },
  prevent: 'Exercise every day, limit salty food, and keep a regular sleep schedule.',
  contactGround:
    'At 140/90 or higher, a top number below 80, or any reading with headache, chest pain, vision change or weakness.',
  schedule: 'Every morning, seated and rested.',
  chart: { min: 60, max: 180, normal: [90, 120], step: 30 },
  value: (m) => m.systolic,
  format: (m) =>
    m.systolic != null && m.diastolic != null ? `${m.systolic}/${m.diastolic} mmHg` : null,
  assess: (m) => {
    const s = m.systolic
    const d = m.diastolic
    if (s == null || d == null) return null
    if (s >= 140 || d >= 90)
      return a('alert', 'High', 'Your blood pressure is high.', 'Rest for 5 minutes and measure again, then send both readings to the flight surgeon.')
    if (s < 80)
      return a('alert', 'Low', 'Your blood pressure is very low.', 'Stay strapped in at rest and avoid sudden movement. Have a crewmate stay with you.')
    if (s >= 120 || d >= 80)
      return a('watch', 'A bit high', 'Your blood pressure is a bit high.', 'Re-measure tomorrow morning. Go easy on salty food and keep up your exercise.')
    if (s < 90 || d < 60)
      return a('watch', 'A bit low', 'Your blood pressure is a bit low.', 'Drink some water and move slowly. Re-measure later today.')
    return a('normal', 'Normal', 'Your blood pressure looks good.', 'Nothing to do. Keep up your exercise.')
  },
}

const glucose: Indicator = {
  id: 'glucose',
  name: 'Blood glucose',
  unit: 'mg/dL',
  core: true,
  region: 'fingertip',
  measureKind: 'glucose',
  whatItIs:
    'The sugar in your blood, your body’s main fuel. A fasting reading is taken before breakfast.',
  howToMeasure:
    'Before breakfast, wipe a fingertip and prick it with the lancet. In microgravity the blood forms a bead, so touch the meter strip to the drop. Put the lancet straight into the sharps container.',
  whySpace:
    'Less movement and a fixed menu can make the body respond less well to insulin, while long work shifts and skipped meals can cause lows.',
  hazards: ['gravity', 'distance', 'environment'],
  risks: ['nutrition', 'medical'],
  bands: {
    normal: '70–99 mg/dL fasting',
    watch: '100–125 mg/dL fasting',
    alert: 'Below 70, or 126 mg/dL or higher',
  },
  actions: {
    normal: 'Keep regular meals.',
    watch: 'Cut back on sugary snacks, keep exercising, and re-test fasting tomorrow.',
    alert: 'Low: take 15 grams of fast sugar and re-test in 15 minutes. High: re-test tomorrow and tell the flight surgeon today.',
  },
  prevent: 'Eat regular, balanced meals, do not skip food before hard work, and exercise every day.',
  contactGround:
    'Below 70 that does not come up after eating sugar, or a fasting value of 126 or higher.',
  schedule: 'Every morning before breakfast.',
  chart: { min: 40, max: 200, normal: [70, 99], step: 40 },
  value: (m) => m.glucoseMgDl,
  format: (m) => (m.glucoseMgDl != null ? `${m.glucoseMgDl} mg/dL` : null),
  assess: (m) => {
    const v = m.glucoseMgDl
    if (v == null) return null
    if (v < 70)
      return a('alert', 'Low', 'Your blood sugar is low.', 'Eat or drink 15 grams of fast sugar now, like juice or candy, and test again in 15 minutes.')
    if (v >= 126)
      return a('alert', 'High', 'Your blood sugar is high.', 'Re-test fasting tomorrow morning and tell the flight surgeon today.')
    if (v >= 100)
      return a('watch', 'A bit high', 'Your blood sugar is a bit high.', 'Cut back on sugary snacks, keep exercising, and re-test fasting tomorrow.')
    return a('normal', 'Normal', 'Your blood sugar looks good.', 'Nothing to do. Keep regular meals.')
  },
}

const temperature: Indicator = {
  id: 'temperature',
  name: 'Body temperature',
  unit: '°C',
  core: true,
  region: 'core',
  measureKind: 'temperature',
  whatItIs:
    'Your core body heat. A rise often means an infection; a drop means you are losing heat.',
  howToMeasure:
    'Hold the contactless thermometer a few centimetres from your forehead and press the button, or use an oral or ear thermometer. Measure at rest, 30 minutes after exercise, food or a hot drink.',
  whySpace:
    'The immune system is weaker in spaceflight, and an infection in a sealed cabin can spread to the whole crew. Sweat also clings to the skin in weightlessness, so you cool down more slowly after exercise.',
  hazards: ['environment', 'radiation', 'distance'],
  risks: ['immune', 'medical'],
  bands: {
    normal: '36.1–37.2 °C',
    watch: '37.3–37.9 °C, or 35.0–36.0 °C',
    alert: '38.0 °C or higher, or below 35.0 °C',
  },
  actions: {
    normal: 'No action.',
    watch: 'Rest, drink water, skip hard exercise, and re-measure in 1 hour. If low, add a layer.',
    alert: 'Stop exercising, rest, drink fluids, keep your distance from crewmates, re-measure in 30 minutes, and contact the flight surgeon.',
  },
  prevent: 'Wash your hands, wipe shared surfaces, sleep well, and cool down slowly after exercise.',
  contactGround: 'At 38.0 °C or higher, or below 35.0 °C.',
  schedule: 'Every morning, and before exercise.',
  chart: { min: 34, max: 40, normal: [36.1, 37.2], step: 1 },
  value: (m) => m.temperatureC,
  format: (m) => (m.temperatureC != null ? `${m.temperatureC.toFixed(1)} °C` : null),
  assess: (m) => {
    const v = m.temperatureC
    if (v == null) return null
    if (v >= 38)
      return a('alert', 'Fever', 'You have a fever.', 'Stop exercising, rest, drink fluids, and keep your distance from crewmates. Re-measure in 30 minutes.')
    if (v < 35)
      return a('alert', 'Too low', 'Your temperature is too low.', 'Get into your sleeping bag or add warm layers, move away from vents, and re-measure in 15 minutes.')
    if (v >= 37.3)
      return a('watch', 'A bit high', 'Your temperature is a bit high.', 'Rest, drink water, skip hard exercise, and re-measure in 1 hour.')
    if (v < 36.1)
      return a('watch', 'A bit low', 'Your temperature is a bit low.', 'Add a layer, have a warm drink, and re-measure in 30 minutes.')
    return a('normal', 'Normal', 'Your temperature looks good.', 'Nothing to do.')
  },
}

const sleep: Indicator = {
  id: 'sleep',
  name: 'Sleep',
  unit: 'hours',
  core: true,
  region: 'brain',
  measureKind: 'sleep',
  whatItIs: 'How many hours you actually slept last night.',
  howToMeasure:
    'Count from when you fell asleep in your crew quarters to when you woke up. Use the sleep watch if you wear one.',
  whySpace:
    'On the station the Sun rises every 90 minutes, and noise, light and shifting schedules upset your body clock. Too little sleep slows reactions and judgment.',
  hazards: ['isolation', 'environment', 'distance'],
  risks: ['sleep', 'behavioral'],
  bands: {
    normal: '7 hours or more',
    watch: '6 to just under 7 hours',
    alert: 'Under 6 hours',
  },
  actions: {
    normal: 'Keep your sleep schedule.',
    watch: 'Wind down an hour before bed, use your eye mask and earplugs, and dim screens.',
    alert: 'Avoid safety-critical tasks if drowsy, nap if you can, and tell the flight surgeon.',
  },
  prevent: 'Keep a fixed sleep schedule, block light and noise in your quarters, and avoid caffeine late in your day.',
  contactGround: 'Under 6 hours, or on watch 3 nights in a row.',
  schedule: 'Every morning when you wake up.',
  chart: { min: 0, max: 12, normal: [7, 9], step: 3 },
  value: (m) => m.sleepHours,
  format: (m) => (m.sleepHours != null ? `${m.sleepHours} h` : null),
  assess: (m) => {
    const v = m.sleepHours
    if (v == null) return null
    if (v < 6)
      return a('alert', 'Too little', 'You did not get enough sleep.', 'Avoid safety-critical tasks if you feel drowsy, plan a short nap, and tell the flight surgeon about your schedule.')
    if (v < 7)
      return a('watch', 'A bit short', 'You slept a bit less than you need.', 'Wind down an hour before bed, use your eye mask and earplugs, and dim screens.')
    return a('normal', 'Good', 'You got good sleep.', 'Nothing to do. Keep the same sleep schedule.')
  },
}

const mood: Indicator = {
  id: 'mood',
  name: 'Mood',
  unit: '/ 5',
  core: true,
  region: 'brain',
  measureKind: 'mood',
  whatItIs: 'How you feel overall today, from 1 (very low) to 5 (very good).',
  howToMeasure: 'Rate yourself at the same time every day, before you read messages or start work.',
  whySpace:
    'Months in a small crew far from home can bring stress, loneliness and conflict. Low mood affects sleep, teamwork and safety.',
  hazards: ['isolation', 'distance'],
  risks: ['behavioral', 'team'],
  bands: {
    normal: '4 or 5',
    watch: '3',
    alert: '1 or 2',
  },
  actions: {
    normal: 'Keep doing what helps you.',
    watch: 'Talk to a crewmate, call home, or chat with me, and plan something you enjoy.',
    alert: 'Talk to someone you trust today: me, a crewmate or your family. A private chat with the crew psychologist can help too.',
  },
  prevent: 'Stay in touch with family, share meals with the crew, keep a hobby, and speak up early when something bothers you.',
  contactGround:
    'Mood 2 or lower, 3 for three days in a row, or any thought of harming yourself (straight away).',
  schedule: 'Once a day, same time.',
  chart: { min: 1, max: 5, normal: [4, 5], step: 1 },
  value: (m) => m.moodScore,
  format: (m) => (m.moodScore != null ? `${m.moodScore} / 5` : null),
  assess: (m) => {
    const v = m.moodScore
    if (v == null) return null
    if (v <= 2)
      return a('alert', 'Low', 'I’m sorry you’re feeling low.', 'Talk to someone you trust today: me, a crewmate or your family. A private chat with the crew psychologist can help too.')
    if (v < 4)
      return a('watch', 'So-so', 'Sounds like an okay-ish day.', 'Talk to someone, a crewmate, a call home, or me, and plan something you enjoy.')
    return a('normal', 'Good', 'Glad you’re feeling good.', 'Nothing to do. Keep it up.')
  },
}

const spo2: Indicator = {
  id: 'spo2',
  name: 'Blood oxygen (SpO₂)',
  unit: '%',
  core: false,
  region: 'fingertip',
  measureKind: 'spo2',
  whatItIs: 'How much of your blood is carrying oxygen.',
  howToMeasure: 'Clip the pulse oximeter on a warm fingertip and keep still for 30 seconds.',
  whySpace:
    'Cabin air is made by machines. A leak, fire or carbon dioxide build-up can lower the oxygen you get.',
  hazards: ['environment'],
  risks: ['hypoxia'],
  bands: {
    normal: '95–100%',
    watch: '93–94%',
    alert: '92% or lower',
  },
  actions: {
    normal: 'No action.',
    watch: 'Take slow, deep breaths, warm your hand, and re-measure in 5 minutes.',
    alert: 'Check the cabin oxygen and carbon dioxide readouts, breathe slowly, re-measure in 2 minutes, and contact the flight surgeon.',
  },
  prevent: 'Keep cabin air systems checked and respond quickly to air quality alarms.',
  contactGround: 'At 92% or lower, or if you are short of breath.',
  schedule: 'When you feel short of breath, or the cabin air alarm sounds.',
  chart: { min: 80, max: 100, normal: [95, 100], step: 5 },
  value: (m) => m.spo2,
  format: (m) => (m.spo2 != null ? `${m.spo2}%` : null),
  assess: (m) => {
    const v = m.spo2
    if (v == null) return null
    if (v <= 92)
      return a('alert', 'Low', 'Your oxygen is low.', 'Check the cabin oxygen and carbon dioxide readouts, breathe slowly, and re-measure in 2 minutes.')
    if (v < 95)
      return a('watch', 'A bit low', 'Your oxygen is a bit low.', 'Take slow, deep breaths, warm your hand, and re-measure in 5 minutes.')
    return a('normal', 'Normal', 'Your oxygen level looks good.', 'Nothing to do.')
  },
}

export const INDICATORS: Record<IndicatorId, Indicator> = {
  heart_rate: heartRate,
  blood_pressure: bloodPressure,
  glucose,
  temperature,
  sleep,
  mood,
  spo2,
}

/** Display order: the six required indicators first. */
export const INDICATOR_ORDER: IndicatorId[] = [
  'heart_rate',
  'blood_pressure',
  'glucose',
  'temperature',
  'sleep',
  'mood',
  'spo2',
]

export const CORE_INDICATORS = INDICATOR_ORDER.filter((id) => INDICATORS[id].core)

export const LEVEL_RANK: Record<StatusLevel, number> = { normal: 0, watch: 1, alert: 2 }

export function worseLevel(a: StatusLevel, b: StatusLevel): StatusLevel {
  return LEVEL_RANK[a] >= LEVEL_RANK[b] ? a : b
}

export const LEVEL_LABEL: Record<StatusLevel, string> = {
  normal: 'Normal',
  watch: 'Watch',
  alert: 'Alert',
}

/** Indicators present in a parsed message, in display order. */
export function indicatorsIn(m: VitalMetrics): IndicatorId[] {
  return INDICATOR_ORDER.filter((id) => INDICATORS[id].assess(m) != null)
}

export const REGION_LABEL: Record<BodyRegion, string> = {
  brain: 'Brain',
  heart: 'Heart',
  core: 'Core',
  fingertip: 'Fingertip',
}

export function indicatorsForRegion(region: BodyRegion): IndicatorId[] {
  return INDICATOR_ORDER.filter((id) => INDICATORS[id].region === region)
}
