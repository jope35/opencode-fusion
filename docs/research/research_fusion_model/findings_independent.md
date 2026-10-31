# Findings: INDEPENDENT (non-vendor) sources on multi-model "fusion" systems

Subtopic 3 of `research_plan.md` (Linear WHE-29). As-of date: 2026-10-30.
Scope: third-party analyses, benchmarks, comparisons, critiques, community discussions, and academic literature on LLM routing / ensembling / cascades, plus anything independent about "Devin Fusion" (Cognition) and "Copilot Fusion" (GitHub). Vendor docs (cognition.com, docs.github.com) are cited only where an independent source quotes or tests them.

Method note: Exa MCP and Jina MCP were both rate-limited/key-less in this session (HTTP 429), so all searches ran through the built-in web search (8 queries + page fetches). Every page cited below was read (search-result full text or direct fetch). One source (Woofun) returned only its headline/snippet on direct fetch; that is flagged.

---

## 1. What independent sources say about how multi-model "fusion" systems plausibly work

### 1.1 The academic taxonomy — routing vs cascade vs ensemble vs distillation

Independent literature cleanly separates four mechanisms, and "fusion" products map onto them as follows:

- **Hard router (pre-generation)**: "Model routing analyzes each input and selects the most appropriate model based on query characteristics. The router makes a single decision, mapping the query to one model from the available pool." — Moslem & Kelleher, *Dynamic Model Routing and Cascading for Efficient LLM Inference: A Survey*, arXiv:2603.04445, submitted 2026-02-23 (v3 2026-04-21). https://arxiv.org/abs/2603.04445 — The survey explicitly excludes mixture-of-experts ("we study routing across multiple independently trained LLMs") and treats "the routing mechanism as a separate orchestration layer, distinct from the candidate models." Paradigms: difficulty-aware, preference-aligned, clustering, RL, uncertainty-based, cascading. It notes "Production systems often combine routing and cascading strategies."
- **Cascade (post-generation)**: "Model cascading operates sequentially, first attempting inference with smaller, faster models and escalating to larger, more capable models only when the initial response is deemed insufficient based on quality estimation." — same survey, §1.2. JAIR survey (*Doing More with Less*, arXiv:2502.00409, JAIR Vol. 86, June 2026, https://arxiv.org/html/2502.00409v3) distinguishes "pre-generation routing (predicting candidate performance) from post-generation or cascade routing (evaluating a candidate based on its output)" and warns cascade "can incur higher latency and cost, since multiple LLMs may need to generate answers for a single query."
- **Ensemble / mixture (parallel + merge)**: Chen et al., *Harnessing Multiple Large Language Models: A Survey on LLM Ensemble*, arXiv:2502.18036 (2025-02-25, rev. 2025-09-18), https://arxiv.org/abs/2502.18036 — taxonomy "ensemble-before-inference, ensemble-during-inference, ensemble-after-inference." Together AI's **Mixture-of-Agents** (arXiv:2406.04692, 2024-06-07, https://arxiv.org/abs/2406.04692) is the canonical "learned/textual merge": layered proposers whose outputs are fed as auxiliary input to aggregators in the next layer; "does not require any fine-tuning"; authors themselves flag the cost: "the model cannot decide the first token until the last MoA layer is reached. This potentially results in a high Time to First Token (TTFT)."
- **Distillation**: no independent source found any evidence that Devin Fusion or Copilot Fusion distills a multi-model pipeline into a single set of weights. The surveys treat routing/cascading as a runtime orchestration layer, not a training-time compression. FLAG: absence of evidence, not evidence of absence — the vendors are closed-source, so this cannot be settled externally.

### 1.2 FrugalGPT — the canonical independent evidence that cascades work, with limits

Chen, Zaharia, Zou, *FrugalGPT: How to Use Large Language Models While Reducing Cost and Improving Performance*, arXiv:2305.05176 (2023-05-09), https://arxiv.org/abs/2305.05176. LLM cascade = sequential APIs + "a generation scoring function" + "an LLM router"; returns a generation if score > threshold, else queries the next API. Claims: "match the performance of the best individual LLM (e.g. GPT-4) with up to 98% cost reduction or improve the accuracy over GPT-4 by 4% with the same cost" (HEADLINES 98.3%, OVERRULING 73.3%, COQA 59.2% savings at matched accuracy). The authors' own limitations: "To train the LLM cascade strategy in FrugalGPT, we need some labeled examples... the training examples should be from the same or similar distribution as the test examples." Independent critique (Ship the Loop SIGINT review, https://shiptheloop.com/sigint/papers/scaffolded-model-capability-2023/): red flags include "No variance or multiple runs," "Benchmark contamination unaddressed," "Only classification/QA tasks tested," "Missing hyperparameters and prompts"; TechTalks (2023-06-12, https://bdtechtalks.com/2023/06/12/reduce-costs-of-chatgpt-gpt-4/) notes the reliability scorer "adds additional complexity... It also remains to be seen how practical it is in real production environments."

### 1.3 When models disagree / merge outputs — the academic cautionary literature

- **Self-MoA contradicts MoA**: arXiv:2502.00674, *Rethinking Mixture-of-Agents: Is Mixing Different Large Language Models Beneficial?* (2025-02-02), https://arxiv.org/abs/2502.00674 — "mixing different LLMs often lowers the average quality of the models"; Self-MoA (aggregate outputs of only the single top model) "achieves 6.6% improvement over MoA on the AlpacaEval 2.0 benchmark, and an average of 3.8% improvement across... MMLU, CRUX, and MATH."
- **Debate/consensus can hurt**: arXiv:2605.00914, *The Cost of Consensus* (2026-04-29), https://arxiv.org/html/2605.00914 — homogeneous teams of 10 agents over 3 debate rounds: "modal adoption up to 85.5%," "consensus collapse... (oracle gap up to 32.3 percentage points)," debate consumes "2.1–3.4× more tokens... for equal or lower accuracy"; "isolated self-correction consistently offers a more favorable cost-accuracy tradeoff."
- **Consensus ≠ correctness**: arXiv:2604.07667, *From Debate to Decision: Conformal Social Choice* (2026-04-09) — "Among the 1,963 inference samples where agents initially disagree at round 0, 469 (23.9%) converge to unanimous wrong consensus by round 3." EMNLP 2026 (aclanthology.org/2026.emnlp-main.2642.pdf, *AGENTAUDITOR*) — majority voting is "brittle under confabulation consensus, where agents share correlated biases and converge on the same incorrect rationale." KDD 2026 workshop paper *When Consensus Is Not Correctness* — "self-produced agreement cannot certify its producer."
- **Learned orchestration exists and works, with caveats**: Sakana AI "Conductor" (ICLR 2026, HN item 47923668, https://news.ycombinator.com/item?id=47923668) — a 7B model trained via RL to orchestrate other agents "outperform[s] every individual model in its pool," LiveCodeBench 83.9% / GPQA-Diamond 87.5%, "cheaper than heavyweight multi-agent approaches like Mixture-of-Agents"; HN commenter's framing: "it's not just a router between models — it's a meta-prompt engineer." Community skepticism of the same category (sakanafugu.novcog.us.com/reactions, 2026-06-23): Reddit user: "Until proven otherwise, this is just a highly advanced router/wrapper, not a fundamental leap in intelligence"; Prime Intellect's Elie Bakouch: "this is a closed source orchestrator on top of closed source models. if before you didn't control the models, now you don't even control which ones are used or how much."

---

## 2. Which category Devin Fusion and Copilot Fusion best match (per independent sources)

### 2.1 Devin Fusion = two-agent "lead + sidekick" harness with dynamic mid-session routing — NOT a learned merge, NOT distillation, NOT edit-merging

Independent descriptions converge on the same mechanism:

- **Artificial Analysis** (independent benchmark lab; LinkedIn post 2026-09-11, https://www.linkedin.com/posts/artificial-analysis_we-independently-benchmarked-devin-fusion-activity-7504270671208665088-AuFO): "this is the first time a multi-model coding agent has been included on the Artificial Analysis Coding Agent Index... Devin Fusion runs a frontier lead model with a cost-efficient sidekick... We tested configurations from Cognition combining frontier models from Anthropic and OpenAI with their new SWE-2 (medium) as a sidekick model." Fable 5.1(xhigh)+SWE-2(medium) scored 62 on Coding Agent Index v1.5, "almost tied with Claude Fable 5.1 (max, with fallback) in Claude Code at 62.2... costs 36% less at $7.9 per task... vs. $12.4."
- **The Batch / deeplearning.ai** (2026-09-25, https://www.deeplearning.ai/the-batch/one-agent-works-another-directs): "Instead of handing a task from one model to another in sequence, Devin Fusion runs two agents at once. A lead agent runs a planner model that oversees the session. A sidekick agent runs a cheaper model that completes lower-priority work. Each agent maintains its own tools and context." Also: "Artificial Analysis measured Devin Fusion with Claude Fable 5.1 as the lead, finding it consumed 70 percent more tokens and took nearly three times as many turns than Claude Code using Claude Fable 5.1 alone — but still cost less per task."
- **Agent Harness Handbook case study** (ai.zenoagi.com/harness/case-studies/devin, citing Cognition's 2026-06-29 post but analyzing independently): "Devin Fusion... is the most candid piece in the harness engineering literature on model routing... Fusion's answer is two techniques: Sidekick mode [two parallel fully-capable agents, each with persistent cacheable context; main agent "should keep its hands off... delegate and monitor"] and Dynamic mid-session routing [lightweight classifier decides during execution to upgrade/downgrade; switches scheduled at context compaction points because 'compaction triggers a cache miss anyway, so switching models is effectively free']."
- **Yu Xi Chau, Systems Journal** (updated 2026-09-15, https://yuxichau.com/posts/the-interesting-part-of-devin-fusion-is-the-shared-context/): "Fusion models and automatic routing seem overrated for power users who want to know exactly which model is doing the work... The more interesting feature is the shared context layer between two long-running agents." He also calls the Artificial Analysis comparison "strange": "It places Devin Fusion alongside individual models... A system built from two agents, their context, and their working process is a different object from a model on a benchmark table."
- **Community reimplementations** confirm the pattern is a harness, reproducible without Cognition: `github.com/luongnv89/pi-extensions` pi-fusion README and `github.com/mihneaptu/opencode-fusion` README ("Inspired by the Devin Fusion 'sidekick' pattern from Cognition... the main agent's file editing is mechanically denied... delegating every change to a cheaper, faster sidekick"). pi-fusion's own measurements: on one bulky-output task, cost −64% ($0.0681→$0.0243) by moving 33KB of tool output to the sidekick's context ("main-agent tokens drop from 13,484 to 3,492"); on a trivial lookup, only parity ("the best fusion can do is get out of the way"); "Fusion pays ~316 extra input tokens per turn to carry the tool."
- **eesel.ai hands-on test** (German, 2026-07-02, https://www.eesel.ai/de/blog/devin-fusion-test): "Die Architektur ist wirklich clever und die Kostenthese stimmt, aber die Zahlen sind ein Hersteller-Benchmark" — flags that the headline 35% figure is a vendor benchmark on a vendor-built eval (FrontierCode, "built with 20+ open-source maintainers"), that the 41% figure required Fable 5 whose access was suspended 2026-06-12, and that "88% of merged PRs were driven end-to-end by the Fusion router" is Cognition dogfooding on its own codebase, "the friendliest test environment there is."

**Classification (independent view):** Devin Fusion is best categorized as a **runtime orchestration harness = hard/delegation routing (lead decides what the sidekick does) + dynamic model switching**, i.e., router/cascade family per arXiv:2603.04445 — not an ensemble merge (outputs are not merged token-wise; the lead reviews/revises in its own context) and not distillation (no evidence of a distilled single model; SWE-2 is separately published as "Fine-tuned from Kimi K3, a 2.8 trillion-parameter mixture-of-experts model" per The Batch — that is a sidekick model, not a distillation of the fusion pipeline).

### 2.2 Copilot Fusion = runtime router + orchestrator with three explicit execution patterns (Single / Cascade / Critique) — the "Critique" pattern is an ensemble-style review, but the merge is done by the drafting model, not a separate merger

- **GitHub's own docs as quoted by independent press** (docs.github.com/en/copilot/concepts/models/copilot-fusion, quoted in VentureBeat 2026-10-28): "Copilot Fusion is an intelligent runtime model router and orchestrator... you're choosing a system that routes and orchestrates models at runtime." Three patterns: Single ("One model completes the task directly"), Cascade ("An efficient model drafts a solution, and a judge inspects the draft and decides whether to accept it or escalate to a stronger model"), Critique ("One model drafts a response while multiple models independently critique it in parallel. Their feedback is aggregated, and the original model revises its response based on the combined feedback."). "Intermediate drafts might be revised or discarded, so Copilot Fusion only shows you the final response." Routing happens "along natural cache boundaries... to avoid additional cache-related costs."
- **VentureBeat** (2026-10-28, https://venturebeat.com/orchestration/github-copilot-fusion-mixes-models-to-achieve-near-opus-5-5-coding-performance-at-half-the-per-task-cost): GitHub's Rodriguez — "It's not a model. It's an orchestration engine at runtime... Fusion can both route individual requests and orchestrate multiple model calls in pursuit of completing a task." "Artificial Analysis identified models from both Anthropic and OpenAI in Fusion's pool, including Claude Opus 5.5, Claude Sonnet 5.5, GPT-6 Astra and GPT-6 Sol."
- **Will Guyman (GitHub research, LinkedIn 2026-09-04)** on the predecessor Project HydraFusion — note: vendor-employed but published as research narrative; treated here as primary-adjacent: "combining models from different families (e.g. Claude+GPT) outperformed a single model... with equivalent compute... Two models appears to be the sweet spot for now; adding a third didn't meaningfully improve quality." "An extremely fast classifier analyzes prompt complexity and picks the right path: a single fast model for simple queries, or a cascade/critique ensemble for complex ones. That cuts spend up to 67% on Terminal Bench 2.1 and 35% on DeepSWE while solving some tasks no single frontier model could."
- **Data Studios** (2026-10-29, https://www.datastudios.org/post/github-copilot-fusion-generally-available-automatic-model-routing-all-plans) — full read: HydraFusion preview "used a single read-only critic from a different model family and one revision pass, so the generally available version widens the review stage"; cache economics: "cached tokens are typically billed at 10% of the normal input price, and a different model cannot reuse another model's cache"; warnings: "if a draft that Fusion later discards has already modified files in the workspace, those changes are not undone automatically"; "the execution patterns and the model pool may change over time." Open items it lists: "GitHub has not published which models make up Fusion's pool... The benchmark claim... comes from GitHub, and no independent reproduction is available yet."
- **subagentic.ai** (https://subagentic.ai/posts/copilot-fusion-generally-available/) notes the changelog vs docs discrepancy on Cascade ("escalation a fresh start from a repair model") and Critique (changelog: one reviewer; docs: multiple parallel critics + aggregated feedback + revision).

**Classification (independent view):** Copilot Fusion is a **router + cascade + critique-ensemble hybrid** — squarely in the "routing and cascading" family of arXiv:2603.04445, with the Critique pattern being the closest thing to an ensemble (parallel proposals merged by the original drafter model — a "learned merge" in the MoA sense, since the merging is done by an LLM reading the critiques, not by a hard vote). No independent evidence of distillation or edit-level merging of code outputs.

---

## 3. Verifiable claims vs marketing-only claims

### 3.1 Claims with independent (third-party) support

| Claim | Independent evidence | Source (URL, title, date) |
|---|---|---|
| Copilot Fusion Max ≈ Opus 5.5-level score at ~half the cost | Artificial Analysis Coding Agent Index v2.0 via Copilot CLI: Fusion Max **60 vs 62** (Claude Code + Opus 5.5 Max), **$5.59 vs $11.42/task (−51%)**, **7.2M tokens/task ≈ half** of Opus config, **~30% fewer tokens than Devin Fusion**; Terminal-Bench 4.0 **71 (led)**, FrontierCode **51** (behind CC 56 and Devin Fusion 54), SWE-Atlas-QnA-AA 57 | VentureBeat, "GitHub Copilot Fusion mixes models...", 2026-10-28; dataist.ai, 2026-10-29; cellcog.ai, 2026-10-28; ai-primer.com, 2026-10-28. CAVEAT: "GitHub funded the evaluation, according to WesRoth" (VentureBeat) — independent lab, vendor-funded |
| Devin Fusion ≈ frontier score at lower cost | AA Index v1.5: Fable 5.1(xhigh)+SWE-2(medium) Fusion **61.7–62 vs 62.2** for Fable 5.1 max in Claude Code, **$7.90 vs $12.40 (−36%)**, time 35.8 vs 34.8 min; Astra+SWE-2: **59**, 43% cheaper, 31% faster | AA LinkedIn post 2026-09-11; deeplearning.ai The Batch 2026-09-25; ai-primer.com 2026-09 |
| Multi-model systems can match/beats single best model on some benchmarks | FrugalGPT: cascade matches GPT-4 accuracy at up to 98% cost cut (2023); MoA: 65.1% vs GPT-4o 57.5% AlpacaEval 2.0 (2024); Conductor 7B orchestrator beats each model in pool (ICLR 2026); HydraFusion: Claude+GPT > either alone at equal compute (Guyman 2026-09) | arXiv:2305.05176; arXiv:2406.04692; HN 47923668; LinkedIn (Guyman) |
| Cost savings of fusion are real but come with score regressions on some components | Per-benchmark table (Cognition's own numbers, republished by alphasignal.ai 2026-09 and ai-primer): Astra-led Fusion on Terminal-Bench 4.0 **50.0 vs 55.6 solo (−5.6 pts)**; Vals Code Migration **61.3 vs 67.7 (−6.4 pts)**; cost cuts 11–46% across 10 comparisons; Fable-led mostly within ±1.5 pts, migration +2.7 | alphasignal.ai, "Cognition's Fusion cuts coding-agent costs...", 2026-09; ai-primer.com vendor-benchmark table |
| Fusion ≠ free: extra tokens/turns | AA: Devin Fusion consumed **70% more tokens and ~3× the turns** than single-model Claude Code at lower cost (The Batch 2026-09-25); Copilot docs: "Cascade and critique take longer because they include model calls for review"; MoA paper: high TTFT; Woofun: latency "waits for the slowest panel member" | The Batch; docs.github.com (via VentureBeat); arXiv:2406.04692; woofun.ai 2026-08-17 |
| Routing decisions are opaque; per-model outputs not shown | Copilot docs: "Intermediate drafts might be revised or discarded, so Copilot Fusion only shows you the final response" (progress + model per step IS shown); Devin: users pick lead+sidekick pair but router's mid-session switches are automatic | docs.github.com via VentureBeat; datastudios.org |

### 3.2 Marketing-only or unverifiable claims (no independent confirmation found)

- Cognition: "maintains frontier and Fable 5-level performance at **60% lower cost** on FrontierCode" (2026-06-29) — FrontierCode is a **vendor-built benchmark**; eesel.ai (2026-07-02) explicitly flags this; later Cognition post (2026-09-11, chart "updated 10/19/2026") says "up to **39%** more efficient" with AA data — the headline number moved as the benchmark data updated.
- Cognition: "**88%** of their merged PRs were driven entirely by the automated Fusion router" — internal dogfood on Cognition's own repo (flagged by eesel.ai as "the friendliest test environment there is").
- GitHub/Satya Nadella: "potential savings of **up to 77%**" — separate company-reported DeepSWE evaluation; VentureBeat and dataist.ai both explicitly warn: "that higher figure refers to a separate, company-reported evaluation, not the average measured by Artificial Analysis" and "the two savings figures are not directly comparable."
- GitHub: "about **40% less time per task**" — VentureBeat: "The Artificial Analysis article also does not report the per-task completion-time data underlying GitHub's claim of 40% less time; that remains a GitHub-reported comparison."
- Guyman/HydraFusion: "solving some tasks no single frontier model could" — no published task list.
- "Two models appears to be the sweet spot" (Guyman) — one internal experiment, contradicted in general by Self-MoA (arXiv:2502.00674) showing diversity can hurt.
- Whether any part of Fusion is **distilled into a single model** — no independent source confirms or denies; vendors are closed-source. FLAG as unsettled.

### 3.3 Claims independent evidence actively contradicts or qualifies

- "Fusion maintains performance" is **not uniform**: component-level regressions up to −6.4 pts (Astra/Vals) — alphasignal.ai; Woofun Research (2026-08-17, https://www.woofun.ai/en/news/detail/104734): across 5 disclosed cases, "task scores fluctuated between +12 and -27. Well-defined ES6 refactoring tasks saw scores rise from 98 to 100, but React/Redux tasks... suffered significant drops from 54 to 2"; "at a 1% invocation rate, the overall cost is 1.03-1.04 times; at 10%... 1.30-1.40 times; at 25%... 1.75-2.00 times" — fusion can be a net cost increase; conclusion: fusion "will remain a niche insurance policy rather than a default architecture." [FLAG: Woofun page body did not render on direct fetch; claims taken from its search snippet/headline.]
- "Ensembling different models helps" is **contested in the literature**: Self-MoA beats mixed-MoA by 6.6% on AlpacaEval 2.0 (arXiv:2502.00674); homogeneous debate can be worse than self-correction (arXiv:2605.00914); consensus can be confidently wrong (arXiv:2604.07667: 23.9% of initially-disputed items converge to unanimous wrong consensus).
- Benchmarking a *system* against *models* is methodologically questioned: Yu Xi Chau (2026-09-15): the AA comparison "places Devin Fusion alongside individual models... A system built from two agents, their context, and their working process is a different object from a model on a benchmark table."
- FrugalGPT-style cascades need in-distribution labeled data and their scorer is itself a cost — so "cheap draft + judge" claims don't generalize automatically (arXiv:2305.05176 limitations; Ship the Loop review red flags).

---

## 4. Disagreements between sources

1. **Savings magnitude**: AA-measured **−51%** (Copilot Fusion Max vs Opus 5.5 CC) vs GitHub-reported **up to −77%** (DeepSWE) vs Cognition's **−60%** (FrontierCode, vendor eval, 2026-06-29) vs **−39%/−31%** (later AA-based figures, chart updated 2026-10-19) vs **−36%** (AA, Devin Fusion Fable+SWE-2). Press (VentureBeat, dataist.ai) explicitly separates measured vs company-reported numbers; Cognition's own number drifted from 60% → 39% as data updated.
2. **Quality parity**: vendor framing "maintains frontier performance" vs component-level regressions (Terminal-Bench −5.6, Vals −6.4 for Astra-led Fusion) vs Woofun's −27 worst case vs AA's "near-tied composite masks a gain on repository Q&A and declines on the other two components" (ai-primer).
3. **Is mixing models beneficial?** Guyman (GitHub): cross-family pairs beat single models, 2 models = sweet spot. Self-MoA (arXiv:2502.00674): mixing different LLMs "often lowers the average quality"; self-ensemble of top model wins. MoA (arXiv:2406.04692): diversity wins on AlpacaEval. Unresolved in general; task-dependent.
4. **Router vs orchestrator framing**: Yu Xi Chau — "automatic routing seem[s] overrated"; the shared-context layer is the real innovation. HN/Reddit on analogous systems (Sakana Fugu): "just a highly advanced router/wrapper" vs "a compiler is not a CPU... a good orchestrator can still be a major product" (binaryverseai.com). GitHub itself concedes "It's not a model. It's an orchestration engine at runtime" (Rodriguez via VentureBeat).
5. **Copilot Fusion internals**: changelog diagram (Cascade = "fresh start from a repair model"; Critique = single reviewer) vs product docs (judge accept/escalate; multiple parallel critics, aggregated feedback, drafter revises) — flagged by subagentic.ai. HydraFusion preview (single read-only cross-family critic, one revision) vs GA (wider multi-critic review) — flagged by datastudios.org.
6. **Time savings**: GitHub claims ~40% less time; AA published no per-task time data to verify (VentureBeat, dataist.ai). AA did measure Devin Fusion time parity (35.8 vs 34.8 min) and Astra Fusion 31% faster.

---

## 5. Draft GRILLING QUESTIONS (concrete, answerable)

### Mechanism / output combination
1. Is the output combination in Fusion a hard router (one model's output wins per step), or a learned/textual merge (one model reads several outputs and synthesizes)? For Copilot's Critique pattern: is the "aggregation" of parallel critiques done by the drafting model, a separate judge model, or a deterministic vote/rank — and can you show the prompt or policy that does the aggregation?
2. In Cascade, what exactly is the judge's accept/escalate criterion — a confidence score, a learned classifier, a test-suite pass, or an LLM-as-judge? What threshold? What happens on judge disagreement with itself across retries?
3. When models disagree in Critique (e.g., two critics give contradictory edits), what is the tie-break rule? Is there any deterministic arbitration, or does the drafter always get the last word? (Literature: 23.9% of disputed items converge to *unanimous wrong* consensus, arXiv:2604.07667 — how do you detect that case?)
4. For Devin Fusion: is the lead→sidekick handoff a routing decision or a delegation decision? Who decides what goes to the sidekick — the lead model itself (via a tool call), or an external classifier? If the lead decides, what stops it from delegating judgment work (Cognition's own guidance says delegation "backfires badly when the judgment is the deliverable")?
5. Is any of this distilled into a single model (e.g., is SWE-2 or any "Fusion model" trained on traces of lead+sidekick runs)? If yes, what data, and is user code in the training set? If no, say so explicitly.
6. Is there any edit-level/merge-level combination of code outputs from two models (e.g., patch merging), or do outputs never touch the same file region from two models in one turn? (Copilot docs warn discarded drafts may have modified files — are those changes rolled back, and by whom?)

### Inputs / steps
7. What exactly does the router see when it decides (prompt only, prompt + repo embeddings, conversation history, tool-call trace, prior step outcomes)? Can a user export the router's decision log per prompt (pattern chosen, models used, judge scores)?
8. Copilot: "Routing occurs along natural cache boundaries" — quantify the cache cost of a mid-session model switch: if a switch happens off a compaction boundary, do you pay full uncached input again for the new model? What does that do to the claimed savings?
9. Devin: you say model switches happen at compaction points "effectively for free" — what is the measured cache-hit rate of the sidekick across delegations, and the per-delegation token overhead of the brief/result exchange (community reimplementation measured ~316 extra input tokens/turn just to carry the delegation tool)?
10. Does the router use real-time system health/availability (Copilot docs say yes) — i.e., can the same prompt get different models on different runs for non-quality reasons, and is that logged?

### Observability / trust
11. Can users see per-model outputs (drafts, critiques, judge verdicts) — not just "progress and the model being used"? If not, why not, given discarded drafts can leave file changes behind?
12. Can an enterprise admin pin Fusion to a fixed model pair (disable dynamic switching), and see exactly which models ran per request in the usage dashboard? Today the pool is unpublished — will you publish it?
13. Power-user objection (Yu Xi Chau, 2026-09-15): "power users want to know exactly which model is doing the work" — will you offer a "Fusion with visible/locked routing" mode?

### Cost / latency
14. Publish per-task cost AND time distributions (not just averages): Fusion Max averaged $5.59/task — what are p50/p90/p99 cost and wall-time, and the share of prompts where Critique/Cascade actually fired? (Woofun: at 25% invocation of a parallel panel, cost rises 1.75–2.00×.)
15. What is the latency overhead of Critique (parallel critics + revision) vs Single, in TTFT and total time, on a fixed benchmark? MoA's authors admit layered aggregation causes high TTFT — does Critique have the same issue?
16. The 30% Fusion discount on paid plans ends 2026-11-30 — what do per-task costs look like after it, and is the discount the reason Fusion is cheaper than the single model it routes to?
17. Vendor claims of 60–77% savings vs AA's measured 36–51%: which benchmark, which harness baseline, and can a third party reproduce with published task-level data? (Data Studios: "no independent reproduction is available yet.")

### Evaluation validity
18. FrontierCode is built by Cognition with 20+ OSS maintainers — who wrote the tasks, were they deduplicated against model training data, and will you publish the eval? Same question for DeepSWE (the source of the 77% claim) and ReviewBench (F1 "highest" but score unpublished).
19. Why does the headline savings number move (60% on 2026-06-29 → 39% after the 2026-10-19 chart update)? Which figure should a customer budget against?
20. AA places Fusion (a system) next to single models on one index — do you agree with Yu Xi Chau that this comparison is category-confused, and what system-level metrics (task completion, error recovery, rework, human review time) do you track instead?
21. Your own data shows regressions on some components (Astra-led: Terminal-Bench −5.6, Vals −6.4). On which task types does Fusion measurably *lose* to the best single model, and does the router learn to avoid invoking fusion there?

### Failure modes
22. When the sidekick/judge is wrong, what detects it — tests, the lead's review, or nothing? The debate literature shows groups amplify shared errors (arXiv:2605.00914); what is your defense against correlated errors between lead and sidekick of the same model family?
23. If a discarded Cascade/Critique draft modified workspace files, those changes are "not undone automatically" (GitHub's own docs) — what is the remediation path, and has this caused incidents?
24. FrugalGPT's own authors say cascades need labeled in-distribution data to train the scorer — what data trains your judge/router, how is it refreshed as models in the pool change, and what happens to quality when a new model ships mid-quarter?

---

## 6. Source list (URL + title + date)

Academic / literature:
1. https://arxiv.org/abs/2603.04445 — "Dynamic Model Routing and Cascading for Efficient LLM Inference: A Survey" (Moslem & Kelleher), submitted 2026-02-23, v3 2026-04-21.
2. https://arxiv.org/abs/2502.18036 — "Harnessing Multiple Large Language Models: A Survey on LLM Ensemble" (Chen et al.), 2025-02-25, rev. 2025-09-18.
3. https://arxiv.org/html/2502.00409v3 — "Doing More with Less: A Survey on Routing Strategies for Resource Optimisation in LLM-Based Systems", JAIR Vol. 86, June 2026.
4. https://arxiv.org/abs/2305.05176 — "FrugalGPT" (Chen, Zaharia, Zou), 2023-05-09.
5. https://shiptheloop.com/sigint/papers/scaffolded-model-capability-2023/ — SIGINT review of FrugalGPT (red flags), 2023.
6. https://bdtechtalks.com/2023/06/12/reduce-costs-of-chatgpt-gpt-4/ — TechTalks on FrugalGPT, 2023-06-12.
7. https://arxiv.org/abs/2406.04692 — "Mixture-of-Agents Enhances Large Language Model Capabilities" (Together AI), 2024-06-07.
8. https://arxiv.org/abs/2502.00674 — "Rethinking Mixture-of-Agents: Is Mixing Different Large Language Models Beneficial?" (Self-MoA), 2025-02-02.
9. https://arxiv.org/html/2605.00914 — "The Cost of Consensus: Isolated Self-Correction Prevails Over Unguided Homogeneous Multi-Agent Debate", 2026-04-29.
10. https://arxiv.org/html/2604.07667 — "From Debate to Decision: Conformal Social Choice for Safe Multi-Agent Deliberation", 2026-04-09.
11. https://aclanthology.org/2026.emnlp-main.2642.pdf — "Auditing Multi-Agent LLM Reasoning Trees Outperforms Majority Vote and LLM-as-Judge", EMNLP 2026.
12. https://kdd-eval-workshop.github.io/agenticai-evaluation-kdd2026/assets/papers/49_When_Consensus_Is_Not_Correct.pdf — "When Consensus Is Not Correctness", KDD 2026 workshop.
13. https://news.ycombinator.com/item?id=47923668 — HN on Sakana "Conductor" (ICLR 2026), 2026.

Devin Fusion, independent:
14. https://www.linkedin.com/posts/artificial-analysis_we-independently-benchmarked-devin-fusion-activity-7504270671208665088-AuFO — Artificial Analysis LinkedIn, 2026-09-11.
15. https://www.deeplearning.ai/the-batch/one-agent-works-another-directs — The Batch, 2026-09-25.
16. https://yuxichau.com/posts/the-interesting-part-of-devin-fusion-is-the-shared-context/ — Yu Xi Chau, Systems Journal, updated 2026-09-15 (read in full).
17. https://ai.zenoagi.com/harness/case-studies/devin — Agent Harness Handbook, "Case Study: Devin".
18. https://www.eesel.ai/de/blog/devin-fusion-test — eesel AI hands-on test, 2026-07-02.
19. https://alphasignal.ai/news/cognition-s-fusion-cuts-devin-coding-agent-costs-by-46-with-two-model-teamwork — AlphaSignal, 2026-09.
20. https://www.ai-primer.com/engineer/stories/devin-fusion-benchmark — ai-primer, 2026-09.
21. https://aicoder.com/news/news-1792569864878-ad82s — AICoder on AA's 2026-10-21 Devin Fusion result (68.1, $9.01 vs $13.04, −31%).
22. https://www.woofun.ai/en/news/detail/104734 — Woofun Research critique, 2026-08-17 [FLAG: body not retrievable; snippet only].
23. https://github.com/luongnv89/pi-extensions/blob/main/extensions/pi-fusion/README.md and https://github.com/mihneaptu/opencode-fusion — community reimplementations of the sidekick pattern with their own cost measurements.

Copilot Fusion, independent:
24. https://venturebeat.com/orchestration/github-copilot-fusion-mixes-models-to-achieve-near-opus-5-5-coding-performance-at-half-the-per-task-cost — VentureBeat, 2026-10-28.
25. https://dataist.ai/news/github-copilot-fusion-nears-opus-5-5-at-half-the-benchmark-cost/ — dataist.ai, 2026-10-29.
26. https://cellcog.ai/blog/github-copilot-fusion/ — CellCog, 2026-10-28.
27. https://www.ai-primer.com/engineer/stories/copilot-fusion-launch — ai-primer, 2026-10-28.
28. https://subagentic.ai/posts/copilot-fusion-generally-available/ — subagentic.ai, 2026-10.
29. https://www.datastudios.org/post/github-copilot-fusion-generally-available-automatic-model-routing-all-plans — Data Studios, 2026-10-29 (read in full).
30. https://www.linkedin.com/posts/will-guyman-...-activity-7501778249501384704-rQ1D — Will Guyman on HydraFusion, 2026-09-04 [vendor-employed author; primary-adjacent].
31. https://docs.github.com/en/copilot/concepts/models/copilot-fusion — GitHub docs (vendor; quoted via 24–29).

Community / analogous systems:
32. https://sakanafugu.novcog.us.com/reactions — "What People Are Saying About Sakana Fugu" (Reddit/HN skeptic quotes), 2026-06-23.
33. https://binaryverseai.com/sakana-fugu-ai-explained/ — Binaryverse analysis, 2026-06-22.
34. https://www.reddit.com/r/GithubCopilot/comments/1t9bcpb/... and /1uf4fef/... — r/GithubCopilot credit-model complaints, 2026-05-10 / 2026-06-25 (context on pricing pressure behind Fusion's cost pitch).

---

## 7. Flags / could not confirm

- **No independent source confirms or denies distillation** of any fusion pipeline into a single model; both vendors are closed-source. Treated as unsettled.
- **Copilot Fusion's model pool is unpublished** by GitHub; the four models seen (Opus 5.5, Sonnet 5.5, GPT-6 Astra, GPT-6 Sol) come from AA's observation of traffic, not from GitHub.
- **No independent reproduction of the AA benchmark runs yet** (Data Studios, 2026-10-29); AA runs were vendor-funded (GitHub for Copilot Fusion, per WesRoth via VentureBeat) though published as independent lab results.
- **Woofun Research critique** (score swings +12/−27, invocation-rate cost dilution) could only be captured from the search snippet; the page body did not load. Treat its specific numbers as lower-confidence.
- **GitHub's "40% less time" and "up to 77% savings"** are company-reported; no per-task data published to verify.
- **Cognition's FrontierCode eval** is not publicly released; all "60%/35%/39%" cost-savings figures trace to vendor-built or vendor-funded benchmarks.
- Exa and Jina search MCPs were unavailable (rate limit / missing API key) in this session; search coverage relied on one search provider — possible source gaps, especially non-English and LinkedIn/Reddit threads beyond those surfaced.
