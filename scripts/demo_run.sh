#!/usr/bin/env bash
# Run a Saathi demo end to end on a laptop (no AWS needed):
#   ring-sandbox emulator -> API (STORAGE=memory) -> seed home -> 14-day routines ->
#   webhook forwarder -> scenario on the demo clock.
#
#   scripts/demo_run.sh fall_day            # leaves everything running; Ctrl-C to stop
#   scripts/demo_run.sh night_door --exit   # stop once the scenario has played
#   scripts/demo_run.sh normal_day --speed 1200
#
# Scenarios: normal_day, fall_day, night_door, scam_visitor. Uses sandbox/scenarios/<name>.yml
# when it exists, else the placeholder in scripts/fallback_scenarios/.
set -euo pipefail

SCENARIO="${1:-}"
shift || true
SPEED=600
EXIT_AFTER=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --speed) SPEED="$2"; shift 2 ;;
    --exit) EXIT_AFTER=true; shift ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done
if [[ -z "$SCENARIO" ]]; then
  echo "usage: scripts/demo_run.sh <normal_day|fall_day|night_door|scam_visitor> [--speed N] [--exit]" >&2
  exit 2
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
[[ -f .venv/bin/activate ]] && source .venv/bin/activate

export STORAGE=memory DEMO_MODE=true
# The API refuses to start without a webhook key; .env (from .env.example) normally sets one.
export RING_WEBHOOK_HMAC_KEY="${RING_WEBHOOK_HMAC_KEY:-$(python -c 'from backend.common.config import get_settings; print(get_settings().ring_webhook_hmac_key or "local-demo-key")')}"
export RING_API_BASE="${RING_API_BASE:-http://localhost:8787}"
API="${PUBLIC_BASE_URL:-http://localhost:8000}"
API_PORT="${API##*:}"
RING_PORT="${RING_API_BASE##*:}"
LOGS=.data/logs
mkdir -p "$LOGS"

SCENARIO_FILE="sandbox/scenarios/${SCENARIO}.yml"
[[ -f "$SCENARIO_FILE" ]] || SCENARIO_FILE="scripts/fallback_scenarios/${SCENARIO}.yml"
[[ -f "$SCENARIO_FILE" ]] || { echo "no scenario file for '$SCENARIO'" >&2; exit 2; }

port_busy() {  # port, health url; lsof where it exists (macOS/Linux), else ask the server
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
  else
    curl -fsS --max-time 2 "$2" >/dev/null 2>&1
  fi
}
for check in "$API_PORT $API/health" "$RING_PORT $RING_API_BASE/_sandbox/health"; do
  # shellcheck disable=SC2086
  if port_busy $check; then
    echo "port ${check%% *} is already in use; stop the other process first" >&2
    exit 1
  fi
done

PIDS=()
cleanup() {  # stop the servers and wait so the ports are free when we return
  for pid in "${PIDS[@]:-}"; do [[ -n "$pid" ]] && kill "$pid" 2>/dev/null || true; done
  for pid in "${PIDS[@]:-}"; do [[ -n "$pid" ]] && wait "$pid" 2>/dev/null || true; done
}
trap cleanup EXIT INT TERM

wait_for() {  # url, name
  for _ in $(seq 1 60); do
    curl -fsS "$1" >/dev/null 2>&1 && return 0
    sleep 0.25
  done
  echo "$2 did not start; see $LOGS" >&2
  exit 1
}

echo "1/6 Ring emulator on :$RING_PORT"
ring-sandbox serve --port "$RING_PORT" >"$LOGS/emulator.log" 2>&1 &
PIDS+=($!)
wait_for "$RING_API_BASE/_sandbox/health" "ring-sandbox"

echo "2/6 Saathi API on :$API_PORT"
uvicorn backend.api.main:app --port "$API_PORT" >"$LOGS/api.log" 2>&1 &
PIDS+=($!)
wait_for "$API/health" "API"

echo "3/6 14 days of routine"
ROUTINES=sandbox/fixtures/routines_home-demo-1.json
if [[ ! -f "$ROUTINES" ]]; then
  ROUTINES=.data/routines_home-demo-1.json
  python scripts/make_demo_routines.py --out "$ROUTINES" >/dev/null
fi
echo "    $ROUTINES"

echo "4/6 Seed home-demo-1 from the Ring device list"
# Put the demo clock on the story's start *before* the home exists: a scheduler tick on the
# real clock (e.g. 22:30) would otherwise see "nothing today" and open a false late start.
START="$(python -c 'import sys, yaml; print(yaml.safe_load(open(sys.argv[1])).get("story_start") or "00:00")' "$SCENARIO_FILE")"
curl -fsS -X POST "$API/_dev/clock" -H 'content-type: application/json' -d "{\"local\": \"$START\"}" >/dev/null
python scripts/seed_home.py --api "$API" --routines "$ROUTINES" \
  | python -c 'import json,sys; r=json.load(sys.stdin); print("    zones:", sorted(set(r["home"]["devices"].values())), "| routines loaded:", r["routines_loaded"])'

echo "5/6 Forward emulator webhooks to the API"
KEY="$(python -c 'from backend.common.config import get_settings; print(get_settings().ring_webhook_hmac_key)')"
ring-sandbox webhook "$API/webhooks/ring" --url "$RING_API_BASE" --key "$KEY" >/dev/null

echo "6/6 Play $SCENARIO_FILE at ${SPEED}x"
python scripts/demo_driver.py "$SCENARIO_FILE" --api "$API" --ring "$RING_API_BASE" --speed "$SPEED"

echo
case "$SCENARIO" in
  fall_day)
    echo "Watch: status turns yellow (SUSPECT), ~10 s later NUDGE_PARENT (parent app speaks, $API/homes/home-demo-1/nudge),"
    echo "       ~15 s later ALERT_FAMILY (Telegram to the family chat; red on the dashboard), then ALERT_NEIGHBOUR."
    echo "       Press \"I'm checking\" in Telegram, or:"
    echo "       curl -X POST $API/alerts/<alert_id>/ack -H 'content-type: application/json' -d '{\"by\":\"family\",\"name\":\"Priya\"}'" ;;
  night_door)
    echo "Watch: a night_activity alert (\"Front door opened at 02:10\") climbs the same ladder." ;;
  scam_visitor)
    echo "Watch: the 11:30 doorbell event on $API/homes/home-demo-1/timeline gets a snapshot_url and a visitor description." ;;
  normal_day)
    echo "Watch: status stays green all day; the 21:00 tick writes the evening digest ($API/homes/home-demo-1/digest)." ;;
esac
echo "Logs: $LOGS/api.log, $LOGS/emulator.log"

if [[ "$EXIT_AFTER" == true ]]; then
  exit 0
fi
echo "Running. Ctrl-C to stop."
wait
