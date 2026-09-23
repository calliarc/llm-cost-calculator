import { describe, expect, it } from "vitest";
import pricing from "../data/pricing.json";
import {
  compareModels,
  costPerRequest,
  effectiveRates,
  listProviders,
  monthlyCost,
  monthlyTokens,
  type ModelPricing,
  type Scenario,
} from "./cost";

const model: ModelPricing = {
  provider: "TestAI",
  model_id: "test-1",
  display_name: "Test 1",
  input: 2,
  output: 10,
  cached_input: 0.2,
  batch_input: 1,
  batch_output: 5,
  batch_cached_input: 0.1,
  source_url: "https://example.com/pricing",
  last_verified: "2026-01-01",
};

const base: Scenario = {
  requestsPerDay: 1000,
  inputTokens: 1000,
  outputTokens: 500,
  cachedSharePct: 0,
  batch: false,
  daysPerMonth: 30,
};

describe("monthlyTokens", () => {
  it("multiplies requests, days and tokens", () => {
    const t = monthlyTokens({ ...base, cachedSharePct: 25 });
    expect(t.input).toBe(30_000_000);
    expect(t.cachedInput).toBe(7_500_000);
    expect(t.uncachedInput).toBe(22_500_000);
    expect(t.output).toBe(15_000_000);
  });

  it("treats negative and non-finite values as zero", () => {
    const t = monthlyTokens({ ...base, requestsPerDay: -5, outputTokens: NaN });
    expect(t.input).toBe(0);
    expect(t.output).toBe(0);
  });

  it("clamps cached share to 0-100", () => {
    expect(monthlyTokens({ ...base, cachedSharePct: 150 }).uncachedInput).toBe(0);
    expect(monthlyTokens({ ...base, cachedSharePct: -10 }).cachedInput).toBe(0);
  });
});

describe("monthlyCost", () => {
  it("computes standard cost", () => {
    // 30M input * $2 = $60, 15M output * $10 = $150
    const c = monthlyCost(model, base);
    expect(c.input).toBeCloseTo(60);
    expect(c.cachedInput).toBe(0);
    expect(c.output).toBeCloseTo(150);
    expect(c.total).toBeCloseTo(210);
    expect(c.batchApplied).toBe(false);
    expect(c.cachingApplied).toBe(false);
  });

  it("applies cached-input pricing", () => {
    // 15M uncached * $2 = $30, 15M cached * $0.2 = $3, output $150
    const c = monthlyCost(model, { ...base, cachedSharePct: 50 });
    expect(c.input).toBeCloseTo(30);
    expect(c.cachedInput).toBeCloseTo(3);
    expect(c.total).toBeCloseTo(183);
    expect(c.cachingApplied).toBe(true);
  });

  it("applies batch pricing, including batch cached rate", () => {
    // 15M * $1 = 15, 15M * $0.1 = 1.5, 15M * $5 = 75
    const c = monthlyCost(model, { ...base, cachedSharePct: 50, batch: true });
    expect(c.input).toBeCloseTo(15);
    expect(c.cachedInput).toBeCloseTo(1.5);
    expect(c.output).toBeCloseTo(75);
    expect(c.total).toBeCloseTo(91.5);
    expect(c.batchApplied).toBe(true);
  });

  it("falls back to standard cached rate in batch mode when no batch cached rate", () => {
    const m = { ...model, batch_cached_input: null };
    const r = effectiveRates(m, { batch: true, cachedSharePct: 50 });
    expect(r.cachedInput).toBe(0.2);
    expect(r.input).toBe(1);
  });

  it("ignores batch toggle when the model has no batch pricing", () => {
    const m = { ...model, batch_input: null, batch_output: null, batch_cached_input: null };
    const c = monthlyCost(m, { ...base, batch: true });
    expect(c.batchApplied).toBe(false);
    expect(c.total).toBeCloseTo(210);
  });

  it("bills cached tokens as normal input when the model has no cached price", () => {
    const m = { ...model, cached_input: null };
    const c = monthlyCost(m, { ...base, cachedSharePct: 50 });
    expect(c.total).toBeCloseTo(210);
    expect(c.cachingApplied).toBe(false);
  });

  it("is zero for zero traffic", () => {
    expect(monthlyCost(model, { ...base, requestsPerDay: 0 }).total).toBe(0);
  });
});

describe("costPerRequest", () => {
  it("returns cost of one request", () => {
    // 1000 * 2/1M + 500 * 10/1M = 0.002 + 0.005
    expect(costPerRequest(model, base)).toBeCloseTo(0.007, 10);
  });
});

describe("compareModels", () => {
  const cheap = { ...model, provider: "B", model_id: "cheap", display_name: "Cheap", input: 0.1, output: 0.4 };
  const pricey = { ...model, provider: "A", model_id: "pricey", display_name: "Pricey", input: 10, output: 50 };
  const models = [pricey, model, cheap];

  it("sorts by total ascending by default", () => {
    const rows = compareModels(models, base);
    expect(rows.map((r) => r.model.model_id)).toEqual(["cheap", "test-1", "pricey"]);
  });

  it("sorts descending", () => {
    const rows = compareModels(models, base, { sortDir: "desc" });
    expect(rows[0].model.model_id).toBe("pricey");
  });

  it("sorts by name", () => {
    const rows = compareModels(models, base, { sortKey: "name" });
    expect(rows.map((r) => r.model.display_name)).toEqual(["Cheap", "Pricey", "Test 1"]);
  });

  it("filters by provider", () => {
    const rows = compareModels(models, base, { providers: ["A", "B"] });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.model.provider !== "TestAI")).toBe(true);
  });

  it("shows all models when the provider filter is empty", () => {
    expect(compareModels(models, base, { providers: [] })).toHaveLength(3);
  });

  it("does not mutate input", () => {
    const copy = [...models];
    compareModels(models, base, { sortKey: "name" });
    expect(models).toEqual(copy);
  });
});

describe("bundled pricing data", () => {
  const all = pricing.models as ModelPricing[];

  it("has models from several providers", () => {
    expect(all.length).toBeGreaterThan(0);
    expect(listProviders(all).length).toBeGreaterThan(1);
  });

  it("produces finite, non-negative costs for every model", () => {
    for (const m of all) {
      for (const batch of [false, true]) {
        const c = monthlyCost(m, { ...base, cachedSharePct: 40, batch });
        expect(Number.isFinite(c.total)).toBe(true);
        expect(c.total).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("batch and cache never cost more than standard", () => {
    for (const m of all) {
      const std = monthlyCost(m, base).total;
      expect(monthlyCost(m, { ...base, batch: true }).total).toBeLessThanOrEqual(std + 1e-9);
      expect(monthlyCost(m, { ...base, cachedSharePct: 80 }).total).toBeLessThanOrEqual(std + 1e-9);
    }
  });
});
