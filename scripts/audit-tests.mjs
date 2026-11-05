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
const { parseScoreboard } = await source('lib/scores.ts');
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

