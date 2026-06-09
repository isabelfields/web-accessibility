'use client'

import { useState } from 'react'
import type { ViolationPattern } from '@/types'

const IMPACT_CONFIG: Record<string, {
  label: string
  badgeClass: string
  borderWidth: string
  borderColor: string
}> = {
  critical: {
    label: 'Critical',
    badgeClass: 'badge-t1',
    borderWidth: '4px',
    borderColor: '#C8002A',
  },
  serious: {
    label: 'Serious',
    badgeClass: 'badge-t2',
    borderWidth: '2px',
    borderColor: '#D4600A',
  },
  moderate: {
    label: 'Moderate',
    badgeClass: 'badge-t3',
    borderWidth: '1px',
    borderColor: '#B08400',
  },
  minor: {
    label: 'Minor',
    badgeClass: 'badge-t4',
    borderWidth: '1px',
    borderColor: '#3A7D44',
  },
}

const WCAG_RULES: Record<string, { name: string; wcag: string; what: string }> = {
  'html-has-lang':           { name: 'Page Language',           wcag: 'WCAG 3.1.1 A',   what: "The page must declare its language so screen readers pronounce words correctly." },
  'image-alt':               { name: 'Image Alt Text',           wcag: 'WCAG 1.1.1 A',   what: 'Images must have a text description so screen reader users know what the image shows.' },
  'color-contrast':          { name: 'Color Contrast',           wcag: 'WCAG 1.4.3 AA',  what: 'Text must have a contrast ratio of at least 4.5:1 (normal text) or 3:1 (large text) against its background.' },
  'color-contrast-enhanced': { name: 'Color Contrast (AAA)',     wcag: 'WCAG 1.4.6 AAA', what: 'Enhanced contrast: 7:1 for normal text, 4.5:1 for large text.' },
  'button-name':             { name: 'Button Label',             wcag: 'WCAG 4.1.2 A',   what: 'Buttons must have an accessible name so screen reader users know what the button does.' },
  'label':                   { name: 'Form Field Label',         wcag: 'WCAG 1.3.1 A',   what: 'Form inputs must have labels so screen reader users know what information to enter.' },
  'link-name':               { name: 'Link Text',                wcag: 'WCAG 2.4.4 A',   what: 'Links must have descriptive text so screen reader users understand where the link goes.' },
  'aria-required-attr':      { name: 'Missing ARIA Attribute',   wcag: 'WCAG 4.1.2 A',   what: 'An ARIA role is present but a required attribute is missing, breaking screen reader announcements.' },
  'aria-valid-attr-value':   { name: 'Invalid ARIA Value',       wcag: 'WCAG 4.1.2 A',   what: 'An ARIA attribute has an invalid value, which can confuse assistive technology.' },
  'aria-required-children':  { name: 'Missing ARIA Children',    wcag: 'WCAG 4.1.2 A',   what: 'Certain ARIA roles require specific child roles that are missing.' },
  'document-title':          { name: 'Page Title',               wcag: 'WCAG 2.4.2 A',   what: 'Every page must have a descriptive title so users know which page they are on.' },
  'frame-title':             { name: 'Frame / iFrame Label',     wcag: 'WCAG 2.4.1 A',   what: 'Frames and iframes must have a title so screen reader users understand their purpose.' },
  'heading-order':           { name: 'Heading Structure',        wcag: 'WCAG 1.3.1 A',   what: 'Headings must follow a logical order (H1 → H2 → H3) so screen reader users can navigate structure.' },
  'landmark-one-main':       { name: 'Main Landmark',            wcag: 'WCAG 1.3.1 A',   what: 'Every page should have exactly one main landmark element.' },
  'region':                  { name: 'Page Regions',             wcag: 'WCAG 1.3.1 A',   what: 'All content should be contained within landmark regions (header, main, footer, nav).' },
  'select-name':             { name: 'Dropdown Label',           wcag: 'WCAG 1.3.1 A',   what: 'Dropdown menus must have labels so screen reader users know what to select.' },
  'tabindex':                { name: 'Tab Order',                wcag: 'WCAG 2.4.3 A',   what: 'tabindex values > 0 disrupt the natural keyboard navigation order.' },
  'video-caption':           { name: 'Video Captions',           wcag: 'WCAG 1.2.2 AA',  what: 'Videos must have captions so deaf users can access the audio content.' },
  'input-image-alt':         { name: 'Image Button Alt Text',    wcag: 'WCAG 1.1.1 A',   what: 'Image buttons must have alt text describing the button action.' },
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

  const cfg = IMPACT_CONFIG[pattern.impact] ?? IMPACT_CONFIG.minor
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
    <div
      className="overflow-hidden"
      style={{
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
        borderLeft: `${cfg.borderWidth} solid ${cfg.borderColor}`,
        borderRadius: 'var(--radius-md)',
      }}
    >
      {/* Collapsed header */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full text-left px-5 py-3.5 flex items-center gap-3 transition-colors"
        style={{ background: 'transparent' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-elevated)' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
      >
        <span className={cfg.badgeClass}>{cfg.label}</span>

        <div className="flex-1 min-w-0">
          <span className="font-semibold text-[14px]" style={{ color: 'var(--color-text-primary)' }}>
            {ruleInfo.name}
          </span>
          <span
            className="mono text-[11px] ml-2 px-1.5 py-0.5 rounded"
            style={{
              color: 'var(--color-text-muted)',
              background: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border)',
            }}
          >
            {ruleInfo.wcag}
          </span>
          <span className="mx-1.5 text-[13px]" style={{ color: 'var(--color-border-strong)' }}>·</span>
          <span className="text-[13px] truncate" style={{ color: 'var(--color-text-secondary)' }}>
            {pattern.description}
          </span>
        </div>

        {/* Right: instance + page counts */}
        <div className="hidden sm:flex items-center gap-1 shrink-0 text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
          <span className="mono font-semibold" style={{ color: 'var(--color-text-primary)' }}>{instanceCount}</span>
          <span>instance{instanceCount !== 1 ? 's' : ''}</span>
          <span className="mx-1" style={{ color: 'var(--color-border-strong)' }}>·</span>
          <span className="mono font-semibold" style={{ color: 'var(--color-text-primary)' }}>{pageCount}</span>
          <span>page{pageCount !== 1 ? 's' : ''}</span>
        </div>

        <svg
          className={`shrink-0 w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`}
          style={{ color: 'var(--color-text-muted)' }}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded body */}
      {open && (
        <div style={{ borderTop: '1px solid var(--color-border)' }}>

          {/* What it means */}
          <div className="px-5 pt-4 pb-3">
            <p className="text-[14px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              {ruleInfo.what ?? pattern.description}
            </p>
          </div>

          {/* How to fix */}
          {pattern.fixSuggestion && (
            <div
              className="mx-5 mb-4 rounded-lg px-4 py-3 flex gap-3"
              style={{
                background: 'rgba(0,87,184,0.06)',
                border: '1px solid rgba(0,87,184,0.18)',
              }}
            >
              <svg className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--color-hearst-blue)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--color-hearst-blue)' }}>
                  How to fix
                </div>
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  {pattern.fixSuggestion}
                </p>
              </div>
            </div>
          )}

          {/* Failing elements */}
          {nodes.length > 0 && (
            <div style={{ borderTop: '1px solid var(--color-border)' }}>
              <div className="px-5 py-2.5 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                  Failing elements · {nodes.length}
                </span>
              </div>
              <table className="w-full text-[12px]">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-elevated)' }}>
                    <th scope="col" className="text-left px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider w-8" style={{ color: 'var(--color-text-muted)' }}>#</th>
                    <th scope="col" className="text-left px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider w-36" style={{ color: 'var(--color-text-muted)' }}>Page</th>
                    <th scope="col" className="text-left px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Element</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleNodes.map((node, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td className="px-4 py-2 mono" style={{ color: 'var(--color-text-muted)' }}>{i + 1}</td>
                      <td className="px-3 py-2">
                        {node.url ? (
                          <a
                            href={node.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mono hover:underline truncate block max-w-[140px]"
                            style={{ color: 'var(--color-hearst-blue)' }}
                            title={node.url}
                          >
                            {pagePath(node.url)}
                          </a>
                        ) : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                      </td>
                      <td className="px-3 py-2">
                        <code
                          className="mono text-[11px] px-1.5 py-0.5 rounded break-all"
                          style={{
                            color: 'var(--color-text-secondary)',
                            background: 'var(--color-bg-elevated)',
                            border: '1px solid var(--color-border)',
                          }}
                        >
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
                  className="w-full text-center text-[13px] py-2.5 transition-colors"
                  style={{
                    color: 'var(--color-text-muted)',
                    borderTop: '1px solid var(--color-border)',
                    background: 'transparent',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-elevated)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  + {hiddenCount} more element{hiddenCount !== 1 ? 's' : ''}
                </button>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="px-5 py-2.5 flex items-center justify-between" style={{ borderTop: '1px solid var(--color-border)' }}>
            <span className="mono text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{pattern.rule}</span>
            <a
              href={`https://dequeuniversity.com/rules/axe/4.10/${pattern.rule}?application=axeAPI`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] font-medium hover:underline"
              style={{ color: 'var(--color-hearst-blue)' }}
            >
              View WCAG guidance →
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
