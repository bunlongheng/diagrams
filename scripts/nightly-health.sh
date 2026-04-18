#!/usr/bin/env zsh
# ── Nightly Health Check for Production Apps ──────────────────────────────────
# Runs against: Diagrams, Mindmaps, Stickies
# Tokens auto-loaded from ~/.zshenv
# Posts a sticky alert on failure; silent on success.
# Usage: ./scripts/nightly-health.sh
# Schedule via launchd — see scripts/com.bheng.nightly-health.plist

set -uo pipefail
source ~/.zshenv 2>/dev/null || true

PASS=0
FAIL=0
REPORT=""
DATE=$(date +"%Y-%m-%d %H:%M")

check() {
  local app="$1" endpoint="$2" method="$3" expect="$4"
  shift 4
  local code
  code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 15 "$@" 2>/dev/null || echo "000")
  if [[ "$code" == "$expect" ]]; then
    REPORT+="| $app | $endpoint | $code | PASS |\n"
    ((PASS++))
  else
    REPORT+="| $app | $endpoint | $code (expected $expect) | **FAIL** |\n"
    ((FAIL++))
  fi
}

# ── Diagrams ──────────────────────────────────────────────────────────────────
DIAG="https://diagrams-bheng.vercel.app"

check "Diagrams" "GET /" GET 200 "$DIAG/"
check "Diagrams" "GET /?id=test" GET 200 "$DIAG/?id=test"
check "Diagrams" "POST /api/ai/diagrams" POST 201 \
  -X POST "$DIAG/api/ai/diagrams" \
  -H "Authorization: Bearer $AI_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"title":"Nightly Health Ping","diagramType":"sequence","code":"sequenceDiagram\n  A->>B: ping\n  B-->>A: pong"}'


# ── Mindmaps ──────────────────────────────────────────────────────────────────
MIND="https://mindmaps-bheng.vercel.app"

check "Mindmaps" "GET /" GET 200 "$MIND/"
check "Mindmaps" "POST /api/ai/mindmaps" POST 201 \
  -X POST "$MIND/api/ai/mindmaps" \
  -H "Authorization: Bearer $MINDMAP_AI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"Nightly Health Ping","outline":"Health\n  Check\n    OK","type":"logic-chart"}'

# ── Stickies ──────────────────────────────────────────────────────────────────
STICK="https://stickies-bheng.vercel.app"

check "Stickies" "GET /" GET 200 "$STICK/"
check "Stickies" "POST /api/stickies/ext" POST 201 \
  -X POST "$STICK/api/stickies/ext" \
  -H "Authorization: Bearer $STICKIES_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"nightly health ping — auto-created, safe to delete","title":"Health Ping","tags":"nightly,health","type":"text","path":"/HEALTH"}'

# ── Report ────────────────────────────────────────────────────────────────────
TOTAL=$((PASS + FAIL))
echo ""
echo "── Nightly Health Check — $DATE ──"
echo ""
echo "| App | Endpoint | Status | Result |"
echo "|-----|----------|--------|--------|"
echo -e "$REPORT"
echo ""
echo "Result: $PASS/$TOTAL passed"

if [[ $FAIL -gt 0 ]]; then
  echo ""
  echo "ALERT: $FAIL check(s) failed — posting sticky..."
  BODY="# Nightly Health Check FAILED\n\n"
  BODY+="**Date:** $DATE\n"
  BODY+="**Result:** $PASS/$TOTAL passed, $FAIL failed\n\n"
  BODY+="| App | Endpoint | Status | Result |\n"
  BODY+="|-----|----------|--------|--------|\n"
  BODY+="$REPORT\n"
  echo -e "$BODY" | stickies \
    --title="Nightly Health FAILED — $(date +%Y-%m-%d)" \
    --tags=nightly,health,alert \
    --type=markdown \
    --path=/HEALTH
  exit 1
else
  echo "All checks passed."
fi
