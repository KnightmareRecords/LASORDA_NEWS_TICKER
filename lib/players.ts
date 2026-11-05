// Last-resort team panel from a player's name ("Kyler Murray out vs. Bills" → Vikings), for stories
// that never name the player's team. Server-only (imported by the headlines route), so the ~150 KB
// roster list never reaches the OBS ticker. Pure in-memory lookups: no network, nothing to fail live.
import { PLAYER_TEAMS } from './rosters';

/** Same normalization as scripts/fetch-rosters.mjs. */
export function normalizePlayerName(name: string) {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[.’']/g, '').replace(/\b(?:jr|sr|ii|iii|iv)\b/g, '').replace(/[^a-z -]/g, ' ').replace(/\s+/g, ' ').trim();
}

// A player named right after these words is the opponent ("held to 12 points against LeBron James").
const OPPONENT_BEFORE = /(?:\bvs\.?|\bversus|\bagainst|\bover|\bpast|\bbeat(?:s|ing)?|\bdefeat(?:s|ed|ing)?)\s+$/i;
// Runs of capitalized words: "Vikings QB Carson Wentz", "Ronald Acuña Jr."
const NAME_RUN = /[A-ZÀ-Ý][\p{L}'’.-]*(?:\s+[A-ZÀ-Ý][\p{L}'’.-]*)+/gu;

/** Team key of the first known player named in the text (skipping opponents and shared names), or null. */
export function teamFromPlayers(text: string, roster: Record<string, string> = PLAYER_TEAMS): string | null {
  for (const match of text.matchAll(NAME_RUN)) {
    if (OPPONENT_BEFORE.test(text.slice(Math.max(0, match.index - 14), match.index))) continue;
    const words = match[0].split(/\s+/);
    // Try every 2–3 word stretch of the run ("Vikings QB Carson Wentz" → "carson wentz").
    for (let start = 0; start < words.length - 1; start += 1) {
      for (const size of [3, 2]) {
        if (start + size > words.length) continue;
        const key = roster[normalizePlayerName(words.slice(start, start + size).join(' '))];
        if (key) return key;
      }
    }
  }
  return null;
}
