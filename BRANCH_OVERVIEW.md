# Branch Overview

All branches are **legacy experiment snapshots** and must not be modified.  
Each branch represents a specific experimental condition in the research.

> Tag `paper-submission-2026-03` marks the exact commit submitted to the paper.

---

## main

**Loose FSM implementation — Paper submission version (2026-03)**

- FSM Level: **Lv1 (Hybrid-Loose)**
- Dual state machine: external `State` enum + internal `AgentState` FSM
- `%%_Fin_%%` is **not mentioned** in the initial prompt; the system manages completion automatically via VERIFYING → READY_TO_FINISH → FINISHED
- `{{systemState}}` is **partially** injected (only in enhanced/verification prompts, not in initial prompt)
- Safety mechanisms: tag violation retry (max 2), turn limit (15), consecutive file request limit, No Progress detection
- 3 dedicated verification prompts (normal / NoChanges / NoProgress)
- Evaluation: new FSM-based `patchEvaluation` system

---

## Lv0 — Prompt-Driven Baselines (No FSM)

These branches have **no `AgentStateMachine`**. The LLM controls its own workflow via tags specified in the prompt. `%%_Fin_%%` is freely available to the LLM.

### baseline/prompt-5step

Original 5-step prompt-driven baseline. Former `master` branch.

- Base commit: `e0e0931` → `28fa3c5` → ... → `26171d9`
- Prompt workflow: Analyze → Plan → Define Success → Execute → Verify & Complete
- LLM can use `%%_Fin_%%` at any time (guarded by `hasProcessedFiles && hasGeneratedDiff`)
- Includes `00_promptPreVerification.txt` (Devil's Advocate pattern, unique to this branch)
- Evaluation: legacy `patchEvaluation` system

### baseline/prompt-pr-title

Adds PR title embedding to the initial prompt. Former `experiment/e0e0931-with-pr-title`.

- Base: `e0e0931`
- 1 commit ahead of base
- Change: `{{pullRequestTitle}}` injected into the initial prompt

### baseline/prompt-title-fix

PR title embedding parser fix. Former `feature/fix-title-embedding`.

- Base: `b34512c`
- 4 commits ahead of base
- Fix: prompt base path handling and PR title extraction logic

### baseline/prompt-model-abtest

A/B test with model version and timeout changes. Former `experiment/ab-test-28fa3c5-clean`.

- Base: `28fa3c5`
- 6 commits ahead of base
- Changes: LLM model version update (gpt-5.1), timeout adjustment (90s)

### baseline/prompt-context-enhanced

Enhanced context generation with summarization. Former `experiment/stub-context-enhancement`.

- Base: `e0e0931`
- 5 commits ahead of base
- Changes: prompt structure enhancement, summarization capabilities, stub context improvements

---

## Lv2 — Strict FSM (System-Managed)

These branches have the full `AgentStateMachine` with `{{systemState}}` injected into **all prompts**. The LLM always knows its current FSM state, allowed tags, and allowed actions.

### fsm-strict/selfrefine

Strict FSM + Self-Refine pattern. Former `Feature_SelfRefine`.

- Base: `00a43de` (branched from master ~2025-12-31)
- 17 commits ahead of master
- `%%_Fin_%%` is **explicitly restricted** in prompt: "can ONLY be used when the system transitions you to READY_TO_FINISH state"
- `{{systemState}}` in **all prompts** (initial, reply, enhanced, finalCheck, error)
- Self-Refine: LLM self-evaluates via `%_Verification_Report_%`
- Session management API and conversation persistence
- Behavioral bias removal in prompts
- `autoResponser.ts` removed (integrated into FSM)

### fsm-strict/integrated

Integrated final version. Former `final`.

- Base: `00a43de`
- 33 commits ahead of master (superset of selfrefine)
- Combines selfrefine's strict FSM + fsm-implementation's safety mechanisms
- Adds: parallel batch processing, Intent Fulfillment Level score mapping
- Includes `00_prompt_error.txt` for ERROR state recovery

### fsm-strict/evaluation

FSM + evaluation system integration. Former `feature/Evaluation_FSM`.

- Base: `00a43de`
- 35 commits ahead of master
- FSM implementation **identical** to `fsm-strict/integrated`
- Differences: evaluation scripts, file generation module refactoring

---

## Legacy

### legacy/28fa3c5-merged

Former `Feature_28fa3c5withObjectFormat`. **Identical to `baseline/prompt-5step`** (0 diff). Can be ignored.

### legacy/typescript-migration

Former `chore`. Initial TypeScript migration work (2025-06). 104 commits behind master. Historical only.

---

## Evolution Map

```
baseline/prompt-5step (Lv0: Prompt-driven, LLM controls %%_Fin_%%)
  │
  ├── baseline/prompt-pr-title       (+PR title in prompt)
  ├── baseline/prompt-title-fix      (+title parser fix)
  ├── baseline/prompt-model-abtest   (+model/timeout A/B test)
  ├── baseline/prompt-context-enhanced (+context summarization)
  │
  ├── fsm-strict/selfrefine (Lv2: Full systemState injection, strict tag control)
  │   ├── fsm-strict/integrated      (+batch processing, score mapping)
  │   └── fsm-strict/evaluation      (+evaluation tooling)
  │
  └── main ★ (Lv1: Partial systemState, system-managed completion, safety mechanisms)
```
