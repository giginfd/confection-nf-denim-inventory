import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const inventoryItems = sqliteTable("inventory_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  legacyReference: text("legacy_reference").notNull().unique(),
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
