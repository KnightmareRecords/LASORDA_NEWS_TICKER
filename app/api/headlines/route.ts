import { env } from 'cloudflare:workers';

export const dynamic = 'force-dynamic';
const ESPN_FEED = 'https://www.espn.com/espn/rss/news';

type Headline = { id: string; text: string; source: 'ESPN' | 'LIVE' };
type CustomRow = { id: number; text: string; placement: 'rotation' | 'next' };

function decodeXml(value: string) {
  return value
    .replace(/^<!\[CDATA\[|\]\]>$/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<[^>]+>/g, '')
    .trim();
}

async function getEspnHeadlines(): Promise<Headline[]> {
  const response = await fetch(ESPN_FEED, {
    headers: { 'User-Agent': 'OBS-Live-Ticker/1.0' },
  });
  if (!response.ok) throw new Error(`ESPN returned ${response.status}`);
  const xml = await response.text();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
    .slice(0, 24)
    .map((match, index) => {
      const title = match[1].match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '';
      const guid = match[1].match(/<guid[^>]*>([\s\S]*?)<\/guid>/)?.[1] ?? `espn-${index}`;
      return { id: decodeXml(guid), text: decodeXml(title), source: 'ESPN' as const };
    })
    .filter((item) => item.text);
}

export async function GET(request: Request) {
  const consumeNext = new URL(request.url).searchParams.get('consumeNext') === '1';
  const customResult = await env.DB.prepare(
    "SELECT id, text, placement FROM custom_headlines WHERE enabled = 1 ORDER BY CASE placement WHEN 'next' THEN 0 ELSE 1 END, created_at DESC",
  ).all<CustomRow>();
  const custom = customResult.results;

  let espn: Headline[] = [];
  let espnAvailable = true;
  try {
    espn = await getEspnHeadlines();
  } catch (error) {
    console.error('ESPN feed fetch failed', error);
    espnAvailable = false;
  }

  const next = custom.filter((item) => item.placement === 'next').map((item) => ({ id: `custom-${item.id}`, text: item.text, source: 'LIVE' as const }));
  const rotation = custom.filter((item) => item.placement === 'rotation').map((item) => ({ id: `custom-${item.id}`, text: item.text, source: 'LIVE' as const }));
  const mixed: Headline[] = [...next];
  espn.forEach((item, index) => {
    mixed.push(item);
    if ((index + 1) % 4 === 0 && rotation.length) mixed.push(rotation[Math.floor(index / 4) % rotation.length]);
  });
  if (!espn.length) mixed.push(...rotation);

  if (consumeNext && next.length) {
    const ids = custom.filter((item) => item.placement === 'next').map((item) => item.id);
    const placeholders = ids.map(() => '?').join(',');
    await env.DB.prepare(`UPDATE custom_headlines SET placement = 'rotation' WHERE id IN (${placeholders})`).bind(...ids).run();
  }

  return Response.json({ headlines: mixed, espnAvailable, updatedAt: Date.now() }, { headers: { 'Cache-Control': 'no-store' } });
}
