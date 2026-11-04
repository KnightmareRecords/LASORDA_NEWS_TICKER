declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    ADMIN_TOKEN?: string;
    /** Workers AI binding (wrangler.jsonc "ai"). */
    AI?: Ai;
  }
}
