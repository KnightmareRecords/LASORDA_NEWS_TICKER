import { env } from 'cloudflare:workers';
import { isAdmin, unauthorized } from '@/lib/admin-auth';
import { readJsonObject } from '@/lib/request-body';
import { MAX_BREAK } from '@/lib/break-number';

export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'no-store' };

/** Current break number (0 = blank). The /break tab polls this every few seconds. */
export async function GET() {
  try {
    const row = await env.DB.prepare('SELECT break_number AS number FROM ticker_settings WHERE id = 1').first<{ number: number }>();
    return Response.json({ number: row?.number ?? 0 }, { headers: noStore });
  } catch {
    // Never an error on air: the tab keeps showing what it had.
    return Response.json({ number: null }, { headers: noStore });
  }
}

/** Control panel dropdown: set the break number (0–10). */
export async function POST(request: Request) {
  if (!isAdmin(request)) return unauthorized();
  const body = await readJsonObject(request);
  const number = body.number;
  if (typeof number !== 'number' || !Number.isInteger(number) || number < 0 || number > MAX_BREAK) {
    return Response.json({ error: `Break number must be 0–${MAX_BREAK}.` }, { status: 400, headers: noStore });
  }
  // Make sure the settings row exists (fresh database), then save.
  await env.DB.prepare('INSERT OR IGNORE INTO ticker_settings (id, updated_at) VALUES (1, ?)').bind(Date.now()).run();
  await env.DB.prepare('UPDATE ticker_settings SET break_number = ? WHERE id = 1').bind(number).run();
  return Response.json({ number }, { headers: noStore });
}
