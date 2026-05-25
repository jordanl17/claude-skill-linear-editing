#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Derive skill name from package.json. Strips claude-skill- prefix.
SKILL_NAME=$(node -p "require('./package.json').name.replace(/^claude-skill-/, '')")

pnpm build

rm -f "${SKILL_NAME}.zip"
(cd skill && zip -rq "../${SKILL_NAME}.zip" "${SKILL_NAME}" -x '*/__pycache__/*' '*.pyc')

echo "Built ${SKILL_NAME}.zip"
unzip -l "${SKILL_NAME}.zip"
