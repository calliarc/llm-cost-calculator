# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-09-23

First working release.

### Added

- Estimate monthly cost from requests per day and input/output tokens
- Side-by-side comparison across providers and models, in a sortable table and a bar chart
- Prompt caching and batch pricing where providers offer them
- Presets for common workloads: chatbot, RAG, summarization, agent
- Filter by provider
- Pricing data kept in one JSON file that is easy to update via pull request, checked against a JSON schema in CI
- Shareable links for a given scenario (the whole scenario lives in the URL query string)

[Unreleased]: https://github.com/calliarc/llm-cost-calculator/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/calliarc/llm-cost-calculator/releases/tag/v0.1.0
