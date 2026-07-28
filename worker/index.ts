/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { runWithExecutionContext } from "vinext/shims/request-context";
import { inventorySeed } from "../app/lib/inventory-seed";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
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

const initializeStatements = [
  `CREATE TABLE IF NOT EXISTS inventory_items (id INTEGER PRIMARY KEY AUTOINCREMENT, legacy_reference TEXT NOT NULL UNIQUE, supplier_category_code TEXT NOT NULL DEFAULT '', supplier_name TEXT NOT NULL DEFAULT '', description TEXT NOT NULL, quantity_on_hand REAL NOT NULL DEFAULT 0, last_cost REAL NOT NULL DEFAULT 0, average_cost REAL NOT NULL DEFAULT 0, dealer_price REAL NOT NULL DEFAULT 0, sale_price REAL NOT NULL DEFAULT 0, location TEXT NOT NULL DEFAULT '', machine_model TEXT NOT NULL DEFAULT '', cost_unit TEXT NOT NULL DEFAULT '', detail_unit TEXT NOT NULL DEFAULT '', legacy_raw_data TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS inventory_changes (id INTEGER PRIMARY KEY AUTOINCREMENT, inventory_id INTEGER NOT NULL, legacy_reference TEXT NOT NULL, description TEXT NOT NULL, change_type TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE INDEX IF NOT EXISTS inventory_items_description_idx ON inventory_items(description)`,
  `CREATE INDEX IF NOT EXISTS inventory_changes_created_idx ON inventory_changes(created_at DESC)`,
];

async function initialize(db: D1Database) {
  await db.batch(initializeStatements.map((statement) => db.prepare(statement)));
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

function item(row: D1Row) {
  return {
    id: Number(row.id), legacyReference: String(row.legacy_reference), supplierCategoryCode: String(row.supplier_category_code), supplierName: String(row.supplier_name), description: String(row.description), quantityOnHand: Number(row.quantity_on_hand), lastCost: Number(row.last_cost), averageCost: Number(row.average_cost), dealerPrice: Number(row.dealer_price), salePrice: Number(row.sale_price), location: String(row.location), machineModel: String(row.machine_model), costUnit: String(row.cost_unit), detailUnit: String(row.detail_unit), createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  };
}

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  await initialize(env.DB);
  if (url.pathname === "/api/inventory" && request.method === "GET") {
    const search = url.searchParams.get("search")?.trim() ?? "";
    const term = `%${search}%`;
    const records = search
      ? await env.DB.prepare(`SELECT * FROM inventory_items WHERE legacy_reference LIKE ? OR description LIKE ? OR supplier_name LIKE ? OR location LIKE ? OR machine_model LIKE ? ORDER BY description LIMIT 500`).bind(term, term, term, term, term).all<D1Row>()
      : await env.DB.prepare("SELECT * FROM inventory_items ORDER BY description LIMIT 500").all<D1Row>();
    const totals = await env.DB.prepare("SELECT COUNT(*) AS product_count, COALESCE(SUM(quantity_on_hand), 0) AS units_on_hand, COALESCE(SUM(CASE WHEN quantity_on_hand = 0 THEN 1 ELSE 0 END), 0) AS zero_stock_count, COUNT(DISTINCT supplier_name) AS supplier_count FROM inventory_items").first<D1Row>();
    return json({ items: records.results.map(item), summary: { productCount: Number(totals?.product_count ?? 0), unitsOnHand: Number(totals?.units_on_hand ?? 0), zeroStockCount: Number(totals?.zero_stock_count ?? 0), supplierCount: Number(totals?.supplier_count ?? 0) } });
  }
  if (url.pathname === "/api/activity" && request.method === "GET") {
    const changes = await env.DB.prepare("SELECT * FROM inventory_changes ORDER BY id DESC LIMIT 12").all<D1Row>();
    return json({ activity: changes.results.map((row) => ({ id: Number(row.id), inventoryId: Number(row.inventory_id), legacyReference: String(row.legacy_reference), description: String(row.description), changeType: String(row.change_type), note: String(row.note), createdAt: String(row.created_at) })) });
  }
  if (url.pathname === "/api/inventory" && request.method === "POST") return createItem(request, env.DB);
  const match = url.pathname.match(/^\/api\/inventory\/(\d+)$/);
  if (match && request.method === "PATCH") return updateItem(request, env.DB, Number(match[1]));
  return json({ error: "Not found" }, 404);
}

function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function number(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }

async function createItem(request: Request, db: D1Database) {
  const body = await request.json<Record<string, unknown>>();
  const reference = text(body.legacyReference);
  const description = text(body.description);
  if (!reference || !description) return json({ error: "SKU and description are required." }, 400);
  try {
    const inserted = await db.prepare(`INSERT INTO inventory_items (legacy_reference, supplier_category_code, supplier_name, description, quantity_on_hand, last_cost, average_cost, dealer_price, sale_price, location, machine_model, cost_unit, detail_unit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(reference, text(body.supplierCategoryCode), text(body.supplierName), description, number(body.quantityOnHand), number(body.lastCost), number(body.averageCost), number(body.dealerPrice), number(body.salePrice), text(body.location), text(body.machineModel), text(body.costUnit), text(body.detailUnit)).run();
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
    await db.prepare(`UPDATE inventory_items SET legacy_reference = ?, supplier_category_code = ?, supplier_name = ?, description = ?, quantity_on_hand = ?, last_cost = ?, average_cost = ?, dealer_price = ?, sale_price = ?, location = ?, machine_model = ?, cost_unit = ?, detail_unit = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(reference, text(body.supplierCategoryCode), text(body.supplierName), description, number(body.quantityOnHand), number(body.lastCost), number(body.averageCost), number(body.dealerPrice), number(body.salePrice), text(body.location), text(body.machineModel), text(body.costUnit), text(body.detailUnit), id).run();
    await db.prepare("INSERT INTO inventory_changes (inventory_id, legacy_reference, description, change_type, note) VALUES (?, ?, ?, ?, ?)").bind(id, reference, description, "Pièce mise à jour / Part updated", "Champs sauvegardés dans l'inventaire / Fields saved in inventory").run();
    return json({ ok: true });
  } catch { return json({ error: "That SKU already exists." }, 409); }
}
