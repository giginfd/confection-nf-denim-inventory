CREATE TABLE `supplier_contacts` (
	`supplier_name` text PRIMARY KEY NOT NULL,
	`supplier_code` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`website` text DEFAULT '' NOT NULL,
	`status_key` text DEFAULT 'verify' NOT NULL,
	`status_detail` text DEFAULT '' NOT NULL,
	`status_note` text DEFAULT '' NOT NULL,
	`source_url` text DEFAULT '' NOT NULL,
	`verified_date` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `supplier_contacts_code_idx` ON `supplier_contacts` (`supplier_code`);
