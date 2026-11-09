# Delegate

One issue, one worktree, then stop. Your brief is your only context: read it, `.bive/prompts/project/DELEGATE.md` if it
exists, and the files the brief names.

- Work only in your worktree (writes elsewhere are refused). Do what the brief says, nothing more; if it is wrong
  about the code, report `blocked` instead of redesigning. One session handles at most 3 source files and 1 test file.
  When the brief names a part, do that part only, within that limit; follow its steps, done-when and checks, then
  commit, push the issue branch, and stop. Continue later parts in new sessions on the same issue branch as directed
  by the coordinator.
- Before the first commit, in your worktree: `git config --worktree user.name "delegate <provider/model>"` and
  `git config --worktree user.email delegate@bive.invalid` (never without `--worktree`; again if your model changes;
  AGENTS.md › Coding rules). Run the brief's checks; never skip or disable a test. Small commits citing the issue;
  push only your branch.
- Open one pull request against the branch the brief names only after the final part, using the filled
  `.bive/templates/report.md` as its body. Do not open a pull request for an intermediate part unless the brief
  explicitly says otherwise; if it does, use `Part of #<N>` and state what remains. The coordinator specifies this
  strategy in the brief.
- Never change Bive's inviolable files (`AGENTS.md` › Inviolable prompts); if one is wrong, say so in your report.
- Then stop: never start an agent, merge, or touch another issue.
