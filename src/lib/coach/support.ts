import type { VitalReply } from '@/lib/coach/vitalReplies'
import { ENVIRONMENTS } from '@/lib/health/environment'
import type { ChoiceData, CoachState, MessageBlock, MissionEnvironment } from '@/types/health'

export const SUPPORT_TALK_CMD = '[SUPPORT_TALK]'
export const SUPPORT_FAMILY_CMD = '[SUPPORT_FAMILY]'
export const SUPPORT_CALM_CMD = '[SUPPORT_CALM]'

export const SUPPORT_LABELS: Record<string, string> = {
  [SUPPORT_TALK_CMD]: 'I’d like to talk',
  [SUPPORT_FAMILY_CMD]: 'Help me reach my family',
  [SUPPORT_CALM_CMD]: 'Something to feel a bit better',
}

const TALK: ChoiceData = { label: 'Talk with me', message: SUPPORT_TALK_CMD }
const FAMILY: ChoiceData = { label: 'Reach my family', message: SUPPORT_FAMILY_CMD }
const CALM: ChoiceData = { label: 'Something calming', message: SUPPORT_CALM_CMD }

export const SAFETY_LINE =
  'If you ever have thoughts of hurting yourself, tell the flight surgeon or a crewmate straight away. You will not be in trouble, and they will help.'

function turn(text: string, extra: MessageBlock[], coachState: CoachState, spoken = text): VitalReply {
  return {
    content: text,
    speakText: spoken,
    blocks: [{ type: 'text', text }, ...extra],
    avatarEmotion: 'sad',
    avatarMood: 'sad',
    coachState,
    triageLevel: 'monitor',
    loggedVitals: false,
  }
}

/** Blocks for a mood of 3 or lower: warmth first, then gentle options. */
export function moodSupportBlocks(score: number): { spoken: string; blocks: MessageBlock[] } {
  if (score <= 2) {
    const spoken =
      'I’m really sorry you’re feeling low today. Thank you for telling me. You don’t have to carry this on your own up here, and I’m right here to listen for as long as you like. What would help most right now?'
    return {
      spoken,
      blocks: [
        { type: 'text', text: spoken },
        {
          type: 'text',
          text: `When you feel ready, a private chat with the crew psychologist can really help. It is confidential, and it is exactly what they are there for. ${SAFETY_LINE}`,
        },
        { type: 'choices', choices: [TALK, FAMILY, CALM] },
      ],
    }
  }
  const spoken =
    'Sounds like a so-so day, and that is completely normal on a long mission. Want to talk it through, or do something small that might lift you a little?'
  return {
    spoken,
    blocks: [{ type: 'text', text: spoken }, { type: 'choices', choices: [TALK, FAMILY, CALM] }],
  }
}

export type SupportCommand = 'talk' | 'family' | 'calm'

export function supportCommand(text: string): SupportCommand | null {
  if (text === SUPPORT_TALK_CMD) return 'talk'
  if (text === SUPPORT_FAMILY_CMD) return 'family'
  if (text === SUPPORT_CALM_CMD) return 'calm'
  return null
}

const SELF_HARM =
  /\b(kill\s+myself|suicid\w*|end\s+(it|my\s+life)|hurt\s+myself|self[\s-]?harm|don'?t\s+want\s+to\s+(live|be\s+here))\b/i
const LOW_FEELING =
  /\b(sad|low|down|lonely|alone|homesick|miss(ing)?\s+(home|my|family|them)|stress(ed)?|anxious|anxiety|worried|depress\w*|upset|overwhelmed|hopeless|cry(ing)?|not\s+ok(ay)?|talk)\b/i

/** True when the message is about feelings (or is a reply to a support button). */
export function isEmotionalTalk(text: string, previousUserText?: string): boolean {
  return (
    SELF_HARM.test(text) ||
    LOW_FEELING.test(text) ||
    previousUserText === SUPPORT_TALK_CMD ||
    /\b(useless|worthless|tired of|can'?t\s+cope|lost|scared|afraid|angry|frustrated|bored|exhausted)\b/i.test(text)
  )
}

/** Offline reply when the crew shares feelings and no Claude key is set; null when it is not about feelings. */
export function buildOfflineSupport(
  text: string,
  coachState: CoachState,
): VitalReply | null {
  if (SELF_HARM.test(text)) {
    return {
      ...turn(
        'I’m really glad you told me, and I want you to be safe. Please tell the flight surgeon or a crewmate right now, and stay with someone. You matter, and help is there for you.',
        [],
        coachState,
      ),
      triageLevel: 'urgent',
    }
  }
  if (!isEmotionalTalk(text)) return null
  return turn(
    'Thank you for telling me. That sounds really hard, and it is completely normal to feel this way so far from home. I’m right here, so tell me more whenever you’re ready.',
    [{ type: 'choices', choices: [FAMILY, CALM] }],
    coachState,
  )
}

/** Local reply to a support button, so it works without a Claude key. */
export function buildSupportReply(
  command: SupportCommand,
  environment: MissionEnvironment,
  coachState: CoachState,
): VitalReply {
  const env = ENVIRONMENTS[environment]
  if (command === 'talk') {
    return turn(
      'I’m all ears. What has been on your mind? It can be anything: home, the crew, the work, or just feeling flat for no clear reason. Take your time.',
      [],
      coachState,
    )
  }
  if (command === 'family') {
    const text = `${env.familyContact} Even a few minutes with a familiar voice can change the whole day. Would you like to talk with me in the meantime?`
    return turn(text, [{ type: 'choices', choices: [TALK, CALM] }], coachState)
  }
  const text = [
    'Let’s slow things down together. Breathe in for 4 counts, hold for 4, and breathe out slowly for 6. Do that five times.',
    `Then pick one small thing: ${env.calmView.charAt(0).toLowerCase()}${env.calmView.slice(1, -1)}, put on a song you love, or watch something with a crewmate.`,
  ].join('\n')
  return turn(
    text,
    [{ type: 'choices', choices: [TALK, FAMILY] }],
    coachState,
    'Let’s slow things down together. Breathe in for 4, hold for 4, and breathe out slowly for 6. Do that five times, then pick one small thing you enjoy.',
  )
}
