// Production build in a local Cloudflare runtime with an isolated DB/R2 and no remote AI.
// First: npm run build && npx wrangler d1 migrations apply DB --local --persist-to .wrangler/audit-state
import { Miniflare } from 'miniflare';
import path from 'node:path';
import fs from 'node:fs';

const root = path.resolve('dist/server');
const files = fs.readdirSync(root, { recursive: true }).filter((file) => file.endsWith('.js') || file.endsWith('.mjs'));
files.sort((a, b) => a === 'index.js' ? -1 : b === 'index.js' ? 1 : a.localeCompare(b));
const runtime = new Miniflare({
  port: 8899,
  modules: files.map((file) => ({ type: 'ESModule', path: path.join(root, file) })),
  compatibilityDate: '2026-05-01', compatibilityFlags: ['nodejs_compat'],
  assets: { directory: path.resolve('dist/client'), binding: 'ASSETS', routerConfig: { has_user_worker: true } },
  d1Databases: { DB: 'e7bc5cc0-4b7f-4a50-b651-1e9171e6ed8a' }, d1Persist: '.wrangler/audit-state/v3/d1',
  r2Buckets: { MEDIA: 'lasorda-ticker-media' }, r2Persist: '.wrangler/audit-state/v3/r2',
});
console.log(`Local audit server: ${await runtime.ready}`);
process.on('SIGINT', async () => { await runtime.dispose(); process.exit(0); });
process.on('SIGTERM', async () => { await runtime.dispose(); process.exit(0); });
