import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const customHeadlines = sqliteTable('custom_headlines', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  text: text('text').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  placement: text('placement', { enum: ['rotation', 'next'] })
    .notNull()
    .default('rotation'),
  createdAt: integer('created_at').notNull(),
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
  updatedAt: integer('updated_at').notNull().default(0),
});
