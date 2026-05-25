# Linear editing (Claude skill)

<!--
PLACEHOLDER: README

This README is the front door for users who find the repo from a release page,
the skill picker, or a search result. Answer these questions in order:

1. WHAT does this skill do, in one paragraph?
   Lead with the user benefit, not the mechanism. Picture someone seeing
   only this paragraph - would they know whether the skill is relevant to
   them?

2. WHY does it exist?
   What friction does it remove? A side-by-side comparison image (prose-
   only vs widget) lands well for visual skills.

3. WHEN does it activate?
   Phrase patterns and shape heuristics. Keep the description symmetric:
   what fires it, what does NOT fire it.

4. HOW do I install it?
   - Download the zip from the latest release
   - Open claude.ai/customize/skills, click +, upload the zip
   - (optional) Build-from-source instructions

Other sections to consider:
- A demo GIF in a /demo folder
- Limitations (where it works: claude.ai web, Claude Desktop; where it does
  not: Claude Code, the API)
- License

-->

## What it does

<!-- PLACEHOLDER: one-paragraph description of the user benefit -->

## Why this exists

<!-- PLACEHOLDER: the friction this removes, ideally with a comparison image -->

## When it activates

<!-- PLACEHOLDER: the trigger phrases and the does-not-activate cases -->

## Install

1. Download `linear-editing.zip` from the latest release.
2. Open [claude.ai/customize/skills](https://claude.ai/customize/skills) (or navigate via **Customize → Skills** in the left sidebar).
3. Click the **+** button, then **Create Skill** → **Upload a Skill**.
4. Select the `linear-editing.zip` file you downloaded.

### Build from source

```bash
pnpm install
pnpm build:zip
```

## Limitations

<!--
PLACEHOLDER: where the skill works and where it does not. Boilerplate that
applies to most widget-based skills:

- Not available in Claude Code or the API. The widget renders through
  visualize:show_widget, which is exposed in claude.ai and Claude Desktop
  but not in Claude Code or the Anthropic API.
- Add skill-specific limits here (e.g., nesting depth, structural-edit
  limits, content-type constraints).
-->

## License

MIT. See [LICENSE](LICENSE).
