'use client'

import { signOut } from 'next-auth/react'

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/login' })}
      className="text-[11px] text-[#4a4f66] hover:text-[#8b8fa8] transition-colors font-medium"
    >
      Sign out
    </button>
  )
}
