// Run with playwright-cli run-code --filename=scripts/audit-browser.js against the isolated build.
// oxlint-disable-next-line no-unused-expressions -- playwright-cli consumes this function expression.
async (page) => {
  const results = [];
  const check = (ok, message) => { if (!ok) throw new Error(message); results.push(message); console.log(`PASS ${message}`); };
  const origin = 'http://127.0.0.1:8899';
  const browser = page.context().browser();
  const context = await browser.newContext({ viewport: { width: 1080, height: 60 }, serviceWorkers: 'block' });
  const tab = await context.newPage();
  // Let fetch responses and React commits settle between virtual seconds.
  const tick = async (ms) => {
    for (let elapsed = 0; elapsed < ms; elapsed += 1000) {
      await tab.clock.runFor(Math.min(1000, ms - elapsed));
      await tab.waitForTimeout(30);
    }
  };
  const errors = [];
  tab.on('pageerror', (error) => errors.push(error.message));
  let seq = 0;
  let outage = false;
  let hangScores = true;
  let headlines = [{ id: 'one', text: 'Go Dodgers!', source: 'NEWS', team: 'mlb-lad', tag: null }];
  let promos = [{ id: 1, kind: 'text', text: 'FOLLOW LASORDAS CARD HOUSE FOR NEW BREAKS GIVEAWAYS AND MORE @LASORDASCARDHOUSE', enabled: true, position: 0, url: null }];
  const settings = { accentColor: '#16b8fe', backgroundColor: '#0a0e16', textColor: '#ffffff', fontFamily: 'Geist', fontSize: 25, scrollSpeed: 90, segmentSeconds: 30, promoSeconds: 10, scoresEnabled: true };
  const game = { id: 'NBA-test', league: 'NBA', state: 'live', detail: 'Q4 2:13', start: Date.now(),
    away: { abbr: 'LAL', score: '90', team: 'nba-lal', logo: null, rank: null, winner: false },
    home: { abbr: 'BOS', score: '91', team: 'nba-bos', logo: null, rank: null, winner: false } };
  await tab.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (outage) return route.abort();
    if (path === '/api/scores' && hangScores) return;
    const data = path === '/api/settings' ? settings : path === '/api/headlines' ? { headlines }
      : path === '/api/promos' ? promos : path === '/api/scores' ? { games: [game] } : { seq };
    await route.fulfill({ json: data });
  });
  try {
    await tab.clock.install();
    await tab.goto(`${origin}/ticker?preview=1`);
    await tab.waitForTimeout(4000);
    check(await tab.locator('.ticker-shell').isVisible(), 'Startup stays visible with a hung scores request');
    check(await tab.locator('.ticker-item').count() >= 4, 'Short feed repeats to fill the viewport');
    const sizes = await tab.evaluate(() => ({ group: document.querySelector('.ticker-group').getBoundingClientRect().width, viewport: document.querySelector('.ticker-window').clientWidth }));
    check(sizes.group >= sizes.viewport, 'Each scrolling copy spans the viewport');
    await tab.screenshot({ path: 'output/playwright/short-feed-1080.png' });
    hangScores = false;
    await tab.reload();
    await tab.waitForTimeout(2000);
    seq++;
    await tick(7000); // skip check runs every 5 s
    check(await tab.locator('.promo-text').count() > 0, 'First skip enters a promo');
    const fit = await tab.locator('.promo-text-content').last().evaluate((el) => {
      const r = el.getBoundingClientRect(); const p = el.parentElement.getBoundingClientRect();
      return r.left >= p.left && r.right <= p.right;
    });
    check(fit, 'Long promo text fits the 1080px source');
    await tab.screenshot({ path: 'output/playwright/text-promo-1080.png', animations: 'disabled' });
    await tick(13000);
    check(await tab.locator('.score-item').count() > 0, 'Promo advances to scores');
    await tick(15000);
    seq++;
    await tick(7000); // skip check runs every 5 s
    check(await tab.locator('.promo-text').count() > 0, 'Second skip works after the old segment deadline');
    await tick(13000);
    const resumedDelay = await tab.locator('.strip-layer.is-entering .ticker-track').evaluate((el) => parseFloat(el.style.animationDelay));
    check(resumedDelay < 0, 'News resumes its saved position after scores and promos');
    outage = true;
    await tick(16000);
    check(await tab.locator('.ticker-item').count() > 0, 'Network loss preserves the last good news');
    outage = false;
    headlines = [];
    promos = [];
    settings.scoresEnabled = false;
    await tick(30000);
    check((await tab.locator('.ticker-shell').innerText()).toLowerCase().includes('welcome'), 'Empty sources show a branded fallback');
    await tab.screenshot({ path: 'output/playwright/fallback-1080.png' });
    headlines = [{ id: 'return', text: 'Connection restored', source: 'LIVE', team: null, tag: null }];
    await tab.setViewportSize({ width: 1920, height: 60 });
    await tick(16000);
    check((await tab.locator('.ticker-shell').innerText()).includes('Connection restored'), 'Polling recovers after an outage');
    const wide = await tab.evaluate(() => ({ group: document.querySelector('.ticker-group').getBoundingClientRect().width, viewport: document.querySelector('.ticker-window').clientWidth }));
    check(wide.group >= wide.viewport, 'Short feeds fill the 1920px source after resizing');
    check(errors.length === 0, `No uncaught browser errors (${errors.length})`);
    return results;
  } finally { await context.close(); }
}

