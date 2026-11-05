// Team colors for ticker team panels. Colors are each team's primary/secondary as commonly
// published; tweak any entry here if a shade looks off on stream.
// Only team names and colors are used — no official logos or wordmarks (trademarks).
// College teams (major conferences) come from lib/college-teams.ts, generated from ESPN.
import { COLLEGE_TEAMS } from './college-teams';

/** Pro leagues. */
export type League = 'NFL' | 'NBA' | 'MLB' | 'NHL';
/** Pro leagues plus major college programs ('NCAA'). */
export type TeamLeague = League | 'NCAA';
export type Team = {
  key: string;
  league: TeamLeague;
  /** Short name shown on the panel instead of the nickname (college: "UM", "ASU", "UCLA"). */
  short?: string;
  /** ESPN team id (college), used to match ESPN scoreboards. */
  espnId?: string;
  city: string;
  name: string;
  primary: string;
  secondary: string;
  /** Other ways the team is written in news copy. */
  aliases?: string[];
  /** Other ways the city is written ("LA", "Tampa"). */
  cityAliases?: string[];
};

const t = (league: League, abbr: string, city: string, name: string, primary: string, secondary: string, aliases?: string[], cityAliases?: string[]): Team => ({
  key: `${league.toLowerCase()}-${abbr.toLowerCase()}`,
  league,
  city,
  name,
  primary,
  secondary,
  aliases,
  cityAliases,
});

export const TEAMS: Team[] = [
  // NFL
  t('NFL', 'ARI', 'Arizona', 'Cardinals', '#97233F', '#FFB612'),
  t('NFL', 'ATL', 'Atlanta', 'Falcons', '#A71930', '#000000'),
  t('NFL', 'BAL', 'Baltimore', 'Ravens', '#241773', '#9E7C0C'),
  t('NFL', 'BUF', 'Buffalo', 'Bills', '#00338D', '#C60C30'),
  t('NFL', 'CAR', 'Carolina', 'Panthers', '#0085CA', '#101820'),
  t('NFL', 'CHI', 'Chicago', 'Bears', '#0B162A', '#C83803'),
  t('NFL', 'CIN', 'Cincinnati', 'Bengals', '#FB4F14', '#000000'),
  t('NFL', 'CLE', 'Cleveland', 'Browns', '#311D00', '#FF3C00'),
  t('NFL', 'DAL', 'Dallas', 'Cowboys', '#003594', '#869397'),
  t('NFL', 'DEN', 'Denver', 'Broncos', '#FB4F14', '#002244'),
  t('NFL', 'DET', 'Detroit', 'Lions', '#0076B6', '#B0B7BC'),
  t('NFL', 'GB', 'Green Bay', 'Packers', '#203731', '#FFB612'),
  t('NFL', 'HOU', 'Houston', 'Texans', '#03202F', '#A71930'),
  t('NFL', 'IND', 'Indianapolis', 'Colts', '#002C5F', '#A2AAAD'),
  t('NFL', 'JAX', 'Jacksonville', 'Jaguars', '#006778', '#D7A22A', ['Jags']),
  t('NFL', 'KC', 'Kansas City', 'Chiefs', '#E31837', '#FFB81C'),
  t('NFL', 'LV', 'Las Vegas', 'Raiders', '#000000', '#A5ACAF'),
  t('NFL', 'LAC', 'Los Angeles', 'Chargers', '#0080C6', '#FFC20E'),
  t('NFL', 'LAR', 'Los Angeles', 'Rams', '#003594', '#FFA300'),
  t('NFL', 'MIA', 'Miami', 'Dolphins', '#008E97', '#FC4C02'),
  t('NFL', 'MIN', 'Minnesota', 'Vikings', '#4F2683', '#FFC62F'),
  t('NFL', 'NE', 'New England', 'Patriots', '#002244', '#C60C30', ['Pats']),
  t('NFL', 'NO', 'New Orleans', 'Saints', '#101820', '#D3BC8D'),
  t('NFL', 'NYG', 'New York', 'Giants', '#0B2265', '#A71930'),
  t('NFL', 'NYJ', 'New York', 'Jets', '#125740', '#FFFFFF'),
  t('NFL', 'PHI', 'Philadelphia', 'Eagles', '#004C54', '#A5ACAF'),
  t('NFL', 'PIT', 'Pittsburgh', 'Steelers', '#101820', '#FFB612'),
  t('NFL', 'SF', 'San Francisco', '49ers', '#AA0000', '#B3995D', ['Niners']),
  t('NFL', 'SEA', 'Seattle', 'Seahawks', '#002244', '#69BE28'),
  t('NFL', 'TB', 'Tampa Bay', 'Buccaneers', '#D50A0A', '#34302B', ['Bucs']),
  t('NFL', 'TEN', 'Tennessee', 'Titans', '#0C2340', '#4B92DB'),
  t('NFL', 'WAS', 'Washington', 'Commanders', '#5A1414', '#FFB612'),
  // NBA
  t('NBA', 'ATL', 'Atlanta', 'Hawks', '#E03A3E', '#FDB927'),
  t('NBA', 'BOS', 'Boston', 'Celtics', '#007A33', '#BA9653'),
  t('NBA', 'BKN', 'Brooklyn', 'Nets', '#000000', '#FFFFFF'),
  t('NBA', 'CHA', 'Charlotte', 'Hornets', '#1D1160', '#00788C'),
  t('NBA', 'CHI', 'Chicago', 'Bulls', '#CE1141', '#000000'),
  t('NBA', 'CLE', 'Cleveland', 'Cavaliers', '#860038', '#FDBB30', ['Cavs']),
  t('NBA', 'DAL', 'Dallas', 'Mavericks', '#00538C', '#B8C4CA', ['Mavs']),
  t('NBA', 'DEN', 'Denver', 'Nuggets', '#0E2240', '#FEC524'),
  t('NBA', 'DET', 'Detroit', 'Pistons', '#C8102E', '#1D42BA'),
  t('NBA', 'GSW', 'Golden State', 'Warriors', '#1D428A', '#FFC72C', ['Dubs']),
  t('NBA', 'HOU', 'Houston', 'Rockets', '#CE1141', '#000000'),
  t('NBA', 'IND', 'Indiana', 'Pacers', '#002D62', '#FDBB30'),
  t('NBA', 'LAC', 'LA', 'Clippers', '#C8102E', '#1D428A'),
  t('NBA', 'LAL', 'Los Angeles', 'Lakers', '#552583', '#FDB927'),
  t('NBA', 'MEM', 'Memphis', 'Grizzlies', '#5D76A9', '#12173F'),
  t('NBA', 'MIA', 'Miami', 'Heat', '#98002E', '#F9A01B'),
  t('NBA', 'MIL', 'Milwaukee', 'Bucks', '#00471B', '#EEE1C6'),
  t('NBA', 'MIN', 'Minnesota', 'Timberwolves', '#0C2340', '#78BE20', ['Wolves']),
  t('NBA', 'NOP', 'New Orleans', 'Pelicans', '#0C2340', '#C8102E'),
  t('NBA', 'NYK', 'New York', 'Knicks', '#006BB6', '#F58426'),
  t('NBA', 'OKC', 'Oklahoma City', 'Thunder', '#007AC1', '#EF3B24'),
  t('NBA', 'ORL', 'Orlando', 'Magic', '#0077C0', '#C4CED4'),
  t('NBA', 'PHI', 'Philadelphia', '76ers', '#006BB6', '#ED174C', ['Sixers']),
  t('NBA', 'PHX', 'Phoenix', 'Suns', '#1D1160', '#E56020'),
  t('NBA', 'POR', 'Portland', 'Trail Blazers', '#E03A3E', '#000000', ['Blazers']),
  t('NBA', 'SAC', 'Sacramento', 'Kings', '#5A2D81', '#63727A'),
  t('NBA', 'SAS', 'San Antonio', 'Spurs', '#000000', '#C4CED4'),
  t('NBA', 'TOR', 'Toronto', 'Raptors', '#CE1141', '#000000'),
  t('NBA', 'UTA', 'Utah', 'Jazz', '#002B5C', '#F9A01B'),
  t('NBA', 'WAS', 'Washington', 'Wizards', '#002B5C', '#E31837'),
  // MLB
  t('MLB', 'ARI', 'Arizona', 'Diamondbacks', '#A71930', '#E3D4AD', ['D-backs']),
  t('MLB', 'ATH', 'Athletics', 'Athletics', '#003831', '#EFB21E', ["A's"]),
  t('MLB', 'ATL', 'Atlanta', 'Braves', '#13274F', '#CE1141'),
  t('MLB', 'BAL', 'Baltimore', 'Orioles', '#DF4601', '#000000', ["O's"]),
  t('MLB', 'BOS', 'Boston', 'Red Sox', '#BD3039', '#0C2340'),
  t('MLB', 'CHC', 'Chicago', 'Cubs', '#0E3386', '#CC3433'),
  t('MLB', 'CWS', 'Chicago', 'White Sox', '#27251F', '#C4CED4'),
  t('MLB', 'CIN', 'Cincinnati', 'Reds', '#C6011F', '#000000'),
  t('MLB', 'CLE', 'Cleveland', 'Guardians', '#00385D', '#E50022'),
  t('MLB', 'COL', 'Colorado', 'Rockies', '#333366', '#C4CED4'),
  t('MLB', 'DET', 'Detroit', 'Tigers', '#0C2340', '#FA4616'),
  t('MLB', 'HOU', 'Houston', 'Astros', '#002D62', '#EB6E1F'),
  t('MLB', 'KC', 'Kansas City', 'Royals', '#004687', '#BD9B60'),
  t('MLB', 'LAA', 'Los Angeles', 'Angels', '#BA0021', '#003263'),
  t('MLB', 'LAD', 'Los Angeles', 'Dodgers', '#005A9C', '#EF3E42'),
  t('MLB', 'MIA', 'Miami', 'Marlins', '#00A3E0', '#EF3340'),
  t('MLB', 'MIL', 'Milwaukee', 'Brewers', '#12284B', '#FFC52F'),
  t('MLB', 'MIN', 'Minnesota', 'Twins', '#002B5C', '#D31145'),
  t('MLB', 'NYM', 'New York', 'Mets', '#002D72', '#FF5910'),
  t('MLB', 'NYY', 'New York', 'Yankees', '#0C2340', '#C4CED3'),
  t('MLB', 'PHI', 'Philadelphia', 'Phillies', '#E81828', '#002D72'),
  t('MLB', 'PIT', 'Pittsburgh', 'Pirates', '#27251F', '#FDB827', ['Bucs']),
  t('MLB', 'SD', 'San Diego', 'Padres', '#2F241D', '#FFC425'),
  t('MLB', 'SF', 'San Francisco', 'Giants', '#FD5A1E', '#27251F'),
  t('MLB', 'SEA', 'Seattle', 'Mariners', '#0C2C56', '#005C5C'),
  t('MLB', 'STL', 'St. Louis', 'Cardinals', '#C41E3A', '#0C2340'),
  t('MLB', 'TB', 'Tampa Bay', 'Rays', '#092C5C', '#8FBCE6'),
  t('MLB', 'TEX', 'Texas', 'Rangers', '#003278', '#C0111F'),
  t('MLB', 'TOR', 'Toronto', 'Blue Jays', '#134A8E', '#E8291C', ['Jays']),
  t('MLB', 'WSH', 'Washington', 'Nationals', '#AB0003', '#14225A', ['Nats']),
  // NHL
  t('NHL', 'ANA', 'Anaheim', 'Ducks', '#F47A38', '#B9975B'),
  t('NHL', 'BOS', 'Boston', 'Bruins', '#000000', '#FFB81C', ["B's"]),
  t('NHL', 'BUF', 'Buffalo', 'Sabres', '#003087', '#FFB81C'),
  t('NHL', 'CGY', 'Calgary', 'Flames', '#C8102E', '#F1BE48'),
  t('NHL', 'CAR', 'Carolina', 'Hurricanes', '#CC0000', '#000000', ['Canes']),
  t('NHL', 'CHI', 'Chicago', 'Blackhawks', '#CF0A2C', '#000000'),
  t('NHL', 'COL', 'Colorado', 'Avalanche', '#6F263D', '#236192', ['Avs']),
  t('NHL', 'CBJ', 'Columbus', 'Blue Jackets', '#002654', '#CE1126'),
  t('NHL', 'DAL', 'Dallas', 'Stars', '#006847', '#8F8F8C'),
  t('NHL', 'DET', 'Detroit', 'Red Wings', '#CE1126', '#FFFFFF'),
  t('NHL', 'EDM', 'Edmonton', 'Oilers', '#041E42', '#FF4C00'),
  t('NHL', 'FLA', 'Florida', 'Panthers', '#041E42', '#C8102E'),
  t('NHL', 'LAK', 'Los Angeles', 'Kings', '#111111', '#A2AAAD', undefined, ['LA', 'L.A.']),
  t('NHL', 'MIN', 'Minnesota', 'Wild', '#154734', '#A6192E'),
  t('NHL', 'MTL', 'Montreal', 'Canadiens', '#AF1E2D', '#192168', ['Habs']),
  t('NHL', 'NSH', 'Nashville', 'Predators', '#FFB81C', '#041E42', ['Preds']),
  t('NHL', 'NJD', 'New Jersey', 'Devils', '#CE1126', '#000000'),
  t('NHL', 'NYI', 'New York', 'Islanders', '#00539B', '#F47D30', ['Isles']),
  t('NHL', 'NYR', 'New York', 'Rangers', '#0038A8', '#CE1126', undefined, ['NY']),
  t('NHL', 'OTT', 'Ottawa', 'Senators', '#C52032', '#000000', ['Sens']),
  t('NHL', 'PHI', 'Philadelphia', 'Flyers', '#F74902', '#000000'),
  t('NHL', 'PIT', 'Pittsburgh', 'Penguins', '#000000', '#FCB514', ['Pens']),
  t('NHL', 'SJS', 'San Jose', 'Sharks', '#006D75', '#EA7200'),
  t('NHL', 'SEA', 'Seattle', 'Kraken', '#001628', '#99D9D9'),
  t('NHL', 'STL', 'St. Louis', 'Blues', '#002F87', '#FCB514'),
  t('NHL', 'TBL', 'Tampa Bay', 'Lightning', '#002868', '#FFFFFF', ['Bolts']),
  t('NHL', 'TOR', 'Toronto', 'Maple Leafs', '#00205B', '#FFFFFF', ['Leafs']),
  t('NHL', 'UTA', 'Utah', 'Mammoth', '#010101', '#69B3E7'),
  t('NHL', 'VAN', 'Vancouver', 'Canucks', '#00205B', '#00843D'),
  t('NHL', 'VGK', 'Vegas', 'Golden Knights', '#B4975A', '#333F42', ['Knights']),
  t('NHL', 'WSH', 'Washington', 'Capitals', '#041E42', '#C8102E', ['Caps']),
  t('NHL', 'WPG', 'Winnipeg', 'Jets', '#041E42', '#004C97'),
];

// Common short forms in news copy. Nicknames count anywhere unless shared; school forms only in college stories.
const COLLEGE_NICKNAMES: Record<string, string[]> = {
  'ncaa-nd': ['Irish'], 'ncaa-fsu': ['Noles'], 'ncaa-ala': ['Bama'], 'ncaa-neb': ['Huskers'], 'ncaa-ark': ['Hogs'],
};
const COLLEGE_SCHOOL_ALIASES: Record<string, string[]> = {
  'ncaa-miz': ['Mizzou'], 'ncaa-pitt': ['Pitt'], 'ncaa-cal': ['Cal'], 'ncaa-unc': ['UNC'], 'ncaa-uva': ['UVA'],
  'ncaa-ala': ['Bama'], 'ncaa-tamu': ['A&M'], 'ncaa-uconn': ['Connecticut'], 'ncaa-um': ['Miami (Fla.)'],
};

// Major college programs: city = school ("Miami", "Ohio State"), name = nickname ("Hurricanes").
for (const college of COLLEGE_TEAMS) {
  TEAMS.push({
    key: college.key, league: 'NCAA', city: college.school, name: college.name, primary: college.primary, secondary: college.secondary,
    short: college.abbr, espnId: college.espnId, aliases: COLLEGE_NICKNAMES[college.key], cityAliases: COLLEGE_SCHOOL_ALIASES[college.key],
  });
}

export const TEAMS_BY_KEY = new Map(TEAMS.map((team) => [team.key, team]));
export const COLLEGE_BY_ESPN_ID = new Map(TEAMS.filter((team) => team.espnId).map((team) => [team.espnId!, team]));

/** Text on a team panel: the short name for college ("UM"), the nickname for pro teams ("Eagles"). */
export function teamLabel(team: Team) {
  return team.short ?? team.name;
}

/** Dropdown / list name: "UM — Miami Hurricanes", "Philadelphia Eagles". */
export function teamFullName(team: Team) {
  const full = team.city === team.name ? team.name : `${team.city} ${team.name}`;
  return team.short ? `${team.short} — ${full}` : full;
}

/**
 * "Lasorda Logo" panel for custom headlines: shows Jay's secondary logo instead of a team.
 * Not a team, so it is never auto-detected in news stories.
 */
export const HOUSE_PANEL_KEY = 'lasorda';
export const HOUSE_PANEL_LOGO = '/brand/lasordas-card-house-secondary.png';

function luminance(hex: string) {
  const channel = (offset: number) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function bestText(background: string, preferred: string) {
  if (contrast(background, preferred) >= 3) return preferred;
  return contrast(background, '#FFFFFF') >= contrast(background, '#000000') ? '#FFFFFF' : '#000000';
}

/**
 * Panel colors for a team. Very dark primaries (Bears navy, Steelers black) disappear on the dark
 * ticker bar, so those teams use their secondary color as the panel background instead.
 */
export function panelColors(team: Team) {
  const tooDark = luminance(team.primary) < 0.025 && luminance(team.secondary) > luminance(team.primary);
  const background = tooDark ? team.secondary : team.primary;
  const other = tooDark ? team.primary : team.secondary;
  return { background, text: bestText(background, other) };
}

/** Text color for a team panel on its primary background (control-panel chips). */
export function panelTextColor(team: Team) {
  return panelColors(team).text;
}

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Nicknames shared by two leagues (Jets, Rangers, Kings, Panthers, Cardinals, Giants, Bucs).
const nameCounts = new Map<string, number>();
for (const team of TEAMS) for (const name of [team.name, ...(team.aliases ?? [])]) nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);

type Matcher = { team: Team; regex: RegExp; name: string; ambiguous: boolean; full: boolean };

// College nicknames that are everyday words: only count as "School Nickname" ("Syracuse Orange").
const BARE_NICKNAME_BLOCK = new Set(['Orange', 'Cardinal']);

// Case-sensitive on purpose: "Heat", "Magic", "Thunder", "Wild" only count as teams when capitalized.
const wordRegex = (pattern: string) => new RegExp(`(?<![A-Za-z])${pattern}(?![A-Za-z])`);

const matchers: Matcher[] = TEAMS.flatMap((team) =>
  [team.name, ...(team.aliases ?? [])].flatMap((name) => {
    const ambiguous = (nameCounts.get(name) ?? 0) > 1;
    const cities = [team.city, ...(team.cityAliases ?? [])];
    return [
      // "Winnipeg Jets" — the city settles which team it is.
      ...cities.map((city) => ({ team, regex: wordRegex(`${escape(city)} ${escape(name)}`), name, ambiguous: false, full: true })),
      // "the Jets" — fine on its own unless another team uses the nickname too.
      ...(team.league === 'NCAA' && BARE_NICKNAME_BLOCK.has(name) ? [] : [{ team, regex: wordRegex(escape(name)), name, ambiguous, full: false }]),
    ];
  }),
);

// College school names on their own ("Miami", "Notre Dame") — only used for stories known to be about
// college sports, longest first so "Texas Tech" is never read as "Texas".
const schoolMatchers = TEAMS.filter((team) => team.league === 'NCAA')
  .flatMap((team) => [team.city, ...(team.cityAliases ?? [])].map((school) => ({ team, school })))
  .sort((a, b) => b.school.length - a.school.length)
  .map(({ team, school }) => ({ team, regex: new RegExp(`(?<![A-Za-z])${escape(school)}(?![A-Za-z])`, 'g') }));

/** Where the story comes from, if known. `college`: the story is about college sports (ESPN college link). */
export type StoryContext = { college?: boolean };

// Words that hint which league a story is about, used to settle a bare shared nickname ("the Jets").
const LEAGUE_HINTS: Record<TeamLeague, RegExp> = {
  NCAA: /\b(?:college|NCAA|Heisman|CFP|College Football Playoff|March Madness|Final Four|bowl game|freshman|sophomore|redshirt|transfer portal|recruits?|SEC|Big Ten|Big 12|ACC|Big East)\b/gi,
  NHL: /\b(?:NHL|hockey|puck|goalie|goaltender|power[- ]play|shutout|hat trick|Stanley Cup|period|saves|goals?|skater|ice)\b/gi,
  NFL: /\b(?:NFL|touchdowns?|quarterback|QB|yards|Super Bowl|receiver|linebacker|cornerback|field goal|sacks?|interception|rushing|passing)\b/gi,
  NBA: /\b(?:NBA|rebounds|three-pointers?|3-pointers?|dunks?|triple-double|double-double|free throws?)\b/gi,
  MLB: /\b(?:MLB|innings?|home runs?|homers?|pitcher|pitched|bullpen|World Series|RBIs?|strikeouts?|closer|shortstop|outfielder)\b/gi,
};

function leagueScores(text: string, context: StoryContext) {
  const scores = new Map<TeamLeague, number>();
  for (const [league, regex] of Object.entries(LEAGUE_HINTS) as [TeamLeague, RegExp][]) scores.set(league, text.match(regex)?.length ?? 0);
  if (context.college) scores.set('NCAA', (scores.get('NCAA') ?? 0) + 3);
  return scores;
}

function cleanForMatching(text: string) {
  return text.replace(/Magic Johnson/g, '');
}

// A team named right after these words is the opponent ("out vs. Bills", "lifts Jets past Canadiens"),
// not who the story is about, so it never becomes the panel. ("at"/"to" are not here: "at Eagles
// facility", "traded to Ravens".)
const OPPONENT_BEFORE = /(?:\bvs\.?|\bversus|\bagainst|\bover|\bpast|\bbeat(?:s|ing)?|\bdefeat(?:s|ed|ing)?)\s+(?:the\s+)?$/i;
const isOpponentMention = (text: string, index: number) => OPPONENT_BEFORE.test(text.slice(Math.max(0, index - 16), index));

/** Position of the first mention that isn't an opponent mention, or -1. */
function firstMention(text: string, regex: RegExp) {
  for (const match of text.matchAll(new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : `${regex.flags}g`))) {
    if (!isOpponentMention(text, match.index)) return match.index;
  }
  return -1;
}

/** All teams a piece of news copy mentions, with the position of their first mention. */
function findTeams(text: string, context: StoryContext = {}): { team: Team; index: number }[] {
  const cleaned = cleanForMatching(text);
  const found = new Map<string, { team: Team; index: number }>();
  const add = (team: Team, index: number) => {
    const existing = found.get(team.key);
    if (!existing || index < existing.index) found.set(team.key, { team, index });
  };
  const ambiguousHits = new Map<string, { index: number; candidates: Team[] }>();
  // Full names ("Miami Dolphins", "Miami Hurricanes") are blanked out afterwards, so the school
  // pass below can't read the "Miami" in "Miami Dolphins" as the Hurricanes.
  let masked = cleaned;
  for (const matcher of matchers) {
    const index = firstMention(cleaned, matcher.regex);
    if (index === -1) continue;
    if (matcher.full) {
      masked = masked.replace(new RegExp(matcher.regex.source, 'g'), (hit) => ' '.repeat(hit.length));
    }
    if (!matcher.ambiguous) {
      add(matcher.team, index);
    } else {
      const hit = ambiguousHits.get(matcher.name) ?? { index, candidates: [] };
      hit.candidates.push(matcher.team);
      ambiguousHits.set(matcher.name, hit);
    }
  }
  // College stories: bare school names count too ("Miami star … against Notre Dame").
  if (context.college) {
    for (const { team, regex } of schoolMatchers) {
      masked = masked.replace(regex, (hit, offset: number) => {
        if (!isOpponentMention(masked, offset)) add(team, offset);
        return ' '.repeat(hit.length);
      });
    }
  }
  // Settle bare shared nicknames: a candidate already named with its city wins; otherwise the
  // league the story's wording points to; otherwise skip it (better no panel than the wrong one).
  // Outside college stories a shared nickname never means a college team ("Eagles" = Philadelphia).
  let scores: Map<TeamLeague, number> | null = null;
  for (const { index, candidates: all } of ambiguousHits.values()) {
    if (all.some((team) => found.has(team.key))) continue;
    const candidates = context.college ? all : all.filter((team) => team.league !== 'NCAA');
    if (candidates.length === 0) continue;
    if (candidates.length === 1) {
      add(candidates[0], index);
      continue;
    }
    scores ??= leagueScores(cleaned, context);
    const ranked = candidates.map((team) => ({ team, score: scores!.get(team.league) ?? 0 })).sort((a, b) => b.score - a.score);
    if (ranked[0].score > 0 && ranked[0].score > (ranked[1]?.score ?? 0)) add(ranked[0].team, index);
  }
  // A college story leads with its college team, any other story with its pro team, when it names both.
  const preferCollege = Boolean(context.college);
  return [...found.values()].sort((a, b) => {
    const aFirst = (a.team.league === 'NCAA') === preferCollege ? 0 : 1;
    const bFirst = (b.team.league === 'NCAA') === preferCollege ? 0 : 1;
    return aFirst - bFirst || a.index - b.index;
  });
}

/** Whether a piece of news copy mentions this team (same rules as detectTeam). */
export function mentionsTeam(text: string, team: Team, context?: StoryContext) {
  return findTeams(text, context).some((hit) => hit.team.key === team.key);
}

/** First team mentioned in a piece of news copy, if any. */
export function detectTeam(text: string, context?: StoryContext): Team | null {
  return findTeams(text, context)[0]?.team ?? null;
}

/** Whether a story link points at ESPN's college sections (college-football, mens-college-basketball, …). */
export function isCollegeLink(link: string | null | undefined) {
  return typeof link === 'string' && /\/(?:college-football|mens-college-basketball|womens-college-basketball|college-sports|ncaa[a-z]*)\//i.test(link);
}

/** Teams a short name could refer to ("Jets" → NFL and NHL Jets; "Winnipeg Jets" → NHL Jets). */
export function teamsNamed(name: string): Team[] {
  const wanted = name.trim().replace(/^the\s+/i, '').toLowerCase();
  return TEAMS.filter((team) =>
    [team.name, ...(team.aliases ?? [])].some((alias) =>
      [alias, ...[team.city, ...(team.cityAliases ?? [])].map((city) => `${city} ${alias}`)].some((full) => full.toLowerCase() === wanted),
    ),
  );
}
