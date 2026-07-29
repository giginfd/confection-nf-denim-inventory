ALTER TABLE `machine_families` ADD `merged_into_machine_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `machine_families` ADD `linked_record_override` integer DEFAULT -1 NOT NULL;
