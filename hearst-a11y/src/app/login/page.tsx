'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const res = await signIn('credentials', {
      username,
      password,
      redirect: false,
    })
    setLoading(false)
    if (res?.ok) {
      router.push('/')
      router.refresh()
    } else {
      setError('Invalid username or password.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F7]">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-xl font-semibold tracking-tight text-[#1D1D1F]">Hearst A11y</div>
          <div className="text-sm text-[#6B6B6B] mt-1">Sign in to continue</div>
        </div>
        <form onSubmit={handleSubmit} className="bg-white border border-[#E5E5EA] rounded-xl p-8 space-y-5 shadow-sm">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-[#1D1D1F] mb-1.5">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
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
        </form>
      </div>
    </div>
  )
}
