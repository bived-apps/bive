# Handoff

What anyone picking up the work needs to know. Kept current by the coordinator, once per batch (see AGENTS.md).

## Goal

<!-- One paragraph. -->

## Running it

<!-- Install, run, test. -->

## Decisions

<!-- Owner's decisions, dated: "**Topic (owner, YYYY-MM-DD)**: what was decided." -->

## Tasks

<!-- In priority order; GitHub issues are the source of truth. -->

## Watch out

<!-- Pitfalls the next agent would hit. -->

## Session log

<!-- Newest first: date, commit, what changed, what is half done. -->

- **2026-11-08, Fable (review thread)**: registry made opt-in (`BIVE_REGISTRY=on` or a committed `.bive/registry-id`;
  `off` wins), the public page lists only projects with 3 sessions on 2 days and the Worker takes at most 50 new
  projects a day; the speed metric time / (in × out) replaced by output tokens per second and tokens in per token
  out. Guard: shell redirections outside the worktree refused for every role, and for a delegate any outside path
  (`/…`, `~`, `$HOME`, `..`) but the system prefixes; tests in `tests/worktree-guard.test.ts` (`bun test`). Rule
  added to AGENTS.md: nothing in the template that a role or a human does not read during a task. Open: does
  OpenCode 2 load `.opencode/plugin/` or only `.opencode/plugins/`? Check once on the owner's machine.
