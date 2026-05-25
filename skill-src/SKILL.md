---
name: linear-editing
description: '[TEMPLATE - REPLACE BEFORE USE] Starter scaffold for widget-based Claude skills. The description here will not match any real user request and will not activate. Replace it and the body before publishing.'
---

# Linear editing (template)

> Template skill. The description above prevents activation. Replace this file before use.

<!--
Description is the critical field. Claude uses it to decide activation.
Write both sides: phrasings that trigger, phrasings that do not. End with
"Do not trigger when...". 150-300 words; truncated at 1,536 chars.

Body order: activation, content rules, rendering, response loop,
disqualifiers.
-->

## When to activate

<!--
Describe the signals that should fire the skill. Two-to-three intent paths
is typical. Always include an ambiguity boundary: which adjacent cases
look like activations but should not trigger? Be specific.

Common shapes:
- Intent-based + retroactive: explicit request AND retro mark-up of
  existing output ("let me give feedback on what you just wrote")
- Direct + comparative: explicit walkthrough ("walk me through choosing
  X") AND multi-criteria weighing ("help me weigh A vs B vs C")
-->

## Content rules

<!--
How does Claude turn the user's request into the widget's data shape?
Include preservation rules and schema constraints.

Skills that preserve user content need this section tight - models
default to "improving" prose unless told otherwise.

Omit this section if your skill generates fresh content with no
preservation contract.
-->

## Rendering

Construct a JSON payload matching this schema:

{{SCHEMA}}

Render the widget:

```
echo '<json>' | python3 ${CLAUDE_SKILL_DIR}/scripts/render.py
```

Pipe stdout to `visualize:show_widget` as `widget_code`.

Call shape for visualize:show_widget:

- `title`: `linear_editing_{short-descriptor}`
- `loading_messages`: 3-4 short messages
- `widget_code`: the script's stdout

Write one short lead line before the widget. Never duplicate the widget content in surrounding prose.

## The response loop

When the widget calls `sendPrompt`, it sends `Template widget response: {user text}`.

<!--
Describe your payload format and how Claude should respond:
- Payload shape (one line per action? JSON in a code block?)
- Map from payload to response (apply edits + re-render? answer the
  question? produce a follow-up artifact?)
- The brief assistant message that accompanies the next render

-->

## When NOT to render

<!--
Explicit disqualifiers. List cases that should never trigger the widget
even if the language is borderline. Be specific.

Examples:
- Output is under three paragraphs or fewer than five addressable units
- User asked for plain text or a one-shot answer
- Content is dominated by code blocks or tables
- Single-edit feedback on prior output (handle inline)
-->

## Additional reference

- When extending the widget with sections, conditionals, or new slot shapes, read [references/mustache-syntax.md](references/mustache-syntax.md) for the supported Mustache subset.
- When designing or modifying `assets/schema.json`, read [references/schema-authoring.md](references/schema-authoring.md) for the supported JSON Schema constructs and patterns for repeating items, enums, and nested shapes.
