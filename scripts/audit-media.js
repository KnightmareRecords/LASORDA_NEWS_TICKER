// oxlint-disable-next-line no-unused-expressions -- playwright-cli consumes this function expression.
async (page) => {
  const context = await page.context().browser().newContext({ viewport: { width: 1080, height: 60 }, serviceWorkers: 'block' });
  const tab = await context.newPage();
  const results = [];
  const check = (ok, text) => { if (!ok) throw new Error(text); results.push(text); };
  let seq = 0;
  const tick = async (ms) => {
    for (let elapsed = 0; elapsed < ms; elapsed += 100) {
      await tab.clock.runFor(Math.min(100, ms - elapsed));
      await tab.waitForTimeout(10);
    }
  };
  const promos = [
    { id: 1, kind: 'image', text: 'Broken file', enabled: true, position: 0, url: '/test-missing-image.png' },
    { id: 2, kind: 'image', text: 'Good file', enabled: true, position: 1, url: '/brand/lasordas-card-house.png' },
    { id: 3, kind: 'text', text: 'FOLLOW @LASORDASCARDHOUSE', enabled: true, position: 2, url: null },
  ];
  await tab.route('**/test-missing-image.png', (route) => route.fulfill({ status: 404, body: '' }));
  await tab.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    await route.fulfill({ json: path === '/api/advance' ? { seq } : path === '/api/settings' ? { scoresEnabled: false, segmentSeconds: 30, promoSeconds: 10 }
      : path === '/api/promos' ? promos : path === '/api/scores' ? { games: [] }
        : { headlines: [{ id: 'test', text: 'Live card breaks', source: 'LIVE' }] } });
  });
  try {
    await tab.clock.install();
    await tab.goto('http://127.0.0.1:8899/ticker?preview=1');
    await tab.waitForTimeout(2000);
    seq++;
    // The skip check runs every 5 s: advance the clock in small steps until the promo starts entering
    // (so the error below still lands inside the entrance fade).
    for (let waited = 0; waited < 7000 && (await tab.locator('.media-layer img').count()) === 0; waited += 100) await tick(100);
    await tick(300);
    check(await tab.locator('.media-layer img').count() === 1, 'Ready image enters while the broken upload is skipped');
    check((await tab.locator('.media-layer img').getAttribute('src')).includes('/brand/'), 'Broken image never airs');
    await tab.locator('.media-layer img').evaluate((img) => img.dispatchEvent(new Event('error')));
    await tick(3100);
    check(await tab.locator('.media-layer').count() === 0, 'Image failure during entrance fade ends the promo early');
    check(await tab.locator('.ticker-shell').evaluate((el) => getComputedStyle(el).opacity === '1'), 'News bar returns after failed media');
    seq++;
    await tick(7000); // skip check runs every 5 s
    check((await tab.locator('.promo-text').innerText()).includes('LASORDASCARDHOUSE'), 'Rotation continues to the next working promo');
    return results;
  } finally { await context.close(); }
}
