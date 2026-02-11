#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
codex_home="${CODEX_HOME:-$HOME/.codex}"
codex_skills_dir="$codex_home/skills"
claude_home="$HOME/.claude"
claude_skills_dir="$claude_home/skills"

cd "$repo_root"

install_links() {
  local target_dir="$1"
  local skill_dir

  mkdir -p "$target_dir"

  for skill_md in */SKILL.md; do
    if [[ ! -f "$skill_md" ]]; then
      continue
    fi

    skill_dir="${skill_md%/SKILL.md}"
    ln -sfn "$repo_root/$skill_dir" "$target_dir/$skill_dir"
    printf 'Linked %s -> %s\n' "$target_dir/$skill_dir" "$repo_root/$skill_dir"
  done
}

if [[ -d "$codex_home" ]]; then
  install_links "$codex_skills_dir"
else
  printf 'Skipping Codex install: not found at %s\n' "$codex_home"
fi

if [[ -d "$claude_home" ]]; then
  install_links "$claude_skills_dir"
else
  printf 'Skipping Claude install: not found at %s\n' "$claude_home"
fi
