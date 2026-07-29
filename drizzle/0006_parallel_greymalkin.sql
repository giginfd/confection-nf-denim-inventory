CREATE TABLE `legacy_label_reviews` (
	`review_id` text PRIMARY KEY NOT NULL,
	`original_unresolved_legacy_label` text NOT NULL,
	`linked_inventory_part_records` integer DEFAULT 0 NOT NULL,
	`unique_product_numbers` integer DEFAULT 0 NOT NULL,
	`possible_manufacturer_equipment_hint_source` text DEFAULT '' NOT NULL,
	`example_product_descriptions_source` text DEFAULT '' NOT NULL,
	`example_suppliers_source` text DEFAULT '' NOT NULL,
	`research_group_id` text DEFAULT '' NOT NULL,
	`likely_manufacturer_model_role` text DEFAULT '' NOT NULL,
	`french_ui_label` text DEFAULT '' NOT NULL,
	`production_step_french` text DEFAULT '' NOT NULL,
	`outcome_en` text DEFAULT '' NOT NULL,
	`verification_status_fr` text DEFAULT '' NOT NULL,
	`evidence_and_caution_en` text DEFAULT '' NOT NULL,
	`next_verification_step_en` text DEFAULT '' NOT NULL,
	`manual_parts_evidence_links` text DEFAULT '' NOT NULL,
	`page_treatment_french` text DEFAULT '' NOT NULL,
	`imported_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `legacy_label_reviews_group_idx` ON `legacy_label_reviews` (`research_group_id`);--> statement-breakpoint
CREATE TABLE `machine_families` (
	`master_family_id` text PRIMARY KEY NOT NULL,
	`manufacturer` text NOT NULL,
	`canonical_model` text NOT NULL,
	`original_labels_preserved` text DEFAULT '' NOT NULL,
	`current_research_status` text DEFAULT '' NOT NULL,
	`suggested_production_step_french` text DEFAULT '' NOT NULL,
	`reclassification_action` text DEFAULT '' NOT NULL,
	`manual_service_url` text DEFAULT '' NOT NULL,
	`parts_url` text DEFAULT '' NOT NULL,
	`imported_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `machine_families_manufacturer_idx` ON `machine_families` (`manufacturer`);--> statement-breakpoint
CREATE TABLE `machine_image_submissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`master_family_id` text NOT NULL,
	`manufacturer` text DEFAULT '' NOT NULL,
	`model_supplied_by_user` text DEFAULT '' NOT NULL,
	`plate_model_visible` text DEFAULT '' NOT NULL,
	`supplied_filename` text DEFAULT '' NOT NULL,
	`local_relative_path` text DEFAULT '' NOT NULL,
	`library_decision` text DEFAULT '' NOT NULL,
	`visual_assessment` text DEFAULT '' NOT NULL,
	`evidence_note` text DEFAULT '' NOT NULL,
	`original_source_url` text DEFAULT '' NOT NULL,
	`rights_attribution` text DEFAULT '' NOT NULL,
	`date_received` text DEFAULT '' NOT NULL,
	`imported_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `machine_image_submissions_family_idx` ON `machine_image_submissions` (`master_family_id`);--> statement-breakpoint
CREATE TABLE `machine_images` (
	`master_family_id` text PRIMARY KEY NOT NULL,
	`manufacturer` text DEFAULT '' NOT NULL,
	`canonical_model_equipment` text DEFAULT '' NOT NULL,
	`original_legacy_labels_preserved` text DEFAULT '' NOT NULL,
	`production_step_french` text DEFAULT '' NOT NULL,
	`research_status` text DEFAULT '' NOT NULL,
	`local_image_filename` text NOT NULL,
	`local_relative_path` text DEFAULT '' NOT NULL,
	`public_path` text NOT NULL,
	`visual_match` text DEFAULT '' NOT NULL,
	`source_url` text DEFAULT '' NOT NULL,
	`asset_url` text DEFAULT '' NOT NULL,
	`source_evidence_type` text DEFAULT '' NOT NULL,
	`use_note` text DEFAULT '' NOT NULL,
	`publication_recommendation` text DEFAULT '' NOT NULL,
	`rights_attribution` text DEFAULT '' NOT NULL,
	`imported_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `machine_part_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`master_family_id` text NOT NULL,
	`inventory_id` integer,
	`legacy_reference` text DEFAULT '' NOT NULL,
	`relationship_type` text DEFAULT 'mentioned_with_label' NOT NULL,
	`confidence` text DEFAULT '' NOT NULL,
	`evidence_type` text DEFAULT '' NOT NULL,
	`evidence_reference` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `machine_part_links_family_idx` ON `machine_part_links` (`master_family_id`);--> statement-breakpoint
CREATE TABLE `machine_research_imports` (
	`snapshot_date` text PRIMARY KEY NOT NULL,
	`schema_version` text NOT NULL,
	`package_name` text NOT NULL,
	`imported_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
