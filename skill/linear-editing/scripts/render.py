#!/usr/bin/env python3
"""Render the widget template by substituting JSON data via Mustache.

Usage: pipe JSON payload to stdin, e.g.:
    echo '<json-payload>' | python3 render.py
    cat payload.json | python3 render.py

Stdin is used (not argv) so multi-paragraph prose values do not have to
fight shell quoting.

Exit codes: 0 success, 1 invalid JSON or schema violation.
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE / "_vendor"))
import chevron

SKILL_DIR = HERE.parent  # skill/<name>/
TEMPLATE = SKILL_DIR / "assets" / "widget-bundled.html"
SCHEMA = SKILL_DIR / "assets" / "schema.json"


def fail(message):
    print(f"render.py: {message}", file=sys.stderr)
    sys.exit(1)


def check_type(value, expected_type, location):
    type_map = {
        "string": str,
        "object": dict,
        "array": list,
        "number": (int, float),
        "boolean": bool,
        "null": type(None),
    }
    expected = type_map.get(expected_type)
    if expected is None:
        return
    if not isinstance(value, expected):
        fail(f"{location}: expected {expected_type}, got {type(value).__name__}")


def validate(data, schema, location="root"):
    # Minimal JSON Schema validation: required, type, additionalProperties, enum.
    expected_type = schema.get("type")
    if expected_type:
        check_type(data, expected_type, location)

    if expected_type == "object" and isinstance(data, dict):
        required = schema.get("required", [])
        for key in required:
            if key not in data:
                fail(f"{location}: missing required property '{key}'")

        properties = schema.get("properties", {})
        if schema.get("additionalProperties") is False:
            for key in data:
                if key not in properties:
                    fail(f"{location}: unexpected property '{key}'")

        for key, value in data.items():
            sub_schema = properties.get(key)
            if sub_schema:
                validate(value, sub_schema, f"{location}.{key}")

    if expected_type == "array" and isinstance(data, list):
        item_schema = schema.get("items")
        if item_schema:
            for index, item in enumerate(data):
                validate(item, item_schema, f"{location}[{index}]")

    enum = schema.get("enum")
    if enum is not None and data not in enum:
        fail(f"{location}: value not in enum {enum}")


def main():
    raw = sys.stdin.read()
    if not raw.strip():
        fail("usage: pipe a JSON payload to render.py via stdin")
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as error:
        fail(f"invalid JSON: {error}")

    schema = json.loads(SCHEMA.read_text())
    validate(data, schema)

    template = TEMPLATE.read_text()
    sys.stdout.write(chevron.render(template, data))


if __name__ == "__main__":
    main()
