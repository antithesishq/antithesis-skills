#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: antithesis-query-logs-test/run.sh <tenant-id> [report-url]

Tests the antithesis-query-logs skill against a live tenant:
1. Finds a completed report with failing properties (or uses the given URL)
2. Tests simple query URL construction (should work)
3. Tests temporal query URL construction (may fail)
4. Builds the same temporal query via UI (should work)
5. Compares URL-constructed vs UI-generated JSON to diagnose differences

If a report URL is provided, it is used directly instead of discovering
one from the runs page.

Requirements:
- agent-browser (>= v0.23.4)
- jq
- existing Antithesis auth in `--session-name antithesis`
EOF
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "missing required command: $1" >&2
    exit 1
  fi
}

if [[ $# -lt 1 || $# -gt 2 ]]; then
  usage >&2
  exit 1
fi

require_cmd agent-browser
require_cmd jq

TENANT="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TRIAGE_RUNTIME_JS="$REPO_ROOT/antithesis-triage/assets/antithesis-triage.js"
QUERY_RUNTIME_JS="$REPO_ROOT/antithesis-query-logs/assets/antithesis-query-logs.js"
AUDIT_JS="$SCRIPT_DIR/audit.js"
OUT_DIR="$SCRIPT_DIR/out"
TMP_DIR="$SCRIPT_DIR/tmp"
SESSION="query-logs-test-$(date +%s)-$$"
RUNS_URL="https://${TENANT}.antithesis.com/runs"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_JSON="$OUT_DIR/${TENANT}-query-logs-${STAMP}.json"

mkdir -p "$OUT_DIR"
mkdir -p "$TMP_DIR"
TEMP_FILES=()

cleanup() {
  browser close >/dev/null 2>&1 || true
  if [[ ${#TEMP_FILES[@]} -gt 0 ]]; then
    rm -f "${TEMP_FILES[@]}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

browser() {
  agent-browser --session "$SESSION" --session-name antithesis "$@"
}

inject_triage_runtime() {
  cat "$TRIAGE_RUNTIME_JS" | browser eval --stdin >/dev/null
}

inject_query_runtime() {
  cat "$QUERY_RUNTIME_JS" | browser eval --stdin >/dev/null
}

wait_for_page() {
  local page="$1"
  local expr

  case "$page" in
    runs)
      expr="window.location.pathname === '/runs'" ;;
    report)
      expr="window.location.pathname.startsWith('/report/')" ;;
    logs-explorer)
      expr="window.location.pathname === '/search' && !new URLSearchParams(window.location.search).has('get_logs')" ;;
    *)
      echo "unsupported page type: $page" >&2; return 1 ;;
  esac

  if browser wait --fn "$expr" >/dev/null; then
    return 0
  fi

  local current_url
  current_url="$(browser get url 2>/dev/null || true)"
  echo "timed out waiting for ${page} page; current url: ${current_url:-<empty>}" >&2
  return 1
}

open_page() {
  local url="$1"
  local page="$2"
  browser open "$url" >/dev/null
  wait_for_page "$page"
}

run_audit_phase() {
  local phase="$1"
  shift
  # Additional variable assignments can be passed as extra args
  {
    printf 'window.__ANTITHESIS_QUERY_LOGS_AUDIT_PHASE__ = %s;\n' \
      "$(jq -Rn --arg p "$phase" '$p')"
    for var_assignment in "$@"; do
      printf '%s\n' "$var_assignment"
    done
    cat "$AUDIT_JS"
  } | browser eval --stdin
}

wait_ready_triage() {
  local namespace="$1"
  browser eval \
    "window.__antithesisTriage.${namespace}.waitForReady({ timeoutMs: 15000, intervalMs: 500 })" \
    >/dev/null
}

wait_for_logs_explorer_ready() {
  # Poll until the query builder has loaded
  browser wait --fn \
    "document.querySelector('.select_container.event_search_run_selector') !== null" \
    >/dev/null 2>&1 || true
  # Give the page a moment to finish hydrating
  sleep 2
}

make_temp() {
  local prefix="$1"
  local content="$2"
  local file
  file="$(mktemp "$TMP_DIR/${prefix}.XXXXXX.json")"
  TEMP_FILES+=("$file")
  printf '%s\n' "$content" > "$file"
  printf '%s' "$file"
}

# ---------------------------------------------------------------------------
# Main flow
# ---------------------------------------------------------------------------

GIVEN_REPORT_URL="${2:-}"

echo "session: $SESSION" >&2

if [[ -n "$GIVEN_REPORT_URL" ]]; then
  REPORT_URL="$GIVEN_REPORT_URL"
  echo "using provided report: $REPORT_URL" >&2
else
  echo "runs: $RUNS_URL" >&2

  # --- Find a completed report with failed properties ---

  open_page "$RUNS_URL" runs
  inject_triage_runtime
  wait_ready_triage runs

  RUNS_RESULT="$(browser eval "window.__antithesisTriage.runs.getRecentRuns()")"

  mapfile -t COMPLETED_REPORT_URLS < <(
    printf '%s\n' "$RUNS_RESULT" \
      | jq -r '
        .runs[]
        | select(.triageUrl and (.status | ascii_downcase | contains("completed")))
        | .triageUrl
      '
  )

  if [[ ${#COMPLETED_REPORT_URLS[@]} -eq 0 ]]; then
    echo "no completed reports found" >&2
    jq -n --arg tenant "$TENANT" '{ok: false, tenant: $tenant, error: "no completed reports found"}' > "$OUT_JSON"
    exit 1
  fi

  REPORT_URL="${COMPLETED_REPORT_URLS[0]}"
  echo "report: $REPORT_URL" >&2
fi

# --- Setup phase: extract session ID and failing property ---

open_page "$REPORT_URL" report
inject_triage_runtime
wait_ready_triage report

SETUP_AUDIT="$(run_audit_phase setup)"
SETUP_FILE="$(make_temp setup "$SETUP_AUDIT")"

SESSION_ID="$(jq -r '.discovered.sessionId // empty' "$SETUP_FILE")"
PROPERTY_NAME="$(jq -r '.discovered.failingPropertyName // empty' "$SETUP_FILE")"
TEMPORAL_PROPERTY_NAME="$(jq -r '.discovered.secondFailingPropertyName // empty' "$SETUP_FILE")"
EXPLORE_LOGS_URL="$(jq -r '.discovered.exploreLogsUrl // empty' "$SETUP_FILE")"

if [[ -z "$SESSION_ID" || -z "$PROPERTY_NAME" ]]; then
  echo "setup failed: sessionId=${SESSION_ID:-<empty>} property=${PROPERTY_NAME:-<empty>}" >&2
  jq -n --arg tenant "$TENANT" \
    --slurpfile setup "$SETUP_FILE" \
    '{ok: false, tenant: $tenant, error: "setup phase failed", setupAudit: $setup[0]}' > "$OUT_JSON"
  exit 1
fi

if [[ -z "$TEMPORAL_PROPERTY_NAME" ]]; then
  echo "warning: only one failing property found — temporal query will use the same property" >&2
  TEMPORAL_PROPERTY_NAME="$PROPERTY_NAME"
fi

echo "sessionId: ${SESSION_ID:0:40}..." >&2
echo "property: $PROPERTY_NAME" >&2
echo "temporal property: $TEMPORAL_PROPERTY_NAME" >&2
echo "exploreLogsUrl: ${EXPLORE_LOGS_URL:0:80}..." >&2

# --- Simple URL phase ---

echo "testing simple query URL..." >&2

SIMPLE_URL="$(browser eval \
  "window.__antithesisQueryBuilder.buildFailureQueryUrl('${SESSION_ID}', '${PROPERTY_NAME}', '${TENANT}.antithesis.com')")"

# Strip quotes if present
SIMPLE_URL="${SIMPLE_URL//\"/}"

echo "simple URL: ${SIMPLE_URL:0:100}..." >&2

open_page "$SIMPLE_URL" logs-explorer
inject_query_runtime
wait_for_logs_explorer_ready

SIMPLE_URL_AUDIT="$(run_audit_phase simple-url)"
SIMPLE_URL_FILE="$(make_temp simple-url "$SIMPLE_URL_AUDIT")"

echo "simple-url: $(jq -r 'if .ok then "PASS" else "FAIL" end' "$SIMPLE_URL_FILE")" >&2

# --- Temporal URL phase ---

echo "testing temporal query URL..." >&2

TEMPORAL_URL="$(browser eval \
  "window.__antithesisQueryBuilder.buildNotPrecededByUrl('${SESSION_ID}', '${PROPERTY_NAME}', 'assertion.message', '${TEMPORAL_PROPERTY_NAME}', '${TENANT}.antithesis.com')")"

TEMPORAL_URL="${TEMPORAL_URL//\"/}"

echo "temporal URL: ${TEMPORAL_URL:0:100}..." >&2

open_page "$TEMPORAL_URL" logs-explorer
inject_query_runtime
wait_for_logs_explorer_ready

TEMPORAL_URL_AUDIT="$(run_audit_phase temporal-url)"
TEMPORAL_URL_FILE="$(make_temp temporal-url "$TEMPORAL_URL_AUDIT")"

TEMPORAL_URL_WORKED="$(jq -r '.discovered.temporalUrlWorked // false' "$TEMPORAL_URL_FILE")"
echo "temporal-url: $(jq -r 'if .ok then "PASS" else "FAIL" end' "$TEMPORAL_URL_FILE") (worked=$TEMPORAL_URL_WORKED)" >&2

# --- Temporal UI phase ---

echo "testing temporal query via UI..." >&2

if [[ -n "$EXPLORE_LOGS_URL" ]]; then
  open_page "$EXPLORE_LOGS_URL" logs-explorer
else
  open_page "https://${TENANT}.antithesis.com/search" logs-explorer
fi

inject_query_runtime
wait_for_logs_explorer_ready

TEMPORAL_UI_AUDIT="$(run_audit_phase temporal-ui \
  "window.__ANTITHESIS_QUERY_LOGS_PROPERTY_NAME__ = $(jq -Rn --arg p "$PROPERTY_NAME" '$p');" \
  "window.__ANTITHESIS_QUERY_LOGS_TEMPORAL_PROPERTY_NAME__ = $(jq -Rn --arg p "$TEMPORAL_PROPERTY_NAME" '$p');")"
TEMPORAL_UI_FILE="$(make_temp temporal-ui "$TEMPORAL_UI_AUDIT")"

echo "temporal-ui: $(jq -r 'if .ok then "PASS" else "FAIL" end' "$TEMPORAL_UI_FILE")" >&2

# --- Diagnostic phase ---

echo "running diagnostic comparison..." >&2

TEMPORAL_URL_DECODED="$(jq -c '.discovered.temporalUrlDecoded // null' "$TEMPORAL_URL_FILE")"
UI_TEMPORAL_DECODED="$(jq -c '.discovered.uiTemporalDecoded // null' "$TEMPORAL_UI_FILE")"

# Pass both decoded JSONs to the diagnostic phase
DIAGNOSTIC_AUDIT="$(run_audit_phase diagnostic \
  "window.__ANTITHESIS_QUERY_LOGS_DIAGNOSTIC_DATA__ = { temporalUrlDecoded: ${TEMPORAL_URL_DECODED}, uiTemporalDecoded: ${UI_TEMPORAL_DECODED} };")"
DIAGNOSTIC_FILE="$(make_temp diagnostic "$DIAGNOSTIC_AUDIT")"

echo "diagnostic: $(jq -r 'if .ok then "PASS" else "FAIL" end' "$DIAGNOSTIC_FILE")" >&2
echo "differences: $(jq -r '.counts.totalDifferences // "N/A"' "$DIAGNOSTIC_FILE")" >&2

# --- Optional: temporal URL retry with corrected JSON ---

RETRY_AUDIT="null"
RETRY_FILE=""
JSON_MATCH="$(jq -r '.discovered.jsonMatch // false' "$DIAGNOSTIC_FILE")"

if [[ "$JSON_MATCH" == "false" && "$UI_TEMPORAL_DECODED" != "null" ]]; then
  echo "attempting temporal URL retry with UI-captured JSON..." >&2

  # Encode the UI-captured JSON as a URL
  CORRECTED_URL="$(browser eval "
    var query = ${UI_TEMPORAL_DECODED};
    var encoded = btoa(JSON.stringify(query)).replace(/=+$/, '');
    'https://${TENANT}.antithesis.com/search?search=v5v' + encoded;
  ")"
  CORRECTED_URL="${CORRECTED_URL//\"/}"

  echo "corrected URL: ${CORRECTED_URL:0:100}..." >&2

  open_page "$CORRECTED_URL" logs-explorer
  inject_query_runtime
  wait_for_logs_explorer_ready

  RETRY_AUDIT="$(run_audit_phase temporal-url-retry)"
  RETRY_FILE="$(make_temp retry "$RETRY_AUDIT")"
  echo "retry: $(jq -r 'if .ok then "PASS" else "FAIL" end' "$RETRY_FILE")" >&2
fi

# ---------------------------------------------------------------------------
# Assemble final JSON
# ---------------------------------------------------------------------------

build_final_json() {
  local setup_file="$1" simple_file="$2" temporal_file="$3" ui_file="$4" diagnostic_file="$5"
  local retry_content="${6:-null}"

  local retry_file=""
  if [[ "$retry_content" != "null" && -n "$retry_content" ]]; then
    retry_file="$(make_temp retry-final "$retry_content")"
  fi

  local args=(
    --arg tenant "$TENANT"
    --arg session "$SESSION"
    --arg report_url "$REPORT_URL"
    --arg session_id "$SESSION_ID"
    --arg property_name "$PROPERTY_NAME"
    --arg temporal_property_name "$TEMPORAL_PROPERTY_NAME"
    --slurpfile setup "$setup_file"
    --slurpfile simple "$simple_file"
    --slurpfile temporal "$temporal_file"
    --slurpfile ui "$ui_file"
    --slurpfile diagnostic "$diagnostic_file"
  )

  if [[ -n "$retry_file" ]]; then
    args+=(--slurpfile retry "$retry_file")
  else
    args+=(--argjson retry "null")
  fi

  jq -n "${args[@]}" '
    ($setup[0]) as $setup
    | ($simple[0]) as $simple
    | ($temporal[0]) as $temporal
    | ($ui[0]) as $ui
    | ($diagnostic[0]) as $diag
    | (if $retry then $retry[0] else null end) as $retry
    |
    def normalize_check($phase):
      . as $check
      | {
          phase: $phase,
          name: $check.name,
          status: ($check.status // (if $check.ok then "passed" else "failed" end)),
          durationMs: ($check.durationMs // 0),
          error: ($check.error // null),
          reason: ($check.reason // null)
        };

    def checks_for($phase; $audit):
      if $audit == null then []
      else ($audit.checks // []) | map(normalize_check($phase))
      end;

    checks_for("setup"; $setup)
    + checks_for("simple-url"; $simple)
    + checks_for("temporal-url"; $temporal)
    + checks_for("temporal-ui"; $ui)
    + checks_for("diagnostic"; $diag)
    + checks_for("temporal-url-retry"; $retry)
    | . as $tests
    | ($tests | map(select(.status == "passed")) | length) as $passed
    | ($tests | map(select(.status == "failed")) | length) as $failed
    | ($tests | map(select(.status == "skipped")) | length) as $skipped
    | ($passed + $failed) as $executed
    | {
        ok: ($setup.ok and $simple.ok and ($diag.ok // true) and ($failed == 0)),
        tenant: $tenant,
        session: $session,
        reportUrl: $report_url,
        sessionId: $session_id,
        failingPropertyName: $property_name,
        temporalPropertyName: $temporal_property_name,
        setupAudit: $setup,
        simpleUrlAudit: $simple,
        temporalUrlAudit: $temporal,
        temporalUiAudit: $ui,
        diagnosticAudit: $diag,
        temporalUrlRetryAudit: $retry,
        summary: {
          overallStatus: (if $failed == 0 then "passed" else "failed" end),
          executed: $executed,
          passed: $passed,
          failed: $failed,
          skipped: $skipped,
          passRate: (if $executed > 0 then (((1000 * $passed) / $executed) | round / 10) else null end),
          simpleUrlWorks: $simple.ok,
          temporalUrlWorks: ($temporal.discovered.temporalUrlWorked // false),
          temporalUiWorks: $ui.ok,
          jsonStructuresMatch: ($diag.discovered.jsonMatch // null),
          differences: ($diag.discovered.differences // []),
          hypotheses: ($diag.discovered.hypotheses // []),
          tests: $tests,
          failedTests: ($tests | map(select(.status == "failed"))),
          skippedTests: ($tests | map(select(.status == "skipped")))
        }
      }'
}

FINAL_JSON="$(build_final_json "$SETUP_FILE" "$SIMPLE_URL_FILE" "$TEMPORAL_URL_FILE" "$TEMPORAL_UI_FILE" "$DIAGNOSTIC_FILE" "$RETRY_AUDIT")"
printf '%s\n' "$FINAL_JSON" > "$OUT_JSON"

# ---------------------------------------------------------------------------
# Print summary
# ---------------------------------------------------------------------------

jq -r '
  .summary as $s
  | [
      ("Overall: " + ($s.overallStatus | ascii_upcase)),
      ("Checks: " + ($s.passed | tostring) + " passed, " + ($s.failed | tostring) + " failed, " + ($s.skipped | tostring) + " skipped"),
      "",
      "Query Methods:",
      ("  Simple URL:    " + (if $s.simpleUrlWorks then "WORKS" else "BROKEN" end)),
      ("  Temporal URL:  " + (if $s.temporalUrlWorks then "WORKS" else "BROKEN" end)),
      ("  Temporal UI:   " + (if $s.temporalUiWorks then "WORKS" else "BROKEN" end)),
      ""
    ]
    + (if $s.jsonStructuresMatch == true then
        ["JSON structures MATCH — temporal URL failure is not a format issue."]
      elif $s.jsonStructuresMatch == false then
        ["JSON structures DIFFER — " + (($s.differences | length) | tostring) + " difference(s) found:"]
        + ($s.differences | map("  " + .path + ": " + .type + (if .urlValue then " (url=" + (.urlValue | tostring) + ")" else "" end) + (if .uiValue then " (ui=" + (.uiValue | tostring) + ")" else "" end)))
        + [""]
        + ["Hypotheses:"]
        + ($s.hypotheses | map("  - " + .))
      else
        ["JSON comparison: N/A"]
      end)
    + [""]
    + ["Checks:"]
    + (
      $s.tests
      | map(
          "  ["
          + (if .status == "passed" then "PASS"
             elif .status == "failed" then "FAIL"
             else "SKIP" end)
          + "] "
          + .phase + " :: " + .name
          + (if .status == "failed" and .error then " - " + .error else "" end)
          + (if .status == "skipped" and .reason then " - " + .reason else "" end)
        )
    )
    + ["", "Saved JSON: " + input_filename]
    | .[]
' "$OUT_JSON"

if jq -e '.ok' "$OUT_JSON" >/dev/null; then
  exit 0
fi

exit 1
