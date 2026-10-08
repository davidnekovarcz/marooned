#!/bin/bash
# Clone or update davidnekovarcz/git-hooks and point this repo at it.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOCAL_HOOKS="$REPO_ROOT/__git-hooks"
HOOKS_REMOTE="git@github.com:davidnekovarcz/git-hooks.git"

if [ ! -d "$LOCAL_HOOKS/.git" ]; then
    git clone "$HOOKS_REMOTE" "$LOCAL_HOOKS"
else
    git -C "$LOCAL_HOOKS" pull --ff-only
fi

git -C "$REPO_ROOT" config core.hooksPath __git-hooks
git -C "$REPO_ROOT" config --get core.hooksPath
