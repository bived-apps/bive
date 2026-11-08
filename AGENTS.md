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

## Coding rules

Generic, whatever the language (owner, 2026-11-08, taken from the practice of the owner's first project). The project's own rules go under
*Project rules* below.

- **Everything in English**: interface, code, comments, docstrings, documentation.
- **Fail-safe**: no exception swallowed in silence (catch the precise one, or log once and say why); a timeout on
  every subprocess and every network call; a file the program reads may be missing or corrupt without a crash.
- **A linter in the fast checks**; never reformat a whole file; every suppressed warning says why, in parentheses.
- **Tests in three tiers**: *fast* (the delegate, before its pull request: lint and the tests of the files touched),
  *core* (the coordinator, once per batch of merges, never after each merge), *full* (before a release).
- **Docs change in the same commit** as the code they describe (README, reference pages, HANDOFF, ROADMAP).
- **Commits are authored by the agent that made them, under an explicit name** (owner, 2026-11-08): in its working
  copy an agent sets `git config user.name "<role> <provider/model>"`, the model's name **and version**, the same
  name as in the registry's llm variable (e.g. `delegate anthropic/claude-sonnet-5-5`, never `delegate` or
  `Claude`), and `user.email "<role>@bive.invalid"`, never the owner's identity. A squash merge keeps the delegate
  as author; the coordinator is the committer. Anyone must be able to tell from `git log` who wrote each change,
  human or model.
- **No Git hooks**: a delegate is started by the coordinator, never by a Git command.

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

<!-- Filled at install, with the owner (cards). Keep each as one line:
- Data: where the program writes (caches, settings, user data) and what never leaves the machine.
- Licences: where a third-party model, asset or dataset is registered (file + table), checked by which test.
- Runtime and versions the owner's machine imposes.
- Anything the owner decided, dated: "**Topic (owner, YYYY-MM-DD)**: …". -->

## Before committing

<!-- The exact commands of each tier:
- fast (delegate):  <lint command> ; <tests of the files touched> ;
- core (coordinator, once per batch):  <the suite> ;
- full (release):  <everything, on every machine that matters>. -->
