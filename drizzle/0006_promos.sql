CREATE TABLE `promos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`text` text DEFAULT '' NOT NULL,
	`media_key` text,
	`media_type` text,
	`enabled` integer DEFAULT true NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `ticker_settings` ADD `segment_seconds` integer DEFAULT 180 NOT NULL;--> statement-breakpoint
ALTER TABLE `ticker_settings` ADD `promo_seconds` integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE `ticker_settings` ADD `scores_enabled` integer DEFAULT true NOT NULL;