#!/usr/bin/env bash
# Run all of Saathi on a laptop, connected: the landing page, the family dashboard and the
# parent app on the real API, plus a demo day through scripts/demo_run.sh (no AWS needed).
#
#   scripts/run_all.sh                       # fall_day; Ctrl-C stops everything
#   scripts/run_all.sh night_door --speed 1200
#
#   landing page   http://localhost:5175
#   dashboard      http://localhost:5173   (VITE_USE_MOCK=false: live from the API)
#   parent app     http://localhost:5174   (VITE_USE_MOCK=false: real nudges)
#   API            http://localhost:8000
#
# Arguments after the scenario go to demo_run.sh. Default scenario: fall_day.
set -euo pipefail

SCENARIO="${1:-fall_day}"
shift || true

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
LOGS=.data/logs
mkdir -p "$LOGS"

# app:port:VITE_USE_MOCK (the landing page calls no API)
APPS=("landing:5175:" "dashboard:5173:false" "parent-app:5174:false")

for spec in "${APPS[@]}"; do
  IFS=: read -r app port _ <<<"$spec"
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "port $port ($app) is already in use; stop the other process first" >&2
    exit 1
  fi
  if [[ ! -d "$app/node_modules" ]]; then
    echo "installing $app"
    npm --prefix "$app" ci --no-audit --no-fund >"$LOGS/$app-install.log" 2>&1
  fi
done

PIDS=()
cleanup() {  # stop the web servers too when the demo stops
  for pid in "${PIDS[@]:-}"; do [[ -n "$pid" ]] && kill "$pid" 2>/dev/null || true; done
  for pid in "${PIDS[@]:-}"; do [[ -n "$pid" ]] && wait "$pid" 2>/dev/null || true; done
}
trap cleanup EXIT INT TERM

for spec in "${APPS[@]}"; do
  IFS=: read -r app port mock <<<"$spec"
  # A variable already in the environment wins over the app's .env files in Vite.
  if [[ -n "$mock" ]]; then
    VITE_USE_MOCK="$mock" npm --prefix "$app" run dev >"$LOGS/$app.log" 2>&1 &
  else
    npm --prefix "$app" run dev >"$LOGS/$app.log" 2>&1 &
  fi
  PIDS+=($!)
  echo "$app on http://localhost:$port (log: $LOGS/$app.log)"
done

echo
scripts/demo_run.sh "$SCENARIO" "$@"
