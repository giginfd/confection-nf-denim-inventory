import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const source = path.join(root, "outputs", "inventory_recovered_provisional_2021.csv");
const destination = path.join(root, "app", "lib", "inventory-seed.ts");
const text = fs.readFileSync(source, "utf8").replace(/^\uFEFF/, "");
const [headerLine, ...lines] = text.trimEnd().split(/\r?\n/);
const headers = parseCsvLine(headerLine);
const rows = lines.map((line) => Object.fromEntries(parseCsvLine(line).map((value, index) => [headers[index], value])));

function parseCsvLine(line) {
  const values = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      values.push(value);
      value = "";
    } else {
      value += character;
    }
  }
  values.push(value);
  return values;
}

const seedRows = rows.map((row) => ({
  legacyReference: row.legacy_reference,
  supplierCategoryCode: row.supplier_category_code,
  supplierName: row.supplier_name,
  description: row.description,
  quantityOnHand: Number(row.quantity_on_hand || 0),
  lastCost: Number(row.last_cost || 0),
  averageCost: Number(row.average_cost || 0),
  dealerPrice: Number(row.dealer_price || 0),
  salePrice: Number(row.sale_price || 0),
  location: row.location,
  machineModel: row.machine_model,
  costUnit: row.cost_unit,
  detailUnit: row.detail_unit,
  legacyRawData: Object.fromEntries(
    Object.entries(row).filter(([key]) => key.startsWith("raw_field_"))
  ),
}));

const output = `// Generated from the recovered 2021 inventory snapshot. Do not hand-edit.\n\nexport type InventorySeedRow = {\n  legacyReference: string;\n  supplierCategoryCode: string;\n  supplierName: string;\n  description: string;\n  quantityOnHand: number;\n  lastCost: number;\n  averageCost: number;\n  dealerPrice: number;\n  salePrice: number;\n  location: string;\n  machineModel: string;\n  costUnit: string;\n  detailUnit: string;\n  legacyRawData: Record<string, string>;\n};\n\nexport const inventorySeed: InventorySeedRow[] = ${JSON.stringify(seedRows, null, 2)};\n`;
fs.writeFileSync(destination, output);
console.log(`Generated ${seedRows.length} inventory rows in ${destination}`);
