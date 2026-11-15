# Session tree spike (#243, milestone 0.3)

## Goal

On OpenCode 2.3.0, on a throwaway local repository (never bived-apps/bive), does a child session created
with `parentID` and moved into `.worktrees/issue-<n>` keep its parent and appear as a descendant?

## Setup

A throwaway git repository and worktree are created; the coordinator records the created session ids and
the worktree path in a file under `.bive/state/`.

## Steps

1. Create the child: `POST /api/session` with `agent: "delegate"`, `model` and `parentID: <parentID>`,
   plus the coordinator metadata; record the returned session id.
2. Move it: `POST /api/session/<id>/move` with `{directory: "<worktree>"}`; then `GET /api/session/<id>`.
3. List: `GET /api/experimental/job?sessionID=<parent>&descendants=true`; record the answer.
4. How: prompt the moved child (`POST /api/session/<id>/prompt`) to write a named file at the throwaway
   repository's root (outside its worktree, inside the parent's checkout) with its write tool; record the
   tool's result (a worktree-guard refusal, or the file existing).
5. Failing child: (i) create a second child whose prompt asks it to run a command its agent is denied
   (e.g. `opencode --version`, denied by PR #301); record its outcome and the job status. (ii) Restart: only
   after the owner answers yes to a fixed-choice question; otherwise record "not run".
6. TUI and Desktop: the coordinator asks the owner, with fixed choices, what the TUI child keys and Desktop
   show for the parent; the owner looks, the coordinator records the answer.

## Pass/fail

- (a) pass/fail: the moved child keeps its `parentID` and is listed as a descendant of the parent.
- (b) pass/fail: after the move, the guard uses the child's own worktree as root and refuses that write.
- (c) pass/fail: the TUI (child navigation keys) and the Desktop show the moved child.
- (d) pass/fail: the failing child's outcome; the restart, if the owner allows a restart.

## Cleanup

Delete the throwaway repository, worktree and sessions by exact ids only, never by pattern; no restart
without the owner's explicit yes.

## Decision after the spike

Map the results: (a) and (b) pass: adopt parentID + move for every delegate; (b) fails: fix the guard
first (confine a delegate to its own session directory); (c) fails while (a) passes: a Desktop panel or an
upstream issue; (a) fails: an upstream issue, delegates stay unlinked.

Run by the coordinator, not a delegate: the coordinator runs it, delegates are denied `opencode` commands (PR #301).
A restart needs the owner's explicit yes before it runs.
