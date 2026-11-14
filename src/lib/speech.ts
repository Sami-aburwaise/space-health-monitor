const SKIPPED_LINE_PREFIXES = ['Disclaimer', 'Local context']

const REPLACEMENTS: [RegExp, string][] = [
  [/(\d{2,3})\s*\/\s*(\d{2,3})/g, '$1 over $2'],
  [/\bHR\b/g, 'heart rate'],
  [/\bBP\b/g, 'blood pressure'],
  [/SpO₂|SpO2/gi, 'oxygen saturation'],
  [/\bbpm\b/gi, 'beats per minute'],
  [/\bmmHg\b/gi, 'millimeters of mercury'],
  [/°\s*C\b/g, ' degrees Celsius'],
  [/\bkg\b/g, 'kilograms'],
  [/[→·—]/g, ', '],
]

/** Turn an assistant reply into text that reads naturally through speech synthesis. */
export function toSpeakableText(content: string): string {
  let text = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !SKIPPED_LINE_PREFIXES.some((p) => line.startsWith(p)))
    .join(' ')

  for (const [pattern, replacement] of REPLACEMENTS) {
    text = text.replace(pattern, replacement)
  }

  return text.replace(/\s+,/g, ',').replace(/\s{2,}/g, ' ').trim()
}

/** Chrome cuts off long utterances, so speech is queued sentence by sentence. */
export function splitForSpeech(text: string, maxLength = 180): string[] {
  const sentences = text.match(/[^.!?]+[.!?]*/g) ?? [text]
  const chunks: string[] = []

  for (const sentence of sentences) {
    const trimmed = sentence.trim()
    if (!trimmed) continue
    const last = chunks[chunks.length - 1]
    if (last && last.length + trimmed.length + 1 <= maxLength) {
      chunks[chunks.length - 1] = `${last} ${trimmed}`
    } else {
      chunks.push(trimmed)
    }
  }

  return chunks
}
