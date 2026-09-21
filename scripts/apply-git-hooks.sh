#!/bin/bash
# Copy/refresh hooks from the shared __git-hooks repo and point this clone at them.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOCAL_HOOKS="$REPO_ROOT/.githooks"
SHARED_HOOKS=""

resolve_shared_hooks() {
    if [ -n "${GIT_HOOKS_PATH:-}" ] && [ -d "$GIT_HOOKS_PATH" ]; then
        SHARED_HOOKS="$GIT_HOOKS_PATH"
        return
    fi

    if [ -d "$HOME/Development/__git-hooks" ]; then
        SHARED_HOOKS="$HOME/Development/__git-hooks"
        return
    fi

    if [ -d "$REPO_ROOT/../../__git-hooks" ]; then
        SHARED_HOOKS="$(cd "$REPO_ROOT/../../__git-hooks" && pwd)"
    fi
}

copy_hooks() {
    local source_dir="$1"
    mkdir -p "$LOCAL_HOOKS/shared"
    cp "$source_dir/pre-commit" "$LOCAL_HOOKS/"
    cp "$source_dir/pre-push" "$LOCAL_HOOKS/"
    cp "$source_dir/prepare-commit-msg" "$LOCAL_HOOKS/"
    cp "$source_dir/shared/"*.sh "$LOCAL_HOOKS/shared/"
    chmod +x "$LOCAL_HOOKS/pre-commit" "$LOCAL_HOOKS/pre-push" "$LOCAL_HOOKS/prepare-commit-msg" "$LOCAL_HOOKS/shared/"*.sh
}

resolve_shared_hooks

if [ -n "$SHARED_HOOKS" ]; then
    copy_hooks "$SHARED_HOOKS"
    git -C "$REPO_ROOT" config core.hooksPath "$SHARED_HOOKS"
    echo "Referenced shared hooks: $SHARED_HOOKS"
    echo "Copied into repo: $LOCAL_HOOKS"
else
    if [ ! -x "$LOCAL_HOOKS/pre-commit" ]; then
        echo "No shared git-hooks found and $LOCAL_HOOKS is incomplete."
        echo "Set GIT_HOOKS_PATH or clone hooks to ~/Development/__git-hooks"
        exit 1
    fi
    chmod +x "$LOCAL_HOOKS/pre-commit" "$LOCAL_HOOKS/pre-push" "$LOCAL_HOOKS/prepare-commit-msg" "$LOCAL_HOOKS/shared/"*.sh
    git -C "$REPO_ROOT" config core.hooksPath .githooks
    echo "Using in-repo hooks: $LOCAL_HOOKS"
fi

git -C "$REPO_ROOT" config --get core.hooksPath
