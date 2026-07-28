CREATE TABLE `invoice_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`object_key` text NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text DEFAULT 'application/pdf' NOT NULL,
	`size_bytes` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'uploaded' NOT NULL,
	`invoice_number` text DEFAULT '' NOT NULL,
	`supplier_name` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`confirmed_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoice_documents_object_key_unique` ON `invoice_documents` (`object_key`);