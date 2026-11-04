/**
 * Spread items with a team panel evenly among generic items, so the ticker never runs a long
 * stretch of generic news. Each group keeps its original (feed) order.
 * e.g. 3 team + 9 generic → T G G G T G G G T G G G
 */
export function spreadTeamItems<T extends { team: string | null }>(items: T[]): T[] {
  const teamItems = items.filter((item) => item.team);
  const generic = items.filter((item) => !item.team);
  if (!teamItems.length || !generic.length) return items;
  const result: T[] = [];
  let t = 0;
  let g = 0;
  while (t < teamItems.length || g < generic.length) {
    // Take from whichever group is further behind its even share of the strip.
    const teamTurn = g >= generic.length || (t < teamItems.length && (t + 0.5) / teamItems.length <= (g + 0.5) / generic.length);
    result.push(teamTurn ? teamItems[t++] : generic[g++]);
  }
  return result;
}
