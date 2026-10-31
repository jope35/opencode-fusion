# Findings: GitHub Copilot "Fusion" (subtopic `copilot_fusion`)

As-of date: 2026-10-30. All sources below were read in full (via Exa fetch, Jina reader, or webfetch) unless flagged otherwise. Searches used: 3 (Exa MCP was rate-limited, so `websearch` + Jina were used instead).

## 1. What Copilot Fusion is, and where it is available

- Primary docs define it as: "Copilot Fusion is an intelligent runtime model router and orchestrator. It chooses models and execution patterns for your task, then returns a single response." You select it in the model picker, "but you aren't selecting a specific model. You're choosing a system that routes and orchestrates models at runtime." [About GitHub Copilot Fusion — GitHub Docs](https://docs.github.com/en/copilot/concepts/models/copilot-fusion)
- GitHub CPO Mario Rodriguez, interviewed by VentureBeat: "It's not a model. It's an orchestration engine at runtime." [VentureBeat, 2026-10-28](https://venturebeat.com/orchestration/github-copilot-fusion-mixes-models-to-achieve-near-opus-5-5-coding-performance-at-half-the-per-task-cost)
- Lineage: GA "Copilot Fusion" (2026-10-28, GitHub Universe) "brings together Project HydraFusion's multi-model orchestration and Copilot auto model selection's fine-tuned model selection." HydraFusion was a research preview announced 2026-09-04 (Copilot CLI via `/experimental`), extended to VS Code + Copilot app on 2026-09-30, updated with a new model pool and "HydraFusion Max" on 2026-10-14. [Changelog 2026-10-28](https://github.blog/changelog/2026-10-28-route-and-orchestrate-models-with-github-copilot-fusion/), [HydraFusion blog 2026-09-04](https://github.blog/ai-and-ml/github-copilot/project-hydrafusion-frontier-quality-via-multi-model-orchestration/), [Changelog 2026-09-30](https://github.blog/changelog/2026-09-30-hydrafusion-in-vs-code-and-the-github-copilot-app/), [Changelog 2026-10-14](https://github.blog/changelog/2026-10-14-hydrafusion-updates-and-new-max-option/)
- **Availability (GA, per docs):** "generally available in: Visual Studio Code, Copilot CLI, GitHub Copilot app, JetBrains IDEs" — on all Copilot plans per the changelog ("available on all Copilot plans in Visual Studio Code, the GitHub Copilot app, GitHub Copilot CLI, and JetBrains IDEs. Support for additional clients is coming soon."). CLI usage: `copilot --model fusion --fusion-tier standard|high|max -p "..."` or `/model` → Copilot Fusion in a session. [Docs: About GitHub Copilot Fusion](https://docs.github.com/en/copilot/concepts/models/copilot-fusion); [Docs: Choosing a model in GitHub Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/use-copilot-cli/choose-a-model)
- **Effort levels:** Fusion Standard (balances cost/quality/latency; everyday work), Fusion High, Fusion Max (frontier capability), Fusion Fast ("Not selectable by users. Only available in Visual Studio Code inline chat."). [Docs: About GitHub Copilot Fusion](https://docs.github.com/en/copilot/concepts/models/copilot-fusion)
- **Not confirmed:** availability in Copilot cloud agent / agent mode on GitHub.com, Copilot Chat on GitHub.com, or Mobile. The GA list names only the four clients above, and the cloud-agent model picker docs list "Auto" plus specific models, no Fusion. The Auto docs say: "If you see Copilot Fusion in the picker, rather than Auto, it means that Copilot Fusion is available in your Copilot surface." [About GitHub Copilot auto model selection](https://docs.github.com/en/copilot/concepts/models/auto-model-selection); [Changing the AI model for Copilot cloud agent](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/changing-the-ai-model)
- Billing: "you're billed for each model it uses, at that model's standard rate. There's no separate charge for Copilot Fusion." Paid plans get a 30% discount on model costs through November 30, 2026 (docs note). [Docs: About GitHub Copilot Fusion](https://docs.github.com/en/copilot/concepts/models/copilot-fusion)

## 2. Inputs

Per the docs and HydraFusion blog, Fusion consumes:

- **The user's prompt/task and conversation history** — pattern choice is made "for each prompt, so different prompts in the same session can use different execution patterns."
- **Capability signals derived from the task:** "reasoning, code generation, debugging, and tool use" — used "to select the most efficient execution pattern that meets the quality bar for your chosen effort level."
- **The user-selected effort level** (Standard/High/Max), which sets the quality bar.
- **Real-time system health and availability:** "Copilot Fusion also considers real-time system health and availability when choosing models."
- **Cache/conversation signals:** "Routing occurs along natural cache boundaries and large changes in conversation complexity to avoid additional cache-related costs without quality improvements."
- **Code/workspace context:** in agent workflows, solver steps run "in the shared workspace and normal permission-aware agent loop" (tools available); review/critique steps run "in isolated, tool-less contexts." Critique (per 2026-10-14 changelog) "now relies more on tools to inspect the actual workspace directly." Context window: "Copilot Fusion doesn't have a context window of its own. Each step runs within the context limits of the model running it."
- **Plan/policy constraints:** Fusion chooses only from models available to the user's plan and not excluded by admin policies (incl. data-resident/FedRAMP and Evaluation-model restrictions). [Docs: About GitHub Copilot Fusion](https://docs.github.com/en/copilot/concepts/models/copilot-fusion); [HydraFusion blog](https://github.blog/ai-and-ml/github-copilot/project-hydrafusion-frontier-quality-via-multi-model-orchestration/); [Changelog 2026-10-14](https://github.blog/changelog/2026-10-14-hydrafusion-updates-and-new-max-option/)

## 3. Pipeline steps

For each prompt, in order:

1. **Pattern selection (lightweight):** Fusion evaluates the task and picks one of three execution patterns; "Choosing an execution pattern is a lightweight step that adds minimal latency." Extra model calls are added "only when a task warrants them."
2. **Execution per pattern:**
   - **Single** — "One model completes the task."
   - **Cascade** — "An efficient model drafts a solution, and a judge inspects the draft and decides whether to accept it or escalate to a stronger model." (2026-10-14 update: cascade "can now include a judging step that inspects the initial work and requests a repair only when needed.")
   - **Critique** — "One model drafts a response while multiple models independently critique it in parallel. Their feedback is aggregated, and the original model revises its response based on the combined feedback." (Original HydraFusion blog version: "an independent read-only critic from a different model family reviews it (following the same review pattern as Rubber Duck), and the drafting model revises once.")
3. **Per-step model + reasoning effort:** "Reasoning effort and model choice are set per step." (2026-10-14: "using medium effort for initial drafts and high effort for review.")
4. **Result presentation:** "Intermediate drafts might be revised or discarded, so Copilot Fusion only shows you the final response." Users can "follow the progress of each step and the model being used" while it runs, and "hover over the effort level name below the response to see a list of models used."

Engineering principles behind the runtime (HydraFusion blog): "Complete accounting" (cost/usage per workflow leg: drafting, critique, revision, escalation, retry, fallback), "Bounded execution" (timeouts/cancellation per leg), "Isolated review" (tool-less review contexts), "Fail-safe application" (no patch applied if cancelled/failed validation), "Validated routing" (verify workflow definitions, model bindings, fallback, availability before execution). Routing policies were tuned offline with beam search against CheckpointBench/DeepSWE/TerminalBench 2.1. [HydraFusion blog, 2026-09-04](https://github.blog/ai-and-ml/github-copilot/project-hydrafusion-frontier-quality-via-multi-model-orchestration/)

## 4. Output-combination mechanism — explicit vs. implied

**Explicitly stated (docs/blog/changelog):**
- This is a **router + orchestrator**, not a merged/ensembled model. Fusion "returns a single response"; there is no token-level ensembling, voting, or weight-averaging described anywhere.
- **Single:** output of one model is the output — pure routing/selection.
- **Cascade:** combination is **judge-based selection** — the judge either accepts the draft (output = draft) or escalates to a stronger model (output = stronger model's result). No merging of the two outputs is described.
- **Critique:** combination happens **inside the drafting model**: multiple critics' feedback is "aggregated, and the original model revises its response based on the combined feedback." The aggregation mechanism itself (concatenation vs. summarization) is **not specified**.
- Overall: the "combination" of underlying models is orchestration of sequential/parallel model calls whose results are accepted, escalated, or revised — i.e., **routing + judge-gating + critique-and-revise**, not ensembling or distillation.

**Implied / third-party only (flag as not from primary GitHub sources):**
- TechTarget reports HydraFusion builds on GitHub's "Hybrid Dynamic Routing Architecture (HyDRA)," which scores tasks across reasoning, code generation, debugging, and tool use, and that HydraFusion uses those scores to pick the pattern. HyDRA is **not named in any GitHub docs/blog page read here**. [TechTarget, 2026-09-09](https://www.techtarget.com/news/GitHub-tests-multi-model-routing-with-HydraFusion/856969/)
- The 2026-10-28 GA combines HydraFusion orchestration with Auto model selection's "fine-tuned model selection" — i.e., the per-request model router from Auto is reused inside Fusion.

## 5. Underlying models named

- Docs deliberately do **not** publish a fixed pool: "Copilot Fusion draws on a mix of models: versatile models for straightforward work, and models with stronger reasoning for harder problems... The model pool changes as new models become available and as GitHub evaluates which models perform best."
- **2026-10-14 changelog:** HydraFusion/HydraFusion Max pool "now includes **Claude Opus 5.5, GPT-6 Astra, GPT-6.1 Sol, and GPT-6 Luna**."
- **VentureBeat (2026-10-28), citing Artificial Analysis observation of Fusion's pool:** "models from both Anthropic and OpenAI... including **Claude Opus 5.5, Claude Sonnet 5.5, GPT-6 Astra and GPT-6 Sol**."
- **HydraFusion blog (2026-09-04) evaluation baselines:** Claude Opus 5 and GPT-5.6 Sol.
- **Local models (public preview):** MAI Code 1.1 Flash and Qwen3.8 Flash Next ("qwen3.8-flash-next-local") can be chosen by Fusion at Fusion Standard only.
- Full current catalog of individually selectable models (the pool Fusion draws from, subject to plan/policies): [Supported AI models in GitHub Copilot](https://docs.github.com/en/copilot/reference/ai-models/supported-models) — includes GPT-5.x/6.x, Claude Opus/Sonnet/Haiku/Fable families, Gemini 3.8 Flash / 4 Argon, MAI-Code-1.1-Flash, Kimi K3, Grok 4.5–4.7, Qwen2.5; the Auto-selection table lists 17 models across cloud agent / Chat / CLI / app.

## 6. Benchmarks and claims (with dates)

- **HydraFusion research preview, offline evals (blog, published 2026-09-04):** vs Claude Opus 5 baseline, all models at same medium reasoning: TerminalBench 2.1 **+4.9 points** verified quality at **67% lower** estimated cost; DeepSWE **−1.5 points** at 36% lower cost; CheckpointBench (internal, from real Copilot sessions) **−0.1 points** at 65% lower cost. Development record: by Aug 25, 2026, "91.8% best-of-2 equivalent" on TerminalBench 2.1. [HydraFusion blog](https://github.blog/ai-and-ml/github-copilot/project-hydrafusion-frontier-quality-via-multi-model-orchestration/)
- **GA announcement (changelog, 2026-10-28):** "In the Artificial Analysis Coding Agent Index, Copilot Fusion Max scored **60**, within two points of Claude Code with Opus 5.5 Max. It delivered that result at about **half the average API cost per task**, using about **half as many tokens** and taking about **40% less time** per task."
- **Independent detail (VentureBeat, 2026-10-28), from Artificial Analysis Coding Agent Index v2.0 (published 2026-10-28), Fusion Max via Copilot CLI:** score 60 vs ~62 for Claude Code + Opus 5.5 Max; avg **$5.59/task vs $11.42** (~51% less); **7.2M tokens/task** (~half of the Opus 5.5 config); sub-scores: Terminal-Bench 4.0 **71** (led), FrontierCode 51 (behind Opus 5.5's 56 and Devin Fusion's 54), SWE-Atlas-QnA-AA 57. Devin Fusion (Opus 5.5 Max + GPT-6 Luna High) scored 62 at $8.00/task. The "40% less time" claim is GitHub-reported; AA did not publish per-task timing.
- **GitHub-internal DeepSWE claim (secondhand, via VentureBeat citing The AI Economy):** Fusion High/Max beat comparable frontier configs by up to 8.7 points with up to 77% estimated cost reduction — flagged as company-reported, max-not-average, underlying runs not published.
- Auto model selection context (precursor router): task-based routing GA in VS Code 2026-05-20, CLI 2026-07-01, Chat on github.com 2026-06-17, tiers (efficiency/balance/intelligence) 2026-09-14; 10% paid-plan discount for Auto vs 30% for Fusion through 2026-11-30. [Changelog entries](https://github.blog/changelog/2026-05-20-auto-model-selection-now-routes-based-on-your-task-in-vs-code/), [2026-06-17](https://github.blog/changelog/2026-06-17-auto-mode-in-copilot-chat-available-for-all-users/), [2026-09-14](https://github.blog/changelog/2026-09-14-configure-cost-and-quality-in-copilot-auto-model-selection/)

## 7. Dates of sources

- Docs "About GitHub Copilot Fusion": page last-updated not shown; datetime estimate 2026-10-16 (confidence 70). https://docs.github.com/en/copilot/concepts/models/copilot-fusion
- Docs "Supported AI models in GitHub Copilot": datetime estimate 2026-10-19 (confidence 70). https://docs.github.com/en/copilot/reference/ai-models/supported-models
- Docs "Models in GitHub Copilot" (overview) and "About GitHub Copilot auto model selection": read 2026-10-30. https://docs.github.com/en/copilot/concepts/models/overview , https://docs.github.com/en/copilot/concepts/models/auto-model-selection
- Docs "Choosing a model in GitHub Copilot CLI": read 2026-10-30. https://docs.github.com/en/copilot/how-tos/copilot-cli/use-copilot-cli/choose-a-model
- Blog "Project HydraFusion: Frontier quality via multi-model orchestration": published 2026-09-04 (confidence 95). https://github.blog/ai-and-ml/github-copilot/project-hydrafusion-frontier-quality-via-multi-model-orchestration/
- Changelog "Route and orchestrate models with GitHub Copilot Fusion": 2026-10-28 (confidence 95). https://github.blog/changelog/2026-10-28-route-and-orchestrate-models-with-github-copilot-fusion/
- Changelog "HydraFusion in VS Code and the GitHub Copilot app": 2026-09-30. https://github.blog/changelog/2026-09-30-hydrafusion-in-vs-code-and-the-github-copilot-app/
- Changelog "HydraFusion updates and new Max option": 2026-10-14. https://github.blog/changelog/2026-10-14-hydrafusion-updates-and-new-max-option/
- VentureBeat "GitHub Copilot Fusion mixes models to achieve near-Opus 5.5 coding performance at half the per-task cost": 2026-10-28. https://venturebeat.com/orchestration/github-copilot-fusion-mixes-models-to-achieve-near-opus-5-5-coding-performance-at-half-the-per-task-cost
- TechTarget "GitHub tests multi-model routing with HydraFusion": 2026-09-09. https://www.techtarget.com/news/GitHub-tests-multi-model-routing-with-HydraFusion/856969/

## 8. Could not confirm / gaps

- Whether Fusion is offered in **Copilot cloud agent** or Chat on GitHub.com/Mobile (docs GA list covers only VS Code, CLI, Copilot app, JetBrains; cloud-agent model list shows no Fusion).
- The internal name/mechanism of the per-request router ("HyDRA" appears only in TechTarget, not in GitHub primary sources read).
- How the Cascade "judge" is implemented (model call vs. rubric/checker) — docs say only "a judge inspects the draft."
- How Critique feedback is "aggregated" before the drafting model revises (no mechanism given).
- The numeric context-window value shown for Fusion ("a conservative value based on the smallest limits among the models it uses") — number not present in the fetched docs text.
- Exact "last updated" date of the Fusion docs page (only a low-confidence estimate of 2026-10-16).
- The 77% cost-savings figure (secondhand, company-internal DeepSWE eval, raw results not published).
- Whether Fusion can run in agent mode specifically (vs. chat) in each IDE — docs don't distinguish; the GA changelog says "model picker" generally.
