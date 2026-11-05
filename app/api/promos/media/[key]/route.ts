import { env } from 'cloudflare:workers';
import { parseMediaRange } from '@/lib/media-range';

export const dynamic = 'force-dynamic';

/** Serves an uploaded promo file from R2. Keys are unique per upload, so files are cached for good. */
export async function GET(request: Request, context: { params: Promise<{ key: string }> }) {
  const key = (await context.params).key;
  if (!env.MEDIA || !/^promo-[\w.-]+$/.test(key)) return new Response('Not found', { status: 404 });

  // Byte ranges, so video players (OBS / Chrome) can stream and loop without downloading twice.
  const requested = request.headers.get('Range');
  let range: { offset: number; length: number } | undefined;
  if (requested) {
    const metadata = await env.MEDIA.head(key);
    if (!metadata) return new Response('Not found', { status: 404 });
    const parsed = parseMediaRange(requested, metadata.size);
    if (!parsed) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${metadata.size}` } });
    range = parsed;
  }
  const object = await env.MEDIA.get(key, range ? { range } : undefined).catch(() => null);
  if (!object) return new Response('Not found', { status: 404 });

  const headers = new Headers({
    'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Accept-Ranges': 'bytes',
    ETag: object.httpEtag,
  });
  if (range) {
    const offset = range.offset;
    const length = range.length;
    headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${object.size}`);
    headers.set('Content-Length', String(length));
    return new Response(object.body, { status: 206, headers });
  }
  headers.set('Content-Length', String(object.size));
  return new Response(object.body, { headers });
}
