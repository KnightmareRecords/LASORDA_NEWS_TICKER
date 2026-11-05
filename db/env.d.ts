declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    ADMIN_TOKEN?: string;
    /** Workers AI binding (wrangler.jsonc "ai"). */
    AI?: Ai;
    /** R2 bucket for uploaded promo images/videos (wrangler.jsonc "r2_buckets"). Optional: text promos work without it. */
    MEDIA?: R2Bucket;
  }
}
