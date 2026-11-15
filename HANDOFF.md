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

- 2026-11-15 free team, second (supersedes the lines below; the first free team hit the free usage limit): delegates
  `opencode-go/beam-free`, `opencode/iceman-free` (both proven that day), then `opencode/longcat-2.5-free`,
  `opencode/nemotron-3.5-lightning-free`, `openrouter/nvidia/nemotron-3-ultra-550b-a55b:free` (one-call probe only: a
  small real task first), `anthropic/claude-fable-5-2` last (drawings). Coordinator `anthropic/claude-opus-5-5`.
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

- Released on 2026-11-15: 0.2.1 (gate 3), 0.2.2 (the look, the field-report rules), 0.2.3 (the flow picture and its
  Mermaid twin agree, #383). 0.3 (milestone 6) holds #120, #231, #243, #245, #254, #336, #344; the 0.3 launch is the owner's call.
- Live since 2026-11-15, each in its own repository: the site https://bived-apps.github.io/ (`bived-apps.github.io`),
  the organization page (`.github`, `profile/README.md`), the registry page (`registry`, the cube from one project).
  The App's logo is the flower; the organization picture is the B; the social card is uploaded.
- App `bive-agents` (ID 5761164): agents act as `bive-agents[bot]` in the sessions the broker serves
  (`docs/GITHUB-APP.md`); the other sessions act as the owner and must sign. OpenCode is 2.3.0 (guard, token counter,
  schedules re-checked live 2026-11-15).
- Coordinator since 2026-11-15: `anthropic/claude-opus-5-5`, started as OpenCode's `build`; next sessions pick the
  `coordinator` agent (#376: the counter then reports the role). The `opencode/` free models share one usage limit;
  `opencode-go/beam-free` and the OpenRouter model are not in it. FiFoo's migration (FiFoo#1813): the owner chose (a).
- Open owner questions: a live dry run of `bive_coordinator_merge` on a scratch repo; bench sequencing (bench PRs #72, #74
  are open and its history is frozen); #120 who merges before a bench pass; #110 remark 6.

## Watch out

- A plugin OpenCode 2 refuses fails silently: check `~/.local/share/opencode/log/` and `opencode plugin list` (ID `-`)
  after any plugin change; it lists a project's plugins only after a session loaded them. After an OpenCode upgrade,
  check that `.bive/state/tokens.jsonl` still grows (token-ratio reads `session.step.ended`).
- The guard is a text filter, not a sandbox: it refuses writes outside the session's checkout for every role, the
  coordinator included (#320). What makes a delegate different is that the guard recognizes it (`BIVE_ROLE=delegate`,
  a `.worktrees/issue-<n>` directory or `.bive/state/role`) and then also refuses the paths its commands may not
  name; a delegate elsewhere without those fails open. Every role writes scratch under `.bive/state/`, not `/tmp` or
  `$TMPDIR` (#224, #345); quoted prose is inert only after message options, `echo`, `grep` or a non-writing inline script
  (#225); heredoc bodies are removed first.
- `Closes #N` acts on `main` only: close an issue after the merge into `bived` once the merge commit is reachable
  (#229's workflow does it once on `main`). Merge method `merge` only (squash loses the author).
- `opencode service set env …` restarts the background service: it kills the session that runs it (an agent session
  that sets it dies with the tool call). The owner runs it, from their own terminal.
- `bive-merge-gate` runs on `pull_request_target`: its workflow file comes from `main`, its script from the PR's base.
  A change to its job name or script must reach `main` and the integration branches together.
- A prompt with a human step must end its turn there (`ask`/`show me` without "stop and wait" is run through).
  `opencode debug agents` prints the resolved agents; a missing `{file:…}` gives an empty prompt silently.
- Some Linux Node builds lack TypeScript support: use an official Node 22+. `.bive/registry-id` is public once committed.
- Registry: a Cloudflare 403 is wrangler's login (`wrangler whoami`, `wrangler login`; `docs/REGISTRY.md`), not a model.
  The page's stats URL is fixed (registry PR #1); 0.2.1 sync is registry PR #4.
- Branch deletion and protection through the API are refused from some proxies: the owner does those in GitHub.

## Session log

- **2026-11-15, coordinator anthropic/claude-opus-5-5**: 0.2.1 released (`v0.2.1`); the mark, wordmark, flower and
  social card; the site, organization and registry pages in their repositories; the field-report rules (#374, #378),
  the counter's role and canonical model (#379), the temp-folder rule for every role (#380); 0.2.2 and 0.2.3 released.
- **2026-11-15, coordinator opencode-go/beam-free**: relook batch merged (#326, #327, #328); #336 and #339 filed;
  #338 and #340 list Opus and beam-free as coordinators; FiFoo migration plan filed (FiFoo#1813).
- **2026-11-15, coordinator opencode/minimax-m3.1-flash-free**: options C + D for the token broker (#299, #313, #314);
  field report remarks #317–#320 fixed (#321, #322); the wake-up schedule proved.
