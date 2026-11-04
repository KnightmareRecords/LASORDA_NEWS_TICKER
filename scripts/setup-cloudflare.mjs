// One-time Cloudflare setup + deploy for the LASORDA News Ticker.
// Run from the project folder:  node scripts/setup-cloudflare.mjs
// (On Windows you can just double-click "SETUP CLOUDFLARE.cmd".)
// Safe to run again later: it reuses the existing database and just redeploys.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const DB_NAME = 'lasorda-ticker-db';
const PLACEHOLDER = '00000000-0000-4000-8000-000000000000';
const step = (n, text) => console.log(`\n=== Step ${n}: ${text} ===\n`);
const run = (cmd) => execSync(cmd, { stdio: 'inherit' });
const capture = (cmd) => execSync(cmd, { encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'] });

function findDatabaseId() {
  const out = capture('npx wrangler d1 list --json');
  const list = JSON.parse(out.slice(out.indexOf('[')));
  return list.find((db) => db.name === DB_NAME)?.uuid;
}

try {
  step(1, 'Installing project files (takes a minute the first time)');
  run('npm install');

  step(2, 'Signing in to Cloudflare');
  try {
    capture('npx wrangler whoami');
    if (/not authenticated/i.test(capture('npx wrangler whoami'))) throw new Error();
    console.log('Already signed in.');
  } catch {
    console.log('Your browser will open. Sign in (or sign up) and click "Allow".');
    run('npx wrangler login');
  }

  step(3, 'Creating the ticker database');
  let id = findDatabaseId();
  if (id) console.log(`Database already exists (${id}).`);
  else {
    run(`npx wrangler d1 create ${DB_NAME}`);
    id = findDatabaseId();
  }
  if (!id) throw new Error('Could not find the database id after creating it.');
  const config = readFileSync('wrangler.jsonc', 'utf8');
  if (config.includes(PLACEHOLDER)) {
    writeFileSync('wrangler.jsonc', config.replace(PLACEHOLDER, id));
    console.log('Saved the database id into wrangler.jsonc.');
  }

  step(4, 'Setting up the database tables');
  run('npx wrangler d1 migrations apply DB --remote');

  step(5, 'Publishing the ticker');
  run('npm run deploy');

  step(6, 'Choose your editing password (the "Admin key" in the control panel)');
  console.log('Type a password and press Enter. Nothing shows while you type - that is normal.');
  run('npx wrangler secret put ADMIN_TOKEN');

  console.log('\nALL DONE. Your web address is the https://...workers.dev link printed in Step 5.');
  console.log('  Control panel:  that link');
  console.log('  OBS source:     that link + /ticker   (1920 x 120)\n');
} catch (error) {
  console.error('\nSomething went wrong above. Copy the red text and send it to Claude.');
  if (error?.message) console.error(error.message);
  process.exitCode = 1;
}
