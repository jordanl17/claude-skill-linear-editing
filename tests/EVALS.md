# Testing and eval strategy

Four test surfaces, in order of increasing effort. Pick the right one for the change you're making.

| Surface                            | What it catches                                                                                                                             | When to run                                                                                                | Time    |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------- |
| 1. Vitest unit + integration suite | Widget runtime bugs (script init, event handlers, payload shape), bundle integrity (`type="module"` preservation, slot tokens, size budget) | After editing `widget-src/widget.ts`, `vite.config.ts`, or any build path. Runs automatically on every PR. | ~1 sec  |
| 2. Manual trigger walkthrough      | Whether SKILL.md description fires/skips correctly in real Claude Code                                                                      | After editing the SKILL.md `description:` frontmatter                                                      | ~5 min  |
| 3. Programmatic eval suite         | Skill-specific correctness checks (parsing, slot fill, payload shape) plus trigger precision                                                | After editing SKILL.md body, parsing rules, or anything in `widget-src/`                                   | ~15 min |
| 4. Description optimization        | Trigger-rate tuning across many phrasings                                                                                                   | Once the description is stable enough to optimise                                                          | n/a     |

## Surface 1: Vitest unit + integration suite

Run with `pnpm test`. Three files in [`tests/widget/`](widget/):

- [`bundle.test.ts`](widget/bundle.test.ts) - static checks against the built `widget-bundled.html`: the inlined `<script>` declares `type="module"` (otherwise it runs before the DOM is ready and breaks all event listeners), runtime slot tokens are preserved, build-time tokens are substituted, critical string literals survive terser, bundle stays under 16 KB.
- [`widget.test.ts`](widget/widget.test.ts) - jsdom-based runtime checks: loads the bundle into Vitest's jsdom, runs the inlined script via `new Function()` (because jsdom does not execute `<script type="module">` natively), then exercises interactions and verifies `sendPrompt` is called with the right payload.
- [`render.test.ts`](widget/render.test.ts) - exercises `render.py` directly via `spawnSync`. Happy path fills both slots; missing required slot and invalid JSON both exit non-zero with a clear stderr message.

The widget template now uses Mustache markers (`{{title}}`, `{{prompt}}`) instead of model-substituted placeholders. `render.py` does the substitution deterministically at skill runtime using vendored chevron. `widget.test.ts` invokes `render.py` to produce its test HTML, so the jsdom interaction tests exercise the full template-to-HTML pipeline end-to-end.

This is the layer that catches "the script runs but nothing happens" bugs - exactly what the eval suite (which only grades static HTML) cannot.

Run on every PR via `.github/workflows/build.yml`. Also runs in the release workflow before the zip step, so a broken bundle cannot reach a release.

## Surface 2: Manual trigger walkthrough

The checklist lives at [`tests/trigger-cases.md`](trigger-cases.md). Prompts you type into a fresh Claude Code session in an unrelated directory. Activate-or-skip decisions are observable in CC's output (does it read `SKILL.md`, reference `assets/widget-bundled.html`, attempt `show_widget`?).

Use this as a quick sanity check whenever you touch the description.

## Surface 3: Programmatic eval suite

Scaffold lives in [`tests/evals/`](evals/). Each iteration:

1. **Pick an iteration number** (last one is in `linear-editing-workspace/iteration-N`).
2. **Read [`tests/evals/orchestrator.md`](evals/orchestrator.md).** It has the setup commands and the two prompt templates (with_skill + baseline). A Claude Code agent spawns N background subagents in one Agent-tool batch and the system notifies on each completion.
3. **Grade** when all subagent runs are done:
   ```bash
   pnpm eval:grade linear-editing-workspace/iteration-N
   ```
   Writes `grading.json` per run with `{expectations: [...], summary: {pass_rate, ...}}`. Each assertion is programmatic (regex/string match against the widget HTML or response text).
4. **Build a visual review:**
   ```bash
   pnpm eval:preview linear-editing-workspace/iteration-N
   open linear-editing-workspace/iteration-N/eval-preview.html
   ```
   Shows each widget rendered inline with design-system fallbacks, alongside the grading. Per-scenario feedback textareas auto-save to localStorage; "Copy feedback JSON" sticky button exports the payload.

<!--
PLACEHOLDER: the scenario inventory in tests/evals/evals.json.

Pick 6-10 scenarios spanning the surface area worth grading. Common
clusters:
- Trigger precision (3): scenarios that should fire and that should skip
- Content correctness (2-3): the widget renders the right shape
- Payload encoding (1-2): the payload back to Claude is well-formed
- Edge cases (1-2): boundary inputs that stretch the parsing rules
-->

### Editing the widget sources

The widget ships as `skill/<skill-name>/assets/widget-bundled.html` (a single file with CSS and JS inlined). The split sources live outside the skill folder at `widget-src/` (`widget.html`, `widget.css`, `widget.ts`, `globals.d.ts`) so they don't bloat the distributed zip. After editing any source, regenerate the bundle:

```bash
pnpm install      # first time only
pnpm type-check   # optional, recommended after TS edits
pnpm build
```

`pnpm build` runs Vite (`vite.config.ts`), which transpiles the TypeScript via esbuild, minifies the CSS with lightningcss and the JS with terser, then inlines everything into a single HTML file via `vite-plugin-singlefile`. `scripts/build-zip.sh` invokes the build automatically before zipping locally, and the release workflow runs it before producing the GitHub release zip - so the released artifact always reflects the latest source.

You can also run `pnpm dev` to open the widget in a local browser for visual smoke testing (note: the `Apply` button calls `sendPrompt`, which is only defined inside the claude.ai/Desktop host - it will error in local dev).

## Surface 4: Description optimization

<!--
PLACEHOLDER: notes on whether the description optimizer (skill-creator's
run_loop.py) works for this skill.

The optimizer uses `claude -p`, which cannot invoke
visualize:show_widget. Widget-based skills often see recall=0% because
the model rationally refuses to invoke a skill whose primary tool is
unavailable. Either stub show_widget in the optimizer harness, or use
Surface 1 / Surface 2 as proxies for trigger precision.
-->

## Workspace hygiene

`linear-editing-workspace/` is gitignored. It holds:

- per-iteration eval results (`iteration-N/`)
- snapshot copies of the skill (`skill-snapshot-iter-N/`)
- the eval-preview.html that `build_preview.ts` writes

Nothing in this directory needs to be committed. The scaffolding in `tests/evals/` is what's reproducible.
