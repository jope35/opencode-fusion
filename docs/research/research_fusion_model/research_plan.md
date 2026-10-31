# Research plan: How the Devin fusion model works

## Main research question
How does the Devin "fusion" model work — what are its inputs, what processing steps does it run, and how are the outputs of the underlying models combined? (GitHub Copilot's "fusion" model is included as the comparison source named in the issue.)

Linear issue: WHE-29. As-of date: 2026-10-30.

## Subtopics (investigation order)
1. **devin_official** — Devin fusion from primary/official sources: https://docs.devin.ai/desktop/fusion, https://cognition.com/blog/devin-fusion, plus related official Devin/Cognition docs and release notes. Evidence needed: what "fusion" is, when it activates, inputs (prompt, repo context, model outputs), pipeline steps, and the mechanism by which outputs are combined (router vs ensemble vs distillation vs edit-based merging). Output: `findings_devin_official.md`.
2. **copilot_fusion** — GitHub Copilot fusion from primary sources: https://docs.github.com/en/copilot/concepts/models/copilot-fusion plus related GitHub docs/blog/changelog. Same evidence dimensions as subtopic 1. Output: `findings_copilot_fusion.md`.
3. **independent** — Independent/third-party sources: benchmarks, technical blog analyses, comparisons, critiques of multi-model "fusion" approaches (Devin, Copilot, and analogous router/ensemble systems). Evidence needed: what is independently verifiable about inputs/steps/output-combination, where claims are marketing-only, and disagreements between sources. Also draft the grilling questions. Output: `findings_independent.md`.

## Tools
- Search MCP: `tools.exa.web_search_exa` and `tools.exa.web_fetch_exa` via the `execute` tool (preferred); `tools.jina` search/read as secondary.
- Fallback page reader: `webfetch` tool. File writing: `write`/`edit` tools.
- Budget: 3–9 searches per subtopic; read the pages you cite.

## Synthesis
Read all findings files from disk, reconcile conflicts (report disagreements, prefer primary sources), then write:
- `research_report.md` — direct answer first (inputs, steps, output combination), then findings with citations, then conflicts/gaps, then source list.
- `grilling_questions.md` — SEPARATE file (per the issue): critical questions to align with the user later.

## Citation rules
Cite every important claim with URL + page title/section. Record publication dates. No invented URLs, numbers, or quotes. Quote sparingly and exactly.
