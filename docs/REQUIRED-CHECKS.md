# Required checks

Bive's expected checks before merging a pull request. This page is a repository-readable inventory: it names the
automated GitHub Actions checks, their conditions, and the checks that are run locally by a coordinator. It describes
Bive's intended merge policy and maps to the workflow files; it does **not** prove which checks GitHub branch
protection currently requires (that configuration lives in the repository's settings). The workflow files named below
are the source to compare against and to update when check names or behavior change.

## Automated checks (GitHub Actions)

These run on GitHub and appear as commit statuses on a pull request.

### `bive-tests / tests`

- **Workflow file**: `.github/workflows/bive-tests.yml`
- **Job**: `tests`
- **Triggers**: `push` to `main` and `bived`; `pull_request` (default activity types: `opened`, `synchronize`, `reopened`).
- **Runs**: `ubuntu-latest`, Node 22, `node --test tests/*.test.ts`, timeout 10 minutes.
- **What it checks**: the repository's test suite (`tests/*.test.ts`).
- **Expected on PRs**: yes — the `pull_request` trigger runs it on pull requests (default activity types).

### `bive-inviolable / check`

- **Workflow file**: `.github/workflows/bive-inviolable.yml`
- **Job**: `check`
- **Triggers**: `pull_request` of types `opened`, `synchronize`, `reopened`, `labeled`, `unlabeled`.
- **Condition (job `if`)**: runs only when `github.head_ref` starts with `issue/` **and** the pull request does not
  carry the `coordinator` label:
  `startsWith(github.head_ref, 'issue/') && !contains(github.event.pull_request.labels.*.name, 'coordinator')`.
- **What it checks**: compares the changed files against the base branch and fails if any inviolable path changed,
  unless that file is byte-identical to the default branch's (issue #198: a sync of the default branch into a milestone
  carries the default branch's own inviolable files; any other difference from the default branch still fails).
  The matched paths are: `.bive/registry-id`, `.bive/gate.json`, anything under `.bive/prompts/` or `.bive/templates/`, anything under
  `.opencode/plugins/` or `.opencode/plugin/`, files matching `.github/workflows/bive-*`, `opencode.jsonc`, and
  `AGENTS.md`.
- **Skip conditions** (the job is skipped, not failed):
  - the head branch does not start with `issue/` (for example a coordinator's own pull request on another branch);
  - the pull request carries the `coordinator` label (a coordinator's own pull request that legitimately changes an
    inviolable file).
- **Why**: a delegate's pull request must never change Bive's inviolable files (see `AGENTS.md` › Inviolable prompts).
  Only the coordinator changes them, and only on pull requests it labels `coordinator`.

### `bive-merge-gate / merge-gate`

- **Workflow file**: `.github/workflows/bive-merge-gate.yml`; script `.github/scripts/check-merge-gate.mjs`, decision
  in `.github/scripts/merge-gate-lib.mjs`.
- **Job**: `merge-gate`
- **Triggers**: `pull_request_target` on pull requests targeting `bived` or `milestone/**`, types `opened`,
  `synchronize`, `reopened`, `labeled`, `unlabeled`. It checks out the base commit only and never runs code from the
  pull request's head; its permissions are read-only (`contents`, `pull-requests`, `checks`, `actions`: `gh pr checks`
  reads each check's workflow run, which a private repository refuses without `actions: read`, #101).
- **Runs**: `ubuntu-latest`, Node 22, timeout 5 minutes. It reads the pull request and the checks once, then decides.
  It never waits on a runner. If a check is pending or a required one is missing, the gate fails immediately with
  "required CI checks have not finished yet; the gate runs again when they complete"; the re-run is triggered by
  `.github/workflows/bive-merge-gate-rerun.yml` (`workflow_run` on `bive-tests` and `bive-inviolable`, default-branch
  behavior) and turns the gate green by itself once the checks pass.
- **Authorization**: exactly one label `bive-merge-authorized-until-YYYY-MM-DD` on the pull request, a real calendar
  date, valid through 23:59:59 UTC of that date and only while the base is `bived` or `milestone/<name>` (one path
  segment). Only the owner applies it, after the coordinator's approval and when the owner is about to merge;
  the coordinator never does, also on its own pull requests. Adding or removing it re-runs the gate.
- **Label date (issue #114)**: the label's date must equal the UTC day on which the `labeled` event applied it (read
  from the issue timeline). A label dated tomorrow or later (or any day other than the applying day) is refused.
- **Label actor (issue #114)**: the `labeled` event's actor must be the repository owner (or a listed owner identity).
  What this proves and what it does not: while every role shares one GitHub account (#86), the actor is always the
  owner's account, so this check cannot distinguish the owner from an agent acting under that account. It becomes
  meaningful only once roles hold distinct identities (#110 remark 4); until then the owner's out-of-band decision
  (applying the label at all) is the real authorization. The open question in #114 stands: accept this limitation or
  require a second proof only the owner can give (e.g. a signed or out-of-band token).
- **Agent identity (issue #130)**: once a GitHub App is installed for the agents, its actions show as
  `actor.login: "<slug>[bot]"`, `actor.type: "Bot"`, and `performed_via_github_app` set. The gate refuses a dated
  label (and an override label) whose labeled event has `actor.type: "Bot"` or `performed_via_github_app` set, so an
  agent can never authorize its own merge. The App's permissions are contents write, pull requests write, issues
  write, checks read, actions read; no administration, no workflows write. The App cannot merge into `main`: rulesets
  restrict updates with the owner (repository admin role) as the only bypass. Until the App exists, the immediate
  rule in `AGENTS.md` applies: every GitHub action an agent takes other than pushing its own branch is preceded or
  carried by a comment signed with its role and model, and an agent never acts on a pull request it does not own.
- **Owner override (issue #115)**: an optional label `bive-owner-override-YYYY-MM-DD` (same date rules and actor
  check as the authorization label). With it, the gate passes even when required checks are pending or missing, but
  never when a check is red (failed, cancelled, or otherwise non-pass). The override is the only way to merge past a
  gate that is not green; it is the owner's, and it never covers a red check. The gate records which checks were
  missing/overridden. At most one override label.
- **Red before the label is expected**: on every pull request without the label the gate fails with "exactly one
  dated merge-authorization label is required". It means "waiting for the owner", not a failure to fix.
- **What it checks**: the authorization above; exactly one `bive-tests / tests` and one `bive-inviolable / check`,
  both `pass`; every other check except its own `pass` as well. The one accepted exception: `bive-inviolable / check`
  may be `skipping` on a pull request labelled `coordinator` (its job condition skips it there). It re-reads the pull
  request after reading the checks and fails if the head, base or labels changed.
- **Skippable checks (issue #200, owner 2026-11-12)**: a project whose CI skips a job by design (for example its
  tests on a Markdown-only change) lists it in `.bive/gate.json`: `{"skippable": ["bive-tests / tests"]}`, each entry
  `<workflow> / <job>` as the checks list shows it. A listed check that is `skipping` counts as passing, required or
  not; `fail`, `cancel` and `pending` never do. The gate reads the file from the pull request's **base** branch, so a
  pull request cannot list its own skips; the file is inviolable (a delegate never changes it). A missing, corrupt or
  wrong-shaped file means nothing may be skipped, which is Bive's own setting (`{"skippable": []}`).
- **Named owner (issue #249, owner 2026-11-13)**: the dated labels count only when the repository owner applied them.
  On a repository that belongs to an organization, the owner's login goes in the same file:
  `{"skippable": [], "owner": "<login>"}`. The gate reads it from the base branch, so a pull request cannot name its
  own owner; without it the gate compares with the repository owner's login, which on an organization no person's
  label matches. A label applied by a Bot or a GitHub App is refused either way (#130).
- **Fails on**: a missing, malformed, duplicate or expired label; any required check pending or missing (an
  immediate red that means "wait for CI", not a refusal — the gate is re-run automatically when checks complete),
  or any check skipped (other than the exception), failed or cancelled; a pull request whose head or base changed
  during the run.
- **Several coordinators**: each approves only pull requests based on its own milestone branch; the gate does not
  check which coordinator approved, the owner does (`AGENTS.md` › Roles).
- **Expiry is not re-evaluated on its own**: a gate that passed stays green after its date. The owner applies the
  label dated the day of the merge, and the owner merges that day with `gh pr merge --merge
  --match-head-commit <sha>`, so a push after the gate's run refuses the merge.

### `bive-merge-authority / merge-authority`

- **Workflow file**: `.github/workflows/bive-merge-authority.yml`; script `.github/scripts/check-merge-authority.mjs`.
- **Job**: `merge-authority`
- **Triggers**: `push` to `bived` and `milestone/*`.
- **What it checks**: the pushed commit must be a merge commit; its committer identity must not match the author of
  any commit it brings in (the commits reachable from the second parent but not the first). A direct (non-merge)
  push, or a merge whose committer also authored one of its brought-in commits, turns this check red on the base.
- **Why**: the gate runs before the merge and cannot know who will press it; this push-time check enforces
  "whoever merges did not write" (`AGENTS.md` › Roles) after the fact. It is the complement of the dated-label check.
- **Single-account caveat**: while every role shares one GitHub account, the committer identity check is only as
  strong as the distinct author identities in the commits; see #114's open question.

## Failure categories (issue #127)

A failing check belongs to one of three categories, each with one action:

- **Base (red base)**: the failure reproduces on the base branch without the pull request. Action: merge only
  baseline-fix pull requests one at a time, with failure logs proving each has no remaining failure except another
  identified baseline issue; recheck after each and block all other merges until green.
- **Pull request**: the failure reproduces on the pull request's head and is caused by its change. Action: the pull
  request's fault — brief the delegate again or split.
- **Non-deterministic**: the failure does not reproduce on one re-run with the same inputs (same seed, positions,
  inputs). Action: open (or comment on) an issue `Flaky: <test>` with the run links and the seed/positions/inputs
  needed to reproduce it, and stop retrying; at most one re-run per failure. The owner never merges past it
  without that issue and a green run on the head. Skipping or quarantining a test is forbidden; retrying in a loop
  is forbidden.

## Self-hosted runners: environment isolation (issue #121)

On a self-hosted runner (a single machine that keeps its state), a virtual environment kept between runs, or a
package-manager cache shared with the machine owner's own account, can give red tests that have nothing to do with
the code under test. The rule:

- Every environment, cache and tool a CI job installs lives under the job's workspace (`$GITHUB_WORKSPACE` or
  `$RUNNER_TEMP`), never in the runner account's home or a path the machine's users share.
- Cache and environment variables point there explicitly: for example `UV_CACHE_DIR`, `PIP_CACHE_DIR`,
  `npm_config_cache`.
- The environment is keyed on what built it (lock file hash and interpreter version), so a stale one is never reused
  silently; the health check of #116 compares the same key.
- The runner runs under its own system account, not the machine owner's.
- Rebuild from nothing on demand: a `workflow_dispatch` input or a label deletes the job's environment before
  installing.
## Marked tests (issue #122)

A test that needs hardware, an installed application, or a time budget carries a marker naming it (the project's
test framework's own mechanism: a pytest marker, a `node:test` `skip` condition, a tag), and skips with that reason
where the dependency is absent, never passes. The fast tier runs no marked test.

- **Routing**: a job for marked tests runs only on a runner with the matching label, alone on it (no other job at
  the same time, so a timing threshold is not skewed).
- **Reporting**: the report template's Checks section names which markers ran and which were skipped, so a skipped
  marker shows instead of a silent green.
- **Project rules**: `AGENTS.md` › Project rules lists the project's markers and, for each, the runner label that
  provides it.
## Self-hosted runner, workflow changes (issue #123)

On a self-hosted runner, a `pull_request` run executes the workflow files of the pull request's head. A branch that
edits a workflow therefore runs that edit on the owner's machine at once. The rule:

- Any change under `.github/workflows/` (or any script a workflow runs from the head) needs the owner's explicit
  agreement before its first run.
- A pull request that edits a workflow runs only on hosted runners until the owner agrees.
- Jobs on self-hosted runners run from `pull_request_target` with the base's workflow (the safe pattern, already in
  Bive's `bive-merge-gate`), or are gated by a GitHub environment with the owner as required reviewer.
- GitHub's "require approval to run workflows" setting applies to pull requests from forks, not to branches of the
  same repository, where every agent pushes; list the project's workflows on self-hosted runners in the project rules
  (`AGENTS.md` › Project rules).
- The coordinator's review names any diff under `.github/workflows/` and raises it to the owner; the owner's
  review design includes it.

## Branch protection (owner, in GitHub's settings)

The workflows report checks; they do not make GitHub enforce them. For the gate to block GitHub's merge button and
direct pushes, the owner configures branch protection (or a ruleset) on `bived` and `milestone/*` to
require the status checks `bive-merge-gate / merge-gate` and `bive-tests / tests`; the gate itself judges
`bive-inviolable / check`, including its skip on coordinator pull requests. A ruleset names a required check by its
job (check-run) name alone, `merge-gate` and `tests` with GitHub Actions as source: every workflow's job keeps a
name of its own, or the requirement matches several checks (#94). Until that configuration exists, the
gate is only as strong as the owner's procedure. No file in this repository proves that it exists; check the
settings.

## Headless plugin check (issue #69)

A non-interactive validation that detects whether Bive's plugins are discovered and loaded, without opening the
OpenCode UI. Command:

```
node .github/scripts/check-plugins.mjs <directory> <plugin-id> [<plugin-id> ...]
```

- Runs `opencode plugin list --standalone` in `<directory>` with a bounded timeout (60 s).
- Verifies each expected plugin ID is present with a real ID (not `-`).
- Exits 0 if all pass, 1 if any are missing or rejected, 2 on usage error.
- Project-specific plugin IDs are passed as arguments, not hardcoded in Bive.

## Local and manual checks (not GitHub statuses)

These are run by people or agents on their own machine. They are **not** GitHub required statuses and do not appear as
commit checks on a pull request.

- **Fast checks (delegate)**: lint and the tests of the files touched, for example
  `node --test tests/<the test of the file touched>.test.ts`.
- **Core checks (coordinator, once per batch of merges)**: `node --test tests/*.test.ts`; and
  `opencode plugin list` showing every Bive plugin with a real ID (not `-`), run after a session has started in the
  checkout.
- **Full checks (before a release)**: the two above, plus a fresh-clone install check where a write to
  `../outside.txt` is refused by the guard and `.bive/state/tokens.jsonl` fills.
- **`opencode plugin list`** is a local/manual check; it is not a GitHub required status.

## Coordinator merge exception (design, not implemented)

Default: a coordinator does not merge or close pull requests. A future, explicitly scoped owner grant may let a named
coordinator execute the merge of specific sub-coordinator pull requests, bound to repository, executor (session), pull
request, exact head, base and UTC expiry, single use, with no inheritance or onward delegation and no
pull-request-close, team, gate or test-release powers. It would never cover a pull request the coordinator authored or
owns. Revoked, expired or head-changed grants would be rejected, and green checks plus the owner's authorization would
still be required. This is a design requirement only; it is not implemented and no grant is issued. Current enforcement
remains the blanket denial. Proposed contract: [docs/OWNER-ADVISOR-REWORK.md](OWNER-ADVISOR-REWORK.md).

## What this document does not say

- It does not prove which checks GitHub branch protection currently requires, nor that any check is marked
  "required" in repository settings. Branch protection and rulesets are configured under the repository's settings;
  compare them against the checks listed here.
- It does not say who merges: by default the owner alone, after the coordinator's approval (`AGENTS.md` › Roles). An
  advisor's text or a collaborator/shared account is not approval; a bench pass is capability evidence only. A future,
  explicitly scoped owner grant may let a named coordinator merge specific sub-coordinator pull requests, but that is a
  design requirement, not implemented today (see [docs/OWNER-ADVISOR-REWORK.md](OWNER-ADVISOR-REWORK.md)).
- Workflow job names are part of the check identity. If a workflow or job is renamed, update this document and the
  repository's branch-protection configuration together so they keep matching.