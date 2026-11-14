import type { MeasureKind, VitalMetrics } from '@/types/health'

export interface EmergencyProcedure {
  /** Short condition name shown as the card title, e.g. "Hyperthermia" */
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
 * Simulated crew-medical first-response steps for critical readings.
 * Not medical advice — mirrors the "stop, stabilize, alert, re-check" flow.
 */
export function proceduresFor(metrics: VitalMetrics): EmergencyProcedure[] {
  const { heartRate: hr, temperatureC: temp, spo2, systolic, diastolic } = metrics
  const out: EmergencyProcedure[] = []

  if (temp != null && temp >= 39) {
    out.push({
      condition: 'Hyperthermia',
      reading: `Temp ${temp}°C`,
      spokenStep: 'Strip layers and put cold packs on your neck and armpits.',
      steps: [
        'Remove exercise layers; move to max cabin airflow or a fan.',
        'Cold packs on neck, armpits and groin.',
        'Sip 500 mL of water slowly from a drink bag.',
      ],
      recheck: 'temperature',
      recheckIn: '10 min',
    })
  }

  if (temp != null && temp < 35) {
    out.push({
      condition: 'Hypothermia',
      reading: `Temp ${temp}°C`,
      spokenStep: 'Get into your sleeping bag and add warm layers.',
      steps: [
        'Get into a sleeping bag or add insulated layers.',
        'Move away from vents and cold surfaces.',
        'Sip a warm drink if fully alert.',
      ],
      recheck: 'temperature',
      recheckIn: '15 min',
    })
  }

  if (hr != null && hr > 140) {
    out.push({
      condition: 'Tachycardia',
      reading: `HR ${hr} bpm`,
      spokenStep: 'Call the flight surgeon now. Restrain and breathe slowly.',
      steps: [
        'Call the Crew Medical Officer / flight surgeon immediately.',
        'Restrain at a handrail or foot loops; stay still.',
        'Slow breathing: 4 s in, 6 s out.',
        'Chest pain, dizziness or fainting: crew prepares the AED.',
      ],
      recheck: 'heart_rate',
      recheckIn: '2 min',
    })
  }

  if (hr != null && hr < 40) {
    out.push({
      condition: 'Bradycardia',
      reading: `HR ${hr} bpm`,
      spokenStep: 'A crewmate must check you are responsive. Prepare the AED.',
      steps: [
        'Crewmate checks responsiveness and breathing.',
        'Restrain at rest; do not exert.',
        'Unresponsive or faint: crew prepares the AED.',
      ],
      recheck: 'heart_rate',
      recheckIn: '1 min',
    })
  }

  if (spo2 != null && spo2 < 90) {
    out.push({
      condition: 'Low oxygen',
      reading: `SpO₂ ${spo2}%`,
      spokenStep: 'Put on an oxygen mask and check the cabin air alarms.',
      steps: [
        'Don an oxygen mask from the medical kit.',
        'Check cabin O₂/CO₂ readouts for an atmosphere fault.',
        'Slow, deep breaths while restrained.',
      ],
      recheck: 'heart_rate',
      recheckIn: '2 min',
    })
  }

  if ((systolic != null && systolic >= 180) || (diastolic != null && diastolic >= 120)) {
    out.push({
      condition: 'Hypertensive crisis',
      reading: `BP ${systolic ?? '—'}/${diastolic ?? '—'}`,
      spokenStep: 'Restrain at rest and breathe calmly. Report any headache.',
      steps: [
        'Restrain at rest; calm, slow breathing.',
        'Report headache, vision change or chest pain immediately.',
      ],
      recheck: 'heart_rate',
      recheckIn: '5 min',
    })
  }

  if (systolic != null && systolic <= 80) {
    out.push({
      condition: 'Low blood pressure',
      reading: `BP ${systolic}/${diastolic ?? '—'}`,
      spokenStep: 'Drink a fluid load with salt tablets and stay restrained.',
      steps: [
        'Drink 1 L of fluid with salt tablets (fluid loading).',
        'Restrain at rest; avoid sudden movement.',
      ],
      recheck: 'heart_rate',
      recheckIn: '5 min',
    })
  }

  return out
}

export const PROCEDURE_FIRST_STEP = 'Stop exercise and unclip from the device.'
export const PROCEDURE_LAST_STEP = 'Alert the Crew Medical Officer and flight surgeon.'
