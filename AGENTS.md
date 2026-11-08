# Instructions for agents

Read this file, then [`HANDOFF.md`](HANDOFF.md), before changing anything. Your role's prompt is in
[`.bive/prompts/`](.bive/prompts/).

## Roles

- **Supervisor**: the owner (with their Claude project). Agrees the plan and each epic's split, merges to `main`.
- **Coordinator**: splits, briefs, starts delegates, reviews, merges into the integration branch. Never pushes to `main`.
- **Delegate**: one issue, one worktree, one pull request, then stops. Never starts another agent.

## Rules

- **One branch and one pull request per issue**: `issue/<n>-<slug>`. The body starts with `Closes #N` (or `Part of #N`
  and what is left) and holds the delegate's report.
- **Claim the issue** with a short comment before working on it; update it with the result.
- **Stay in your worktree**: the guard plugin refuses writes outside it, including shell redirections; a delegate's
  commands may not name any path outside it (absolute, `~`, `$HOME`, `..`) apart from the system folders.
- **Never**: force-push, rewrite pushed history, push to `main`, `rm -rf`, read SSH keys or the private paths listed
  in `opencode.jsonc`.
- **Keep sessions and prompts short**: continue a stuck delegate with one short message rather than a new session;
  a brief names files to read instead of pasting them. Delegate in small tasks with their own done-when and tests.
- **Keep `HANDOFF.md` and `ROADMAP.md` true**: the coordinator updates them once per batch of merges, in the same
  commit as the code they describe. Delete what is no longer accurate rather than adding contradictions.

## Inviolable prompts

- **A delegate never changes Bive's inviolable files**: the role prompts and their project additions
  (`.bive/prompts/`), the templates (`.bive/templates/`), the plugins (`.opencode/plugin/`), `opencode.jsonc`,
  `.bive/registry-id`, this file and the `bive-*` workflows. If one is wrong, it says so in its report. The guard
  plugin refuses these writes (each refusal counts as a violation in the registry) and the `bive-inviolable` check
  fails any `issue/*` pull request that touches them.
- **Others complete, never edit, the role prompts**: the supervisor or the coordinator adds to a role in
  `.bive/prompts/project/<ROLE>.md`, which may narrow a rule but never loosen or contradict one; the core prompt wins.

## What goes into Bive

Nothing enters the template that is not read by one of the three roles, or by a human, during a task (owner,
2026-11-08). Anything else (a public page, a visualisation, a helper for the registry) lives in its own repository.

## Project rules

<!-- The project's own rules go here: language, data that never leaves the machine, tests, style, licences. -->

## Before committing

<!-- The project's fast checks (lint, the tests of the files touched) and its full checks (the coordinator, once per batch). -->
