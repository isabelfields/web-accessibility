'use client'

import { signOut } from 'next-auth/react'

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/login' })}
      className="text-[11px] text-blue-600 hover:text-blue-800 transition-colors font-medium"
    >
      Sign out
    </button>
  )
}
