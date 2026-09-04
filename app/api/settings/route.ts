import { env } from 'cloudflare:workers';
import { isAdmin, unauthorized } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

const defaults = {
  accentColor: '#ffb000',
  backgroundColor: '#0a0e16',
  textColor: '#ffffff',
  fontFamily: 'Geist',
  fontSize: 25,
};

const fonts = ['Geist', 'Arial', 'Impact', 'Georgia', 'Courier New'];
const isHex = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);

export async function GET() {
  const row = await env.DB.prepare(
    'SELECT accent_color AS accentColor, background_color AS backgroundColor, text_color AS textColor, font_family AS fontFamily, font_size AS fontSize FROM ticker_settings WHERE id = 1',
  ).first();
  return Response.json(row || defaults, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(request: Request) {
  if (!isAdmin(request)) return unauthorized();
  const body = (await request.json()) as Record<string, unknown>;
  const settings = {
    accentColor: isHex(body.accentColor) ? body.accentColor : defaults.accentColor,
    backgroundColor: isHex(body.backgroundColor) ? body.backgroundColor : defaults.backgroundColor,
    textColor: isHex(body.textColor) ? body.textColor : defaults.textColor,
    fontFamily: typeof body.fontFamily === 'string' && fonts.includes(body.fontFamily) ? body.fontFamily : defaults.fontFamily,
    fontSize: typeof body.fontSize === 'number' && body.fontSize >= 18 && body.fontSize <= 36 ? Math.round(body.fontSize) : defaults.fontSize,
  };
  await env.DB.prepare(
    `INSERT INTO ticker_settings (id, accent_color, background_color, text_color, font_family, font_size, updated_at)
     VALUES (1, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET accent_color = excluded.accent_color, background_color = excluded.background_color,
       text_color = excluded.text_color, font_family = excluded.font_family, font_size = excluded.font_size, updated_at = excluded.updated_at`,
  ).bind(settings.accentColor, settings.backgroundColor, settings.textColor, settings.fontFamily, settings.fontSize, Date.now()).run();
  return Response.json(settings);
}
