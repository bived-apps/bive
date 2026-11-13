# Owner authority and read-only advisors: cross-app rework

Status: Bive first, at the owner's request (2026-11-13); draft implementation and tests in progress, not deployed.
Tracking: [bive #262](https://github.com/bived-apps/bive/issues/262).
Owner direction: 2026-11-13. The owner authorized Bive's role change, then requested this cross-app plan.
The owner subsequently said to start the plan, using only free Beam delegates. Start with the reference change;
dependent repositories wait for its review and owner merge. No merges, test releases or benchmark draws are authorized.

## The rule

- The human owner alone holds supervisory authority: authorizes work and merges, approves teams and gates,
  arbitrates shared files, and releases tests. The owner normally merges or closes PRs. By the owner's subsequent
  direction, an explicitly designated coordinator may exceptionally execute merges of named sub-coordinator PRs
  under a narrow opt-in owner grant (below). It never gains general supervisory authority or PR-close powers.
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

### Exceptional coordinator merges: owner opt-in only

Owner direction, 2026-11-13: on **any app made with Bive**, the owner must remain able to ask selected coordinators
to merge sub-coordinator PRs exceptionally. This is a generic Bive template/install/update capability, not an
organization-specific permission or a hard-coded repository allow-list. Each app's own human owner grants it
explicitly for that app; a grant in one repository never carries into another.
This is an exception for executing a specific owner-authorized merge, not a promotion to supervisor.
The current task does not issue or apply a grant, authorization label or merge.

Proposed fail-closed contract to implement and test:

1. Off by default. The owner explicitly identifies the executing coordinator/session, each sub-coordinator PR number
   and exact head SHA, target branch, and expiry (UTC time or a precisely bounded batch). An incomplete grant is a
   proposal to clarify, never permission to merge.
2. The grant is durably recorded with its owner provenance. Agent-written advice, qualification, collaborator status,
   a shared account or another coordinator's assertion cannot create it. Reuse reviewed owner-authorization
   mechanisms where possible; document any shared-account verification limitation.
3. Only the named coordinator may execute those merges. It must not have authored the work it merges or merge its
   own PR. Verify the PR is from the designated sub-coordinator and targets the granted base.
4. The owner-applied PR/head-bound authorization and required gate/checks remain necessary. Recheck grant validity,
   revocation, base, head and checks immediately before executing a merge commit pinned to that SHA.
   New commits, a changed base or expired/revoked permission require fresh owner authorization.
5. A completed merge consumes that PR's grant; grants are not inherited by child sessions or transferable to another
   coordinator. No onward delegation, automatic renewal, bulk wildcard scope, direct pushes, squash/rebase, PR
   closure, test release, team/gate approval, or bypass of failed checks.
6. Keep the general merge denial in place. Design a narrow, validated opt-in execution path rather than broadly
   allowing `gh pr merge` for coordinators. Audit alternative API/shell paths; a prompt-only exception is not an
   enforcement mechanism. Bind grants to the repository identity too, so copied templates, forks and installed apps
   never inherit another app's grants. Ship the contract in Bive's prompts, project-addition guidance, templates and
   update procedure; project additions may narrow it, never turn it into a standing agent merge right.
7. Tests must prove default denial, owner provenance, designated executor, sub-coordinator relationship, exact
   repository/PR/head/base, expiry/revocation, green checks, no self-merge, single use and no delegation/close rights.
   Include a generic installed-app fixture, not just Bive's own repository.

Draft implementation: `bive_coordinator_merge` in the protected guard plugin, with base `coordinatorMerges` opt-in
(false in Bive), actual parent/child coordinator sessions and fresh per-call OpenCode owner permission. It derives
exact repository/executor/PR/head/base scope, expires after two minutes and revalidates after approval. No reusable
grant is stored or inherited. Details and limitations: `docs/COORDINATOR-MERGES.md`. This one-call design implements
the bounded expiry and single-invocation grant rather than a persistent or batch grant file.
Do not enable this exception until its enforcement path and negative tests are reviewed. Owner-only supervisory
decisions and question-only advisors remain unchanged; no live merge acceptance test is authorized here.

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
7. Add the explicitly owner-opted-in sub-coordinator merge exception through the narrow grant contract above.
   Keep general agent merge denial; do not simulate a real grant, apply authorization or perform a merge in tests.

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

### Free-team design and availability smoke checks (2026-11-13)

The owner subsequently requested a free team and its test, and explicitly permitted coordinators on independent
parts of Bived Apps. This authorizes bounded team testing and coordination, not merges, releases or draws.

- Operational proposal: human owner; Beam coordinators on independent areas; one Beam delegate per active
  coordinator initially; optional question-only Beam advisor. Sol remains the requested inviolable-file handler and
  reviewer, but is **not represented as a verified-free member** of the operational team.
- Candidate assignments: Bive core; bench/workspace; registry/help; university/Grooms inspection. Start at most two
  coordinators at once, including any active Sol coordinator, and never assign overlapping files. Stage the remaining
  areas in subsequent batches. Dependent implementation still waits for the owner-merged reference contract.
- Three independent, explicitly named route probes, each a tiny text-only availability/role-boundary check (no tools,
  repository mutation, benchmark draw, release or qualification claim):

| Route | Catalog rates | Observed result |
| --- | --- | --- |
| `opencode/beam-free` | Zero | Blocked: "Free usage limit reached". |
| `ollama-cloud/beam` | Zero | Blocked: asks for credits or a subscription; no purchase or configuration change made. |
| `opencode-go/beam-free` | Zero | Answered. First answer incorrectly assigned PR creation to the delegate; corrected retest preserved separation. Bounded doc work and read-only coordination assessment then completed. |

Go provider metadata (`https://opencode.ai/zen/go/v1/models`) independently confirms canonical
`reflection/beam-1.0-501b-a23b`, released 2026-10-05, updated 2026-10-16, zero input/output/cache-read rates.
The candidate reported its exact model unknown; identity evidence is the provider metadata, not its self-report.
A raw Python metadata fetch returned HTTP 403; the normal web-fetch tool returned the provider document.

Successful availability does not establish coordinator competence, enforce permissions or guarantee future quota.
Do not conceal the failed role-boundary answer. Before implementation, check a concrete brief/report handoff and
review the result; a delegate never opens a PR. No automatic provider fallback: selecting a tested route for a named
team must be explicit, and any later failure stops that assignment.

Owner subsequently specified **Bive first**: no implementation in other apps until this reference is reviewed.
The coordinator assessments identified bench work collisions (#72 owner-authorization helper and #74 progressive
delegate work), the workspace template's default supervisor agent, registry/help's old assistant prompt, and no
current university lesson requiring authority correction. These are inspection reports, not deployment evidence.
Do not expand university scope with keyword-audit machinery or copy unrelated guard/gate upgrades merely because
they appeared in an assessment. Preserve historical fixtures and existing owner-authorization work.

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
The resulting template/update procedure applies to any app made with Bive, including outside `bived-apps`;
do not infer permission to discover, access or migrate those external projects without their owners' authorization.

Done when: every in-scope live installation has recorded source revision, migration PR and verification evidence,
or an explicit owner-approved deferral. No active path still treats an agent as the owner.

## Verification matrix

| Boundary | Required evidence |
| --- | --- |
| Advisor scope | Reads relevant current-worktree files, returns one answer, cannot edit, execute commands, call mutating tools, launch agents or operate workflows. |
| Legacy supervisor | Old role names, environment/role-file markers, additions and agent defaults never restore supervisory privileges. |
| Owner authority | Work/team/gate/test-release/merge-authorization/PR-close authority remains owner-only, regardless of qualification, recommendation or green CI. Exceptional coordinator merge execution needs the explicit scoped owner grant above. |
| Coordinator/delegate split | Coordinator reviews and prepares PRs; delegate writes only its brief. No inherited merge rights; only a named non-authoring coordinator may execute specifically granted sub-coordinator merges. |
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
  authorizes merges and closes PRs. The owner normally performs merges; only explicitly opted-in coordinators may
  execute the named sub-coordinator merges under the scoped grant above. Code review approval is not authorization.
- No owner-authorization action/label, test release, benchmark draw, deployment or repository-settings change is
  performed by this plan. Those remain separate owner actions and decisions.
