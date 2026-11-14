import { createMessage, type ClaudeContentBlock, type ClaudeMessage, type ClaudeTool } from '@/lib/api/claude'
import { getExercise, hasExerciseMedia, searchMicroGExercises } from '@/lib/api/exercise'
import { classifyMessage } from '@/lib/coach/classify'
import { formatRoutineBrief, routineForAstronaut } from '@/lib/coach/routines'
import { describeStateMachine } from '@/lib/coach/stateMachine'
import {
  formatStationInventory,
  resolveStationEquipment,
} from '@/lib/coach/stationInventory'
import { buildVitalReply } from '@/lib/coach/vitalReplies'
import {
  extractVitalsFromText,
  isCriticalVitals,
  mergeVitals,
} from '@/lib/extractVitals'
import { getClaudeApiKey } from '@/lib/env'
import type {
  AvatarEmotion,
  AvatarMood,
  ChatMessage,
  CoachState,
  MeasureKind,
  MessageBlock,
  TriageLevel,
  VitalReading,
} from '@/types/health'

const EMOTIONS: AvatarEmotion[] = ['happy', 'sad', 'cheering', 'excited', 'emergency']
const MOODS: AvatarMood[] = ['neutral', 'happy', 'sad', 'emergency']
const STATES: CoachState[] = [
  'idle',
  'greet',
  'collect_vitals',
  'prescribe_exercise',
  'coach_set',
  'measure_strength',
  'measure_hr',
  'nutrition',
  'debrief',
]

const MAX_SPEAK_WORDS = 15
/** Symptom / small-talk turns are a conversation, not a routine step. */
const MAX_CHAT_WORDS = 35
const CHAT_INTENTS = new Set(['symptom', 'general'])

export interface AgentTurnResult {
  content: string
  speakText: string
  blocks: MessageBlock[]
  avatarEmotion?: AvatarEmotion
  avatarMood?: AvatarMood
  coachState: CoachState
  /** Reset / advance the per-profile routine index when set */
  routineSlot?: number
  triageLevel: TriageLevel
  loggedVitals: boolean
}

interface Keys {
  claudeApiKey: string
  exerciseApiKey: string
}

interface RunContext {
  keys: Keys
  crewName: string
  coachState: CoachState
  routineSlot?: number
  vitals: VitalReading[]
  history: ChatMessage[]
  userText: string
}

const TOOLS: ClaudeTool[] = [
  {
    name: 'search_microg_exercises',
    description:
      'Search station exercises WITH demo video/image. equipment MUST be cable | bands | machine only. Never dumbbell/kettlebell/barbell/machine chest press.',
    input_schema: {
      type: 'object',
      properties: {
        q: { type: 'string' },
        muscle: { type: 'string' },
        equipment: {
          type: 'string',
          enum: ['cable', 'bands', 'machine'],
          description: 'Only cable, bands, or machine',
        },
        prefer_video: { type: 'boolean' },
      },
      required: ['q', 'equipment'],
    },
  },
  {
    name: 'get_exercise',
    description:
      'Fetch one exercise by id. Will reject gravity-dependent / free-weight moves.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },
  {
    name: 'present_turn',
    description:
      'End the turn. Text blocks: MAX 15 WORDS total (35 for symptom / general chat). The avatar reads the text blocks aloud verbatim. Prefer measure_prompt / exercise bubbles over long prose during the routine.',
    input_schema: {
      type: 'object',
      properties: {
        speak: {
          type: 'string',
          description:
            'Fallback spoken line, used only when there are no text blocks. Max 15 words, no markdown.',
        },
        emotion: { type: 'string', enum: EMOTIONS },
        mood: { type: 'string', enum: MOODS },
        next_state: { type: 'string', enum: STATES },
        triage: {
          type: 'string',
          enum: ['info', 'monitor', 'urgent', 'emergency'],
        },
        blocks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['text', 'exercise', 'nutrition', 'measure_prompt'],
              },
              text: {
                type: 'string',
                description:
                  'Routine steps: max 15 words. Symptom / general chat: 2–3 warm, full sentences (max 35 words). **bold** allowed.',
              },
              exercise_id: { type: 'string' },
              food_name: { type: 'string' },
              calories_100g: { type: 'number' },
              protein_100g: { type: 'number' },
              carbs_100g: { type: 'number' },
              fat_100g: { type: 'number' },
              fiber_100g: { type: 'number' },
              serving_label: { type: 'string' },
              estimate_note: { type: 'string' },
              measure_kind: {
                type: 'string',
                enum: ['heart_rate', 'temperature', 'strength'],
              },
              title: { type: 'string' },
              hint: { type: 'string' },
              starter_text: { type: 'string' },
            },
            required: ['type'],
          },
        },
      },
      required: ['emotion', 'next_state', 'blocks'],
    },
  },
]

function clampWords(text: string, max = MAX_SPEAK_WORDS): string {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length <= max) return words.join(' ')
  return words.slice(0, max).join(' ')
}

function systemPrompt(
  ctx: RunContext,
  inventory: string[],
  intent: string,
): string {
  const routine = routineForAstronaut(ctx.crewName)
  const latest = ctx.vitals[0]
  const vitalsLine = latest
    ? `Latest: HR ${latest.heartRate ?? '—'} · temp ${latest.temperatureC ?? '—'}°C · SpO₂ ${latest.spo2 ?? '—'}`
    : 'No vitals yet.'

  return `Space Health coach. Microgravity. Ultra-short replies.

HARD LIMITS:
- Routine turns: all text blocks combined MAX 15 WORDS. Symptom / general chat: MAX ${MAX_CHAT_WORDS} WORDS. They are read aloud verbatim.
- No walls of text. Prefer interactive bubbles.
- NEVER ask what machines/equipment the crew has.
- NEVER ask to retake, recount, or verify a vital. Always assume the reading is correct.
- ZERO GRAVITY: ONLY cable, resistance bands, or machines. NEVER dumbbell, kettlebell, barbell, Arnold press, free-weight press, standing balance moves.
- If a search returns a free-weight move, discard it and search again with cable/bands/machine.
- Station inventory is FIXED: ${formatStationInventory(inventory)}.
- This astronaut's routine is FIXED — use it, do not invent a different plan:
${formatRoutineBrief(routine)}

Message intent (local classifier): ${intent}
Coach state: ${ctx.coachState}
Crew: ${ctx.crewName || 'Crew Member'}

Intent playbook:
- start_routine → temperature measure_prompt only (then later HR). Do not prescribe yet.
- vital_report → short ack + next bubble (HR if temp done, else first routine exercise).
- exercise_done / after vitals → search_microg_exercises with the NEXT routine slot equipment, then exercise bubble + optional measure_prompt.
- strength_test / play_game → strength measure_prompt (grip game).
- food_query → one nutrition estimate bubble + ≤15 word note.
- critical vitals (HR <40 or >140, temp <35 or ≥39.5, SpO₂ <90, extreme BP) → emotion emergency + triage emergency/urgent. Lights go red.

Always finish with present_turn.
State machine:
${describeStateMachine()}

${vitalsLine}
Station local coach.`
}

/** Symptom / small-talk turns: a focused prompt so the routine rules don't make replies curt. */
function chatPrompt(ctx: RunContext): string {
  const latest = ctx.vitals[0]
  const midWorkout = ctx.coachState === 'coach_set' || ctx.coachState === 'prescribe_exercise'

  return `You are the friendly health companion on a space station, chatting with ${ctx.crewName || 'a crew member'}. Talk like a caring friend checking in.

How to reply:
- 2 or 3 short, warm, full sentences (max ${MAX_CHAT_WORDS} words). They are read aloud, so sound natural. No shorthand, symbols, or lists.
- Acknowledge how they feel first, then say clearly what to do. Never ask for a number or a rating.

You are also their emotional support. If they talk about stress, loneliness, missing home, sleep, conflict with crew, or just want to chat:
- Listen first. Reflect what they feel in your own words and let them know it's normal up here.
- Be gentle and encouraging. Offer one small, practical idea only if it fits (a call home, a few slow breaths, looking out at Earth).
- Invite them to keep talking. Never rush them back to the workout.
- If they mention hopelessness or wanting to hurt themselves, kindly urge them to talk to the flight surgeon or crew psychologist right away, and triage "urgent".

What to do when they feel unwell — use your judgement:
- Mild (a slight headache, a bit tired): one practical tip. If they can keep working out, say you are giving them the next set at an easier pace (the app attaches the exercise card for you). Stay in next_state "coach_set".
- Getting worse, several symptoms, or anything that worries you: tell them to stop exercising and rest, and add measure_prompt blocks for temperature and heart rate so they can check their vitals right away. Use next_state "collect_vitals". Do NOT mention a next exercise.
- Serious (chest pain, trouble breathing, fainting, confusion, sudden severe pain, or bad and getting worse): tell them to stop now, go to the station medical bay, and call the flight surgeon. Triage "urgent" (or "emergency" if it sounds life-threatening). Do NOT mention a next exercise.
${midWorkout ? '- They are in the middle of a workout right now. If you offer the next set, say so clearly in the same reply.\n' : ''}
Example: "I've had a headache since this morning" → "Oh no, sorry your head is bugging you. Headaches are really common up here while fluids shift, so try sipping some water. Is it mild or pretty rough?"

${latest ? `Latest vitals: HR ${latest.heartRate ?? '—'}, temp ${latest.temperatureC ?? '—'}°C.` : 'No vitals yet.'}
Always end with present_turn: one text block (plus measure_prompt blocks when checking vitals), emotion "sad" for discomfort or "happy" when they feel better, next_state "${ctx.coachState}" unless told otherwise above.`
}

function historyToClaude(history: ChatMessage[]): ClaudeMessage[] {
  const recent = history.slice(-8)
  const out: ClaudeMessage[] = []
  for (const m of recent) {
    if (m.role !== 'user' && m.role !== 'assistant') continue
    out.push({ role: m.role, content: m.content.slice(0, 400) })
  }
  return out
}

function asEmotion(v: unknown): AvatarEmotion | undefined {
  return typeof v === 'string' && EMOTIONS.includes(v as AvatarEmotion)
    ? (v as AvatarEmotion)
    : undefined
}

function asMood(v: unknown): AvatarMood | undefined {
  return typeof v === 'string' && MOODS.includes(v as AvatarMood) ? (v as AvatarMood) : undefined
}

function asState(v: unknown, fallback: CoachState): CoachState {
  return typeof v === 'string' && STATES.includes(v as CoachState) ? (v as CoachState) : fallback
}

function asTriage(v: unknown): TriageLevel {
  if (v === 'monitor' || v === 'urgent' || v === 'emergency' || v === 'info') return v
  return 'info'
}

function parseMeasureKind(v: unknown): MeasureKind {
  if (v === 'temperature' || v === 'strength' || v === 'heart_rate') return v
  return 'heart_rate'
}

interface PresentPayload {
  speak: string
  emotion?: AvatarEmotion
  mood?: AvatarMood
  next_state: CoachState
  triage: TriageLevel
  blocks: MessageBlock[]
}

/** Instant first step — no Claude round-trip, saves tokens/TTS. */
export function startRoutineLocal(): AgentTurnResult {
  const text = "Let's get started. Please measure your body temperature."
  return {
    content: text,
    speakText: text,
    blocks: [
      { type: 'text', text },
      {
        type: 'measure_prompt',
        prompt: {
          kind: 'temperature',
          title: 'Temperature',
          hint: 'Enter your body temperature in °C.',
          unit: '°C',
          source: 'manual',
          starterText: 'My temperature is ',
        },
      },
    ],
    avatarEmotion: 'excited',
    avatarMood: 'happy',
    coachState: 'collect_vitals',
    routineSlot: 0,
    triageLevel: 'info',
    loggedVitals: false,
  }
}

export async function runCoachTurn(ctx: RunContext): Promise<AgentTurnResult> {
  const intent = classifyMessage(ctx.userText)
  const extracted = extractVitalsFromText(ctx.userText)
  const merged = mergeVitals(ctx.vitals[0], extracted)
  const wordLimit = CHAT_INTENTS.has(intent) ? MAX_CHAT_WORDS : MAX_SPEAK_WORDS

  if (intent === 'start_routine') {
    return startRoutineLocal()
  }

  // Vital readings: fixed local templates + exercise after HR — never Claude
  if (extracted) {
    const local = await buildVitalReply(
      isCriticalVitals(merged) ? merged : extracted,
      ctx.coachState,
      {
        crewName: ctx.crewName,
        exerciseApiKey: ctx.keys.exerciseApiKey,
        routineSlot: ctx.routineSlot ?? 0,
      },
    )
    if (local) return local
  }

  const inventory = await resolveStationEquipment(ctx.keys.exerciseApiKey)
  const exerciseCache = new Map<string, MessageBlock>()
  let presented: PresentPayload | null = null

  const chatMode = CHAT_INTENTS.has(intent)
  const messages: ClaudeMessage[] = [
    ...historyToClaude(ctx.history),
    {
      role: 'user',
      content: chatMode
        ? ctx.userText
        : extracted
          ? `${ctx.userText}\n\n[Parsed vitals: ${JSON.stringify(extracted)}] [intent: ${intent}]`
          : `${ctx.userText}\n\n[intent: ${intent}]`,
    },
  ]

  for (let round = 0; round < 5; round++) {
    const response = await createMessage(ctx.keys.claudeApiKey, {
      system: chatMode ? chatPrompt(ctx) : systemPrompt(ctx, inventory, intent),
      messages,
      tools: chatMode ? TOOLS.filter((t) => t.name === 'present_turn') : TOOLS,
      max_tokens: 700,
    })

    const toolUses = response.content.filter((b) => b.type === 'tool_use')
    if (toolUses.length === 0) {
      const text = clampWords(
        response.content
          .filter((b) => b.type === 'text' && b.text)
          .map((b) => b.text)
          .join(' ')
          .trim() || 'Standing by.',
        wordLimit,
      )
      return {
        content: text,
        speakText: text,
        blocks: [{ type: 'text', text }],
        avatarEmotion: 'happy',
        avatarMood: 'neutral',
        coachState: ctx.coachState,
        triageLevel: 'info',
        loggedVitals: extracted != null,
      }
    }

    messages.push({ role: 'assistant', content: response.content })

    const toolResults: ClaudeContentBlock[] = []
    for (const call of toolUses) {
      const name = call.name ?? ''
      const input = (call.input ?? {}) as Record<string, unknown>
      let result: unknown = { ok: true }

      try {
        if (name === 'search_microg_exercises') {
          if (!ctx.keys.exerciseApiKey) {
            result = { error: 'Exercise API key missing in Settings' }
          } else {
            const equipmentRaw = String(input.equipment ?? 'cable').toLowerCase()
            const equipment = inventory.includes(equipmentRaw)
              ? equipmentRaw
              : inventory[0] ?? 'cable'
            const cards = await searchMicroGExercises(ctx.keys.exerciseApiKey, {
              q: typeof input.q === 'string' ? input.q : undefined,
              muscle: typeof input.muscle === 'string' ? input.muscle : undefined,
              equipment,
              preferVideo: input.prefer_video !== false,
              limit: 4,
            })
            for (const c of cards) {
              exerciseCache.set(c.id, { type: 'exercise', exercise: c })
            }
            result = {
              count: cards.length,
              note: 'Only exercises with demo media are listed. Pick one of these ids.',
              exercises: cards.map((c) => ({
                id: c.id,
                name: c.name,
                equipment: c.equipment,
                hasVideo: Boolean(c.videoUrl),
                hasImage: Boolean(c.imageUrl),
              })),
            }
          }
        } else if (name === 'get_exercise') {
          if (!ctx.keys.exerciseApiKey) {
            result = { error: 'Exercise API key missing in Settings' }
          } else {
            const id = String(input.id ?? '')
            const card = await getExercise(ctx.keys.exerciseApiKey, id)
            exerciseCache.set(card.id, { type: 'exercise', exercise: card })
            result = {
              id: card.id,
              name: card.name,
              equipment: card.equipment,
              hasVideo: Boolean(card.videoUrl),
              tip: card.exerciseTips[0],
            }
          }
        } else if (name === 'present_turn') {
          const rawBlocks = Array.isArray(input.blocks) ? input.blocks : []
          const blocks: MessageBlock[] = []
          for (const raw of rawBlocks) {
            if (!raw || typeof raw !== 'object') continue
            const b = raw as Record<string, unknown>
            const type = b.type
            if (type === 'text' && typeof b.text === 'string' && b.text.trim()) {
              blocks.push({ type: 'text', text: clampWords(b.text.trim(), wordLimit) })
            } else if (type === 'exercise') {
              const id = String(b.exercise_id ?? '')
              let block = exerciseCache.get(id)
              if (!block && ctx.keys.exerciseApiKey && id) {
                try {
                  const card = await getExercise(ctx.keys.exerciseApiKey, id)
                  block = { type: 'exercise', exercise: card }
                  exerciseCache.set(id, block)
                } catch {
                  block = undefined
                }
              }
              // Never show a media-less card — swap in any cached demo or re-search
              const mediaOk =
                block?.type === 'exercise' && hasExerciseMedia(block.exercise)
              if (mediaOk && block) {
                blocks.push(block)
              } else if (ctx.keys.exerciseApiKey) {
                const withMedia = [...exerciseCache.values()].find(
                  (b) => b.type === 'exercise' && hasExerciseMedia(b.exercise),
                )
                if (withMedia) {
                  blocks.push(withMedia)
                } else {
                  const cards = await searchMicroGExercises(ctx.keys.exerciseApiKey, {
                    equipment: inventory[0] ?? 'cable',
                    preferVideo: true,
                    limit: 4,
                  })
                  const pick = cards[0]
                  if (pick) {
                    const replacement: MessageBlock = { type: 'exercise', exercise: pick }
                    exerciseCache.set(pick.id, replacement)
                    blocks.push(replacement)
                  }
                }
              }
            } else if (type === 'nutrition') {
              const foodName =
                typeof b.food_name === 'string' && b.food_name.trim()
                  ? b.food_name.trim()
                  : 'Food item'
              blocks.push({
                type: 'nutrition',
                food: {
                  name: foodName,
                  calories100g: Number(b.calories_100g) || 0,
                  protein100g: Number(b.protein_100g) || 0,
                  carbs100g: Number(b.carbs_100g) || 0,
                  fat100g: Number(b.fat_100g) || 0,
                  fiber100g:
                    b.fiber_100g !== undefined ? Number(b.fiber_100g) || 0 : undefined,
                  servingLabel:
                    typeof b.serving_label === 'string' ? b.serving_label : 'est. per 100 g',
                  estimated: true,
                  note:
                    typeof b.estimate_note === 'string'
                      ? clampWords(b.estimate_note, 12)
                      : 'Coach estimate only.',
                },
              })
            } else if (type === 'measure_prompt') {
              const kind = parseMeasureKind(b.measure_kind)
              const defaults: Record<
                MeasureKind,
                { title: string; hint: string; unit: string; starter: string }
              > = {
                heart_rate: {
                  title: 'Heart rate',
                  hint: 'Enter your pulse in beats per minute.',
                  unit: 'bpm',
                  starter: 'My heart rate is ',
                },
                temperature: {
                  title: 'Temperature',
                  hint: 'Enter your body temperature in °C.',
                  unit: '°C',
                  starter: 'My temperature is ',
                },
                strength: {
                  title: 'Strength test',
                  hint: 'Grip assessment game, or enter reps.',
                  unit: 'reps',
                  starter: 'Grip strength reps ',
                },
              }
              const d = defaults[kind]
              blocks.push({
                type: 'measure_prompt',
                prompt: {
                  kind,
                  title: typeof b.title === 'string' ? b.title : d.title,
                  hint: typeof b.hint === 'string' ? b.hint : d.hint,
                  unit: d.unit,
                  source: 'manual',
                  starterText:
                    typeof b.starter_text === 'string' ? b.starter_text : d.starter,
                },
              })
            }
          }

          presented = {
            speak: clampWords(String(input.speak ?? ''), wordLimit),
            emotion: asEmotion(input.emotion),
            mood: asMood(input.mood),
            next_state: asState(input.next_state, ctx.coachState),
            triage: asTriage(input.triage),
            blocks:
              blocks.length > 0
                ? blocks
                : [
                    {
                      type: 'text',
                      text: clampWords(String(input.speak ?? 'Acknowledged.'), wordLimit),
                    },
                  ],
          }
          result = { ok: true, delivered: true }
        } else {
          result = { error: `Unknown tool ${name}` }
        }
      } catch (err) {
        result = { error: err instanceof Error ? err.message : String(err) }
      }

      toolResults.push({
        type: 'tool_result',
        tool_use_id: call.id,
        content: JSON.stringify(result).slice(0, 6000),
      })
    }

    messages.push({ role: 'user', content: toolResults })
    if (presented) break
  }

  if (!presented) {
    return {
      content: 'Check API keys, then retry.',
      speakText: 'Check API keys, then retry.',
      blocks: [{ type: 'text', text: 'Check API keys, then retry.' }],
      avatarEmotion: 'sad',
      avatarMood: 'sad',
      coachState: ctx.coachState,
      triageLevel: 'monitor',
      loggedVitals: extracted != null,
    }
  }

  const textParts = presented.blocks
    .filter((b): b is Extract<MessageBlock, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
  const content = textParts.join('\n\n') || presented.speak

  return {
    content,
    // Speak what the bubble shows so voice and text never disagree
    speakText: textParts.length > 0 ? content : presented.speak,
    blocks: presented.blocks,
    avatarEmotion: presented.emotion,
    avatarMood: presented.mood,
    coachState: presented.next_state,
    triageLevel: presented.triage,
    loggedVitals: extracted != null,
  }
}

export { getClaudeApiKey as resolveClaudeKey }
