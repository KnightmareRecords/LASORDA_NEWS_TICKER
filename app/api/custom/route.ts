import { env } from 'cloudflare:workers';
import { isAdmin, unauthorized } from '@/lib/admin-auth';
import { cleanTag, cleanTeam } from '@/lib/headline-fields';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await env.DB.prepare(
    'SELECT id, text, enabled, placement, team, tag, created_at AS createdAt FROM custom_headlines ORDER BY created_at DESC',
  ).all();
  return Response.json(result.results);
}

export async function POST(request: Request) {
  if (!isAdmin(request)) return unauthorized();
  const body = (await request.json()) as { text?: string; placement?: string; team?: unknown; tag?: unknown };
  const headline = body.text?.trim().slice(0, 180);
  const placement = body.placement === 'next' ? 'next' : 'rotation';
  const team = cleanTeam(body.team);
  const tag = cleanTag(body.tag);
  if (!headline) return Response.json({ error: 'Headline text is required.' }, { status: 400 });

  const result = await env.DB.prepare(
    'INSERT INTO custom_headlines (text, enabled, placement, team, tag, created_at) VALUES (?, 1, ?, ?, ?, ?)',
  ).bind(headline, placement, team, tag, Date.now()).run();
  return Response.json({ id: result.meta.last_row_id, text: headline, enabled: true, placement, team, tag }, { status: 201 });
}
