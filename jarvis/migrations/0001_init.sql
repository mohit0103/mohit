-- Jarvis memory and scheduling store. All timestamps are UTC ISO strings so they sort lexically.

CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL);

-- Telegram update ids already handled (dedupe of webhook retries).
CREATE TABLE IF NOT EXISTS updates (id INTEGER PRIMARY KEY, at TEXT NOT NULL);

-- Scheduled jobs already claimed (e.g. "briefing:2026-10-03"), so a slot runs once.
CREATE TABLE IF NOT EXISTS runs (key TEXT PRIMARY KEY, at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL,            -- user | jarvis
  text TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'chat', -- chat | briefing | checkin | followup | reminder | nudge | review
  at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_at ON messages(at);

CREATE TABLE IF NOT EXISTS facts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  created_at TEXT NOT NULL,
  superseded_at TEXT
);

CREATE TABLE IF NOT EXISTS people (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  relation TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  birthday TEXT NOT NULL DEFAULT '',  -- MM-DD
  last_contact TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  all_day INTEGER NOT NULL DEFAULT 0,
  followup_at TEXT,
  followup_question TEXT NOT NULL DEFAULT '',
  remind_before INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'planned', -- planned | done | cancelled
  outcome TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'chat',    -- chat | email
  source_ref TEXT,
  followup_sent INTEGER NOT NULL DEFAULT 0,
  prealert_sent INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE(source, source_ref)
);
CREATE INDEX IF NOT EXISTS plans_starts ON plans(starts_at);

CREATE TABLE IF NOT EXISTS reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  due_at TEXT NOT NULL,
  sent_at TEXT,
  done INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS reminders_due ON reminders(due_at);

CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  cadence TEXT NOT NULL DEFAULT 'daily', -- daily | weekly | once
  status TEXT NOT NULL DEFAULT 'active', -- active | done | dropped
  streak INTEGER NOT NULL DEFAULT 0,
  last_checkin TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS goal_checkins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  goal_id INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS diary (
  date TEXT PRIMARY KEY,           -- local date YYYY-MM-DD
  summary TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  mood_label TEXT NOT NULL DEFAULT '',
  mood_score INTEGER
);

CREATE TABLE IF NOT EXISTS moods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL,
  score INTEGER NOT NULL,
  at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS emails (
  uid INTEGER PRIMARY KEY,
  sender TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  received_at TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'other',
  importance TEXT NOT NULL DEFAULT 'normal',
  briefed INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS admin_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,             -- bill | delivery | refund | subscription | document | other
  title TEXT NOT NULL,
  due_at TEXT,
  amount TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open', -- open | done
  source_ref TEXT UNIQUE,
  notified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
