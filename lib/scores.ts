// Game scores from ESPN's public scoreboards (the same data espn.com uses; not an official API,
// so every step here fails quietly: a league that errors or changes shape is simply left out).
import { TEAMS, type League, type Team } from './teams';

export type ScoreLeague = League | 'CFB' | 'CBB';
export type ScoreSide = { abbr: string; score: string | null; team: string | null; logo: string | null; rank: number | null; winner: boolean };
export type ScoreItem = {
  id: string;
  league: ScoreLeague;
  state: 'live' | 'final' | 'upcoming';
  /** "Q4 2:13", "FINAL", "7:30 PM PT". */
  detail: string;
  away: ScoreSide;
  home: ScoreSide;
  start: number;
};

const SOURCES: { league: ScoreLeague; path: string }[] = [
  { league: 'NFL', path: 'football/nfl' },
  { league: 'NBA', path: 'basketball/nba' },
  { league: 'MLB', path: 'baseball/mlb' },
  { league: 'NHL', path: 'hockey/nhl' },
  { league: 'CFB', path: 'football/college-football' },
  { league: 'CBB', path: 'basketball/mens-college-basketball' },
];

const FETCH_TIMEOUT_MS = 6_000;
/** Re-fetch a league at most this often (live scores). */
const REFRESH_MS = 60_000;
/** After a failed fetch, keep airing the last good copy this long, then drop the league. */
const STALE_MAX_MS = 20 * 60_000;
/** Finals stay on the board this long after they started; upcoming games show this far ahead. */
const FINAL_WINDOW_MS = 16 * 3600_000;
const UPCOMING_WINDOW_MS = 18 * 3600_000;
/** College has hundreds of games: finals/upcoming only when a ranked team plays; live games capped. */
const COLLEGE_LIVE_CAP = 15;
const MAX_ITEMS = 60;
const TIME_ZONE = 'America/Los_Angeles';

// ESPN abbreviations that differ from ours (lib/teams.ts keys). Nickname matching covers most teams.
const ABBR_FIX: Record<string, string> = {
  'NFL:WSH': 'WAS',
  'NBA:WSH': 'WAS', 'NBA:GS': 'GSW', 'NBA:NO': 'NOP', 'NBA:NY': 'NYK', 'NBA:SA': 'SAS', 'NBA:UTAH': 'UTA',
  'NHL:LA': 'LAK', 'NHL:SJ': 'SJS', 'NHL:TB': 'TBL', 'NHL:NJ': 'NJD', 'NHL:UTAH': 'UTA',
  'MLB:CHW': 'CWS', 'MLB:OAK': 'ATH', 'MLB:AZ': 'ARI',
};

function findTeam(league: ScoreLeague, abbr: string, nickname: string): Team | null {
  if (league === 'CFB' || league === 'CBB') return null;
  const inLeague = TEAMS.filter((team) => team.league === league);
  const key = `${league.toLowerCase()}-${(ABBR_FIX[`${league}:${abbr}`] ?? abbr).toLowerCase()}`;
  return inLeague.find((team) => team.key === key) ?? inLeague.find((team) => team.name.toLowerCase() === nickname.toLowerCase()) ?? null;
}

function clockTime(ms: number, withDay: boolean) {
  const time = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, hour: 'numeric', minute: '2-digit' }).format(ms);
  const day = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, weekday: 'short' }).format(ms).toUpperCase();
  return withDay ? `${day} ${time} PT` : `${time} PT`;
}

const sameDay = (a: number, b: number) => {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, dateStyle: 'short' });
  return f.format(a) === f.format(b);
};

type EspnCompetitor = {
  homeAway?: string;
  score?: string;
  winner?: boolean;
  curatedRank?: { current?: number };
  team?: { abbreviation?: string; name?: string; shortDisplayName?: string; logo?: string };
};
type EspnEvent = {
  id?: string;
  date?: string;
  status?: { type?: { state?: string; shortDetail?: string; completed?: boolean } };
  competitions?: { competitors?: EspnCompetitor[] }[];
};

function side(league: ScoreLeague, raw: EspnCompetitor | undefined, showScore: boolean): ScoreSide | null {
  const abbr = raw?.team?.abbreviation?.trim();
  if (!abbr) return null;
  const team = findTeam(league, abbr, raw?.team?.name ?? raw?.team?.shortDisplayName ?? '');
  const rank = raw?.curatedRank?.current;
  const logo = raw?.team?.logo;
  return {
    abbr: abbr.slice(0, 6),
    score: showScore && raw?.score != null && /^\d{1,3}$/.test(String(raw.score)) ? String(raw.score) : null,
    team: team?.key ?? null,
    // College logos come from ESPN's image server (we have no local college logos); pro teams use ours.
    logo: !team && typeof logo === 'string' && logo.startsWith('https://a.espncdn.com/') ? logo : null,
    rank: typeof rank === 'number' && rank >= 1 && rank <= 25 ? rank : null,
    winner: Boolean(raw?.winner),
  };
}

export function parseScoreboard(league: ScoreLeague, data: unknown, now: number): ScoreItem[] {
  const events = (data as { events?: EspnEvent[] } | null)?.events;
  if (!Array.isArray(events)) return [];
  const college = league === 'CFB' || league === 'CBB';
  const items: ScoreItem[] = [];
  for (const event of events) {
    try {
      const rawState = event.status?.type?.state;
      const state = rawState === 'in' ? 'live' : rawState === 'post' ? 'final' : rawState === 'pre' ? 'upcoming' : null;
      const start = Date.parse(event.date ?? '');
      if (!state || !Number.isFinite(start) || !event.id) continue;
      if (state === 'final' && now - start > FINAL_WINDOW_MS) continue;
      if (state === 'upcoming' && start - now > UPCOMING_WINDOW_MS) continue;
      // Postponed / canceled games come back as "post" without being completed.
      if (state === 'final' && event.status?.type?.completed === false) continue;
      const competitors = event.competitions?.[0]?.competitors ?? [];
      const away = side(league, competitors.find((c) => c.homeAway === 'away'), state !== 'upcoming');
      const home = side(league, competitors.find((c) => c.homeAway === 'home'), state !== 'upcoming');
      if (!away || !home) continue;
      if (state !== 'upcoming' && (away.score === null || home.score === null)) continue;
      if (college && state !== 'live' && !away.rank && !home.rank) continue;
      const short = (event.status?.type?.shortDetail ?? '').trim();
      const detail =
        state === 'upcoming' ? clockTime(start, !sameDay(start, now))
          : state === 'final' ? (short && /^final/i.test(short) ? short.toUpperCase() : 'FINAL')
            : short.slice(0, 20) || 'LIVE';
      items.push({ id: `${league}-${event.id}`, league, state, detail, away, home, start });
    } catch {
      // One odd game never takes down the rest.
    }
  }
  if (college) {
    const live = items.filter((item) => item.state === 'live').slice(0, COLLEGE_LIVE_CAP);
    return [...live, ...items.filter((item) => item.state !== 'live')];
  }
  return items;
}

type CacheEntry = { items: ScoreItem[]; fetchedAt: number; tried: number };
const cache = new Map<ScoreLeague, CacheEntry>();

async function fetchLeague(league: ScoreLeague, path: string, now: number): Promise<ScoreItem[]> {
  const entry = cache.get(league);
  if (entry && now - entry.tried < REFRESH_MS) return entry.fetchedAt && now - entry.fetchedAt < STALE_MAX_MS ? entry.items : [];
  try {
    const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${path}/scoreboard`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(String(response.status));
    const items = parseScoreboard(league, await response.json(), now);
    cache.set(league, { items, fetchedAt: now, tried: now });
    return items;
  } catch {
    const fallback = entry && entry.fetchedAt && now - entry.fetchedAt < STALE_MAX_MS ? entry.items : [];
    cache.set(league, { items: fallback, fetchedAt: entry?.fetchedAt ?? 0, tried: now });
    return fallback;
  }
}

const ORDER: Record<ScoreItem['state'], number> = { live: 0, final: 1, upcoming: 2 };

export async function getScores(now = Date.now()) {
  const results = await Promise.allSettled(SOURCES.map(({ league, path }) => fetchLeague(league, path, now)));
  const items = results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
  // Live games first, then finals (most recent first), then upcoming (soonest first). League order kept within each.
  items.sort((a, b) => ORDER[a.state] - ORDER[b.state] || (a.state === 'final' ? b.start - a.start : a.state === 'upcoming' ? a.start - b.start : 0));
  return {
    games: items.slice(0, MAX_ITEMS),
    leagues: SOURCES.map(({ league }) => ({ league, ok: Boolean(cache.get(league)?.fetchedAt), games: items.filter((item) => item.league === league).length })),
  };
}
