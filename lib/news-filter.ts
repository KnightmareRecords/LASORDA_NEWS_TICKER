// Drops feature-style items (rankings, previews, analysis, questions, how-tos) that tell viewers
// nothing happened. Cheap word rules run first on every story; the AI also labels each story
// NEWS or FEATURE (lib/ai-summary.ts) to catch what the rules miss.

const FEATURE_START = /^(?:here'?s|here are|we |we're |our |what |why |how |which |who |where |when |ranking |ranked:|the best|the worst|best |worst |find |get ready|before |a look|a conference-by-conference|inside |meet |everything |the (?:\d+|top) )/i;

const FEATURE_WORDS = new RegExp(
  [
    String.raw`\bwe (?:look|break|rank|ranked|picked|made|asked|predict|polled|tracked|graded|identify|examine)`,
    String.raw`\bwe're (?:tracking|ranking|breaking)`,
    String.raw`\bour (?:picks|predictions|list|rankings|experts|staff|writers|panel)\b`,
    String.raw`\bbreaks? down\b`,
    String.raw`\btakes on\b`,
    String.raw`\bwhat (?:you|to) need to know\b`,
    String.raw`\bwhat to know\b`,
    String.raw`\bpower rankings?\b`,
    String.raw`\bmock draft\b`,
    String.raw`\b(?:best|expert) bets?\b`,
    String.raw`\bbetting\b`,
    String.raw`\bodds\b`,
    String.raw`\bfantasy\b`,
    String.raw`\bwaiver\b`,
    String.raw`\bpreviews?\b`,
    String.raw`\bwinners and losers\b`,
    String.raw`\btakeaways\b`,
    String.raw`\bgrades?\b(?! school)`,
    String.raw`\bwhat would happen\b`,
    String.raw`\bhow (?:the|all|every) .{0,30}(?:stack up|rank)\b`,
    String.raw`\b(?:rank|ranks|ranked) after\b`,
    String.raw`\bcomposite ranks\b`,
    String.raw`\bfree agent class\b`,
  ].join('|'),
  'i',
);

/** True when a story reads like a feature/teaser rather than an actual news event. */
export function isFeatureStory(text: string) {
  const story = text.trim();
  if (story.includes('?')) return true;
  return FEATURE_START.test(story) || FEATURE_WORDS.test(story);
}
