"use client";

import { useEffect, useMemo, useState } from "react";
import pricing from "@/data/pricing.json";
import {
  compareModels,
  listProviders,
  monthlyTokens,
  type ModelPricing,
  type Scenario,
  type SortKey,
} from "@/lib/cost";
import { DEFAULT_VIEW, PRESETS, decodeView, encodeView, matchPreset, type ViewState } from "@/lib/scenario";
import { formatRate, formatTokens, formatUsd } from "@/lib/format";
import CostChart from "./CostChart";

const MODELS = pricing.models as ModelPricing[];
const PROVIDERS = listProviders(MODELS);
const LAST_VERIFIED = MODELS.map((m) => m.last_verified).sort().at(-1) ?? "";

interface NumberFieldProps {
  id: string;
  label: string;
  hint?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (n: number) => void;
}

function NumberField({ id, label, hint, value, min = 0, max, step = 1, onChange }: NumberFieldProps) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => {
          const n = e.target.valueAsNumber;
          let v = Number.isFinite(n) && n >= min ? n : min;
          if (max !== undefined) v = Math.min(v, max);
          onChange(v);
        }}
      />
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export default function Calculator() {
  const [view, setView] = useState<ViewState>(DEFAULT_VIEW);
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);

  // Read the scenario from the URL once on load.
  useEffect(() => {
    setView(decodeView(window.location.search, PROVIDERS));
    setReady(true);
  }, []);

  // Keep the URL in sync so the page can be shared.
  useEffect(() => {
    if (!ready) return;
    const url = `${window.location.pathname}?${encodeView(view)}`;
    window.history.replaceState(null, "", url);
  }, [view, ready]);

  const { scenario, providers, sortKey, sortDir } = view;

  const rows = useMemo(
    () => compareModels(MODELS, scenario, { providers, sortKey, sortDir }),
    [scenario, providers, sortKey, sortDir],
  );
  const tokens = useMemo(() => monthlyTokens(scenario), [scenario]);
  const activePreset = matchPreset(scenario);

  const setScenario = (patch: Partial<Scenario>) =>
    setView((v) => ({ ...v, scenario: { ...v.scenario, ...patch } }));

  const toggleProvider = (p: string) =>
    setView((v) => {
      const has = v.providers.includes(p);
      const next = has ? v.providers.filter((x) => x !== p) : [...v.providers, p];
      // Selecting every provider is the same as no filter.
      return { ...v, providers: next.length === PROVIDERS.length ? [] : next };
    });

  const sortBy = (key: SortKey) =>
    setView((v) => ({
      ...v,
      sortKey: key,
      sortDir: v.sortKey === key && v.sortDir === "asc" ? "desc" : "asc",
    }));

  const ariaSort = (key: SortKey) =>
    sortKey === key ? (sortDir === "asc" ? "ascending" : "descending") : "none";

  const sortIndicator = (key: SortKey) => (sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "");

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const cheapest = rows.length > 0 ? rows.reduce((a, b) => (b.cost.total < a.cost.total ? b : a)) : null;

  return (
    <div className="calculator">
      <section className="panel" aria-labelledby="workload-heading">
        <div className="panel-head">
          <h2 id="workload-heading">Workload</h2>
          <div className="presets" role="group" aria-label="Presets">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`chip${activePreset === p.id ? " chip-active" : ""}`}
                aria-pressed={activePreset === p.id}
                title={p.description}
                onClick={() => setScenario(p.scenario)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="fields">
          <NumberField
            id="requests"
            label="Requests per day"
            value={scenario.requestsPerDay}
            step={100}
            onChange={(n) => setScenario({ requestsPerDay: n })}
          />
          <NumberField
            id="input"
            label="Avg input tokens"
            hint="Per request, including cached part"
            value={scenario.inputTokens}
            step={100}
            onChange={(n) => setScenario({ inputTokens: n })}
          />
          <NumberField
            id="output"
            label="Avg output tokens"
            hint="Per request, including reasoning tokens"
            value={scenario.outputTokens}
            step={50}
            onChange={(n) => setScenario({ outputTokens: n })}
          />
          <NumberField
            id="days"
            label="Days per month"
            value={scenario.daysPerMonth}
            max={31}
            onChange={(n) => setScenario({ daysPerMonth: n })}
          />
          <div className="field field-wide">
            <label htmlFor="cached">
              Cached input share: <strong>{scenario.cachedSharePct}%</strong>
            </label>
            <input
              id="cached"
              type="range"
              min={0}
              max={100}
              step={5}
              value={scenario.cachedSharePct}
              onChange={(e) => setScenario({ cachedSharePct: e.target.valueAsNumber })}
            />
            <span className="hint">Share of input tokens billed at the cache-hit rate</span>
          </div>
          <div className="field field-toggle">
            <label className="toggle">
              <input
                type="checkbox"
                checked={scenario.batch}
                onChange={(e) => setScenario({ batch: e.target.checked })}
              />
              <span>Use Batch API pricing</span>
            </label>
            <span className="hint">Applied only to models with a batch price</span>
          </div>
        </div>

        <p className="summary">
          {formatTokens(tokens.input)} input tokens ({formatTokens(tokens.cachedInput)} cached) and{" "}
          {formatTokens(tokens.output)} output tokens per month.
        </p>
      </section>

      <section className="panel" aria-labelledby="compare-heading">
        <div className="panel-head">
          <h2 id="compare-heading">Monthly cost by model</h2>
          <button type="button" className="button" onClick={copyLink}>
            {copied ? "Link copied" : "Copy shareable link"}
          </button>
        </div>

        <fieldset className="providers">
          <legend>Providers</legend>
          {PROVIDERS.map((p) => {
            const checked = providers.length === 0 || providers.includes(p);
            return (
              <label key={p} className="chip-check">
                <input type="checkbox" checked={checked} onChange={() => toggleProvider(p)} />
                <span>{p}</span>
              </label>
            );
          })}
          {providers.length > 0 ? (
            <button
              type="button"
              className="link-button"
              onClick={() => setView((v) => ({ ...v, providers: [] }))}
            >
              Show all
            </button>
          ) : null}
        </fieldset>

        {cheapest ? (
          <p className="summary">
            Cheapest for this workload: <strong>{cheapest.model.display_name}</strong> at{" "}
            <strong>{formatUsd(cheapest.cost.total)}</strong> per month.
          </p>
        ) : (
          <p className="summary">No models match the selected providers.</p>
        )}

        <CostChart rows={rows} />

        <div className="table-wrap">
          <table className="cost-table">
            <thead>
              <tr>
                <th aria-sort={ariaSort("name")}>
                  <button type="button" onClick={() => sortBy("name")}>
                    Model{sortIndicator("name")}
                  </button>
                </th>
                <th aria-sort={ariaSort("provider")}>
                  <button type="button" onClick={() => sortBy("provider")}>
                    Provider{sortIndicator("provider")}
                  </button>
                </th>
                <th className="num">Input / cached / output per 1M</th>
                <th className="num" aria-sort={ariaSort("input")}>
                  <button type="button" onClick={() => sortBy("input")}>
                    Input cost{sortIndicator("input")}
                  </button>
                </th>
                <th className="num" aria-sort={ariaSort("output")}>
                  <button type="button" onClick={() => sortBy("output")}>
                    Output cost{sortIndicator("output")}
                  </button>
                </th>
                <th className="num" aria-sort={ariaSort("total")}>
                  <button type="button" onClick={() => sortBy("total")}>
                    Monthly total{sortIndicator("total")}
                  </button>
                </th>
                <th className="num">Per request</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ model, cost, perRequest }) => (
                <tr key={`${model.provider}-${model.model_id}`}>
                  <td>
                    <div className="model-name">{model.display_name}</div>
                    <code className="model-id">{model.model_id}</code>
                    <div className="badges">
                      {cost.batchApplied ? <span className="badge">batch</span> : null}
                      {scenario.batch && !cost.batchApplied ? (
                        <span className="badge badge-muted">no batch price</span>
                      ) : null}
                      {cost.cachingApplied ? <span className="badge">cache</span> : null}
                    </div>
                  </td>
                  <td>{model.provider}</td>
                  <td className="num rates">
                    {formatRate(model.input)} / {formatRate(model.cached_input)} / {formatRate(model.output)}
                    {model.batch_input !== null ? (
                      <div className="hint">
                        batch {formatRate(model.batch_input)} / {formatRate(model.batch_output)}
                      </div>
                    ) : null}
                  </td>
                  <td className="num">{formatUsd(cost.input + cost.cachedInput)}</td>
                  <td className="num">{formatUsd(cost.output)}</td>
                  <td className="num total">{formatUsd(cost.total)}</td>
                  <td className="num">{formatUsd(perRequest)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel disclaimer" aria-labelledby="disclaimer-heading">
        <h2 id="disclaimer-heading">About these prices</h2>
        <p>
          <strong>Prices change often.</strong> Figures are public list prices in USD taken from each
          provider&apos;s official pricing page and last checked on {LAST_VERIFIED}. Always confirm on the
          provider&apos;s page before making decisions. Estimates exclude taxes, cache-write and storage
          fees, long-context surcharges, tool calls, regional or data-residency uplifts, free tiers and
          negotiated discounts.
        </p>
        <details>
          <summary>Sources and notes per model</summary>
          <ul className="sources">
            {MODELS.map((m) => (
              <li key={`${m.provider}-${m.model_id}`}>
                <strong>{m.display_name}</strong> ({m.provider}):{" "}
                <a href={m.source_url} target="_blank" rel="noopener noreferrer">
                  official pricing
                </a>
                , verified {m.last_verified}.{m.notes ? ` ${m.notes}` : ""}
              </li>
            ))}
          </ul>
        </details>
        <p className="hint">
          Spotted an outdated price? Edit <code>data/pricing.json</code> and open a pull request.
        </p>
      </section>
    </div>
  );
}
