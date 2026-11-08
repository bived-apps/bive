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
- No build. Tests: `bun test tests/`. Worker: `registry/` (deployed by the owner with `npx wrangler deploy`).
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
- **Skeletons live in `.bive/templates/` (2026-11-08)**: `HANDOFF.md`, `ROADMAP.md`, `README.md` there are what a
  new project starts from; the root files of this repository are Bive's own. "Use this template" copies `main` as
  is, so the first session of a new project replaces the root files with the skeletons.

## Tasks

ROADMAP.md › 0.1, in order: loading verified, install tested, guard hardened, first full flow on Bive itself,
satellites out, FiFoo installed. GitHub issues are the source of truth once the coordinator has split them.

## Watch out

- OpenCode 2's documentation auto-discovers `.opencode/plugins/`; this repository uses `.opencode/plugin/`. Verify
  on the owner's machine before anything else (ROADMAP 0.1 › 1).
- The guard's shell check is a filter, not a sandbox: it refuses redirections and, for a delegate, any path outside
  the worktree but the system prefixes (`/usr`, `/tmp`, …). `external_directory: deny` in `opencode.jsonc` is the
  belt; whether it treats a worktree of the same repository as outside is unverified.
- `.bive/registry-id`, once committed, is public: the registry is a count, not a proof.
- Branch deletion and branch protection through the API were refused from the review session's proxy; the owner does
  those in GitHub's settings.

## Session log

- **2026-11-08, Fable (review thread), PR to `bived`**: Bive's own HANDOFF.md and ROADMAP.md (0.1) written; the
  skeletons moved to `.bive/templates/` with a README skeleton; README cut to a minimal, illustrative page, its long
  sections moved to `docs/` (SSH, providers, tokens, registry); the install prompt and `COORDINATOR.md` say to start a
  new project from the skeletons. Integration branch `bived` created from `main` (`dev` to be deleted by the owner).
- **2026-11-08, Fable (review thread), PR #1**: registry opt-in and filtered; guard checks shell paths (redirections
  for every role, any outside path for a delegate); speed metric replaced; tests in `tests/`; AGENTS.md rule added.
- **2026-11-08, design thread (Opus), nine commits on `main`**: the template (roles, transmission contract, tight
  `opencode.jsonc`, worktree guard, MCP over SSH); shorter prompts and the token-ratio plugin with a gist badge; the
  browser help page (WebLLM); the public registry (Cloudflare Worker, D1, live page) and MIT licence; inviolable
  prompts (delegates never change Bive's files, project additions folder, guard and PR check); violations counter and
  the 5D cascade; the llm variable (tokens per agent and model); response-time columns.
- **Before Bive (FiFoo, 2026-11-02 to 11-07)**: the flow ran by hand on FiFoo's 1.0 (106 issues): a coordinator
  (Fable, then Opus) and Sonnet delegates, one worktree per issue. Delege, the earlier standalone tool, was dropped
  on 11-03: too much machinery around too weak models, and a delegate's writes escaped its worktree (issue #101),
  the bug the guard exists for.
