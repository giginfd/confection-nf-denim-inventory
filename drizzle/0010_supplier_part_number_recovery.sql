CREATE TABLE `inventory_data_imports` (
	`import_key` text PRIMARY KEY NOT NULL,
	`source_name` text NOT NULL,
	`matched_count` integer DEFAULT 0 NOT NULL,
	`conflict_count` integer DEFAULT 0 NOT NULL,
	`missing_count` integer DEFAULT 0 NOT NULL,
	`imported_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
