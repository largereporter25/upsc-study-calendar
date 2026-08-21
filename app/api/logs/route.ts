import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { BLOCK_IDS } from '@/lib/blocks';

export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Upsert minutes for a (date, block) cell.
 * Body: { date: 'YYYY-MM-DD', block: BlockId, set?: number, delta?: number }
 * Returns the resulting minutes.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { date, block } = body;
    if (!DATE_RE.test(date ?? '') || !BLOCK_IDS.includes(block)) {
      return NextResponse.json({ error: 'invalid date or block' }, { status: 400 });
    }

    let rows;
    if (typeof body.set === 'number') {
      const minutes = Math.max(0, Math.min(960, Math.round(body.set)));
      rows = await sql`
        INSERT INTO study_logs (log_date, block, minutes, updated_at)
        VALUES (${date}, ${block}, ${minutes}, now())
        ON CONFLICT (log_date, block)
        DO UPDATE SET minutes = ${minutes}, updated_at = now()
        RETURNING minutes`;
    } else if (typeof body.delta === 'number') {
      const delta = Math.round(body.delta);
      rows = await sql`
        INSERT INTO study_logs (log_date, block, minutes, updated_at)
        VALUES (${date}, ${block}, GREATEST(0, ${delta}), now())
        ON CONFLICT (log_date, block)
        DO UPDATE SET minutes = LEAST(960, GREATEST(0, study_logs.minutes + ${delta})), updated_at = now()
        RETURNING minutes`;
    } else {
      return NextResponse.json({ error: 'provide set or delta' }, { status: 400 });
    }

    return NextResponse.json({ date, block, minutes: rows[0].minutes });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'failed to save log' }, { status: 500 });
  }
}
