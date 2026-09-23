import type { CostRow } from "@/lib/cost";
import { formatUsd } from "@/lib/format";

const ROW_HEIGHT = 26;
const LABEL_WIDTH = 170;
const VALUE_WIDTH = 90;
const WIDTH = 720;

/** Horizontal bar chart of monthly cost. Plain SVG, no chart library. */
export default function CostChart({ rows }: { rows: CostRow[] }) {
  if (rows.length === 0) return null;

  const max = Math.max(...rows.map((r) => r.cost.total), 0);
  const barArea = WIDTH - LABEL_WIDTH - VALUE_WIDTH;
  const height = rows.length * ROW_HEIGHT + 8;

  return (
    <figure className="chart">
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        width="100%"
        role="img"
        aria-label="Bar chart of monthly cost per model"
        preserveAspectRatio="xMinYMin meet"
      >
        {rows.map((r, i) => {
          const y = i * ROW_HEIGHT + 4;
          const w = max > 0 ? Math.max((r.cost.total / max) * barArea, r.cost.total > 0 ? 2 : 0) : 0;
          const inputShare = r.cost.total > 0 ? (r.cost.input + r.cost.cachedInput) / r.cost.total : 0;
          return (
            <g key={`${r.model.provider}-${r.model.model_id}`}>
              <title>{`${r.model.display_name}: ${formatUsd(r.cost.total)} / month`}</title>
              <text x={LABEL_WIDTH - 8} y={y + ROW_HEIGHT / 2} className="chart-label" textAnchor="end" dominantBaseline="middle">
                {r.model.display_name}
              </text>
              <rect x={LABEL_WIDTH} y={y + 3} width={w * inputShare} height={ROW_HEIGHT - 8} className="bar-input" rx={2} />
              <rect
                x={LABEL_WIDTH + w * inputShare}
                y={y + 3}
                width={w * (1 - inputShare)}
                height={ROW_HEIGHT - 8}
                className="bar-output"
                rx={2}
              />
              <text x={LABEL_WIDTH + w + 6} y={y + ROW_HEIGHT / 2} className="chart-value" dominantBaseline="middle">
                {formatUsd(r.cost.total)}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="legend">
        <span className="swatch swatch-input" aria-hidden="true" /> Input (incl. cached)
        <span className="swatch swatch-output" aria-hidden="true" /> Output
      </figcaption>
    </figure>
  );
}
