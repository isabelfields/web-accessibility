import crypto from 'node:crypto'

export interface JiraConnection {
  accessToken: string
  refreshToken: string | null
  cloudId: string
  siteUrl: string
  accountId?: string | null
  expiresAt: Date
}

export interface JiraResource {
  id: string
  url: string
  name: string
  scopes: string[]
  avatarUrl?: string
}

const ATLASSIAN_AUTH_URL = 'https://auth.atlassian.com/authorize'
const ATLASSIAN_TOKEN_URL = 'https://auth.atlassian.com/oauth/token'
const ATLASSIAN_RESOURCES_URL = 'https://api.atlassian.com/oauth/token/accessible-resources'
export const JIRA_SCOPES = ['read:jira-user', 'write:jira-work', 'offline_access'] as const

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not configured`)
  return value
}

function encryptionKey(): Buffer {
  return crypto.createHash('sha256').update(requiredEnv('AUTH_SECRET')).digest()
}

export function encryptToken(token: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${ciphertext.toString('base64url')}`
}

export function decryptToken(value: string): string {
  const [ivRaw, tagRaw, ciphertextRaw] = value.split('.')
  if (!ivRaw || !tagRaw || !ciphertextRaw) throw new Error('Invalid encrypted token')
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivRaw, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextRaw, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}

export function jiraOAuthConfigured(): boolean {
  return Boolean(process.env.JIRA_CLIENT_ID && process.env.JIRA_CLIENT_SECRET && process.env.JIRA_REDIRECT_URI)
}

export function buildJiraAuthorizeUrl(state: string): string {
  const url = new URL(ATLASSIAN_AUTH_URL)
  url.searchParams.set('audience', 'api.atlassian.com')
  url.searchParams.set('client_id', requiredEnv('JIRA_CLIENT_ID'))
  url.searchParams.set('scope', JIRA_SCOPES.join(' '))
  url.searchParams.set('redirect_uri', requiredEnv('JIRA_REDIRECT_URI'))
  url.searchParams.set('state', state)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('prompt', 'consent')
  return url.toString()
}

export async function exchangeJiraCode(code: string): Promise<{
  accessToken: string
  refreshToken: string | null
  expiresAt: Date
}> {
  const res = await fetch(ATLASSIAN_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: requiredEnv('JIRA_CLIENT_ID'),
      client_secret: requiredEnv('JIRA_CLIENT_SECRET'),
      code,
      redirect_uri: requiredEnv('JIRA_REDIRECT_URI'),
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error_description ?? data.error ?? 'Could not connect Jira')
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: new Date(Date.now() + Math.max(60, Number(data.expires_in ?? 3600) - 60) * 1000),
  }
}

export async function refreshJiraToken(refreshToken: string): Promise<{
  accessToken: string
  refreshToken: string | null
  expiresAt: Date
}> {
  const res = await fetch(ATLASSIAN_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: requiredEnv('JIRA_CLIENT_ID'),
      client_secret: requiredEnv('JIRA_CLIENT_SECRET'),
      refresh_token: refreshToken,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error_description ?? data.error ?? 'Could not refresh Jira token')
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: new Date(Date.now() + Math.max(60, Number(data.expires_in ?? 3600) - 60) * 1000),
  }
}

export async function getJiraResources(accessToken: string): Promise<JiraResource[]> {
  const res = await fetch(ATLASSIAN_RESOURCES_URL, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })
  const data = await res.json().catch(() => [])
  if (!res.ok) throw new Error('Could not load Jira sites')
  return Array.isArray(data) ? data : []
}

export function chooseJiraResource(resources: JiraResource[]): JiraResource | null {
  const configuredCloudId = process.env.JIRA_CLOUD_ID
  if (configuredCloudId) return resources.find(resource => resource.id === configuredCloudId) ?? null

  const configuredBaseUrl = process.env.JIRA_BASE_URL?.replace(/\/$/, '')
  if (configuredBaseUrl) return resources.find(resource => resource.url.replace(/\/$/, '') === configuredBaseUrl) ?? null

  return resources[0] ?? null
}

export function jiraIssueApiUrl(connection: Pick<JiraConnection, 'cloudId'>): string {
  return `https://api.atlassian.com/ex/jira/${connection.cloudId}/rest/api/3/issue`
}
