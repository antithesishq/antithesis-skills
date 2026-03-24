#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: antithesis-triage-test/run.sh <tenant-id>

Runs a live exploration against:
1. the tenant runs page
2. the most recent completed report
3. one example logs page from that report

Requirements:
- agent-browser
- jq
- existing Antithesis auth in `--session-name antithesis`, or a tokenized report-compatible tenant session
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

TENANT="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNTIME_JS="$REPO_ROOT/antithesis-triage/assets/antithesis-triage.js"
AUDIT_JS="$SCRIPT_DIR/audit.js"
OUT_DIR="$SCRIPT_DIR/out"
TMP_DIR="$SCRIPT_DIR/tmp"
SESSION="antithesis-triage-test-$(date +%s)-$$"
RUNS_URL="https://${TENANT}.antithesis.com/runs"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_JSON="$OUT_DIR/${TENANT}-${STAMP}.json"

mkdir -p "$OUT_DIR"
mkdir -p "$TMP_DIR"
TMP_BASE="$TMP_DIR/${TENANT}-${STAMP}-$$"
RUNS_AUDIT_FILE="${TMP_BASE}-runs.json"
REPORT_CORE_AUDIT_FILE="${TMP_BASE}-report-core.json"
REPORT_PROPERTIES_AUDIT_FILE="${TMP_BASE}-report-properties.json"
REPORT_EXAMPLES_AUDIT_FILE="${TMP_BASE}-report-examples.json"
REPORT_AUDIT_FILE="${TMP_BASE}-report.json"
LOGS_AUDIT_FILE="${TMP_BASE}-logs.json"

cleanup() {
  agent-browser --session "$SESSION" close >/dev/null 2>&1 || true
  rm -f \
    "$RUNS_AUDIT_FILE" \
    "$REPORT_CORE_AUDIT_FILE" \
    "$REPORT_PROPERTIES_AUDIT_FILE" \
    "$REPORT_EXAMPLES_AUDIT_FILE" \
    "$REPORT_AUDIT_FILE" \
    "$LOGS_AUDIT_FILE"
}
trap cleanup EXIT

inject_runtime() {
  cat "$RUNTIME_JS" | agent-browser --session "$SESSION" eval --stdin >/dev/null
}

expected_page_expr() {
  local page="$1"

  case "$page" in
    runs)
      printf '%s\n' "window.location.pathname === '/runs'"
      ;;
    report)
      printf '%s\n' "window.location.pathname.startsWith('/report/')"
      ;;
    logs)
      printf '%s\n' "window.location.pathname === '/search' && new URLSearchParams(window.location.search).has('get_logs')"
      ;;
    *)
      echo "unsupported page type: $page" >&2
      return 1
      ;;
  esac
}

wait_for_expected_page() {
  local page="$1"
  local expr current_url

  expr="$(expected_page_expr "$page")"

  if agent-browser --session "$SESSION" wait --fn "$expr" >/dev/null; then
    return 0
  fi

  current_url="$(agent-browser --session "$SESSION" get url 2>/dev/null || true)"
  echo "timed out waiting for ${page} page; current url: ${current_url:-<empty>}" >&2
  return 1
}

open_page() {
  local url="$1"
  local page="$2"

  agent-browser --session "$SESSION" open "$url" >/dev/null
  wait_for_expected_page "$page"
  inject_runtime
}

run_audit_phase() {
  local phase="$1"
  {
    printf 'window.__ANTITHESIS_TRIAGE_AUDIT_PHASE__ = %s;\n' \
      "$(jq -Rn --arg p "$phase" '$p')"
    cat "$AUDIT_JS"
  } | agent-browser --session "$SESSION" eval --stdin
}

wait_ready() {
  local namespace="$1"
  agent-browser --session "$SESSION" eval \
    "window.__antithesisTriage.${namespace}.waitForReady()"
}

write_json() {
  local path="$1"
  local value="$2"

  printf '%s\n' "$value" > "$path"
}

echo "session: $SESSION" >&2
echo "runs: $RUNS_URL" >&2

agent-browser --session "$SESSION" --session-name antithesis open "$RUNS_URL" >/dev/null
wait_for_expected_page runs
inject_runtime
wait_ready runs >/dev/null
RUNS_AUDIT="$(run_audit_phase runs)"
write_json "$RUNS_AUDIT_FILE" "$RUNS_AUDIT"

LATEST_REPORT_URL="$(
  printf '%s\n' "$RUNS_AUDIT" \
    | jq -r '.discovered.latestCompletedReportUrl // empty'
)"

if [[ -z "$LATEST_REPORT_URL" ]]; then
  jq -n \
    --arg tenant "$TENANT" \
    --arg session "$SESSION" \
    --arg runs_url "$RUNS_URL" \
    --slurpfile runs_audit "$RUNS_AUDIT_FILE" \
    '{
      ok: false,
      tenant: $tenant,
      session: $session,
      runsUrl: $runs_url,
      error: "could not find latest completed report url",
      runsAudit: $runs_audit[0]
    }' | tee "$OUT_JSON"
  exit 1
fi

echo "report: $LATEST_REPORT_URL" >&2

open_page "$LATEST_REPORT_URL" report
wait_ready report >/dev/null
REPORT_CORE_AUDIT="$(run_audit_phase report-core)"
REPORT_PROPERTIES_AUDIT="$(run_audit_phase report-properties)"
write_json "$REPORT_CORE_AUDIT_FILE" "$REPORT_CORE_AUDIT"
write_json "$REPORT_PROPERTIES_AUDIT_FILE" "$REPORT_PROPERTIES_AUDIT"

# Example extraction mutates the report view, so run it from a fresh navigation.
open_page "$LATEST_REPORT_URL" report
wait_ready report >/dev/null
REPORT_EXAMPLES_AUDIT="$(run_audit_phase report-examples)"
write_json "$REPORT_EXAMPLES_AUDIT_FILE" "$REPORT_EXAMPLES_AUDIT"
REPORT_AUDIT="$(
  jq -n \
    --slurpfile core "$REPORT_CORE_AUDIT_FILE" \
    --slurpfile properties "$REPORT_PROPERTIES_AUDIT_FILE" \
    --slurpfile examples "$REPORT_EXAMPLES_AUDIT_FILE" \
    '{
      ok: ($core[0].ok and $properties[0].ok and $examples[0].ok),
      pageType: "report",
      url: $core[0].url,
      runtimeInfo: $core[0].runtimeInfo,
      phases: {
        core: $core[0],
        properties: $properties[0],
        examples: $examples[0]
      },
      counts: ($core[0].counts + $properties[0].counts + $examples[0].counts),
      discovered: ($core[0].discovered + $properties[0].discovered + $examples[0].discovered),
      warnings: ($core[0].warnings + $properties[0].warnings + $examples[0].warnings),
      errors: ($core[0].errors + $properties[0].errors + $examples[0].errors)
    }'
)"
write_json "$REPORT_AUDIT_FILE" "$REPORT_AUDIT"

LOGS_URL="$(
  printf '%s\n' "$REPORT_AUDIT" \
    | jq -r '.discovered.firstExampleLogsUrl // empty'
)"

if [[ -z "$LOGS_URL" ]]; then
  jq -n \
    --arg tenant "$TENANT" \
    --arg session "$SESSION" \
    --arg runs_url "$RUNS_URL" \
    --arg report_url "$LATEST_REPORT_URL" \
    --slurpfile runs_audit "$RUNS_AUDIT_FILE" \
    --slurpfile report_audit "$REPORT_AUDIT_FILE" \
    '{
      ok: false,
      tenant: $tenant,
      session: $session,
      runsUrl: $runs_url,
      reportUrl: $report_url,
      error: "could not find example logs url",
      runsAudit: $runs_audit[0],
      reportAudit: $report_audit[0]
    }' | tee "$OUT_JSON"
  exit 1
fi

echo "logs: $LOGS_URL" >&2

open_page "$LOGS_URL" logs
wait_ready logs >/dev/null
LOGS_AUDIT="$(run_audit_phase logs)"
write_json "$LOGS_AUDIT_FILE" "$LOGS_AUDIT"

jq -n \
  --arg tenant "$TENANT" \
  --arg session "$SESSION" \
  --arg runs_url "$RUNS_URL" \
  --arg report_url "$LATEST_REPORT_URL" \
  --arg logs_url "$LOGS_URL" \
  --slurpfile runs_audit "$RUNS_AUDIT_FILE" \
  --slurpfile report_audit "$REPORT_AUDIT_FILE" \
  --slurpfile logs_audit "$LOGS_AUDIT_FILE" \
  '{
    ok: ($runs_audit[0].ok and $report_audit[0].ok and $logs_audit[0].ok),
    tenant: $tenant,
    session: $session,
    runsUrl: $runs_url,
    reportUrl: $report_url,
    logsUrl: $logs_url,
    runsAudit: $runs_audit[0],
    reportAudit: $report_audit[0],
    logsAudit: $logs_audit[0]
  }' | tee "$OUT_JSON"

echo "saved: $OUT_JSON" >&2
