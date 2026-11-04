import { env } from 'cloudflare:workers';

export const dynamic = 'force-dynamic';
const DEFAULT_FEED = 'https://www.espn.com/espn/rss/news';
const MAX_ITEM_LENGTH = 220;

type Headline = { id: string; text: string; source: string };
type CustomRow = { id: number; text: string; placement: 'rotation' | 'next' };
type FeedSettings = { feedUrl: string; feedLabel: string };

function decodeXml(value: string) {
  return value
    .trim()
    .replace(/^<!\[CDATA\[|\]\]>$/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function shorten(text: string) {
  if (text.length <= MAX_ITEM_LENGTH) return text;
  const cut = text.slice(0, MAX_ITEM_LENGTH);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:\-–—]+$/, '')}…`;
}

// Prefer the story summary (it carries the facts — scores, stats, decisions); headlines are often
// click teasers. Fall back to the headline when the feed has no usable summary (e.g. Google News,
// whose description is just links).
function pickText(title: string, summary: string) {
  const usable = summary.length >= 40 && !/https?:\/\//i.test(summary) && !summary.startsWith(title);
  return shorten(usable ? summary : title);
}

type FeedItem = { id: string; text: string };
type CachedFeed = { items: FeedItem[]; fetchedAt: number; lastFailureAt: number; lastError: string | null };

// Feed sites (Google News especially) rate-limit frequent requests. Every OBS ticker and control
// panel polls every 15s, so keep the last good copy in memory and only re-fetch every 15 minutes.
// If the feed site refuses, keep showing the last good headlines for a while instead of dropping them.
const FRESH_FOR_MS = 15 * 60_000;
const RETRY_AFTER_FAILURE_MS = 2 * 60_000;
const KEEP_STALE_FOR_MS = 12 * 60 * 60_000;
const feedCache = new Map<string, CachedFeed>();

function describeFeedError(error: unknown) {
  if (error instanceof Error && error.name === 'TimeoutError') return 'The feed site did not answer in time.';
  return error instanceof Error ? error.message : 'The feed could not be loaded.';
}

async function getCachedFeed(feedUrl: string) {
  const now = Date.now();
  const cached = feedCache.get(feedUrl);
  const usable = cached && cached.items.length > 0 && now - cached.fetchedAt < KEEP_STALE_FOR_MS ? cached : null;
  if (usable && now - usable.fetchedAt < FRESH_FOR_MS) return { items: usable.items, ageMs: now - usable.fetchedAt, error: null };
  if (cached && now - cached.lastFailureAt < RETRY_AFTER_FAILURE_MS) {
    return { items: usable?.items ?? [], ageMs: usable ? now - usable.fetchedAt : 0, error: cached.lastError };
  }
  try {
    const items = await getFeedHeadlines(feedUrl);
    feedCache.set(feedUrl, { items, fetchedAt: now, lastFailureAt: 0, lastError: null });
    return { items, ageMs: 0, error: null };
  } catch (error) {
    console.error('RSS feed fetch failed', error);
    const message = describeFeedError(error);
    feedCache.set(feedUrl, { items: usable?.items ?? [], fetchedAt: usable?.fetchedAt ?? 0, lastFailureAt: now, lastError: message });
    return { items: usable?.items ?? [], ageMs: usable ? now - usable.fetchedAt : 0, error: message };
  }
}

const FEED_ACCEPT = 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.5';
// Feed sites disagree on what they let through: some (ESPN's bot protection) block requests that
// claim to be a browser, others (Google News) dislike unknown bots. Try an honest feed-reader
// identity first, then a browser one.
const REQUEST_PROFILES: Record<string, string>[] = [
  { 'User-Agent': 'Mozilla/5.0 (compatible; LasordaNewsTicker/1.0; RSS reader)', Accept: FEED_ACCEPT },
  {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
    Accept: FEED_ACCEPT,
    'Accept-Language': 'en-US,en;q=0.9',
  },
];

function isFeed(body: string) {
  return /<(?:rss|feed|rdf:RDF)[\s>]/i.test(body.slice(0, 4000));
}

// Short description of a non-feed response, so the control panel can say what actually came back.
function describeNonFeed(response: Response, body: string) {
  const type = response.headers.get('content-type')?.split(';')[0] || 'unknown type';
  const title = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim().slice(0, 60);
  return `got ${response.status} ${type}${title ? ` “${title}”` : ''}`;
}

async function fetchFeedXml(feedUrl: string) {
  const problems: string[] = [];
  for (const headers of REQUEST_PROFILES) {
    const response = await fetch(feedUrl, { signal: AbortSignal.timeout(8000), headers });
    const body = await response.text();
    if (response.ok && isFeed(body)) return body;
    problems.push(response.ok ? describeNonFeed(response, body) : `error ${response.status}`);
  }
  const unique = [...new Set(problems)].join(', then ');
  throw new Error(`The feed site didn’t send a feed (${unique}).`);
}

async function getFeedHeadlines(feedUrl: string): Promise<FeedItem[]> {
  const xml = await fetchFeedXml(feedUrl);
  const entries = [...xml.matchAll(/<(?:item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/(?:item|entry)>/gi)];
  return entries
    .slice(0, 24)
    .map((match, index) => {
      const title = match[1].match(/<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/i)?.[1] ?? '';
      const summary = match[1].match(/<(description|summary)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/i)?.[2] ?? '';
      const guid = match[1].match(/<(?:guid|id)(?:\s[^>]*)?>([\s\S]*?)<\/(?:guid|id)>/i)?.[1] ?? `feed-${index}`;
      return { id: decodeXml(guid), text: pickText(decodeXml(title), decodeXml(summary)) };
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

  const result = await getCachedFeed(feedUrl);
  const feed: Headline[] = result.items.map((item) => ({ ...item, source: feedLabel }));
  const feedAvailable = feed.length > 0;
  const feedError = result.error;
  // True when we're showing saved headlines because the feed site refused the latest request.
  const feedStale = feedAvailable && Boolean(feedError);
  const feedAgeSeconds = Math.round(result.ageMs / 1000);

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

  return Response.json({ headlines: mixed, feedAvailable, feedError, feedStale, feedAgeSeconds, feedUrl, updatedAt: Date.now() }, { headers: { 'Cache-Control': 'no-store' } });
}
