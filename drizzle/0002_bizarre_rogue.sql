CREATE TABLE `stock_movements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`inventory_id` integer NOT NULL,
	`legacy_reference` text NOT NULL,
	`description` text NOT NULL,
	`movement_type` text NOT NULL,
	`quantity_delta` real NOT NULL,
	`quantity_before` real NOT NULL,
	`quantity_after` real NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`supplier_name` text DEFAULT '' NOT NULL,
	`invoice_number` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
