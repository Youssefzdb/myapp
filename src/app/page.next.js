import { headers } from 'next/headers'

export default async function HomePage() {
  const headerStore = await headers()
  const host = headerStore.get('host') || 'localhost'

  return (
    <main style={{ minHeight: '100vh', padding: 32, fontFamily: 'system-ui, sans-serif' }}>
      <h1>Vibe Studio</h1>
      <p>تم تجهيز بنية Next.js server-side للذكاء الاصطناعي ومساحة العمل.</p>
      <p style={{ color: '#666' }}>الخادم الحالي: {host}</p>
    </main>
  )
}
