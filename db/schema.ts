import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const inventoryItems = sqliteTable("inventory_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  legacyReference: text("legacy_reference").notNull().unique(),
  supplierPartNumber: text("supplier_part_number").notNull().default(""),
  supplierCategoryCode: text("supplier_category_code").notNull().default(""),
  supplierName: text("supplier_name").notNull().default(""),
  description: text("description").notNull(),
  quantityOnHand: real("quantity_on_hand").notNull().default(0),
  lastCost: real("last_cost").notNull().default(0),
  averageCost: real("average_cost").notNull().default(0),
  dealerPrice: real("dealer_price").notNull().default(0),
  salePrice: real("sale_price").notNull().default(0),
  location: text("location").notNull().default(""),
  machineModel: text("machine_model").notNull().default(""),
  costUnit: text("cost_unit").notNull().default(""),
  detailUnit: text("detail_unit").notNull().default(""),
  legacyRawData: text("legacy_raw_data").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const inventoryChanges = sqliteTable("inventory_changes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  inventoryId: integer("inventory_id").notNull(),
  legacyReference: text("legacy_reference").notNull(),
  description: text("description").notNull(),
  changeType: text("change_type").notNull(),
  note: text("note").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const stockMovements = sqliteTable("stock_movements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  inventoryId: integer("inventory_id").notNull(),
  legacyReference: text("legacy_reference").notNull(),
  description: text("description").notNull(),
  movementType: text("movement_type").notNull(),
  quantityDelta: real("quantity_delta").notNull(),
  quantityBefore: real("quantity_before").notNull(),
  quantityAfter: real("quantity_after").notNull(),
  location: text("location").notNull().default(""),
  supplierName: text("supplier_name").notNull().default(""),
  invoiceNumber: text("invoice_number").notNull().default(""),
  note: text("note").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const invoiceDocuments = sqliteTable("invoice_documents", {
  id: text("id").primaryKey(),
  objectKey: text("object_key").notNull().unique(),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull().default("application/pdf"),
  sizeBytes: integer("size_bytes").notNull().default(0),
  status: text("status").notNull().default("uploaded"),
  invoiceNumber: text("invoice_number").notNull().default(""),
  supplierName: text("supplier_name").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  confirmedAt: text("confirmed_at"),
});

export const marketOffers = sqliteTable("market_offers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  inventoryId: integer("inventory_id").notNull(),
  legacyReference: text("legacy_reference").notNull(),
  sourceName: text("source_name").notNull(),
  listingUrl: text("listing_url").notNull(),
  price: real("price").notNull(),
  currency: text("currency").notNull(),
  availability: text("availability").notNull().default("unknown"),
  matchStatus: text("match_status").notNull().default("possible"),
  note: text("note").notNull().default(""),
  checkedAt: text("checked_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Machine research is deliberately stored separately from recovered inventory.
// These fields preserve the source labels and evidence without asserting that a
// part fits a machine merely because it appeared beside an old legacy label.
export const machineResearchImports = sqliteTable("machine_research_imports", {
  snapshotDate: text("snapshot_date").primaryKey(),
  schemaVersion: text("schema_version").notNull(),
  packageName: text("package_name").notNull(),
  importedAt: text("imported_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const machineFamilies = sqliteTable("machine_families", {
  masterFamilyId: text("master_family_id").primaryKey(),
  manufacturer: text("manufacturer").notNull(),
  canonicalModel: text("canonical_model").notNull(),
  originalLabelsPreserved: text("original_labels_preserved").notNull().default(""),
  currentResearchStatus: text("current_research_status").notNull().default(""),
  suggestedProductionStepFrench: text("suggested_production_step_french").notNull().default(""),
  reclassificationAction: text("reclassification_action").notNull().default(""),
  manualServiceUrl: text("manual_service_url").notNull().default(""),
  partsUrl: text("parts_url").notNull().default(""),
  alternateNames: text("alternate_names").notNull().default(""),
  searchTerm: text("search_term").notNull().default(""),
  machineStatus: text("machine_status").notNull().default("à confirmer"),
  isCustom: integer("is_custom").notNull().default(0),
  importedAt: text("imported_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(""),
}, (table) => [index("machine_families_manufacturer_idx").on(table.manufacturer)]);

export const machineImages = sqliteTable("machine_images", {
  masterFamilyId: text("master_family_id").primaryKey(),
  manufacturer: text("manufacturer").notNull().default(""),
  canonicalModelEquipment: text("canonical_model_equipment").notNull().default(""),
  originalLegacyLabelsPreserved: text("original_legacy_labels_preserved").notNull().default(""),
  productionStepFrench: text("production_step_french").notNull().default(""),
  researchStatus: text("research_status").notNull().default(""),
  localImageFilename: text("local_image_filename").notNull(),
  localRelativePath: text("local_relative_path").notNull().default(""),
  publicPath: text("public_path").notNull(),
  objectKey: text("object_key").notNull().default(""),
  isUserSupplied: integer("is_user_supplied").notNull().default(0),
  visualMatch: text("visual_match").notNull().default(""),
  sourceUrl: text("source_url").notNull().default(""),
  assetUrl: text("asset_url").notNull().default(""),
  sourceEvidenceType: text("source_evidence_type").notNull().default(""),
  useNote: text("use_note").notNull().default(""),
  publicationRecommendation: text("publication_recommendation").notNull().default(""),
  rightsAttribution: text("rights_attribution").notNull().default(""),
  importedAt: text("imported_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const machineImageSubmissions = sqliteTable("machine_image_submissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  masterFamilyId: text("master_family_id").notNull(),
  manufacturer: text("manufacturer").notNull().default(""),
  modelSuppliedByUser: text("model_supplied_by_user").notNull().default(""),
  plateModelVisible: text("plate_model_visible").notNull().default(""),
  suppliedFilename: text("supplied_filename").notNull().default(""),
  localRelativePath: text("local_relative_path").notNull().default(""),
  libraryDecision: text("library_decision").notNull().default(""),
  visualAssessment: text("visual_assessment").notNull().default(""),
  evidenceNote: text("evidence_note").notNull().default(""),
  originalSourceUrl: text("original_source_url").notNull().default(""),
  rightsAttribution: text("rights_attribution").notNull().default(""),
  dateReceived: text("date_received").notNull().default(""),
  importedAt: text("imported_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("machine_image_submissions_family_idx").on(table.masterFamilyId)]);

export const legacyLabelReviews = sqliteTable("legacy_label_reviews", {
  reviewId: text("review_id").primaryKey(),
  originalUnresolvedLegacyLabel: text("original_unresolved_legacy_label").notNull(),
  linkedInventoryPartRecords: integer("linked_inventory_part_records").notNull().default(0),
  uniqueProductNumbers: integer("unique_product_numbers").notNull().default(0),
  possibleManufacturerEquipmentHintSource: text("possible_manufacturer_equipment_hint_source").notNull().default(""),
  exampleProductDescriptionsSource: text("example_product_descriptions_source").notNull().default(""),
  exampleSuppliersSource: text("example_suppliers_source").notNull().default(""),
  researchGroupId: text("research_group_id").notNull().default(""),
  likelyManufacturerModelRole: text("likely_manufacturer_model_role").notNull().default(""),
  frenchUiLabel: text("french_ui_label").notNull().default(""),
  productionStepFrench: text("production_step_french").notNull().default(""),
  outcomeEn: text("outcome_en").notNull().default(""),
  verificationStatusFr: text("verification_status_fr").notNull().default(""),
  evidenceAndCautionEn: text("evidence_and_caution_en").notNull().default(""),
  nextVerificationStepEn: text("next_verification_step_en").notNull().default(""),
  manualPartsEvidenceLinks: text("manual_parts_evidence_links").notNull().default(""),
  pageTreatmentFrench: text("page_treatment_french").notNull().default(""),
  importedAt: text("imported_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("legacy_label_reviews_group_idx").on(table.researchGroupId)]);

// Intentionally seeded empty. Future part links require explicit evidence and
// must never be upgraded to confirmed fit from legacy-label co-occurrence.
export const machinePartLinks = sqliteTable("machine_part_links", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  masterFamilyId: text("master_family_id").notNull(),
  inventoryId: integer("inventory_id"),
  legacyReference: text("legacy_reference").notNull().default(""),
  relationshipType: text("relationship_type").notNull().default("mentioned_with_label"),
  confidence: text("confidence").notNull().default(""),
  evidenceType: text("evidence_type").notNull().default(""),
  evidenceReference: text("evidence_reference").notNull().default(""),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("machine_part_links_family_idx").on(table.masterFamilyId)]);
