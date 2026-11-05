import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const customHeadlines = sqliteTable('custom_headlines', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  text: text('text').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  placement: text('placement', { enum: ['rotation', 'next'] })
    .notNull()
    .default('rotation'),
  createdAt: integer('created_at').notNull(),
  /** Team key from lib/teams.ts (e.g. 'nfl-kc'); shows a team-colored panel on the ticker. */
  team: text('team'),
  /** Optional tag shown before the item, e.g. 'DEVELOPING STORY'. */
  tag: text('tag'),
});

export const tickerSettings = sqliteTable('ticker_settings', {
  id: integer('id').primaryKey(),
  accentColor: text('accent_color').notNull().default('#ffb000'),
  backgroundColor: text('background_color').notNull().default('#0a0e16'),
  textColor: text('text_color').notNull().default('#ffffff'),
  fontFamily: text('font_family').notNull().default('Geist'),
  fontSize: integer('font_size').notNull().default(25),
  scrollSpeed: integer('scroll_speed').notNull().default(90),
  feedUrl: text('feed_url').notNull().default('https://news.google.com/rss/topics/CAAqKggKIiRDQkFTRlFvSUwyMHZNRFp1ZEdvU0JXVnVMVlZUR2dKVlV5Z0FQAQ?hl=en-US&gl=US&ceid=US:en'),
  feedLabel: text('feed_label').notNull().default('SPORTS'),
  /** Rewrite feed stories into short ticker lines with Cloudflare Workers AI (1 = on). */
  aiSummaries: integer('ai_summaries', { mode: 'boolean' }).notNull().default(true),
  /** Seconds each segment (news, scores) stays on before switching. */
  segmentSeconds: integer('segment_seconds').notNull().default(180),
  /** Seconds each promo shows between segments. */
  promoSeconds: integer('promo_seconds').notNull().default(10),
  /** Show the game scores segment (skipped automatically when there are no games). */
  scoresEnabled: integer('scores_enabled', { mode: 'boolean' }).notNull().default(true),
  /** Bumped by the control panel's "Skip ahead" button; tickers skip to the next part when it changes. */
  advanceSeq: integer('advance_seq').notNull().default(0),
  updatedAt: integer('updated_at').notNull().default(0),
});

/** One AI ticker line per feed story (keyed by story id + text hash), so each story is summarized once. */
export const aiLines = sqliteTable('ai_lines', {
  storyKey: text('story_key').primaryKey(),
  /** 'ok' = line passed the safety checks; 'rejected' = failed them (the plain text airs instead). */
  status: text('status', { enum: ['ok', 'rejected'] }).notNull(),
  line: text('line'),
  team: text('team'),
  reason: text('reason'),
  createdAt: integer('created_at').notNull(),
});

/** Promos shown one at a time between the news and scores segments, in `position` order. */
export const promos = sqliteTable('promos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  kind: text('kind', { enum: ['text', 'image', 'video'] }).notNull(),
  /** Text slide wording (kind 'text'), or a label for an uploaded file. */
  text: text('text').notNull().default(''),
  /** R2 object key of the uploaded file (image/video). */
  mediaKey: text('media_key'),
  mediaType: text('media_type'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  position: integer('position').notNull().default(0),
  createdAt: integer('created_at').notNull(),
});
