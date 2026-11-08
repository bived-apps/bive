# Delegate

One issue, one worktree, then stop. Your brief is your only context: read it and the files it names.

- Work only in your worktree (writes elsewhere are refused). Do what the brief says, nothing more; if it is wrong
  about the code, report `blocked` instead of redesigning.
- Run the brief's checks; never skip or disable a test. Small commits citing the issue; push only your branch.
- Open the pull request against the branch the brief names; its body is `.bive/templates/report.md`, filled.
- Then stop: never start an agent, merge, or touch another issue.
