import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { BLOCK_IDS } from '@/lib/blocks';

export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Spaced-repetition intervals in days from the day a topic was studied. */
const INTERVALS = [1, 7, 21, 60];

/** All open revision items (due + upcoming), oldest due first. */
export async function GET() {
  try {
    const items = await sql`
      SELECT id, title, block, stage,
             to_char(studied_on, 'YYYY-MM-DD') AS studied_on,
             to_char(next_review, 'YYYY-MM-DD') AS next_review
      FROM revision_items
      WHERE completed = false
      ORDER BY next_review ASC, id ASC
      LIMIT 200`;
    return NextResponse.json({ items });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'failed to load revision items' }, { status: 500 });
  }
}

/**
 * Add a topic or mark one reviewed.
 * Add:    { action: 'add', title, block, studiedOn: 'YYYY-MM-DD' }
 * Review: { action: 'review', id, today: 'YYYY-MM-DD' }
 * Remove: { action: 'remove', id }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body.action === 'add') {
      const title = (body.title ?? '').toString().trim().slice(0, 200);
      if (!title || !BLOCK_IDS.includes(body.block) || !DATE_RE.test(body.studiedOn ?? '')) {
        return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
      }
      const rows = await sql`
        INSERT INTO revision_items (title, block, studied_on, stage, next_review)
        VALUES (${title}, ${body.block}, ${body.studiedOn},
                0, ${body.studiedOn}::date + ${INTERVALS[0]}::int)
        RETURNING id, title, block, stage,
                  to_char(studied_on, 'YYYY-MM-DD') AS studied_on,
                  to_char(next_review, 'YYYY-MM-DD') AS next_review`;
      return NextResponse.json({ item: rows[0] });
    }

    if (body.action === 'review') {
      const id = Number(body.id);
      const today = DATE_RE.test(body.today ?? '') ? body.today : null;
      if (!Number.isInteger(id) || !today) {
        return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
      }
      const rows = await sql`
        UPDATE revision_items SET
          stage = stage + 1,
          completed = (stage + 1 >= ${INTERVALS.length}::int),
          next_review = CASE
            WHEN stage + 1 >= ${INTERVALS.length}::int THEN next_review
            ELSE GREATEST(
              studied_on + (${JSON.stringify(INTERVALS)}::jsonb ->> (stage + 1))::int,
              ${today}::date + 1
            )
          END
        WHERE id = ${id} AND completed = false
        RETURNING id, title, block, stage, completed,
                  to_char(studied_on, 'YYYY-MM-DD') AS studied_on,
                  to_char(next_review, 'YYYY-MM-DD') AS next_review`;
      return NextResponse.json({ item: rows[0] ?? null });
    }

    if (body.action === 'remove') {
      const id = Number(body.id);
      if (!Number.isInteger(id)) {
        return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
      }
      await sql`DELETE FROM revision_items WHERE id = ${id}`;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'failed to update revision items' }, { status: 500 });
  }
}
