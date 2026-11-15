import type { MeasureKind, MeasurePromptData, MessageBlock } from '@/types/health'

const DEFAULTS: Record<MeasureKind, Omit<MeasurePromptData, 'kind'>> = {
  heart_rate: {
    title: 'Heart rate',
    hint: 'Use the Arduino finger sensor when it is connected, or type your pulse in beats per minute.',
    unit: 'bpm',
    starterText: 'My heart rate is ',
  },
  temperature: {
    title: 'Temperature',
    hint: 'Contactless thermometer a few centimetres from your forehead, at rest. Enter °C.',
    unit: '°C',
    starterText: 'My temperature is ',
  },
  blood_pressure: {
    title: 'Blood pressure',
    hint: 'Seated, cuff at heart level, after 5 minutes rest. Enter top/bottom, e.g. 118/76.',
    unit: 'mmHg',
    starterText: 'My blood pressure is ',
  },
  glucose: {
    title: 'Blood glucose',
    hint: 'Fasting, before breakfast. Touch the strip to the drop.',
    unit: 'mg/dL',
    starterText: 'My glucose is ',
  },
  sleep: {
    title: 'Sleep',
    hint: 'Hours you actually slept last night. Check your sleep watch if you wear one.',
    unit: 'hours',
    starterText: 'I slept ',
  },
  mood: {
    title: 'Mood',
    hint: 'How do you feel today? 1 is very low, 5 is very good.',
    unit: '/ 5',
    starterText: 'My mood is ',
  },
  spo2: {
    title: 'Blood oxygen',
    hint: 'Pulse oximeter on a warm fingertip, keep still 30 seconds.',
    unit: '%',
    starterText: 'My SpO2 is ',
  },
  strength: {
    title: 'Strength test',
    hint: 'Grip fitness game, or enter reps.',
    unit: 'reps',
    starterText: 'Grip strength reps ',
  },
}

export function measurePrompt(
  kind: MeasureKind,
  overrides: Partial<Omit<MeasurePromptData, 'kind'>> = {},
): MessageBlock {
  return {
    type: 'measure_prompt',
    prompt: { kind, source: 'manual', ...DEFAULTS[kind], ...overrides },
  }
}

export function measureDefaults(kind: MeasureKind) {
  return DEFAULTS[kind]
}

/** The message a measure card sends for a value, phrased so the parser reads it back. */
export function readingMessage(kind: MeasureKind, value: string): string {
  switch (kind) {
    case 'heart_rate':
      return `My heart rate is ${value} bpm`
    case 'temperature':
      return `My temperature is ${value} C`
    case 'blood_pressure':
      return `My blood pressure is ${value}`
    case 'glucose':
      return `My glucose is ${value} mg/dL`
    case 'sleep':
      return `I slept ${value} hours`
    case 'mood':
      return `My mood is ${value} out of 5`
    case 'spo2':
      return `My SpO2 is ${value}%`
    default:
      return `Grip strength reps ${value}`
  }
}
