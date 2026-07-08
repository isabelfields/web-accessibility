'use client'

import { useState, useEffect } from 'react'

interface SAMLConnection {
  clientID: string
  clientSecret: string
  forceAuthn: boolean
  idpMetadata?: {
    entityID?: string
    loginType?: string
    provider?: string
  }
  createdAt?: number
  updatedAt?: number
}

export default function SAMLPage() {
  const [connections, setConnections] = useState<SAMLConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [metadataXml, setMetadataXml] = useState('')
  const [metadataUrl, setMetadataUrl] = useState('')
  const [adding, setAdding] = useState(false)
  const [spMetadataUrl, setSpMetadataUrl] = useState('')

  useEffect(() => {
    setSpMetadataUrl(`${window.location.origin}/api/auth/saml/metadata`)
    fetchConnections()
  }, [])

  async function fetchConnections() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/saml/connections')
      if (!res.ok) throw new Error(await res.text())
      setConnections(await res.json())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/admin/saml/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metadataXml: metadataXml || undefined, metadataUrl: metadataUrl || undefined }),
      })
      if (!res.ok) {
        const text = await res.text()
        let msg = res.statusText
        try { msg = JSON.parse(text).error ?? text } catch { msg = text || res.statusText }
        throw new Error(msg)
      }
      setSuccess('SAML connection created successfully.')
      setMetadataXml('')
      setMetadataUrl('')
      await fetchConnections()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(clientID: string) {
    if (!confirm('Delete this SAML connection? SSO logins will stop working immediately.')) return
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/admin/saml/connections', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientID }),
      })
      if (!res.ok) {
        const text = await res.text()
        let msg = res.statusText
        try { msg = JSON.parse(text).error ?? text } catch { msg = text || res.statusText }
        throw new Error(msg)
      }
      setSuccess('Connection deleted.')
      await fetchConnections()
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function handleFixRedirects(clientID: string) {
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/admin/saml/connections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientID }),
      })
      if (!res.ok) {
        const text = await res.text()
        let msg = res.statusText
        try { msg = JSON.parse(text).error ?? text } catch { msg = text || res.statusText }
        throw new Error(msg)
      }
      setSuccess('Redirect URLs updated. Try SSO login again.')
      await fetchConnections()
    } catch (e: any) {
      setError(e.message)
    }
  }

  const acsUrl = spMetadataUrl.replace('/metadata', '/callback')

  return (
    <div style={{ padding: '32px', maxWidth: 800 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1D1D1F', marginBottom: 4 }}>SAML / Okta SSO</h1>
      <p style={{ fontSize: 13, color: '#57575A', marginBottom: 28 }}>
        Configure SAML 2.0 single sign-on using Okta as the Identity Provider.
      </p>

      {/* SP Config — what you enter in Okta */}
      <section style={{ background: '#F0F4FF', border: '1px solid #C7D7FF', borderRadius: 12, padding: '20px 24px', marginBottom: 28 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#002D82', marginBottom: 12 }}>
          Step 1 — Configure the Hearst A11y app in Okta
        </div>
        <p style={{ fontSize: 12, color: '#1D1D1F', marginBottom: 12 }}>
          Create a new SAML 2.0 application in Okta and use these values:
        </p>
        <div style={{ display: 'grid', gap: 8 }}>
          <ConfigRow label="Single sign-on URL (ACS URL)" value={acsUrl} />
          <ConfigRow label="Audience URI (SP Entity ID)" value={spMetadataUrl} />
          <ConfigRow label="Name ID format" value="EmailAddress" />
          <ConfigRow label="Application username" value="Email" />
        </div>
        <p style={{ fontSize: 11, color: '#57575A', marginTop: 12 }}>
          After saving in Okta, download the <strong>Identity Provider metadata XML</strong> (or copy the metadata URL) and paste it below.
        </p>
      </section>

      {/* Add connection */}
      <section style={{ background: '#fff', border: '1px solid #E5E5EA', borderRadius: 12, padding: '20px 24px', marginBottom: 28 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1D1D1F', marginBottom: 16 }}>
          Step 2 — Register Okta&apos;s SAML metadata
        </div>
        <form onSubmit={handleAdd} style={{ display: 'grid', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#1D1D1F', display: 'block', marginBottom: 6 }}>
              Option A — Paste Okta metadata XML
            </label>
            <textarea
              value={metadataXml}
              onChange={e => setMetadataXml(e.target.value)}
              placeholder="<?xml version=&quot;1.0&quot;?>&#10;<EntityDescriptor ...>"
              rows={6}
              style={{ width: '100%', fontFamily: 'monospace', fontSize: 11, padding: '8px 10px', borderRadius: 8, border: '1px solid #E5E5EA', resize: 'vertical', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ textAlign: 'center', fontSize: 12, color: '#A1A1A6' }}>— or —</div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#1D1D1F', display: 'block', marginBottom: 6 }}>
              Option B — Okta metadata URL
            </label>
            <input
              type="url"
              value={metadataUrl}
              onChange={e => setMetadataUrl(e.target.value)}
              placeholder="https://your-org.okta.com/app/.../metadata"
              style={{ width: '100%', fontSize: 12, padding: '8px 10px', borderRadius: 8, border: '1px solid #E5E5EA', boxSizing: 'border-box' }}
            />
          </div>
          {error && <p style={{ color: '#DC2626', fontSize: 12 }}>{error}</p>}
          {success && <p style={{ color: '#059669', fontSize: 12 }}>{success}</p>}
          <button
            type="submit"
            disabled={adding || (!metadataXml && !metadataUrl)}
            style={{ alignSelf: 'start', padding: '8px 20px', borderRadius: 8, background: '#007AFF', color: '#fff', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', opacity: (adding || (!metadataXml && !metadataUrl)) ? 0.5 : 1 }}
          >
            {adding ? 'Saving…' : 'Save SAML connection'}
          </button>
        </form>
      </section>

      {/* Existing connections */}
      <section>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#57575A', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
          Active connections
        </div>
        {loading ? (
          <p style={{ fontSize: 13, color: '#57575A' }}>Loading…</p>
        ) : connections.length === 0 ? (
          <div style={{ background: '#fff', border: '1.5px dashed #D1D1D6', borderRadius: 12, padding: '32px', textAlign: 'center', color: '#57575A', fontSize: 13 }}>
            No SAML connections yet. Add one above to enable Okta SSO.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {connections.map((c) => (
              <div key={c.clientID} style={{ background: '#fff', border: '1px solid #E5E5EA', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1D1D1F' }}>
                    {c.idpMetadata?.provider ?? c.idpMetadata?.entityID ?? 'SAML Connection'}
                  </div>
                  <div style={{ fontSize: 11, color: '#57575A', marginTop: 2, fontFamily: 'monospace' }}>
                    {c.clientID}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, background: '#ECFDF5', color: '#059669', borderRadius: 6, padding: '3px 8px' }}>Active</span>
                  <button
                    onClick={() => handleFixRedirects(c.clientID)}
                    style={{ fontSize: 12, color: '#7C3AED', background: 'none', border: '1px solid #C4B5FD', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}
                    title="Re-sync redirect URLs to current NEXTAUTH_URL"
                  >
                    Fix URLs
                  </button>
                  <button
                    onClick={() => handleDelete(c.clientID)}
                    style={{ fontSize: 12, color: '#DC2626', background: 'none', border: '1px solid #FCA5A5', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr auto', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: '#57575A' }}>{label}</span>
      <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#1D1D1F', background: '#fff', border: '1px solid #C7D7FF', borderRadius: 6, padding: '4px 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
      <button
        onClick={copy}
        style={{ fontSize: 11, color: copied ? '#059669' : '#007AFF', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 600 }}
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  )
}
