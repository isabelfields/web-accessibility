'use client'

import { useState } from 'react'
import type { ViolationPattern } from '@/types'

const IMPACT: Record<string, { label: string; borderColor: string; pillBg: string; pillText: string; pillBorder: string }> = {
  critical: { label: 'Critical', borderColor: '#002D82', pillBg: 'rgba(0,45,130,0.10)',   pillText: '#002D82', pillBorder: 'rgba(0,45,130,0.25)' },
  serious:  { label: 'Serious',  borderColor: '#005AC8', pillBg: 'rgba(0,90,200,0.10)',   pillText: '#005AC8', pillBorder: 'rgba(0,90,200,0.25)' },
  moderate: { label: 'Moderate', borderColor: '#007AFF', pillBg: 'rgba(0,122,255,0.10)',  pillText: '#007AFF', pillBorder: 'rgba(0,122,255,0.25)' },
  minor:    { label: 'Minor',    borderColor: '#5AC8FA', pillBg: 'rgba(90,200,250,0.12)', pillText: '#0A84CC', pillBorder: 'rgba(90,200,250,0.35)' },
}

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

// Truncate HTML to a single readable line
function truncateHtml(html: string, max = 120) {
  const single = html.replace(/\s+/g, ' ').trim()
  return single.length > max ? single.slice(0, max) + '…' : single
}

const SHOW_LIMIT = 5

export function ViolationCard({ pattern }: { pattern: ViolationPattern }) {
  const [open, setOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const impact = IMPACT[pattern.impact] ?? IMPACT.minor
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
    <div style={{
      background: '#FFFFFF',
      border: '1px solid #E0E0E0',
      borderLeft: `3px solid ${impact.borderColor}`,
      borderRadius: '10px',
      overflow: 'hidden',
    }}>

      {/* ── Collapsed header row ── */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', textAlign: 'left', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '12px', background: 'transparent', cursor: 'pointer', transition: 'background 0.12s' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#F7F9FF')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <span style={{
          flexShrink: 0, fontSize: '11px', fontWeight: 600, fontFamily: '"JetBrains Mono", monospace',
          padding: '2px 10px', borderRadius: '999px',
          background: impact.pillBg, color: impact.pillText, border: `1px solid ${impact.pillBorder}`,
        }}>
          {impact.label}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 600, color: '#1D1D1F', fontSize: '14px' }}>{ruleInfo.name}</span>
          <span style={{ fontSize: '12px', color: '#86868B', marginLeft: '8px', background: '#F5F5F7', padding: '2px 6px', borderRadius: '4px', fontFamily: '"JetBrains Mono", monospace' }}>{ruleInfo.wcag}</span>
          <span style={{ fontSize: '12px', color: '#86868B', margin: '0 6px' }}>·</span>
          <span style={{ fontSize: '12px', color: '#3A3A3C' }}>{pattern.description}</span>
        </div>
        <div className="hidden sm:flex" style={{ alignItems: 'center', gap: '20px', flexShrink: 0, textAlign: 'right' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#1D1D1F', fontFamily: '"JetBrains Mono", monospace' }}>{instanceCount}</div>
            <div style={{ fontSize: '10px', color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>instance{instanceCount !== 1 ? 's' : ''}</div>
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#1D1D1F', fontFamily: '"JetBrains Mono", monospace' }}>{pageCount}</div>
            <div style={{ fontSize: '10px', color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>page{pageCount !== 1 ? 's' : ''}</div>
          </div>
        </div>
        <svg style={{ flexShrink: 0, width: '16px', height: '16px', color: '#86868B', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* ── Expanded body ── */}
      {open && (
        <div style={{ borderTop: '1px solid #F0F0F0' }}>

          {/* What it means */}
          <div style={{ padding: '16px 20px 12px' }}>
            <p style={{ fontSize: '14px', color: '#3A3A3C', lineHeight: 1.6 }}>{ruleInfo.what ?? pattern.description}</p>
          </div>

          {/* How to fix */}
          {pattern.fixSuggestion && (
            <div style={{ margin: '0 20px 16px', background: 'rgba(0,122,255,0.06)', border: '1px solid rgba(0,122,255,0.20)', borderRadius: '8px', padding: '12px 16px', display: 'flex', gap: '12px' }}>
              <svg style={{ width: '16px', height: '16px', color: '#007AFF', flexShrink: 0, marginTop: '2px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#007AFF', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>How to fix</div>
                <p style={{ fontSize: '14px', color: '#3A3A3C', lineHeight: 1.6 }}>{pattern.fixSuggestion}</p>
              </div>
            </div>
          )}

          {/* Failing elements */}
          {nodes.length > 0 && (
            <div style={{ borderTop: '1px solid #F0F0F0' }}>
              <div style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Failing elements · {nodes.length}
                </span>
              </div>
              <table className="w-full" style={{ fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #F0F0F0' }}>
                    <th style={{ textAlign: 'left', padding: '6px 16px', fontSize: '10px', fontWeight: 600, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.06em', width: '32px' }}>#</th>
                    <th style={{ textAlign: 'left', padding: '6px 12px', fontSize: '10px', fontWeight: 600, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.06em', width: '144px' }}>Page</th>
                    <th style={{ textAlign: 'left', padding: '6px 12px', fontSize: '10px', fontWeight: 600, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Element</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleNodes.map((node, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F5F5F7' }}>
                      <td style={{ padding: '8px 16px', color: '#86868B', fontFamily: '"JetBrains Mono", monospace' }}>{i + 1}</td>
                      <td style={{ padding: '8px 12px' }}>
                        {node.url ? (
                          <a href={node.url} target="_blank" rel="noopener noreferrer"
                            style={{ color: '#007AFF', textDecoration: 'none', fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', display: 'block', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            title={node.url}>
                            {pagePath(node.url)}
                          </a>
                        ) : <span style={{ color: '#86868B' }}>—</span>}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <code style={{ fontFamily: '"JetBrains Mono", monospace', color: '#3A3A3C', background: '#F5F5F7', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', wordBreak: 'break-all' }}>
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
                  style={{ width: '100%', textAlign: 'center', fontSize: '12px', color: '#007AFF', padding: '8px', borderTop: '1px solid #F0F0F0', background: 'transparent', cursor: 'pointer' }}
                >
                  + {hiddenCount} more element{hiddenCount !== 1 ? 's' : ''}
                </button>
              )}
            </div>
          )}

          {/* Footer */}
          <div style={{ padding: '10px 20px', borderTop: '1px solid #F0F0F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontFamily: '"JetBrains Mono", monospace', color: '#86868B' }}>{pattern.rule}</span>
            <a
              href={`https://dequeuniversity.com/rules/axe/4.10/${pattern.rule}?application=axeAPI`}
              target="_blank" rel="noopener noreferrer"
              style={{ fontSize: '12px', fontWeight: 500, color: '#007AFF', textDecoration: 'none' }}
            >
              View WCAG guidance →
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
