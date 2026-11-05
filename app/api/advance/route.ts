import { env } from 'cloudflare:workers';
import { isAdmin, unauthorized } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'no-store' };

/** Current "skip ahead" counter. Tickers poll this every few seconds and skip when it goes up. */
export async function GET() {
  try {
    const row = await env.DB.prepare('SELECT advance_seq AS seq FROM ticker_settings WHERE id = 1').first<{ seq: number }>();
    return Response.json({ seq: row?.seq ?? 0 }, { headers: noStore });
  } catch {
    return Response.json({ seq: null }, { headers: noStore });
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
