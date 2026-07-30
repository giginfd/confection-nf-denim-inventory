import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the NF Denim inventory workspace", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Confection NF Denim — Inventaire<\/title>/i);
  assert.match(html, /Confection NF Denim — Stornoway INC\./);
  assert.match(html, /Catalogue de pièces/);
  assert.match(html, /N° PIÈCE \/ PRODUIT/);
  assert.match(html, /N° pièce, produit, machine ou emplacement/);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site|codex-preview/i);
});

test("keeps recovered supplier part numbers wired to the database and inventory rows", async () => {
  const [workspace, worker, supplierSeed] = await Promise.all([
    readFile(new URL("../app/inventory/InventoryWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/supplier-part-number-seed.ts", import.meta.url), "utf8"),
  ]);

  assert.match(workspace, /item\.supplierPartNumber/);
  assert.match(workspace, /supplier-part-number/);
  assert.match(worker, /initializeSupplierPartNumbers/);
  assert.match(worker, /TRIM\(supplier_part_number\) = ''/);
  assert.match(supplierSeed, /"legacyReference": "2030"[\s\S]{0,160}"supplierPartNumber": "S09273001"/);
});

test("applies reviewed machine associations while keeping legacy names searchable", async () => {
  const [workspace, worker, auditSeed, schema] = await Promise.all([
    readFile(new URL("../app/inventory/InventoryWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/machine-association-audit-seed.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
  ]);

  assert.equal((auditSeed.match(/"legacyReference":/g) ?? []).length, 92);
  assert.match(auditSeed, /"currentMachineAssociation": "DIVER AMCO"[\s\S]{0,180}"proposedMachineAssociation": "AMCO \/ Teledyne AMCO/);
  assert.match(worker, /initializeMachineAssociationAudit/);
  assert.match(worker, /conflict_preserved/);
  assert.match(worker, /machine_aliases LIKE \?/);
  assert.match(schema, /inventoryMachineAssociationAudits/);
  assert.match(workspace, /Ancien nom de machine/);
});

test("keeps the mobile machine-brand shortcuts in a fixed, scrollable order", async () => {
  const [machines, styles] = await Promise.all([
    readFile(new URL("../app/machines/MachinesWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(machines, /const fixedManufacturerOrder = \[\s*"Brother",\s*"Union Special",\s*"Reece",\s*"Juki",\s*"Singer"/);
  assert.match(machines, /brand-scroll-cue/);
  assert.match(styles, /scroll-snap-type: x proximity/);
  assert.match(styles, /\.brand-filter-chips > button \{ flex: 0 0 86px/);
});
