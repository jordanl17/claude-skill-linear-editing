# Mustache syntax reference

The widget template uses Mustache, rendered by `scripts/render.py` (via vendored chevron). This is the subset of Mustache the template engine supports.

## Variable interpolation

`{{name}}` substitutes the value at the matching key in the JSON payload. Values are HTML-escaped by default.

```mustache
<h1>{{title}}</h1>
```

For values that already contain HTML and should not be escaped, use triple braces:

```mustache
<div class="content">{{{rawHtml}}}</div>
```

Default escaping is the safe choice. Use `{{{...}}}` deliberately and only when the value is trusted HTML.

## Array sections (loops)

`{{#items}}...{{/items}}` repeats the inner block once per item in `items`. Inside the section, keys resolve to the current item.

```mustache
{{#units}}
  <div class="unit" data-id="{{id}}">{{content}}</div>
{{/units}}
```

JSON payload:

```json
{
  "units": [
    { "id": "1", "content": "First" },
    { "id": "2", "content": "Second" }
  ]
}
```

Result:

```html
<div class="unit" data-id="1">First</div>
<div class="unit" data-id="2">Second</div>
```

## Inverted sections (render-if-empty)

`{{^items}}...{{/items}}` renders the inner block when `items` is missing, empty, or falsy. Useful for fallbacks.

```mustache
{{#units}}<div>{{content}}</div>{{/units}}
{{^units}}<p class="empty">No units yet.</p>{{/units}}
```

## Conditional rendering via sections

Mustache is logic-less: no `if`/`else`. A section renders when the key is truthy (non-empty array, non-null object, non-empty string, true). Use this pattern for conditional blocks:

```mustache
{{#changed}}<span class="tag">changed</span>{{/changed}}
```

Renders the tag only when `changed` is truthy in the data.

## Nested sections

Sections nest. Inner keys resolve against the inner item first, then outward:

```mustache
{{#sections}}
  {{#heading}}<h2>{{heading}}</h2>{{/heading}}
  {{#units}}
    <div data-id="{{id}}">{{content}}</div>
  {{/units}}
{{/sections}}
```

## Comments

`{{! comment }}` is stripped from the output. Use sparingly.

## What is intentionally NOT supported

- Partials (`{{> name}}`) - keep all template content in `widget.html`
- Lambdas - logic belongs in the data layer or render.py, not the template
- Set delimiters (`{{=<% %>=}}`) - the `{{` `}}` delimiters are fixed
- Dot notation (`{{a.b}}`) - flatten nested values into the data payload instead

For the full Mustache spec see <https://mustache.github.io/mustache.5.html>. The chevron implementation is at <https://github.com/noahmorrison/chevron>.
