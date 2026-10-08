---
name: Local git-hooks clone
overview: Replace Marooned’s committed `.githooks` mirror with a gitignored local clone of davidnekovarcz/git-hooks, and point this repo at it the same way the Plexima workspace does.
todos:
  - id: branch
    content: Create chore/local-git-hooks from experiment/kaloko-smoke
    status: completed
  - id: remove-mirror
    content: Delete tracked .githooks and gitignore __git-hooks/
    status: completed
  - id: apply-script
    content: Point apply-git-hooks.sh at a local clone and relative hooksPath
    status: completed
  - id: clone
    content: Clone davidnekovarcz/git-hooks into __git-hooks and set core.hooksPath
    status: completed
isProject: false
---

# Local `__git-hooks` clone

Plexima ([`.gitignore`](/Users/dave/Development/_Plexima/.gitignore), [`README.md`](/Users/dave/Development/_Plexima/README.md)) ignores a nested `__git-hooks/` repo and sets a **local relative** `core.hooksPath` (`__git-hooks` at the workspace root). Marooned instead commits [`.githooks`](/Users/dave/Development/_GameDev/Marooned/.githooks) and [`scripts/apply-git-hooks.sh`](/Users/dave/Development/_GameDev/Marooned/scripts/apply-git-hooks.sh) copies hooks into that folder, then sets `core.hooksPath` to the absolute path `~/Development/__git-hooks`.

Folder name matches Plexima: `__git-hooks` (not `__githooks`). Source repo is [davidnekovarcz/git-hooks](https://github.com/davidnekovarcz/git-hooks) (`davidnekovarcz/_git-hooks` does not exist). The clone stays untracked.

## Branch

New branch from current `experiment/kaloko-smoke` (HEAD `f7f22dc`), so the deletion covers the mirror just pushed on [PR #25](https://github.com/davidnekovarcz/marooned/pull/25). Suggested name: `chore/local-git-hooks`.

## Changes

- Delete the tracked [`.githooks`](/Users/dave/Development/_GameDev/Marooned/.githooks) tree (`pre-commit`, `pre-push`, `prepare-commit-msg`, `shared/*.sh`).
- Add `__git-hooks/` to [`.gitignore`](/Users/dave/Development/_GameDev/Marooned/.gitignore).
- Rewrite [`scripts/apply-git-hooks.sh`](/Users/dave/Development/_GameDev/Marooned/scripts/apply-git-hooks.sh) so `npm run git:hooks:apply`:
  - clones `git@github.com:davidnekovarcz/git-hooks.git` into `__git-hooks` when that directory is missing
  - otherwise `git pull` inside it
  - runs `git config core.hooksPath __git-hooks` (local, relative — no home-directory path, no copy into `.githooks`)
- Leave [`package.json`](/Users/dave/Development/_GameDev/Marooned/package.json) scripts `git:hooks:apply` / `git:hooks:show` as they are.

## Local setup (not committed)

```bash
git clone git@github.com:davidnekovarcz/git-hooks.git __git-hooks
git config core.hooksPath __git-hooks
```

Confirm `git config --get core.hooksPath` prints `__git-hooks`, and that `git status` does not list the clone.

Do not commit `.env`, `tmp/kaloko/`, or the leftover untracked plan `.cursor/plans/universal_git-hooks_update_dda53ac7.plan.md`. Commit and push only after you confirm this plan.
