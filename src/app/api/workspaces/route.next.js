import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

function getAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase server configuration is missing')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function authenticatedUser(request, supabase) {
  const authorization = request.headers.get('authorization')
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!token) return null
  const { data: { user } } = await supabase.auth.getUser(token)
  return user
}

export async function GET(request) {
  try {
    const supabase = getAdminClient()
    const user = await authenticatedUser(request, supabase)
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    const { data, error } = await supabase
      .from('builder_projects')
      .select('id,title,model,created_at,updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
    if (error) throw error
    return NextResponse.json({ projects: data ?? [] })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Workspace request failed' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const supabase = getAdminClient()
    const user = await authenticatedUser(request, supabase)
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    const body = await request.json()
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 120) : 'Untitled project'
    const model = typeof body.model === 'string' ? body.model.slice(0, 160) : null
    const { data, error } = await supabase
      .from('builder_projects')
      .insert({ user_id: user.id, title, model })
      .select('id,title,model,created_at,updated_at')
      .single()
    if (error) throw error
    return NextResponse.json({ project: data }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Workspace creation failed' }, { status: 500 })
  }
}
