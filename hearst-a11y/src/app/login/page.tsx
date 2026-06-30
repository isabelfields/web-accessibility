'use client'

import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'


function EyeIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M2.25 12s3.75-6.75 9.75-6.75S21.75 12 21.75 12 18 18.75 12 18.75 2.25 12 2.25 12z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 3l18 18" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58M9.88 5.42A8.87 8.87 0 0112 5.25c6 0 9.75 6.75 9.75 6.75a17.1 17.1 0 01-2.68 3.37M6.7 6.7C3.9 8.54 2.25 12 2.25 12S6 18.75 12 18.75c1.52 0 2.89-.43 4.08-1.06" />
    </svg>
  )
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [invited, setInvited] = useState(false)
  const [showEmail, setShowEmail] = useState(true)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    setInvited(new URLSearchParams(window.location.search).get('invited') === '1')
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const res = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })
    if (res?.ok) {
      // Full-page navigation so the freshly-set session cookie is sent with
      // the request — a soft router.push can race the cookie and get bounced
      // back to /login by middleware, making it look like login failed.
      window.location.href = '/'
      return
    }
    setLoading(false)
    setError('Invalid email or password.')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F7]">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-xl font-semibold tracking-tight text-[#1D1D1F]">Hearst A11y</div>
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
            <div className="relative">
              <input
                id="email"
                type={showEmail ? 'text' : 'password'}
                autoComplete="username"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full rounded-lg border border-[#E5E5EA] bg-white px-3 py-2 pr-10 text-sm text-[#1D1D1F] placeholder:text-[#A1A1A6] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowEmail(current => !current)}
                aria-label={showEmail ? 'Hide email' : 'Show email'}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-[#57575A] hover:text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              >
                {showEmail ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[#1D1D1F] mb-1.5">Password</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-[#E5E5EA] bg-white px-3 py-2 pr-10 text-sm text-[#1D1D1F] placeholder:text-[#A1A1A6] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(current => !current)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-[#57575A] hover:text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
