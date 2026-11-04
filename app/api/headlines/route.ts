import { env } from 'cloudflare:workers';

export const dynamic = 'force-dynamic';
const DEFAULT_FEED = 'https://news.google.com/rss/topics/CAAqKggKIiRDQkFTRlFvSUwyMHZNRFp1ZEdvU0JXVnVMVlZUR2dKVlV5Z0FQAQ?hl=en-US&gl=US&ceid=US:en';

type Headline = { id: string; text: string; source: string };
type CustomRow = { id: number; text: string; placement: 'rotation' | 'next' };
type FeedSettings = { feedUrl: string; feedLabel: string };

function decodeXml(value: string) {
  return value
    .replace(/^<!\[CDATA\[|\]\]>$/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/<[^>]+>/g, '')
    .trim();
}

async function getFeedHeadlines(feedUrl: string, feedLabel: string): Promise<Headline[]> {
  const response = await fetch(feedUrl, {
    signal: AbortSignal.timeout(8000),
    headers: {
      // Some feeds (Google News) reject unknown bot user agents.
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
      Accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.5',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  if (!response.ok) throw new Error(`The feed site answered with error ${response.status}.`);
  const xml = await response.text();
  if (!/<(?:rss|feed|rdf:RDF)[\s>]/i.test(xml)) throw new Error('That address did not return an RSS or Atom feed.');
  const entries = [...xml.matchAll(/<(?:item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/(?:item|entry)>/gi)];
  return entries
    .slice(0, 24)
    .map((match, index) => {
      const title = match[1].match(/<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/i)?.[1] ?? '';
      const guid = match[1].match(/<(?:guid|id)(?:\s[^>]*)?>([\s\S]*?)<\/(?:guid|id)>/i)?.[1] ?? `feed-${index}`;
      return { id: decodeXml(guid), text: decodeXml(title), source: feedLabel };
    })
    .filter((item) => item.text);
}

export async function GET(request: Request) {
  const consumeNext = new URL(request.url).searchParams.get('consumeNext') === '1';
  const customResult = await env.DB.prepare(
    "SELECT id, text, placement FROM custom_headlines WHERE enabled = 1 ORDER BY CASE placement WHEN 'next' THEN 0 ELSE 1 END, created_at DESC",
  ).all<CustomRow>();
  const custom = customResult.results;
  const feedSettings = await env.DB.prepare(
    'SELECT feed_url AS feedUrl, feed_label AS feedLabel FROM ticker_settings WHERE id = 1',
  ).first<FeedSettings>();
  const feedUrl = feedSettings?.feedUrl || DEFAULT_FEED;
  const feedLabel = feedSettings?.feedLabel || 'SPORTS';

  let feed: Headline[] = [];
  let feedAvailable = true;
  let feedError: string | null = null;
  try {
    feed = await getFeedHeadlines(feedUrl, feedLabel);
  } catch (error) {
    console.error('RSS feed fetch failed', error);
    feedAvailable = false;
    feedError = error instanceof Error && error.name !== 'TimeoutError' ? error.message : 'The feed site did not answer in time.';
  }

  const next = custom.filter((item) => item.placement === 'next').map((item) => ({ id: `custom-${item.id}`, text: item.text, source: 'LIVE' as const }));
  const rotation = custom.filter((item) => item.placement === 'rotation').map((item) => ({ id: `custom-${item.id}`, text: item.text, source: 'LIVE' as const }));
  const mixed: Headline[] = [...next];
  feed.forEach((item, index) => {
    mixed.push(item);
    if ((index + 1) % 4 === 0 && rotation.length) mixed.push(rotation[Math.floor(index / 4) % rotation.length]);
  });
  if (!feed.length) mixed.push(...rotation);

  if (consumeNext && next.length) {
    const ids = custom.filter((item) => item.placement === 'next').map((item) => item.id);
    const placeholders = ids.map(() => '?').join(',');
    await env.DB.prepare(`UPDATE custom_headlines SET placement = 'rotation' WHERE id IN (${placeholders})`).bind(...ids).run();
  }

  return Response.json({ headlines: mixed, feedAvailable, feedError, feedUrl, updatedAt: Date.now() }, { headers: { 'Cache-Control': 'no-store' } });
}
