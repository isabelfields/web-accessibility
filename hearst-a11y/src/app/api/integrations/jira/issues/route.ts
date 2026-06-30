import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionUser, canAccessDivision } from '@/lib/auth-helpers'
import { sql } from '@/lib/db'
import { decryptToken, encryptToken, jiraIssueApiUrl, jiraUserKey, refreshJiraToken } from '@/lib/jira'

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
  projectKey: z.string().trim().min(1).max(32).optional(),
  pattern: PatternSchema,
})

type JiraAdfTextNode = { type: 'text'; text: string }
type JiraAdfParagraph = { type: 'paragraph'; content: JiraAdfTextNode[] }
type JiraAdfCodeBlock = { type: 'codeBlock'; attrs?: { language?: string }; content: JiraAdfTextNode[] }
type JiraAdfNode = JiraAdfParagraph | JiraAdfCodeBlock
type JiraAdfDocument = { type: 'doc'; version: 1; content: JiraAdfNode[] }

function jiraProjectKey(inputProjectKey?: string): string | null {
  return (inputProjectKey ?? process.env.JIRA_PROJECT_KEY)?.trim().toUpperCase() ?? null
}

function jiraIssueType(): string {
  return process.env.JIRA_ISSUE_TYPE || 'Bug'
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

  const projectKey = jiraProjectKey(parsed.data.projectKey)
  if (!projectKey) {
    return NextResponse.json(
      { error: 'Enter the Jira project key for this ticket.', code: 'jira_project_required' },
      { status: 400 }
    )
  }

  const userKey = jiraUserKey(auth.user)
  if (!userKey) return NextResponse.json({ error: 'Connect your Jira account before creating tickets.', code: 'jira_auth_required' }, { status: 401 })

  const [connection] = await sql`
    SELECT access_token, refresh_token, cloud_id, site_url, token_expires_at
    FROM jira_connections WHERE user_key = ${userKey}
  `
  if (!connection?.access_token || !connection?.cloud_id || !connection?.site_url) {
    return NextResponse.json({ error: 'Connect your Jira account before creating tickets.', code: 'jira_auth_required' }, { status: 401 })
  }

  let accessToken = decryptToken(connection.access_token)
  if (connection.token_expires_at && new Date(connection.token_expires_at).getTime() <= Date.now()) {
    if (!connection.refresh_token) {
      return NextResponse.json({ error: 'Reconnect your Jira account before creating tickets.', code: 'jira_auth_required' }, { status: 401 })
    }
    const refreshed = await refreshJiraToken(decryptToken(connection.refresh_token))
    accessToken = refreshed.accessToken
    await sql`
      UPDATE jira_connections SET
        access_token = ${encryptToken(refreshed.accessToken)},
        refresh_token = ${refreshed.refreshToken ? encryptToken(refreshed.refreshToken) : connection.refresh_token},
        token_expires_at = ${refreshed.expiresAt.toISOString()},
        updated_at = NOW()
      WHERE user_key = ${userKey}
    `
  }

  const siteName = parsed.data.siteName ?? auth.site?.name
  const res = await fetch(jiraIssueApiUrl({ cloudId: connection.cloud_id }), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: {
        project: { key: projectKey },
        issuetype: { name: jiraIssueType() },
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
  return NextResponse.json({ key, url: key ? `${connection.site_url}/browse/${key}` : undefined })
}
