/**
 * Spread items with a team panel evenly among generic items, so the ticker never runs a long
 * stretch of generic news. Each group keeps its original (feed) order.
 * e.g. 3 team + 9 generic → T G G G T G G G T G G G (always opens with a team story)
 */
export function spreadTeamItems<T extends { team: string | null }>(items: T[]): T[] {
  const teamItems = items.filter((item) => item.team);
  const generic = items.filter((item) => !item.team);
  if (!teamItems.length || !generic.length) return items;
  // The strip always opens with a team story (so a team panel is the first thing on screen), and
  // the team stories sit at evenly spaced positions from there: slot i * total / teamCount.
  const total = items.length;
  const teamSlots = new Set(teamItems.map((_, index) => Math.round((index * total) / teamItems.length)));
  const result: T[] = [];
  let t = 0;
  let g = 0;
  for (let position = 0; position < total; position++) {
    const teamTurn = g >= generic.length || (t < teamItems.length && teamSlots.has(position));
    result.push(teamTurn ? teamItems[t++] : generic[g++]);
  }
  return result;
}
