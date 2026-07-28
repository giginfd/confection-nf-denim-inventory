CREATE TABLE `inventory_changes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`inventory_id` integer NOT NULL,
	`legacy_reference` text NOT NULL,
	`description` text NOT NULL,
	`change_type` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `inventory_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`legacy_reference` text NOT NULL,
	`supplier_category_code` text DEFAULT '' NOT NULL,
	`supplier_name` text DEFAULT '' NOT NULL,
	`description` text NOT NULL,
	`quantity_on_hand` real DEFAULT 0 NOT NULL,
	`last_cost` real DEFAULT 0 NOT NULL,
	`average_cost` real DEFAULT 0 NOT NULL,
	`dealer_price` real DEFAULT 0 NOT NULL,
	`sale_price` real DEFAULT 0 NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`machine_model` text DEFAULT '' NOT NULL,
	`cost_unit` text DEFAULT '' NOT NULL,
	`detail_unit` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_items_legacy_reference_unique` ON `inventory_items` (`legacy_reference`);