import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { BLOCK_IDS } from '@/lib/blocks';

export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Record a completed focus (Pomodoro) session and credit its minutes
 * to the day's study log in one shot.
 * Body: { block, date: 'YYYY-MM-DD', startedAt: ISO, endedAt: ISO, minutes, note? }
 */
export async function POST(req: Request) {
  try {
    const { block, date, startedAt, endedAt, minutes, note } = await req.json();
    if (!BLOCK_IDS.includes(block) || !DATE_RE.test(date ?? '') || typeof minutes !== 'number') {
      return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
    }
    const mins = Math.max(1, Math.min(240, Math.round(minutes)));

    await sql`
      INSERT INTO focus_sessions (block, started_at, ended_at, minutes, note)
      VALUES (${block}, ${startedAt}, ${endedAt}, ${mins}, ${note ?? null})`;

    const rows = await sql`
      INSERT INTO study_logs (log_date, block, minutes, updated_at)
      VALUES (${date}, ${block}, ${mins}, now())
      ON CONFLICT (log_date, block)
      DO UPDATE SET minutes = LEAST(960, study_logs.minutes + ${mins}), updated_at = now()
      RETURNING minutes`;

    return NextResponse.json({ date, block, minutes: rows[0].minutes });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'failed to record session' }, { status: 500 });
  }
}

/** Recent focus sessions (for the session log strip). */
export async function GET() {
  try {
    const rows = await sql`
      SELECT id, block, started_at, ended_at, minutes, note
      FROM focus_sessions ORDER BY started_at DESC LIMIT 30`;
    return NextResponse.json({ sessions: rows });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'failed to load sessions' }, { status: 500 });
  }
}
