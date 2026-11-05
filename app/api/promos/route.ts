import { env } from 'cloudflare:workers';
import { isAdmin, unauthorized } from '@/lib/admin-auth';
import { cleanPromoText, PROMO_IMAGE_TYPES, PROMO_MAX_BYTES, PROMO_SELECT, PROMO_VIDEO_TYPES, toPromo, type PromoRow } from '@/lib/promos';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await env.DB.prepare(PROMO_SELECT).all<PromoRow>();
    return Response.json(result.results.map(toPromo), { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    // Table missing (migration not applied yet) or a DB hiccup: the ticker just runs without promos.
    return Response.json([], { headers: { 'Cache-Control': 'no-store' } });
  }
}

async function nextPosition() {
  const row = await env.DB.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS next FROM promos').first<{ next: number }>();
  return row?.next ?? 0;
}

/** Add a promo: JSON { text } for a text slide, or a form upload with a `file` (image/GIF/video). */
export async function POST(request: Request) {
  if (!isAdmin(request)) return unauthorized();
  const contentType = request.headers.get('Content-Type') ?? '';

  if (contentType.includes('application/json')) {
    const body = (await request.json().catch(() => ({}))) as { text?: unknown };
    const text = cleanPromoText(body.text);
    if (!text) return Response.json({ error: 'Type the promo text first.' }, { status: 400 });
    const result = await env.DB.prepare('INSERT INTO promos (kind, text, enabled, position, created_at) VALUES (?, ?, 1, ?, ?)')
      .bind('text', text, await nextPosition(), Date.now()).run();
    return Response.json({ id: result.meta.last_row_id }, { status: 201 });
  }

  if (!env.MEDIA) {
    return Response.json({ error: 'File storage (Cloudflare R2) is not turned on for this site yet. Text promos still work.' }, { status: 503 });
  }
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!file || typeof file === 'string') return Response.json({ error: 'Choose a file to upload.' }, { status: 400 });
  const type = file.type.toLowerCase();
  const kind = PROMO_IMAGE_TYPES.includes(type) ? 'image' : PROMO_VIDEO_TYPES.includes(type) ? 'video' : null;
  if (!kind) return Response.json({ error: 'Use a PNG, JPG, GIF, WebP, MP4 or WebM file.' }, { status: 400 });
  if (file.size > PROMO_MAX_BYTES) return Response.json({ error: 'That file is over 25 MB. Export a smaller version.' }, { status: 400 });

  const extension = type.split('/')[1].replace('jpeg', 'jpg');
  const key = `promo-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extension}`;
  try {
    await env.MEDIA.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: type } });
  } catch {
    return Response.json({ error: 'The upload did not save. Check that R2 file storage is turned on, then try again.' }, { status: 503 });
  }
  const label = cleanPromoText(form?.get('label')) || cleanPromoText(file.name.replace(/\.[^.]+$/, ''));
  const result = await env.DB.prepare('INSERT INTO promos (kind, text, media_key, media_type, enabled, position, created_at) VALUES (?, ?, ?, ?, 1, ?, ?)')
    .bind(kind, label, key, type, await nextPosition(), Date.now()).run();
  return Response.json({ id: result.meta.last_row_id }, { status: 201 });
}

/** Reorder: { order: [id, id, …] }; the first id plays first. */
export async function PATCH(request: Request) {
  if (!isAdmin(request)) return unauthorized();
  const body = (await request.json().catch(() => ({}))) as { order?: unknown };
  if (!Array.isArray(body.order) || body.order.length === 0 || !body.order.every((id) => Number.isInteger(id))) {
    return Response.json({ error: 'Invalid order.' }, { status: 400 });
  }
  const statement = env.DB.prepare('UPDATE promos SET position = ? WHERE id = ?');
  await env.DB.batch((body.order as number[]).map((id, index) => statement.bind(index, id)));
  return Response.json({ ok: true });
}
