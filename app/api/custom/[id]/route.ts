import { env } from 'cloudflare:workers';
import { isAdmin, unauthorized } from '@/lib/admin-auth';
import { cleanTag, cleanTeam } from '@/lib/headline-fields';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isAdmin(request)) return unauthorized();
  const { id } = await context.params;
  const numericId = Number(id);
  const body = (await request.json()) as { enabled?: boolean; placement?: string; team?: unknown; tag?: unknown };
  if (!Number.isInteger(numericId)) return Response.json({ error: 'Invalid id.' }, { status: 400 });

  if (typeof body.enabled === 'boolean') {
    await env.DB.prepare('UPDATE custom_headlines SET enabled = ? WHERE id = ?').bind(body.enabled ? 1 : 0, numericId).run();
  }
  if (body.placement === 'next' || body.placement === 'rotation') {
    await env.DB.prepare('UPDATE custom_headlines SET placement = ? WHERE id = ?').bind(body.placement, numericId).run();
  }
  if ('team' in body) {
    await env.DB.prepare('UPDATE custom_headlines SET team = ? WHERE id = ?').bind(cleanTeam(body.team), numericId).run();
  }
  if ('tag' in body) {
    await env.DB.prepare('UPDATE custom_headlines SET tag = ? WHERE id = ?').bind(cleanTag(body.tag), numericId).run();
  }
  return Response.json({ ok: true });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isAdmin(request)) return unauthorized();
  const { id } = await context.params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) return Response.json({ error: 'Invalid id.' }, { status: 400 });
  await env.DB.prepare('DELETE FROM custom_headlines WHERE id = ?').bind(numericId).run();
  return Response.json({ ok: true });
}
