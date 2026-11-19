import { env } from 'cloudflare:workers';
import { isAdmin, unauthorized } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'no-store' };

/**
 * Current "skip ahead" counter (tickers skip when it goes up) and the break number shown in the tab
 * under the bar (0 = blank). Tickers poll this every few seconds, so the break tab costs no extra requests.
 */
export async function GET() {
  try {
    const row = await env.DB.prepare('SELECT advance_seq AS seq, break_number AS breakNumber FROM ticker_settings WHERE id = 1').first<{ seq: number; breakNumber: number }>();
    return Response.json({ seq: row?.seq ?? 0, breakNumber: row?.breakNumber ?? 0 }, { headers: noStore });
  } catch {
    return Response.json({ seq: null, breakNumber: null }, { headers: noStore });
  }
}

/** "Skip ahead" button: bump the counter. */
export async function POST(request: Request) {
  if (!isAdmin(request)) return unauthorized();
  // Make sure the settings row exists (fresh database), then bump.
  await env.DB.prepare('INSERT OR IGNORE INTO ticker_settings (id, updated_at) VALUES (1, ?)').bind(Date.now()).run();
  const row = await env.DB.prepare('UPDATE ticker_settings SET advance_seq = advance_seq + 1 WHERE id = 1 RETURNING advance_seq AS seq').first<{ seq: number }>();
  return Response.json({ seq: row?.seq ?? 0 }, { headers: noStore });
}
