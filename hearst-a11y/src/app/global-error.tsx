'use client'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#F5F5F7', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E5EA', padding: '32px 40px', maxWidth: 560, textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1D1D1F', marginBottom: 8 }}>Application error</h2>
          <p style={{ fontSize: 13, color: '#3A3A3C', marginBottom: 8, wordBreak: 'break-word' }}>{error.message}</p>
          {error.digest && <p style={{ fontSize: 11, color: '#86868B', marginBottom: 20, fontFamily: 'monospace' }}>Digest: {error.digest}</p>}
          <button
            onClick={reset}
            style={{ padding: '8px 20px', borderRadius: 8, background: '#007AFF', color: '#fff', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
