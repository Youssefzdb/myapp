export async function runAgentLoop(options = {}) {
  const response = await fetch('/api/agent', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt: options.prompt,
      task: options.task,
      history: options.history,
      files: options.files,
      model: options.model,
      effort: options.effort,
      referenceImages: options.referenceImages,
    }),
    signal: options.signal,
  })
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.error || 'Agent request failed')
  for (const event of payload.events || []) options.onEvent?.(event)
  return payload.result
}
