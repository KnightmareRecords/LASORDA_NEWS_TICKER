CREATE TABLE `custom_headlines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`text` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`placement` text DEFAULT 'rotation' NOT NULL,
	`created_at` integer NOT NULL
);
