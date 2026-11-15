/** NASA Human Research Program — the five hazards of human spaceflight. */
export type HazardId = 'radiation' | 'isolation' | 'distance' | 'gravity' | 'environment'

export interface Hazard {
  id: HazardId
  name: string
  summary: string
}

export const HAZARDS_URL = 'https://www.nasa.gov/hrp/hazards/'
export const HRP_RISKS_URL = 'https://humanresearchroadmap.nasa.gov/risks/'

export const HAZARDS: Record<HazardId, Hazard> = {
  radiation: {
    id: 'radiation',
    name: 'Space radiation',
    summary: 'Invisible particle radiation outside Earth’s protection, which can harm cells and the immune system.',
  },
  isolation: {
    id: 'isolation',
    name: 'Isolation and confinement',
    summary: 'Months in a small space with the same few people, away from family, affect mood, sleep and teamwork.',
  },
  distance: {
    id: 'distance',
    name: 'Distance from Earth',
    summary: 'Medical help, supplies and advice from Earth get slower and harder to reach as the crew travels further.',
  },
  gravity: {
    id: 'gravity',
    name: 'Gravity fields',
    summary: 'Weightlessness and partial gravity change the heart, blood flow, muscles, bones and balance.',
  },
  environment: {
    id: 'environment',
    name: 'Hostile / closed environment',
    summary: 'The cabin is a machine: air, temperature, noise, light and microbes must all be controlled.',
  },
}

/** Exact risk titles from the NASA Human Research Roadmap. */
export const HRP_RISKS = {
  cardiovascular:
    'Risk of Cardiovascular Adaptations Contributing to Adverse Mission Performance and Health Outcomes',
  fitness:
    'Risk of Mission Performance Decrements and Adverse Health Outcomes Resulting from Reduced Cardiorespiratory and Musculoskeletal Fitness',
  medical:
    'Risk of Adverse Health Outcomes and Decrements in Performance Due to Medical Conditions that occur in Mission, as well as Long Term Health Outcomes Due to Mission Exposures',
  nutrition: 'Risk of Performance Decrement and Crew Illness Due to Inadequate Food and Nutrition',
  immune:
    'Risk of In Mission Impacts, Adverse Health Events or Long-Term Health Impacts due to Altered Immune Response',
  sleep:
    'Risk of Performance Decrements and Adverse Health Outcomes Resulting from Sleep Loss, Circadian Desynchronization, and Work Overload',
  behavioral:
    'Risk of Adverse Cognitive or Behavioral Changes and Psychiatric Disorders Leading to In-mission Health and Performance and Long-term Health Effects',
  team: 'Risk of In-Mission Performance and Behavioral Health Decrements Due to Inadequate Cooperation, Coordination, Communication, and Psychosocial Adaptation within a Team',
  hypoxia: 'Risk of Reduced Crew Health and Performance Due to Hypoxia',
  earthIndependent: 'Risk of Adverse Mission Outcomes Due to Earth Independent Human-Systems Operations',
} as const

export type HrpRiskId = keyof typeof HRP_RISKS

export interface Reference {
  title: string
  publisher: string
  url: string
  usedFor: string
}

export const REFERENCES: Reference[] = [
  {
    title: '5 Hazards of Human Spaceflight',
    publisher: 'NASA Human Research Program',
    url: HAZARDS_URL,
    usedFor: 'The five hazards shown on every indicator.',
  },
  {
    title: 'Human Research Roadmap — Risks',
    publisher: 'NASA Human Research Program',
    url: HRP_RISKS_URL,
    usedFor: 'The HRP risk linked to each indicator.',
  },
  {
    title: 'NASA Space Apps Challenge 2026 — Create Health Monitoring Software for Astronauts',
    publisher: 'NASA Space Apps Challenge',
    url: 'https://www.spaceappschallenge.org/',
    usedFor: 'The six indicators, the normal / watch / alert bands and the escalation rules.',
  },
  {
    title: 'Understanding Blood Pressure Readings',
    publisher: 'American Heart Association',
    url: 'https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings',
    usedFor: 'Blood pressure categories (normal below 120/80, high at 140/90, severe above 180/120).',
  },
  {
    title: 'Diabetes Diagnosis — Fasting Plasma Glucose',
    publisher: 'American Diabetes Association',
    url: 'https://diabetes.org/about-diabetes/diagnosis',
    usedFor: 'Fasting glucose bands (normal below 100, 100–125, 126 mg/dL or higher).',
  },
  {
    title: 'About Sleep',
    publisher: 'U.S. Centers for Disease Control and Prevention',
    url: 'https://www.cdc.gov/sleep/about/index.html',
    usedFor: 'Adults need 7 or more hours of sleep.',
  },
  {
    title: 'Fever',
    publisher: 'MedlinePlus (U.S. National Library of Medicine)',
    url: 'https://medlineplus.gov/ency/article/003090.htm',
    usedFor: 'Oral temperature above 37.2–37.5 °C is a likely fever; contact a provider if it stays at 39.4 °C or higher.',
  },
  {
    title: 'Pulse Oximetry',
    publisher: 'MedlinePlus (U.S. National Library of Medicine)',
    url: 'https://medlineplus.gov/lab-tests/pulse-oximetry/',
    usedFor: 'Normal oxygen saturation 95–100%; contact a provider at 92% or lower, urgent at 88% or lower.',
  },
]

export interface Library {
  name: string
  url: string
  usedFor: string
}

export const LIBRARIES: Library[] = [
  { name: 'React', url: 'https://react.dev/', usedFor: 'User interface' },
  { name: 'Vite', url: 'https://vite.dev/', usedFor: 'Build and dev server' },
  { name: 'TypeScript', url: 'https://www.typescriptlang.org/', usedFor: 'Type-safe code' },
  { name: 'Tailwind CSS', url: 'https://tailwindcss.com/', usedFor: 'Styling' },
  { name: 'shadcn/ui + Radix UI', url: 'https://ui.shadcn.com/', usedFor: 'UI components' },
  { name: 'Lucide', url: 'https://lucide.dev/', usedFor: 'Icons' },
  { name: 'Three.js', url: 'https://threejs.org/', usedFor: '3D coach avatar' },
  { name: 'Geist font', url: 'https://vercel.com/font', usedFor: 'Typography' },
  { name: 'uuid', url: 'https://github.com/uuidjs/uuid', usedFor: 'Record IDs' },
  {
    name: 'free-exercise-db',
    url: 'https://github.com/yuhonas/free-exercise-db',
    usedFor: 'Exercise demo images',
  },
  { name: 'Anthropic Claude API', url: 'https://www.anthropic.com/api', usedFor: 'Optional chat replies' },
  { name: 'ElevenLabs API', url: 'https://elevenlabs.io/', usedFor: 'Optional coach voice' },
]

export const DISCLAIMER =
  'Prototype for NASA Space Apps. Thresholds are illustrative, not medical advice. Always follow your flight surgeon.'
