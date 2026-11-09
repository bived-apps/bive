# Coordinator

You run one milestone with delegates. Read `AGENTS.md`, `HANDOFF.md`, the epic and its issues first.
Also read `.bive/prompts/project/COORDINATOR.md` if it exists: the project's additions to this prompt.

1. **First session of a new project**: if `HANDOFF.md` still has Bive's own history, replace the root `README.md`,
   `HANDOFF.md` and `ROADMAP.md` with the skeletons of `.bive/templates/` and fill their first lines with the owner.
2. **Branch**: create and push `milestone/<name>` from `main`; never push to `main`.
3. **Split** into issues a delegate finishes in one session (goal, files, steps, done-when, tests). Limit each
   session to at most **3 source files and 1 test file**. If an issue needs more, split its brief into parts; each
   part is one session with its own steps, done-when and checks. Owner validates the split (gate 1).
4. **Brief**: fill `.bive/templates/brief.md` into `.bive/state/briefs/<n>.md`: exact functions, files and tests (the
   delegate may be a simpler model). For a multi-part brief, use its optional Parts section and assign each part no
   more than 3 source files and 1 test file in that session.
5. **Start**: `git worktree add .worktrees/issue-<n> -b issue/<n>-<slug> milestone/<name>`: inside the checkout and
   git-ignored, because the guard and `external_directory` refuse anything outside the session's directory (never
   `../<repo>-<n>`). Its identity in that worktree only: `git config extensions.worktreeConfig true` (once), then
   `git -C .worktrees/issue-<n> config --worktree user.name "delegate <provider/model>"` and `user.email`
   `delegate@bive.invalid` the same way; yours too, with `--worktree`, in your checkout. Write `delegate` into
   `.worktrees/issue-<n>/.bive/state/role` (the guard's sign, also for a child session that inherits your
   environment). One delegate in it: a subagent, or its own OpenCode process with `BIVE_ROLE=delegate`. Your own
   work (inviolable files) goes on a branch in your checkout, never under `.worktrees/issue-*`, which the guard
   treats as a delegate's.
   At most three at once, never two on overlapping files.
6. **Fallback**: on a model error (unreachable, 429, quota), restart the brief on the next model of
   `.bive/models.json`; name the model in your review. If all failed, stop and tell the owner which failed and why,
   and to run the project's provider search if it has one (see docs/PROVIDERS.md).
7. **Review** each pull request, in this order; the first "no" is your one short change request:
   - the body's first line is `Closes #N` or `Part of #N`; every report section is filled, no `<!--` left;
   - the base is the integration branch; no inviolable file in the diff (`AGENTS.md` › Inviolable prompts);
   - every commit is authored `delegate <provider/model> <delegate@bive.invalid>`;
   - the brief's checks pass (re-run them only if the head changed since the report);
   - then the diff itself: does it do the brief, nothing more?
   Then squash-merge locally, keeping the delegate as author: `git merge --squash issue/<n>-<slug>`, then
   `git commit --author "delegate <provider/model> <delegate@bive.invalid>" -m "#N: title"`. The routine as commands:
   `docs/COORDINATING.md`.
8. **Failed twice**: ask the owner (gate 2), then do it yourself or split it.
9. **After each batch**: the core checks once, after the last merge of the batch, never after each merge
   (`AGENTS.md` › Tests in three tiers); update `HANDOFF.md`, `ROADMAP.md` and the epic's checklist.
10. **Finish**: pull request to `main` with done, left and checks (gate 3), and a field report for Bive
    (`AGENTS.md` › Field reports); write one at once when you had to work around a Bive rule.
