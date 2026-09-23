# LLM Cost Calculator

Compare LLM API costs across models and providers for your workload.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/calliarc/llm-cost-calculator/actions/workflows/ci.yml/badge.svg)](https://github.com/calliarc/llm-cost-calculator/actions/workflows/ci.yml)
![Version: 0.1.0](https://img.shields.io/badge/version-0.1.0-blue)

> **Status:** v0.1.0, first working release. Pricing data last verified 2026-09-23.

## Features

- Estimate monthly cost from requests per day and input/output tokens
- Side-by-side comparison across providers and models, in a sortable table and a bar chart
- Prompt caching and batch pricing where providers offer them
- Presets for common workloads: chatbot, RAG, summarization, agent
- Filter by provider
- Pricing data kept in one JSON file that is easy to update via pull request, checked against a JSON schema in CI
- Shareable links for a given scenario (the whole scenario lives in the URL query string)

## How the estimate works

For each model:

```
requests          = requests/day x days/month
cached input      = requests x avg input tokens x cached share
uncached input    = requests x avg input tokens - cached input
monthly cost      = uncached input x input price
                  + cached input   x cached-input price
                  + requests x avg output tokens x output price
```

- With **Batch API** on, a model's batch input, output and batch cached-input prices are used. Models without a batch price keep standard pricing and are marked "no batch price".
- If a model has no cached-input price, cached tokens are billed at the normal input rate.
- Prices are USD per 1M tokens. Estimates leave out taxes, cache-write and cache-storage fees, long-context surcharges, tool calls, regional or data-residency uplifts, free tiers and negotiated discounts.

**Prices change often.** The app shows this warning and links to each provider's official pricing page. Check there before you rely on a number.

## Included models (verified 2026-09-23)

| Provider  | Models | Source |
| --------- | ------ | ------ |
| OpenAI    | GPT-6 Astra, GPT-6 Sol, GPT-6 Luna (short-context rates) | [developers.openai.com/api/docs/pricing](https://developers.openai.com/api/docs/pricing) |
| Anthropic | Claude Fable 5.1, Claude Opus 5.5, Claude Sonnet 5, Claude Haiku 4.5 | [platform.claude.com/docs/en/about-claude/pricing](https://platform.claude.com/docs/en/about-claude/pricing) |
| Google    | Gemini 3.8 Flash, Gemini 3.5 Flash-Lite, Gemini 3.1 Pro Preview, Gemini 3.1 Flash-Lite, Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.5 Flash-Lite | [ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing) |
| Mistral   | Mistral Large 3, Mistral Medium 3.5, Mistral Small 4 | [docs.mistral.ai/inference/pricing](https://docs.mistral.ai/inference/pricing) |
| DeepSeek  | DeepSeek V4.1 Flash, DeepSeek V4 Pro (peak-hour rates) | [api-docs.deepseek.com/quick_start/pricing](https://api-docs.deepseek.com/quick_start/pricing) |

Per-model caveats (for example Gemini 3.8 Flash rates that double on 2027-01-01, or DeepSeek off-peak discounts) are in the `notes` field of `data/pricing.json` and shown in the app. Azure OpenAI is not included yet because its prices depend on region and deployment type.

## Tech stack

- Next.js 16 (App Router) with static export (`output: "export"`, no backend)
- React 19 and TypeScript
- Plain SVG bar chart, no chart library
- Vitest for unit tests
- Ajv for pricing schema validation
- GitHub Actions for CI and optional GitHub Pages deploy

## Getting started

Requirements: Node.js 22.12 or later and npm.

```bash
git clone https://github.com/calliarc/llm-cost-calculator.git
cd llm-cost-calculator
npm install
npm run dev
```

Open http://localhost:3000.

| Command | What it does |
| ------- | ------------ |
| `npm run dev` | Start the dev server |
| `npm test` | Run the Vitest unit tests for the cost and URL logic |
| `npm run validate:pricing` | Check `data/pricing.json` against `data/pricing.schema.json` plus consistency rules |
| `npm run typecheck` | Run the TypeScript compiler without emitting |
| `npm run build` | Build the static site into `out/` |

### Project layout

```
app/                      Next.js App Router pages and global styles
components/               Calculator UI and SVG chart
lib/cost.ts               Pure cost functions (tested in lib/cost.test.ts)
lib/scenario.ts           Presets and URL query encoding (tested in lib/scenario.test.ts)
data/pricing.json         Pricing data
data/pricing.schema.json  JSON schema for the pricing data
scripts/validate-pricing.mjs  Validation script run in CI
```

### Shareable links

The scenario is stored in the query string, for example:

```
/?r=5000&i=1500&o=400&c=50&b=0&d=30&p=OpenAI,Anthropic&s=total&dir=asc
```

`r` requests/day, `i` input tokens, `o` output tokens, `c` cached share %, `b` batch (1 or 0), `d` days/month, `p` providers, `s` sort column, `dir` sort direction. Use "Copy shareable link" in the app.

## Updating prices

All prices live in [`data/pricing.json`](data/pricing.json). To add or fix a model:

1. Find the price on the provider's **official** pricing page. Third-party aggregators are not accepted as sources.
2. Edit or add the entry. Every field is required (`notes` is optional):
   ```json
   {
     "provider": "Anthropic",
     "model_id": "claude-sonnet-5",
     "display_name": "Claude Sonnet 5",
     "input": 2,
     "output": 10,
     "cached_input": 0.2,
     "batch_input": 1,
     "batch_output": 5,
     "batch_cached_input": 0.1,
     "source_url": "https://platform.claude.com/docs/en/about-claude/pricing",
     "last_verified": "2026-09-23",
     "notes": "Cache writes are not modelled."
   }
   ```
   Prices are USD per 1M tokens. Use `null` for a cached or batch price the provider does not offer or does not list.
3. Set `last_verified` to the date you checked the page.
4. Run `npm run validate:pricing && npm test`.
5. Open a pull request with the source link. CI validates the file, runs the tests and builds the site.

## Deploying

`npm run build` writes a fully static site to `out/`. Host it anywhere that serves static files (GitHub Pages, Netlify, Cloudflare Pages, S3, nginx).

If the site is served from a sub-path, set `BASE_PATH` at build time:

```bash
BASE_PATH=/llm-cost-calculator npm run build
```

**GitHub Pages:** the optional workflow in [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) builds with `BASE_PATH=/<repo-name>` and deploys `out/`. To use it, set Settings > Pages > Source to "GitHub Actions", then either run the workflow manually or set the repository variable `ENABLE_PAGES_DEPLOY` to `true` to deploy on every push to `main`. For a custom domain, change `BASE_PATH` in the workflow to an empty string.

## Roadmap

- [x] Initial release
- [x] Documentation and examples
- [x] CI and automated tests
- [ ] Azure OpenAI and other cloud-hosted pricing
- [ ] Long-context and cache-write pricing tiers
- [ ] Scheduled check that flags stale `last_verified` dates

Have an idea? [Open an issue](https://github.com/calliarc/llm-cost-calculator/issues).

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md). Price updates are especially helpful; see [Updating prices](#updating-prices).

## License

[MIT](LICENSE) © 2026 CalliArc

---

Built and maintained by [CalliArc](https://www.calliarc.com/). Need help with AI development? [Talk to our team](https://www.calliarc.com/services/artificial-intelligence-development/).
