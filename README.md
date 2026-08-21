# Ascent — UPSC CSE 2027 Study Calendar

A Swiss-minimal, database-backed study calendar and focus timer built for one climb: **UPSC CSE 2027**.

Five blocks a day. One mountain. Summit on **23 May 2027** (Prelims), high camp on **20 Aug 2027** (Mains).

## The idea

Every study day is split into five blocks, each with its own hour counter and daily target:

1. **GS Static** — Polity, History, Geography, Economy, NCERTs
2. **GS Dynamic** — current affairs mapped to syllabus lines
3. **Optional · PSIR** — Political Science & International Relations
4. **Revision** — closed-book recall, notes consolidation
5. **CSAT** — weekly insurance: maths, comprehension, speed

### The Ascent

The main screen renders a mountain. Each block is a climber roped to the others; a climber's
position is its **cumulative hours ÷ total hours required by Prelims day** (daily target × days
in the journey). A dashed ring marks **pace** — where every climber should be today. Camps I–III
sit at 25 / 50 / 75%. The summit flag reads AIR 1.

### Zoomable calendar

Year → month → day. Click a month card to magnify it, click a day to open its five blocks,
click the breadcrumb to collapse back. The year view is an intensity grid; the month view shows
a five-bar mini chart per day (one bar per block, height = share of that block's daily target).

### Focus timer

Classic Pomodoro — 25 min work, 5 min break, every fourth break 15 min. Each completed work
interval is written to the database and credited to the selected block automatically. Ending
early logs the elapsed whole minutes.

### Pace ramp

The daily target ramps from **5.25 h/day to 8 h/day over 16 weeks** (editable in the
`settings` table), so "Today vs ramp target" reflects a sustainable build-up, not a fantasy.

## Stack

- **Next.js** (App Router) + React, plain CSS design tokens — no UI framework
- **Neon** serverless Postgres (`study_logs`, `focus_sessions`, `settings`, `day_notes`)
- **Vercel** for hosting

## Running locally

```bash
cp .env.example .env.local   # add your Neon DATABASE_URL
npm install
npm run dev
```

## Schema

```sql
CREATE TABLE study_logs (
  id SERIAL PRIMARY KEY,
  log_date DATE NOT NULL,
  block TEXT NOT NULL CHECK (block IN ('gs_static','gs_dynamic','optional','revision','csat')),
  minutes INTEGER NOT NULL DEFAULT 0 CHECK (minutes >= 0 AND minutes <= 960),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (log_date, block)
);

CREATE TABLE focus_sessions (
  id SERIAL PRIMARY KEY,
  block TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  minutes INTEGER,
  note TEXT
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE day_notes (
  log_date DATE PRIMARY KEY,
  note TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Exam dates from the official UPSC Annual Calendar 2027 (released 20 May 2026).
