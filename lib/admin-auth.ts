import { env } from 'cloudflare:workers';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function isAdmin(request: Request) {
  const provided = request.headers.get('X-Admin-Key');
  if (!provided) return false;
  if (env.ADMIN_TOKEN) return provided === env.ADMIN_TOKEN;
  // No ADMIN_TOKEN secret set: allow the dev key `local` only when running on this machine,
  // so a deployed site without a secret is locked rather than open to everyone.
  return provided === 'local' && LOCAL_HOSTS.has(new URL(request.url).hostname);
}

export function unauthorized() {
  return Response.json({ error: 'A valid admin key is required.' }, { status: 401 });
}
