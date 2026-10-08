#!/bin/sh
# Walk every Kaloko smoke and survival flow. Starts Vite on :5173 when it is down.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$ROOT"

STARTED=0
if ! curl -sf -o /dev/null --max-time 2 http://localhost:5173/; then
  npm run dev --prefix web >/tmp/marooned-vite.log 2>&1 &
  STARTED=$!
  ready=0
  i=0
  while [ "$i" -lt 40 ]; do
    if curl -sf -o /dev/null --max-time 1 http://localhost:5173/; then
      ready=1
      break
    fi
    i=$((i + 1))
    sleep 0.5
  done
  if [ "$ready" -ne 1 ]; then
    echo "Vite did not answer on http://localhost:5173" >&2
    kill "$STARTED" 2>/dev/null || true
    exit 1
  fi
fi

cleanup() {
  if [ "$STARTED" != 0 ]; then
    kill "$STARTED" 2>/dev/null || true
  fi
}
trap cleanup EXIT

fail=0
for f in qa/flows/smoke-*.yml qa/flows/survival-*.yml; do
  [ -f "$f" ] || continue
  echo "── $f"
  if ! npx kaloko start --scenario "$f" --env local; then
    fail=1
    continue
  fi
  if ! npx kaloko walk; then
    fail=1
    continue
  fi
  if ! npx kaloko evaluate; then
    fail=1
  fi
done

exit "$fail"
