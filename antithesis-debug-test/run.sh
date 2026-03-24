#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: antithesis-debug-test/run.sh <debugger-url>

Runs a live exploration against an Antithesis debugging session:
1. Opens the debugger URL and verifies the notebook loads
2. Tests read/write round-trips on the editor
3. Lists existing action cells
4. Injects a debug cell, authorizes the action, and reads the result

Requirements:
- agent-browser
- jq
- A debugging-session URL
EOF
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "missing required command: $1" >&2
    exit 1
  fi
}

if [[ $# -ne 1 ]]; then
  usage >&2
  exit 1
fi

require_cmd agent-browser
require_cmd jq

DEBUGGER_URL="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNTIME_JS="$REPO_ROOT/antithesis-debug/assets/antithesis-debug.js"
AUDIT_JS="$SCRIPT_DIR/audit.js"
OUT_DIR="$SCRIPT_DIR/out"
TMP_DIR="$SCRIPT_DIR/tmp"
SESSION="antithesis-debug-test-$(date +%s)-$$"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_JSON="$OUT_DIR/debug-${STAMP}.json"
AUDIT_TAG="__AUDIT_${STAMP}_$$"

mkdir -p "$OUT_DIR"
mkdir -p "$TMP_DIR"
TMP_BASE="$TMP_DIR/debug-${STAMP}-$$"

cleanup() {
  agent-browser --session "$SESSION" close >/dev/null 2>&1 || true
  rm -f "$TMP_DIR"/debug-"${STAMP}"-*
}
trap cleanup EXIT

inject_runtime() {
  cat "$RUNTIME_JS" | agent-browser --session "$SESSION" eval --stdin >/dev/null
}

wait_for_notebook() {
  agent-browser --session "$SESSION" eval \
    "window.__antithesisDebug.notebook.waitForReady()"
}

open_debugger() {
  agent-browser --session "$SESSION" --session-name antithesis open "$DEBUGGER_URL" >/dev/null
  agent-browser --session "$SESSION" wait --load networkidle >/dev/null
  inject_runtime
}

run_audit_phase() {
  local phase="$1"
  {
    printf 'window.__ANTITHESIS_DEBUG_AUDIT_PHASE__ = %s;\n' \
      "$(jq -Rn --arg p "$phase" '$p')"
    printf 'window.__ANTITHESIS_DEBUG_AUDIT_TAG__ = %s;\n' \
      "$(jq -Rn --arg t "$AUDIT_TAG" '$t')"
    cat "$AUDIT_JS"
  } | agent-browser --session "$SESSION" eval --stdin
}

write_json() {
  local path="$1"
  local value="$2"

  printf '%s\n' "$value" > "$path"
}

phase_status() {
  printf '%s\n' "$1" | jq -r 'if .ok then "ok" else "FAIL" end'
}

echo "session: $SESSION" >&2
echo "debugger: $DEBUGGER_URL" >&2
echo "tag: $AUDIT_TAG" >&2

# Phase 1: notebook-load
echo -n "notebook-load: " >&2
open_debugger
wait_for_notebook >/dev/null
LOAD_AUDIT="$(run_audit_phase notebook-load)"
write_json "${TMP_BASE}-load.json" "$LOAD_AUDIT"
echo "$(phase_status "$LOAD_AUDIT")" >&2

# Phase 2: notebook-write (reload for clean state)
echo -n "notebook-write: " >&2
open_debugger
wait_for_notebook >/dev/null
WRITE_AUDIT="$(run_audit_phase notebook-write)"
write_json "${TMP_BASE}-write.json" "$WRITE_AUDIT"
echo "$(phase_status "$WRITE_AUDIT")" >&2

# Phase 3: actions (reload for clean state, then multi-step)
echo -n "actions-list: " >&2
open_debugger
wait_for_notebook >/dev/null
ACTIONS_LIST_AUDIT="$(run_audit_phase actions-list)"
write_json "${TMP_BASE}-actions-list.json" "$ACTIONS_LIST_AUDIT"
echo "$(phase_status "$ACTIONS_LIST_AUDIT")" >&2

echo -n "actions-inject: " >&2
ACTIONS_INJECT_AUDIT="$(run_audit_phase actions-inject)"
write_json "${TMP_BASE}-actions-inject.json" "$ACTIONS_INJECT_AUDIT"
echo "$(phase_status "$ACTIONS_INJECT_AUDIT")" >&2

# Wait for notebook recalculation to render the new cell.
sleep 3

echo -n "actions-settle: " >&2
ACTIONS_SETTLE_AUDIT="$(run_audit_phase actions-settle)"
write_json "${TMP_BASE}-actions-settle.json" "$ACTIONS_SETTLE_AUDIT"
echo "$(phase_status "$ACTIONS_SETTLE_AUDIT")" >&2

echo -n "actions-authorize: " >&2
ACTIONS_AUTH_AUDIT="$(run_audit_phase actions-authorize)"
write_json "${TMP_BASE}-actions-auth.json" "$ACTIONS_AUTH_AUDIT"
echo "$(phase_status "$ACTIONS_AUTH_AUDIT")" >&2

echo -n "actions-result: " >&2
ACTIONS_RESULT_AUDIT="$(run_audit_phase actions-result)"
write_json "${TMP_BASE}-actions-result.json" "$ACTIONS_RESULT_AUDIT"
echo "$(phase_status "$ACTIONS_RESULT_AUDIT")" >&2

echo -n "actions-getresult: " >&2
ACTIONS_GETRESULT_AUDIT="$(run_audit_phase actions-getresult)"
write_json "${TMP_BASE}-actions-getresult.json" "$ACTIONS_GETRESULT_AUDIT"
echo "$(phase_status "$ACTIONS_GETRESULT_AUDIT")" >&2

# Combine results
jq -n \
  --arg url "$DEBUGGER_URL" \
  --arg session "$SESSION" \
  --arg tag "$AUDIT_TAG" \
  --slurpfile load "${TMP_BASE}-load.json" \
  --slurpfile write "${TMP_BASE}-write.json" \
  --slurpfile actions_list "${TMP_BASE}-actions-list.json" \
  --slurpfile actions_inject "${TMP_BASE}-actions-inject.json" \
  --slurpfile actions_settle "${TMP_BASE}-actions-settle.json" \
  --slurpfile actions_auth "${TMP_BASE}-actions-auth.json" \
  --slurpfile actions_result "${TMP_BASE}-actions-result.json" \
  --slurpfile actions_getresult "${TMP_BASE}-actions-getresult.json" \
  '{
    ok: (
      $load[0].ok and
      $write[0].ok and
      $actions_list[0].ok and
      $actions_inject[0].ok and
      $actions_settle[0].ok and
      $actions_auth[0].ok and
      $actions_result[0].ok and
      $actions_getresult[0].ok
    ),
    debuggerUrl: $url,
    session: $session,
    tag: $tag,
    phases: {
      load: $load[0],
      write: $write[0],
      actionsList: $actions_list[0],
      actionsInject: $actions_inject[0],
      actionsSettle: $actions_settle[0],
      actionsAuthorize: $actions_auth[0],
      actionsResult: $actions_result[0],
      actionsGetResult: $actions_getresult[0]
    },
    counts: (
      $load[0].counts +
      $write[0].counts +
      $actions_list[0].counts +
      $actions_settle[0].counts +
      $actions_result[0].counts
    ),
    warnings: (
      $load[0].warnings +
      $write[0].warnings +
      $actions_list[0].warnings +
      $actions_settle[0].warnings +
      $actions_result[0].warnings
    ),
    errors: (
      $load[0].errors +
      $write[0].errors +
      $actions_list[0].errors +
      $actions_inject[0].errors +
      $actions_settle[0].errors +
      $actions_auth[0].errors +
      $actions_result[0].errors +
      $actions_getresult[0].errors
    )
  }' | tee "$OUT_JSON"

echo "saved: $OUT_JSON" >&2
