import type { Metadata } from 'next'
import Link from 'next/link'
import { SignOutButton } from '@/components/SignOutButton'
import { Providers } from '@/components/Providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'Hearst A11y — Accessibility Monitor',
  description: 'Web accessibility audit dashboard for Hearst properties',
}

const NAV = [
  {
    href: '/',
    label: 'Dashboard',
    icon: (
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6zM4 14a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1v-5z" />
      </svg>
    ),
  },
  {
    href: '/sites',
    label: 'Sites',
    icon: (
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
    ),
  },
  {
    href: '/schedules',
    label: 'Schedules',
    icon: (
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#f0f2f5] text-gray-900">
        <Providers>
          <div className="flex min-h-screen">
            {/* Sidebar — brand blue */}
            <aside className="w-[220px] flex flex-col fixed inset-y-0 left-0 z-10 bg-brand-500">
              {/* Logo */}
              <div className="px-5 pt-6 pb-5">
                <img
                  src="/hearst-logo.svg"
                  alt="Hearst"
                  className="h-6 w-auto brightness-0 invert mb-1"
                />
                <div className="text-[10px] text-blue-200 font-semibold tracking-[0.15em] uppercase opacity-80">
                  Accessibility Monitor
                </div>
              </div>

              {/* Nav */}
              <nav className="flex-1 px-3 py-2 space-y-0.5">
                {NAV.map(({ href, label, icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium text-blue-100 hover:bg-white/10 hover:text-white transition-colors group"
                  >
                    <span className="opacity-70 group-hover:opacity-100 transition-opacity">{icon}</span>
                    {label}
                  </Link>
                ))}
              </nav>

              {/* Footer */}
              <div className="px-5 py-4 border-t border-white/10">
                <SignOutButton />
                <div className="text-[11px] text-blue-300/60 mt-1.5">© Hearst Communications</div>
              </div>
            </aside>

            {/* Main */}
            <main className="flex-1 ml-[220px] min-h-screen">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  )
}
