ALTER TABLE `inventory_items` ADD `machine_aliases` text DEFAULT '' NOT NULL;
--> statement-breakpoint
CREATE TABLE `inventory_machine_association_audits` (
	`audit_key` text PRIMARY KEY NOT NULL,
	`inventory_id` integer,
	`legacy_reference` text NOT NULL,
	`supplier_category_code` text NOT NULL,
	`previous_machine_association` text NOT NULL,
	`proposed_machine_association` text NOT NULL,
	`applied_machine_association` text DEFAULT '' NOT NULL,
	`association_type` text DEFAULT '' NOT NULL,
	`audit_classification` text DEFAULT '' NOT NULL,
	`confidence` text DEFAULT '' NOT NULL,
	`evidence_urls` text DEFAULT '' NOT NULL,
	`evidence_source_type` text DEFAULT '' NOT NULL,
	`rationale` text DEFAULT '' NOT NULL,
	`next_physical_verification_step` text DEFAULT '' NOT NULL,
	`reviewer` text DEFAULT '' NOT NULL,
	`reviewed_at` text DEFAULT '' NOT NULL,
	`approval_note` text DEFAULT '' NOT NULL,
	`apply_status` text DEFAULT 'pending' NOT NULL,
	`imported_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `inventory_machine_association_audits_inventory_idx` ON `inventory_machine_association_audits` (`inventory_id`);
--> statement-breakpoint
CREATE INDEX `inventory_machine_association_audits_reference_idx` ON `inventory_machine_association_audits` (`legacy_reference`,`supplier_category_code`);
