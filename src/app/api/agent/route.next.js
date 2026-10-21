import { NextResponse } from 'next/server'
import { runAgentLoop } from '../../../lib/agentLoop.js'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(request) {
  try {
    const body = await request.json()
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
    if (!prompt) return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })

    const events = []
    const result = await runAgentLoop({
      prompt,
      task: prompt,
      history: Array.isArray(body.history) ? body.history.slice(-12) : [],
      files: body.files && typeof body.files === 'object' ? body.files : {},
      model: typeof body.model === 'string' ? body.model : undefined,
      effort: typeof body.effort === 'string' ? body.effort : undefined,
      referenceImages: Array.isArray(body.referenceImages) ? body.referenceImages : [],
      signal: request.signal,
      onEvent: (event) => events.push(event),
    })

    return NextResponse.json({ result, events })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Agent request failed' }, { status: 500 })
  }
}
