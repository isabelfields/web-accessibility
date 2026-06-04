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
      <svg className="w-[15px] h-[15px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6zM4 14a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1v-5z" />
      </svg>
    ),
  },
  {
    href: '/sites',
    label: 'Sites',
    icon: (
      <svg className="w-[15px] h-[15px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
    ),
  },
  {
    href: '/schedules',
    label: 'Schedules',
    icon: (
      <svg className="w-[15px] h-[15px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#0c0c10] text-white antialiased">
        <Providers>
          <div className="flex min-h-screen">
            {/* Sidebar — dark, minimal */}
            <aside className="w-[200px] flex flex-col fixed inset-y-0 left-0 z-10 bg-[#0c0c10] border-r border-[#1c1c24]">
              {/* Logo */}
              <div className="px-4 pt-5 pb-4 border-b border-[#1c1c24]">
                <div className="flex items-center gap-2.5">
                  <img
                    src="/hearst-logo.svg"
                    alt="Hearst"
                    className="h-5 w-auto brightness-0 invert opacity-90"
                  />
                  <div className="w-px h-4 bg-[#2a2a36]" />
                  <span className="text-[10px] text-[#505068] font-semibold tracking-[0.12em] uppercase">A11y</span>
                </div>
              </div>

              {/* Nav */}
              <nav className="flex-1 px-2 py-3 space-y-0.5">
                {NAV.map(({ href, label, icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium text-white hover:text-white hover:bg-[#16161e] transition-all group"
                  >
                    <span className="text-[#505068] group-hover:text-white/70 transition-colors">{icon}</span>
                    <span className="text-white/90 group-hover:text-white">{label}</span>
                  </Link>
                ))}
              </nav>

              {/* Footer */}
              <div className="px-4 py-4 border-t border-[#1c1c24]">
                <SignOutButton />
                <div className="text-[10px] text-white/40 mt-1.5">© Hearst Communications</div>
              </div>
            </aside>

            {/* Main */}
            <main className="flex-1 ml-[200px] min-h-screen">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  )
}
