#!/usr/bin/env bash
#
# download-logs.sh — Download logs for an Antithesis run via snouty
# and (optionally) annotate them with active-faults metadata.
#
# Usage:
#   download-logs.sh -o PATH [--raw] \
#                    [--begin-vtime VT [--begin-input-hash IH]] \
#                    RUN_ID INPUT_HASH VTIME
#
# Calls `snouty runs --json logs RUN_ID INPUT_HASH VTIME`, which streams
# events as NDJSON. The script slurps the stream into a JSON array and
# pipes it through process-logs.py, which strips ANSI escapes, adds
# vtime_seconds, and annotates each event with currently-active fault
# windows. Pass --raw to skip annotation and write the unmodified NDJSON.
#
# Requires: snouty, jq, python3.
#
# Optional --begin-vtime / --begin-input-hash anchor the stream start at a
# specific earlier moment instead of the beginning of the run. They are not
# needed for pagination — snouty stitches pages internally.
#
# Long-history fallback: if the one-shot `snouty runs logs` fetch times out
# (stderr contains "operation timed out"), this script falls back to
# `download-logs-chunked.py` next to it, which walks backward in adaptive
# vtime windows and stitches the chunks together. The fallback is
# transparent — the same -o path receives the assembled NDJSON. If the
# caller passed --begin-vtime, the chunked walk uses it as the floor.
#
# Exit codes:
#   0  success
#   3  download or processing error
#   4  usage error

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROCESS_LOGS="${SCRIPT_DIR}/process-logs.py"

usage() {
  sed -n '3,/^$/p' "${BASH_SOURCE[0]}" | sed 's/^#\s\?//' >&2
  exit 4
}

OUTPUT=""
RAW=0
BEGIN_VTIME=""
BEGIN_INPUT_HASH=""
POSITIONAL=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    -o|--output)         OUTPUT="$2"; shift 2 ;;
    --raw)               RAW=1; shift ;;
    --begin-vtime)       BEGIN_VTIME="$2"; shift 2 ;;
    --begin-input-hash)  BEGIN_INPUT_HASH="$2"; shift 2 ;;
    -h|--help)           usage ;;
    --)                  shift; while [[ $# -gt 0 ]]; do POSITIONAL+=("$1"); shift; done ;;
    -[!0-9]*)            echo "Error: unknown option: $1" >&2; usage ;;
    *)                   POSITIONAL+=("$1"); shift ;;
  esac
done

[[ -z "$OUTPUT" ]] && { echo "Error: -o/--output is required" >&2; usage; }
[[ ${#POSITIONAL[@]} -ne 3 ]] && { echo "Error: need RUN_ID INPUT_HASH VTIME (got ${#POSITIONAL[@]} positional args)" >&2; usage; }

RUN_ID="${POSITIONAL[0]}"
INPUT_HASH="${POSITIONAL[1]}"
VTIME="${POSITIONAL[2]}"

for tool in snouty jq python3; do
  command -v "$tool" >/dev/null 2>&1 || { echo "Error: $tool not found in PATH" >&2; exit 4; }
done

if [[ -z "$BEGIN_VTIME" && -n "$BEGIN_INPUT_HASH" ]]; then
  echo "Error: --begin-input-hash requires --begin-vtime" >&2
  exit 4
fi

mkdir -p "$(dirname "$OUTPUT")"

TMP_NDJSON=$(mktemp)
TMP_JSON=$(mktemp)
TMP_STDERR=$(mktemp)
cleanup() { rm -f "$TMP_NDJSON" "$TMP_JSON" "$TMP_STDERR"; }
trap cleanup EXIT

CMD=(snouty runs --json logs "$RUN_ID" "$INPUT_HASH" "$VTIME")
[[ -n "$BEGIN_VTIME" ]]      && CMD+=(--begin-vtime "$BEGIN_VTIME")
[[ -n "$BEGIN_INPUT_HASH" ]] && CMD+=(--begin-input-hash "$BEGIN_INPUT_HASH")

CHUNKED_HELPER="${SCRIPT_DIR}/download-logs-chunked.py"

echo "Running: ${CMD[*]}" >&2
if ! "${CMD[@]}" > "$TMP_NDJSON" 2> "$TMP_STDERR"; then
  # Reproduce snouty's stderr for visibility.
  cat "$TMP_STDERR" >&2
  if grep -qiE "operation timed out|timed out" "$TMP_STDERR"; then
    echo "snouty timed out — falling back to chunked download via $(basename "$CHUNKED_HELPER")" >&2
    HELPER_ARGS=(-o "$TMP_NDJSON" "$RUN_ID" "$INPUT_HASH" "$VTIME")
    [[ -n "$BEGIN_VTIME" ]] && HELPER_ARGS+=(--begin-vtime "$BEGIN_VTIME")
    if ! python3 "$CHUNKED_HELPER" "${HELPER_ARGS[@]}"; then
      echo "Error: chunked download failed" >&2
      exit 3
    fi
  else
    echo "Error: snouty command failed" >&2
    exit 3
  fi
fi

if [[ ! -s "$TMP_NDJSON" ]]; then
  echo "Error: snouty returned no output" >&2
  exit 3
fi

if [[ "$RAW" -eq 1 ]]; then
  mv "$TMP_NDJSON" "$OUTPUT"
else
  if ! jq -s '.' "$TMP_NDJSON" > "$TMP_JSON"; then
    echo "Error: failed to assemble NDJSON into JSON array" >&2
    exit 3
  fi
  if ! python3 "$PROCESS_LOGS" "$TMP_JSON" -o "$OUTPUT"; then
    echo "Error: process-logs.py failed" >&2
    exit 3
  fi
fi

echo "Wrote: $OUTPUT" >&2
