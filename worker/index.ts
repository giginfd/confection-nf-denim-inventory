/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { runWithExecutionContext } from "vinext/shims/request-context";
import { inventorySeed } from "../app/lib/inventory-seed";
import { machineCatalog, productionStages, type MachineCatalogEntry, type MachineStage, type MachineStatus } from "../app/lib/machine-catalog";
import { machineResearchFamilies, machineResearchSnapshot } from "../app/lib/machine-research-family-seed";
import { machineResearchImageSubmissions } from "../app/lib/machine-research-submission-seed";
import { machineResearchLegacyLabelReviews } from "../app/lib/machine-research-review-seed";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  INVOICES?: R2Bucket;
  APP_PASSWORD?: string;
  SESSION_SECRET?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (env.APP_PASSWORD) {
      if (url.pathname === "/auth/login" && request.method === "POST") return handlePasswordLogin(request, env);
      if (url.pathname === "/auth/logout") return passwordRedirect(request, "", 0);
      const publicAsset = url.pathname.startsWith("/assets/") || url.pathname.startsWith("/_vinext/") || url.pathname === "/favicon.svg";
      if (!publicAsset && !(await hasValidPasswordSession(request, env))) {
        if (url.pathname.startsWith("/api/")) return json({ error: "Password required." }, 401);
        return passwordPage();
      }
    }

    if (url.pathname.startsWith("/api/")) {
      return runWithExecutionContext(ctx, () => handleApi(request, env, url));
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return runWithExecutionContext(ctx, () => handler.fetch(request, env, ctx));
  },
};

export default worker;

type D1Row = Record<string, unknown>;

const inventorySortColumns: Record<string, string> = {
  legacyReference: "legacy_reference",
  supplierPartNumber: "supplier_part_number",
  description: "description",
  machineModel: "machine_model",
  location: "location",
  quantityOnHand: "quantity_on_hand",
  supplierName: "supplier_name",
  lastCost: "last_cost",
};

const initializeStatements = [
  `CREATE TABLE IF NOT EXISTS inventory_items (id INTEGER PRIMARY KEY AUTOINCREMENT, legacy_reference TEXT NOT NULL UNIQUE, supplier_part_number TEXT NOT NULL DEFAULT '', supplier_category_code TEXT NOT NULL DEFAULT '', supplier_name TEXT NOT NULL DEFAULT '', description TEXT NOT NULL, quantity_on_hand REAL NOT NULL DEFAULT 0, last_cost REAL NOT NULL DEFAULT 0, average_cost REAL NOT NULL DEFAULT 0, dealer_price REAL NOT NULL DEFAULT 0, sale_price REAL NOT NULL DEFAULT 0, location TEXT NOT NULL DEFAULT '', machine_model TEXT NOT NULL DEFAULT '', cost_unit TEXT NOT NULL DEFAULT '', detail_unit TEXT NOT NULL DEFAULT '', legacy_raw_data TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS inventory_changes (id INTEGER PRIMARY KEY AUTOINCREMENT, inventory_id INTEGER NOT NULL, legacy_reference TEXT NOT NULL, description TEXT NOT NULL, change_type TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS stock_movements (id INTEGER PRIMARY KEY AUTOINCREMENT, inventory_id INTEGER NOT NULL, legacy_reference TEXT NOT NULL, description TEXT NOT NULL, movement_type TEXT NOT NULL, quantity_delta REAL NOT NULL, quantity_before REAL NOT NULL, quantity_after REAL NOT NULL, location TEXT NOT NULL DEFAULT '', supplier_name TEXT NOT NULL DEFAULT '', invoice_number TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS invoice_documents (id TEXT PRIMARY KEY, object_key TEXT NOT NULL UNIQUE, file_name TEXT NOT NULL, content_type TEXT NOT NULL DEFAULT 'application/pdf', size_bytes INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'uploaded', invoice_number TEXT NOT NULL DEFAULT '', supplier_name TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, confirmed_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS market_offers (id INTEGER PRIMARY KEY AUTOINCREMENT, inventory_id INTEGER NOT NULL, legacy_reference TEXT NOT NULL, source_name TEXT NOT NULL, listing_url TEXT NOT NULL, price REAL NOT NULL, currency TEXT NOT NULL, availability TEXT NOT NULL DEFAULT 'unknown', match_status TEXT NOT NULL DEFAULT 'possible', note TEXT NOT NULL DEFAULT '', checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS machine_research_imports (snapshot_date TEXT PRIMARY KEY, schema_version TEXT NOT NULL, package_name TEXT NOT NULL, imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS machine_families (master_family_id TEXT PRIMARY KEY, manufacturer TEXT NOT NULL, canonical_model TEXT NOT NULL, original_labels_preserved TEXT NOT NULL DEFAULT '', current_research_status TEXT NOT NULL DEFAULT '', suggested_production_step_french TEXT NOT NULL DEFAULT '', reclassification_action TEXT NOT NULL DEFAULT '', manual_service_url TEXT NOT NULL DEFAULT '', parts_url TEXT NOT NULL DEFAULT '', alternate_names TEXT NOT NULL DEFAULT '', search_term TEXT NOT NULL DEFAULT '', machine_status TEXT NOT NULL DEFAULT 'à confirmer', is_custom INTEGER NOT NULL DEFAULT 0, imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS machine_images (master_family_id TEXT PRIMARY KEY, manufacturer TEXT NOT NULL DEFAULT '', canonical_model_equipment TEXT NOT NULL DEFAULT '', original_legacy_labels_preserved TEXT NOT NULL DEFAULT '', production_step_french TEXT NOT NULL DEFAULT '', research_status TEXT NOT NULL DEFAULT '', local_image_filename TEXT NOT NULL, local_relative_path TEXT NOT NULL DEFAULT '', public_path TEXT NOT NULL, object_key TEXT NOT NULL DEFAULT '', is_user_supplied INTEGER NOT NULL DEFAULT 0, visual_match TEXT NOT NULL DEFAULT '', source_url TEXT NOT NULL DEFAULT '', asset_url TEXT NOT NULL DEFAULT '', source_evidence_type TEXT NOT NULL DEFAULT '', use_note TEXT NOT NULL DEFAULT '', publication_recommendation TEXT NOT NULL DEFAULT '', rights_attribution TEXT NOT NULL DEFAULT '', imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS machine_image_submissions (id INTEGER PRIMARY KEY AUTOINCREMENT, master_family_id TEXT NOT NULL, manufacturer TEXT NOT NULL DEFAULT '', model_supplied_by_user TEXT NOT NULL DEFAULT '', plate_model_visible TEXT NOT NULL DEFAULT '', supplied_filename TEXT NOT NULL DEFAULT '', local_relative_path TEXT NOT NULL DEFAULT '', library_decision TEXT NOT NULL DEFAULT '', visual_assessment TEXT NOT NULL DEFAULT '', evidence_note TEXT NOT NULL DEFAULT '', original_source_url TEXT NOT NULL DEFAULT '', rights_attribution TEXT NOT NULL DEFAULT '', date_received TEXT NOT NULL DEFAULT '', imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS legacy_label_reviews (review_id TEXT PRIMARY KEY, original_unresolved_legacy_label TEXT NOT NULL, linked_inventory_part_records INTEGER NOT NULL DEFAULT 0, unique_product_numbers INTEGER NOT NULL DEFAULT 0, possible_manufacturer_equipment_hint_source TEXT NOT NULL DEFAULT '', example_product_descriptions_source TEXT NOT NULL DEFAULT '', example_suppliers_source TEXT NOT NULL DEFAULT '', research_group_id TEXT NOT NULL DEFAULT '', likely_manufacturer_model_role TEXT NOT NULL DEFAULT '', french_ui_label TEXT NOT NULL DEFAULT '', production_step_french TEXT NOT NULL DEFAULT '', outcome_en TEXT NOT NULL DEFAULT '', verification_status_fr TEXT NOT NULL DEFAULT '', evidence_and_caution_en TEXT NOT NULL DEFAULT '', next_verification_step_en TEXT NOT NULL DEFAULT '', manual_parts_evidence_links TEXT NOT NULL DEFAULT '', page_treatment_french TEXT NOT NULL DEFAULT '', imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS machine_part_links (id INTEGER PRIMARY KEY AUTOINCREMENT, master_family_id TEXT NOT NULL, inventory_id INTEGER, legacy_reference TEXT NOT NULL DEFAULT '', relationship_type TEXT NOT NULL DEFAULT 'mentioned_with_label', confidence TEXT NOT NULL DEFAULT '', evidence_type TEXT NOT NULL DEFAULT '', evidence_reference TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE INDEX IF NOT EXISTS inventory_items_description_idx ON inventory_items(description)`,
  `CREATE INDEX IF NOT EXISTS inventory_changes_created_idx ON inventory_changes(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS stock_movements_inventory_idx ON stock_movements(inventory_id)`,
  `CREATE INDEX IF NOT EXISTS invoice_documents_created_idx ON invoice_documents(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS market_offers_inventory_idx ON market_offers(inventory_id, checked_at DESC)`,
  `CREATE INDEX IF NOT EXISTS machine_families_manufacturer_idx ON machine_families(manufacturer)`,
  `CREATE INDEX IF NOT EXISTS machine_image_submissions_family_idx ON machine_image_submissions(master_family_id)`,
  `CREATE INDEX IF NOT EXISTS legacy_label_reviews_group_idx ON legacy_label_reviews(research_group_id)`,
  `CREATE INDEX IF NOT EXISTS machine_part_links_family_idx ON machine_part_links(master_family_id)`,
];

async function initialize(db: D1Database) {
  await db.batch(initializeStatements.map((statement) => db.prepare(statement)));
  const supplierPartNumberColumn = await db.prepare("SELECT name FROM pragma_table_info('inventory_items') WHERE name = ?").bind("supplier_part_number").first<D1Row>();
  if (!supplierPartNumberColumn) {
    await db.prepare("ALTER TABLE inventory_items ADD COLUMN supplier_part_number TEXT NOT NULL DEFAULT ''").run();
  }
  await ensureColumn(db, "machine_families", "alternate_names", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(db, "machine_families", "search_term", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(db, "machine_families", "machine_status", "TEXT NOT NULL DEFAULT 'à confirmer'");
  await ensureColumn(db, "machine_families", "is_custom", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "machine_families", "updated_at", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(db, "machine_images", "object_key", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(db, "machine_images", "is_user_supplied", "INTEGER NOT NULL DEFAULT 0");
  const result = await db.prepare("SELECT COUNT(*) AS count FROM inventory_items").first<{ count: number }>();
  if ((result?.count ?? 0) === 0) {
    for (let offset = 0; offset < inventorySeed.length; offset += 100) {
      const statements = inventorySeed.slice(offset, offset + 100).map((item) => db.prepare(
        `INSERT OR IGNORE INTO inventory_items (legacy_reference, supplier_category_code, supplier_name, description, quantity_on_hand, last_cost, average_cost, dealer_price, sale_price, location, machine_model, cost_unit, detail_unit, legacy_raw_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(item.legacyReference, item.supplierCategoryCode, item.supplierName, item.description, item.quantityOnHand, item.lastCost, item.averageCost, item.dealerPrice, item.salePrice, item.location, item.machineModel, item.costUnit, item.detailUnit, JSON.stringify(item.legacyRawData)));
      await db.batch(statements);
    }
  }
  await initializeMachineResearch(db);
  await ensureCuratedMachineCatalog(db);
}

async function ensureColumn(db: D1Database, table: string, column: string, definition: string) {
  const existing = await db.prepare(`SELECT name FROM pragma_table_info('${table}') WHERE name = ?`).bind(column).first<D1Row>();
  if (!existing) await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
}

async function seedInChunks(db: D1Database, statements: D1PreparedStatement[]) {
  for (let offset = 0; offset < statements.length; offset += 100) await db.batch(statements.slice(offset, offset + 100));
}

async function initializeMachineResearch(db: D1Database) {
  const alreadyImported = await db.prepare("SELECT snapshot_date FROM machine_research_imports WHERE snapshot_date = ?").bind(machineResearchSnapshot.snapshotDate).first<D1Row>();
  if (alreadyImported) return;

  await seedInChunks(db, machineResearchFamilies.map((family) => db.prepare(
    `INSERT OR IGNORE INTO machine_families (master_family_id, manufacturer, canonical_model, original_labels_preserved, current_research_status, suggested_production_step_french, reclassification_action, manual_service_url, parts_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(family.masterFamilyId, family.manufacturer, family.canonicalModel, family.originalLabelsPreserved, family.currentResearchStatus, family.suggestedProductionStepFrench, family.reclassificationAction, family.manualServiceUrl, family.partsUrl)));

  await seedInChunks(db, machineResearchFamilies.map((family) => {
    const image = family.image;
    return db.prepare(`INSERT OR IGNORE INTO machine_images (master_family_id, manufacturer, canonical_model_equipment, original_legacy_labels_preserved, production_step_french, research_status, local_image_filename, local_relative_path, public_path, visual_match, source_url, asset_url, source_evidence_type, use_note, publication_recommendation, rights_attribution) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(image.masterFamilyId, image.manufacturer, image.canonicalModelEquipment, image.originalLegacyLabelsPreserved, image.productionStepFrench, image.researchStatus, image.localImageFilename, image.localRelativePath, image.publicPath, image.visualMatch, image.sourceUrl, image.assetUrl, image.sourceEvidenceType, image.useNote, image.publicationRecommendation, image.rightsAttribution);
  }));

  await seedInChunks(db, machineResearchImageSubmissions.map((submission) => db.prepare(
    `INSERT OR IGNORE INTO machine_image_submissions (master_family_id, manufacturer, model_supplied_by_user, plate_model_visible, supplied_filename, local_relative_path, library_decision, visual_assessment, evidence_note, original_source_url, rights_attribution, date_received) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(submission.masterFamilyId, submission.manufacturer, submission.modelSuppliedByUser, submission.plateModelVisible, submission.suppliedFilename, submission.localRelativePath, submission.libraryDecision, submission.visualAssessment, submission.evidenceNote, submission.originalSourceUrl, submission.rightsAttribution, submission.dateReceived)));

  await seedInChunks(db, machineResearchLegacyLabelReviews.map((review) => db.prepare(
    `INSERT OR IGNORE INTO legacy_label_reviews (review_id, original_unresolved_legacy_label, linked_inventory_part_records, unique_product_numbers, possible_manufacturer_equipment_hint_source, example_product_descriptions_source, example_suppliers_source, research_group_id, likely_manufacturer_model_role, french_ui_label, production_step_french, outcome_en, verification_status_fr, evidence_and_caution_en, next_verification_step_en, manual_parts_evidence_links, page_treatment_french) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(review.reviewId, review.originalUnresolvedLegacyLabel, review.linkedInventoryPartRecords, review.uniqueProductNumbers, review.possibleManufacturerEquipmentHintSource, review.exampleProductDescriptionsSource, review.exampleSuppliersSource, review.researchGroupId, review.likelyManufacturerModelRole, review.frenchUiLabel, review.productionStepFrench, review.outcomeEn, review.verificationStatusFr, review.evidenceAndCautionEn, review.nextVerificationStepEn, review.manualPartsEvidenceLinks, review.pageTreatmentFrench)));

  await db.prepare("INSERT OR IGNORE INTO machine_research_imports (snapshot_date, schema_version, package_name) VALUES (?, ?, ?)")
    .bind(machineResearchSnapshot.snapshotDate, machineResearchSnapshot.schemaVersion, machineResearchSnapshot.packageName).run();
}

// Some equipment is confirmed by the recovered records but was deliberately
// excluded from the 55 sewing-machine research families. Seed it separately,
// without changing or duplicating any existing research or user-made record.
async function ensureCuratedMachineCatalog(db: D1Database) {
  await seedInChunks(db, machineCatalog.map((machine) => db.prepare(
    `INSERT OR IGNORE INTO machine_families (master_family_id, manufacturer, canonical_model, original_labels_preserved, current_research_status, suggested_production_step_french, manual_service_url, parts_url, alternate_names, search_term, machine_status, is_custom, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)`
  ).bind(
    machine.id,
    machine.manufacturer,
    machine.model,
    machine.originalLabelsPreserved ?? "",
    machine.note,
    machine.stage,
    machine.instructionUrl ?? "",
    machine.partsUrl ?? "",
    machine.alternateNames ?? "",
    [...new Set(machine.searchTerms ?? [machine.searchTerm])].join(" | "),
    machine.status,
  )));
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}

function passwordPage(message = "") {
  return new Response(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Confection NF Denim — Accès</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f4f2eb;color:#192820;font-family:Arial,Helvetica,sans-serif;font-size:16px}.card{width:min(420px,calc(100% - 40px));padding:32px;border:1px solid #d9ddd4;border-radius:18px;background:#fffdf8;box-shadow:0 18px 55px #19282018}h1{margin:0 0 10px;font-size:28px;letter-spacing:-.04em}p{margin:0 0 24px;color:#66756d;line-height:1.5}label{display:block;margin-bottom:8px;font-weight:700}input{box-sizing:border-box;width:100%;padding:12px;border:1px solid #b9c5ba;border-radius:8px;font:inherit}button{width:100%;margin-top:16px;padding:12px;border:0;border-radius:8px;background:#1d6b4d;color:#fff;font:inherit;font-weight:700;cursor:pointer}.error{margin:0 0 16px;color:#8a321b;font-weight:700}</style></head><body><main class="card"><h1>Confection NF Denim</h1><p>Entrez le mot de passe de l’inventaire pour continuer.</p>${message ? `<div class="error">${message}</div>` : ""}<form method="post" action="/auth/login"><label for="password">Mot de passe</label><input id="password" name="password" type="password" autocomplete="current-password" required autofocus><button type="submit">Ouvrir l’inventaire</button></form></main></body></html>`, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

function cookieValue(request: Request, name: string) {
  return request.headers.get("cookie")?.split(";").map((entry) => entry.trim()).find((entry) => entry.startsWith(`${name}=`))?.slice(name.length + 1) ?? "";
}

function base64Url(value: Uint8Array) {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4);
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

async function hmac(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}

function equal(value: string, expected: string) {
  const a = new TextEncoder().encode(value);
  const b = new TextEncoder().encode(expected);
  let difference = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  return difference === 0;
}

async function hasValidPasswordSession(request: Request, env: Env) {
  if (!env.SESSION_SECRET) return false;
  const [payload, signature] = cookieValue(request, "nf_inventory_session").split(".");
  if (!payload || !signature || !equal(signature, await hmac(payload, env.SESSION_SECRET))) return false;
  try { return Number(new TextDecoder().decode(fromBase64Url(payload))) > Date.now(); } catch { return false; }
}

function passwordRedirect(request: Request, token: string, maxAge: number) {
  return new Response(null, { status: 303, headers: { location: new URL("/", request.url).toString(), "set-cookie": `nf_inventory_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}` } });
}

async function handlePasswordLogin(request: Request, env: Env) {
  if (!env.APP_PASSWORD || !env.SESSION_SECRET) return new Response("Password access is not configured.", { status: 503 });
  const password = String((await request.formData()).get("password") ?? "");
  if (!equal(password, env.APP_PASSWORD)) return passwordPage("Mot de passe incorrect.");
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const payload = base64Url(new TextEncoder().encode(String(expiresAt)));
  return passwordRedirect(request, `${payload}.${await hmac(payload, env.SESSION_SECRET)}`, 7 * 24 * 60 * 60);
}

function item(row: D1Row) {
  return {
    id: Number(row.id), legacyReference: String(row.legacy_reference), supplierPartNumber: String(row.supplier_part_number ?? ""), supplierCategoryCode: String(row.supplier_category_code), supplierName: String(row.supplier_name), description: String(row.description), quantityOnHand: Number(row.quantity_on_hand), lastCost: Number(row.last_cost), averageCost: Number(row.average_cost), dealerPrice: Number(row.dealer_price), salePrice: Number(row.sale_price), location: String(row.location), machineModel: String(row.machine_model), costUnit: String(row.cost_unit), detailUnit: String(row.detail_unit), createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  };
}

const machineStages = new Set<string>(productionStages);
const machineStatuses = new Set<MachineStatus>(["confirmé", "à vérifier", "à confirmer"]);

function normalizedMachineTerm(value: string) {
  return value.toLocaleUpperCase("fr-CA").replace(/[^A-Z0-9]/g, "");
}

function machineFromRow(row: D1Row): MachineCatalogEntry {
  const masterFamilyId = String(row.master_family_id);
  const existing = machineCatalog.find((entry) => entry.id === masterFamilyId);
  const isCustom = Number(row.is_custom ?? 0) === 1;
  const storedStatus = String(row.machine_status ?? "");
  const publicPath = String(row.image_public_path ?? "");
  return {
    id: masterFamilyId,
    masterFamilyId,
    manufacturer: String(row.manufacturer),
    model: String(row.canonical_model),
    stage: (machineStages.has(String(row.suggested_production_step_french)) ? String(row.suggested_production_step_french) : "Assemblage — couture principale") as MachineStage,
    linkedRecords: existing?.linkedRecords ?? 0,
    status: isCustom && machineStatuses.has(storedStatus as MachineStatus) ? storedStatus as MachineStatus : existing?.status ?? "à confirmer",
    searchTerm: String(row.search_term || existing?.searchTerm || row.canonical_model),
    searchTerms: existing?.searchTerms ?? String(row.search_term || existing?.searchTerm || row.canonical_model).split("|").map((term) => term.trim()).filter(Boolean),
    note: String(row.current_research_status || (isCustom ? "Ajoutée par l’équipe — à confirmer au besoin." : "À confirmer.")),
    instructionUrl: String(row.manual_service_url ?? "") || undefined,
    partsUrl: String(row.parts_url ?? "") || undefined,
    originalLabelsPreserved: String(row.original_labels_preserved ?? ""),
    alternateNames: String(row.alternate_names ?? ""),
    reclassificationAction: String(row.reclassification_action ?? ""),
    isCustom,
    image: publicPath ? {
      publicPath,
      visualMatch: String(row.image_visual_match ?? ""),
      sourceUrl: String(row.image_source_url ?? ""),
      sourceEvidenceType: String(row.image_source_evidence_type ?? ""),
      useNote: String(row.image_use_note ?? ""),
      publicationRecommendation: String(row.image_publication_recommendation ?? ""),
      rightsAttribution: String(row.image_rights_attribution ?? ""),
    } : undefined,
  };
}

async function listMachines(db: D1Database) {
  const records = await db.prepare(`SELECT f.*, i.public_path AS image_public_path, i.visual_match AS image_visual_match, i.source_url AS image_source_url, i.source_evidence_type AS image_source_evidence_type, i.use_note AS image_use_note, i.publication_recommendation AS image_publication_recommendation, i.rights_attribution AS image_rights_attribution FROM machine_families f LEFT JOIN machine_images i ON i.master_family_id = f.master_family_id ORDER BY f.is_custom, f.suggested_production_step_french, f.manufacturer, f.canonical_model`).all<D1Row>();
  return json({ machines: records.results.map(machineFromRow) });
}

async function createMachine(request: Request, db: D1Database) {
  const body = await request.json<Record<string, unknown>>();
  const manufacturer = text(body.manufacturer);
  const canonicalModel = text(body.model);
  const stage = text(body.stage);
  if (!manufacturer || !canonicalModel) return json({ error: "La marque et le modèle sont requis." }, 400);
  if (stage && !machineStages.has(stage)) return json({ error: "Choisissez une étape de production valide." }, 400);
  const id = `M-AJOUT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const alternateNames = text(body.alternateNames);
  await db.prepare(`INSERT INTO machine_families (master_family_id, manufacturer, canonical_model, suggested_production_step_french, manual_service_url, parts_url, alternate_names, search_term, machine_status, is_custom, current_research_status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP)`)
    .bind(id, manufacturer, canonicalModel, stage || "Assemblage — couture principale", text(body.instructionUrl), text(body.partsUrl), alternateNames, [canonicalModel, alternateNames].filter(Boolean).join(" | "), "à confirmer", "Ajoutée par l’équipe — à confirmer au besoin.").run();
  const row = await db.prepare("SELECT f.*, '' AS image_public_path FROM machine_families f WHERE f.master_family_id = ?").bind(id).first<D1Row>();
  return json({ machine: row && machineFromRow(row) }, 201);
}

async function updateMachine(request: Request, db: D1Database, id: string) {
  const body = await request.json<Record<string, unknown>>();
  const manufacturer = text(body.manufacturer);
  const canonicalModel = text(body.model);
  const stage = text(body.stage);
  if (!manufacturer || !canonicalModel) return json({ error: "La marque et le modèle sont requis." }, 400);
  if (stage && !machineStages.has(stage)) return json({ error: "Choisissez une étape de production valide." }, 400);
  const existing = await db.prepare("SELECT master_family_id FROM machine_families WHERE master_family_id = ?").bind(id).first<D1Row>();
  if (!existing) return json({ error: "Cette machine est introuvable." }, 404);
  const alternateNames = text(body.alternateNames);
  await db.prepare(`UPDATE machine_families SET manufacturer = ?, canonical_model = ?, suggested_production_step_french = ?, manual_service_url = ?, parts_url = ?, alternate_names = ?, search_term = ?, updated_at = CURRENT_TIMESTAMP WHERE master_family_id = ?`)
    .bind(manufacturer, canonicalModel, stage || "Assemblage — couture principale", text(body.instructionUrl), text(body.partsUrl), alternateNames, [canonicalModel, alternateNames].filter(Boolean).join(" | "), id).run();
  const row = await db.prepare(`SELECT f.*, i.public_path AS image_public_path, i.visual_match AS image_visual_match, i.source_url AS image_source_url, i.source_evidence_type AS image_source_evidence_type, i.use_note AS image_use_note, i.publication_recommendation AS image_publication_recommendation, i.rights_attribution AS image_rights_attribution FROM machine_families f LEFT JOIN machine_images i ON i.master_family_id = f.master_family_id WHERE f.master_family_id = ?`).bind(id).first<D1Row>();
  return json({ machine: row && machineFromRow(row) });
}

async function deleteMachine(env: Env, id: string) {
  const existingImage = await env.DB.prepare("SELECT object_key FROM machine_images WHERE master_family_id = ?").bind(id).first<D1Row>();
  const machine = await env.DB.prepare("SELECT master_family_id FROM machine_families WHERE master_family_id = ?").bind(id).first<D1Row>();
  if (!machine) return json({ error: "Cette machine est introuvable." }, 404);

  // The inventory itself deliberately remains untouched. Removing a machine
  // hides its reference entry, but preserves all recovered part records and
  // their original machine labels for audit and future relinking.
  await env.DB.batch([
    env.DB.prepare("DELETE FROM machine_part_links WHERE master_family_id = ?").bind(id),
    env.DB.prepare("DELETE FROM machine_image_submissions WHERE master_family_id = ?").bind(id),
    env.DB.prepare("DELETE FROM machine_images WHERE master_family_id = ?").bind(id),
    env.DB.prepare("DELETE FROM machine_families WHERE master_family_id = ?").bind(id),
  ]);

  const objectKey = String(existingImage?.object_key ?? "");
  if (objectKey && env.INVOICES) await env.INVOICES.delete(objectKey);
  return json({ ok: true });
}

async function uploadMachineImage(request: Request, env: Env, id: string) {
  if (!env.INVOICES) return json({ error: "Le stockage sécurisé des images n’est pas encore disponible." }, 503);
  const exists = await env.DB.prepare("SELECT master_family_id FROM machine_families WHERE master_family_id = ?").bind(id).first<D1Row>();
  if (!exists) return json({ error: "Cette machine est introuvable." }, 404);
  const file = (await request.formData()).get("file");
  if (!(file instanceof File)) return json({ error: "Choisissez une image." }, 400);
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (!allowed.has(file.type) && !["jpg", "jpeg", "png", "webp"].includes(extension)) return json({ error: "Choisissez une image JPG, PNG ou WebP." }, 400);
  if (file.size === 0 || file.size > 10 * 1024 * 1024) return json({ error: "L’image doit faire au plus 10 Mo." }, 400);
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const objectKey = `machine-images/${id}/${crypto.randomUUID()}-${safeName}`;
  const contentType = allowed.has(file.type) ? file.type : `image/${extension === "jpg" ? "jpeg" : extension}`;
  await env.INVOICES.put(objectKey, file.stream(), { httpMetadata: { contentType } });
  const publicPath = `/api/machines/${encodeURIComponent(id)}/image`;
  const existingImage = await env.DB.prepare("SELECT master_family_id FROM machine_images WHERE master_family_id = ?").bind(id).first<D1Row>();
  if (existingImage) {
    await env.DB.prepare(`UPDATE machine_images SET local_image_filename = ?, local_relative_path = '', public_path = ?, object_key = ?, is_user_supplied = 1, visual_match = ?, source_url = '', source_evidence_type = ?, use_note = ?, publication_recommendation = '', rights_attribution = '' WHERE master_family_id = ?`)
      .bind(file.name, publicPath, objectKey, "Photo ajoutée par l’équipe", "Photo ajoutée par l’équipe", "Photo téléversée dans l’outil d’inventaire.", id).run();
  } else {
    await env.DB.prepare(`INSERT INTO machine_images (master_family_id, local_image_filename, public_path, object_key, is_user_supplied, visual_match, source_evidence_type, use_note) VALUES (?, ?, ?, ?, 1, ?, ?, ?)`)
      .bind(id, file.name, publicPath, objectKey, "Photo ajoutée par l’équipe", "Photo ajoutée par l’équipe", "Photo téléversée dans l’outil d’inventaire.").run();
  }
  return json({ ok: true, publicPath });
}

async function machineImage(env: Env, id: string) {
  if (!env.INVOICES) return json({ error: "Le stockage sécurisé des images n’est pas disponible." }, 503);
  const image = await env.DB.prepare("SELECT object_key FROM machine_images WHERE master_family_id = ?").bind(id).first<D1Row>();
  const objectKey = String(image?.object_key ?? "");
  if (!objectKey) return json({ error: "Aucune image téléversée pour cette machine." }, 404);
  const object = await env.INVOICES.get(objectKey);
  if (!object) return json({ error: "L’image est introuvable." }, 404);
  return new Response(object.body, { headers: { "content-type": object.httpMetadata?.contentType ?? "application/octet-stream", "cache-control": "private, max-age=3600" } });
}

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  await initialize(env.DB);
  if (url.pathname === "/api/machines" && request.method === "GET") return listMachines(env.DB);
  if (url.pathname === "/api/machines" && request.method === "POST") return createMachine(request, env.DB);
  const machineImageMatch = url.pathname.match(/^\/api\/machines\/([^/]+)\/image$/);
  if (machineImageMatch && request.method === "GET") return machineImage(env, decodeURIComponent(machineImageMatch[1]));
  if (machineImageMatch && request.method === "POST") return uploadMachineImage(request, env, decodeURIComponent(machineImageMatch[1]));
  const machineMatch = url.pathname.match(/^\/api\/machines\/([^/]+)$/);
  if (machineMatch && request.method === "PATCH") return updateMachine(request, env.DB, decodeURIComponent(machineMatch[1]));
  if (machineMatch && request.method === "DELETE") return deleteMachine(env, decodeURIComponent(machineMatch[1]));
  if (url.pathname === "/api/suppliers" && request.method === "GET") {
    const supplier = url.searchParams.get("supplier")?.trim() ?? "";
    if (supplier) {
      const records = await env.DB.prepare("SELECT * FROM inventory_items WHERE TRIM(supplier_name) = ? COLLATE NOCASE ORDER BY description ASC, id ASC").bind(supplier).all<D1Row>();
      return json({ supplier, items: records.results.map(item) });
    }
    const suppliers = await env.DB.prepare(`SELECT TRIM(supplier_name) AS name, GROUP_CONCAT(DISTINCT NULLIF(TRIM(supplier_category_code), '')) AS codes, COUNT(*) AS product_count, COALESCE(SUM(quantity_on_hand), 0) AS units_on_hand, COALESCE(SUM(CASE WHEN quantity_on_hand > 0 THEN quantity_on_hand * last_cost ELSE 0 END), 0) AS inventory_value FROM inventory_items WHERE TRIM(supplier_name) <> '' GROUP BY TRIM(supplier_name) COLLATE NOCASE ORDER BY name COLLATE NOCASE`).all<D1Row>();
    return json({ suppliers: suppliers.results.map((row) => ({ name: String(row.name), codes: String(row.codes ?? "").split(",").map((value) => value.trim()).filter(Boolean), productCount: Number(row.product_count ?? 0), unitsOnHand: Number(row.units_on_hand ?? 0), inventoryValue: Number(row.inventory_value ?? 0) })) });
  }
  if (url.pathname === "/api/inventory" && request.method === "GET") {
    const search = url.searchParams.get("search")?.trim() ?? "";
    const term = `%${search}%`;
    const sortColumn = inventorySortColumns[url.searchParams.get("sort") ?? ""] ?? "description";
    const direction = url.searchParams.get("direction") === "desc" ? "DESC" : "ASC";
    const machineId = url.searchParams.get("machineId")?.trim() ?? "";
    const machineBrand = url.searchParams.get("machineBrand")?.trim() ?? "";
    const location = url.searchParams.get("location")?.trim() ?? "";
    // The brand and model filters intentionally work at different levels.
    // A brand (for example, Eastman) must retain every legacy record that
    // mentions that manufacturer, even when the exact model is unknown. A
    // selected model remains the narrower, research-backed filter.
    const selectedMachines = machineId
      ? machineCatalog.filter((machine) => machine.id === machineId)
      : [];
    const linkedMachine = machineId
      ? await env.DB.prepare("SELECT canonical_model, alternate_names, search_term FROM machine_families WHERE master_family_id = ?").bind(machineId).first<D1Row>()
      : null;
    const databaseTerms = linkedMachine
      ? [String(linkedMachine.canonical_model ?? ""), String(linkedMachine.alternate_names ?? ""), String(linkedMachine.search_term ?? "")].flatMap((value) => value.split(/[|,;\n]/)).map((term) => term.trim())
      : [];
    const machineTerms = [...new Set([...selectedMachines.flatMap((machine) => machine.searchTerms ?? [machine.searchTerm]), ...databaseTerms].map((term) => term.trim()).filter(Boolean))];
    const filters: string[] = [];
    const values: string[] = [];
    if (search) {
      filters.push("(legacy_reference LIKE ? OR supplier_part_number LIKE ? OR description LIKE ? OR supplier_name LIKE ? OR location LIKE ? OR machine_model LIKE ?)");
      values.push(term, term, term, term, term, term);
    }
    if (machineTerms.length) {
      const normalizedColumn = "UPPER(REPLACE(REPLACE(REPLACE(REPLACE(machine_model, '-', ''), '.', ''), '/', ''), ' ', ''))";
      filters.push(`(${machineTerms.map(() => `${normalizedColumn} LIKE ?`).join(" OR ")})`);
      values.push(...machineTerms.map((value) => `%${normalizedMachineTerm(value)}%`));
    } else if (machineBrand) {
      // Older records often identify a manufacturer's part in the description
      // rather than in the machine/model field. Keep those records visible at
      // the brand level, without guessing which specific model they fit.
      filters.push("(machine_model LIKE ? OR description LIKE ?)");
      const brandTerm = `%${machineBrand}%`;
      values.push(brandTerm, brandTerm);
    }
    if (location) {
      filters.push("location = ?");
      values.push(location);
    }
    const query = `SELECT * FROM inventory_items${filters.length ? ` WHERE ${filters.join(" AND ")}` : ""} ORDER BY ${sortColumn} ${direction}, id ASC LIMIT 500`;
    const records = values.length
      ? await env.DB.prepare(query).bind(...values).all<D1Row>()
      : await env.DB.prepare(query).all<D1Row>();
    const totals = await env.DB.prepare("SELECT COUNT(*) AS product_count, COALESCE(SUM(quantity_on_hand), 0) AS units_on_hand, COALESCE(SUM(CASE WHEN quantity_on_hand = 0 THEN 1 ELSE 0 END), 0) AS zero_stock_count, COUNT(DISTINCT CASE WHEN TRIM(supplier_name) <> '' THEN UPPER(TRIM(supplier_name)) END) AS supplier_count, COALESCE(SUM(CASE WHEN TRIM(supplier_part_number) <> '' THEN 1 ELSE 0 END), 0) AS supplier_part_number_count, COALESCE(SUM(CASE WHEN quantity_on_hand > 0 THEN quantity_on_hand * last_cost ELSE 0 END), 0) AS inventory_value_at_last_cost FROM inventory_items").first<D1Row>();
    return json({ items: records.results.map(item), summary: { productCount: Number(totals?.product_count ?? 0), unitsOnHand: Number(totals?.units_on_hand ?? 0), zeroStockCount: Number(totals?.zero_stock_count ?? 0), supplierCount: Number(totals?.supplier_count ?? 0), supplierPartNumberCount: Number(totals?.supplier_part_number_count ?? 0), inventoryValueAtLastCost: Number(totals?.inventory_value_at_last_cost ?? 0) } });
  }
  if (url.pathname === "/api/activity" && request.method === "GET") {
    const changes = await env.DB.prepare("SELECT * FROM inventory_changes ORDER BY id DESC LIMIT 12").all<D1Row>();
    return json({ activity: changes.results.map((row) => ({ id: Number(row.id), inventoryId: Number(row.inventory_id), legacyReference: String(row.legacy_reference), description: String(row.description), changeType: String(row.change_type), note: String(row.note), createdAt: String(row.created_at) })) });
  }
  if (url.pathname === "/api/locations" && request.method === "GET") return listLocations(env.DB);
  const locationMatch = url.pathname.match(/^\/api\/locations\/([^/]+)$/);
  if (locationMatch && request.method === "GET") return locationContents(env.DB, decodeURIComponent(locationMatch[1]));
  if (url.pathname === "/api/inventory" && request.method === "POST") return createItem(request, env.DB);
  if (url.pathname === "/api/receipts" && request.method === "POST") return receiveStock(request, env.DB);
  if (url.pathname === "/api/receipts/batch" && request.method === "POST") return receiveStockBatch(request, env.DB);
  if (url.pathname === "/api/invoice-documents" && request.method === "POST") return uploadInvoiceDocument(request, env);
  if (url.pathname === "/api/issues" && request.method === "POST") return issueStock(request, env.DB);
  const match = url.pathname.match(/^\/api\/inventory\/(\d+)$/);
  if (match && request.method === "PATCH") return updateItem(request, env.DB, Number(match[1]));
  return json({ error: "Not found" }, 404);
}

async function listLocations(db: D1Database) {
  const rows = await db.prepare("SELECT location, legacy_reference, description, quantity_on_hand, last_cost, machine_model FROM inventory_items WHERE location <> '' ORDER BY location, description").all<D1Row>();
  const grouped = new Map<string, { location: string; partCount: number; unitsOnHand: number; items: Array<{ legacyReference: string; description: string; quantityOnHand: number; lastCost: number; machineModel: string }> }>();
  for (const row of rows.results) {
    const location = String(row.location);
    const entry = grouped.get(location) ?? { location, partCount: 0, unitsOnHand: 0, items: [] };
    entry.partCount += 1;
    entry.unitsOnHand += Number(row.quantity_on_hand);
    entry.items.push({ legacyReference: String(row.legacy_reference), description: String(row.description), quantityOnHand: Number(row.quantity_on_hand), lastCost: Number(row.last_cost), machineModel: String(row.machine_model) });
    grouped.set(location, entry);
  }
  return json({ locations: [...grouped.values()] });
}

async function locationContents(db: D1Database, location: string) {
  const rows = await db.prepare("SELECT legacy_reference, description, quantity_on_hand, last_cost, machine_model FROM inventory_items WHERE location = ? ORDER BY description").bind(location).all<D1Row>();
  return json({ items: rows.results.map((row) => ({ legacyReference: String(row.legacy_reference), description: String(row.description), quantityOnHand: Number(row.quantity_on_hand), lastCost: Number(row.last_cost), machineModel: String(row.machine_model) })) });
}

function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function number(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }

async function createItem(request: Request, db: D1Database) {
  const body = await request.json<Record<string, unknown>>();
  const reference = text(body.legacyReference);
  const description = text(body.description);
  if (!reference || !description) return json({ error: "SKU and description are required." }, 400);
  try {
    const inserted = await db.prepare(`INSERT INTO inventory_items (legacy_reference, supplier_part_number, supplier_category_code, supplier_name, description, quantity_on_hand, last_cost, average_cost, dealer_price, sale_price, location, machine_model, cost_unit, detail_unit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(reference, text(body.supplierPartNumber), text(body.supplierCategoryCode), text(body.supplierName), description, number(body.quantityOnHand), number(body.lastCost), number(body.averageCost), number(body.dealerPrice), number(body.salePrice), text(body.location), text(body.machineModel), text(body.costUnit), text(body.detailUnit)).run();
    const inventoryId = Number(inserted.meta.last_row_id);
    await db.prepare("INSERT INTO inventory_changes (inventory_id, legacy_reference, description, change_type, note) VALUES (?, ?, ?, ?, ?)").bind(inventoryId, reference, description, "Pièce ajoutée / Part added", "Ajoutée dans l'inventaire / Added in inventory").run();
    return json({ ok: true }, 201);
  } catch { return json({ error: "That SKU already exists." }, 409); }
}

async function updateItem(request: Request, db: D1Database, id: number) {
  const body = await request.json<Record<string, unknown>>();
  const current = await db.prepare("SELECT * FROM inventory_items WHERE id = ?").bind(id).first<D1Row>();
  if (!current) return json({ error: "Part not found." }, 404);
  const reference = text(body.legacyReference);
  const description = text(body.description);
  if (!reference || !description) return json({ error: "SKU and description are required." }, 400);
  try {
    await db.prepare(`UPDATE inventory_items SET legacy_reference = ?, supplier_part_number = ?, supplier_category_code = ?, supplier_name = ?, description = ?, quantity_on_hand = ?, last_cost = ?, average_cost = ?, dealer_price = ?, sale_price = ?, location = ?, machine_model = ?, cost_unit = ?, detail_unit = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(reference, text(body.supplierPartNumber), text(body.supplierCategoryCode), text(body.supplierName), description, number(body.quantityOnHand), number(body.lastCost), number(body.averageCost), number(body.dealerPrice), number(body.salePrice), text(body.location), text(body.machineModel), text(body.costUnit), text(body.detailUnit), id).run();
    await db.prepare("INSERT INTO inventory_changes (inventory_id, legacy_reference, description, change_type, note) VALUES (?, ?, ?, ?, ?)").bind(id, reference, description, "Pièce mise à jour / Part updated", "Champs sauvegardés dans l'inventaire / Fields saved in inventory").run();
    return json({ ok: true });
  } catch { return json({ error: "That SKU already exists." }, 409); }
}

async function receiveStock(request: Request, db: D1Database) {
  const body = await request.json<Record<string, unknown>>();
  const reference = text(body.legacyReference);
  const location = text(body.location);
  const quantity = number(body.quantity);
  if (!reference || !location || quantity <= 0) return json({ error: "No produit, quantité et emplacement sont requis." }, 400);
  const current = await db.prepare("SELECT * FROM inventory_items WHERE legacy_reference = ?").bind(reference).first<D1Row>();
  if (!current) return json({ error: "Ce No produit est introuvable. Ajoutez la pièce avant de la recevoir." }, 404);
  const before = Number(current.quantity_on_hand);
  const after = before + quantity;
  const supplier = text(body.supplierName) || String(current.supplier_name);
  const invoice = text(body.invoiceNumber);
  const unitCost = number(body.unitCost);
  await db.batch([
    db.prepare("UPDATE inventory_items SET quantity_on_hand = ?, location = ?, supplier_name = ?, last_cost = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(after, location, supplier, unitCost, current.id),
    db.prepare("INSERT INTO stock_movements (inventory_id, legacy_reference, description, movement_type, quantity_delta, quantity_before, quantity_after, location, supplier_name, invoice_number, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(current.id, reference, current.description, "Entrée d'inventaire / Stock received", quantity, before, after, location, supplier, invoice, "Facture reçue / Invoice received"),
    db.prepare("INSERT INTO inventory_changes (inventory_id, legacy_reference, description, change_type, note) VALUES (?, ?, ?, ?, ?)").bind(current.id, reference, current.description, "Entrée d'inventaire", `+${quantity} · ${location}${invoice ? ` · Facture ${invoice}` : ""}`),
  ]);
  return json({ ok: true, quantityAfter: after });
}

async function uploadInvoiceDocument(request: Request, env: Env) {
  if (!env.INVOICES) return json({ error: "Le stockage sécurisé des factures n'est pas encore disponible." }, 503);
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "Choisissez une facture PDF." }, 400);
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return json({ error: "Seuls les fichiers PDF sont acceptés." }, 400);
  if (file.size === 0 || file.size > 20 * 1024 * 1024) return json({ error: "Le PDF doit faire au plus 20 Mo." }, 400);
  const id = crypto.randomUUID();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const objectKey = `invoices/${id}/${safeName}`;
  await env.INVOICES.put(objectKey, file.stream(), { httpMetadata: { contentType: "application/pdf" } });
  await env.DB.prepare("INSERT INTO invoice_documents (id, object_key, file_name, content_type, size_bytes, status) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(id, objectKey, file.name, file.type || "application/pdf", file.size, "uploaded").run();
  return json({ document: { id, fileName: file.name, sizeBytes: file.size, status: "uploaded" } }, 201);
}

type ReceiptLine = { legacyReference?: unknown; quantity?: unknown; location?: unknown; supplierName?: unknown; unitCost?: unknown };

async function receiveStockBatch(request: Request, db: D1Database) {
  const body = await request.json<{ lines?: ReceiptLine[]; invoiceNumber?: unknown; documentId?: unknown }>();
  const lines = Array.isArray(body.lines) ? body.lines : [];
  const invoice = text(body.invoiceNumber);
  const documentId = text(body.documentId);
  if (!lines.length) return json({ error: "Ajoutez au moins une ligne de facture." }, 400);
  if (lines.length > 100) return json({ error: "Une réception peut contenir au plus 100 lignes." }, 400);
  if (documentId) {
    const document = await db.prepare("SELECT id FROM invoice_documents WHERE id = ?").bind(documentId).first<D1Row>();
    if (!document) return json({ error: "La facture PDF est introuvable. Téléversez-la de nouveau." }, 404);
  }
  const prepared: Array<{ current: D1Row; reference: string; quantity: number; location: string; supplier: string; unitCost: number }> = [];
  for (const line of lines) {
    const reference = text(line.legacyReference);
    const location = text(line.location);
    const quantity = number(line.quantity);
    if (!reference || !location || quantity <= 0) return json({ error: "Chaque ligne requiert un No produit, une quantité et un emplacement." }, 400);
    const current = await db.prepare("SELECT * FROM inventory_items WHERE legacy_reference = ?").bind(reference).first<D1Row>();
    if (!current) return json({ error: `Le No produit ${reference} est introuvable. Ajoutez la pièce avant de confirmer.` }, 404);
    prepared.push({ current, reference, quantity, location, supplier: text(line.supplierName) || String(current.supplier_name), unitCost: number(line.unitCost) });
  }
  const statements: D1PreparedStatement[] = [];
  for (const line of prepared) {
    const before = Number(line.current.quantity_on_hand);
    const after = before + line.quantity;
    statements.push(
      db.prepare("UPDATE inventory_items SET quantity_on_hand = ?, location = ?, supplier_name = ?, last_cost = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(after, line.location, line.supplier, line.unitCost, line.current.id),
      db.prepare("INSERT INTO stock_movements (inventory_id, legacy_reference, description, movement_type, quantity_delta, quantity_before, quantity_after, location, supplier_name, invoice_number, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(line.current.id, line.reference, line.current.description, "Entrée d'inventaire / Stock received", line.quantity, before, after, line.location, line.supplier, invoice, documentId ? "Facture PDF confirmée / PDF invoice confirmed" : "Entrée d'inventaire confirmée / Stock receipt confirmed"),
      db.prepare("INSERT INTO inventory_changes (inventory_id, legacy_reference, description, change_type, note) VALUES (?, ?, ?, ?, ?)").bind(line.current.id, line.reference, line.current.description, "Entrée d'inventaire", `+${line.quantity} · ${line.location}${invoice ? ` · Facture ${invoice}` : ""}`),
    );
  }
  if (documentId) statements.push(db.prepare("UPDATE invoice_documents SET status = ?, invoice_number = ?, supplier_name = ?, confirmed_at = CURRENT_TIMESTAMP WHERE id = ?").bind("confirmed", invoice, prepared[0]?.supplier ?? "", documentId));
  await db.batch(statements);
  return json({ ok: true, linesConfirmed: prepared.length });
}

async function issueStock(request: Request, db: D1Database) {
  const body = await request.json<Record<string, unknown>>();
  const reference = text(body.legacyReference);
  const quantity = number(body.quantity);
  const reason = text(body.reason) || "Utilisée / Used";
  const note = text(body.note);
  if (!reference || quantity <= 0) return json({ error: "No produit et quantité sont requis." }, 400);
  const current = await db.prepare("SELECT * FROM inventory_items WHERE legacy_reference = ?").bind(reference).first<D1Row>();
  if (!current) return json({ error: "Ce No produit est introuvable." }, 404);
  const before = Number(current.quantity_on_hand);
  if (quantity > before) return json({ error: `Quantité insuffisante : ${before} en inventaire.` }, 400);
  const after = before - quantity;
  await db.batch([
    db.prepare("UPDATE inventory_items SET quantity_on_hand = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(after, current.id),
    db.prepare("INSERT INTO stock_movements (inventory_id, legacy_reference, description, movement_type, quantity_delta, quantity_before, quantity_after, location, supplier_name, invoice_number, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(current.id, reference, current.description, reason, -quantity, before, after, current.location, current.supplier_name, "", note),
    db.prepare("INSERT INTO inventory_changes (inventory_id, legacy_reference, description, change_type, note) VALUES (?, ?, ?, ?, ?)").bind(current.id, reference, current.description, reason, `-${quantity}${note ? ` · ${note}` : ""}`),
  ]);
  return json({ ok: true, quantityAfter: after });
}
