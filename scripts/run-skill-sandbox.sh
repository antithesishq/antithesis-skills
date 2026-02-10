#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  scripts/run-skill-sandbox.sh <repo-url> [options] [-- <codex-args...>]

Options:
  --ref <git-ref>  Checkout this branch/tag/commit after clone.
  --keep           Keep the sandbox directory instead of deleting it on exit.
  -h, --help       Show this help.

Examples:
  scripts/run-skill-sandbox.sh https://github.com/example/project.git
  scripts/run-skill-sandbox.sh https://github.com/example/project.git -- --full-auto
  scripts/run-skill-sandbox.sh https://github.com/example/project.git --ref main -- exec "list available skills"
USAGE
}

if [[ ${1:-} == "" || ${1:-} == "-h" || ${1:-} == "--help" ]]; then
  usage
  exit 0
fi

repo_url="$1"
shift

git_ref=""
keep_sandbox=0
codex_args=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ref)
      if [[ $# -lt 2 ]]; then
        echo "ERROR: --ref requires a value" >&2
        exit 1
      fi
      git_ref="$2"
      shift 2
      ;;
    --keep)
      keep_sandbox=1
      shift
      ;;
    --)
      shift
      codex_args=("$@")
      break
      ;;
    *)
      codex_args+=("$1")
      shift
      ;;
  esac
done

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
real_codex_home="${REAL_CODEX_HOME:-$HOME/.codex}"

sandbox_root="$(mktemp -d /tmp/codex-skill-sandbox.XXXXXX)"
repo_dir="$sandbox_root/repo"
sandbox_codex_home="$sandbox_root/codex-home"

cleanup() {
  if [[ $keep_sandbox -eq 0 ]]; then
    # Guardrail: only delete directories created under /tmp.
    if [[ -d "$sandbox_root" && "$sandbox_root" == /tmp/* ]]; then
      rm -rf "$sandbox_root"
    else
      echo "Refusing to remove unsafe sandbox path: $sandbox_root" >&2
      return 1
    fi
  else
    echo "Sandbox kept at: $sandbox_root"
  fi
}
trap cleanup EXIT

echo "Creating sandbox at: $sandbox_root"
git clone "$repo_url" "$repo_dir"

if [[ -n "$git_ref" ]]; then
  git -C "$repo_dir" checkout "$git_ref"
fi

mkdir -p "$sandbox_codex_home/skills"

for file in auth.json config.toml; do
  if [[ -f "$real_codex_home/$file" ]]; then
    cp "$real_codex_home/$file" "$sandbox_codex_home/$file"
  fi
done

if [[ -d "$real_codex_home/skills/.system" ]]; then
  cp -R "$real_codex_home/skills/.system" "$sandbox_codex_home/skills/"
fi

found_skills=0
for skill_md in "$repo_root"/*/SKILL.md; do
  if [[ ! -f "$skill_md" ]]; then
    continue
  fi
  found_skills=1
  skill_dir_name="$(basename "$(dirname "$skill_md")")"
  ln -s "$repo_root/$skill_dir_name" "$sandbox_codex_home/skills/$skill_dir_name"
done

if [[ $found_skills -eq 0 ]]; then
  echo "ERROR: No skills found at $repo_root/*/SKILL.md" >&2
  exit 1
fi

echo "Injected skills from: $repo_root"
echo "Launching Codex in: $repo_dir"

if [[ ${#codex_args[@]} -eq 0 ]]; then
  CODEX_HOME="$sandbox_codex_home" codex --cd "$repo_dir"
else
  CODEX_HOME="$sandbox_codex_home" codex --cd "$repo_dir" "${codex_args[@]}"
fi
