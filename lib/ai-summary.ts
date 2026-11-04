// AI ticker lines: Cloudflare Workers AI rewrites each feed story into one short factual line.
// Every AI line must pass checkLine() before it can air; anything that fails falls back to the
// plain (trimmed) story text, so a made-up score or name never reaches the stream.

import { detectTeam, type Team } from './teams';

export const AI_MODEL = '@cf/meta/llama-3.1-8b-instruct';
export const AI_MAX_LENGTH = 110;

const SYSTEM_PROMPT = `You write lines for a live sports TV news ticker, like ESPN's BottomLine.
Rewrite the story you are given as ONE short, factual line.

Rules:
- At most 90 characters.
- Use ONLY facts stated in the story. Never add numbers, names, scores, dates or details that are not in it.
- Lead with what happened: the result, score, stat, signing, trade or injury.
- Plain sentence case. No hype, no opinions, no emojis, no hashtags, no quotation marks around the line.
- Do not start the line with the team name; it is shown separately.

Reply in exactly this format and nothing else:
TEAM: <nickname of the one team the story is mainly about, or NONE>
LINE: <the ticker line>`;

export type AiResult = { line: string; team: string | null };
export type AiOutcome = { status: 'ok'; result: AiResult } | { status: 'rejected'; reason: string };

/** Pull TEAM/LINE out of the model's reply. */
export function parseReply(raw: string): { team: string | null; line: string } | null {
  const line = raw.match(/^\s*LINE:\s*(.+)$/im)?.[1]?.trim();
  if (!line) return null;
  const team = raw.match(/^\s*TEAM:\s*(.+)$/im)?.[1]?.trim() ?? '';
  return { line: line.replace(/^["“'‘]+|["”'’]+$/g, '').trim(), team: /^none$/i.test(team) || !team ? null : team };
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
  const team = detectTeam(teamName) ?? detectTeam(`${teamName}`.replace(/^the\s+/i, ''));
  if (!team) return null;
  const mentioned = [team.name, ...(team.aliases ?? [])].some((name) => source.includes(name));
  return mentioned ? team : null;
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
  const output = await ai.run(AI_MODEL, {
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: story },
    ],
    max_tokens: 80,
    temperature: 0.2,
  });
  const parsed = parseReply(replyText(output));
  if (!parsed) return { status: 'rejected', reason: 'unreadable reply' };
  const problem = checkLine(parsed.line, story);
  if (problem) return { status: 'rejected', reason: problem };
  return { status: 'ok', result: { line: parsed.line, team: resolveTeam(parsed.team, story)?.key ?? null } };
}
