---
name: linear-editing
description: Render Linear issues as an interactive inline editor for review and edit before saving. Works for fresh drafts AND substantive edits to existing issues (title and/or description). A freeform prompt field captures next-turn instructions. Use when the user wants to draft new Linear issues OR rewrite the title or description of an existing issue inline, including phrases like "draft a Linear issue", "queue up Linear tickets so I can edit", "look at SAPP-1234 and let's edit the description", or "rewrite the description of X". The widget IS the editing surface; do not draft the content as Markdown prose first. Do not trigger for read-only queries (list, search, assign, comment). Do not trigger for single-field swaps ("change the title to X"); apply those inline. Do not trigger for one-shot create-and-save with no review step.
---

# Linear issue editor

Renders Linear issues as an interactive inline editor. The user reviews and edits the title and description for each issue, optionally discards individual fresh drafts, and writes a freeform instruction for the next turn before hitting Proceed. Works for both fresh drafts and substantive edits to existing issues.

## When to activate

Two activation paths.

**Fresh drafts.** The user wants to compose one or more new Linear issues and refine them inline before they get saved. Typical phrasings:

> "Draft three issues for the telemetry audit and let me tweak them."
> "Set up Linear issues for the spike and the API gap fix, I want to edit before you save them."
> "Queue up these tickets so I can review."

**Edits to existing issues.** The user wants to substantively rewrite the title and/or description of an existing Linear issue (or several). Typical phrasings:

> "Look at SAPP-1234 and let's edit the description to make the out-of-scope clearer."
> "Rewrite the description of SAPP-2104 to drop the alpha context and tighten the rollout plan."
> "Open SAPP-1234 and SAPP-5678 so I can rework them in one go."

Single-issue activations are valid on both paths. The chip navigation collapses to nothing; the form stands alone.

Once activated, render the widget instead of drafting or quoting the content as Markdown prose. The widget is the preview.

### When NOT to activate

- The user wants to read, search, list, comment on, assign, or change status on existing Linear issues. Use the Linear MCP tools directly.
- The user wants a one-shot save with no review step ("just create a Linear issue titled X and save it now").
- The user wants a single-field swap on an existing issue ("change the title to X", "set the priority to high"). Apply those inline with the appropriate Linear MCP call.

## Content rules

For fresh drafts, construct one issue per concrete piece of work. Each draft must be standalone-meaningful so the user can judge it on its own.

For existing-issue edits, fetch the current title and description first via `mcp__linear__get_issue` and pre-populate the payload with the live values. Set `linear_id` to the Linear identifier (e.g. `SAPP-3596`) so the widget can show the "editing <id>" badge, hide the Discard button, and so the Proceed payload tags the issue as UPDATE.

Schema notes:

- `topic`: short label for the batch (2-6 words, no trailing period). Appears in the widget header and the proceed payload.
- `submit_instruction`: fallback action when the user hits Proceed without typing into the prompt field. Be concrete. For fresh drafts: "Save these to Linear in the SAPP team." For edits: "Update each existing Linear issue with the edited content." A vague "do something with these" defeats the purpose.
- `issues[].id`: stable kebab-case identifier, unique within the payload. Used by the widget for per-issue state. NOT the Linear ID.
- `issues[].linear_id`: optional Linear issue identifier when editing an existing issue. Omit for fresh drafts.
- `issues[].title`: short imperative title. For existing issues, the current Linear title (the user will tweak it).
- `issues[].description`: full Markdown body with real newlines. For existing issues, the current Linear description verbatim.

Mixed batches (some fresh, some existing) are allowed. The widget renders Discard only on fresh-draft rows and UPDATE-tags only the existing-issue rows in the Proceed payload.

## Rendering

Construct a JSON payload matching this schema:

{{SCHEMA}}

Pipe the JSON to `render.py` via stdin:

```
echo '<json>' | python3 ${CLAUDE_SKILL_DIR}/scripts/render.py
```

Pass stdout to `visualize:show_widget` as `widget_code`.

Call shape for `visualize:show_widget`:

- `title`: `linear_issues_{topic-slug}` (e.g. `linear_issues_telemetry_audit`, `linear_issues_sapp_1234_scope_rewrite`)
- `loading_messages`: 3-4 short messages such as "Fetching from Linear", "Laying out the editor", "Ready to edit"
- `widget_code`: the script's stdout

Write a single short lead-in line before the widget (for example, "Three drafts below, edit any field and hit Proceed." or "Loaded SAPP-1234, edit and Proceed."). Do not duplicate the widget's content in surrounding prose.

## The response loop

When the user hits Proceed, the widget sends a structured payload back via `sendPrompt`. The payload has three blocks:

1. **The authoritative content.** Every issue's final title and description, each annotated with one of three inclusion tags:
   - `INCLUDED` - a fresh draft to create.
   - `UPDATE <linear_id>` - an existing Linear issue to update.
   - `DISCARDED` - a fresh draft the user dropped.
     Each row is also annotated `edited by user` or `unchanged from your draft`.
2. **The user's prompt for the next turn** (optional). The freeform instruction describing what to do.
3. **The `submit_instruction` fallback** baked in at render time.

### How to combine the three

- **Edits are content.** The title and description in the payload are what the user wants, full stop. Do not merge with earlier draft text or partially apply.
- **Prompt is action.** It tells you what to do WITH that content. Apply it on top of the edited content, not instead of it.
- **No prompt means fallback.** When the prompt is empty, follow `submit_instruction`.

### How to handle the three inclusion tags

- `INCLUDED` - fresh draft. Call `mcp__linear__save_issue` to create a new Linear issue with the payload's title and description.
- `UPDATE <linear_id>` - existing issue. Call `mcp__linear__save_issue` against `<linear_id>` with the payload's title and description. Do NOT create a new issue.
- `DISCARDED` - fresh draft the user dropped. Do not create it. Its content stays in the payload only so the user's prompt can reference it ("combine the discarded one into issue 3", "use issue 2's notes as context for issue 1"). If the prompt does not reference it, ignore its content.

### Four cases the receiving turn must handle

1. **Edits + prompt.** Apply the prompt to the edited content.
2. **Edits, no prompt.** Follow `submit_instruction` using the edited content.
3. **No edits, prompt.** Apply the prompt to the original content (the user accepted the live values but had a separate instruction).
4. **No edits, no prompt.** Follow `submit_instruction` using the original content. The user reviewed and accepted.

### Before the save_issue tool call

When the resolved action involves writing to Linear (create or update), preview the final titles and descriptions back in chat one more time before invoking `mcp__linear__save_issue`. The user wants to see exactly what will land in Linear.

## Additional reference

- When extending the widget with sections, conditionals, or new slot shapes, read [references/mustache-syntax.md](references/mustache-syntax.md) for the supported Mustache subset.
- When designing or modifying `assets/schema.json`, read [references/schema-authoring.md](references/schema-authoring.md) for the supported JSON Schema constructs and patterns for repeating items, enums, and nested shapes.
