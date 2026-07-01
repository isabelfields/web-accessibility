import type { Metadata } from 'next'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { SignOutButton } from '@/components/SignOutButton'
import './globals.css'

export const metadata: Metadata = {
  title: 'Hearst A11y — Accessibility Monitor',
  description: 'Web accessibility audit dashboard for Hearst properties',
}

const navLink = "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium text-[#3A3A3C] hover:bg-[#F5F5F7] hover:text-[#1D1D1F] transition-colors"

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  const isAdmin = session?.user?.role === 'admin'

  return (
    <html lang="en">
      <body className="bg-[#F5F5F7] text-[#1D1D1F] antialiased">
        <div className="app-layout flex min-h-screen">
          {/* Sidebar */}
          <aside className="app-sidebar w-56 flex flex-col fixed inset-y-0 left-0 z-10 bg-white border-r border-[#E5E5EA]">
            {/* Logo */}
            <div className="app-sidebar-logo h-24 px-5 border-b border-[#E5E5EA] flex flex-col justify-center">
              <img src="/hearst-logo.svg" alt="Hearst" className="h-6 w-auto" />
              <div className="text-[10px] text-[#57575A] font-semibold tracking-[0.15em] uppercase mt-1.5">
                Accessibility Monitor
              </div>
            </div>

            <nav className="app-nav flex-1 px-3 py-3 space-y-0.5">
              <Link href="/" className={navLink}>
                <svg className="w-4 h-4 shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6zM4 14a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1v-5z" />
                </svg>
                Dashboard
              </Link>
              <Link href="/sites" className={navLink}>
                <svg className="w-4 h-4 shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
                Sites
              </Link>
              <Link href="/schedules" className={navLink}>
                <svg className="w-4 h-4 shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Schedules
              </Link>

              {isAdmin && (
                <>
                  <div className="pt-4 pb-1 px-3">
                    <span className="text-[10px] font-semibold text-[#57575A] uppercase tracking-widest">Admin</span>
                  </div>
                  <Link href="/admin/resolutions" className={navLink}>
                    <svg className="w-4 h-4 shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 17l6-6 4 4 7-7m0 0h-5m5 0v5" />
                    </svg>
                    Resolutions
                  </Link>
                  <Link href="/admin/users" className={navLink}>
                    <svg className="w-4 h-4 shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Users
                  </Link>
                  <Link href="/admin/costs" className={navLink}>
                    <svg className="w-4 h-4 shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Usage & Cost
                  </Link>
                </>
              )}
            </nav>

            <div className="app-sidebar-footer px-5 py-4 border-t border-[#E5E5EA] space-y-2">
              {session?.user?.email && (
                <div className="text-xs text-[#57575A] truncate" title={session.user.email}>
                  {session.user.email}
                  {isAdmin && <span className="ml-1 text-blue-600 font-medium">· admin</span>}
                </div>
              )}
              <SignOutButton />
              <div className="text-[10px] text-[#57575A]">© Hearst Communications</div>
            </div>
          </aside>

          <main className="app-main flex-1 ml-56 min-h-screen bg-[#F5F5F7]">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
