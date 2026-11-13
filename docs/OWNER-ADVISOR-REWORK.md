# Owner authority and read-only advisors: cross-app rework

Status: started at the owner's request (2026-11-13); ordinary-code execution blocked by the free Beam usage limit.
Tracking: [bive #262](https://github.com/bived-apps/bive/issues/262).
Owner direction: 2026-11-13. The owner authorized Bive's role change, then requested this cross-app plan.
The owner subsequently said to start the plan, using only free Beam delegates. Start with the reference change;
dependent repositories wait for its review and owner merge. No merges, test releases or benchmark draws are authorized.

## The rule

- The human owner alone authorizes work and merges, merges or closes pull requests, approves teams and gates,
  arbitrates shared files, and releases tests.
- An advisor is simply asked a question about the **current worktree**. It reads relevant files, returns an answer
  to the caller, and stops. It is not a standing manager or another rung of authority.
- Within that answer it may recommend a plan or team, flag risks, or draft decision and handoff text. Advice is not
  authorization. The caller records useful advice and brings owner-only decisions to the owner.
- Advisors do not edit files, commit, push, post comments or reviews, run tests, launch agents, operate workflows,
  approve work/teams/gates, apply authorization or override labels, merge/close PRs, or release tests.
- The coordinator splits, briefs, starts owner-authorized delegates, reviews their work and prepares PRs. It does not
  merge, close PRs, or take over product implementation. Delegates implement one brief in one worktree and report.
- No qualification, benchmark pass, historical supervisor status, shared login, green check or owner invitation to
  advise confers supervisory authority. Legacy supervisor configuration must not remain an authority bypass.

## Inventory and evidence

Read-only inventory on 2026-11-13; implementation must refresh the base, open issues, rules and settings first.

| Repository or surface | Observed evidence | Scope |
| --- | --- | --- |
| `bive` | `AGENTS.md`, role prompts, `opencode.jsonc`, guard, skill manifest, role provisioning, docs and tests | Canonical role definitions and migration procedure. |
| `bench` | `AGENTS.md`, `HANDOFF.md`, `RESULTS.md`, `supervisor-tests/`, coordinator/delegate tests and owner-authorization work | Separate evidence of capability from authority; preserve historical draws and frozen fixtures. |
| `milestone-workspace-template` | README specifies a default `supervisor` agent and supervisor-first startup | Update the reusable workspace and its inherited rules and launch defaults. |
| `registry` | README and `help/index.html`: "Supervisor assistant", old prompt URLs and a coordinator-takes-over suggestion | Align browser help and current presentation; audit telemetry consumers without relabelling old data. |
| `university` | README separates candidates, catalog and results | Audit active lessons and role permissions; preserve experiments and results. |
| `grooms` | Organization inventory; remote README still contains inherited Bive template instructions | Inspect actual code, rules and automation before proposing implementation files. Product behavior is not yet verified. |
| Active installations and synthetic milestone workspaces | Organization inventory includes active and archived `milestone-m-*` repositories; local directories include multiple clones and benchmark worktrees | Distinguish live installations from immutable experimental material before touching anything. |

The inventory is not permission to alter any of these repositories. A local clone is not necessarily current.
Do not bulk-replace every occurrence of "supervisor": some are historical facts or fixture inputs.

## Proposed execution slices

Each repository gets its own issue, dedicated branch and reviewable PRs; no cross-repository write batch.
Split ordinary-code briefs into at most three source files and one test file per part. Assign one writer to shared
files. Dependent slices wait for the owner to merge the prerequisite, rather than stacking unrelated issue branches.

### 1. Bive: canonical contract and migration

Read first: `AGENTS.md` (Roles, Inviolable prompts), `HANDOFF.md`, all role prompts and project additions,
`opencode.jsonc`, `.bive/skills.json`, `lib/skill-provisioning.ts`, guard and its tests,
`docs/COORDINATING.md`, `docs/REQUIRED-CHECKS.md`, `docs/UPDATE.md`.

Work:

1. Replace the active agent supervisor with the question-only advisor; separate the owner from agent roles.
2. Update coordinator/delegate escalation, launch and question templates, skills, install/update instructions and
   active docs. Gates, team approval, refusal-resume authorization and merge decisions go to the owner, not an advisor.
3. Enforce advisor read-only/current-worktree access through permissions and guard checks. Deny legacy supervisor
   startup or treat it with restrictions no weaker than an advisor's; never silently preserve old privileges.
4. Migrate role provisioning and project additions explicitly. Do not blindly load legacy supervisor additions.
   Preserve project-specific private-path restrictions and gate adaptations.
5. Mark old supervisor qualification material historical/retired, without deleting its cases or changing draw results.
6. Add consistency and negative regression tests. Document shared-login limitations honestly: prompt wording alone
   does not prove which human or agent acted through a GitHub account.

Done when: prompts, config, provisioning, templates, guard and docs agree; relevant unit tests and the core suite pass;
the owner receives a PR with exact model identities, checks, limitations and no authorization labels applied.

Current checkpoint: `coordinator/advisor-role` contains a partial, unverified coordinator draft. Haiku's ordinary-code
Part A is pushed separately on `issue/262-advisor-code` at `38f8e03b52c7c478c8453514af7a1c3b661c7201`; it is not
yet integrated or fully reviewed. These are not a completed implementation or a deployed role change.

Execution attempt after the owner required free Beam only: public provider metadata at
`https://opencode.ai/zen/v1/models` confirmed `beam-free` maps to `reflection/beam-1.0-501b-a23b`,
released 2026-10-05, updated 2026-10-16, with zero input/output/cache-read rates. Launching the bounded documentation
part through `opencode/beam-free` failed immediately with **"Free usage limit reached"**. No fallback was attempted;
no provider or billing changes were made. Resume ordinary implementation only when this approved free route is
available or the owner explicitly changes the routing constraint. Do not infer permission to use a paid route.

### 2. Bench: capability evidence, never authority

Depends on the owner's review of slice 1's contract.
Read first: bench's own `AGENTS.md`, `HANDOFF.md`, role prompts/project additions, `RESULTS.md`, test release rules,
draw administration/scoring code, frozen fixtures and pending owner-authorization PRs.

Work:

1. Remove active qualification-to-supervisory-authority rules and supervisor-agent merge duties.
2. Add a dated policy explanation distinguishing historical supervisor evidence from current capabilities and rights.
   Keep historical result rows, scores, seeds, model names, provenance and fixture revisions unchanged.
3. Design any new advisor evaluation around a read-only answer about a supplied worktree: useful analysis, risk
   detection, scope discipline and refusal to exercise authority. A passing answer never promotes an agent to owner.
4. Keep coordinator/delegate capability assessments separate from the owner's concrete work and team approval.
5. Audit launchers, owner-authorization actions and merge helpers for an agent path to owner-only actions.
   Agents must not dispatch or rerun owner authorization on the owner's behalf.

Done when: active policy and tooling cannot translate a pass into supervisory powers; historical-data comparisons
show no draw/result/fixture rewrite; deterministic unit and protocol tests pass.
Any new benchmark protocol stays **draft** until the owner releases it. No draws are part of this slice.

### 3. Workspace template: safe defaults for future installations

Depends on slice 1. Read first: its own rules, handoff, role prompts, default agent configuration, templates,
required-check workflows and branch-protection documentation.

Work: remove default supervisor startup and autonomous merge instructions; install the advisor as an optional
read-only consultation, not the workflow entry point. Require owner-approved work, teams and gates. Keep
coordinator/delegate separation and owner-only merge/close/release behavior.

Done when: a local, non-benchmark template smoke check finds no inherited supervisory agent powers; resolved
permissions and relevant tests match the new roles. Do not create repositories or change protection as a smoke test.

### 4. Registry and help: advice-only presentation

Depends on slice 1. Read first: README, browser-help implementation and prompt sources, Worker/schema, presentation
code and tests; check which role fields actually exist before proposing a schema change.

Work: rename current supervisory-assistant UI and prompt references; explain that the owner decides and acts.
Remove the suggestion that a coordinator takes over delegate coding. Treat browser-pasted material as evidence,
not owner authorization. Do not imply the browser can inspect a worktree it has not been given.
Preserve old telemetry and historical role labels; if a current display needs interpretation, add it separately
instead of relabelling stored records. No speculative schema migration.

Done when: help text, prompt construction and references agree; relevant UI/Worker tests pass; old records remain
readable and unchanged. Deployment is a separate owner decision, not part of implementation.

### 5. University: correct active lessons, retain experiments

Depends on slice 1. Read first: repository-specific instructions, candidates, catalog manifest, active lessons,
held-out cases, result records and consumers of skill role declarations.

Work: identify lessons teaching agent authorization, gate approval, team approval, merges or test releases.
Prepare versioned corrections for active instruction material. Preserve original experiments, scores and cases.
Do not claim corrected lessons have demonstrated improvement without the required evidence.

Done when: static checks and skill provisioning tests pass; affected lessons are explicitly pending evaluation
or retain valid evidence for unchanged behavior. Experiments and lesson publication require separate owner approval.

### 6. Grooms: inspect before specifying changes

Read first: current default/integration branches, its actual rules and handoff, open issues, role/session code,
tool permissions, UI and automation. The inherited README is insufficient evidence of its product behavior.

Work: produce a file-level inventory of any supervisory agent powers, advisory interactions and owner controls.
Propose bounded implementation parts only for behavior that actually exists; do not invent or add a role system.

Done when: the owner can approve a concrete, evidenced split and team. Implementation follows that approval on its
own branch/PR; no product edits are authorized by this planning slice.

### 7. Installed-project rollout and final audit

Depends on owner-merged reference changes and an explicit list of installations approved for migration.

Work: apply Bive's reviewed update procedure separately to each live installation, preserving its rules, private
paths, registry identity and gate adaptations. Inventory active sessions using old role prompts; propose a safe
handoff before new authorized work. Do not stop sessions, edit unrelated worktrees or discard local changes.
Leave archived synthetic repositories and historical draw workspaces untouched; a future fixture gets a new version.

Done when: every in-scope live installation has recorded source revision, migration PR and verification evidence,
or an explicit owner-approved deferral. No active path still treats an agent as the owner.

## Verification matrix

| Boundary | Required evidence |
| --- | --- |
| Advisor scope | Reads relevant current-worktree files, returns one answer, cannot edit, execute commands, call mutating tools, launch agents or operate workflows. |
| Legacy supervisor | Old role names, environment/role-file markers, additions and agent defaults never restore supervisory privileges. |
| Owner authority | Work/team/gate/test-release/merge/PR-close authority remains owner-only, regardless of qualification, recommendation or green CI. |
| Coordinator/delegate split | Coordinator reviews and prepares PRs; delegate writes only its brief; neither inherits merge or owner powers. |
| History | Compare historical results and frozen fixture content to the pinned base; no changed scores, rows, seeds, identities or case mappings. |
| Configuration | Verify effective permissions, including inherited restrictions, not just prompt wording; document remaining enforcement gaps. |
| Quality | Focused tests per part, consistency checks and core tests once per review batch; no benchmark draw disguised as a smoke test. |

## Teams, authorization and delivery

- Sol handles coordinator-only and inviolable changes and reviews ordinary-code work. From the owner's subsequent
  instruction, use **only verified-free Beam delegates**, in bounded parts and their own worktrees.
- Historical initial task: Sol `openai/gpt-6.1-sol`; Haiku 4.5 served through
  `claude-agent/claude-haiku-4-5-20251001`, canonical maker identity `anthropic/claude-haiku-4-5-20251001`.
  No further Haiku launches. The initial commit is preserved. Verified-free Beam route: `opencode/beam-free`,
  catalog name Beam Free, zero input/output/cache rates; maker identity `reflection/beam-1.0-501b-a23b` as recorded
  in bench's alias evidence. Re-verify exact version and availability before launch; unknown pricing is not free.
- No provider fallback, provider/billing configuration changes or silent model substitution. Stop on provider failure.
- The owner directed execution to start with Sol and free Beam. Before a dependent repository starts, confirm its
  concrete scope, file ownership, team and dependencies against its own rules and the reviewed reference.
  The advisor may answer a question about that proposal, but cannot approve it or initiate the work.
- PRs state done, left, checks, historical-data preservation and known enforcement limitations. Only the owner
  authorizes and performs merges or closes PRs. Code review approval is not supervisory authorization.
- No owner-authorization action/label, test release, benchmark draw, deployment or repository-settings change is
  performed by this plan. Those remain separate owner actions and decisions.
