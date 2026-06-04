'use client'

import { signOut } from 'next-auth/react'

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/login' })}
      className="text-[11px] text-blue-200/70 hover:text-white transition-colors font-medium"
    >
      Sign out
    </button>
  )
}
