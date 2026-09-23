import { clampPct, type Scenario, type SortDir, type SortKey } from "./cost";

export type PresetId = "chatbot" | "rag" | "summarization" | "agent";

export interface Preset {
  id: PresetId;
  label: string;
  description: string;
  scenario: Scenario;
}

/** Rough, illustrative workloads. Adjust the inputs to match your own traffic. */
export const PRESETS: Preset[] = [
  {
    id: "chatbot",
    label: "Chatbot",
    description: "Customer support chat with a reused system prompt.",
    scenario: {
      requestsPerDay: 5000,
      inputTokens: 1500,
      outputTokens: 400,
      cachedSharePct: 50,
      batch: false,
      daysPerMonth: 30,
    },
  },
  {
    id: "rag",
    label: "RAG",
    description: "Question answering over retrieved documents.",
    scenario: {
      requestsPerDay: 2000,
      inputTokens: 6000,
      outputTokens: 500,
      cachedSharePct: 20,
      batch: false,
      daysPerMonth: 30,
    },
  },
  {
    id: "summarization",
    label: "Summarization",
    description: "Overnight batch summaries of long documents.",
    scenario: {
      requestsPerDay: 1000,
      inputTokens: 8000,
      outputTokens: 600,
      cachedSharePct: 0,
      batch: true,
      daysPerMonth: 30,
    },
  },
  {
    id: "agent",
    label: "Agent",
    description: "Multi-step tool-using agent with long, mostly cached context.",
    scenario: {
      requestsPerDay: 500,
      inputTokens: 25000,
      outputTokens: 2000,
      cachedSharePct: 70,
      batch: false,
      daysPerMonth: 30,
    },
  },
];

export const DEFAULT_SCENARIO: Scenario = PRESETS[0].scenario;

export interface ViewState {
  scenario: Scenario;
  providers: string[];
  sortKey: SortKey;
  sortDir: SortDir;
}

export const DEFAULT_VIEW: ViewState = {
  scenario: DEFAULT_SCENARIO,
  providers: [],
  sortKey: "total",
  sortDir: "asc",
};

const SORT_KEYS: SortKey[] = ["total", "input", "output", "name", "provider"];
const MAX_VALUE = 1e12;

function num(v: string | null, fallback: number, max = MAX_VALUE): number {
  if (v === null || v.trim() === "") return fallback;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(n, max);
}

/**
 * Encode view state into a query string. Short keys keep links readable:
 * r=requests/day, i=input tokens, o=output tokens, c=cached %, b=batch,
 * d=days/month, p=providers, s=sort key, dir=sort direction.
 */
export function encodeView(v: ViewState): string {
  const p = new URLSearchParams();
  p.set("r", String(v.scenario.requestsPerDay));
  p.set("i", String(v.scenario.inputTokens));
  p.set("o", String(v.scenario.outputTokens));
  p.set("c", String(v.scenario.cachedSharePct));
  p.set("b", v.scenario.batch ? "1" : "0");
  p.set("d", String(v.scenario.daysPerMonth));
  if (v.providers.length > 0) p.set("p", v.providers.join(","));
  if (v.sortKey !== DEFAULT_VIEW.sortKey) p.set("s", v.sortKey);
  if (v.sortDir !== DEFAULT_VIEW.sortDir) p.set("dir", v.sortDir);
  return p.toString();
}

/** Decode a query string, falling back to defaults for missing or bad values. */
export function decodeView(
  search: string,
  knownProviders?: string[],
): ViewState {
  const p = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const d = DEFAULT_VIEW.scenario;

  const scenario: Scenario = {
    requestsPerDay: num(p.get("r"), d.requestsPerDay),
    inputTokens: num(p.get("i"), d.inputTokens),
    outputTokens: num(p.get("o"), d.outputTokens),
    cachedSharePct: clampPct(num(p.get("c"), d.cachedSharePct, 100)),
    batch: p.has("b") ? p.get("b") === "1" || p.get("b") === "true" : d.batch,
    daysPerMonth: num(p.get("d"), d.daysPerMonth, 31),
  };

  let providers = (p.get("p") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (knownProviders) {
    providers = providers.filter((x) => knownProviders.includes(x));
  }

  const s = p.get("s") as SortKey | null;
  const sortKey = s && SORT_KEYS.includes(s) ? s : DEFAULT_VIEW.sortKey;
  const dir = p.get("dir");
  const sortDir: SortDir = dir === "desc" ? "desc" : "asc";

  return { scenario, providers, sortKey, sortDir };
}

/** Which preset (if any) exactly matches a scenario. */
export function matchPreset(s: Scenario): PresetId | null {
  const hit = PRESETS.find(
    (p) =>
      p.scenario.requestsPerDay === s.requestsPerDay &&
      p.scenario.inputTokens === s.inputTokens &&
      p.scenario.outputTokens === s.outputTokens &&
      p.scenario.cachedSharePct === s.cachedSharePct &&
      p.scenario.batch === s.batch &&
      p.scenario.daysPerMonth === s.daysPerMonth,
  );
  return hit ? hit.id : null;
}
