import '../index.css'

export const metadata = {
  title: 'Vibe Studio',
  description: 'Server-side AI workspace',
}

export default function RootLayout({ children }) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>
}
