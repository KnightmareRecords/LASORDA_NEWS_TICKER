import { env } from 'cloudflare:workers';
import { isAdmin, unauthorized } from '@/lib/admin-auth';
import { cleanPromoText } from '@/lib/promos';
import { readJsonObject } from '@/lib/request-body';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isAdmin(request)) return unauthorized();
  const numericId = Number((await context.params).id);
  if (!Number.isInteger(numericId)) return Response.json({ error: 'Invalid id.' }, { status: 400 });
  const body = await readJsonObject(request);
  if (typeof body.enabled === 'boolean') {
    await env.DB.prepare('UPDATE promos SET enabled = ? WHERE id = ?').bind(body.enabled ? 1 : 0, numericId).run();
  }
  if ('text' in body) {
    const text = cleanPromoText(body.text);
    if (text) await env.DB.prepare('UPDATE promos SET text = ? WHERE id = ?').bind(text, numericId).run();
  }
  return Response.json({ ok: true });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isAdmin(request)) return unauthorized();
  const numericId = Number((await context.params).id);
  if (!Number.isInteger(numericId)) return Response.json({ error: 'Invalid id.' }, { status: 400 });
  const row = await env.DB.prepare('SELECT media_key AS mediaKey FROM promos WHERE id = ?').bind(numericId).first<{ mediaKey: string | null }>();
  await env.DB.prepare('DELETE FROM promos WHERE id = ?').bind(numericId).run();
  // Removing the file is best-effort; a leftover file is harmless.
  if (row?.mediaKey && env.MEDIA) await env.MEDIA.delete(row.mediaKey).catch(() => undefined);
  return Response.json({ ok: true });
}
