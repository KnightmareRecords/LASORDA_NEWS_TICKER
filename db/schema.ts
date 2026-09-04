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
