#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  scripts/run-skill-sandbox.sh <repo-url> [options] [-- <codex-args...>]
  scripts/run-skill-sandbox.sh --resume <sandbox-dir> [options] [-- <codex-args...>]

Options:
  --resume <sandbox-dir> Resume an existing sandbox directory.
  --ref <git-ref>  Checkout this branch/tag/commit after clone.
  --remove         Remove the sandbox directory on exit.
  -h, --help       Show this help.

Examples:
  scripts/run-skill-sandbox.sh https://github.com/example/project.git
  scripts/run-skill-sandbox.sh https://github.com/example/project.git -- --full-auto
  scripts/run-skill-sandbox.sh https://github.com/example/project.git --ref main -- exec "list available skills"
  scripts/run-skill-sandbox.sh --resume /tmp/codex-skill-sandbox.ABC123

Behavior:
  Maintains a persistent repo mirror cache in /tmp/codex-skill-sandbox-cache.
  First run clones into cache, later runs fetch updates, then sandbox clones from cache.
USAGE
}

if [[ ${1:-} == "" || ${1:-} == "-h" || ${1:-} == "--help" ]]; then
  usage
  exit 0
fi

repo_url=""
resume_dir=""
if [[ ${1:-} != "--resume" ]]; then
  repo_url="$1"
  shift
fi

git_ref=""
remove_on_exit=0
codex_args=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --resume)
      if [[ $# -lt 2 ]]; then
        echo "ERROR: --resume requires a value" >&2
        exit 1
      fi
      resume_dir="$2"
      shift 2
      ;;
    --ref)
      if [[ $# -lt 2 ]]; then
        echo "ERROR: --ref requires a value" >&2
        exit 1
      fi
      git_ref="$2"
      shift 2
      ;;
    --remove)
      remove_on_exit=1
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

if [[ -n "$resume_dir" && -n "$repo_url" ]]; then
  echo "ERROR: Provide either <repo-url> or --resume <sandbox-dir>, not both" >&2
  exit 1
fi

if [[ -z "$resume_dir" && -z "$repo_url" ]]; then
  echo "ERROR: Missing required argument: <repo-url> or --resume <sandbox-dir>" >&2
  exit 1
fi

if [[ -n "$resume_dir" && -n "$git_ref" ]]; then
  echo "ERROR: --ref cannot be used with --resume" >&2
  exit 1
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
real_codex_home="${REAL_CODEX_HOME:-$HOME/.codex}"
cache_root="/tmp/codex-skill-sandbox-cache"

sandbox_root=""
if [[ -n "$resume_dir" ]]; then
  sandbox_root="$resume_dir"
else
  sandbox_root="$(mktemp -d /tmp/codex-skill-sandbox.XXXXXX)"
fi
repo_dir="$sandbox_root/repo"
sandbox_codex_home="$sandbox_root/codex-home"

repo_hash=""
repo_slug=""
cache_repo_dir=""
if [[ -n "$repo_url" ]]; then
  if command -v sha256sum >/dev/null 2>&1; then
    repo_hash="$(printf '%s' "$repo_url" | sha256sum | awk '{print substr($1, 1, 16)}')"
  else
    repo_hash="$(printf '%s' "$repo_url" | shasum -a 256 | awk '{print substr($1, 1, 16)}')"
  fi

  repo_slug="$(basename "${repo_url%/}")"
  repo_slug="${repo_slug%.git}"
  cache_repo_dir="$cache_root/${repo_slug}-${repo_hash}.git"
fi

cleanup() {
  if [[ $remove_on_exit -eq 1 ]]; then
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

if [[ -n "$resume_dir" ]]; then
  if [[ ! -d "$sandbox_root" ]]; then
    echo "ERROR: Resume directory does not exist: $sandbox_root" >&2
    exit 1
  fi
  if [[ ! -d "$repo_dir" ]]; then
    echo "ERROR: Resume sandbox is missing repo directory: $repo_dir" >&2
    exit 1
  fi
  if [[ ! -d "$sandbox_codex_home" ]]; then
    echo "ERROR: Resume sandbox is missing codex-home directory: $sandbox_codex_home" >&2
    exit 1
  fi
  echo "Resuming sandbox at: $sandbox_root"
else
  echo "Creating sandbox at: $sandbox_root"
  mkdir -p "$cache_root"

  if [[ ! -d "$cache_repo_dir" ]]; then
    echo "Cache miss. Cloning mirror to: $cache_repo_dir"
    git clone --mirror "$repo_url" "$cache_repo_dir"
  else
    echo "Cache hit. Fetching updates in: $cache_repo_dir"
    git -C "$cache_repo_dir" remote update --prune
  fi

  echo "Cloning sandbox repo from cache"
  git clone "$cache_repo_dir" "$repo_dir"
  git -C "$repo_dir" remote set-url origin "$repo_url"

  if [[ -n "$git_ref" ]]; then
    git -C "$repo_dir" checkout "$git_ref"
  fi
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
  ln -sfn "$repo_root/$skill_dir_name" "$sandbox_codex_home/skills/$skill_dir_name"
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
