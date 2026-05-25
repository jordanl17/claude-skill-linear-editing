# Schema authoring guide

`assets/schema.json` is the contract between Claude and `render.py`. Claude constructs a JSON payload matching this schema; render.py validates the payload at runtime and rejects with a clear error if anything is wrong.

The schema follows JSON Schema draft-07. render.py supports a focused subset of the spec - enough for typical widget shapes, no more.

## Supported constructs

| Construct              | Purpose                                                   | Example                                          |
| ---------------------- | --------------------------------------------------------- | ------------------------------------------------ |
| `type`                 | Constrain to a primitive or container                     | `"type": "string"`, `"type": "object"`           |
| `required`             | List keys that must appear in an object                   | `"required": ["title", "prompt"]`                |
| `properties`           | Describe each key in an object                            | `"properties": { "title": { "type": "string" }}` |
| `additionalProperties` | Reject unexpected keys when set to `false`                | `"additionalProperties": false`                  |
| `items`                | Describe each entry in an array                           | `"items": { "type": "object", ... }`             |
| `enum`                 | Limit a value to a fixed set                              | `"enum": ["plain", "numbered", "bulleted"]`      |
| `description`          | Hint for Claude (appears in the schema block in SKILL.md) | `"description": "3-6 words, no trailing period"` |

Other JSON Schema features (`pattern`, `minLength`, `oneOf`, `$ref`, etc.) are not validated by render.py. If you need them, extend render.py's validator.

## Writing descriptions for Claude

The `description` field appears in the rendered schema block embedded in SKILL.md. Claude reads it when constructing the payload. Write descriptions like prompts - specific, concrete, with constraints that matter.

Good:

```json
{
  "description": "3-6 words. Describes the unit's own content, not its parent. No trailing period."
}
```

Vague:

```json
{ "description": "The unit identifier." }
```

## Patterns

### Required string with format hint

```json
{
  "title": {
    "type": "string",
    "description": "Widget heading. 5-12 words."
  }
}
```

### Optional string

Omit the key from `required`. Claude can leave it out; render.py treats missing optional fields as empty.

### Repeating items

```json
{
  "units": {
    "type": "array",
    "items": {
      "type": "object",
      "required": ["id", "content"],
      "properties": {
        "id": { "type": "string", "description": "Sequential, starting at '1'." },
        "content": { "type": "string", "description": "Verbatim from source." }
      }
    }
  }
}
```

Pair with `{{#units}}...{{/units}}` in `widget.html` to loop.

### Enum for shape choices

```json
{
  "shape": {
    "type": "string",
    "enum": ["plain", "numbered", "bulleted"],
    "description": "Plain for prose, numbered when order matters, bulleted for list semantics."
  }
}
```

Pair with `{{#shape}}...{{/shape}}` for conditional blocks, or use the value as a CSS class fragment.

### Nested structure (sub-items)

```json
{
  "items": {
    "type": "array",
    "items": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "subItems": {
          "type": "array",
          "items": { "type": "object", "properties": { "id": { "type": "string" } } }
        }
      }
    }
  }
}
```

Mustache nests sections naturally:

```mustache
{{#items}}
  <div>{{id}}{{#subItems}}<span>{{id}}</span>{{/subItems}}</div>
{{/items}}
```

## What the schema cannot enforce

The schema is for shape, not semantics. It cannot enforce:

- Strings are byte-identical to a source (preservation rules)
- Sequence rules (no gaps in `id`)
- Cross-field invariants (sub-item ids prefix their parent's id)
- Word counts or formatting rules beyond what `enum` covers

These belong in SKILL.md prose as rules Claude must follow, with optional programmable checks added to render.py if a particular skill needs to enforce them at render time.

## Iteration

When changing the schema:

1. Edit `skill-src/assets/schema.json`
2. Update `skill-src/SKILL.md` if Claude's construction rules need new guidance
3. Update `widget-src/widget.html` to reference any new slots with Mustache syntax
4. Run `pnpm build` - the new schema is injected into the built `SKILL.md`
5. Run `pnpm test` - the render tests catch broken payload shapes
