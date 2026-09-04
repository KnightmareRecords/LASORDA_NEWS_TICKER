CREATE TABLE `ticker_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`accent_color` text DEFAULT '#ffb000' NOT NULL,
	`background_color` text DEFAULT '#0a0e16' NOT NULL,
	`text_color` text DEFAULT '#ffffff' NOT NULL,
	`font_family` text DEFAULT 'Geist' NOT NULL,
	`font_size` integer DEFAULT 25 NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);
