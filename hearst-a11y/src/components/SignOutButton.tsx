'use client'

import { signOut } from 'next-auth/react'

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/login' })}
      className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors font-medium"
    >
      Sign out
    </button>
  )
}
