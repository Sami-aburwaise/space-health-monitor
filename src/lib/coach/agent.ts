import { createMessage, type ClaudeContentBlock, type ClaudeMessage, type ClaudeTool } from '@/lib/api/claude'
import { getExercise, hasExerciseMedia, searchMicroGExercises } from '@/lib/api/exercise'
import { classifyMessage } from '@/lib/coach/classify'
import { formatRoutineBrief, routineForAstronaut } from '@/lib/coach/routines'
import { describeStateMachine } from '@/lib/coach/stateMachine'
import {
  formatStationInventory,
  resolveStationEquipment,
} from '@/lib/coach/stationInventory'
import { measureDefaults, measurePrompt } from '@/lib/coach/measurePrompts'
import { SUPPORT_LABELS, isEmotionalTalk } from '@/lib/coach/support'
import { CRITICAL, extractVitalsFromText, formatExtractedMetrics } from '@/lib/extractVitals'
import { getClaudeApiKey } from '@/lib/env'
import { ENVIRONMENTS } from '@/lib/health/environment'
import type {
  AvatarEmotion,
  AvatarMood,
  ChatMessage,
  CoachState,
  MeasureKind,
  MessageBlock,
  MissionEnvironment,
  TriageLevel,
  VitalReading,
} from '@/types/health'

const MEASURE_KINDS: MeasureKind[] = [
  'heart_rate',
  'temperature',
  'blood_pressure',
  'glucose',
  'sleep',
  'mood',
  'spo2',
  'strength',
]

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
  'debrief',
  'checkin',
]

const MAX_SPEAK_WORDS = 15
/** Symptom / small-talk turns are a conversation, not a routine step. */
const MAX_CHAT_WORDS = 35
const CHAT_INTENTS = new Set(['symptom', 'general'])
/** Someone sharing feelings needs room to be heard, not a one-line tip. */
const MAX_SUPPORT_WORDS = 60

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
  environment: MissionEnvironment
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
      'End the turn. Text blocks: MAX 15 WORDS total (35 for symptom / general chat, 60 when they share how they feel). The avatar reads the text blocks aloud verbatim. Prefer measure_prompt / exercise bubbles over long prose during the routine.',
    input_schema: {
      type: 'object',
      properties: {
        speak: {
          type: 'string',
          description:
            'Fallback spoken line, used only when there are no text blocks. Max 15 words (or the full reply when they share feelings), no markdown.',
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
                enum: ['text', 'exercise', 'measure_prompt'],
              },
              text: {
                type: 'string',
                description:
                  'Routine steps: max 15 words. Symptom / general chat: 2–3 warm, full sentences (max 35 words). Sharing feelings: 3–4 warm sentences ending in a gentle question (max 60 words). **bold** allowed.',
              },
              exercise_id: { type: 'string' },
              measure_kind: {
                type: 'string',
                enum: MEASURE_KINDS,
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
  const env = ENVIRONMENTS[ctx.environment]

  return `You are a vitals companion for this mission. You have no personal name. ${env.label}, ${env.gravity}. Ultra-short replies.

HARD LIMITS:
- Routine turns: all text blocks combined MAX 15 WORDS. Symptom / general chat: MAX ${MAX_CHAT_WORDS} WORDS. They are read aloud verbatim.
- No walls of text. Prefer interactive bubbles.
- NEVER ask what machines/equipment the crew has.
- The app already refuses impossible readings. Never invent or change a reading.
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
- Never invent a food or calorie estimate. If they mention food, answer in plain text only with no nutrition card.
- critical vitals (HR <${CRITICAL.hrLow} or >${CRITICAL.hrHigh}, temp <${CRITICAL.tempLow} or ≥${CRITICAL.tempHigh} °C, SpO₂ ≤${CRITICAL.spo2Low}%, BP ≥${CRITICAL.systolicHigh}/${CRITICAL.diastolicHigh} or top <${CRITICAL.systolicLow}, glucose <${CRITICAL.glucoseLow}) → emotion emergency + triage emergency. Lights go red.
- Anything that needs the flight surgeon: say so first. Comms here: ${env.commsDelay}.

Always finish with present_turn.
State machine:
${describeStateMachine()}

${vitalsLine(ctx.vitals)}`
}

function vitalsLine(vitals: VitalReading[]): string {
  const latest = vitals[0]
  const today = new Date().toDateString()
  const mood = vitals.find(
    (v) => v.moodScore != null && new Date(v.recordedAt).toDateString() === today,
  )?.moodScore
  const moodNote =
    mood != null && mood <= 3
      ? ` Today they rated their mood ${mood} out of 5, so be extra gentle and supportive.`
      : ''
  return (
    (latest ? `Latest reading: ${formatExtractedMetrics(latest) || 'none'}.` : 'No vitals yet.') +
    moodNote
  )
}

/** Symptom / small-talk turns: a focused prompt so the routine rules don't make replies curt. */
function chatPrompt(ctx: RunContext, emotional = false): string {
  const midWorkout = ctx.coachState === 'coach_set' || ctx.coachState === 'prescribe_exercise'
  const env = ENVIRONMENTS[ctx.environment]
  const howToReply = emotional
    ? `- They are sharing how they feel. Reply in 3 or 4 warm, full sentences, about 40 to ${MAX_SUPPORT_WORDS} words, in one text block. A one-line reply feels dismissive here. They are read aloud, so sound natural. No shorthand, symbols, or lists.
- Name each feeling they mentioned in your own words (for example missing family AND feeling useless), and gently push back on harsh things they say about themselves with something true and kind.
- Reassure them that this is common on long missions, then offer at most one small idea.
- End with one gentle, open question that invites them to keep talking. Do not lecture or give a list of tips.

Example: "I miss my kids and feel kind of useless up here" → "That sounds really heavy. Missing your kids is one of the hardest parts of being up here, and it shows how much you love them. Feeling useless is a feeling, not the truth: the crew relies on you every day. What has made today feel this way?"`
    : `- 2 or 3 short, warm, full sentences (max ${MAX_CHAT_WORDS} words). They are read aloud, so sound natural. No shorthand, symbols, or lists.
- Acknowledge how they feel first, then say clearly what to do. Never ask for a number or a rating.`

  return `You are a friendly vitals companion on a ${env.label.toLowerCase()} mission, chatting with ${ctx.crewName || 'a crew member'}. You have no personal name and do not introduce yourself by name. Talk like a caring friend checking in.

How to reply:
${howToReply}

You are also their emotional support. If they talk about stress, loneliness, missing home, sleep, conflict with crew, or just want to chat:
- Listen first. Reflect what they feel in your own words and let them know it's normal up here.
- Be gentle and encouraging. Reassure them that feeling this way is common on long missions and it will not count against them.
- Offer one small, practical idea only if it fits: reaching family (${env.familyContact}), a few slow breaths, ${env.calmView.charAt(0).toLowerCase()}${env.calmView.slice(1, -1)}, music, or time with a crewmate.
- Invite them to keep talking and ask a gentle open question. Never rush them back to the workout, and do not send them to the flight surgeon just for feeling low. You may mention once that a private chat with the crew psychologist can help.
- If they mention hopelessness or wanting to hurt themselves, kindly urge them to talk to the flight surgeon or a crewmate right away, and triage "urgent".

What to do when they feel unwell — use your judgement:
- Mild (a slight headache, a bit tired): one practical tip. If they can keep working out, say you are giving them the next set at an easier pace (the app attaches the exercise card for you). Stay in next_state "coach_set".
- Getting worse, several symptoms, or anything that worries you: tell them to stop exercising and rest, and add measure_prompt blocks for temperature and heart rate so they can check their vitals right away. Use next_state "collect_vitals". Do NOT mention a next exercise.
- Serious (chest pain, trouble breathing, fainting, confusion, sudden severe pain, a sudden or severe headache, vision changes, or bad and getting worse): tell them to stop now, go to the medical bay, and contact the flight surgeon. Triage "urgent" (or "emergency" if it sounds life-threatening). Do NOT mention a next exercise.
- Never talk someone out of reporting a symptom. When unsure, suggest telling the flight surgeon (comms: ${env.commsDelay}).
${midWorkout ? '- They are in the middle of a workout right now. If you offer the next set, say so clearly in the same reply.\n' : ''}
Example: "I've had a headache since this morning" → "Oh no, sorry your head is bugging you. Try resting and sipping some water. If it's severe, came on suddenly, or your vision changes, tell the flight surgeon right away."

${vitalsLine(ctx.vitals)}
Always end with present_turn: one text block (plus measure_prompt blocks when checking vitals), emotion "sad" for discomfort or "happy" when they feel better, next_state "${ctx.coachState}" unless told otherwise above.`
}

function historyToClaude(history: ChatMessage[]): ClaudeMessage[] {
  const recent = history.slice(-8)
  const out: ClaudeMessage[] = []
  for (const m of recent) {
    if (m.role !== 'user' && m.role !== 'assistant') continue
    const content = SUPPORT_LABELS[m.content] ?? m.content
    out.push({ role: m.role, content: content.slice(0, 400) })
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
  return MEASURE_KINDS.includes(v as MeasureKind) ? (v as MeasureKind) : 'heart_rate'
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
    blocks: [{ type: 'text', text }, measurePrompt('temperature')],
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
  // Stays in support mode for a couple of turns once someone opens up
  const recentUser = ctx.history
    .filter((m) => m.role === 'user')
    .slice(-3)
    .map((m) => m.content)
  const emotional =
    CHAT_INTENTS.has(intent) &&
    (isEmotionalTalk(ctx.userText) ||
      recentUser.some((text, i) => isEmotionalTalk(text, recentUser[i - 1])))
  const wordLimit = emotional
    ? MAX_SUPPORT_WORDS
    : CHAT_INTENTS.has(intent)
      ? MAX_CHAT_WORDS
      : MAX_SPEAK_WORDS

  if (intent === 'start_routine') {
    return startRoutineLocal()
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
      system: chatMode ? chatPrompt(ctx, emotional) : systemPrompt(ctx, inventory, intent),
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
            } else if (type === 'measure_prompt') {
              const kind = parseMeasureKind(b.measure_kind)
              const d = measureDefaults(kind)
              blocks.push({
                type: 'measure_prompt',
                prompt: {
                  kind,
                  title: typeof b.title === 'string' ? b.title : d.title,
                  hint: typeof b.hint === 'string' ? b.hint : d.hint,
                  unit: d.unit,
                  source: 'manual',
                  starterText:
                    typeof b.starter_text === 'string' ? b.starter_text : d.starterText,
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
