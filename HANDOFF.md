# Handoff

What anyone picking up the work needs to know. Kept current by the coordinator, once per batch (see AGENTS.md).

## Goal

Bive is a repository template for building software with LLM agents in three roles (supervisor, coordinator,
delegates) on OpenCode 2, with two small plugins: a guard that refuses writes outside the session's worktree and a
counter of human and agent tokens. Bive develops itself with its own flow, so this repository is both the template
and its first example.

## Running it

- Repository `https://github.com/jcherfils/bive`. Integration branch **`bived`** (agents' pull requests go there);
  `main` is the template people copy and is protected: the owner merges `bived` into it by pull request.
- No build. Tests: `node --test tests/*.test.ts` (Node 22; no bun). Worker: `registry/` (deployed by the owner with
  `npx wrangler deploy`).
- The coordinator of Bive is started in a clone with this prompt (OpenCode, model Opus 5.5 or Fable 5.1):

```text
You are the coordinator of bive's milestone 0.1 (GitHub jcherfils/bive). Read AGENTS.md, HANDOFF.md, ROADMAP.md,
then .bive/prompts/COORDINATOR.md: it is your prompt. Integration branch: bived (never push to main; the owner
merges bived into main). Work epic by epic in ROADMAP order; split each into issues labelled delegate (goal, read
first, steps, done-when, tests), and stop at gate 1 to show me the split before any delegate starts. Delegates run
on the models of .bive/models.json, one worktree each under ../bive-<n>, with BIVE_ROLE=delegate, and open their PR
against bived. Review each PR yourself (diff, bun test, a complete report.md); squash-merge as "#N: title". Bive's
own rule applies to Bive: nothing enters the template that a role or a human does not read during a task.
```

- Delegates get no prompt to paste: the coordinator hands them `.bive/state/briefs/<n>.md`, and
  `.bive/prompts/DELEGATE.md` is their system prompt through the `delegate` agent of `opencode.jsonc`.
- The supervisor is the owner with their Claude project (`.bive/prompts/SUPERVISOR.md`).

## Decisions

- **No machinery (owner, 2026-11-08)**: no delegation tools, no provider probe, no package; a template and two
  plugins. Reviewed and confirmed by an independent read ("Bive — avis critique", Fable, 2026-11-08).
- **Nothing in the template that a role or a human does not read during a task (owner, 2026-11-08)**: satellites
  (registry page, browser help) go to their own repository (ROADMAP 0.1 › 5).
- **Registry opt-in (owner, 2026-11-08)**: off unless `BIVE_REGISTRY=on` or a committed `.bive/registry-id`; the
  public page lists only projects with 3 sessions on 2 days; at most 50 new projects a day. Bive joins its own
  registry as project #1.
- **Speed metric (owner, 2026-11-08)**: output tokens per second per model; time / (tokens in × tokens out) dropped.
- **Branches (owner, 2026-11-08)**: `main` minimal and illustrative, protected; `bived` for the agents.
- **Plugins on the OpenCode 2 API, under `.opencode/plugins/` (gate 1, 2026-11-08)**: OpenCode 2.2.5 discovers both
  `.opencode/plugin/` and `.opencode/plugins/` but refused Bive's two plugins, written for the V1 API. Each is ported
  to `Plugin.define` in its own folder, decision logic in a pure module the tests import. Test runner: `node --test`
  (Node 22 runs TypeScript directly; bun is not on the owner's machine). Epic 0.1 › 1 is coordinator work: the
  plugins, the workflow and `AGENTS.md` are inviolable, so no delegate can take it (#4, #5).
- **bivedream (owner, 2026-11-08)**: the vision is a ROADMAP section and a GitHub milestone, never reached; versions
  tend to 1.0 (0.9 → 0.91 → … → 0.99 → 0.991, Principles › Versions); existing tools first (OpenCode 2, GitHub,
  maintained Actions), no Bive package; modular and optional beyond the core; delegates on the free OpenCode models
  (`.bive/models.json`); GitHub milestones `0.1` and `bivedream` hold the issues. Open: `bivel` branch or profile,
  `project` scope, role prompts as OpenCode agent files (ROADMAP › bivedream › Decisions).
- **Skeletons live in `.bive/templates/` (2026-11-08)**: `HANDOFF.md`, `ROADMAP.md`, `README.md` there are what a
  new project starts from; the root files of this repository are Bive's own. "Use this template" copies `main` as
  is, so the first session of a new project replaces the root files with the skeletons.

## Tasks

ROADMAP.md › 0.1, in order: loading verified, install tested, guard hardened, first full flow on Bive itself,
satellites out, first project installed. GitHub issues are the source of truth once the coordinator has split them.

## Watch out

- A plugin OpenCode 2 refuses fails silently for the user: only the server log (`~/.local/share/opencode/log/`,
  "failed to load plugin") and `opencode plugin list` (ID `-`) show it. Check both after any change to a plugin.
- token-ratio reads `session.step.ended` for agent tokens and asks the server for a session's agent and model once
  (cached, dropped when the session switches model or agent). If OpenCode renames an event, tokens stop silently:
  after an OpenCode upgrade, check that `.bive/state/tokens.jsonl` still grows.
- The guard's shell check is a filter, not a sandbox: it refuses redirections and, for a delegate, any path outside
  the worktree but the system prefixes (`/usr`, `/tmp`, …). `external_directory: deny` in `opencode.jsonc` is the
  belt; whether it treats a worktree of the same repository as outside is unverified.
- `.bive/registry-id`, once committed, is public: the registry is a count, not a proof.
- GitHub's squash button sets the pull request's GitHub author as commit author (the owner, for #4): squash locally
  (`git merge --squash`, commit as the delegate or coordinator) until ROADMAP › bivedream › Authorship lands. "Closes
  #N" acts on merges into `main` only: the coordinator closes the issue when it merges into `bived`.
- The guard's shell check scans the whole command text: a heredoc or a message that quotes a redirect such as
  `echo x > ../f` is refused too. Put long bodies in a file under `.bive/state/` and pass `--body-file`.
- Branch deletion and branch protection through the API were refused from the review session's proxy; the owner does
  those in GitHub's settings.

## Session log

- **2026-11-08, 0.1 › 1 (coordinator Fable 5.1, supervisor Fable 5.1 in the same session at the owner's request)**:
  found both plugins refused by OpenCode 2.2.5 (V1 API, not the folder name); gate 1 split epic 1 into #4 (guard)
  and #5 (token-ratio), coordinator work. #4: guard ported to `.opencode/plugins/worktree-guard/` (`check.ts` +
  `index.ts`), tests on `node --test`, inviolable pattern `.opencode/plugins?/` everywhere. Owner's decisions:
  delegates on the free OpenCode models (`.bive/models.json`), registry Worker's D1 id committed. Then #8: the
  bivedream plan (ROADMAP › bivedream) after reading OpenCode 2.2.5's API and docs and probing GitHub's API on this
  repository; findings that became epics: sessions created by API in a worktree with an agent and permissions,
  OpenCode's own shell scanner, GitHub sub-issues and dependencies, template-sync Actions. Lessons of the day in
  Watch out: GitHub's squash loses the author; "Closes" works on `main` only; the guard's text filter bit the
  coordinator once.
- **2026-11-08, 0.0 (owner, Fable and Opus in the owner's Claude project)**: the template written, then the history
  flattened into this one commit at the owner's request. Roles, transmission contract, tight `opencode.jsonc`,
  worktree guard (files and shell paths), MCP over SSH, token ratio, inviolable prompts, opt-in and filtered
  registry, browser help, Bive's own HANDOFF and ROADMAP with skeletons in `.bive/templates/`, minimal README with
  `docs/`, generic coding rules in AGENTS.md chosen by the owner (commits authored under the agent's role, model name and version), no project named. Before Bive (11-02 to 11-07)
  the flow ran by hand on the owner's first project, a 1.0 of 106 issues, with a coordinator (Fable, then Opus)
  and Sonnet delegates, one worktree per issue; Delege, the earlier standalone tool, was dropped on 11-03: too much
  machinery around too weak models, and a delegate's writes escaped its worktree, the bug the guard exists for.
