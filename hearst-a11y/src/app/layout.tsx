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
      <body className="bg-[#f4f5f7] text-gray-900">
        <Providers>
          <div className="flex min-h-screen">
            {/* Dark sidebar */}
            <aside className="w-[220px] flex flex-col fixed inset-y-0 left-0 z-10 bg-[#0e0f14] border-r border-[#1e2028]">
              {/* Logo */}
              <div className="px-5 py-5 border-b border-[#1e2028]">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-md bg-brand-500 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-white leading-tight">Hearst A11y</div>
                    <div className="text-[10px] text-[#4a4f66] uppercase tracking-widest font-medium">Monitor</div>
                  </div>
                </div>
              </div>

              {/* Nav */}
              <nav className="flex-1 px-3 py-3 space-y-0.5">
                <div className="text-[10px] font-semibold text-[#3a3f55] uppercase tracking-widest px-2 py-2">Navigation</div>
                {NAV.map(({ href, label, icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium text-[#8b8fa8] hover:bg-[#1a1d26] hover:text-[#c8cce0] transition-colors group"
                  >
                    <span className="text-[#4a4f66] group-hover:text-[#8b8fa8] transition-colors">{icon}</span>
                    {label}
                  </Link>
                ))}
              </nav>

              {/* Footer */}
              <div className="px-4 py-4 border-t border-[#1e2028]">
                <SignOutButton />
                <div className="text-[11px] text-[#3a3f55] mt-1.5">© Hearst Communications</div>
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
