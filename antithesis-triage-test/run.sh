#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: antithesis-triage-test/run.sh <tenant-id>

Runs a live exploration against:
1. the tenant runs page
2. the most recent completed report
3. one example logs page from the latest completed report that exposes failed-example logs
4. one incomplete/error report, if the tenant has one

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

inject_runtime() {
  cat "$RUNTIME_JS" | browser eval --stdin >/dev/null
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

  if browser wait --fn "$expr" >/dev/null; then
    return 0
  fi

  current_url="$(browser get url 2>/dev/null || true)"
  echo "timed out waiting for ${page} page; current url: ${current_url:-<empty>}" >&2
  return 1
}

open_page() {
  local url="$1"
  local page="$2"

  browser open "$url" >/dev/null
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

  if ! browser eval \
    "window.__antithesisTriage.${namespace}.waitForReady({ timeoutMs: 10000, intervalMs: 500 })" \
    >/dev/null 2>&1; then
    echo "warning: ${namespace}.waitForReady timed out" >&2
  fi
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

build_report_audit() {
  local report_url="$1"
  local core properties examples
  local core_file properties_file examples_file

  open_page "$report_url" report
  wait_ready report
  core="$(run_audit_phase report-core)"
  properties="$(run_audit_phase report-properties)"

  open_page "$report_url" report
  wait_ready report
  examples="$(run_audit_phase report-examples)"

  core_file="$(make_temp report-core "$core")"
  properties_file="$(make_temp report-properties "$properties")"
  examples_file="$(make_temp report-examples "$examples")"

  jq -n \
    --slurpfile core_file "$core_file" \
    --slurpfile properties_file "$properties_file" \
    --slurpfile examples_file "$examples_file" \
    '
    ($core_file[0]) as $core
    | ($properties_file[0]) as $properties
    | ($examples_file[0]) as $examples
    | {
      ok: ($core.ok and $properties.ok and $examples.ok),
      pageType: "report",
      url: $core.url,
      runtimeInfo: $core.runtimeInfo,
      phases: {
        core: $core,
        properties: $properties,
        examples: $examples
      },
      counts: ($core.counts + $properties.counts + $examples.counts),
      discovered: ($core.discovered + $properties.discovered + $examples.discovered),
      warnings: ($core.warnings + $properties.warnings + $examples.warnings),
      errors: ($core.errors + $properties.errors + $examples.errors)
    }'
}

build_report_examples_prepass() {
  local report_url="$1"

  open_page "$report_url" report
  wait_ready report
  run_audit_phase report-examples
}

build_logs_audit() {
  local logs_url="$1"

  open_page "$logs_url" logs
  wait_ready logs
  run_audit_phase logs
}

build_error_report_audit() {
  local report_url="$1"

  open_page "$report_url" report
  wait_ready report
  run_audit_phase report-error
}

build_final_json() {
  local error_json
  local runs_audit_file report_audit_file logs_audit_file error_report_audit_file
  local logs_source_report_audit_file

  if [[ -n "$FINAL_ERROR" ]]; then
    error_json="$(jq -Rn --arg value "$FINAL_ERROR" '$value')"
  else
    error_json="null"
  fi

  runs_audit_file="$(make_temp runs-audit "$RUNS_AUDIT")"
  report_audit_file="$(make_temp report-audit "$REPORT_AUDIT")"
  logs_audit_file="$(make_temp logs-audit "${LOGS_AUDIT:-null}")"
  error_report_audit_file="$(make_temp error-report-audit "${ERROR_REPORT_AUDIT:-null}")"
  logs_source_report_audit_file="$(make_temp logs-source-report-audit "${LOGS_SOURCE_REPORT_AUDIT:-null}")"

  jq -n \
    --arg tenant "$TENANT" \
    --arg session "$SESSION" \
    --arg runs_url "$RUNS_URL" \
    --arg report_url "$PRIMARY_REPORT_URL" \
    --arg logs_url "$LOGS_URL" \
    --arg logs_source_report_url "$LOGS_SOURCE_REPORT_URL" \
    --arg error_report_url "$ERROR_REPORT_URL" \
    --argjson error "$error_json" \
    --slurpfile runs_audit_file "$runs_audit_file" \
    --slurpfile report_audit_file "$report_audit_file" \
    --slurpfile logs_audit_file "$logs_audit_file" \
    --slurpfile error_report_audit_file "$error_report_audit_file" \
    --slurpfile logs_source_report_audit_file "$logs_source_report_audit_file" \
    '
    ($runs_audit_file[0]) as $runs_audit
    | ($report_audit_file[0]) as $report_audit
    | ($logs_audit_file[0]) as $logs_audit
    | ($error_report_audit_file[0]) as $error_report_audit
    | ($logs_source_report_audit_file[0]) as $logs_source_report_audit
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
      if $audit == null then
        []
      else
        ($audit.checks // []) | map(normalize_check($phase))
      end;

    def synthetic_tests:
      [
        if $logs_audit == null then
          {
            phase: "logs",
            name: "logs phase",
            status: (if ($logs_url | length) > 0 then "skipped" else "failed" end),
            durationMs: 0,
            error: (if ($logs_url | length) > 0 then null else ($error // "logs phase did not run") end),
            reason: (if ($logs_url | length) > 0 then "logs phase not run" else "could not find a recent completed report with example logs" end)
          }
        else
          empty
        end,
        if $error_report_audit == null then
          {
            phase: "report-error",
            name: "report-error phase",
            status: "skipped",
            durationMs: 0,
            error: null,
            reason: (if ($error_report_url | length) > 0 then "error report audit did not complete" else "no incomplete run found" end)
          }
        else
          empty
        end
      ];

    def tests:
      checks_for("runs"; $runs_audit)
      + checks_for("report-core"; ($report_audit.phases.core // null))
      + checks_for("report-properties"; ($report_audit.phases.properties // null))
      + checks_for("report-examples"; ($report_audit.phases.examples // null))
      + checks_for("logs"; $logs_audit)
      + checks_for("report-error"; $error_report_audit)
      + synthetic_tests;

    tests as $tests
    | ($tests | map(select(.status == "passed")) | length) as $passed
    | ($tests | map(select(.status == "failed")) | length) as $failed
    | ($tests | map(select(.status == "skipped")) | length) as $skipped
    | ($passed + $failed) as $executed
    | {
        ok: ($runs_audit.ok and $report_audit.ok and ($logs_audit == null or $logs_audit.ok) and ($error_report_audit == null or $error_report_audit.ok) and ($failed == 0) and ($error == null)),
        tenant: $tenant,
        session: $session,
        runsUrl: $runs_url,
        reportUrl: $report_url,
        logsUrl: (if ($logs_url | length) > 0 then $logs_url else null end),
        logsSourceReportUrl: (if ($logs_source_report_url | length) > 0 then $logs_source_report_url else null end),
        errorReportUrl: (if ($error_report_url | length) > 0 then $error_report_url else null end),
        error: $error,
        runsAudit: $runs_audit,
        reportAudit: $report_audit,
        logsAudit: $logs_audit,
        errorReportAudit: $error_report_audit,
        logsSourceReport: (
          if $logs_source_report_audit == null then
            null
          else
            {
              ok: $logs_source_report_audit.ok,
              url: $logs_source_report_audit.url,
              title: ($logs_source_report_audit.discovered.title // null),
              counts: ($logs_source_report_audit.counts // {}),
              warnings: ($logs_source_report_audit.warnings // [])
            }
          end
        ),
        summary: {
          overallStatus: (if $failed == 0 and $error == null then "passed" else "failed" end),
          executed: $executed,
          passed: $passed,
          failed: $failed,
          skipped: $skipped,
          passRate: (if $executed > 0 then (((1000 * $passed) / $executed) | round / 10) else null end),
          primaryReportHasExampleLogs: ((($report_audit.discovered.firstExampleLogsUrl // "") | length) > 0),
          usedFallbackLogsReport: ((($logs_source_report_url | length) > 0) and ($logs_source_report_url != $report_url)),
          tests: $tests,
          failedTests: ($tests | map(select(.status == "failed"))),
          skippedTests: ($tests | map(select(.status == "skipped")))
        }
      }'
}

print_summary() {
  local json_path="$1"

  jq -r '
    .summary as $summary
    | [
        ("Overall: " + ($summary.overallStatus | ascii_upcase)),
        ("Metric: " + ($summary.passed | tostring) + "/" + ($summary.executed | tostring) + " executed passed" + (if $summary.passRate == null then "" else " (" + ($summary.passRate | tostring) + "%)" end)),
        ("Counts: passed=" + ($summary.passed | tostring) + ", failed=" + ($summary.failed | tostring) + ", skipped=" + ($summary.skipped | tostring)),
        ("Completed report candidate: " + (.reportUrl // "<none>")),
        ("Logs source report: " + (.logsSourceReportUrl // "<none>") + (if $summary.usedFallbackLogsReport then " (fallback)" else "" end)),
        ("Logs URL: " + (.logsUrl // "<none>")),
        ("Error report: " + (.errorReportUrl // "<none>")),
        "Tests:"
      ]
      + (
        $summary.tests
        | map(
            "  ["
            + (
                if .status == "passed" then "PASS"
                elif .status == "failed" then "FAIL"
                else "SKIP"
                end
              )
            + "] "
            + .phase
            + " :: "
            + .name
            + (
                if .status == "failed" and .error != null then
                  " - " + .error
                elif .status == "skipped" and .reason != null then
                  " - " + .reason
                else
                  ""
                end
              )
          )
      )
      + (
        if .error == null then
          []
        else
          ["Error: " + (if (.error | type) == "string" then .error else (.error | tojson) end)]
        end
      )
      + ["Saved JSON: " + input_filename]
      | .[]
  ' "$json_path"
}

echo "session: $SESSION" >&2
echo "runs: $RUNS_URL" >&2

browser open "$RUNS_URL" >/dev/null
wait_for_expected_page runs
inject_runtime
wait_ready runs
RUNS_AUDIT="$(run_audit_phase runs)"

mapfile -t COMPLETED_REPORT_URLS < <(
  printf '%s\n' "$RUNS_AUDIT" \
    | jq -r '
      .checks[]
      | select(.name == "runs.getRecentRuns")
      | .result.runs[]
      | select(.triageUrl and (.status | ascii_downcase | contains("completed")))
      | .triageUrl
    '
)

PRIMARY_REPORT_URL="${COMPLETED_REPORT_URLS[0]:-}"
LOGS_URL=""
LOGS_AUDIT=""
LOGS_SOURCE_REPORT_URL=""
LOGS_SOURCE_REPORT_AUDIT=""
ERROR_REPORT_AUDIT=""
ERROR_REPORT_URL=""
FINAL_ERROR=""

if [[ -z "$PRIMARY_REPORT_URL" ]]; then
  FINAL_ERROR="could not find latest completed report url"
  REPORT_AUDIT='{"ok":false,"phase":"report","counts":{},"discovered":{},"warnings":[],"errors":["could not find latest completed report url"]}'
else
  echo "selecting completed report candidate" >&2

  selected_report_url=""
  selected_prepass_logs_url=""
  for candidate_report_url in "${COMPLETED_REPORT_URLS[@]}"; do
    echo "completed prepass: $candidate_report_url" >&2
    candidate_examples_prepass="$(build_report_examples_prepass "$candidate_report_url")"
    candidate_logs_url="$(
      printf '%s\n' "$candidate_examples_prepass" \
        | jq -r '.discovered.firstExampleLogsUrl // empty'
    )"

    if [[ -n "$candidate_logs_url" ]]; then
      selected_report_url="$candidate_report_url"
      selected_prepass_logs_url="$candidate_logs_url"
      break
    fi
  done

  if [[ -n "$selected_report_url" ]]; then
    PRIMARY_REPORT_URL="$selected_report_url"
    LOGS_URL="$selected_prepass_logs_url"
  else
    echo "no completed report with example logs found in prepass; falling back to latest completed report" >&2
    FINAL_ERROR="could not find example logs url in recent completed reports"
  fi

  echo "completed report candidate: $PRIMARY_REPORT_URL" >&2
  REPORT_AUDIT="$(build_report_audit "$PRIMARY_REPORT_URL")"

  full_audit_logs_url="$(
    printf '%s\n' "$REPORT_AUDIT" \
      | jq -r '.discovered.firstExampleLogsUrl // empty'
  )"
  if [[ -n "$full_audit_logs_url" ]]; then
    LOGS_URL="$full_audit_logs_url"
  fi

  LOGS_SOURCE_REPORT_URL="$PRIMARY_REPORT_URL"
  LOGS_SOURCE_REPORT_AUDIT="$REPORT_AUDIT"

  if [[ -n "$LOGS_URL" ]]; then
    echo "logs source report: $LOGS_SOURCE_REPORT_URL" >&2
    echo "logs: $LOGS_URL" >&2
    LOGS_AUDIT="$(build_logs_audit "$LOGS_URL")"
    FINAL_ERROR=""
  elif [[ -z "$FINAL_ERROR" ]]; then
    FINAL_ERROR="could not find example logs url in recent completed reports"
  fi
fi

INCOMPLETE_REPORT_URL="$(
  printf '%s\n' "$RUNS_AUDIT" \
    | jq -r '.discovered.latestIncompleteReportUrl // empty'
)"

if [[ -n "$INCOMPLETE_REPORT_URL" ]]; then
  ERROR_REPORT_URL="$INCOMPLETE_REPORT_URL"
  echo "error report (incomplete): $ERROR_REPORT_URL" >&2
  ERROR_REPORT_AUDIT="$(build_error_report_audit "$ERROR_REPORT_URL")"
else
  echo "no incomplete run found — skipping error report test" >&2
fi

FINAL_JSON="$(build_final_json)"
printf '%s\n' "$FINAL_JSON" > "$OUT_JSON"
print_summary "$OUT_JSON"

if jq -e '.ok' "$OUT_JSON" >/dev/null; then
  exit 0
fi

exit 1
