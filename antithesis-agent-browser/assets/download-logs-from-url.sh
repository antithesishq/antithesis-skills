#!/usr/bin/env bash
#
# download-logs-from-url.sh — Download an Antithesis log file via
# agent-browser, given a logs page URL.
#
# Usage:
#   download-logs-from-url.sh --url <LOGS_URL> --output <PATH> [--format json|txt|csv]
#
# Creates a fresh browser session with shared antithesis auth, navigates to
# the log URL, and downloads the log file in the requested format. The output
# is written verbatim — no post-processing. If the caller wants vtime/fault
# annotation on a JSON download, pipe the result through
# antithesis-debug/assets/process-logs.py separately.
#
# Exit codes:
#   0  success
#   2  timeout (page or logs failed to load)
#   3  download error
#   4  usage error

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNTIME_JS="${SCRIPT_DIR}/antithesis-agent-browser.js"

URL=""
OUTPUT=""
FORMAT="json"

usage() {
  echo "Usage: download-logs-from-url.sh --url <LOGS_URL> --output <PATH> [--format json|txt|csv]" >&2
  exit 4
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --url)      URL="$2"; shift 2 ;;
    --output)   OUTPUT="$2"; shift 2 ;;
    --format)   FORMAT="$2"; shift 2 ;;
    -h|--help)  usage ;;
    *)          echo "Unknown option: $1" >&2; usage ;;
  esac
done

[[ -z "$URL" ]] && { echo "Error: --url is required" >&2; usage; }
[[ -z "$OUTPUT" ]] && { echo "Error: --output is required" >&2; usage; }

case "$FORMAT" in
  json|txt|csv) ;;
  *) echo "Error: --format must be json, txt, or csv" >&2; usage ;;
esac

# Ensure output directory exists.
mkdir -p "$(dirname "$OUTPUT")"

# Generate a unique session for this download.
SESSION="download-logs-$(date +%s)-$$"
TMPFILE=$(mktemp)

cleanup() {
  agent-browser --session "$SESSION" close >/dev/null 2>&1 || true
  rm -f "$TMPFILE"
}
trap cleanup EXIT

# Step 1: Open the log URL with shared auth.
echo "Opening log URL..." >&2
if ! agent-browser --session "$SESSION" --session-name antithesis open "$URL" >/dev/null 2>&1; then
  echo "Error: failed to open URL" >&2
  exit 3
fi

# Step 2: Wait for the page to settle, then verify we landed on the logs page.
agent-browser --session "$SESSION" wait --load networkidle >/dev/null 2>&1 || true
CURRENT_URL=$(agent-browser --session "$SESSION" get url 2>/dev/null || echo "unknown")
if [[ "$CURRENT_URL" != */search* ]]; then
  echo "Error: did not land on logs page (at: $CURRENT_URL)" >&2
  exit 2
fi

# Step 3: Inject runtime.
echo "Injecting runtime..." >&2
if ! cat "$RUNTIME_JS" | agent-browser --session "$SESSION" eval --stdin >/dev/null 2>&1; then
  echo "Error: failed to inject agent-browser runtime" >&2
  exit 3
fi

# Step 4: Wait for log viewer to be ready.
echo "Waiting for logs to load..." >&2
if ! agent-browser --session "$SESSION" eval \
  "window.__antithesisAgentBrowser.logs.waitForReady()" >/dev/null 2>&1; then
  echo "Error: log viewer did not become ready" >&2
  exit 2
fi

# Step 5: Prepare the download link.
echo "Preparing download ($FORMAT)..." >&2
if ! agent-browser --session "$SESSION" eval \
  "window.__antithesisAgentBrowser.logs.prepareDownload('${FORMAT}', 0)" >/dev/null 2>&1; then
  echo "Error: prepareDownload failed" >&2
  exit 3
fi

# Step 6: Download to a temp file to avoid partial/corrupt output.
echo "Downloading..." >&2
if ! agent-browser --session "$SESSION" download \
  'a.sequence_printer_menu_button[data-ab-dl]' "$TMPFILE" >/dev/null 2>&1; then
  echo "Error: download failed" >&2
  exit 3
fi

if [[ ! -s "$TMPFILE" ]]; then
  echo "Error: downloaded file is empty" >&2
  exit 3
fi

# Step 7: Move to final destination.
mv "$TMPFILE" "$OUTPUT"

echo "Done: $OUTPUT" >&2
