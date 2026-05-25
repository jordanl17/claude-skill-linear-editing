# Orchestrator: spawning the eval runs

<!--
PLACEHOLDER: this file is INSTRUCTIONS FOR A CLAUDE CODE AGENT to spawn
the eval subagents. The agent reads this file at the start of an eval
iteration and follows the steps.

Skill-specific parts to customise:
- The N scenarios listed in the setup script (count and ids must match
  evals.json)
- The two prompt templates (lightly customised per skill)
-->

A fresh Claude Code session uses the `Agent` tool to spawn `N × 2` background subagents (N scenarios × 2 conditions). Each subagent runs in its own context with full tool access and writes its output to a per-scenario directory.

## Setup once per iteration

```bash
SKILL_NAME=$(node -p "require('./package.json').name.replace(/^claude-skill-/, '')")
N=1  # bump for each new iteration
WORKSPACE="${SKILL_NAME}-workspace/iteration-$N"
mkdir -p "$WORKSPACE"
# Snapshot the current skill so the baseline is reproducible
cp -R "skill/${SKILL_NAME}" "${SKILL_NAME}-workspace/skill-snapshot-iter-$N"
# Pre-create the per-scenario output dirs
# PLACEHOLDER: list scenario ids matching evals.json
for name in placeholder-scenario-1 placeholder-scenario-2; do
  mkdir -p "$WORKSPACE/eval-$name/with_skill/run-1/outputs"
  mkdir -p "$WORKSPACE/eval-$name/without_skill/run-1/outputs"
done
```

## Spawn all subagents in one turn

For each scenario in `tests/evals/evals.json`, spawn TWO background subagents in the SAME Agent tool call batch (one with_skill, one without_skill). Use `subagent_type: "general-purpose"` and `run_in_background: true`. System notifications fire automatically as each completes.

### with_skill prompt template

```
You are evaluating the linear-editing Claude skill.

INSTRUCTIONS:
1. Read the skill at {ABSOLUTE_REPO_PATH}/skill/{SKILL_NAME}/SKILL.md. The widget template is at {ABSOLUTE_REPO_PATH}/skill/{SKILL_NAME}/assets/widget-bundled.html - read it if the skill tells you to.
2. Decide objectively whether the skill should activate for the task below, using the activation rules in SKILL.md. Don't activate just because you read the file; only activate if the rules clearly indicate this prompt should trigger.
3. If activating: follow the skill's instructions to produce the final widget HTML. The visualize:show_widget tool is NOT available in your environment - instead of calling it, write the FULL filled-in widget HTML to outputs/widget.html. Also write a brief assistant lead-in message to outputs/response.md.
4. If NOT activating: do the task naturally and write your natural response to outputs/response.md. Do not produce widget HTML.

TASK PROMPT:
{PROMPT_FROM_evals.json}

OUTPUT DIRECTORY (already exists):
{ABSOLUTE_REPO_PATH}/{WORKSPACE}/eval-{SCENARIO_ID}/with_skill/run-1/outputs/

ALSO WRITE meta.json at that directory: {"activated": true|false, "reason": "one sentence why"}

Return a one-line summary.
```

### without_skill (baseline) prompt template

```
You are responding to a user prompt as a normal Claude assistant. Do NOT consult any installed skills - in particular, ignore "linear-editing". Respond naturally as if no specialized skill existed.

TASK PROMPT:
{PROMPT_FROM_evals.json}

Write your full response to: {ABSOLUTE_REPO_PATH}/{WORKSPACE}/eval-{SCENARIO_ID}/without_skill/run-1/outputs/response.md

Return a one-line summary.
```

## After all subagents complete

```bash
SKILL_NAME=$(node -p "require('./package.json').name.replace(/^claude-skill-/, '')")
pnpm eval:grade "${SKILL_NAME}-workspace/iteration-1"
pnpm eval:preview "${SKILL_NAME}-workspace/iteration-1"
open "${SKILL_NAME}-workspace/iteration-1/eval-preview.html"
```

The preview page renders each widget visually with claude.ai design-system fallbacks, shows the grading per assertion, and lets the user leave per-scenario feedback that copies to clipboard as a JSON payload.

<!--
PLACEHOLDER: as you accumulate iterations, document baseline scores here
so future iterations have something to compare against. Example shape:

## Iteration 1 baseline (skill v0.x.0)

- with_skill: X/Y assertions passed (Z%)
- without_skill: A/B (C%)
- delta: +D percentage points

Notes on what worked, what regressed, hypotheses for next iteration.
-->
