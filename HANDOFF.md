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
- No build. Tests: `node --test tests/*.test.ts` (Node 22; no bun). `.github/workflows/bive-tests.yml` runs them on
  pull requests and pushes to `main` and `bived`. Worker: `registry/` (deployed by the owner with
  `npx wrangler deploy`).
- The coordinator of Bive is started in a clone with this prompt (OpenCode, model Opus 5.5 or Fable 5.1):

```text
You are the coordinator of bive's milestone 0.1 (GitHub jcherfils/bive). Read AGENTS.md, HANDOFF.md, ROADMAP.md,
then .bive/prompts/COORDINATOR.md: it is your prompt. Integration branch: bived (never push to main; the owner
merges bived into main). Work epic by epic in ROADMAP order; split each into issues labelled delegate (goal, read
first, steps, done-when, tests), and stop at gate 1 to show me the split before any delegate starts. Delegates run
on the models of .bive/models.json, one worktree each under .worktrees/issue-<n>, with BIVE_ROLE=delegate; they push
their branches and return reports. You alone create and review each PR (diff, node --test, a complete report.md);
squash-merge as "#N: title". Bive's
own rule applies to Bive: nothing enters the template that a role or a human does not read during a task.
```

- Delegates get no prompt to paste: the coordinator hands them `.bive/state/briefs/<n>.md`, and
  `.bive/prompts/DELEGATE.md` is their system prompt through the `delegate` agent of `opencode.jsonc`.
- The supervisor is the owner with their Claude project (`.bive/prompts/SUPERVISOR.md`).
- In Bive's coordinator session, `/wait-for-merge` watches the PR for the current branch and submits a follow-up prompt
  to that same session when it merges, closes, or reaches its eight-hour limit. It uses local `gh` authentication,
  works only in `jcherfils/bive`, and requires the local OpenCode server to remain available while waiting.

## Decisions

- **Supervisor operational work (owner, 2026-11-09)**: when directly asked, the supervisor may perform operational
  work, including acting as coordinator, while explicitly using that role's rules and git identity. Only one
  coordinator may act at a time; log the work and hand back when a coordinator is running. If a Bive PR exists for
  the current session's branch, automatically launch `/wait-for-merge` in that same session, scoped only to that
  session/PR. This does not authorize direct pushes to `main` or unasked product-code work.
- **Delegated merge rights (owner, 2026-11-09)**: the supervisor may grant the coordinator a merge right only in
  writing (the coordinator's brief or an issue comment), stating scope (one batch or named pull requests), target
  branch, and expiry (date or end of batch). Log each grant here with its date and those three limits; identify the
  grant in every merge made under it. It authorizes no work outside those limits and never permits direct pushes to
  `main`. No standing grant is in effect.
- **No general machinery (owner, 2026-11-08)**: no delegation tools, automatic provider probe/search tool, or package.
  A one-model manual availability check is documented in `docs/PROVIDERS.md`; it is not a probe tool. Reviewed and
  confirmed by an independent read ("Bive — avis critique", Fable, 2026-11-08).
- **Local PR wait command (owner, 2026-11-09)**: the Bive-only `/wait-for-merge` coordinator command is a narrow
  exception to general automation. It polls the current branch's PR read-only through the local `gh` login, queues a
  result in the invoking session, and stops after merge, closure, or eight hours; it is not a background service.
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
  (`.bive/models.json`); GitHub milestones `0.1` and `bivedream` hold the issues. The plan's five open choices were left
  to the coordinator by the owner and are recorded in ROADMAP › bivedream › Decisions (bivel a profile, no project
  scope, role prompts as agent files, `.bive/OPTIONS.md`, Order 1 as written).
- **Skeletons live in `.bive/templates/` (2026-11-08)**: `HANDOFF.md`, `ROADMAP.md`, `README.md` there are what a
  new project starts from; the root files of this repository are Bive's own. "Use this template" copies `main` as
  is, so the first session of a new project replaces the root files with the skeletons.

## Tasks

ROADMAP.md › 0.1, in order: loading verified, install tested, guard hardened, first full flow on Bive itself,
satellites out, first project installed. GitHub issues are the source of truth once the coordinator has split them.

## Watch out

- A plugin OpenCode 2 refuses fails silently for the user: only the server log (`~/.local/share/opencode/log/`,
  "failed to load plugin") and `opencode plugin list` (ID `-`) show it. Check both after any change to a plugin.
  `plugin list` shows a project's plugins only once a session has loaded them: in a fresh clone (or with
  `--standalone`) it answers "No plugins found" although they load. Start a session there first.
- token-ratio reads `session.step.ended` for agent tokens and asks the server for a session's agent and model once
  (cached, dropped when the session switches model or agent). If OpenCode renames an event, tokens stop silently:
  after an OpenCode upgrade, check that `.bive/state/tokens.jsonl` still grows.
- The guard's shell check is a filter, not a sandbox: it refuses redirections and, for a delegate, any path outside
  the worktree but the system prefixes (`/usr`, `/tmp`, …). `external_directory: deny` in `opencode.jsonc` is the
  belt; whether it treats a worktree of the same repository as outside is unverified. Seen 2026-11-08 from the
  coordinator's session: it refuses `cd ../bive-15` and `cd <absolute path>` and a tool's `workdir` outside, but lets
  `git worktree add ../bive-15` and `ls ../bive-none` through. So the coordinator can create a worktree but not start
  a delegate in it (ROADMAP 0.1 › 4). The guard also refuses a non-delegate's `workdir` outside its checkout. Hence
  the layout `.worktrees/issue-<n>` inside the checkout (#22), which a project ran a whole batch with.
- The guard knows a delegate by `BIVE_ROLE=delegate`, a session directory `.worktrees/issue-<n>`, or the role file
  `.bive/state/role` (#36). A delegate run as a child session or on the shared OpenCode server carries no variable
  (#21); in the coordinator's session, writes and shell `workdir` under `.worktrees/issue-<n>/` are then checked as
  that delegate's, but a command run from the checkout's root that only names such a path (`cd .worktrees/… && …`)
  is not, and a delegate session elsewhere without the variable or the role file fails open.
- Some Linux distributions build Node without TypeScript support (`node -p process.features.typescript` is
  `false`, the tests fail with `ERR_UNKNOWN_FILE_EXTENSION`): use an official Node 22+ build.
- `.bive/registry-id`, once committed, is public: the registry is a count, not a proof.
- GitHub's PR merge buttons are configured at repository level under Settings → General → Pull Requests; the desired
  methods are recorded in `AGENTS.md` › Project rules. Bive allows `merge` and `squash`, not `rebase`. For issue PRs
  into `bived`, the coordinator uses the local squash procedure in `docs/COORDINATING.md` and supplies `--author` to
  preserve the delegate as commit author. "Closes #N" acts on merges into `main` only: the coordinator closes the
  issue when it merges into `bived`.
- The guard's shell check scans the whole command text: a heredoc or a message that quotes a redirect such as
  `echo x > ../f` is refused too. Put long bodies in a file under `.bive/state/` and pass `--body-file`.
- A prompt that says "show me" or "ask me" without "stop and wait" is run through by a model, all the more under
  `opencode run`: it assumes the answers. Any prompt with a human step must end its turn there, and must never let
  the agent create a repository or a remote (README › Install, #17).
- Branch deletion and branch protection through the API were refused from the review session's proxy; the owner does
  those in GitHub's settings.

## Session log

- **2026-11-09, supervisor openai/gpt-6-luna**: at the owner's request, verified PR #59 merged, closed issue #58, and
  handed the next coordinator task to issue #33. GitHub CLI uses the repository owner's account; GitHub collaborator
  status belongs to that account, not to the model identity.

- **2026-11-08, field report of a Python / ImGui project (coordinator Opus 5.5, started as a subagent of that
  project's coordinator)**: the first field report (posted on #35) became #22 (worktrees in `.worktrees/issue-<n>`
  inside the checkout, git-ignored), #28 (identity with `git config --worktree`, and after a model switch), #36
  (the guard knows a delegate by its worktree path or `.bive/state/role`, also as a child session; closes #21), #37
  (the review as a checklist in step 7, the core run once per batch in step 9, `docs/COORDINATING.md`) and #35 (field
  reports: rule, template, prompt lines). All coordinator work (inviolable files), done by the coordinator itself on
  one branch and one PR each (#38–#42), squash-merged locally into `bived` and the PRs closed with the commit. The
  session had no subagent tool. Core run once at the end: 24 tests pass. The machine's distro Node 24 has no
  TypeScript support (`ERR_UNKNOWN_FILE_EXTENSION`); the tests ran on an official Node 22 binary under
  `.bive/state/`. Not verified live: the guard inside OpenCode (`opencode plugin list`, a subagent refused on
  `.worktrees/issue-<n>/AGENTS.md`).

- **2026-11-08, 0.1 › 1 and 2 (coordinator Opus 5.5)**: fresh-clone check passed (#13): 0.1 › 1 done. It showed
  token-ratio counting every session on the server, not only its own: fixed by an exact directory match (#14, live
  check in a clone). `plugin list` lists nothing before a session has loaded the plugins (AGENTS.md core check
  reworded). The first delegate (#15, guard test cases) could not start: `external_directory: deny` refuses the
  coordinator's `cd ../bive-15`; the owner chose to wait for bivedream › *Delegates as sessions* (#15 moved there, #16
  waits on it). Install tested (#17) on two local repositories: the old prompt let a free model skip the diff and
  the questions and create a private GitHub repository (`jcherfils/install-empty`, the owner decides its fate); the
  two-turn prompt passed both cases. Test repositories nested under `.bive/state/` inherit this checkout's
  `opencode.jsonc` and plugins: a truer install test needs a directory outside, which `external_directory` forbids.

- **2026-11-08, 0.1 › 1 (coordinator Fable 5.1, supervisor Fable 5.1 in the same session at the owner's request)**:
  found both plugins refused by OpenCode 2.2.5 (V1 API, not the folder name); gate 1 split epic 1 into #4 (guard)
  and #5 (token-ratio), coordinator work. #4: guard ported to `.opencode/plugins/worktree-guard/` (`check.ts` +
  `index.ts`), tests on `node --test`, inviolable pattern `.opencode/plugins?/` everywhere. Owner's decisions:
  delegates on the free OpenCode models (`.bive/models.json`), registry Worker's D1 id committed. Then #8: the
  bivedream plan (ROADMAP › bivedream) after reading OpenCode 2.2.5's API and docs and probing GitHub's API on this
  repository; findings that became epics: sessions created by API in a worktree with an agent and permissions,
  OpenCode's own shell scanner, GitHub sub-issues and dependencies, template-sync Actions. Lessons of the day in
  Watch out: GitHub's squash loses the author; "Closes" works on `main` only; the guard's text filter bit the
  coordinator once. Then #5: token-ratio ported to `.opencode/plugins/token-ratio/` (`lib.ts` + `index.ts`): human
  tokens from the `prompt` hook, agent tokens from `session.step.ended`, step time from `session.step.started`;
  registry and gist unchanged; the V1 folder `.opencode/plugin/` is gone; `tokens.jsonl` fills. Merged with
  GitHub's *rebase* button, which kept the coordinator as author. The plan's five choices were left to the
  coordinator by the owner (ROADMAP › bivedream › Decisions). README diagram in Mermaid at the owner's request (PR #7).
- **2026-11-08, 0.0 (owner, Fable and Opus in the owner's Claude project)**: the template written, then the history
  flattened into this one commit at the owner's request. Roles, transmission contract, tight `opencode.jsonc`,
  worktree guard (files and shell paths), MCP over SSH, token ratio, inviolable prompts, opt-in and filtered
  registry, browser help, Bive's own HANDOFF and ROADMAP with skeletons in `.bive/templates/`, minimal README with
  `docs/`, generic coding rules in AGENTS.md chosen by the owner (commits authored under the agent's role, model name and version), no project named. Before Bive (11-02 to 11-07)
  the flow ran by hand on the owner's first project, a 1.0 of 106 issues, with a coordinator (Fable, then Opus)
  and Sonnet delegates, one worktree per issue; Delege, the earlier standalone tool, was dropped on 11-03: too much
  machinery around too weak models, and a delegate's writes escaped its worktree, the bug the guard exists for.
