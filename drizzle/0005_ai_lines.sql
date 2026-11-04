CREATE TABLE `ai_lines` (
	`story_key` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`line` text,
	`team` text,
	`reason` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `ticker_settings` ADD `ai_summaries` integer DEFAULT 1 NOT NULL;