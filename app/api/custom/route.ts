import { env } from 'cloudflare:workers';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await env.DB.prepare(
    'SELECT id, text, enabled, placement, created_at AS createdAt FROM custom_headlines ORDER BY created_at DESC',
  ).all();
  return Response.json(result.results);
}

export async function POST(request: Request) {
  const body = (await request.json()) as { text?: string; placement?: string };
  const headline = body.text?.trim().slice(0, 180);
  const placement = body.placement === 'next' ? 'next' : 'rotation';
  if (!headline) return Response.json({ error: 'Headline text is required.' }, { status: 400 });

  const result = await env.DB.prepare(
    'INSERT INTO custom_headlines (text, enabled, placement, created_at) VALUES (?, 1, ?, ?)',
  ).bind(headline, placement, Date.now()).run();
  return Response.json({ id: result.meta.last_row_id, text: headline, enabled: true, placement }, { status: 201 });
}
