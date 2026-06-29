import { pgTable, text, integer, real, boolean, timestamp, jsonb, uuid } from 'drizzle-orm/pg-core'

export const scanJobs = pgTable('scan_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  rootUrl: text('root_url').notNull(),
  status: text('status').notNull().default('queued'), // queued | running | complete | failed
  siteId: uuid('site_id'),
  score: real('score').default(0),
  pagesScanned: integer('pages_scanned').default(0),
  pagesSkipped: integer('pages_skipped').default(0),
  totalPages: integer('total_pages').default(0),
  rawViolationCount: integer('raw_violation_count').default(0),
  uniquePatternCount: integer('unique_pattern_count').default(0),
  claudeCallCount: integer('claude_call_count').default(0),
  estimatedCostUsd: real('estimated_cost_usd').default(0),
  patterns: jsonb('patterns').default([]),
  pageScores: jsonb('page_scores').default([]),
  progress: jsonb('progress'),
  error: text('error'),
  startedAt: timestamp('started_at').defaultNow(),
  completedAt: timestamp('completed_at'),
  triggeredBy: text('triggered_by').default('manual'), // manual | schedule
  scheduleId: uuid('schedule_id'),
})

export const schedules = pgTable('schedules', {
  id: uuid('id').primaryKey().defaultRandom(),
  rootUrl: text('root_url').notNull(),
  cadence: text('cadence').notNull(), // daily | weekly | monthly
  dayOfWeek: integer('day_of_week'),   // 0-6
  dayOfMonth: integer('day_of_month'), // 1-31
  enabled: boolean('enabled').default(true),
  lastRunAt: timestamp('last_run_at'),
  nextRunAt: timestamp('next_run_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  createdBy: text('created_by'),
})

export const sites = pgTable('sites', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  division: text('division'),
  brand: text('brand'),
  region: text('region'),
  pages: jsonb('pages').default([]),  // SitePage[]
  scheduleId: uuid('schedule_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  role: text('role').notNull().default('user'), // 'admin' | 'user'
  allowedDivisions: jsonb('allowed_divisions').default([]), // [] = all (admin), [...] = specific divisions
  inviteToken: text('invite_token'),
  inviteExpiresAt: timestamp('invite_expires_at'),
  invitedBy: text('invited_by'),
  createdAt: timestamp('created_at').defaultNow(),
})

// Triage state for a violation pattern on a site (persists across scans, keyed
// by site + fingerprint). Absence of a row = 'open'.
export const violationTriage = pgTable('violation_triage', {
  id: uuid('id').primaryKey().defaultRandom(),
  siteId: uuid('site_id').notNull(),
  fingerprint: text('fingerprint').notNull(),
  status: text('status').notNull().default('open'), // open | fixed | wontfix | false_positive
  note: text('note'),
  updatedBy: text('updated_by'),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// Migration SQL — run this in your Neon/Supabase SQL editor
export const MIGRATION_SQL = `
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS scan_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  root_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  site_id UUID,
  score REAL DEFAULT 0,
  pages_scanned INTEGER DEFAULT 0,
  pages_skipped INTEGER DEFAULT 0,
  total_pages INTEGER DEFAULT 0,
  raw_violation_count INTEGER DEFAULT 0,
  unique_pattern_count INTEGER DEFAULT 0,
  claude_call_count INTEGER DEFAULT 0,
  estimated_cost_usd REAL DEFAULT 0,
  patterns JSONB DEFAULT '[]',
  page_scores JSONB DEFAULT '[]',
  progress JSONB,
  error TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  triggered_by TEXT DEFAULT 'manual',
  schedule_id UUID
);

CREATE TABLE IF NOT EXISTS schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  root_url TEXT NOT NULL,
  cadence TEXT NOT NULL,
  day_of_week INTEGER,
  day_of_month INTEGER,
  enabled BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS sites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  division TEXT,
  brand TEXT,
  region TEXT,
  pages JSONB DEFAULT '[]',
  schedule_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS scan_jobs_root_url ON scan_jobs(root_url);
CREATE INDEX IF NOT EXISTS scan_jobs_status ON scan_jobs(status);
CREATE INDEX IF NOT EXISTS scan_jobs_started_at ON scan_jobs(started_at DESC);
CREATE INDEX IF NOT EXISTS scan_jobs_site_id ON scan_jobs(site_id);
CREATE INDEX IF NOT EXISTS schedules_next_run ON schedules(next_run_at) WHERE enabled = true;

ALTER TABLE scan_jobs ADD COLUMN IF NOT EXISTS site_id UUID;
ALTER TABLE scan_jobs ADD COLUMN IF NOT EXISTS score REAL DEFAULT 0;
ALTER TABLE scan_jobs ADD COLUMN IF NOT EXISTS page_scores JSONB DEFAULT '[]';
ALTER TABLE scan_jobs ADD COLUMN IF NOT EXISTS progress JSONB;
ALTER TABLE scan_jobs ADD COLUMN IF NOT EXISTS schedule_id UUID;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS division TEXT;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS region TEXT;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  allowed_divisions JSONB DEFAULT '[]',
  invite_token TEXT,
  invite_expires_at TIMESTAMPTZ,
  invited_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS violation_triage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL,
  fingerprint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  note TEXT,
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (site_id, fingerprint)
);
CREATE INDEX IF NOT EXISTS violation_triage_site ON violation_triage(site_id);
`
