ALTER TABLE `machine_families` ADD `alternate_names` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `machine_families` ADD `search_term` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `machine_families` ADD `machine_status` text DEFAULT 'à confirmer' NOT NULL;--> statement-breakpoint
ALTER TABLE `machine_families` ADD `is_custom` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `machine_families` ADD `updated_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `machine_images` ADD `object_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `machine_images` ADD `is_user_supplied` integer DEFAULT 0 NOT NULL;