'use client'

import { useState } from 'react'
import type { ViolationPattern } from '@/types'

const IMPACT: Record<string, { label: string; dot: string; border: string; tag: string }> = {
  critical: { label: 'Critical',  dot: 'bg-red-500',    border: 'border-l-red-500',    tag: 'bg-red-50 text-red-700 ring-red-200' },
  serious:  { label: 'Serious',   dot: 'bg-orange-400', border: 'border-l-orange-400', tag: 'bg-orange-50 text-orange-700 ring-orange-200' },
  moderate: { label: 'Moderate',  dot: 'bg-amber-400',  border: 'border-l-amber-400',  tag: 'bg-amber-50 text-amber-700 ring-amber-200' },
  minor:    { label: 'Minor',     dot: 'bg-blue-400',   border: 'border-l-blue-400',   tag: 'bg-blue-50 text-blue-700 ring-blue-200' },
}

const WCAG_RULES: Record<string, { name: string; wcag: string; what: string }> = {
  'html-has-lang':          { name: 'Page Language',          wcag: 'WCAG 3.1.1 (A)',  what: "The page must declare its language so screen readers pronounce words correctly." },
  'image-alt':              { name: 'Image Alt Text',          wcag: 'WCAG 1.1.1 (A)',  what: 'Images must have a text description so screen reader users know what the image shows.' },
  'color-contrast':         { name: 'Color Contrast',          wcag: 'WCAG 1.4.3 (AA)', what: 'Text must have a contrast ratio of at least 4.5:1 (normal) or 3:1 (large) against its background.' },
  'color-contrast-enhanced':{ name: 'Color Contrast (AAA)',    wcag: 'WCAG 1.4.6 (AAA)',what: 'Enhanced contrast: 7:1 for normal text, 4.5:1 for large text.' },
  'button-name':            { name: 'Button Label',            wcag: 'WCAG 4.1.2 (A)',  what: 'Buttons must have a visible or accessible label so screen reader users know what the button does.' },
  'label':                  { name: 'Form Field Label',        wcag: 'WCAG 1.3.1 (A)',  what: 'Form inputs must have labels so screen reader users know what information to enter.' },
  'link-name':              { name: 'Link Text',               wcag: 'WCAG 2.4.4 (A)',  what: 'Links must have descriptive text so screen reader users understand where the link goes.' },
  'aria-required-attr':     { name: 'Missing ARIA Attribute',  wcag: 'WCAG 4.1.2 (A)',  what: 'An ARIA role is present but a required attribute is missing, which breaks screen reader announcements.' },
  'aria-valid-attr-value':  { name: 'Invalid ARIA Value',      wcag: 'WCAG 4.1.2 (A)',  what: 'An ARIA attribute has an invalid value, which can confuse assistive technology.' },
  'document-title':         { name: 'Page Title',              wcag: 'WCAG 2.4.2 (A)',  what: 'Every page must have a descriptive title so users know which page they are on.' },
  'frame-title':            { name: 'Frame / iFrame Label',    wcag: 'WCAG 2.4.1 (A)',  what: 'Frames and iframes must have a title so screen reader users understand their purpose.' },
  'heading-order':          { name: 'Heading Structure',       wcag: 'WCAG 1.3.1 (A)',  what: 'Headings must follow a logical order (H1 → H2 → H3) so screen reader users can navigate structure.' },
  'landmark-one-main':      { name: 'Main Landmark',           wcag: 'WCAG 1.3.1 (A)',  what: 'Every page should have exactly one main landmark element.' },
  'region':                 { name: 'Page Regions',            wcag: 'WCAG 1.3.1 (A)',  what: 'All content should be contained within landmark regions (header, main, footer, nav).' },
  'select-name':            { name: 'Dropdown Label',          wcag: 'WCAG 1.3.1 (A)',  what: 'Dropdown menus must have labels so screen reader users know what to select.' },
  'tabindex':               { name: 'Tab Order',               wcag: 'WCAG 2.4.3 (A)',  what: 'tabindex values > 0 disrupt the natural keyboard navigation order.' },
  'video-caption':          { name: 'Video Captions',          wcag: 'WCAG 1.2.2 (AA)', what: 'Videos must have captions so deaf users can access the audio content.' },
  'input-image-alt':        { name: 'Image Button Alt Text',   wcag: 'WCAG 1.1.1 (A)',  what: 'Image buttons must have alt text describing the button action.' },
}

function getRuleInfo(rule: string) {
  return WCAG_RULES[rule] ?? { name: rule, wcag: 'WCAG 2.1 AA', what: null }
}

export function ViolationCard({ pattern }: { pattern: ViolationPattern }) {
  const [open, setOpen] = useState(false)
  const impact = IMPACT[pattern.impact] ?? IMPACT.minor
  const ruleInfo = getRuleInfo(pattern.rule)
  const instanceCount = pattern.occurrences
  const pageCount = pattern.affectedPages?.length ?? 1

  return (
    <div className={`bg-white rounded-xl border border-gray-200 border-l-4 ${impact.border} shadow-sm overflow-hidden transition-shadow hover:shadow-md`}>
      {/* Row */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left px-5 py-4 flex items-center gap-4"
      >
        {/* Severity tag */}
        <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ring-1 ${impact.tag}`}>
          {impact.label}
        </span>

        {/* Title + description */}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900 text-sm leading-tight">{ruleInfo.name}</div>
          <div className="text-xs text-gray-400 truncate mt-0.5">{ruleInfo.wcag} · {pattern.description}</div>
        </div>

        {/* Stats */}
        <div className="hidden sm:flex items-center gap-6 shrink-0 text-right">
          <div>
            <div className="text-sm font-semibold text-gray-800">{instanceCount}</div>
            <div className="text-xs text-gray-400">instance{instanceCount !== 1 ? 's' : ''}</div>
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-800">{pageCount}</div>
            <div className="text-xs text-gray-400">page{pageCount !== 1 ? 's' : ''}</div>
          </div>
        </div>

        {/* Chevron */}
        <svg className={`shrink-0 w-4 h-4 text-gray-300 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded */}
      {open && (
        <div className="border-t border-gray-100 divide-y divide-gray-100">
          {/* What this means + fix */}
          <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">What this means</div>
              <p className="text-sm text-gray-700 leading-relaxed">{ruleInfo.what ?? pattern.description}</p>
            </div>
            {pattern.fixSuggestion && (
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">How to fix</div>
                <p className="text-sm text-gray-700 leading-relaxed">{pattern.fixSuggestion}</p>
              </div>
            )}
          </div>

          {/* Failing elements */}
          {(pattern.nodes?.length > 0 || pattern.sampleHtml) && (
            <div className="px-5 py-4">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Failing elements · {pattern.nodes?.length ?? 1}
              </div>
              <div className="space-y-2">
                {(pattern.nodes?.length > 0
                  ? pattern.nodes
                  : [{ html: pattern.sampleHtml ?? '', url: pattern.affectedPages?.[0] ?? '', screenshot: pattern.sampleScreenshot }]
                ).map((node, i) => (
                  <div key={i} className="rounded-lg border border-gray-200 overflow-hidden">
                    {/* Element header */}
                    <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b border-gray-100">
                      <span className="text-xs text-gray-400 font-mono">#{i + 1}</span>
                      {node.url && (() => {
                        try {
                          return (
                            <a href={node.url} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-blue-500 hover:text-blue-700 hover:underline truncate max-w-xs font-mono">
                              {new URL(node.url).pathname || '/'}
                            </a>
                          )
                        } catch { return null }
                      })()}
                    </div>
                    {/* Screenshot */}
                    {node.screenshot && (
                      <div className="p-2 bg-gray-50 border-b border-gray-100">
                        <img
                          src={`data:image/jpeg;base64,${node.screenshot}`}
                          alt={`Element ${i + 1}`}
                          className="max-h-28 rounded object-contain"
                        />
                      </div>
                    )}
                    {/* HTML */}
                    {node.html && (
                      <pre className="text-xs font-mono bg-gray-950 text-emerald-400 px-4 py-3 overflow-x-auto whitespace-pre-wrap break-all m-0 leading-relaxed">
                        {node.html}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Affected pages + rule reference */}
          <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-3">
            {pattern.affectedPages && pattern.affectedPages.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {pattern.affectedPages.map(url => {
                  let path = url
                  try { path = new URL(url).pathname || '/' } catch { /* keep as-is */ }
                  return (
                    <a key={url} href={url} target="_blank" rel="noopener noreferrer"
                      className="text-xs font-mono bg-gray-100 text-gray-600 hover:bg-gray-200 px-2 py-0.5 rounded transition-colors">
                      {path}
                    </a>
                  )
                })}
              </div>
            )}
            <a
              href={`https://dequeuniversity.com/rules/axe/4.10/${pattern.rule}?application=axeAPI`}
              target="_blank" rel="noopener noreferrer"
              className="text-xs text-gray-400 hover:text-blue-600 font-mono ml-auto whitespace-nowrap"
            >
              {pattern.rule} ↗
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
