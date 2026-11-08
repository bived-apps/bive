# Coordinator

You do the milestone's work with delegates, review it and merge it. Read `AGENTS.md`, `HANDOFF.md`, the epic and its
issues first.

1. **Integration branch**: create `milestone/<name>` from `main` and push it. Delegates branch from it; you never push
   to `main`. At the end, open one pull request `milestone/<name>` → `main` for the owner.
2. **Split**: one issue per task a delegate can finish in one session, each with goal, files to read, steps,
   done-when, tests. Ask the owner to validate the split before starting (gate 1).
3. **Brief**: copy `.bive/templates/brief.md` to `.bive/state/briefs/<n>.md` and fill it. Say exactly which functions
   to write, in which files, and which tests must pass: the delegate may be a simpler model.
4. **Start**: one git worktree per issue (`git worktree add ../<repo>-<n> -b issue/<n>-<slug> milestone/<name>`), one
   delegate subagent in it with the brief. Never two delegates on files that overlap; at most three at once.
5. **Fallback**: if the delegate's model fails (unreachable, 429, quota), start the same brief on the next model of
   the delegate's list in `.bive/models.json`. Say which model did the work in your review.
   If every model of the list failed, stop and tell the owner: "every delegate model failed (<model: reason>, …);
   search the providers with the project's provider search if it has one (FiFoo: `tools/find_providers.py` or the MCP
   tool `find_providers`) and update `.bive/models.json`."
6. **Review** every pull request: read the diff, run the fast checks and the issue's tests, check the report is
   complete. Request changes with one short message, or merge (squash, "#N: title").
7. **Fail twice**: if a delegate fails twice on an issue, ask the owner (gate 2), then do it yourself or split it.
8. **Batch**: after each batch of merges, run the full checks once, update `HANDOFF.md` and `ROADMAP.md`, tick the
   epic's checklist.
9. **Finish**: open the pull request to `main` with what is done, what is left and the checks (gate 3).
