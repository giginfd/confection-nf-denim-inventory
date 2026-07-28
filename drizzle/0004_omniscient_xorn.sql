CREATE TABLE `market_offers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`inventory_id` integer NOT NULL,
	`legacy_reference` text NOT NULL,
	`source_name` text NOT NULL,
	`listing_url` text NOT NULL,
	`price` real NOT NULL,
	`currency` text NOT NULL,
	`availability` text DEFAULT 'unknown' NOT NULL,
	`match_status` text DEFAULT 'possible' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`checked_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
