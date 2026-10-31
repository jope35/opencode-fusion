# Grilling questions — Devin / Copilot "fusion" models

Logged separately per Linear WHE-29, to align with the user at a later stage. Each question is concrete and answerable. Sources for the underlying claims are in `findings_independent.md` and `research_report.md`. As-of date: 2026-10-30.

## Mechanism / how outputs are combined

1. Is the output combination a hard router (one model's output wins per step), or a learned/textual merge (one model reads several outputs and synthesizes)? For Copilot's Critique pattern: is the "aggregation" of parallel critiques done by the drafting model, a separate judge model, or a deterministic vote/rank — and can you show the prompt or policy that does the aggregation?
2. In Cascade, what exactly is the judge's accept/escalate criterion — a confidence score, a learned classifier, a test-suite pass, or an LLM-as-judge? What threshold? What happens on judge disagreement with itself across retries?
3. When models disagree in Critique (contradictory edits from two critics), what is the tie-break rule? Is there any deterministic arbitration, or does the drafter always get the last word? (Literature: 23.9% of initially disputed items converge to *unanimous wrong* consensus, arXiv:2604.07667 — how do you detect that case?)
4. For Devin Fusion: is the lead→sidekick handoff a routing decision or a delegation decision? Who decides what goes to the sidekick — the lead model itself (via a tool call), or an external classifier? If the lead decides, what stops it from delegating judgment work (Cognition's own guidance says delegation "backfires badly when the judgment is the deliverable")?
5. Is any of this distilled into a single model (e.g., is SWE-2 or any "Fusion model" trained on traces of lead+sidekick runs)? If yes, what data, and is user code in the training set? If no, say so explicitly.
6. Is there any edit-level/merge-level combination of code outputs from two models (e.g., patch merging), or do outputs from two models never touch the same file region in one turn? (Copilot docs warn discarded drafts may have modified files — are those changes rolled back, and by whom?)

## Inputs / steps

7. What exactly does the router see when it decides (prompt only, prompt + repo embeddings, conversation history, tool-call trace, prior step outcomes)? Can a user export the router's decision log per prompt (pattern chosen, models used, judge scores)?
8. Copilot: "Routing occurs along natural cache boundaries" — quantify the cache cost of a mid-session model switch: if a switch happens off a compaction boundary, do you pay full uncached input again for the new model? What does that do to the claimed savings?
9. Devin: you say model switches happen at compaction points "effectively for free" — what is the measured cache-hit rate of the sidekick across delegations, and the per-delegation token overhead of the brief/result exchange (community reimplementation measured ~316 extra input tokens/turn just to carry the delegation tool)?
10. Does the router use real-time system health/availability (Copilot docs say yes) — i.e., can the same prompt get different models on different runs for non-quality reasons, and is that logged?

## Observability / trust

11. Can users see per-model outputs (drafts, critiques, judge verdicts) — not just "progress and the model being used"? If not, why not, given discarded drafts can leave file changes behind?
12. Can an enterprise admin pin Fusion to a fixed model pair (disable dynamic switching), and see exactly which models ran per request in the usage dashboard? Today the pool is unpublished — will you publish it?
13. Power-user objection (Yu Xi Chau, 2026-09-15): "power users want to know exactly which model is doing the work" — will you offer a "Fusion with visible/locked routing" mode?

## Cost / latency

14. Publish per-task cost AND time distributions (not just averages): Fusion Max averaged $5.59/task — what are p50/p90/p99 cost and wall-time, and the share of prompts where Critique/Cascade actually fired? (Woofun: at 25% invocation of a parallel panel, cost rises 1.75–2.00×.)
15. What is the latency overhead of Critique (parallel critics + revision) vs Single, in TTFT and total time, on a fixed benchmark? MoA's authors admit layered aggregation causes high TTFT — does Critique have the same issue?
16. The 30% Fusion discount on paid Copilot plans ends 2026-11-30 — what do per-task costs look like after it, and is the discount the reason Fusion is cheaper than the single model it routes to?
17. Vendor claims of 60–77% savings vs AA's measured 36–51%: which benchmark, which harness baseline, and can a third party reproduce with published task-level data? (Data Studios: "no independent reproduction is available yet.")

## Evaluation validity

18. FrontierCode is built by Cognition with 20+ OSS maintainers — who wrote the tasks, were they deduplicated against model training data, and will you publish the eval? Same question for DeepSWE (the source of the 77% claim) and ReviewBench.
19. Why does the headline savings number move (60% on 2026-06-29 → 39% after the 2026-10-19 chart update)? Which figure should a customer budget against?
20. AA places Fusion (a system) next to single models on one index — do you agree with Yu Xi Chau that this comparison is category-confused, and what system-level metrics (task completion, error recovery, rework, human review time) do you track instead?
21. Your own data shows regressions on some components (Astra-led: Terminal-Bench −5.6, Vals −6.4). On which task types does Fusion measurably *lose* to the best single model, and does the router learn to avoid invoking fusion there?

## Failure modes

22. When the sidekick/judge is wrong, what detects it — tests, the lead's review, or nothing? The debate literature shows groups amplify shared errors (arXiv:2605.00914); what is your defense against correlated errors between lead and sidekick of the same model family?
23. If a discarded Cascade/Critique draft modified workspace files, those changes are "not undone automatically" (GitHub's own docs) — what is the remediation path, and has this caused incidents?
24. FrugalGPT's own authors say cascades need labeled in-distribution data to train the scorer — what data trains your judge/router, how is it refreshed as models in the pool change, and what happens to quality when a new model ships mid-quarter?
