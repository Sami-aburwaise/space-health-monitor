/** Cheap, fast model for the agentic coach loop */
export const CLAUDE_MODEL = 'claude-haiku-4-5-20251001'

export type ClaudeRole = 'user' | 'assistant'

export interface ClaudeContentBlock {
  type: string
  text?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
  tool_use_id?: string
  content?: string | unknown
  is_error?: boolean
}

export interface ClaudeMessage {
  role: ClaudeRole
  content: string | ClaudeContentBlock[]
}

export interface ClaudeTool {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

export interface ClaudeResponse {
  id: string
  stop_reason: string | null
  content: ClaudeContentBlock[]
}

export async function createMessage(
  apiKey: string,
  body: {
    system: string
    messages: ClaudeMessage[]
    tools?: ClaudeTool[]
    max_tokens?: number
  },
): Promise<ClaudeResponse> {
  const res = await fetch('/proxy/anthropic/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      // Required by Anthropic when calling from browsers / non-official SDKs via proxy
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: body.max_tokens ?? 1600,
      system: body.system,
      messages: body.messages,
      tools: body.tools,
    }),
  })

  if (!res.ok) {
    let detail = res.statusText
    try {
      const err = await res.json()
      detail = err?.error?.message || detail
    } catch {
      /* ignore */
    }
    throw new Error(`Claude ${res.status}: ${detail}`)
  }

  return res.json() as Promise<ClaudeResponse>
}
