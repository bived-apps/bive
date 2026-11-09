# The coordinator's routine, as commands

What `.bive/prompts/COORDINATOR.md` steps 5, 7 and 9 mean at the shell, for a coordinator that wants the exact
commands. `<n>` is the issue, `<slug>` a short name, `<base>` the integration branch, `<model>` the delegate's
`provider/model`.

## Start a delegate (step 5)

```bash
git worktree add .worktrees/issue-<n> -b issue/<n>-<slug> <base>
git config extensions.worktreeConfig true                     # once per clone
git -C .worktrees/issue-<n> config --worktree user.name "delegate <model>"
git -C .worktrees/issue-<n> config --worktree user.email delegate@bive.invalid
mkdir -p .worktrees/issue-<n>/.bive/state
echo delegate > .worktrees/issue-<n>/.bive/state/role          # the guard's sign
# the brief: .bive/templates/brief.md filled into .bive/state/briefs/<n>.md
gh issue comment <n> --body "Started: branch issue/<n>-<slug>, delegate <model>"
```

A project whose checks need a local environment links it into the worktree (for example
`ln -s "$PWD/.venv" .worktrees/issue-<n>/.venv`).

## Open and review a pull request (step 7)

The delegate pushes its branch and returns the filled report; it never opens a pull request. The coordinator creates
the PR from the pushed branch and uses the report as the PR body. For a multi-part issue, open/update it according to
the brief's timing. If the delegate's final response is not accessible from the coordinator's machine, recover the
report from the final pushed commit body (do not expect the delegate's ignored `.bive/state/` file to travel):

```bash
git fetch origin issue/<n>-<slug>
git show -s --format=%H FETCH_HEAD
git log -1 --format=%b FETCH_HEAD
```

The report's Log section should name the commit SHA; the coordinator fills it in if the report was carried in that
commit body. Save the report on the coordinator's machine in `.bive/state/briefs/<n>-report.md`, then run:

```bash
gh pr create --base <base> --head issue/<n>-<slug> --title "#<n>: <title>" --body-file .bive/state/briefs/<n>-report.md
```

The report body starts with `Closes #<n>` when complete, or `Part of #<n>` and what remains.

```bash
gh pr view <pr> --json body,baseRefName,files,commits \
  --jq '.body, .baseRefName, (.files[].path), (.commits[].authors[] | "\(.name) <\(.email)>")'
```

Read it against the checklist: first line `Closes #N` / `Part of #N`; the sections State, Changed, Checks, Left, Log
filled and no `<!--` left; the base; no path matching the inviolable list (`AGENTS.md` › Inviolable prompts, the same
list as `bive-inviolable`); every author `delegate <provider/model> <delegate@bive.invalid>`. Then the brief's checks
in the worktree if the head changed since the report, and the diff. Merge:

```bash
git switch <base>
git merge --squash issue/<n>-<slug>
git commit --author "delegate <model> <delegate@bive.invalid>" -m "#<n>: <title>"
git push origin <base>
gh issue close <n> --comment "Done in <base> $(git rev-parse --short HEAD)"
```

## After the batch (step 9)

The core checks once, after the last merge, then `HANDOFF.md` and `ROADMAP.md` in one commit. Clean up:
`git worktree list`, then `git worktree remove .worktrees/issue-<n>` for each merged issue (never forced).

## GitHub pull-request merge methods

These options are controlled by the repository, not by `AGENTS.md`. The project records its desired list in
`AGENTS.md` › Project rules; the owner must match it in GitHub **Settings → General → Pull Requests**. To remove the
**Rebase and merge** button, omit `rebase` from the project list and turn off **Allow rebase merging** in GitHub.
This is separate from the coordinator's local `git merge --squash` procedure above.

## Scripting it

A project may script this routine in its own repository (start, review, status, clean): one Python / ImGui project
did, in about 400 lines with tests, and used it for a whole batch. Bive ships no such script (HANDOFF › Decisions,
*No machinery*): the prompt and this page are enough for any coordinator, and a script stays the project's own,
outside Bive's files.
