/**
 * Pure cost functions. No React, no I/O, so they are easy to unit test.
 * All prices are USD per 1M tokens.
 */

export interface ModelPricing {
  provider: string;
  model_id: string;
  display_name: string;
  input: number;
  output: number;
  cached_input: number | null;
  batch_input: number | null;
  batch_output: number | null;
  batch_cached_input: number | null;
  source_url: string;
  last_verified: string;
  notes?: string;
}

export interface Scenario {
  /** Requests sent per day. */
  requestsPerDay: number;
  /** Average input (prompt) tokens per request, including any cached part. */
  inputTokens: number;
  /** Average output (completion) tokens per request. */
  outputTokens: number;
  /** Share of input tokens served from the prompt cache, 0 to 100. */
  cachedSharePct: number;
  /** Use Batch API pricing where the model offers it. */
  batch: boolean;
  /** Billing days per month. */
  daysPerMonth: number;
}

export interface CostBreakdown {
  /** Cost of uncached input tokens. */
  input: number;
  /** Cost of cached input tokens. */
  cachedInput: number;
  /** Cost of output tokens. */
  output: number;
  /** Sum of the three parts. */
  total: number;
  /** True if batch pricing was requested and the model supports it. */
  batchApplied: boolean;
  /** True if some input was cached and the model has a cached-input price. */
  cachingApplied: boolean;
}

export interface EffectiveRates {
  input: number;
  cachedInput: number;
  output: number;
  batchApplied: boolean;
  cachingApplied: boolean;
}

const PER_MILLION = 1_000_000;

/** Clamp to a finite, non-negative number. */
export function nonNegative(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

/**
 * Pick the per-1M-token rates that apply to a model for this scenario.
 *
 * - Batch rates are used only if requested and the model lists them.
 * - Cached tokens use the batch cached rate in batch mode when listed, otherwise
 *   the standard cached rate. If the model has no cached rate at all, cached
 *   tokens are billed as normal input.
 */
export function effectiveRates(
  model: ModelPricing,
  opts: { batch: boolean; cachedSharePct: number },
): EffectiveRates {
  const batchApplied =
    opts.batch && model.batch_input !== null && model.batch_output !== null;

  const input = batchApplied ? (model.batch_input as number) : model.input;
  const output = batchApplied ? (model.batch_output as number) : model.output;

  let cachedInput: number;
  if (batchApplied && model.batch_cached_input !== null) {
    cachedInput = model.batch_cached_input;
  } else if (model.cached_input !== null) {
    cachedInput = model.cached_input;
  } else {
    cachedInput = input;
  }

  const cachingApplied =
    clampPct(opts.cachedSharePct) > 0 && model.cached_input !== null;

  return { input, cachedInput, output, batchApplied, cachingApplied };
}

/** Tokens per month for a scenario. */
export function monthlyTokens(s: Scenario): {
  input: number;
  cachedInput: number;
  uncachedInput: number;
  output: number;
} {
  const requests = nonNegative(s.requestsPerDay) * nonNegative(s.daysPerMonth);
  const input = requests * nonNegative(s.inputTokens);
  const cachedInput = input * (clampPct(s.cachedSharePct) / 100);
  return {
    input,
    cachedInput,
    uncachedInput: input - cachedInput,
    output: requests * nonNegative(s.outputTokens),
  };
}

/** Monthly cost of running a scenario on one model. */
export function monthlyCost(model: ModelPricing, s: Scenario): CostBreakdown {
  const t = monthlyTokens(s);
  const r = effectiveRates(model, s);

  const input = (t.uncachedInput * r.input) / PER_MILLION;
  const cachedInput = (t.cachedInput * r.cachedInput) / PER_MILLION;
  const output = (t.output * r.output) / PER_MILLION;

  return {
    input,
    cachedInput,
    output,
    total: input + cachedInput + output,
    batchApplied: r.batchApplied,
    cachingApplied: r.cachingApplied,
  };
}

/** Cost of a single average request. */
export function costPerRequest(model: ModelPricing, s: Scenario): number {
  return monthlyCost(model, { ...s, requestsPerDay: 1, daysPerMonth: 1 }).total;
}

export type SortKey = "total" | "input" | "output" | "name" | "provider";
export type SortDir = "asc" | "desc";

export interface CostRow {
  model: ModelPricing;
  cost: CostBreakdown;
  perRequest: number;
}

/** Compute, filter and sort a comparison table. */
export function compareModels(
  models: ModelPricing[],
  s: Scenario,
  opts: { providers?: string[]; sortKey?: SortKey; sortDir?: SortDir } = {},
): CostRow[] {
  const { providers, sortKey = "total", sortDir = "asc" } = opts;
  const filtered =
    providers && providers.length > 0
      ? models.filter((m) => providers.includes(m.provider))
      : models;

  const rows = filtered.map((model) => ({
    model,
    cost: monthlyCost(model, s),
    perRequest: costPerRequest(model, s),
  }));

  const value = (r: CostRow): number | string => {
    switch (sortKey) {
      case "name":
        return r.model.display_name.toLowerCase();
      case "provider":
        return `${r.model.provider} ${r.model.display_name}`.toLowerCase();
      case "input":
        return r.cost.input + r.cost.cachedInput;
      case "output":
        return r.cost.output;
      default:
        return r.cost.total;
    }
  };

  const dir = sortDir === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return a.model.display_name.localeCompare(b.model.display_name);
  });
}

/** Unique providers in data order. */
export function listProviders(models: ModelPricing[]): string[] {
  return [...new Set(models.map((m) => m.provider))];
}
