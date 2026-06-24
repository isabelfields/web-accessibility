'use client'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E5EA', padding: '32px 40px', maxWidth: 480, textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1D1D1F', marginBottom: 8 }}>Something went wrong</h2>
        <p style={{ fontSize: 13, color: '#57575A', marginBottom: 4 }}>{error.message}</p>
        {error.digest && <p style={{ fontSize: 11, color: '#A1A1A6', marginBottom: 20, fontFamily: 'monospace' }}>Digest: {error.digest}</p>}
        <button
          onClick={reset}
          style={{ padding: '8px 20px', borderRadius: 8, background: '#007AFF', color: '#fff', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }}
        >
          Try again
        </button>
      </div>
    </div>
  )
}
