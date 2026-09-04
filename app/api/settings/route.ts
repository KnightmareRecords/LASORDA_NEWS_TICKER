import { env } from 'cloudflare:workers';
import { isAdmin, unauthorized } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

const defaults = {
  accentColor: '#ffb000',
  backgroundColor: '#0a0e16',
  textColor: '#ffffff',
  fontFamily: 'Geist',
  fontSize: 25,
  scrollSpeed: 90,
  feedUrl: 'https://news.google.com/rss/topics/CAAqKggKIiRDQkFTRlFvSUwyMHZNRFp1ZEdvU0JXVnVMVlZUR2dKVlV5Z0FQAQ?hl=en-US&gl=US&ceid=US:en',
  feedLabel: 'SPORTS',
};

const fonts = ['Geist', 'Arial', 'Impact', 'Georgia', 'Courier New'];
const isHex = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
const isSafeFeedUrl = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length > 2000) return false;
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol)) return false;
    const host = url.hostname.toLowerCase();
    return !(
      host === 'localhost' ||
      host === '::1' ||
      host.endsWith('.local') ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    );
  } catch {
    return false;
  }
};

export async function GET() {
  const row = await env.DB.prepare(
    'SELECT accent_color AS accentColor, background_color AS backgroundColor, text_color AS textColor, font_family AS fontFamily, font_size AS fontSize, scroll_speed AS scrollSpeed, feed_url AS feedUrl, feed_label AS feedLabel FROM ticker_settings WHERE id = 1',
  ).first();
  return Response.json(row || defaults, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(request: Request) {
  if (!isAdmin(request)) return unauthorized();
  const body = (await request.json()) as Record<string, unknown>;
  if (!isSafeFeedUrl(body.feedUrl)) {
    return Response.json({ error: 'Enter a valid public RSS or Atom URL.' }, { status: 400 });
  }
  const settings = {
    accentColor: isHex(body.accentColor) ? body.accentColor : defaults.accentColor,
    backgroundColor: isHex(body.backgroundColor) ? body.backgroundColor : defaults.backgroundColor,
    textColor: isHex(body.textColor) ? body.textColor : defaults.textColor,
    fontFamily: typeof body.fontFamily === 'string' && fonts.includes(body.fontFamily) ? body.fontFamily : defaults.fontFamily,
    fontSize: typeof body.fontSize === 'number' && body.fontSize >= 18 && body.fontSize <= 36 ? Math.round(body.fontSize) : defaults.fontSize,
    scrollSpeed: typeof body.scrollSpeed === 'number' && body.scrollSpeed >= 30 && body.scrollSpeed <= 180 ? Math.round(body.scrollSpeed) : defaults.scrollSpeed,
    feedUrl: body.feedUrl,
    feedLabel: typeof body.feedLabel === 'string' && body.feedLabel.trim() ? body.feedLabel.trim().slice(0, 18).toUpperCase() : defaults.feedLabel,
  };
  await env.DB.prepare(
    `INSERT INTO ticker_settings (id, accent_color, background_color, text_color, font_family, font_size, scroll_speed, feed_url, feed_label, updated_at)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET accent_color = excluded.accent_color, background_color = excluded.background_color,
       text_color = excluded.text_color, font_family = excluded.font_family, font_size = excluded.font_size,
       scroll_speed = excluded.scroll_speed, feed_url = excluded.feed_url, feed_label = excluded.feed_label, updated_at = excluded.updated_at`,
  ).bind(settings.accentColor, settings.backgroundColor, settings.textColor, settings.fontFamily, settings.fontSize, settings.scrollSpeed, settings.feedUrl, settings.feedLabel, Date.now()).run();
  return Response.json(settings);
}
