import { env } from 'cloudflare:workers';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function isAdmin(request: Request) {
  const provided = request.headers.get('X-Admin-Key')?.trim();
  if (!provided) return false;
  const expected = env.ADMIN_TOKEN?.trim();
  if (expected) return provided === expected;
  // No ADMIN_TOKEN secret set: allow the dev key `local` only when running on this machine,
  // so a deployed site without a secret is locked rather than open to everyone.
  return provided === 'local' && LOCAL_HOSTS.has(new URL(request.url).hostname);
}

export function unauthorized() {
  const message = env.ADMIN_TOKEN?.trim()
    ? 'That admin key is not right. Check it and try again.'
    : 'No admin password is set on the server yet. Double-click "SET PASSWORD.cmd" in the ticker folder.';
  return Response.json({ error: message }, { status: 401 });
}
