// Team colors for ticker team panels. Colors are each team's primary/secondary as commonly
// published; tweak any entry here if a shade looks off on stream.
// Only team names and colors are used — no official logos or wordmarks (trademarks).

export type League = 'NFL' | 'NBA' | 'MLB';
export type Team = {
  key: string;
  league: League;
  city: string;
  name: string;
  primary: string;
  secondary: string;
  /** Other ways the team is written in news copy. */
  aliases?: string[];
};

const t = (league: League, abbr: string, city: string, name: string, primary: string, secondary: string, aliases?: string[]): Team => ({
  key: `${league.toLowerCase()}-${abbr.toLowerCase()}`,
  league,
  city,
  name,
  primary,
  secondary,
  aliases,
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
];

export const TEAMS_BY_KEY = new Map(TEAMS.map((team) => [team.key, team]));

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

// Nicknames shared by two leagues (Cardinals, Giants, Bucs): only used when the city is also named.
const nameCounts = new Map<string, number>();
for (const team of TEAMS) for (const name of [team.name, ...(team.aliases ?? [])]) nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);

const matchers = TEAMS.flatMap((team) =>
  [team.name, ...(team.aliases ?? [])].map((name) => {
    const ambiguous = (nameCounts.get(name) ?? 0) > 1;
    const pattern = ambiguous ? `${escape(team.city)} ${escape(name)}` : escape(name);
    // Case-sensitive on purpose: "Heat", "Magic", "Thunder" only count as teams when capitalized.
    return { team, regex: new RegExp(`(?<![A-Za-z])${pattern}(?![A-Za-z])`) };
  }),
);

// Hockey teams aren't in the list; remove NHL names that share a nickname with an NFL/NBA/MLB team
// (otherwise "Winnipeg Jets" would get the New York Jets panel).
function cleanForMatching(text: string) {
  return text
    .replace(/Magic Johnson/g, '')
    .replace(/\b(?:Winnipeg Jets|New York Rangers|NY Rangers|Los Angeles Kings|L\.?A\.? Kings|Florida Panthers)\b/g, '');
}

/** Whether a piece of news copy mentions this team (same rules as detectTeam). */
export function mentionsTeam(text: string, team: Team) {
  const cleaned = cleanForMatching(text);
  return matchers.some((matcher) => matcher.team.key === team.key && matcher.regex.test(cleaned));
}

/** First team mentioned in a piece of news copy, if any. */
export function detectTeam(text: string): Team | null {
  const cleaned = cleanForMatching(text);
  let best: { team: Team; index: number } | null = null;
  for (const { team, regex } of matchers) {
    const index = cleaned.search(regex);
    if (index !== -1 && (!best || index < best.index)) best = { team, index };
  }
  return best?.team ?? null;
}
