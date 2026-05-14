#!/usr/bin/env bash
#
# download-mvd-log.sh — Download the events log from a Multiverse Debugger
# (MVD) report page via agent-browser, then (optionally) annotate it with
# active-faults metadata using process-logs.py.
#
# Usage:
#   download-mvd-log.sh --url <DEBUG_URL> -o PATH [--format json|txt|csv] [--raw]
#
# Defaults: --format json. Annotation is applied for json output unless --raw
# is passed. txt and csv outputs are written verbatim.
#
# Requires: agent-browser, jq, python3 (for json post-processing).
#
# The script:
#   1. Opens the debugging-session URL with shared antithesis auth.
#   2. Verifies the URL is on a /debugging-session/... path.
#   3. Injects assets/antithesis-debug.js, calls
#      window.__antithesisDebug.simplified.prepareLogDownload(format) to
#      locate the events.<fmt> anchor, force the shadow-root menu visible,
#      and tag the link.
#   4. Captures the click via `agent-browser download <selector> <tmp>`.
#   5. For json: pipes through process-logs.py to add vtime_seconds and
#      active_faults annotations. For txt/csv or --raw: moves the temp file
#      to OUTPUT verbatim.
#
# Exit codes:
#   0  success
#   2  did not land on a debugging-session page (auth or wrong URL)
#   3  download or processing error
#   4  usage error

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNTIME_JS="${SCRIPT_DIR}/antithesis-debug.js"
# process-logs.py is owned by the antithesis-triage skill; we delegate to its
# copy rather than ship a duplicate. Skills live as siblings under the skills
# root in both the monorepo and the installed layout.
PROCESS_LOGS="${SCRIPT_DIR}/../../antithesis-triage/assets/process-logs.py"

usage() {
  sed -n '3,/^$/p' "${BASH_SOURCE[0]}" | sed 's/^#\s\?//' >&2
  exit 4
}

URL=""
OUTPUT=""
FORMAT="json"
RAW=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --url)         URL="$2"; shift 2 ;;
    -o|--output)   OUTPUT="$2"; shift 2 ;;
    --format)      FORMAT="$2"; shift 2 ;;
    --raw)         RAW=1; shift ;;
    -h|--help)     usage ;;
    *)             echo "Error: unknown option: $1" >&2; usage ;;
  esac
done

[[ -z "$URL" ]] && { echo "Error: --url is required" >&2; usage; }
[[ -z "$OUTPUT" ]] && { echo "Error: -o/--output is required" >&2; usage; }

case "$FORMAT" in
  json|txt|csv) ;;
  *) echo "Error: --format must be json, txt, or csv" >&2; usage ;;
esac

for tool in agent-browser jq python3; do
  command -v "$tool" >/dev/null 2>&1 || { echo "Error: $tool not found in PATH" >&2; exit 4; }
done

mkdir -p "$(dirname "$OUTPUT")"

SESSION="antithesis-debug-dl-$(date +%s)-$$"
TMPFILE=$(mktemp)

cleanup() {
  agent-browser --session "$SESSION" close >/dev/null 2>&1 || true
  rm -f "$TMPFILE"
}
trap cleanup EXIT

# Step 1: open URL with shared auth
echo "Opening MVD URL..." >&2
if ! agent-browser --session "$SESSION" --session-name antithesis open "$URL" >/dev/null 2>&1; then
  echo "Error: failed to open URL" >&2
  exit 3
fi

# Step 2: wait for load, verify we landed on the debug page
agent-browser --session "$SESSION" wait --load networkidle >/dev/null 2>&1 || true
CURRENT_URL=$(agent-browser --session "$SESSION" get url 2>/dev/null || echo "unknown")
if [[ "$CURRENT_URL" != *"/debugging-session/"* ]]; then
  echo "Error: did not land on a debugging-session page (at: $CURRENT_URL)" >&2
  echo "If redirected to a login page, authenticate first using the antithesis-triage skill's setup-auth flow." >&2
  exit 2
fi

# Step 3: inject runtime, wait for ready, prepare the download
echo "Injecting runtime..." >&2
if ! cat "$RUNTIME_JS" | agent-browser --session "$SESSION" eval --stdin >/dev/null 2>&1; then
  echo "Error: failed to inject debug runtime" >&2
  exit 3
fi

echo "Waiting for simplified view to be ready..." >&2
if ! agent-browser --session "$SESSION" eval \
  'window.__antithesisDebug.simplified.waitForReady()' >/dev/null 2>&1; then
  echo "Error: simplified view did not become ready" >&2
  exit 3
fi

echo "Waiting for events log panel to render..." >&2
DEADLINE=$(( $(date +%s) + 30 ))
while :; do
  READY=$(agent-browser --session "$SESSION" eval \
    "window.__antithesisDebug.simplified.eventsLogReady('${FORMAT}')" 2>/dev/null | tail -1)
  [[ "$READY" == "true" ]] && break
  if [[ $(date +%s) -ge $DEADLINE ]]; then
    echo "Error: events log panel did not render within 30s" >&2
    exit 3
  fi
  sleep 1
done

echo "Preparing download (format: $FORMAT)..." >&2
PREPARE_RESULT=$(agent-browser --session "$SESSION" eval \
  "window.__antithesisDebug.simplified.prepareLogDownload('${FORMAT}')" 2>&1)
if echo "$PREPARE_RESULT" | jq -e '.error' >/dev/null 2>&1; then
  ERR=$(echo "$PREPARE_RESULT" | jq -r '.error')
  echo "Error: prepareLogDownload failed: $ERR" >&2
  exit 3
fi

# Step 4: capture the download
echo "Downloading..." >&2
if ! agent-browser --session "$SESSION" download \
  'a.sequence_printer_menu_button[data-mvd-dl]' "$TMPFILE" >/dev/null 2>&1; then
  echo "Error: download failed" >&2
  exit 3
fi
if [[ ! -s "$TMPFILE" ]]; then
  echo "Error: downloaded file is empty" >&2
  exit 3
fi

# Step 5: post-process or move
if [[ "$FORMAT" == "json" && "$RAW" -eq 0 ]]; then
  echo "Annotating logs with vtime_seconds and active_faults..." >&2
  if ! python3 "$PROCESS_LOGS" "$TMPFILE" -o "$OUTPUT"; then
    echo "Error: process-logs.py failed" >&2
    exit 3
  fi
else
  mv "$TMPFILE" "$OUTPUT"
fi

echo "Wrote: $OUTPUT" >&2
