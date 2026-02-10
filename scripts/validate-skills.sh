#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

errors=0
checked=0

log_error() {
  printf 'ERROR: %s\n' "$1" >&2
  errors=$((errors + 1))
}

for skill_md in */SKILL.md; do
  if [[ ! -f "$skill_md" ]]; then
    continue
  fi

  checked=$((checked + 1))
  skill_dir="${skill_md%/SKILL.md}"

  if ! grep -q '^---$' "$skill_md"; then
    log_error "$skill_md missing YAML frontmatter delimiters"
    continue
  fi

  name_line="$(awk 'BEGIN{in_fm=0} /^---$/ {if(in_fm==0){in_fm=1; next} else {exit}} in_fm && /^name:[[:space:]]*/ {sub(/^name:[[:space:]]*/, ""); print; exit}' "$skill_md")"
  desc_line="$(awk 'BEGIN{in_fm=0} /^---$/ {if(in_fm==0){in_fm=1; next} else {exit}} in_fm && /^description:[[:space:]]*/ {sub(/^description:[[:space:]]*/, ""); print; exit}' "$skill_md")"

  if [[ -z "$name_line" ]]; then
    log_error "$skill_md missing frontmatter name"
  fi

  if [[ -n "$name_line" && "$name_line" != "$skill_dir" ]]; then
    log_error "$skill_md frontmatter name '$name_line' does not match directory '$skill_dir'"
  fi

  if [[ -z "$desc_line" ]]; then
    log_error "$skill_md missing frontmatter description"
  elif [[ "$desc_line" == "TODO" ]]; then
    log_error "$skill_md description still set to TODO"
  fi

  if ! grep -q '^# ' "$skill_md"; then
    log_error "$skill_md missing top-level Markdown heading"
  fi

done

if [[ $checked -eq 0 ]]; then
  log_error "No skills found (expected */SKILL.md)"
fi

if [[ $errors -gt 0 ]]; then
  printf 'Validation failed: %d error(s) across %d skill(s).\n' "$errors" "$checked" >&2
  exit 1
fi

printf 'Validation passed: %d skill(s) checked.\n' "$checked"
