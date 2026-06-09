import type { Metadata } from 'next'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { SignOutButton } from '@/components/SignOutButton'
import { ThemeToggle } from '@/components/ThemeToggle'
import './globals.css'

export const metadata: Metadata = {
  title: 'Hearst A11y — Accessibility Monitor',
  description: 'Web accessibility audit dashboard for Hearst properties',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  const isAdmin = (session?.user as any)?.role === 'admin'

  return (
    <html lang="en">
      <body className="bg-[var(--color-bg-base)] text-[var(--color-text-primary)] antialiased">
        <div className="flex min-h-screen">
          {/* Sidebar — deep navy, always dark regardless of theme */}
          <aside
            className="w-[220px] flex flex-col fixed inset-y-0 left-0 z-10"
            style={{ background: '#0A1628', boxShadow: '2px 0 20px rgba(10,22,40,0.18)' }}
            aria-label="Application sidebar"
          >
            {/* Logo lockup */}
            <div className="px-5 pt-6 pb-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <img src="/hearst-logo.svg" alt="Hearst" className="h-6 w-auto brightness-0 invert opacity-95" />
              <div
                className="text-[10px] font-semibold tracking-[0.18em] uppercase mt-2"
                style={{ color: 'rgba(255,255,255,0.40)' }}
              >
                Accessibility Monitor
              </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 py-4 space-y-0.5" aria-label="Main navigation">
              <Link href="/" className="sidebar-nav-link">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6zM4 14a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1v-5z" />
                </svg>
                Dashboard
              </Link>
              <Link href="/sites" className="sidebar-nav-link">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
                Sites
              </Link>
              <Link href="/schedules" className="sidebar-nav-link">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Schedules
              </Link>

              {isAdmin && (
                <>
                  <div className="pt-5 pb-1.5 px-3">
                    <span
                      className="text-[10px] font-semibold tracking-[0.12em] uppercase"
                      style={{ color: 'rgba(255,255,255,0.28)' }}
                    >
                      Admin
                    </span>
                  </div>
                  <Link href="/admin/users" className="sidebar-nav-link">
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Users
                  </Link>
                </>
              )}
            </nav>

            {/* Footer */}
            <div className="px-5 py-4 space-y-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              {session?.user?.email && (
                <div
                  className="text-[12px] truncate"
                  style={{ color: 'rgba(255,255,255,0.45)' }}
                  title={session.user.email}
                >
                  {session.user.email}
                  {isAdmin && (
                    <span className="ml-1.5 font-semibold" style={{ color: '#5b9bd6' }}>· admin</span>
                  )}
                </div>
              )}
              <div className="flex items-center justify-between">
                <SignOutButton />
                <ThemeToggle />
              </div>
              <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.22)' }}>
                © Hearst Communications
              </div>
            </div>
          </aside>

          <main className="flex-1 ml-[220px] min-h-screen bg-[var(--color-bg-base)]">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
