import { env } from 'cloudflare:workers';
import { detectTeam } from '@/lib/teams';
import { AI_PROMPT_VERSION, summarizeStory } from '@/lib/ai-summary';
import { spreadTeamItems } from '@/lib/mix';

export const dynamic = 'force-dynamic';
const DEFAULT_FEED = 'https://www.espn.com/espn/rss/news';
// Ticker lines should read in a few seconds. Long summaries are cut to their first sentence,
// and anything still too long is cut at a word boundary.
const TARGET_LENGTH = 150;
const MAX_ITEM_LENGTH = 170;

type Headline = { id: string; text: string; source: string; team: string | null; tag: string | null };
type CustomRow = { id: number; text: string; placement: 'rotation' | 'next'; team: string | null; tag: string | null };
type FeedSettings = { feedUrl: string; feedLabel: string; aiSummaries: number | null };

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

const ABBREVIATIONS = /(?:^|\s)(?:St|Jr|Sr|vs|No|Mr|Dr|Ft|Mt|Jan|Feb|Aug|Sept|Oct|Nov|Dec|[A-Z])\.$/;

function firstSentence(text: string) {
  const pattern = /[.!?](?=\s+["“A-Z0-9])/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    const sentence = text.slice(0, match.index + 1);
    if (!ABBREVIATIONS.test(sentence)) return sentence;
  }
  return text;
}

function shorten(fullText: string) {
  if (fullText.length <= TARGET_LENGTH) return fullText;
  const sentence = firstSentence(fullText);
  const text = sentence.length >= 40 ? sentence : fullText;
  if (text.length <= MAX_ITEM_LENGTH) return text;
  const cut = text.slice(0, TARGET_LENGTH);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:\-–—]+$/, '')}…`;
}

// Prefer the story summary (it carries the facts — scores, stats, decisions); headlines are often
// click teasers. Fall back to the headline when the feed has no usable summary (e.g. Google News,
// whose description is just links).
function pickStory(title: string, summary: string) {
  const usable = summary.length >= 40 && !/https?:\/\//i.test(summary) && !summary.startsWith(title);
  return usable ? summary : title;
}

/** `story` is the full story text (for AI); `text` is the trimmed version that airs without AI. */
type FeedItem = { id: string; text: string; story: string };
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
      const story = pickStory(decodeXml(title), decodeXml(summary));
      return { id: decodeXml(guid), text: shorten(story), story };
    })
    .filter((item) => item.text);
}

// ---------- AI ticker lines ----------
// Each new story is rewritten once by Workers AI (lib/ai-summary.ts) and saved in D1 (ai_lines).
// Only a few new stories are summarized per request so the ticker never waits long; the rest
// air as plain text until their turn. If the AI service errors (e.g. daily free limit), it pauses
// for a few minutes and everything airs as plain text.
const AI_PER_REQUEST = 3;
const AI_TIMEOUT_MS = 8000;
const AI_PAUSE_AFTER_ERROR_MS = 5 * 60_000;
const AI_KEEP_DAYS = 3;
type AiEntry = { status: 'ok' | 'rejected'; line: string | null; team: string | null };
const aiMemory = new Map<string, AiEntry>();
const aiInFlight = new Set<string>();
let aiPausedUntil = 0;
let aiLastError: string | null = null;

function storyKey(item: FeedItem) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < item.story.length; index++) hash = Math.imul(hash ^ item.story.charCodeAt(index), 0x01000193);
  return `v${AI_PROMPT_VERSION}:${item.id}#${(hash >>> 0).toString(16)}`;
}

function withTimeout<T>(promise: Promise<T>, ms: number) {
  return Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('The AI service took too long.')), ms))]);
}

async function getAiLines(items: FeedItem[]) {
  const keys = items.map(storyKey);
  const unknown = keys.filter((key) => !aiMemory.has(key));
  if (unknown.length) {
    const placeholders = unknown.map(() => '?').join(',');
    const rows = await env.DB.prepare(`SELECT story_key AS storyKey, status, line, team FROM ai_lines WHERE story_key IN (${placeholders})`)
      .bind(...unknown)
      .all<AiEntry & { storyKey: string }>();
    for (const row of rows.results) aiMemory.set(row.storyKey, { status: row.status, line: row.line, team: row.team });
  }

  const todo = items.filter((item, index) => !aiMemory.has(keys[index]) && !aiInFlight.has(keys[index])).slice(0, AI_PER_REQUEST);
  if (todo.length && env.AI && Date.now() >= aiPausedUntil) {
    const ai = env.AI;
    await Promise.all(todo.map(async (item) => {
      const key = storyKey(item);
      aiInFlight.add(key);
      try {
        const outcome = await withTimeout(summarizeStory(ai as never, item.story), AI_TIMEOUT_MS);
        const entry: AiEntry = outcome.status === 'ok'
          ? { status: 'ok', line: outcome.result.line, team: outcome.result.team }
          : { status: 'rejected', line: null, team: null };
        aiMemory.set(key, entry);
        aiLastError = null;
        await env.DB.prepare('INSERT OR REPLACE INTO ai_lines (story_key, status, line, team, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)')
          .bind(key, entry.status, entry.line, entry.team, outcome.status === 'rejected' ? outcome.reason : null, Date.now())
          .run();
      } catch (error) {
        aiLastError = error instanceof Error ? error.message : 'The AI service failed.';
        aiPausedUntil = Date.now() + AI_PAUSE_AFTER_ERROR_MS;
        console.error('AI summary failed', error);
      } finally {
        aiInFlight.delete(key);
      }
    }));
    if (Math.random() < 0.05) {
      await env.DB.prepare('DELETE FROM ai_lines WHERE created_at < ?').bind(Date.now() - AI_KEEP_DAYS * 86_400_000).run();
    }
  }

  const lines = new Map<string, AiEntry>();
  items.forEach((item, index) => {
    const entry = aiMemory.get(keys[index]);
    if (entry) lines.set(item.id, entry);
  });
  const ok = [...lines.values()].filter((entry) => entry.status === 'ok').length;
  const rejected = [...lines.values()].filter((entry) => entry.status === 'rejected').length;
  return {
    lines,
    stats: { available: Boolean(env.AI), ok, rejected, waiting: items.length - ok - rejected, error: Date.now() < aiPausedUntil ? aiLastError : null },
  };
}

export async function GET(request: Request) {
  const consumeNext = new URL(request.url).searchParams.get('consumeNext') === '1';
  const customResult = await env.DB.prepare(
    "SELECT id, text, placement, team, tag FROM custom_headlines WHERE enabled = 1 ORDER BY CASE placement WHEN 'next' THEN 0 ELSE 1 END, created_at DESC",
  ).all<CustomRow>();
  const custom = customResult.results;
  const feedSettings = await env.DB.prepare(
    'SELECT feed_url AS feedUrl, feed_label AS feedLabel, ai_summaries AS aiSummaries FROM ticker_settings WHERE id = 1',
  ).first<FeedSettings>();
  const feedUrl = feedSettings?.feedUrl || DEFAULT_FEED;
  const feedLabel = feedSettings?.feedLabel || 'SPORTS';

  const result = await getCachedFeed(feedUrl);
  const aiEnabled = feedSettings?.aiSummaries !== 0;
  const ai = aiEnabled && result.items.length ? await getAiLines(result.items) : null;

  // AI line + AI-picked team when it passed the safety checks; otherwise the trimmed story text,
  // with the team panel of the first team the story mentions.
  const feed: Headline[] = spreadTeamItems(result.items.map((item) => {
    const entry = ai?.lines.get(item.id);
    const useAi = entry?.status === 'ok' && entry.line;
    return {
      id: item.id,
      text: useAi ? entry.line! : item.text,
      source: feedLabel,
      team: (useAi && entry.team) || detectTeam(item.story)?.key || null,
      tag: null,
    };
  }));
  const feedAvailable = feed.length > 0;
  const feedError = result.error;
  // True when we're showing saved headlines because the feed site refused the latest request.
  const feedStale = feedAvailable && Boolean(feedError);
  const feedAgeSeconds = Math.round(result.ageMs / 1000);

  const toHeadline = (item: CustomRow): Headline => ({ id: `custom-${item.id}`, text: item.text, source: 'LIVE', team: item.team, tag: item.tag });
  const next = custom.filter((item) => item.placement === 'next').map(toHeadline);
  const rotation = custom.filter((item) => item.placement === 'rotation').map(toHeadline);
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

  return Response.json({ headlines: mixed, feedAvailable, feedError, feedStale, feedAgeSeconds, feedUrl, ai: ai?.stats ?? { off: true }, updatedAt: Date.now() }, { headers: { 'Cache-Control': 'no-store' } });
}
