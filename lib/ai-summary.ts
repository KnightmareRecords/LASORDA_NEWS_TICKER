// AI ticker lines: Cloudflare Workers AI rewrites each feed story into one short factual line.
// Every AI line must pass checkLine() before it can air; anything that fails falls back to the
// plain (trimmed) story text, so a made-up score or name never reaches the stream.

import { detectTeam, mentionsTeam, teamsNamed, type Team } from './teams';

/** Bump when the prompt changes so stories get rewritten with the new instructions. */
export const AI_PROMPT_VERSION = 5;

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
export const AI_MAX_LENGTH = 110;

const SYSTEM_PROMPT = `You write lines for a live sports TV news ticker, like ESPN's BottomLine.
Rewrite the story you are given as ONE short, factual line that makes sense on its own.

Rules:
- At most 90 characters.
- Start with who the story is about (the team or player), then what happened: the result, score, stat, signing, trade or injury.
- Use ONLY facts stated in the story. Never add numbers, names, scores, dates or details that are not in it.
- Normal capitalization: capitalize the first word and all names of people, teams and places.
- No hype, no opinions, no emojis, no hashtags, no quotation marks around the line.

Also label the story:
- KIND: NEWS if it reports something that actually happened or was officially announced: a result or score, signing, trade, release, injury, firing or hiring, suspension, award, election, official decision.
- KIND: FEATURE if it is analysis, a ranking or list, a preview, a prediction, an opinion, a profile, or a teaser that does not state a concrete event.

Examples:
Story: The Bills have released safety C.J. Gardner-Johnson, the team announced Tuesday.
KIND: NEWS
TEAM: Bills
LINE: Bills release safety C.J. Gardner-Johnson

Story: Dylan Samberg scored in overtime as the Winnipeg Jets snapped a nine-game losing streak by storming back from a four-goal deficit.
KIND: NEWS
TEAM: Jets
LINE: Winnipeg Jets rally from four goals down, win in overtime to snap nine-game skid

Story: Arizona State, picked third in the Big 12 preseason poll, beat Utah 31-17 on Saturday.
KIND: NEWS
TEAM: NONE
LINE: Arizona State beats Utah 31-17

Story: Devin Vassell has quietly evolved into the veteran presence for the San Antonio Spurs.
KIND: FEATURE
TEAM: Spurs
LINE: Devin Vassell has become the Spurs' veteran presence

Reply in exactly this format and nothing else:
KIND: <NEWS or FEATURE>
TEAM: <nickname of the NFL, NBA, MLB or NHL team the story is mainly about, or NONE for college and other sports>
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

/** Map the model's TEAM answer to a known team, only if the story itself mentions that team. */
export function resolveTeam(teamName: string | null, source: string): Team | null {
  if (!teamName) return null;
  // "Jets" could be the NFL or NHL Jets: keep the one the story itself is about.
  const matches = teamsNamed(teamName).filter((team) => mentionsTeam(source, team));
  return matches.length === 1 ? matches[0] : null;
}


/**
 * Final polish of an approved line: capital first letter. The team name stays in the line even when
 * a team panel shows it — stripping it left confusing fragments like "Lose Lamar Jackson".
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

/** Ask the model for a ticker line and run the safety checks. Throws if the AI service itself fails. */
export async function summarizeStory(ai: AiBinding, story: string): Promise<AiOutcome> {
  let output: unknown;
  for (let index = preferredModel; ; index++) {
    if (index >= AI_MODELS.length) throw new Error('None of the AI models are available on Cloudflare any more.');
    try {
      output = await ai.run(AI_MODELS[index], {
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: story },
        ],
        max_tokens: 100,
        temperature: 0.2,
      });
      preferredModel = index;
      break;
    } catch (error) {
      if (!isModelGone(error)) throw error;
      console.warn(`AI model ${AI_MODELS[index]} is unavailable, trying the next one`, error);
    }
  }
  const parsed = parseReply(replyText(output));
  if (!parsed) return { status: 'rejected', reason: 'unreadable reply' };
  if (parsed.feature) return { status: 'feature' };
  const problem = checkLine(parsed.line, story);
  if (problem) return { status: 'rejected', reason: problem };
  if (/^[a-z]/.test(parsed.line) && parsed.line.split(/\s+/).length > 3 && !/[A-Z]/.test(parsed.line)) {
    return { status: 'rejected', reason: 'all lowercase' };
  }
  const team = resolveTeam(parsed.team, story)?.key ?? detectTeam(story)?.key ?? null;
  return { status: 'ok', result: { line: finishLine(parsed.line), team } };
}
