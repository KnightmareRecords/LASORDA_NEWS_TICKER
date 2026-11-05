import { HOUSE_PANEL_KEY, TEAMS_BY_KEY } from './teams';

/** A valid team key from lib/teams.ts (or the Lasorda Logo panel), or null. */
export function cleanTeam(value: unknown) {
  return typeof value === 'string' && (value === HOUSE_PANEL_KEY || TEAMS_BY_KEY.has(value)) ? value : null;
}

/** Tag text shown before a headline (e.g. DEVELOPING STORY): uppercase, max 24 chars, or null. */
export function cleanTag(value: unknown) {
  if (typeof value !== 'string') return null;
  const tag = value.replace(/\s+/g, ' ').trim().toUpperCase().slice(0, 24);
  return tag || null;
}
