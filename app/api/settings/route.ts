import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

const ALLOWED_KEYS = ['daily_target_minutes', 'ramp'];

/** Update a settings key. Body: { key, value } */
export async function PUT(req: Request) {
  try {
    const { key, value } = await req.json();
    if (!ALLOWED_KEYS.includes(key)) {
      return NextResponse.json({ error: 'unknown key' }, { status: 400 });
    }
    await sql`
      INSERT INTO settings (key, value, updated_at)
      VALUES (${key}, ${JSON.stringify(value)}::jsonb, now())
      ON CONFLICT (key)
      DO UPDATE SET value = ${JSON.stringify(value)}::jsonb, updated_at = now()`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'failed to save settings' }, { status: 500 });
  }
}
