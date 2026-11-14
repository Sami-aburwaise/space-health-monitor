/** API keys and voice id come only from Vite env (`.env.local`) — never Settings UI. */

function env(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name]
  return typeof value === 'string' ? value.trim() : ''
}

export function getClaudeApiKey(): string {
  return env('VITE_CLAUDE_API_KEY')
}

export function getElevenLabsApiKey(): string {
  return env('VITE_ELEVENLABS_API_KEY')
}

export function getElevenLabsVoiceId(): string {
  return env('VITE_ELEVENLABS_VOICE_ID')
}

export function getExerciseApiKey(): string {
  return env('VITE_EXERCISE_API_KEY')
}
