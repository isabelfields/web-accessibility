'use client'

import { useState } from 'react'
import type { ViolationPattern } from '@/types'
import { impactToTier, TIER_COLOR, TIER_LABEL } from '@/lib/tiers'

const WCAG_RULES: Record<string, { name: string; wcag: string; what: string }> = {
  'html-has-lang':           { name: 'Page Language',           wcag: 'WCAG 3.1.1 (A)',   what: "The page must declare its language so screen readers pronounce words correctly." },
  'image-alt':               { name: 'Image Alt Text',           wcag: 'WCAG 1.1.1 (A)',   what: 'Images must have a text description so screen reader users know what the image shows.' },
  'color-contrast':          { name: 'Color Contrast',           wcag: 'WCAG 1.4.3 (AA)',  what: 'Text must have a contrast ratio of at least 4.5:1 (normal text) or 3:1 (large text) against its background.' },
  'color-contrast-enhanced': { name: 'Color Contrast (AAA)',     wcag: 'WCAG 1.4.6 (AAA)', what: 'Enhanced contrast: 7:1 for normal text, 4.5:1 for large text.' },
  'button-name':             { name: 'Button Label',             wcag: 'WCAG 4.1.2 (A)',   what: 'Buttons must have an accessible name so screen reader users know what the button does.' },
  'label':                   { name: 'Form Field Label',         wcag: 'WCAG 1.3.1 (A)',   what: 'Form inputs must have labels so screen reader users know what information to enter.' },
  'link-name':               { name: 'Link Text',                wcag: 'WCAG 2.4.4 (A)',   what: 'Links must have descriptive text so screen reader users understand where the link goes.' },
  'aria-required-attr':      { name: 'Missing ARIA Attribute',   wcag: 'WCAG 4.1.2 (A)',   what: 'An ARIA role is present but a required attribute is missing, breaking screen reader announcements.' },
  'aria-valid-attr-value':   { name: 'Invalid ARIA Value',       wcag: 'WCAG 4.1.2 (A)',   what: 'An ARIA attribute has an invalid value, which can confuse assistive technology.' },
  'aria-required-children':  { name: 'Missing ARIA Children',    wcag: 'WCAG 4.1.2 (A)',   what: 'Certain ARIA roles require specific child roles that are missing.' },
  'document-title':          { name: 'Page Title',               wcag: 'WCAG 2.4.2 (A)',   what: 'Every page must have a descriptive title so users know which page they are on.' },
  'frame-title':             { name: 'Frame / iFrame Label',     wcag: 'WCAG 2.4.1 (A)',   what: 'Frames and iframes must have a title so screen reader users understand their purpose.' },
  'heading-order':           { name: 'Heading Structure',        wcag: 'WCAG 1.3.1 (A)',   what: 'Headings must follow a logical order (H1 → H2 → H3) so screen reader users can navigate structure.' },
  'landmark-one-main':       { name: 'Main Landmark',            wcag: 'WCAG 1.3.1 (A)',   what: 'Every page should have exactly one main landmark element.' },
  'region':                  { name: 'Page Regions',             wcag: 'WCAG 1.3.1 (A)',   what: 'All content should be contained within landmark regions (header, main, footer, nav).' },
  'select-name':             { name: 'Dropdown Label',           wcag: 'WCAG 1.3.1 (A)',   what: 'Dropdown menus must have labels so screen reader users know what to select.' },
  'tabindex':                { name: 'Tab Order',                wcag: 'WCAG 2.4.3 (A)',   what: 'tabindex values > 0 disrupt the natural keyboard navigation order.' },
  'video-caption':           { name: 'Video Captions',           wcag: 'WCAG 1.2.2 (AA)',  what: 'Videos must have captions so deaf users can access the audio content.' },
  'input-image-alt':         { name: 'Image Button Alt Text',    wcag: 'WCAG 1.1.1 (A)',   what: 'Image buttons must have alt text describing the button action.' },
}

function getRuleInfo(rule: string) {
  return WCAG_RULES[rule] ?? { name: rule, wcag: 'WCAG 2.2 AA', what: null }
}

function pagePath(url: string) {
  try { return new URL(url).pathname || '/' } catch { return url }
}

function truncateHtml(html: string, max = 120) {
  const single = html.replace(/\s+/g, ' ').trim()
  return single.length > max ? single.slice(0, max) + '…' : single
}

const SHOW_LIMIT = 5

export function ViolationCard({ pattern }: { pattern: ViolationPattern }) {
  const [open, setOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const tier = impactToTier(pattern.impact)
  const c = TIER_COLOR[tier]
  const tierLabel = TIER_LABEL[tier]
  const ruleInfo = getRuleInfo(pattern.rule)
  const instanceCount = pattern.occurrences
  const pageCount = pattern.affectedPages?.length ?? 1

  const nodes = pattern.nodes?.length > 0
    ? pattern.nodes
    : pattern.sampleHtml
      ? [{ html: pattern.sampleHtml, url: pattern.affectedPages?.[0] ?? '', screenshot: undefined }]
      : []

  const visibleNodes = showAll ? nodes : nodes.slice(0, SHOW_LIMIT)
  const hiddenCount = nodes.length - SHOW_LIMIT

  return (
    <div className={`bg-white border border-[#E5E5EA] border-l-[3px] rounded-lg overflow-hidden`}
      style={{ borderLeftColor: c.hex }}>

      {/* ── Collapsed header row ── */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-[#F5F5F7] transition-colors"
      >
        <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-md ${c.bg} ${c.text} ring-1 ring-inset ${c.border}`}>
          {tierLabel}
        </span>
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-[#1D1D1F] text-sm">{ruleInfo.name}</span>
          <span className="text-xs text-[#6B7280] ml-2 bg-[#F5F5F7] px-1.5 py-0.5 rounded">{ruleInfo.wcag}</span>
          <span className="text-xs text-[#6B7280] mx-1.5">·</span>
          <span className="text-xs text-[#6B7280] truncate">{pattern.description}</span>
        </div>
        <div className="hidden sm:flex items-center gap-5 shrink-0 text-right">
          <div>
            <div className="text-sm font-semibold text-[#1D1D1F] tabular-nums">{instanceCount}</div>
            <div className="text-[10px] text-[#86868B] uppercase tracking-wide">instance{instanceCount !== 1 ? 's' : ''}</div>
          </div>
          <div>
            <div className="text-sm font-semibold text-[#1D1D1F] tabular-nums">{pageCount}</div>
            <div className="text-[10px] text-[#86868B] uppercase tracking-wide">page{pageCount !== 1 ? 's' : ''}</div>
          </div>
        </div>
        <svg className={`shrink-0 w-4 h-4 text-[#86868B] transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* ── Expanded body ── */}
      {open && (
        <div className="border-t border-[#E5E5EA]">

          {/* What it means */}
          <div className="px-5 pt-4 pb-3">
            <p className="text-sm text-[#3A3A3C] leading-relaxed">{ruleInfo.what ?? pattern.description}</p>
          </div>

          {/* How to fix */}
          {pattern.fixSuggestion && (
            <div className="mx-5 mb-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex gap-3">
              <svg className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <div className="text-xs font-semibold text-blue-600 mb-0.5 uppercase tracking-wide">How to fix</div>
                <p className="text-sm text-[#3A3A3C] leading-relaxed">{pattern.fixSuggestion}</p>
              </div>
            </div>
          )}

          {/* Failing elements */}
          {nodes.length > 0 && (
            <div className="border-t border-[#E5E5EA]">
              <div className="px-5 py-2.5 flex items-center justify-between">
                <span className="text-xs font-semibold text-[#86868B] uppercase tracking-wider">
                  Failing elements · {nodes.length}
                </span>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#E5E5EA] bg-[#F5F5F7]">
                    <th className="text-left px-4 py-1.5 text-[10px] font-semibold text-[#86868B] uppercase tracking-wider w-8">#</th>
                    <th className="text-left px-3 py-1.5 text-[10px] font-semibold text-[#86868B] uppercase tracking-wider w-36">Page</th>
                    <th className="text-left px-3 py-1.5 text-[10px] font-semibold text-[#86868B] uppercase tracking-wider">Element</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5F5F7]">
                  {visibleNodes.map((node, i) => (
                    <tr key={i} className="hover:bg-[#F5F5F7]">
                      <td className="px-4 py-2 text-[#86868B] font-mono">{i + 1}</td>
                      <td className="px-3 py-2">
                        {node.url ? (
                          <a href={node.url} target="_blank" rel="noopener noreferrer"
                            className="text-[#007AFF] hover:underline font-mono truncate block max-w-[140px]"
                            title={node.url}>
                            {pagePath(node.url)}
                          </a>
                        ) : <span className="text-[#86868B]">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        <code className="font-mono text-[#3A3A3C] bg-[#F5F5F7] px-1.5 py-0.5 rounded text-[11px] break-all">
                          {truncateHtml(node.html)}
                        </code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {hiddenCount > 0 && !showAll && (
                <button
                  onClick={() => setShowAll(true)}
                  className="w-full text-center text-xs text-[#6B7280] hover:text-[#1D1D1F] py-2 border-t border-[#E5E5EA] hover:bg-[#F5F5F7] transition-colors"
                >
                  + {hiddenCount} more element{hiddenCount !== 1 ? 's' : ''}
                </button>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="px-5 py-2.5 border-t border-[#E5E5EA] flex items-center justify-between bg-[#F5F5F7]">
            <span className="text-[11px] font-mono text-[#86868B]">{pattern.rule}</span>
            <a
              href={`https://dequeuniversity.com/rules/axe/4.10/${pattern.rule}?application=axeAPI`}
              target="_blank" rel="noopener noreferrer"
              className="text-xs font-medium text-[#007AFF] hover:underline"
            >
              View WCAG guidance →
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

