import { describe, expect, it } from "vitest";
import {
  DEFAULT_VIEW,
  PRESETS,
  decodeView,
  encodeView,
  matchPreset,
  type ViewState,
} from "./scenario";
import { formatRate, formatUsd } from "./format";

describe("encodeView / decodeView", () => {
  it("round-trips a view", () => {
    const v: ViewState = {
      scenario: {
        requestsPerDay: 1234,
        inputTokens: 5678,
        outputTokens: 90,
        cachedSharePct: 35,
        batch: true,
        daysPerMonth: 22,
      },
      providers: ["OpenAI", "Google"],
      sortKey: "name",
      sortDir: "desc",
    };
    expect(decodeView(encodeView(v))).toEqual(v);
  });

  it("accepts a leading question mark", () => {
    const v = decodeView("?r=10&i=20&o=30&c=0&b=0&d=30");
    expect(v.scenario.requestsPerDay).toBe(10);
  });

  it("returns defaults for an empty query", () => {
    expect(decodeView("")).toEqual(DEFAULT_VIEW);
  });

  it("falls back on invalid values and clamps ranges", () => {
    const v = decodeView("r=abc&i=-5&c=250&d=99&s=bogus&dir=sideways");
    expect(v.scenario.requestsPerDay).toBe(DEFAULT_VIEW.scenario.requestsPerDay);
    expect(v.scenario.inputTokens).toBe(DEFAULT_VIEW.scenario.inputTokens);
    expect(v.scenario.cachedSharePct).toBe(100);
    expect(v.scenario.daysPerMonth).toBe(31);
    expect(v.sortKey).toBe("total");
    expect(v.sortDir).toBe("asc");
  });

  it("drops unknown providers when a list is given", () => {
    const v = decodeView("p=OpenAI,Nope", ["OpenAI", "Anthropic"]);
    expect(v.providers).toEqual(["OpenAI"]);
  });

  it("omits default sort from the query", () => {
    const q = encodeView(DEFAULT_VIEW);
    expect(q).not.toContain("s=");
    expect(q).not.toContain("dir=");
    expect(q).not.toContain("p=");
  });
});

describe("presets", () => {
  it("has the four documented presets", () => {
    expect(PRESETS.map((p) => p.id)).toEqual(["chatbot", "rag", "summarization", "agent"]);
  });

  it("matchPreset finds an exact preset and null otherwise", () => {
    expect(matchPreset(PRESETS[2].scenario)).toBe("summarization");
    expect(matchPreset({ ...PRESETS[2].scenario, requestsPerDay: 1 })).toBeNull();
  });
});

describe("format helpers", () => {
  it("formats USD", () => {
    expect(formatUsd(1234.5)).toBe("$1,235");
    expect(formatUsd(12.346)).toBe("$12.35");
    expect(formatUsd(0.5)).toBe("$0.50");
    expect(formatUsd(0.000123)).toBe("$0.000123");
  });

  it("formats rates", () => {
    expect(formatRate(0.075)).toBe("$0.075");
    expect(formatRate(null)).toBe("n/a");
  });
});
