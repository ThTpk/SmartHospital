#!/usr/bin/env sh
# Render the four interactive swimlanes with Archify (https://github.com/tt-a1i/archify).
#   sh tools/archify/build.sh            # needs the archify skill at ~/.claude/skills/archify
#   ARCHIFY=/path/to/archify sh tools/archify/build.sh
set -e
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ARCHIFY="${ARCHIFY:-$HOME/.claude/skills/archify}"
for name in opd opd-specialty surgery-admit er-ipd; do
  node "$ARCHIFY/bin/archify.mjs" deliver workflow \
    "$ROOT/tools/archify/swimlane-$name.workflow.json" \
    "$ROOT/web/diagrams/swimlane-$name.html" --quality showcase
done
