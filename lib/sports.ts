// Sport label for stories without a team panel (golf, boxing, tennis…, or a team sport where no
// single team is the subject): shown instead of the generic feed label ("NEWS").
// Order: the story's web address → the feed's own sport → the story's wording → (caller's fallback).

const MAX_LABEL = 18;

/** Address path segments → label. ESPN, NBC and Yahoo all use these section names. */
const PATH_SPORTS: [RegExp, string][] = [
  [/^(?:nfl|profootballtalk)$/, 'NFL'],
  [/^nba$/, 'NBA'],
  [/^wnba$/, 'WNBA'],
  [/^mlb$/, 'MLB'],
  [/^nhl$/, 'NHL'],
  [/^(?:college-football|ncf|ncaaf)$/, 'COLLEGE FB'],
  [/^(?:mens-college-basketball|college-basketball|ncb|ncaab)$/, 'COLLEGE BB'],
  [/^(?:womens-college-basketball|ncw|ncaaw)$/, "WOMEN'S CBB"],
  [/^golf$/, 'GOLF'],
  [/^boxing$/, 'BOXING'],
  [/^(?:mma|ufc)$/, 'MMA'],
  [/^tennis$/, 'TENNIS'],
  [/^soccer$/, 'SOCCER'],
  [/^(?:f1|formula-1)$/, 'F1'],
  [/^(?:nascar|racing|motorsports|indycar)$/, 'RACING'],
  [/^(?:horse-racing|horseracing)$/, 'HORSE RACING'],
  [/^olympics$/, 'OLYMPICS'],
  [/^wwe$/, 'WWE'],
  [/^(?:college-sports|ncaa)$/, 'COLLEGE'],
];

/** Sport from a story or feed address: espn.com/golf/story/…, nbcsports.com/nhl.rss, sports.yahoo.com/nba/rss/. */
export function sportFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let segments: string[];
  try {
    segments = new URL(url).pathname.toLowerCase().split('/').filter(Boolean).map((part) => part.replace(/\.(?:rss|xml)$/, ''));
  } catch {
    return null;
  }
  for (const segment of segments) {
    for (const [pattern, label] of PATH_SPORTS) if (pattern.test(segment)) return label;
  }
  return null;
}

/** Sport from wording, for sports with no team panels (case-sensitive where words are common). */
const WORD_SPORTS: [RegExp, string][] = [
  [/\b(?:PGA|LPGA|LIV Golf|Ryder Cup|DP World Tour)\b|\bgolf(?:er|ers)?\b|\bthe Masters\b|\bbirdie|\bbogey/i, 'GOLF'],
  [/\b(?:UFC|MMA|octagon)\b/i, 'MMA'],
  [/\b(?:boxing|boxer|heavyweight title|undisputed champion|Top Rank|Matchroom)\b/i, 'BOXING'],
  [/\b(?:ATP|WTA|tennis|Wimbledon|Roland Garros|Australian Open)\b/i, 'TENNIS'],
  [/\b(?:soccer|Premier League|Champions League|Europa League|La Liga|Serie A|Bundesliga|Ligue 1|MLS|FIFA|USMNT|USWNT)\b/i, 'SOCCER'],
  [/\b(?:Liverpool|Arsenal|Chelsea|Tottenham|Everton|Manchester United|Manchester City|Man United|Man City|Real Madrid|Barcelona|Atletico Madrid|Bayern Munich|Inter Milan|AC Milan|Juventus|PSG|Paris Saint-Germain|Inter Miami|Messi|Ronaldo)\b|\bMbapp|f[uú]tbol/, 'SOCCER'],
  [/\b(?:CFP|College Football Playoff|Heisman|bowl game)\b/, 'COLLEGE FB'],
  [/\b(?:March Madness|Final Four|Sweet 16|Elite Eight)\b/, 'COLLEGE BB'],
  [/\b(?:Formula 1|Formula One|F1|Grand Prix)\b/, 'F1'],
  [/\b(?:NASCAR|IndyCar|Daytona 500|Indy 500)\b/i, 'RACING'],
  [/\b(?:Kentucky Derby|Preakness|Belmont Stakes|Breeders' Cup)\b/i, 'HORSE RACING'],
  [/\b(?:Olympics|Olympic)\b/, 'OLYMPICS'],
  [/\bWWE\b/, 'WWE'],
];

export function sportFromText(text: string): string | null {
  for (const [pattern, label] of WORD_SPORTS) if (pattern.test(text)) return label;
  return null;
}

/** The label for a story with no team panel. */
export function sportLabel(story: { link?: string; feedUrl?: string; title?: string; story?: string }, fallback: string) {
  const label = sportFromUrl(story.link) ?? sportFromUrl(story.feedUrl) ?? sportFromText(`${story.title ?? ''} ${story.story ?? ''}`) ?? fallback;
  return label.slice(0, MAX_LABEL);
}

/** Whether a label means college sports (so bare school names like "Miami" count as teams). */
export function isCollegeSport(label: string | null | undefined) {
  return label === 'COLLEGE FB' || label === 'COLLEGE BB' || label === "WOMEN'S CBB" || label === 'COLLEGE';
}
