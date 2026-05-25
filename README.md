# linear-editing (Claude skill)

![Claude skill](https://img.shields.io/badge/Claude-skill-c25f3c)
![release](https://img.shields.io/github/v/release/jordanl17/claude-skill-linear-editing?label=release&color=blue)
![downloads](https://img.shields.io/github/downloads/jordanl17/claude-skill-linear-editing/total?label=downloads&color=blue)
![updated](https://img.shields.io/github/release-date/jordanl17/claude-skill-linear-editing?label=updated&color=blue)
![license](https://img.shields.io/github/license/jordanl17/claude-skill-linear-editing?color=blue)

Edit Linear issues inline before they get saved. Ask Claude to draft a batch of new issues or to load an existing one, then tweak the title and description in an interactive widget instead of describing the edits in prose. Hit Proceed and Claude saves what you actually wrote, not its interpretation of your follow-up paragraph.

> [!NOTE]
> The widget renders in claude.ai (web) and Claude Desktop. Claude Code, `claude -p`, and the Anthropic API cannot invoke `visualize:show_widget`, so the skill no-ops there.

## In action

<!-- TODO: add demo GIF at demo/linear-editing.gif (300-500KB, ~800px wide) -->
<p align="center">
  <img src="demo/linear-editing.gif" width="800" alt="Drafting three Linear issues, tweaking titles and descriptions inline, hitting Proceed to save the edited content to Linear" />
</p>

## Why this exists

<!-- TODO: add comparison image at demo/comparison.png (prose back-and-forth vs widget edit) -->
<p align="center">
  <img src="demo/comparison.png" width="800" alt="Prose back-and-forth on the left, linear-editing widget on the right" />
</p>

Drafting Linear issues in chat normally means a round of _"no, the second one - actually tighten the title and drop the third bullet"_, followed by Claude restating its understanding, followed by another correction. The same friction shows up for existing issues: _"in SAPP-1234 the out-of-scope section, can you make it..."_

The linear-editing widget turns the draft into the editing surface. The title is a heading you type into; the description is an auto-resizing Markdown textarea; chips navigate between issues when there are several. Hit Proceed and the edited content goes back to Claude as authoritative, with each issue tagged INCLUDED (create), UPDATE `<linear-id>` (update existing), or DISCARDED (kept for prompt reference only). No mapping prose back onto Claude's mental model of what it wrote.

## When it activates

Two activation paths.

**Fresh drafts.** Ask Claude to compose new Linear issues with a signal that you want to review before they save.

- _"Draft three issues for the telemetry audit and let me tweak them."_
- _"Queue up tickets for the auth migration so I can review."_
- _"Set up these issues, I want to edit before you save."_

**Edits to existing issues.** Ask Claude to substantively rewrite the title and/or description of one or more existing issues. The skill fetches the live content from Linear first, pre-populates the widget, and shows a purple "Editing SAPP-1234" badge so you know you're working against a real issue.

- _"Look at SAPP-1234 and let's edit the description to make the out-of-scope clearer."_
- _"Rewrite the description of SAPP-2104 to drop the alpha context."_
- _"Open SAPP-1234 and SAPP-5678 so I can rework them in one go."_

The skill does not fire on:

- Read-only Linear queries (list, search, assign, comment).
- One-shot create-and-save with no review step (_"just create issue X with body Y and save it"_).
- Single-field swaps on existing issues (_"change the title to X"_, _"set the priority to high"_). Apply those inline with the Linear MCP.

## Install

1. Download [`linear-editing.zip`](https://github.com/jordanl17/claude-skill-linear-editing/releases/latest/download/linear-editing.zip) from the latest release.
2. Open [claude.ai/customize/skills](https://claude.ai/customize/skills) (or navigate via **Customize → Skills** in the left sidebar).
3. Click the **+** button, then **Create Skill** → **Upload a Skill**.
4. Select the `linear-editing.zip` file you downloaded.

The skill appears in your skills list once uploaded. You will also want the Linear MCP server installed in the same workspace so Claude can fetch and save Linear issues; the skill itself only produces the editing surface.

### Build from source

```bash
pnpm install
pnpm build:zip
```

The zip lands at `linear-editing.zip` in the repo root. Upload it the same way.

## Limitations

- **claude.ai and Claude Desktop only.** Claude Code, `claude -p` (headless CLI), and the Anthropic API cannot invoke `visualize:show_widget`, which the skill depends on to render.
- **Linear MCP needed for the save round-trip.** The widget produces the edited content; Claude calls `mcp__linear__save_issue` to create or update. Without the Linear MCP in the workspace, the widget still works but the save step needs you to copy the content out manually.
- **Title and description only.** Priority, assignee, team, labels, status, project, milestone, and parent issue are out of scope - apply those with the Linear MCP directly.
- **Discard only on fresh drafts.** Existing-issue rows hide the Discard button (you cannot "discard" an issue that already exists in Linear) and emit `UPDATE <linear-id>` in the Proceed payload instead of `INCLUDED`.

## License

MIT. See [LICENSE](LICENSE).
