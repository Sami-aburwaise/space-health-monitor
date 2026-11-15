import { CRITICAL } from '@/lib/extractVitals'
import type { MeasureKind, VitalMetrics } from '@/types/health'

export interface EmergencyProcedure {
  /** Short condition name shown as the card title, e.g. "High temperature" */
  condition: string
  /** Reading that triggered it, e.g. "Temp 40°C" */
  reading: string
  steps: string[]
  /** First condition-specific step, spoken aloud */
  spokenStep: string
  recheck: MeasureKind
  recheckIn: string
}

/**
 * Onboard first-response steps for critical readings, used only after the
 * flight surgeon has been contacted. Training content, not medical advice.
 */
export function proceduresFor(metrics: VitalMetrics): EmergencyProcedure[] {
  const { heartRate: hr, temperatureC: temp, spo2, systolic, diastolic, glucoseMgDl } = metrics
  const out: EmergencyProcedure[] = []

  if (temp != null && temp >= CRITICAL.tempHigh) {
    out.push({
      condition: 'High temperature',
      reading: `Temp ${temp}°C`,
      spokenStep: 'Rest, remove extra layers, and sip water.',
      steps: [
        'Rest and remove extra exercise layers; move to good cabin airflow.',
        'Sip water slowly from a drink bag.',
        'Keep your distance from crewmates in case it is an infection.',
      ],
      recheck: 'temperature',
      recheckIn: '15 min',
    })
  }

  if (temp != null && temp < CRITICAL.tempLow) {
    out.push({
      condition: 'Low temperature',
      reading: `Temp ${temp}°C`,
      spokenStep: 'Get into your sleeping bag and add warm layers.',
      steps: [
        'Get into a sleeping bag or add insulated layers.',
        'Move away from vents and cold surfaces.',
      ],
      recheck: 'temperature',
      recheckIn: '15 min',
    })
  }

  if (hr != null && hr > CRITICAL.hrHigh) {
    out.push({
      condition: 'Very fast heart rate',
      reading: `HR ${hr} bpm`,
      spokenStep: 'Hold still at a handrail and breathe slowly.',
      steps: [
        'Hold still at a handrail or in foot loops.',
        'Slow breathing: 4 seconds in, 6 seconds out.',
        'A crewmate stays with you and follows the flight surgeon’s instructions.',
      ],
      recheck: 'heart_rate',
      recheckIn: '2 min',
    })
  }

  if (hr != null && hr < CRITICAL.hrLow) {
    out.push({
      condition: 'Very slow heart rate',
      reading: `HR ${hr} bpm`,
      spokenStep: 'Stay at rest. A crewmate should stay with you.',
      steps: [
        'A crewmate checks that you are awake and breathing normally.',
        'Stay strapped in at rest; do not exert yourself.',
      ],
      recheck: 'heart_rate',
      recheckIn: '2 min',
    })
  }

  if (spo2 != null && spo2 <= CRITICAL.spo2Low) {
    out.push({
      condition: 'Low oxygen',
      reading: `SpO₂ ${spo2}%`,
      spokenStep: 'Check the cabin air alarms and breathe slowly.',
      steps: [
        'Check the cabin oxygen and carbon dioxide readouts for an air fault.',
        'Slow, deep breaths while held in place.',
      ],
      recheck: 'spo2',
      recheckIn: '2 min',
    })
  }

  if (
    (systolic != null && systolic >= CRITICAL.systolicHigh) ||
    (diastolic != null && diastolic >= CRITICAL.diastolicHigh)
  ) {
    out.push({
      condition: 'Very high blood pressure',
      reading: `BP ${systolic ?? '—'}/${diastolic ?? '—'}`,
      spokenStep: 'Rest, breathe calmly, and report any headache or vision change.',
      steps: [
        'Rest strapped in; calm, slow breathing.',
        'Report headache, vision change, chest pain or weakness immediately.',
      ],
      recheck: 'blood_pressure',
      recheckIn: '5 min',
    })
  }

  if (systolic != null && systolic < CRITICAL.systolicLow) {
    out.push({
      condition: 'Very low blood pressure',
      reading: `BP ${systolic}/${diastolic ?? '—'}`,
      spokenStep: 'Stay strapped in at rest and avoid sudden movement.',
      steps: [
        'Stay strapped in at rest; avoid sudden movement.',
        'A crewmate stays with you until the flight surgeon advises.',
      ],
      recheck: 'blood_pressure',
      recheckIn: '5 min',
    })
  }

  if (glucoseMgDl != null && glucoseMgDl < CRITICAL.glucoseLow) {
    out.push({
      condition: 'Very low blood sugar',
      reading: `Glucose ${glucoseMgDl} mg/dL`,
      spokenStep: 'If you can swallow safely, have fast sugar now.',
      steps: [
        'If you can swallow safely, have 15 grams of fast sugar (juice or glucose gel).',
        'A crewmate stays with you.',
      ],
      recheck: 'glucose',
      recheckIn: '15 min',
    })
  }

  return out
}

export const PROCEDURE_FIRST_STEP = 'Stop exercise and unclip from the device.'
