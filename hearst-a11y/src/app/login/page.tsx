'use client'

import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [ssoLoading, setSsoLoading] = useState(false)
  const [invited, setInvited] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setInvited(params.get('invited') === '1')
    const urlError = params.get('error')
    if (urlError) setError(decodeURIComponent(urlError))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const res = await signIn('credentials', { email, password, redirect: false })
    if (res?.ok) {
      window.location.href = '/'
      return
    }
    setLoading(false)
    setError('Invalid email or password.')
  }

  async function handleSSO() {
    setSsoLoading(true)
    setError('')
    await signIn('boxyhq-saml', { callbackUrl: '/' })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F7]">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img src="/hearst-logo.svg" alt="Hearst" className="h-8 w-auto mx-auto" />
          <div className="text-sm text-[#57575A] mt-1">Sign in to continue</div>
        </div>
        {invited && (
          <p className="mb-4 text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2 text-center">
            Your account is ready. Sign in with your email and the password you just set.
          </p>
        )}
        <form onSubmit={handleSubmit} className="bg-white border border-[#E5E5EA] rounded-xl p-8 space-y-5 shadow-sm">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[#1D1D1F] mb-1.5">Email</label>
            <input
              id="email"
              type="text"
              autoComplete="username"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full px-3 py-2 rounded-lg border border-[#E5E5EA] bg-white text-[#1D1D1F] placeholder:text-[#A1A1A6] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[#1D1D1F] mb-1.5">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-[#E5E5EA] bg-white text-[#1D1D1F] placeholder:text-[#A1A1A6] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#E5E5EA]" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-2 text-xs text-[#A1A1A6]">or</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSSO}
            disabled={ssoLoading}
            className="w-full py-2 rounded-lg border border-[#E5E5EA] bg-white text-[#1D1D1F] text-sm font-medium hover:bg-[#F5F5F7] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {ssoLoading ? 'Redirecting…' : 'Sign in with Okta SSO'}
          </button>
        </form>
      </div>
    </div>
  )
}
