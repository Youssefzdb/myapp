import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 300

const UPSTREAM = process.env.OPENCODE_BASE_URL || 'https://superagent-2b61d5b9.base44.app/functions'

async function proxy(request, { params }) {
  const { path } = await params
  const target = `${UPSTREAM.replace(/\/$/, '')}/${path.join('/')}`
  const headers = new Headers()
  const contentType = request.headers.get('content-type')
  const accept = request.headers.get('accept')
  if (contentType) headers.set('content-type', contentType)
  if (accept) headers.set('accept', accept)

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer(),
      signal: request.signal,
      cache: 'no-store',
    })

    const responseHeaders = new Headers()
    for (const key of ['content-type', 'cache-control', 'x-accel-buffering', 'content-encoding']) {
      const value = upstream.headers.get(key)
      if (value) responseHeaders.set(key, value)
    }
    responseHeaders.set('x-opencode-proxy', 'vercel')
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'OpenCode upstream request failed' },
      { status: 502 },
    )
  }
}

export const GET = proxy
export const POST = proxy
export const PUT = proxy
export const PATCH = proxy
export const DELETE = proxy
