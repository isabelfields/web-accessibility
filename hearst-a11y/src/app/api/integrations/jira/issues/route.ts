import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionUser, canAccessDivision } from '@/lib/auth-helpers'
import { sql } from '@/lib/db'

const PatternSchema = z.object({
  fingerprint: z.string().min(1),
  rule: z.string().min(1),
  impact: z.string().min(1),
  description: z.string().min(1),
  fixSuggestion: z.string().optional(),
  occurrences: z.number().int().nonnegative(),
  affectedPages: z.array(z.string()).default([]),
  sampleHtml: z.string().optional(),
})

const CreateJiraIssueSchema = z.object({
  siteId: z.string().uuid().optional(),
  siteName: z.string().optional(),
  scanUrl: z.string().optional(),
  pattern: PatternSchema,
})

type JiraAdfTextNode = { type: 'text'; text: string }
type JiraAdfParagraph = { type: 'paragraph'; content: JiraAdfTextNode[] }
type JiraAdfCodeBlock = { type: 'codeBlock'; attrs?: { language?: string }; content: JiraAdfTextNode[] }
type JiraAdfNode = JiraAdfParagraph | JiraAdfCodeBlock
type JiraAdfDocument = { type: 'doc'; version: 1; content: JiraAdfNode[] }

function jiraConfig() {
  const baseUrl = process.env.JIRA_BASE_URL?.replace(/\/$/, '')
  const email = process.env.JIRA_EMAIL
  const apiToken = process.env.JIRA_API_TOKEN
  const projectKey = process.env.JIRA_PROJECT_KEY
  const issueType = process.env.JIRA_ISSUE_TYPE || 'Bug'

  if (!baseUrl || !email || !apiToken || !projectKey) return null
  return { baseUrl, email, apiToken, projectKey, issueType }
}

function paragraph(text: string): JiraAdfParagraph {
  return { type: 'paragraph', content: [{ type: 'text', text }] }
}

function codeBlock(text: string): JiraAdfCodeBlock {
  return { type: 'codeBlock', attrs: { language: 'html' }, content: [{ type: 'text', text }] }
}

function jiraDescription(input: z.infer<typeof CreateJiraIssueSchema>): JiraAdfDocument {
  const { pattern, siteName, scanUrl } = input
  const pages = pattern.affectedPages.length > 0 ? pattern.affectedPages.join('\n') : 'No affected pages were captured.'
  const content: JiraAdfNode[] = [
    paragraph(`Accessibility violation: ${pattern.rule}`),
    paragraph(`Impact: ${pattern.impact}`),
    paragraph(`Occurrences: ${pattern.occurrences}`),
    paragraph(`Description: ${pattern.description}`),
  ]

  if (siteName) content.push(paragraph(`Site: ${siteName}`))
  if (scanUrl) content.push(paragraph(`Scan: ${scanUrl}`))
  if (pattern.fixSuggestion) content.push(paragraph(`Suggested fix: ${pattern.fixSuggestion}`))

  content.push(paragraph('Affected pages:'))
  content.push(codeBlock(pages))

  if (pattern.sampleHtml) {
    content.push(paragraph('Sample failing element:'))
    content.push(codeBlock(pattern.sampleHtml))
  }

  content.push(paragraph(`Fingerprint: ${pattern.fingerprint}`))
  return { type: 'doc', version: 1, content }
}

function issueSummary(pattern: z.infer<typeof PatternSchema>, siteName?: string): string {
  const prefix = siteName ? `[A11y][${siteName}]` : '[A11y]'
  return `${prefix} ${pattern.rule} (${pattern.impact}) - ${pattern.occurrences} occurrence${pattern.occurrences === 1 ? '' : 's'}`.slice(0, 255)
}

async function authorizeSite(siteId: string | undefined) {
  const user = await getSessionUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  if (!siteId) return { user }

  const [site] = await sql`SELECT name, division FROM sites WHERE id = ${siteId}`
  if (!site || !canAccessDivision(user, site.division)) return { error: 'Not found', status: 404 as const }
  return { user, site }
}

export async function POST(req: NextRequest) {
  const parsed = CreateJiraIssueSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const auth = await authorizeSite(parsed.data.siteId)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const config = jiraConfig()
  if (!config) {
    return NextResponse.json(
      { error: 'Jira integration is not configured. Set JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, and JIRA_PROJECT_KEY.' },
      { status: 503 }
    )
  }

  const siteName = parsed.data.siteName ?? auth.site?.name
  const res = await fetch(`${config.baseUrl}/rest/api/3/issue`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.email}:${config.apiToken}`).toString('base64')}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: {
        project: { key: config.projectKey },
        issuetype: { name: config.issueType },
        summary: issueSummary(parsed.data.pattern, siteName),
        description: jiraDescription({ ...parsed.data, siteName }),
        labels: ['accessibility', 'a11y-scanner', parsed.data.pattern.rule.replace(/[^A-Za-z0-9_-]/g, '-')],
      },
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return NextResponse.json({ error: 'Jira issue creation failed', details: data }, { status: res.status })
  }

  const key = typeof data.key === 'string' ? data.key : undefined
  return NextResponse.json({ key, url: key ? `${config.baseUrl}/browse/${key}` : undefined })
}
