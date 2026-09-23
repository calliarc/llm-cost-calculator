#!/usr/bin/env node
// Validates data/pricing.json against data/pricing.schema.json plus a few
// consistency rules that JSON Schema cannot express. Run with:
//   npm run validate:pricing
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (p) => JSON.parse(readFileSync(resolve(root, p), "utf8"));

const schema = readJson("data/pricing.schema.json");
const data = readJson("data/pricing.json");

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);

const errors = [];

if (!validate(data)) {
  for (const e of validate.errors ?? []) {
    errors.push(`schema: ${e.instancePath || "/"} ${e.message}`);
  }
}

if (Array.isArray(data.models)) {
  const seen = new Set();
  const today = new Date().toISOString().slice(0, 10);

  data.models.forEach((m, i) => {
    const where = `models[${i}] (${m.provider}/${m.model_id})`;
    const key = `${m.provider}::${m.model_id}`;
    if (seen.has(key)) errors.push(`${where}: duplicate provider + model_id`);
    seen.add(key);

    const hasBatchIn = typeof m.batch_input === "number";
    const hasBatchOut = typeof m.batch_output === "number";
    if (hasBatchIn !== hasBatchOut) {
      errors.push(`${where}: batch_input and batch_output must both be set or both be null`);
    }
    if (m.batch_cached_input != null && !hasBatchIn) {
      errors.push(`${where}: batch_cached_input is set but batch prices are null`);
    }
    if (typeof m.cached_input === "number" && m.cached_input > m.input) {
      errors.push(`${where}: cached_input is higher than input`);
    }
    if (hasBatchIn && m.batch_input > m.input) {
      errors.push(`${where}: batch_input is higher than input`);
    }
    if (hasBatchOut && m.batch_output > m.output) {
      errors.push(`${where}: batch_output is higher than output`);
    }
    if (typeof m.last_verified === "string" && m.last_verified > today) {
      errors.push(`${where}: last_verified (${m.last_verified}) is in the future`);
    }
  });
}

if (errors.length > 0) {
  console.error(`pricing.json is invalid (${errors.length} problem(s)):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(`pricing.json is valid: ${data.models.length} models.`);
