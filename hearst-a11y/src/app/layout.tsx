import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'

export const metadata: Metadata = {
  title: 'Hearst A11y — Accessibility Monitor',
  description: 'Web accessibility audit dashboard for Hearst properties',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-[#f5f5f7] text-gray-900">
        <div className="flex min-h-screen">
          {/* Sidebar */}
          <aside className="w-56 flex flex-col fixed inset-y-0 left-0 z-10 bg-white border-r border-gray-200">
            {/* Logo strip — Hearst blue */}
            <div className="bg-brand-500 px-6 py-5">
              <img
                src="/hearst-logo.svg"
                alt="Hearst"
                className="h-7 w-auto brightness-0 invert"
              />
              <div className="text-xs text-blue-100 font-medium tracking-widest uppercase mt-1.5 opacity-90">
                Accessibility
              </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 py-4 space-y-0.5">
              <Link
                href="/"
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Dashboard
              </Link>
              <Link
                href="/sites"
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
                Sites
              </Link>
              <Link
                href="/schedules"
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Schedules
              </Link>
            </nav>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100">
              <div className="text-xs text-gray-400">© Hearst Communications</div>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 ml-56 overflow-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
