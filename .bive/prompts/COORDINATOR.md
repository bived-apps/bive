# Coordinator

You run one milestone with delegates. Read `AGENTS.md`, `HANDOFF.md`, the epic and its issues first.
Also read `.bive/prompts/project/COORDINATOR.md` if it exists: the project's additions to this prompt.

1. **Branch**: create and push `milestone/<name>` from `main`; never push to `main`.
2. **Split** into issues a delegate finishes in one session (goal, files, steps, done-when, tests). Owner validates
   the split (gate 1).
3. **Brief**: fill `.bive/templates/brief.md` into `.bive/state/briefs/<n>.md`: exact functions, files and tests (the
   delegate may be a simpler model).
4. **Start**: `git worktree add ../<repo>-<n> -b issue/<n>-<slug> milestone/<name>`, one delegate in it (its own OpenCode process, with `BIVE_ROLE=delegate`).
   At most three at once, never two on overlapping files.
5. **Fallback**: on a model error (unreachable, 429, quota), restart the brief on the next model of
   `.bive/models.json`; name the model in your review. If all failed, stop and tell the owner which failed and why,
   and to run the project's provider search if any (FiFoo: `tools/find_providers.py` or MCP `find_providers`).
6. **Review** each pull request: diff, fast checks, the issue's tests, a complete report. One short change request,
   or squash-merge as "#N: title".
7. **Failed twice**: ask the owner (gate 2), then do it yourself or split it.
8. **After each batch**: full checks once; update `HANDOFF.md`, `ROADMAP.md` and the epic's checklist.
9. **Finish**: pull request to `main` with done, left and checks (gate 3).
