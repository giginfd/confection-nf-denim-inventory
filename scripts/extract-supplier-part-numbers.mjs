import fs from "node:fs";
import path from "node:path";

const [, , detsopPath, inventoryCsvPath, outputPath = "app/lib/supplier-part-number-seed.ts"] = process.argv;

if (!detsopPath || !inventoryCsvPath) {
  throw new Error("Usage: node scripts/extract-supplier-part-numbers.mjs <DETSOP> <inventory.csv> [output.ts]");
}

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

function normalizedReference(value) {
  if (!/^\d{1,6}$/.test(value)) throw new Error(`Unsupported legacy reference: ${value}`);
  return String(Number(value));
}

const inventoryText = fs.readFileSync(inventoryCsvPath, "utf8").replace(/^\uFEFF/, "");
const [headerLine, ...inventoryLines] = inventoryText.trimEnd().split(/\r?\n/);
const headers = parseCsvLine(headerLine);
const inventoryRows = inventoryLines.map((line) =>
  Object.fromEntries(parseCsvLine(line).map((value, index) => [headers[index], value]))
);

// DETSOP stores an alternate-key entry as:
// 6-byte internal product number + 4-byte supplier code + "-" +
// 15-byte supplier/catalogue part number + the Thoroughbred key marker 0x8A.
const detsopText = fs.readFileSync(detsopPath).toString("latin1");
const keyPattern = /(\d{6})(\d{4})-(.{15})\x8a/g;
const recoveredByReference = new Map();
let match;

while ((match = keyPattern.exec(detsopText))) {
  const legacyReference = normalizedReference(match[1]);
  if (recoveredByReference.has(legacyReference)) {
    throw new Error(`Duplicate DETSOP key for product ${legacyReference}`);
  }
  recoveredByReference.set(legacyReference, {
    supplierCategoryCode: match[2],
    supplierPartNumber: match[3].trim(),
    sourceOffset: match.index,
  });
}

const seedRows = inventoryRows.map((row) => {
  const recovered = recoveredByReference.get(normalizedReference(row.legacy_reference));
  if (!recovered) throw new Error(`No DETSOP supplier part number for product ${row.legacy_reference}`);
  if (recovered.supplierCategoryCode !== row.supplier_category_code) {
    throw new Error(
      `Supplier-code mismatch for product ${row.legacy_reference}: ` +
      `${row.supplier_category_code} in inventory, ${recovered.supplierCategoryCode} in DETSOP`
    );
  }
  if (!recovered.supplierPartNumber) throw new Error(`Blank supplier part number for product ${row.legacy_reference}`);
  return {
    legacyReference: row.legacy_reference,
    supplierCategoryCode: recovered.supplierCategoryCode,
    supplierPartNumber: recovered.supplierPartNumber,
    sourceOffset: recovered.sourceOffset,
  };
});

if (new Set(seedRows.map((row) => row.legacyReference)).size !== seedRows.length) {
  throw new Error("The inventory input contains duplicate product references.");
}

const output = `// Generated from the recovered 2021 DETSOP alternate-key index.
// The original binary backup is read-only. Do not hand-edit this file.

export type SupplierPartNumberSeedRow = {
  legacyReference: string;
  supplierCategoryCode: string;
  supplierPartNumber: string;
  sourceOffset: number;
};

export const supplierPartNumberSeed: SupplierPartNumberSeedRow[] = ${JSON.stringify(seedRows, null, 2)};
`;

fs.writeFileSync(path.resolve(outputPath), output);
console.log(
  `Recovered ${seedRows.length} supplier part numbers ` +
  `(${new Set(seedRows.map((row) => row.supplierPartNumber)).size} distinct) into ${outputPath}`
);
