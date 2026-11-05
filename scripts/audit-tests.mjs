import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

// Bundle the actual TS modules so these regressions run without a browser or remote services.
async function source(file, env = {}) {
  globalThis.__tickerAuditEnv = env;
  const result = await build({
    entryPoints: [file], bundle: true, write: false, platform: 'node', format: 'esm',
    plugins: [{ name: 'test-bindings', setup(builder) {
      builder.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: 'bindings', namespace: 'test' }));
      builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const env = globalThis.__tickerAuditEnv;' }));
    } }],
  });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}

const { mixHeadlines } = await source('lib/mix.ts');
const { parseMediaRange } = await source('lib/media-range.ts');
const { createSceneWaiter, createJsonPoller } = await source('lib/ticker-runtime.ts');
const { parseScoreboard, groupScores } = await source('lib/scores.ts');
const { readJsonObject } = await source('lib/request-body.ts');

await test('malformed JSON bodies cannot crash field validators', async () => {
  for (const body of ['null', '[]', '12', '"text"', '{broken']) {
    assert.deepEqual(await readJsonObject(new Request('https://ticker.test', { method: 'POST', body })), {});
  }
  assert.deepEqual(await readJsonObject(new Request('https://ticker.test', { method: 'POST', body: '{"text":"hello"}' })), { text: 'hello' });
});

await test('all custom announcements survive empty, short, and long feeds', () => {
  for (const count of [0, 1, 3, 4, 8, 40]) {
    const feed = Array.from({ length: count }, (_, i) => `feed-${i}`);
    const result = mixHeadlines(feed, ['custom-a', 'custom-b', 'custom-c'], ['next']);
    assert.equal(result[0], 'next');
    for (const item of [...feed, 'custom-a', 'custom-b', 'custom-c']) assert.ok(result.includes(item));
  }
});

await test('skipped scene timer cannot erase a subsequent scene hook', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const waiter = createSceneWaiter();
  const hook = { current: null };
  const first = waiter.wait(30_000, hook);
  t.mock.timers.tick(3000);
  hook.current();
  await first;
  const second = waiter.wait(60_000, hook);
  const skipSecond = hook.current;
  t.mock.timers.tick(30_000);
  assert.equal(hook.current, skipSecond);
  hook.current();
  await second;
  assert.equal(hook.current, null);
  waiter.cancel();
});

await test('cycle cancellation settles pending waits and releases hooks', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const waiter = createSceneWaiter();
  const hook = { current: null };
  const pending = waiter.wait(30_000, hook);
  waiter.cancel();
  await pending;
  assert.equal(hook.current, null);
});

await test('polls deduplicate slow requests, abort, and allow recovery', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', (_url, { signal }) => {
    calls++;
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))));
  });
  const poll = createJsonPoller(20);
  const first = poll('/scores');
  assert.equal(poll('/scores'), first);
  await assert.rejects(first, /aborted/);
  assert.equal(calls, 1);
  t.mock.method(globalThis, 'fetch', async () => Response.json({ recovered: true }));
  assert.deepEqual(await poll('/scores'), { recovered: true });
});

await test('media byte ranges support suffix, open end, clamping, and invalid requests', () => {
  assert.deepEqual(parseMediaRange('bytes=0-9', 100), { offset: 0, length: 10 });
  assert.deepEqual(parseMediaRange('bytes=90-', 100), { offset: 90, length: 10 });
  assert.deepEqual(parseMediaRange('bytes=-10', 100), { offset: 90, length: 10 });
  assert.deepEqual(parseMediaRange('bytes=90-999', 100), { offset: 90, length: 10 });
  assert.deepEqual(parseMediaRange('bytes=-999', 100), { offset: 0, length: 100 });
  for (const value of ['bytes=100-', 'bytes=9-1', 'bytes=-0', 'bytes=-', 'bytes=0-1,3-4', 'bytes=9007199254740992-']) {
    assert.equal(parseMediaRange(value, 100), null, value);
  }
});

await test('malformed and incomplete scoreboards fail quietly', () => {
  for (const value of [null, {}, { events: null }, { events: [null, {}, { id: 'bad', date: 'bad' }] }]) {
    assert.deepEqual(parseScoreboard('NBA', value, Date.now()), []);
  }
});

await test('AI cache failure does not take down custom headlines or original news', async (t) => {
  const env = { DB: { prepare(sql) { return {
    bind() { return this; },
    first: async () => ({ feedUrl: 'https://example.com/audit-feed', feedLabel: 'NEWS', aiSummaries: 1 }),
    all: async () => {
      if (sql.includes('FROM ai_lines')) throw new Error('AI cache unavailable');
      return { results: [{ id: 1, text: 'Live card breaks', placement: 'rotation', team: null, tag: null }] };
    },
  }; } } };
  t.mock.method(globalThis, 'fetch', async () => new Response('<rss><channel><item><guid>audit</guid><title>Dodgers win 4-2</title></item></channel></rss>'));
  const { GET } = await source('app/api/headlines/route.ts', env);
  const response = await GET(new Request('https://ticker.test/api/headlines'));
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.ok(data.headlines.some((item) => item.text === 'Live card breaks'));
  assert.ok(data.headlines.some((item) => item.text === 'Dodgers win 4-2'));
  assert.ok(data.ai.error);
});


await test('scores are grouped by sport, sports with live games first', () => {
  const side = { abbr: 'X', score: '1', team: null, logo: null, rank: null, winner: false };
  const game = (id, league, state, start) => ({ id, league, state, detail: '', away: side, home: side, start });
  const mixed = [
    game('a', 'NBA', 'final', 1), game('b', 'NHL', 'live', 2), game('c', 'NBA', 'live', 3),
    game('d', 'NFL', 'upcoming', 9), game('e', 'NHL', 'final', 4), game('f', 'NBA', 'upcoming', 8), game('g', 'NFL', 'final', 5),
  ];
  const order = groupScores(mixed).map((item) => `${item.league}:${item.id}`);
  // NBA and NHL have live games, so they lead (in the usual league order); NFL follows. No league appears twice.
  assert.deepEqual(order, ['NBA:c', 'NBA:a', 'NBA:f', 'NHL:b', 'NHL:e', 'NFL:g', 'NFL:d']);
  const many = Array.from({ length: 30 }, (_, index) => game(`n${index}`, 'NBA', 'final', index));
  assert.equal(groupScores([...many, game('h', 'NHL', 'final', 1)]).filter((item) => item.league === 'NBA').length, 15);
});

const { summarizeStory, startsWithTeam } = await source('lib/ai-summary.ts');

await test('AI lines never open with the team already shown on the panel', async () => {
  assert.equal(startsWithTeam('Cardinals trade Jacoby Brissett to Ravens', 'nfl-ari'), true);
  assert.equal(startsWithTeam('Arizona Cardinals trade QB', 'nfl-ari'), true);
  assert.equal(startsWithTeam('The Cardinals trade QB', 'nfl-ari'), true);
  assert.equal(startsWithTeam('UM star Toney has ankle sprain', 'ncaa-um'), true);
  assert.equal(startsWithTeam('Jacoby Brissett traded to Ravens', 'nfl-ari'), false);
  assert.equal(startsWithTeam('Cardinals trade QB', null), false);

  const story = 'The Arizona Cardinals are finalizing a trade that sends quarterback Jacoby Brissett to the Baltimore Ravens, sources said.';
  const fakeAi = (replies) => {
    const calls = [];
    return { calls, run: async (_model, input) => { calls.push(input.messages); return { response: replies[calls.length - 1] }; } };
  };
  // First line opens with the team -> one retry, reworded line airs.
  const good = fakeAi(['KIND: NEWS\nTEAM: Cardinals\nLINE: Cardinals trade Jacoby Brissett to Ravens', 'KIND: NEWS\nTEAM: Cardinals\nLINE: Jacoby Brissett traded to Ravens']);
  const first = await summarizeStory(good, story);
  assert.equal(good.calls.length, 2);
  assert.deepEqual(first, { status: 'ok', result: { line: 'Jacoby Brissett traded to Ravens', team: 'nfl-ari' } });

  // Retry invents a name (fails the safety check) -> the first, safe line airs; never a fragment.
  const bad = fakeAi(['KIND: NEWS\nTEAM: Cardinals\nLINE: Cardinals trade Jacoby Brissett to Ravens', 'KIND: NEWS\nTEAM: Cardinals\nLINE: Brissett dealt to Ravens for Lamar Jackson']);
  const second = await summarizeStory(bad, story);
  assert.equal(second.status === 'ok' && second.result.line, 'Cardinals trade Jacoby Brissett to Ravens');

  // A line that already avoids the team needs no second call.
  const once = fakeAi(['KIND: NEWS\nTEAM: Cardinals\nLINE: Jacoby Brissett headed to Ravens']);
  await summarizeStory(once, story);
  assert.equal(once.calls.length, 1);
});

await test('college stories get college teams; lines without a panel still say who', async () => {
  const fakeAi = (replies) => {
    const calls = [];
    return { calls, run: async (_model, input) => { calls.push(input.messages); return { response: replies[calls.length - 1] }; } };
  };
  // ESPN college story: the AI says "Hurricanes" -> Miami (UM), never Carolina's NHL team.
  const toney = "Notre Dame is preparing for multiple scenarios for Saturday's showdown with Miami following news of an ankle injury to Hurricanes star receiver Malachi Toney.";
  const college = await summarizeStory(fakeAi(['KIND: NEWS\nTEAM: Hurricanes\nLINE: Malachi Toney injured ankle']), toney, { college: true });
  assert.equal(college.status === 'ok' && college.result.team, 'ncaa-um');
  const hockey = await summarizeStory(fakeAi(['KIND: NEWS\nTEAM: Hurricanes\nLINE: Seth Jarvis scores twice in win over Rangers']), 'Seth Jarvis scored twice as the Carolina Hurricanes beat the New York Rangers.', {});
  assert.equal(hockey.status === 'ok' && hockey.result.team, 'nhl-car');

  // No panel for LIV Golf: a line without the subject is reworded once to name it.
  const liv = "LIV Golf confirmed it is winding down operations after the league couldn't get the necessary financial commitment and player support to proceed with LIV 2.0.";
  const fixed = fakeAi(['KIND: NEWS\nTEAM: LIV Golf\nLINE: Operations being wound down due to financial issues', 'KIND: NEWS\nTEAM: LIV Golf\nLINE: LIV Golf winding down operations']);
  const livOutcome = await summarizeStory(fixed, liv, {});
  assert.equal(fixed.calls.length, 2);
  assert.deepEqual(livOutcome, { status: 'ok', result: { line: 'LIV Golf winding down operations', team: null } });
  // Already names the subject: no second call.
  const fine = fakeAi(['KIND: NEWS\nTEAM: LIV Golf\nLINE: LIV Golf shutting down after financial trouble']);
  await summarizeStory(fine, liv, {});
  assert.equal(fine.calls.length, 1);
});

const { parseFeedList, joinFeedList, mixFeeds, sameStory, MAX_FEEDS } = await source('lib/feeds.ts');

await test('several feeds are mixed by turns, duplicates across sites air once', () => {
  // Old single-address setting still works; blank lines and repeats are dropped; capped.
  assert.deepEqual(parseFeedList('https://www.espn.com/espn/rss/news'), ['https://www.espn.com/espn/rss/news']);
  assert.deepEqual(parseFeedList(' https://a.com/rss \n\nhttps://b.com/rss\r\nhttps://a.com/rss '), ['https://a.com/rss', 'https://b.com/rss']);
  assert.equal(parseFeedList(Array.from({ length: 12 }, (_, i) => `https://f${i}.com/rss`).join('\n')).length, MAX_FEEDS);
  assert.equal(joinFeedList(['https://a.com/rss', '', 'https://b.com/rss']), 'https://a.com/rss\nhttps://b.com/rss');

  // The same story syndicated by two sites; different stories about the same player are kept.
  assert.equal(sameStory('An investigation regarding the Jalen Hurts situation has not begun', 'Investigation regarding Jalen Hurts situation has not begun, per report'), true);
  assert.equal(sameStory('Kyler Murray out Monday with hamstring injury', 'Vikings to start Carson Wentz against Bills'), false);
  assert.equal(sameStory('Kyler Murray out Monday with hamstring injury', 'Kyler Murray throws for 300 yards in win'), false);

  const nfl = [{ id: 'n1', title: 'Kyler Murray out Monday with hamstring injury' }, { id: 'n2', title: 'Rams sign K Joshua Karty to 53-man roster' }];
  const nba = [{ id: 'b1', title: 'Victor Wembanyama posts 52 points' }, { id: 'b2', title: 'Kyler Murray ruled out Monday with hamstring injury' }];
  const nhl = [{ id: 'h1', title: 'Samberg lifts Jets past Canadiens in overtime' }];
  // Takes turns between feeds; the second Murray story (other site) is dropped.
  assert.deepEqual(mixFeeds([nfl, nba, nhl], 12).map((item) => item.id), ['n1', 'b1', 'h1', 'n2']);
  // Per-feed limit applies before mixing.
  assert.deepEqual(mixFeeds([nfl, nba, nhl], 1).map((item) => item.id), ['n1', 'b1', 'h1']);
});

const { detectTeam } = await source('lib/teams.ts');

await test('a team named as the opponent never becomes the panel', () => {
  const key = (text, context) => detectTeam(text, context)?.key ?? null;
  assert.equal(key('Kyler Murray out for Monday vs. Bills, week-to-week with hamstring injury'), null);
  assert.equal(key('Samberg lifts Jets past Canadiens 5-4 with OT goal'), 'nhl-wpg');
  assert.equal(key('Bills beat Jets 30-10'), 'nfl-buf');
  assert.equal(key('Hurts makes appearance at Eagles facility'), 'nfl-phi');
  assert.equal(key('Miami star Toney out against Notre Dame', { college: true }), 'ncaa-um');
});
