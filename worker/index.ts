/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { runWithExecutionContext } from "vinext/shims/request-context";
import { inventorySeed } from "../app/lib/inventory-seed";

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
  `CREATE INDEX IF NOT EXISTS inventory_items_description_idx ON inventory_items(description)`,
  `CREATE INDEX IF NOT EXISTS inventory_changes_created_idx ON inventory_changes(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS stock_movements_inventory_idx ON stock_movements(inventory_id)`,
  `CREATE INDEX IF NOT EXISTS invoice_documents_created_idx ON invoice_documents(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS market_offers_inventory_idx ON market_offers(inventory_id, checked_at DESC)`,
];

async function initialize(db: D1Database) {
  await db.batch(initializeStatements.map((statement) => db.prepare(statement)));
  const supplierPartNumberColumn = await db.prepare("SELECT name FROM pragma_table_info('inventory_items') WHERE name = ?").bind("supplier_part_number").first<D1Row>();
  if (!supplierPartNumberColumn) {
    await db.prepare("ALTER TABLE inventory_items ADD COLUMN supplier_part_number TEXT NOT NULL DEFAULT ''").run();
  }
  const result = await db.prepare("SELECT COUNT(*) AS count FROM inventory_items").first<{ count: number }>();
  if ((result?.count ?? 0) > 0) return;
  for (let offset = 0; offset < inventorySeed.length; offset += 100) {
    const statements = inventorySeed.slice(offset, offset + 100).map((item) => db.prepare(
      `INSERT OR IGNORE INTO inventory_items (legacy_reference, supplier_category_code, supplier_name, description, quantity_on_hand, last_cost, average_cost, dealer_price, sale_price, location, machine_model, cost_unit, detail_unit, legacy_raw_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(item.legacyReference, item.supplierCategoryCode, item.supplierName, item.description, item.quantityOnHand, item.lastCost, item.averageCost, item.dealerPrice, item.salePrice, item.location, item.machineModel, item.costUnit, item.detailUnit, JSON.stringify(item.legacyRawData)));
    await db.batch(statements);
  }
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

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  await initialize(env.DB);
  if (url.pathname === "/api/inventory" && request.method === "GET") {
    const search = url.searchParams.get("search")?.trim() ?? "";
    const term = `%${search}%`;
    const sortColumn = inventorySortColumns[url.searchParams.get("sort") ?? ""] ?? "description";
    const direction = url.searchParams.get("direction") === "desc" ? "DESC" : "ASC";
    const records = search
      ? await env.DB.prepare(`SELECT * FROM inventory_items WHERE legacy_reference LIKE ? OR supplier_part_number LIKE ? OR description LIKE ? OR supplier_name LIKE ? OR location LIKE ? OR machine_model LIKE ? ORDER BY ${sortColumn} ${direction}, id ASC LIMIT 500`).bind(term, term, term, term, term, term).all<D1Row>()
      : await env.DB.prepare(`SELECT * FROM inventory_items ORDER BY ${sortColumn} ${direction}, id ASC LIMIT 500`).all<D1Row>();
    const totals = await env.DB.prepare("SELECT COUNT(*) AS product_count, COALESCE(SUM(quantity_on_hand), 0) AS units_on_hand, COALESCE(SUM(CASE WHEN quantity_on_hand = 0 THEN 1 ELSE 0 END), 0) AS zero_stock_count, COUNT(DISTINCT supplier_name) AS supplier_count, COALESCE(SUM(CASE WHEN TRIM(supplier_part_number) <> '' THEN 1 ELSE 0 END), 0) AS supplier_part_number_count, COALESCE(SUM(CASE WHEN quantity_on_hand > 0 THEN quantity_on_hand * last_cost ELSE 0 END), 0) AS inventory_value_at_last_cost FROM inventory_items").first<D1Row>();
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
