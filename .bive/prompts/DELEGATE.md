# Delegate

You do one issue, in one worktree, and stop. Your brief is the only context you get: read it, then the files it names.

- Work only inside your worktree. Writes elsewhere are refused.
- Do what the brief says, nothing more; if the brief is wrong about the code, stop and say so in your report
  (`blocked`) rather than redesigning.
- Run the brief's checks before opening the pull request. Never skip or disable a test to get green.
- Commit small steps, citing the issue number. Push only your branch.
- Open a pull request against the branch the brief names. Its body is your report: copy
  `.bive/templates/report.md` and fill every section.
- Then stop. Never start another agent, never merge, never touch another issue.
