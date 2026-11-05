// AI ticker lines: Cloudflare Workers AI rewrites each feed story into one short factual line.
// Every AI line must pass checkLine() before it can air; anything that fails falls back to the
// plain (trimmed) story text, so a made-up score or name never reaches the stream.

import { detectTeam, mentionsTeam, teamsNamed, TEAMS_BY_KEY, type StoryContext, type Team } from './teams';

/** Bump when the prompt changes so stories get rewritten with the new instructions. */
export const AI_PROMPT_VERSION = 8;

// Tried in order. Cloudflare retires models from time to time (llama-3.1-8b-instruct was retired
// 2026-05-30), so if one is gone the next is used automatically. No OpenAI models (Jay's rule).
export const AI_MODELS = [
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  '@cf/mistralai/mistral-small-3.1-24b-instruct',
  '@cf/google/gemma-3-12b-it',
];
let preferredModel = 0;

function isModelGone(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /deprecat|5028|5007|no such model|model not found|not available|unknown model/i.test(message);
}
// Prompt asks for 70; a little slack so a 72-character line isn't thrown away.
export const AI_MAX_LENGTH = 80;

const SYSTEM_PROMPT = `You write lines for a live sports TV news ticker, like ESPN's BottomLine.
Rewrite the story you are given as ONE short, factual line that makes sense on its own.

Rules:
- At most 70 characters. Short and punchy, like a headline.
- The ticker shows the main team's logo and name right BEFORE your line. So do NOT start the line with that team's name (city or nickname): lead with the player or the event instead, then what happened (result, score, stat, signing, trade, injury). Reword it as a complete phrase (for example "Jacoby Brissett traded to Ravens"), never just drop the name and leave a fragment like "Trade Jacoby Brissett". Other teams can be named anywhere in the line.
- Only NFL, NBA, MLB, NHL and major college teams get a logo panel. Anything else (a league, a golf or tennis tour, a soccer club, a school we don't cover, a person) gets NO panel, so the line MUST name who it is about: "LIV Golf winding down operations", never just "Operations being wound down".
- If no single team is the focus (TEAM: NONE), start with whoever the story is about.
- Use ONLY facts stated in the story. Never add numbers, names, scores, dates or details that are not in it.
- Keep the story's exact meaning. Never swap in a word that a sports fan would read differently: "teammates didn't defend him" is NOT "lack of defense". If shortening would change the meaning, stay closer to the story's own words.
- Normal capitalization: capitalize the first word and all names of people, teams and places.
- No hype, no opinions, no emojis, no hashtags, no quotation marks around the line.

Also label the story:
- KIND: NEWS if it reports something that actually happened or was officially announced: a result or score, signing, trade, release, injury, firing or hiring, suspension, award, election, official decision.
- KIND: FEATURE if it is analysis, a ranking or list, a preview, a prediction, an opinion, a profile, or a teaser that does not state a concrete event.

Examples:
Story: The Bills have released safety C.J. Gardner-Johnson, the team announced Tuesday.
KIND: NEWS
TEAM: Bills
LINE: Safety C.J. Gardner-Johnson released

Story: The Arizona Cardinals are trading quarterback Jacoby Brissett to the Baltimore Ravens, sources said.
KIND: NEWS
TEAM: Cardinals
LINE: QB Jacoby Brissett being traded to Ravens

Story: Dylan Samberg scored in overtime as the Winnipeg Jets snapped a nine-game losing streak by storming back from a four-goal deficit.
KIND: NEWS
TEAM: Jets
LINE: Dylan Samberg's OT winner caps rally, snaps nine-game skid

Story: Arizona State, picked third in the Big 12 preseason poll, beat Utah 31-17 on Saturday.
KIND: NEWS
TEAM: Sun Devils
LINE: 31-17 win over Utah

Story: Devin Vassell has quietly evolved into the veteran presence for the San Antonio Spurs.
KIND: FEATURE
TEAM: Spurs
LINE: Devin Vassell has become the Spurs' veteran presence

Reply in exactly this format and nothing else:
KIND: <NEWS or FEATURE>
TEAM: <nickname of the NFL, NBA, MLB, NHL or major college team the story is mainly about, or NONE>
LINE: <the ticker line>`;

export type AiResult = { line: string; team: string | null };
export type AiOutcome =
  | { status: 'ok'; result: AiResult }
  | { status: 'rejected'; reason: string }
  /** Not news (ranking, preview, analysis…): left off the ticker. */
  | { status: 'feature' };

/** Pull TEAM/LINE out of the model's reply. */
export function parseReply(raw: string): { team: string | null; line: string; feature: boolean } | null {
  const line = raw.match(/^\s*LINE:\s*(.+)$/im)?.[1]?.trim();
  if (!line) return null;
  const team = raw.match(/^\s*TEAM:\s*(.+)$/im)?.[1]?.trim() ?? '';
  const feature = /^\s*KIND:\s*FEATURE\b/im.test(raw);
  return { line: line.replace(/^["“'‘]+|["”'’]+$/g, '').trim(), team: /^none$/i.test(team) || !team ? null : team, feature };
}

const normalize = (value: string) => value.toLowerCase().replace(/[’']/g, "'");

/**
 * Safety check for an AI line against the original story text. Returns null when the line is
 * fine, or the reason it was rejected.
 */
export function checkLine(line: string, source: string): string | null {
  if (line.length < 15) return 'too short';
  if (line.length > AI_MAX_LENGTH) return 'too long';
  if (/\b(as an ai|i cannot|i can't|i'm sorry|here is|here's the|ticker line)\b/i.test(line)) return 'not a ticker line';
  if (/[\n#@]|https?:\/\//.test(line)) return 'formatting';

  // Every number in the line must appear in the story (catches invented scores and stats).
  const sourceNumbers = new Set(source.match(/\d+(?:\.\d+)?/g) ?? []);
  const badNumber = (line.match(/\d+(?:\.\d+)?/g) ?? []).find((number) => !sourceNumbers.has(number));
  if (badNumber) return `number ${badNumber} is not in the story`;

  // Every capitalized name after the first word must appear in the story (catches invented people/teams).
  const sourceText = normalize(source);
  const words = line.match(/[A-Z][A-Za-z'’.-]*[A-Za-z]/g) ?? [];
  const firstWord = line.match(/^[^A-Za-z]*([A-Za-z'’.-]+)/)?.[1];
  for (const word of words) {
    if (word === firstWord) continue;
    const base = normalize(word).replace(/'s$/, '').replace(/\.$/, '');
    if (base.length >= 2 && !sourceText.includes(base)) return `“${word}” is not in the story`;
  }
  return null;
}

/**
 * Map the model's TEAM answer to a known team, only if the story itself mentions that team.
 * `context.college`: an ESPN college story, so "Hurricanes" means Miami (UM), not Carolina's NHL team.
 */
export function resolveTeam(teamName: string | null, source: string, context: StoryContext = {}): Team | null {
  if (!teamName) return null;
  // "Jets" could be the NFL or NHL Jets: keep the one the story itself is about.
  const matches = teamsNamed(teamName).filter((team) => mentionsTeam(source, team, context));
  if (matches.length === 1) return matches[0];
  // Both a college and a pro team match: a college story means the college one, any other story the pro one.
  const preferred = matches.filter((team) => (team.league === 'NCAA') === Boolean(context.college));
  return preferred.length === 1 ? preferred[0] : null;
}

/** Whether the line names who the AI said the story is about ("LIV Golf" → "LIV …"). */
function namesSubject(line: string, subject: string) {
  const text = line.toLowerCase();
  return subject.split(/\s+/).some((word) => word.length >= 3 && text.includes(word.toLowerCase()));
}


const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Whether a line opens with the team shown on its panel ("Cardinals trade …", "Arizona Cardinals …",
 * "The Bills …", "UM …"). The ticker already shows that team right before the line.
 */
export function startsWithTeam(line: string, teamKey: string | null) {
  const team = teamKey ? TEAMS_BY_KEY.get(teamKey) : undefined;
  if (!team) return false;
  const names = [`${team.city} ${team.name}`, team.name, ...(team.aliases ?? []), ...(team.short ? [team.short] : []), team.city, ...(team.cityAliases ?? [])];
  return names.some((name) => new RegExp(`^(?:the\\s+)?${escapeRegex(name)}(?![A-Za-z])`, 'i').test(line.trim()));
}

/**
 * Final polish of an approved line: capital first letter. Lines are never cut down mechanically:
 * stripping the team name left fragments like "Lose Lamar Jackson"; the AI rewords instead (prompt v7).
 */
export function finishLine(line: string) {
  const text = line.trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

type AiBinding = { run: (model: string, input: Record<string, unknown>) => Promise<unknown> };

function replyText(output: unknown) {
  if (typeof output === 'string') return output;
  if (output && typeof output === 'object' && 'response' in output) {
    const response = (output as { response: unknown }).response;
    return typeof response === 'string' ? response : JSON.stringify(response ?? '');
  }
  return '';
}

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

/** One model call, falling back to the next model if Cloudflare has retired one. */
async function ask(ai: AiBinding, messages: ChatMessage[]) {
  for (let index = preferredModel; ; index++) {
    if (index >= AI_MODELS.length) throw new Error('None of the AI models are available on Cloudflare any more.');
    try {
      const output = await ai.run(AI_MODELS[index], { messages, max_tokens: 100, temperature: 0.2 });
      preferredModel = index;
      return replyText(output);
    } catch (error) {
      if (!isModelGone(error)) throw error;
      console.warn(`AI model ${AI_MODELS[index]} is unavailable, trying the next one`, error);
    }
  }
}

const allLowercase = (line: string) => /^[a-z]/.test(line) && line.split(/\s+/).length > 3 && !/[A-Z]/.test(line);

/** Ask the model for a ticker line and run the safety checks. Throws if the AI service itself fails. */
export async function summarizeStory(ai: AiBinding, story: string, context: StoryContext = {}): Promise<AiOutcome> {
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: story },
  ];
  const reply = await ask(ai, messages);
  const parsed = parseReply(reply);
  if (!parsed) return { status: 'rejected', reason: 'unreadable reply' };
  if (parsed.feature) return { status: 'feature' };
  const problem = checkLine(parsed.line, story);
  if (problem) return { status: 'rejected', reason: problem };
  if (allLowercase(parsed.line)) return { status: 'rejected', reason: 'all lowercase' };
  const team = resolveTeam(parsed.team, story, context)?.key ?? detectTeam(story, context)?.key ?? null;
  let line = parsed.line;

  // One retry, for either problem; if the retry fails a check or still has the problem, the first
  // (safe) line airs — never a cut-down fragment.
  // - Opens with the panel team ("Cardinals trade …"): the panel already shows it.
  // - No panel will show, and the line doesn't say who it's about ("Operations being wound down").
  const opensWithTeam = (candidate: string) => startsWithTeam(candidate, team);
  const missingSubject = (candidate: string) => !team && Boolean(parsed.team) && !namesSubject(candidate, parsed.team!);
  const teamName = team ? (TEAMS_BY_KEY.get(team)?.name ?? 'the team') : '';
  const fix = opensWithTeam(line)
    ? `That LINE starts with the team (${teamName}), but the ticker already shows the ${teamName} logo and name right before it. Rewrite the LINE so it starts with the player or the event, as a complete phrase with the same facts. Reply in the same format.`
    : missingSubject(line)
      ? `No logo or name will be shown before this LINE, so it must say who it is about. Rewrite the LINE so it names ${parsed.team} (or the player), with the same facts. Reply in the same format.`
      : null;
  if (fix) {
    try {
      const retry = parseReply(await ask(ai, [...messages, { role: 'assistant', content: reply }, { role: 'user', content: fix }]));
      if (retry && !retry.feature && !checkLine(retry.line, story) && !allLowercase(retry.line) && !opensWithTeam(retry.line) && !missingSubject(retry.line)) line = retry.line;
    } catch {
      // keep the first line
    }
  }
  return { status: 'ok', result: { line: finishLine(line), team } };
}
