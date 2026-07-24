'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ViolationPattern, TriageStatus } from '@/types'
import { impactToTier, TIER_COLOR, TIER_LABEL } from '@/lib/tiers'

const TRIAGE_OPTIONS: { value: TriageStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'fixed', label: 'Fixed' },
  { value: 'wontfix', label: "Won't fix" },
  { value: 'false_positive', label: 'False positive' },
]

const TRIAGE_BADGE: Record<Exclude<TriageStatus, 'open'>, string> = {
  fixed: 'bg-emerald-100 text-emerald-700',
  wontfix: 'bg-gray-200 text-gray-600',
  false_positive: 'bg-amber-100 text-amber-700',
}

// Rules where automated scanning cannot confirm the full context, interaction
// behavior, or user impact — a human must verify the specific aspect listed.
const NEEDS_REVIEW: Record<string, string> = {
  'color-contrast':              'Verify contrast manually: automated tools can miss issues on gradients, text over images, and elements that change color on hover or focus.',
  'image-alt':                   'Read each alt text and confirm it conveys the image\'s purpose — not just its appearance. Confirm purely decorative images use alt="".',
  'link-name':                   'Read each link in context. Confirm its purpose is clear from the link text alone, without relying on surrounding sentences.',
  'button-name':                 'Use a screen reader (NVDA, JAWS, or VoiceOver) to navigate to each button and confirm the announced name accurately describes the action.',
  'label':                       'Use a screen reader to navigate to each form field and confirm the announced label accurately describes what to enter.',
  'keyboard':                    'Navigate to each flagged element using Tab, Enter, Space, and arrow keys only. Confirm it is reachable, operable, and focus is clearly visible.',
  'focus-visible':               'Tab through the page and confirm every focused element shows a clear focus indicator. Test in Chrome, Firefox, and Safari.',
  'bypass':                      'Navigate with keyboard only. Confirm the skip link appears on first Tab press and moves focus directly to the main content when activated.',
  'scrollable-region-focusable': 'Use Tab to reach each scrollable area and confirm it can be scrolled using arrow keys.',
  'tabindex':                    'Tab through the page and confirm focus moves in a logical reading order. Positive tabindex values often break the natural sequence.',
  'video-caption':               'Open each video and confirm captions are available, accurate, and in sync with the audio.',
  'aria-live-region-text':       'Trigger the dynamic content update with a screen reader active. Confirm the announcement is clear and not overly verbose.',
  'select-name':                 'Use a screen reader to navigate to each dropdown and confirm the announced label describes what to select.',
  'frame-title':                 'Use a screen reader to navigate into each frame and confirm the announced title describes the frame\'s purpose.',
}

// Plain-language description of the barrier from the user's perspective.
// Placed directly below the Fix block in the expanded card.
const USER_IMPACT: Record<string, string> = {
  'html-has-lang':               "Screen readers use the declared language to choose the correct pronunciation engine. Without it, words may be read with the wrong accent or mispronounced entirely, making content hard to follow for blind users.",
  'image-alt':                   "A screen-reader user hears alt text in place of the image. Without it, they may hear only a filename or nothing at all, and cannot tell what the image shows or why it is there.",
  'color-contrast':              "Users with low vision or color blindness may be unable to read text that does not stand out enough from its background. This affects reading body copy, labels, links, and button text.",
  'color-contrast-enhanced':     "Users with severe low vision depend on higher contrast levels. Text that meets the standard AA threshold may still be unreadable for this group without enhanced contrast.",
  'button-name':                 "A screen-reader user navigating by keyboard will hear only the button's accessible name. Without one, they cannot tell what the button does and may be unable to complete the action.",
  'label':                       "When a form field has no label, a screen-reader user cannot tell what information to enter. They may skip the field, enter the wrong data, or be unable to submit the form.",
  'link-name':                   "A screen-reader user navigating by links hears link text out of context. A link that says 'click here' or 'read more' gives no information about its destination. A keyboard-only user must tab to the link to reach it; if the link has no accessible name it may not be focusable at all.",
  'aria-required-attr':          "An ARIA role without its required attributes sends incomplete information to assistive technology. Screen-reader users may receive no announcement, a confusing one, or incorrect state information for the element.",
  'aria-valid-attr-value':       "An ARIA attribute with an invalid value can cause a screen reader to announce wrong state or skip the element entirely, leaving the user without the context they need.",
  'aria-required-children':      "An ARIA widget that is missing required child roles will not be understood by assistive technology. Users may hear the container announced but be unable to interact with its items.",
  'document-title':              "Every browser tab shows the page title. Without a descriptive title, a screen-reader user opening multiple tabs cannot tell which tab to return to, and the history and bookmarks list becomes meaningless.",
  'frame-title':                 "Screen-reader users can navigate by frames. A frame without a title is announced only as 'frame' with no context. Users cannot tell whether to enter the frame or what they will find inside.",
  'heading-order':               "Screen-reader users navigate pages by jumping between headings. Headings that skip levels or go out of order break the mental map of the page structure, making it hard to find content quickly.",
  'landmark-one-main':           "Screen-reader users can jump directly to the main content landmark to skip repeated navigation. Without it, they must tab through every header link on every page load.",
  'region':                      "Content outside a landmark region is harder for screen-reader users to locate. They cannot jump to unlabeled sections the way they can jump to a named landmark like 'navigation' or 'main'.",
  'select-name':                 "A screen-reader user hears the dropdown's accessible name when focus moves to it. Without a label, they cannot tell what to select and may complete the form incorrectly.",
  'tabindex':                    "Keyboard-only users rely on a predictable Tab order to move through a page. Positive tabindex values pull focus out of the natural reading order, sending users to unexpected places and making it hard to find or return to content.",
  'video-caption':               "Deaf and hard-of-hearing users cannot access spoken dialogue, sound effects, or audio cues without captions. They may miss critical information in tutorials, interviews, or news clips.",
  'input-image-alt':             "An image used as a button must describe its action, not its appearance. Without alt text, a screen-reader user cannot tell what will happen when they activate it.",
  'keyboard':                    "Any functionality that is not reachable by keyboard alone is unavailable to users who cannot use a mouse — including many people with motor disabilities and anyone navigating by keyboard, switch device, or voice control.",
  'focus-visible':               "Keyboard users navigate by moving focus from element to element. When focus has no visible indicator, they lose track of where they are on the page and cannot complete tasks reliably.",
  'bypass':                      "Keyboard users must tab through every header link before reaching page content — on every page load. A skip link lets them jump past repeated navigation in one keystroke, which is essential for frequent visitors.",
  'scrollable-region-focusable': "If a scrollable area cannot receive keyboard focus, keyboard users cannot scroll it. Any content below the visible fold of that area is inaccessible to them.",
  'aria-live-region-text':       "Screen readers announce changes in live regions automatically. If the announcement is missing, unclear, or fires at the wrong time, users relying on audio feedback will miss dynamic updates — such as form errors, status messages, or new search results.",
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

function truncateHtml(html: string, max = 120) {
  const single = html.replace(/\s+/g, ' ').trim()
  return single.length > max ? single.slice(0, max) + '…' : single
}


const SHOW_LIMIT = 5
const PENDING_JIRA_TICKET_KEY = 'pendingJiraTicket'

interface JiraIssuePayload {
  siteId?: string
  scanUrl: string
  projectKey?: string
  pattern: {
    fingerprint: string
    rule: string
    impact: string
    description: string
    fixSuggestion?: string
    occurrences: number
    affectedPages: string[]
    sampleHtml?: string
  }
}

interface JiraProject {
  key: string
  name: string
}

export function ViolationCard({ pattern, siteId, tierHex }: { pattern: ViolationPattern; siteId?: string; tierHex?: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [activeTab, setActiveTab] = useState<'fix' | 'impact' | 'review'>('fix')
  const [triage, setTriage] = useState<TriageStatus>(pattern.triageStatus ?? 'open')
  const [savingTriage, setSavingTriage] = useState(false)
  const [creatingJira, setCreatingJira] = useState(false)
  const [jiraResult, setJiraResult] = useState<{ key?: string; url?: string; error?: string; needsAuth?: boolean; needsProject?: boolean } | null>(null)
  const [jiraProjectKey, setJiraProjectKey] = useState('')
  const [jiraProjects, setJiraProjects] = useState<JiraProject[]>([])
  const [loadingJiraProjects, setLoadingJiraProjects] = useState(false)

  useEffect(() => {
    const storedProjectKey = window.localStorage.getItem('jiraProjectKey') ?? ''
    setJiraProjectKey(storedProjectKey)

    const params = new URLSearchParams(window.location.search)
    const pendingRaw = window.localStorage.getItem(PENDING_JIRA_TICKET_KEY)
    if (params.get('jira') !== 'connected' || !pendingRaw) return

    try {
      const pending = JSON.parse(pendingRaw) as JiraIssuePayload
      if (pending.pattern.fingerprint !== pattern.fingerprint) return
      window.localStorage.removeItem(PENDING_JIRA_TICKET_KEY)
      setOpen(true)
      setJiraProjectKey(pending.projectKey ?? storedProjectKey)
      void submitJiraIssue(pending, { redirectOnAuth: false })
    } catch {
      window.localStorage.removeItem(PENDING_JIRA_TICKET_KEY)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pattern.fingerprint])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    async function loadJiraProjects() {
      setLoadingJiraProjects(true)
      try {
        const res = await fetch('/api/integrations/jira/projects')
        if (!res.ok) return
        const data = await res.json().catch(() => ({}))
        if (cancelled || !Array.isArray(data.projects)) return
        setJiraProjects(data.projects)
        const stored = window.localStorage.getItem('jiraProjectKey')
        if (!stored && data.projects[0]?.key) setJiraProjectKey(data.projects[0].key)
      } finally {
        if (!cancelled) setLoadingJiraProjects(false)
      }
    }
    void loadJiraProjects()
    return () => { cancelled = true }
  }, [open])

  async function changeTriage(status: TriageStatus) {
    if (!siteId) return
    const previous = triage
    setTriage(status)
    setSavingTriage(true)
    try {
      const res = await fetch('/api/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, fingerprint: pattern.fingerprint, status }),
      })
      if (!res.ok) { setTriage(previous); return }
      router.refresh() // recompute active counts server-side
    } catch {
      setTriage(previous)
    } finally {
      setSavingTriage(false)
    }
  }

  function buildJiraPayload(): JiraIssuePayload {
    const normalizedProjectKey = jiraProjectKey.trim().toUpperCase()
    return {
      siteId,
      scanUrl: window.location.href,
      projectKey: normalizedProjectKey || undefined,
      pattern: {
        fingerprint: pattern.fingerprint,
        rule: pattern.rule,
        impact: pattern.impact,
        description: pattern.description,
        fixSuggestion: pattern.fixSuggestion,
        occurrences: pattern.occurrences,
        affectedPages: pattern.affectedPages ?? [],
        sampleHtml: pattern.sampleHtml ?? pattern.nodes?.[0]?.html,
      },
    }
  }

  function redirectToJiraLogin(payload: JiraIssuePayload) {
    window.localStorage.setItem(PENDING_JIRA_TICKET_KEY, JSON.stringify(payload))
    window.location.href = `/api/integrations/jira/oauth/start?returnTo=${encodeURIComponent(window.location.href)}`
  }

  function changeJiraProjectKey(value: string) {
    setJiraProjectKey(value.toUpperCase())
    setJiraResult(current => current?.needsProject ? null : current)
  }

  async function submitJiraIssue(payload: JiraIssuePayload, options = { redirectOnAuth: true }) {
    setCreatingJira(true)
    setJiraResult(null)
    try {
      const res = await fetch('/api/integrations/jira/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data.code === 'jira_auth_required' && options.redirectOnAuth) {
          redirectToJiraLogin(payload)
          return
        }
        setJiraResult({
          error: data.error ?? 'Could not create Jira ticket.',
          needsAuth: data.code === 'jira_auth_required',
          needsProject: data.code === 'jira_project_required',
        })
        return
      }
      if (payload.projectKey) window.localStorage.setItem('jiraProjectKey', payload.projectKey.toUpperCase())
      setJiraResult({ key: data.key, url: data.url })
    } catch {
      setJiraResult({ error: 'Could not create Jira ticket.' })
    } finally {
      setCreatingJira(false)
    }
  }

  async function createJiraIssue() {
    await submitJiraIssue(buildJiraPayload())
  }

  const triaged = triage !== 'open'

  const tier = impactToTier(pattern.impact)
  const c = TIER_COLOR[tier]
  const tierLabel = TIER_LABEL[tier]
  const ruleInfo = getRuleInfo(pattern.rule)
  const instanceCount = pattern.occurrences
  const pageCount = pattern.affectedPages?.length ?? 0

  const nodes = pattern.nodes?.length > 0
    ? pattern.nodes
    : pattern.sampleHtml
      ? [{ html: pattern.sampleHtml, url: pattern.affectedPages?.[0] ?? '', screenshot: undefined }]
      : []

  const visibleNodes = showAll ? nodes : nodes.slice(0, SHOW_LIMIT)
  const hiddenCount = nodes.length - SHOW_LIMIT

  const detailTabs = [
    ...(pattern.fixSuggestion        ? [{ id: 'fix'    as const, label: 'How to fix',  amber: false }] : []),
    ...(USER_IMPACT[pattern.rule]    ? [{ id: 'impact' as const, label: 'User impact', amber: false }] : []),
    ...(NEEDS_REVIEW[pattern.rule]   ? [{ id: 'review' as const, label: 'Needs review', amber: true }] : []),
  ]
  const activeDetailTab = detailTabs.some(t => t.id === activeTab) ? activeTab : (detailTabs[0]?.id ?? 'fix')

  const accentColor = tierHex ?? c.hex

  return (
    <div className={`border-l-[3px] ${triaged ? 'opacity-60' : ''}`} style={{ borderLeftColor: accentColor }}>

      {/* ── Row ── */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left px-4 py-3.5 flex items-center gap-3 hover:bg-[#FAFAFA] transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-[#1D1D1F] text-sm">{ruleInfo.name}</span>
            <span className="text-[11px] text-[#8E8E93]">{ruleInfo.wcag}</span>
            {pattern.isNew && !triaged && (
              <span className="text-[11px] font-semibold text-red-500" title="Not present in the previous scan">New</span>
            )}
            {NEEDS_REVIEW[pattern.rule] && !triaged && (
              <span className="text-[11px] font-medium text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">Needs review</span>
            )}
            {triaged && (
              <span className="text-[11px] font-medium text-[#8E8E93]">{TRIAGE_OPTIONS.find(o => o.value === triage)?.label}</span>
            )}
          </div>
          <p className="text-[11px] text-[#6E6E73] mt-0.5 truncate">{pattern.description}</p>
        </div>
        <span className="text-[11px] text-[#8E8E93] tabular-nums whitespace-nowrap shrink-0 hidden sm:block">
          {instanceCount} instance{instanceCount !== 1 ? 's' : ''} · {pageCount} page{pageCount !== 1 ? 's' : ''}
        </span>
        <svg className={`shrink-0 w-3.5 h-3.5 text-[#C7C7CC] transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* ── Expanded panel ── */}
      {open && (
          <div className="border-t border-[#F2F2F7]">

            {/* Tab bar */}
            {detailTabs.length > 0 && (
              <div className="flex gap-0 border-b border-[#F2F2F7] bg-white px-4">
                {detailTabs.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors ${
                      activeDetailTab === t.id
                        ? t.amber
                          ? 'text-amber-600 border-amber-400'
                          : 'text-[#1D1D1F] border-[#1D1D1F]'
                        : 'text-[#8E8E93] border-transparent hover:text-[#3A3A3C]'
                    }`}
                  >
                    {t.amber && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />}
                    {t.label}
                  </button>
                ))}
              </div>
            )}

            {/* Tab content */}
            <div className="px-5 py-4 bg-white">
              {activeDetailTab === 'fix' && pattern.fixSuggestion && (
                <>
                  <p className="text-sm text-[#1D1D1F] leading-relaxed">{pattern.fixSuggestion}</p>
                  <a
                    href={`https://dequeuniversity.com/rules/axe/4.10/${pattern.rule}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-2.5 text-xs font-medium text-[#0071E3] hover:underline"
                  >
                    WCAG reference
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </>
              )}
              {activeDetailTab === 'impact' && USER_IMPACT[pattern.rule] && (
                <p className="text-sm text-[#1D1D1F] leading-relaxed">{USER_IMPACT[pattern.rule]}</p>
              )}
              {activeDetailTab === 'review' && NEEDS_REVIEW[pattern.rule] && (
                <p className="text-sm text-[#1D1D1F] leading-relaxed">{NEEDS_REVIEW[pattern.rule]}</p>
              )}
            </div>

            {/* Failing elements */}
            {nodes.length > 0 && (
              <div className="border-t border-[#F2F2F7]">
                <div className="px-5 py-2 flex items-center justify-between bg-white">
                  <span className="text-[11px] font-medium text-[#8E8E93] uppercase tracking-wide">Failing elements · {nodes.length}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-y border-[#F2F2F7] bg-[#FAFAFA]">
                        <th className="text-left px-5 py-2 text-xs font-medium text-[#8E8E93] w-8">#</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-[#8E8E93] w-36">Page</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-[#8E8E93]">Element</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F2F2F7]">
                      {visibleNodes.map((node, i) => (
                        <tr key={i} className="align-top hover:bg-[#FAFAFA] transition-colors">
                          <td className="px-5 py-2 text-[#8E8E93] font-mono">{i + 1}</td>
                          <td className="px-3 py-2">
                            {node.url ? (
                              <a href={node.url} target="_blank" rel="noopener noreferrer"
                                className="text-[#0071E3] hover:underline font-mono truncate block max-w-[180px]"
                                title={node.url}>
                                {pagePath(node.url)}
                              </a>
                            ) : <span className="text-[#8E8E93]">—</span>}
                          </td>
                          <td className="px-3 py-2">
                            <code className="block max-w-full whitespace-pre-wrap break-words rounded-lg bg-[#F0F4FF] border border-[#E0E8FF] px-2 py-1.5 font-mono text-[11px] leading-4 text-[#1D1D1F]">
                              {truncateHtml(node.html)}
                            </code>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {hiddenCount > 0 && !showAll && (
                  <button
                    onClick={() => setShowAll(true)}
                    className="w-full text-center text-xs font-medium text-[#0071E3] py-2.5 border-t border-[#F2F2F7] hover:bg-[#F5F5F7] transition-colors"
                  >
                    Show {hiddenCount} more element{hiddenCount !== 1 ? 's' : ''}
                  </button>
                )}
              </div>
            )}
          </div>
      )}

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[#F2F2F7] flex flex-nowrap items-center justify-between gap-3 overflow-x-auto bg-[#FAFAFA]">
            {siteId && (
              <div className="flex shrink-0 items-center gap-2.5">
                <label htmlFor={`triage-${pattern.fingerprint}`} className="text-xs font-medium text-[#6E6E73]">Status</label>
                <select
                  id={`triage-${pattern.fingerprint}`}
                  value={triage}
                  disabled={savingTriage}
                  onChange={e => changeTriage(e.target.value as TriageStatus)}
                  className="text-xs border border-[#E5E5EA] rounded-md px-2 py-1 bg-white text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {TRIAGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <span
                  title="Triaged issues are excluded from active counts; the rule still appears here."
                  className="text-[#8E8E93] cursor-default select-none"
                  aria-label="Triage info"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
                  </svg>
                </span>
              </div>
            )}
            <div className="ml-auto flex shrink-0 flex-nowrap items-center justify-end gap-3">
              {jiraResult?.error && (
                <span className="text-xs text-red-600 max-w-sm">{jiraResult.error}</span>
              )}
              {jiraResult?.needsAuth && (
                <button
                  type="button"
                  onClick={() => redirectToJiraLogin(buildJiraPayload())}
                  className="inline-flex items-center rounded-md border border-[#007AFF] bg-white px-3 py-1.5 text-xs font-semibold text-[#007AFF] shadow-sm hover:bg-blue-50"
                >
                  Connect Jira
                </button>
              )}
              <label className="flex items-center gap-1 text-xs font-medium text-[#3A3A3C]">
                Project
                {jiraProjects.length > 0 ? (
                  <select
                    value={jiraProjectKey}
                    onChange={e => changeJiraProjectKey(e.target.value)}
                    aria-label="Jira project"
                    className={`max-w-[180px] rounded-md border px-2 py-1 text-xs font-semibold text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      jiraResult?.needsProject ? 'border-red-400 bg-red-50' : 'border-[#D1D1D6] bg-white'
                    }`}
                  >
                    {jiraProjects.map(project => (
                      <option key={project.key} value={project.key}>{project.key} — {project.name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={jiraProjectKey}
                    onChange={e => changeJiraProjectKey(e.target.value)}
                    placeholder={loadingJiraProjects ? 'Loading…' : 'Enter key'}
                    aria-label="Jira project key"
                    title="Type your Jira project key, for example A11Y"
                    className={`w-24 rounded-md border px-2 py-1 text-xs font-semibold uppercase text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      jiraResult?.needsProject ? 'border-red-400 bg-red-50' : 'border-[#D1D1D6] bg-white'
                    }`}
                  />
                )}
              </label>
              {jiraResult?.url && (
                <a href={jiraResult.url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-emerald-700 hover:underline">
                  Open {jiraResult.key ?? 'Jira issue'} →
                </a>
              )}
              <button
                type="button"
                onClick={createJiraIssue}
                disabled={creatingJira}
                className="inline-flex items-center gap-1 rounded-md border border-[#007AFF] bg-[#007AFF] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#0066D6] disabled:cursor-not-allowed disabled:border-[#A1A1A6] disabled:bg-[#A1A1A6]"
              >
                {creatingJira ? 'Creating Jira…' : 'Create Jira ticket'}
              </button>
              <a
                href={`https://dequeuniversity.com/rules/axe/4.10/${pattern.rule}?application=axeAPI`}
                target="_blank" rel="noopener noreferrer"
                className="text-xs font-medium text-[#007AFF] hover:underline"
              >
                View WCAG guidance →
              </a>
            </div>
          </div>
    </div>
  )
}
