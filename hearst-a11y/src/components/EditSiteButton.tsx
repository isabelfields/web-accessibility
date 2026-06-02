'use client'

import { useState } from 'react'
import { EditSiteForm } from './EditSiteForm'

interface SitePage {
  url: string
  label: string
  templateType: 'homepage' | 'article' | 'gallery' | 'category' | 'commerce' | 'video' | 'search' | 'other'
}

interface Site {
  id: string
  name: string
  division?: string
  pages: SitePage[]
}

export function EditSiteButton({ site }: { site: Site }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        Edit Site
      </button>
      {open && (
        <EditSiteForm site={site} onClose={() => setOpen(false)} />
      )}
    </>
  )
}
