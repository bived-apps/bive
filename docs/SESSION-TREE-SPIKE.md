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
4. Write outside the worktree but inside the parent's checkout; record whether the guard refuses it.
5. Prompt a failing child; record its outcome; plan one server restart.

## Pass/fail

- (a) pass/fail: the moved child keeps its `parentID` and is listed as a descendant of the parent.
- (b) pass/fail: after the move, the guard uses the child's own worktree as root and refuses that write.
- (c) pass/fail: the TUI (child navigation keys) and the Desktop show the moved child.
- (d) pass/fail: the failing child's outcome; the restart, if the owner allows a restart.

## Cleanup

Delete the throwaway repository, worktree and sessions by exact ids only, never by pattern; no restart
without the owner's explicit yes.

## Decision after the spike

Adopt parentID + move for every delegate, fix the guard first, add a Desktop panel, or file an upstream issue.

Run by the coordinator, not a delegate: the coordinator runs it, delegates are denied `opencode` commands (PR #301).
A restart needs the owner's explicit yes before it runs.
