// Several news feeds mixed into one strip. Stored in ticker_settings.feed_url, one address per line
// (a single address — the old setting — still works as a one-feed list).

/** Jay's recommended mix (Nov 2026): the cleanest free feed per sport, tested against lib/news-filter.ts. */
export const RECOMMENDED_FEEDS: { name: string; url: string }[] = [
  { name: 'NFL — NBC Pro Football Talk', url: 'https://www.nbcsports.com/profootballtalk.rss' },
  { name: 'NBA — Yahoo Sports', url: 'https://sports.yahoo.com/nba/rss/' },
  { name: 'MLB — Yahoo Sports', url: 'https://sports.yahoo.com/mlb/rss/' },
  { name: 'NHL — NBC Sports', url: 'https://www.nbcsports.com/nhl.rss' },
  { name: 'College football — Yahoo Sports', url: 'https://sports.yahoo.com/college-football/rss/' },
  { name: 'College basketball — ESPN', url: 'https://www.espn.com/espn/rss/ncb/news' },
];

export const MAX_FEEDS = 8;
/** Newest stories taken from each feed when several are mixed (one feed alone: up to 40). */
export const PER_FEED_WHEN_MIXED = 12;
export const SINGLE_FEED_LIMIT = 40;

/** The stored setting → a clean list of addresses (blank lines and duplicates dropped). */
export function parseFeedList(value: string | null | undefined): string[] {
  const urls = (value ?? '').split(/[\r\n]+/).map((line) => line.trim()).filter(Boolean);
  return [...new Set(urls)].slice(0, MAX_FEEDS);
}

/** A list of addresses → the stored setting. */
export function joinFeedList(urls: string[]) {
  return parseFeedList(urls.join('\n')).join('\n');
}

/** Short name for a feed in status messages: a known feed's name, else its site ("sports.yahoo.com"). */
export function feedName(url: string) {
  const known = RECOMMENDED_FEEDS.find((feed) => feed.url === url);
  if (known) return known.name;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

const STOP_WORDS = new Set(['with', 'that', 'this', 'from', 'after', 'will', 'have', 'their', 'about', 'into', 'over', 'says', 'said', 'what', 'when', 'than', 'they', 'were', 'been', 'more', 'amid', 'sources', 'report']);

function titleWords(title: string) {
  return new Set(
    title.toLowerCase().replace(/[’']/g, "'").split(/[^a-z0-9']+/).filter((word) => word.length >= 4 && !STOP_WORDS.has(word)),
  );
}

/** Two headlines about the same story (same main words, e.g. a story syndicated by two sites). */
export function sameStory(a: string, b: string) {
  const wordsA = titleWords(a);
  const wordsB = titleWords(b);
  if (wordsA.size === 0 || wordsB.size === 0) return a.trim().toLowerCase() === b.trim().toLowerCase();
  let shared = 0;
  for (const word of wordsA) if (wordsB.has(word)) shared += 1;
  return shared / Math.min(wordsA.size, wordsB.size) >= 0.6 && shared >= 2;
}

/**
 * Mix several feeds into one list: take turns between feeds (so sports are spread through the strip,
 * not all NFL then all NBA), each feed's own order kept, and the same story from two sites only once.
 */
export function mixFeeds<T extends { title: string; id: string }>(feeds: T[][], perFeed: number): T[] {
  const lists = feeds.map((items) => items.slice(0, perFeed));
  const mixed: T[] = [];
  const longest = Math.max(0, ...lists.map((items) => items.length));
  for (let index = 0; index < longest; index += 1) {
    for (const items of lists) {
      const item = items[index];
      if (!item) continue;
      if (mixed.some((kept) => kept.id === item.id || sameStory(kept.title, item.title))) continue;
      mixed.push(item);
    }
  }
  return mixed;
}
