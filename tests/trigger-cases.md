# Manual trigger walkthrough

Prompts to paste into a fresh Claude Code session running in an unrelated directory after editing the SKILL.md description. For each one, observe whether Claude reads `SKILL.md`, references the bundled widget, and attempts `visualize:show_widget`. That tells you whether the activation decision matches the expected outcome.

The programmatic eval suite (Surface 3) grades the widget _output_ but cannot judge the activation _decision_ in conversational context. Run this checklist whenever you touch the `description:` frontmatter.

## Should fire

### Case 1: Multi-issue draft with edit-before-save

Prompt:

> Draft three Linear issues for the telemetry audit follow-ups: a p99 latency alert, a backfill of missing trace IDs, and a latency dashboard. Let me edit before you save them.

Expected: skill activates, widget renders with three issues, the chip nav row is visible, the first chip is active.

### Case 2: Single-issue draft with edit-before-save

Prompt:

> Draft a Linear issue to track a spike on ingestion lag during deploys, I want to tweak the description before you save it.

Expected: skill activates, widget renders with one issue, no chip nav, no discard button.

### Case 3: Queue-up phrasing without the word "edit"

Prompt:

> Queue up tickets for the auth migration so I can review them: the session token storage change, the middleware swap, and the cookie expiry update.

Expected: skill activates. "Queue up ... so I can review" maps to the edit-before-save intent.

### Case 4: Set-up phrasing for multiple issues

Prompt:

> Set up Linear issues for the spike and the API gap fix, I want to tweak them before you save.

Expected: skill activates with two issues.

## Should skip

### Case 5: One-shot save with explicit title and body

Prompt:

> Just create a Linear issue titled "Bump pnpm to 10.11" with body "Run pnpm install -r and update lockfile" and save it now.

Expected: skill does NOT activate. Claude calls `mcp__linear__save_issue` directly.

### Case 6: Read-only Linear query

Prompt:

> Find me all the open Linear issues assigned to me in the SAPP team.

Expected: skill does NOT activate. Claude uses the Linear MCP query tools.

### Case 7: Single-field edit to an existing issue

Prompt:

> Change the title of SAPP-3596 to "Spike: investigate ingestion lag" please.

Expected: skill does NOT activate. Claude updates the issue in place.

### Case 8: Comment on an existing issue

Prompt:

> Add a comment to SAPP-2104 saying that the rollout is paused until next Tuesday.

Expected: skill does NOT activate. Claude calls `mcp__linear__save_comment`.

## Ambiguous boundary

### Case 9: Draft as Markdown, no widget intent stated

Prompt:

> Write me three Linear issues for the auth migration as Markdown so I can paste them into Linear myself.

Expected: skill should NOT activate. The user asked for Markdown output, not an interactive editor. If it activates, the description needs tightening on the "do not trigger when the user asked for plain text" axis.

### Case 10: One issue but no edit signal

Prompt:

> Create a Linear issue for the ingestion lag spike.

Expected: ambiguous. Either is defensible. Document whichever way the skill actually behaves so the test result becomes unambiguous over time. Current expectation: the skill should NOT activate (the user did not signal a review step). If activation rate is too high on this prompt, the description's "do not trigger when the user wants a one-shot save with no review step" line is the lever.
