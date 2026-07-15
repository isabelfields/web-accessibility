'use client'

import { signOut } from 'next-auth/react'

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/login' })}
      className="text-[11px] text-[#3A6FB5] hover:text-[#1D1D1F] transition-colors font-medium"
    >
      Sign out
    </button>
  )
}
