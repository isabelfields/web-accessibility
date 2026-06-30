# Hearst Accessibility Scanner

Web accessibility scanner with full-site crawling, AI-powered fix suggestions, scheduled scans, and a dashboard.

## Stack

- **Next.js 15** (App Router) — frontend + API routes
- **Playwright + axe-core** — headless page rendering + WCAG auditing
- **OpenAI API (gpt-4o)** — generates fix suggestions for complex violations
- **Neon** — serverless Postgres
- **Vercel** — hosting + cron jobs
- **GitHub Actions** — CI/CD

## Cost Optimizations

Three optimizations keep AI API costs under $0.10 per full 50-page scan:

1. **Skip near-duplicate pages** — DOM structure fingerprinting skips pages that share a template with an already-scanned page (e.g. article pages)
2. **Strip HTML before the model** — sends `selector + context` instead of raw HTML, cutting input tokens ~60%
3. **Hardcoded rules for known violations** — 25+ common axe rules (image-alt, label, button-name, etc.) return pre-written fixes without hitting the API

## Setup

### 1. Clone and install

```bash
git clone https://github.com/hearst/a11y-scanner
cd a11y-scanner
npm install
npx playwright install chromium
```

### 2. Set up database

Create a free database at [neon.tech](https://neon.tech) or [supabase.com](https://supabase.com),
then set `DATABASE_URL` (see step 3).

Apply the schema by calling the migrate endpoint once the app is running (locally
or deployed). Every statement is idempotent, so it's safe to re-run after deploys:

```bash
curl -X POST http://localhost:3000/api/migrate \
  -H "Authorization: Bearer $CRON_SECRET"
```

The schema lives in `src/lib/db/schema.ts` (`MIGRATION_SQL`) if you prefer to run
it manually in your database's SQL editor instead.

### 3. Configure environment

```bash
cp .env.example .env.local
# Fill in your values
```

### 4. Run locally

```bash
npm run dev
```

### 5. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Link to your project
vercel link

# Add environment variables (see .env.example for the full list)
vercel env add DATABASE_URL
vercel env add ADMIN_USERNAME
vercel env add ADMIN_PASSWORD
vercel env add AUTH_SECRET
vercel env add ADMIN_SECRET
vercel env add OPENAI_API_KEY
vercel env add BROWSERLESS_TOKEN
vercel env add CRON_SECRET
vercel env add NEXT_PUBLIC_APP_URL

# Deploy
vercel --prod
```

### 6. Set up GitHub Actions

Add these secrets to your GitHub repo (Settings → Secrets):

- `VERCEL_TOKEN` — from vercel.com/account/tokens
- `VERCEL_ORG_ID` — from `vercel link` output
- `VERCEL_PROJECT_ID` — from `vercel link` output

## API

### Start a scan
```
POST /api/scan
{ "url": "https://cosmopolitan.com" }
→ { "jobId": "uuid", "status": "queued" }
```

### Poll scan status
```
GET /api/scan?jobId=uuid
→ { "status": "complete", "pagesScanned": 12, "uniquePatternCount": 34, "estimatedCostUsd": 0.07, ... }
```

### List recent scans
```
GET /api/scan
```

### Create a schedule
```
POST /api/schedules
{ "url": "https://cosmopolitan.com", "cadence": "weekly", "dayOfWeek": 1 }
```

## Cron

Vercel runs `/api/cron` daily at 02:00 UTC (the Hobby plan only allows daily crons).
It checks for due schedules and runs their scans in-process. The cron endpoint is
protected by `CRON_SECRET`.

## Jira integration

Violation cards include a **Create Jira ticket** action when the Jira integration is configured.
The recommended production setup is a shared Jira service account/bot:

1. Create a Jira user such as `accessibility-bot@example.com`.
2. Give that user permission to create issues in the target Jira project.
3. Create a Jira API token for that service account.
4. Set `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_PROJECT_KEY`, and optionally `JIRA_ISSUE_TYPE`.

With this setup, individual app users do not need to provide Jira credentials. Tickets are created by the bot, while the ticket description carries scan and violation context.

If your organization requires tickets to be created as each signed-in user's own Jira identity, implement Atlassian OAuth 2.0 (3LO) and store encrypted per-user refresh tokens. Avoid asking users to paste personal Jira API tokens into this app; OAuth gives revocation, consent, and least-privilege scopes.

