import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Full app state: every study log + settings, in one round trip. */
export async function GET() {
  try {
    const [logs, settings] = await Promise.all([
      sql`SELECT to_char(log_date, 'YYYY-MM-DD') AS date, block, minutes FROM study_logs WHERE minutes > 0 ORDER BY log_date`,
      sql`SELECT key, value FROM settings`,
    ]);
    const settingsMap: Record<string, unknown> = {};
    for (const row of settings as { key: string; value: unknown }[]) {
      settingsMap[row.key] = row.value;
    }
    return NextResponse.json({ logs, settings: settingsMap });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'failed to load state' }, { status: 500 });
  }
}
