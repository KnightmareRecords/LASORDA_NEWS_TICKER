import { env } from 'cloudflare:workers';

export function isAdmin(request: Request) {
  const expected = env.ADMIN_TOKEN || 'local';
  return request.headers.get('X-Admin-Key') === expected;
}

export function unauthorized() {
  return Response.json({ error: 'A valid admin key is required.' }, { status: 401 });
}
