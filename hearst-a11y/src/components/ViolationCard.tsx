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

export function ViolationCard({ pattern, siteId }: { pattern: ViolationPattern; siteId?: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)
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

  return (
    <div className={`bg-white border border-[#E5E5EA] border-l-[3px] rounded-lg overflow-hidden ${triaged ? 'opacity-60' : ''}`}
      style={{ borderLeftColor: c.hex }}>

      {/* ── Collapsed header row ── */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-[#F5F5F7] transition-colors"
      >
        <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-md ${c.bg} ${c.text} ring-1 ring-inset ${c.border}`}>
          {tierLabel}
        </span>
        {triaged && (
          <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${TRIAGE_BADGE[triage as Exclude<TriageStatus, 'open'>]}`}>
            {TRIAGE_OPTIONS.find(o => o.value === triage)?.label}
          </span>
        )}
        {pattern.isNew && !triaged && (
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-red-100 text-red-700" title="Not present in the previous scan">
            New
          </span>
        )}
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-[#1D1D1F] text-sm">{ruleInfo.name}</span>
          <span className="text-xs text-[#3A3A3C] font-medium ml-2 bg-[#ECECEE] px-1.5 py-0.5 rounded">{ruleInfo.wcag}</span>
          <span className="text-xs text-[#8A8A8E] mx-1.5">·</span>
          <span className="text-xs text-[#3A3A3C] truncate">{pattern.description}</span>
        </div>
        <div className="hidden sm:flex items-center gap-5 shrink-0 text-right">
          <div>
            <div className="text-sm font-semibold text-[#1D1D1F] tabular-nums">{instanceCount}</div>
            <div className="text-[10px] text-[#3A3A3C] uppercase tracking-wide">instance{instanceCount !== 1 ? 's' : ''}</div>
          </div>
          <div>
            <div className="text-sm font-semibold text-[#1D1D1F] tabular-nums">{pageCount}</div>
            <div className="text-[10px] text-[#3A3A3C] uppercase tracking-wide">page{pageCount !== 1 ? 's' : ''}</div>
          </div>
        </div>
        <svg className={`shrink-0 w-4 h-4 text-[#3A3A3C] transition-transform ${open ? 'rotate-180' : ''}`}
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
                <span className="text-xs font-semibold text-[#3A3A3C] uppercase tracking-wider">
                  Failing elements · {nodes.length}
                </span>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#E5E5EA] bg-[#F5F5F7]">
                    <th className="text-left px-4 py-1.5 text-[10px] font-semibold text-[#3A3A3C] uppercase tracking-wider w-8">#</th>
                    <th className="text-left px-3 py-1.5 text-[10px] font-semibold text-[#3A3A3C] uppercase tracking-wider w-36">Page</th>
                    <th className="text-left px-3 py-1.5 text-[10px] font-semibold text-[#3A3A3C] uppercase tracking-wider">Element</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5F5F7]">
                  {visibleNodes.map((node, i) => (
                    <tr key={i} className="hover:bg-[#F5F5F7]">
                      <td className="px-4 py-2 text-[#3A3A3C] font-mono">{i + 1}</td>
                      <td className="px-3 py-2">
                        {node.url ? (
                          <a href={node.url} target="_blank" rel="noopener noreferrer"
                            className="text-[#007AFF] hover:underline font-mono truncate block max-w-[140px]"
                            title={node.url}>
                            {pagePath(node.url)}
                          </a>
                        ) : <span className="text-[#3A3A3C]">—</span>}
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
                  className="w-full text-center text-xs text-[#3A3A3C] hover:text-[#1D1D1F] py-2 border-t border-[#E5E5EA] hover:bg-[#F5F5F7] transition-colors"
                >
                  + {hiddenCount} more element{hiddenCount !== 1 ? 's' : ''}
                </button>
              )}
            </div>
          )}

          {/* Triage */}
          {siteId && (
            <div className="px-5 py-2.5 border-t border-[#E5E5EA] flex items-center gap-2">
              <label htmlFor={`triage-${pattern.fingerprint}`} className="text-xs font-semibold text-[#3A3A3C] uppercase tracking-wider">Status</label>
              <select
                id={`triage-${pattern.fingerprint}`}
                value={triage}
                disabled={savingTriage}
                onChange={e => changeTriage(e.target.value as TriageStatus)}
                className="text-xs border border-[#E5E5EA] rounded-md px-2 py-1 bg-white text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {TRIAGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <span className="text-[11px] text-[#3A3A3C]">Triaged issues are excluded from active counts; the rule still appears here.</span>
            </div>
          )}

          {/* Footer */}
          <div className="px-5 py-2.5 border-t border-[#E5E5EA] flex flex-wrap items-center justify-between gap-2 bg-[#F5F5F7]">
            <span className="text-[11px] font-mono text-[#3A3A3C]">{pattern.rule}</span>
            <div className="flex flex-wrap items-center justify-end gap-3">
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
      )}
    </div>
  )
}
