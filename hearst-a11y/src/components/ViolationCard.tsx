'use client'

import { useState } from 'react'
import type { ViolationPattern } from '@/types'

const IMPACT_LABELS: Record<string, { label: string; color: string; bg: string; border: string; description: string }> = {
  critical: {
    label: 'Critical',
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
    description: 'Blocks access for users with disabilities. Must be fixed.',
  },
  serious: {
    label: 'Serious',
    color: 'text-orange-700',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    description: 'Significantly impairs access. Should be fixed as soon as possible.',
  },
  moderate: {
    label: 'Moderate',
    color: 'text-yellow-700',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    description: 'Creates friction for users with disabilities. Should be fixed.',
  },
  minor: {
    label: 'Minor',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    description: 'Small improvement that helps accessibility. Fix when possible.',
  },
}

const WCAG_RULES: Record<string, { name: string; wcag: string; what: string }> = {
  'html-has-lang': { name: 'Page Language', wcag: 'WCAG 3.1.1 (AA)', what: "The page must declare what language it's written in so screen readers pronounce words correctly." },
  'image-alt': { name: 'Image Alt Text', wcag: 'WCAG 1.1.1 (A)', what: 'Images must have a text description so screen reader users know what the image shows.' },
  'color-contrast': { name: 'Color Contrast', wcag: 'WCAG 1.4.3 (AA)', what: 'Text must have enough contrast against its background so people with low vision can read it.' },
  'button-name': { name: 'Button Label', wcag: 'WCAG 4.1.2 (A)', what: 'Buttons must have a visible or hidden label so screen reader users know what the button does.' },
  'label': { name: 'Form Field Label', wcag: 'WCAG 1.3.1 (A)', what: 'Form inputs must have labels so screen reader users know what information to enter.' },
  'link-name': { name: 'Link Text', wcag: 'WCAG 2.4.4 (A)', what: 'Links must have descriptive text so screen reader users know where the link goes.' },
  'aria-required-attr': { name: 'Missing ARIA Attribute', wcag: 'WCAG 4.1.2 (A)', what: 'An ARIA role is used but a required attribute is missing, which breaks screen reader announcements.' },
  'aria-valid-attr-value': { name: 'Invalid ARIA Value', wcag: 'WCAG 4.1.2 (A)', what: 'An ARIA attribute has an invalid value, which can confuse assistive technology.' },
  'document-title': { name: 'Page Title', wcag: 'WCAG 2.4.2 (A)', what: 'Every page must have a descriptive title so users know which page they are on.' },
  'frame-title': { name: 'Frame/iFrame Label', wcag: 'WCAG 2.4.1 (A)', what: 'Frames and iframes must have a title so screen reader users can understand their purpose.' },
  'heading-order': { name: 'Heading Structure', wcag: 'WCAG 1.3.1 (A)', what: 'Headings must follow a logical order (H1, H2, H3...) so screen reader users can navigate the page structure.' },
  'landmark-one-main': { name: 'Main Landmark', wcag: 'WCAG 1.3.1 (A)', what: 'Every page should have one main landmark element so screen reader users can jump to the main content.' },
  'region': { name: 'Page Regions', wcag: 'WCAG 1.3.1 (A)', what: 'Content should be contained within landmark regions (header, main, footer, nav) for easier navigation.' },
  'select-name': { name: 'Dropdown Label', wcag: 'WCAG 1.3.1 (A)', what: 'Dropdown menus must have labels so screen reader users know what to select.' },
  'tabindex': { name: 'Tab Order', wcag: 'WCAG 2.4.3 (A)', what: 'Using tabindex values greater than 0 disrupts the natural keyboard navigation order.' },
  'video-caption': { name: 'Video Captions', wcag: 'WCAG 1.2.2 (AA)', what: 'Videos must have captions so deaf users can access the audio content.' },
  'input-image-alt': { name: 'Image Button Alt Text', wcag: 'WCAG 1.1.1 (A)', what: 'Image buttons must have alt text describing the button action.' },
}

function getRuleInfo(rule: string) {
  return WCAG_RULES[rule] ?? { name: rule, wcag: 'WCAG 2.1 AA', what: null }
}

export function ViolationCard({ pattern }: { pattern: ViolationPattern }) {
  const [open, setOpen] = useState(false)
  const impact = IMPACT_LABELS[pattern.impact] ?? IMPACT_LABELS.minor
  const ruleInfo = getRuleInfo(pattern.rule)

  return (
    <div className={`rounded-lg border ${impact.border} overflow-hidden`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left px-4 py-3 flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${impact.bg} ${impact.color} ${impact.border}`}>
            {impact.label}
          </span>
          <div className="min-w-0">
            <div className="font-semibold text-gray-900 text-sm">{ruleInfo.name}</div>
            <div className="text-xs text-gray-500 truncate">{pattern.description}</div>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-semibold text-gray-700">{pattern.occurrences} violation{pattern.occurrences !== 1 ? 's' : ''}</div>
            <div className="text-xs text-gray-400">{pattern.affectedPages?.length ?? 0} page{(pattern.affectedPages?.length ?? 0) !== 1 ? 's' : ''} affected</div>
          </div>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {open && (
        <div className={`px-4 pb-4 pt-2 border-t ${impact.border} ${impact.bg} space-y-3`}>
          {/* What this means */}
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">What this means</div>
            <p className="text-sm text-gray-700">
              {ruleInfo.what ?? pattern.description}
            </p>
          </div>

          {/* WCAG reference */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Standard:</span>
            <span className="text-xs font-medium text-gray-700">{ruleInfo.wcag}</span>
          </div>

          {/* Element screenshot */}
          {pattern.sampleScreenshot && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">The element</div>
              <div className="bg-white rounded-lg border border-gray-200 p-2 inline-block max-w-full">
                <img
                  src={`data:image/jpeg;base64,${pattern.sampleScreenshot}`}
                  alt="Screenshot of the failing element"
                  className="max-w-full max-h-40 rounded object-contain"
                />
              </div>
            </div>
          )}

          {/* How to fix */}
          {pattern.fixSuggestion && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">How to fix</div>
              <p className="text-sm text-gray-800 bg-white rounded-lg px-3 py-2 border border-gray-200">
                {pattern.fixSuggestion}
              </p>
            </div>
          )}

          {/* Affected pages */}
          {pattern.affectedPages && pattern.affectedPages.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Affected pages</div>
              <ul className="space-y-0.5">
                {pattern.affectedPages.map(url => (
                  <li key={url}>
                    <a href={url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline break-all">
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Rule ID for developers */}
          <div className="text-xs text-gray-400">
            Rule ID: <span className="font-mono">{pattern.rule}</span>
            {' · '}
            <a
              href={`https://dequeuniversity.com/rules/axe/4.10/${pattern.rule}?application=axeAPI`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              View full guidance →
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
