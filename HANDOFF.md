# Handoff

Current state only; kept current by the coordinator once per batch (`AGENTS.md`). Budget: at most 100 lines
(`docs/COORDINATING.md` › Short handoffs). Full history before 2026-11-14, with every decision's reasoning, the old
session log and the supervisor draws: [HANDOFF.md at 83e3d9f](https://github.com/bived-apps/bive/blob/83e3d9f/HANDOFF.md)
(`git show 83e3d9f:HANDOFF.md`). Draw results and qualifications live in bived-apps/bench, not here.

## Goal

Bive is a repository template for building software with LLM agents in three roles (advisor, coordinator, delegates) on
OpenCode 2, with two plugins: a guard refusing writes outside the session's worktree, and a human/agent token counter.
It develops itself with its own flow: this repository is the template and its first example.

## Running it

- Repository `bived-apps/bive`. Integration branch **`bived`** (agents' PRs); `main` is the template people copy,
  protected, and the owner's alone. Owner named in `.bive/gate.json` (#249).
- Tests: `node --test tests/*.test.ts` (Node 22, no build, no bun); CI is `.github/workflows/bive-tests.yml`.
- Pull first and read GitHub before acting (`AGENTS.md` › Rules). Open work: the milestone, not this file:
  `gh issue list --milestone 0.2.1 --state open`; `gh pr list --state open --search 'milestone:"0.2.1"'`.
- Start a coordinator with `.bive/templates/launch.md` (non-empty `Read:`); delegates get `.bive/state/briefs/<n>.md`
  as a session created under the coordinator in `.worktrees/issue-<n>` (`docs/COORDINATING.md`).
- Authority: the owner alone authorizes work, teams, gates, merges and test releases; the advisor answers one
  read-only question and stops (`.bive/prompts/ADVISOR.md`; `SUPERVISOR.md` is a retired pointer). Opt-in coordinator
  merges: `docs/COORDINATOR-MERGES.md`; off (`coordinatorMerges: false`), no grant exists.

## Decisions (owner, dated; reasoning in the history link)

- 2026-11-14 GPT team (supersedes the free team below): coordinator `openai/gpt-6.1-sol`; delegates `openai/gpt-6-luna`,
  then the free four as fallback (`.bive/models.json`). Both GPT routes answered a tool-free availability probe; not a
  qualification. OpenAI prices are not shown in the catalog (owner's account).
- 2026-11-14 free team: coordinator `opencode-go/beam-free`; delegates `opencode/deepseek-v4.1-flash-free`,
  `opencode/glm-5.3-flash-free`, `opencode-go/longcat-2.5-free`, `opencode/mimo-v2.6-flash-free` (`.bive/models.json`;
  availability probes, not qualification). Excluded: `big-pickle`, `iceman-contributor-free`, `beam-free` and
  `ollama-cloud/beam` (quota). No paid fallback. Parent-approval key: per-grant ed25519, owner-generated.
- 2026-11-14 correction: the 2026-11-13 #262 work was written by Sonnet 5.5, not Sol; no Sol review happened. Protected
  files still need an independent review. Pushed history is not rewritten; sign `coordinator anthropic/claude-sonnet-5-5`.
- 2026-11-13 #262: owner-only supervisory authority, question-only advisor, `main` owner-only, opt-in coordinator merges
  (generic on any Bive app). #247 pull first; #249 gate owner named in `.bive/gate.json`.
- 2026-11-12: #128 no stacked PRs; #132 skill provisioning contract D1–D10 (`docs/SKILL-PROVISIONING.md` §10); 0.2
  delegates as sessions; #202 launch brief is a GitHub comment; #200 skippable checks in `.bive/gate.json`; #203
  coordinator minimum is a bench pass; registry on, Worker live; Pages from bived-apps/registry.
- 2026-11-10: promotion only from bench; "Ready to merge" comment is the hand-over (#86); inspect before delegating.
- 2026-11-09: roles separated (whoever merges did not write); merge gate kept as a check (dated label, pinned head);
  several coordinators (at most two); checks watched with `gh`; `merge` method only; `pr-merge-wait` removed; 0.1 before
  bivedream; a supervisor agent allowed (superseded by 2026-11-13).
- 2026-11-08: no general machinery; nothing in the template unread during a task; registry opt-in (3 sessions on 2
  days; 50 new a day); speed metric tokens/s; `main` minimal, `bived` for agents; plugins on the OpenCode 2 API under
  `.opencode/plugins/`; bivedream is a vision, not a release; skeletons in `.bive/templates/`.

## Tasks

- Milestone 0.2.1 (`https://github.com/bived-apps/bive/milestone/5`) is the queue. Merged by the owner: #263, #267 to
  #277, #279 to #293 (guard, process docs, short handoff, designs, role context, jury removed, Folds cast and README,
  GPT team, one-App checklist `docs/GITHUB-APP.md`, `lib/role-start.ts`, `lib/ci-evidence.ts`, quick choices).
  Closed: #224 to #227, #229, #230, #233, #234, #244.
- Owner steps: #232 two smoke tests (fresh interactive session asks once; a coordinator-started delegate never asks;
  no plugin wiring, the guard already fails closed); create and install the agents App (#235, checklist in
  `docs/GITHUB-APP.md`; per-role #236 to #238, #240 not planned, open); #245 live read-only checks; #278 close or keep.
- Blocked: #231 (bench evidence); #254, #261 (wrangler reconnect), #242, #243 (owner decisions); #241 is the tracker.
- Run once on `main`: #229's close-issues workflow only activates there. Restart the OpenCode server to load the new guard.
- Open owner questions: a live dry run of `bive_coordinator_merge` on a scratch repo; bench sequencing (bench PRs #72, #74
  are open and its history is frozen); #120 who merges before a bench pass; #110 remark 6.
- Other apps: registry PR #3 and workspace template PR #4 are merged; FiFoo migration: not started.

## Watch out

- A plugin OpenCode 2 refuses fails silently: check `~/.local/share/opencode/log/` and `opencode plugin list` (ID `-`)
  after any plugin change; it lists a project's plugins only after a session loaded them. After an OpenCode upgrade,
  check that `.bive/state/tokens.jsonl` still grows (token-ratio reads `session.step.ended`).
- The guard is a text filter, not a sandbox, and binds delegates, not the coordinator. A delegate is known by
  `BIVE_ROLE=delegate`, a `.worktrees/issue-<n>` directory or `.bive/state/role`; a delegate elsewhere without those
  fails open. Delegates write scratch under `.bive/state/`, not `/tmp` or `$TMPDIR` (#224); quoted prose is inert only
  after message options, `echo`, `grep` or a non-writing inline script (#225); heredoc bodies are removed first.
- `Closes #N` acts on `main` only: close an issue after the merge into `bived` once the merge commit is reachable
  (#229's workflow does it once on `main`). Merge method `merge` only (squash loses the author).
- `bive-merge-gate` runs on `pull_request_target`: its workflow file comes from `main`, its script from the PR's base.
  A change to its job name or script must reach `main` and the integration branches together.
- A prompt with a human step must end its turn there (`ask`/`show me` without "stop and wait" is run through).
  `opencode debug agents` prints the resolved agents; a missing `{file:…}` gives an empty prompt silently.
- Some Linux Node builds lack TypeScript support: use an official Node 22+. `.bive/registry-id` is public once committed.
- Registry: a Cloudflare 403 is wrangler's login (`wrangler whoami`, `wrangler login`; `docs/REGISTRY.md`), not a model.
  The page's stats URL is fixed (registry PR #1); 0.2.1 sync is registry PR #4.
- Branch deletion and protection through the API are refused from some proxies: the owner does those in GitHub.

## Session log

- **2026-11-14, coordinator anthropic/claude-sonnet-5-5**: advisor role merged (#263, `83e3d9f`); free team approved;
  milestone 0.2.1 batches #267–#272 merged by the owner; #273 and #274 open; the root handoff cut from 416 to this short form, history linked above.
- **2026-11-14, coordinator anthropic/claude-opus-5-5**: #286 to #293 merged by the owner (GPT team, one App, cast,
  #232 resolver, #227 policy, #244 skill); delegate `openai/gpt-6-luna` reports need the template asked explicitly.
