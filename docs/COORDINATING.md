# The coordinator's routine, as commands

What `.bive/prompts/COORDINATOR.md` steps 5, 7 and 9 mean at the shell, for a coordinator that wants the exact
commands. `<n>` is the issue, `<slug>` a short name, `<base>` the integration branch, `<model>` the delegate's
`provider/model`.

## Authority (issue #262)

The owner alone authorizes work and merges, approves teams and the three gates, and arbitrates shared files. An advisor
answers questions about the current worktree read-only and prepares decision or handoff text; that is advice, not
authorization. No advisor text, bench pass, shared account or collaborator association counts as the owner's approval.
A bench pass is capability evidence only. By default a coordinator approves pull requests based on its branch but never
merges or closes one. An explicitly scoped owner grant may let a named coordinator execute specific sub-coordinator
pull-request merges; see *Coordinator merge exception (default off)* below. Historical supervisor
qualifications grant no authority.

## Coordinator merge exception (default off, guarded path)

Default: a coordinator never merges or closes a pull request. A guarded, default-off path now exists as a protected
tool (`bive_coordinator_merge`): it requires the base repository opt-in (`coordinatorMerges: true` in
`.bive/gate.json`) and a fresh per-call OpenCode owner permission. It is bound to the exact repository, executor
session, direct child coordinator session, pull request, head commit and base, with a two-minute expiry; it revalidates
scope and authorization after approval and merges only the pinned head with `--merge --match-head-commit`. It is single
use, with no saved grant and no onward delegation, and grants no pull-request-close, team, gate or test-release power.
It refuses a pull request the coordinator authored or owns, an ambiguous or self-authored branch, a missing coordinator
label or non-green checks, and any expired or changed head. Agents must use the protected tool, never `gh` or the API.
No actual grant or merge is performed by this task. Live end-to-end acceptance is a separate, owner-run step that has
not been verified yet. The contract lives in [docs/COORDINATOR-MERGES.md](COORDINATOR-MERGES.md).

The tool relies on recorded session identity rather than on an account proving a human: shared accounts and the absence
of an OS-level sandbox remain caveats.

## Before a milestone (issue #116)

Run these three checks before gate 1, before the first delegate starts. If one fails, tell the owner and do not
start delegates.

1. **Runners online**: the runners the project's workflows use are online.
   - Self-hosted runners: `gh api repos/<owner>/<repo>/actions/runners` (needs admin rights; without them, ask the
     owner to check the runner status in GitHub's settings).
   - Hosted runners: no check needed; GitHub provides them.
2. **Local environment version**: the runtime version of the project's local environment equals the one installed now.
   The project fills the command in `AGENTS.md` › Before committing (Bive's own: `node --version` is 22). A mismatch
   means the environment was built with another interpreter version.
3. **Fast checks green on the base**: the fast checks have been seen green once on the milestone's base, in CI, before
   the first delegate starts. A red base blocks all other merges until green.

## Session start

Fetch first, so no worktree is based on a stale local branch (field report #110, remark 2): `git fetch --prune`.

The label the owner applies to authorize a merge must exist that day (owner, 2026-11-10). Create it, never rename an
older one: renaming moves the label onto every pull request that carries it and would re-date the owner's past
authorizations. The coordinator never applies it.

```bash
label="bive-merge-authorized-until-$(date -u +%F)"
gh label list --search "$label" --json name --jq '.[].name' | grep -qx "$label" \
  || gh label create "$label" --color B60205 --description "Owner only: authorizes one merge through $(date -u +%F) UTC"
```

## Start a coordinator: the hand-over is a GitHub comment (issue #202, owner 2026-11-12)

The guard keeps every agent's writes inside its own worktree, so a hand-over file outside it cannot be written by an
agent. The hand-over (`.bive/templates/launch.md`, filled) is therefore posted by the owner (or a person outside the
guard) as **one comment on the milestone's epic issue**, whose first line is `# Launch #<milestone> <title>`. Retrieval
is read-only and uses the app-configured named human owner: `gate.json`'s `owner` when configured, otherwise the human
personal repository owner's login. It is never automatic execution from a comment's origin, account association or
shared account alone. An advisor may prepare or quote the hand-over text, but that text is advice, not authorization:
a hand-over taken from a collaborator's or shared account, or carrying an advisor's signature, does not count as the
owner's approval. Before handing it to the coordinator, the launcher records the human owner's explicit approval of
the scope and team in the issue thread; only that recorded approval permits execution. The retrieval filter below only
selects comments by the named owner's login for review; it does not authorize execution:

```bash
gh api repos/<owner>/<repo>/issues/<epic>/comments --paginate --jq \
  '[.[] | select(.body | startswith("# Launch #")) | select(.user.login == "<named-owner>")] | last | .body' \
  > <coordinator clone>/.bive/state/launch.md
# review the retrieved hand-over and confirm the recorded owner approval of scope/team before running:
(cd <coordinator clone> && opencode run --agent coordinator --model <model> "$(cat .bive/state/launch.md)")
```

A hand-over whose `Read:` field is empty is still returned to the owner (`COORDINATOR.md`). A second hand-over
comment replaces the first: the newest wins, and the history stays on the issue.

## Start a delegate (step 5)

```bash
git worktree add .worktrees/issue-<n> -b issue/<n>-<slug> origin/<base>
git config extensions.worktreeConfig true                     # once per clone
git -C .worktrees/issue-<n> config --worktree user.name "delegate <model>"
git -C .worktrees/issue-<n> config --worktree user.email delegate@bive.invalid
mkdir -p .worktrees/issue-<n>/.bive/state
echo delegate > .worktrees/issue-<n>/.bive/state/role          # the guard's sign
# the brief: .bive/templates/brief.md filled into .bive/state/briefs/<n>.md
gh issue comment <n> --body "Started: branch issue/<n>-<slug>, delegate <model>"
brief="$(cat .bive/state/briefs/<n>.md)"                        # read here: outside the delegate's worktree
(cd .worktrees/issue-<n> && BIVE_ROLE=delegate opencode run --agent delegate --model <model> "$brief") &
echo $!                                                         # record the PID (AGENTS.md › Never)
```

On a model fallback (a provider limit, #110 remark 1) restart the brief with the next model and set the identity again,
in one pass: `git -C .worktrees/issue-<n> config --worktree user.name "delegate <next model>"`, then `opencode run
--model <next model>`; the commits keep the canonical name of the model that wrote them.

The `delegate` agent of `opencode.jsonc` gives the session `.bive/prompts/DELEGATE.md` as its system prompt.
`opencode debug agents` lists the agents OpenCode resolved (OpenCode 2.2.5 has no `opencode agent` subcommand).

A project whose checks need a local environment links it into the worktree (for example
`ln -s "$PWD/.venv" .worktrees/issue-<n>/.venv`).

## Start a delegate as a session (0.2; the process start above stays the fallback)

A delegate can be a session of an OpenCode server instead of a process you started: the owner then sees it in the same
OpenCode, and it needs no `cd`. Everything below was verified on OpenCode 2.2.5 (`ROADMAP.md` › 0.2, part 0), except
where it says it was not. Bive ships no script (HANDOFF › *No machinery*): `lib/delegate-session.ts` and
`lib/delegate-run.ts` are pure helpers that **build** the requests and **plan** the fallback; you send them.

1. **A server, once**: `opencode serve --port <p>` prints a password; the requests use basic auth `opencode:<password>`
   (`authHeader`). Keep it running. **Restart it after any change to a plugin or the guard merges**: a running server
   keeps the old plugin code in memory (seen on 2026-11-12: a delegate was refused a pipe the merged guard allows).
   A running local OpenCode service reached with `opencode api` (no password) works as well as a fresh `opencode serve`.
2. **The worktree, identity and role file**: exactly as *Start a delegate* above (steps 1-6 of that block, not the
   `opencode run` line). Run them **one after another, never in one parallel batch**: create the worktree, then
   `checkWorktree({list: <git worktree list --porcelain>, checkout, issue, branch})`; only when it is ok write the role
   file and the identity, then `checkReady({role, userName, canonical})`; only when it is ok launch. `planSetup` gives
   the one next step and never says `launch` before both checks are ok (`lib/delegate-setup.ts`). On any failure
   `planRecovery({markerCreatedByThisAttempt, sessionActive, dirty})` decides: it clears the marker only when this
   attempt made it, the session is known inactive and nothing is dirty. Never clear an active or pre-existing marker
   to retry.
3. **The model**: `resolveFromFile(<text of .bive/state/models.local.json, or undefined>, <canonical>)` (it calls
   `loadAliases`, then `resolveModel`), which stops on a malformed file instead of falling back to the canonical route
   (#258).
   The alias is what the server is asked for; the canonical name is what the identity and the pull request say.
4. **Create, move, check**: `buildCreateRequest({worktree: <absolute path of .worktrees/issue-<n>>, model: ref,
   parentID: $OPENCODE_SESSION_ID, coordinator: {session: $OPENCODE_SESSION_ID, issue}})` is `POST /api/session` with the
   agent `delegate` (the guard recognises it by its agent, #188); `$OPENCODE_SESSION_ID` is the coordinator's own session
   id, set in its shell. The answer is `{data: {id, ...}}`. A child session lands in its parent's directory, so then send
   `buildMoveRequest({sessionID, worktree})` (`POST /api/session/<id>/move`), then `GET /api/session/<id>` and test it
   with `isInWorktree(answer, worktree)`. **Prompt only when it is true**; otherwise remove the session and stop (#256).
   The session then shows under the coordinator's session (#243).
5. **Prompt it with the brief**: `buildPromptRequest({sessionID, brief})` is `POST /api/session/<id>/prompt` with
   `delivery: "queue"`, which is also how to talk to a busy delegate.
6. **Wait**: `buildWaitRequest(sessionID)` is `POST /api/experimental/session/<id>/wait` (204 when it finishes). It is
   *experimental*; the fallback is to follow `GET /api/event` and stop at an event for which
   `isSessionDone(event, sessionID)` is true (`session.execution.succeeded`; the event shape was read loosely and not
   fully verified).
7. **Read the result**: `readBranch({branch, base, git})` says whether the branch is pushed, lists its commits and
   returns the report when the last commit's body starts `Closes #` or `Part of #`. `base` is the bare base name
   (`bived`); `readBranch` adds `origin/` itself. Then review as in step 7 of the
   prompt.
8. **A model error** (`needsFallback({text, status})`): `planFallback({models, failed, aliases, worktree, issue,
   committed, left})` returns the next model, the identity to set (`git ... config --worktree user.name`, canonical
   name), a new create request in the same worktree and a short resume message to send as the prompt. The work already
   committed stays; the next commit names the next model (`docs/PROVIDERS.md` › *Switching mid-work*).
9. **A guard refusal** is a hard stop here too: read the session's last messages, record the refusal on the issue
   (*Refusal and resume*), and resume it with one prompt.

Not verified live end to end yet: the whole path with a real delegate is the pilot (issue #192).

## Open and review a pull request (step 7)

The delegate pushes its branch and returns the filled report; it never opens a pull request. The coordinator creates
the PR from the pushed branch and uses the report as the PR body. For a multi-part issue, open/update it according to
the brief's timing. If the delegate's final response is not accessible from the coordinator's machine, recover the
report from the final pushed commit body (do not expect the delegate's ignored `.bive/state/` file to travel):

```bash
git fetch origin issue/<n>-<slug>
git show -s --format=%H FETCH_HEAD
git log -1 --format=%b FETCH_HEAD
```

The report's Log section should name the commit SHA; the coordinator fills it in if the report was carried in that
commit body. Save the report on the coordinator's machine in `.bive/state/briefs/<n>-report.md`, then run:

```bash
gh pr create --base <base> --head issue/<n>-<slug> --title "#<n>: <title>" --body-file .bive/state/briefs/<n>-report.md
```

The report body starts with `Closes #<n>` when complete, or `Part of #<n>` and what remains.

```bash
gh pr view <pr> --json body,baseRefName,files,commits \
  --jq '.body, .baseRefName, (.files[].path), (.commits[].authors[] | "\(.name) <\(.email)>")'
```

Read it against the checklist: first line `Closes #N` / `Part of #N`; the sections State, Changed, Checks, Left, Log
filled and no `<!--` left; the base; no path matching the inviolable list (`AGENTS.md` › Inviolable prompts, the same
list as `bive-inviolable`); every author `delegate <provider/model> <delegate@bive.invalid>`. Then the brief's checks
in the worktree if the head changed since the report, and the diff. Then wait for CI and hand over:

```bash
gh pr checks <pr> --watch                      # returns when the checks finish; every one but bive-merge-gate green
gh pr review <pr> --approve --body "Ready to merge: <the checks you ran>"
```

The owner merges (`gh pr merge <pr> --merge --match-head-commit <sha>`, after the label); its queue is
`gh pr list --base <base> --search "review:approved"`. By default the coordinator never merges, closes or pushes
to `<base>`; the only possible exception is the explicitly scoped owner grant described in *Coordinator merge
exception (default off, guarded path)*, which is disabled by default and requires owner opt-in and a fresh permission.
To be told when a pull request is merged without a watcher plugin: `gh pr checks` for the checks, then
`until [ "$(gh pr view <pr> --json state --jq .state)" != OPEN ]; do sleep 60; done` in the shell, when a session
really needs to wait; most of the time the next session reads `gh pr list` instead.
Once merged, if the issue is still open (GitHub closes on the default branch only), close it only after
checking that the pull request's merge commit is reachable from the base:

```bash
merge_commit="$(gh pr view <pr> --json mergeCommit --jq .mergeCommit.oid)"
git fetch origin <base>
if git merge-base --is-ancestor "$merge_commit" "origin/<base>"; then
  gh issue close <n> --comment "Done in <base> at $merge_commit (PR #<pr>)"
else
  echo "refusing to close: PR #<pr> is not merged into <base>"
fi
```

Never write "Done" in an issue, a checklist or a report for an issue whose pull request is not merged;
`Part of #N` issues stay open with what is left.

`bive-merge-gate / merge-gate` stays red on every pull request until the owner applies the dated label
`bive-merge-authorized-until-YYYY-MM-DD` (`docs/REQUIRED-CHECKS.md`): read that red as "waiting for the owner's label",
not as a failure to brief again. The coordinator never applies the label.

## Refusal and resume (issues #146, #147)

When a delegate reports a refusal (guard, scanner, or any check):

1. Record the refusal: the refused command, the refusal message, and the worktree state.
2. Preserve all uncommitted work in the worktree — do not discard or push it.
3. Do not let the delegate continue or push. A refusal is a hard stop, not a prompt to rewrite the command.
4. Before any subsequent delegate starts, require a clear owner decision on how to proceed: resume the same
   delegate with a corrected brief, split the work, or stop.
5. Do not normalize retries as a workaround.

**Recording the authorization (issue #147):** before resuming after a refusal, post a comment on the issue recording
the refusal (command, message, worktree state) and the owner's explicit authorization to resume (or the
decision to split or stop). The coordinator does not resume on its own authority; the owner's decision must be
visible in the issue's comment thread before any delegate starts. If the owner's decision is not recorded, the
refusal stands and no subsequent delegate starts.

The delegate's prompt (`DELEGATE.md`) carries the matching rule: on refusal, stop immediately, do not retry by
rewriting the command, do not continue with other commands, do not push, preserve uncommitted work, and report the
refusal with the exact command, message, and worktree state.

## Your own refusals (issue #201)

The coordinator is also guarded. Same rule as a delegate's: do not rerun the effect another way before reporting. Post
a comment on the issue with the command and the refusal message, and say what you were doing; only then continue.

A refusal about the command's **shape** (`invalid-structure`) may be rephrased, in the same comment, into one of
these forms, all seen on 2026-11-12:

| Refused | Why | Use instead |
| --- | --- | --- |
| a redirect to a parent-directory path after a `cd` | redirects are resolved against the session root, not the directory after the `cd` | run from the root; give absolute paths inside the worktree |
| `$(...)` in a call whose workdir is a delegate's worktree | any call there is checked as that delegate's | run from the root with `cd .worktrees/issue-<n> && ...` |
| a `gh ... --body "..."` whose text has a parent-directory path | the quoted text is scanned | write the text to a file with the write tool, pass `--body-file` |
| a pipe into anything but `tail`, `head`, `grep` (a delegate) | the scanner cannot read it | the command's own switches, or one command per step |

A refusal about **where** (a path outside the worktree, an inviolable file, an external directory) is a boundary, not
a shape: stop and ask through the chain (skill `bive-ask-owner`). Never reach the same path or file another way.

## After the batch (step 9)

The core checks once, after the last merge, then `HANDOFF.md` and `ROADMAP.md` in one commit on a coordinator branch,
opened as a pull request labelled `coordinator` and merged by the owner like any other. Clean up:
`git worktree list`, then `git worktree remove .worktrees/issue-<n>` and `git branch -d issue/<n>-<slug>` for each
merged issue (never forced).

## Branches and inherited commits (issue #73)

Each issue branch starts from the current integration base (`origin/<base>` after `git fetch --prune`), never from
another issue branch: a branch created from a sibling inherits its commits and merge commits, and the later pull
request then carries them. Dependent work waits for the previous merge.

Before opening a pull request, check that the branch is clean of inherited work:

```bash
git fetch origin <base>
git merge-base --is-ancestor origin/<base> HEAD          # must succeed
git rev-list --merges origin/<base>..HEAD                # must be empty
```

If either fails, create a fresh branch from `origin/<base>` and cherry-pick only the issue's own commits (never
rewrite pushed history):

```bash
git switch -c issue/<n>-<slug>-fresh origin/<base>
git cherry-pick <issue-commit>...
```

## Two coordinators at once

The owner may start one coordinator per milestone, at most as many as the runners able to take the fast checks (and
never more than two) (`AGENTS.md` › Roles). Each coordinator keeps at most one CI run in flight (a new push waits for
the previous run). Each works in its own clone, because `.worktrees/`, `.bive/state/` and the guard belong to one
checkout:

```bash
git clone <repository> <dir> && cd <dir> && git switch milestone/<name>
gh pr list --base milestone/<name>                    # the pull requests this coordinator reviews, and no others
gh pr list --label coordinator --state open           # before opening a coordinator PR on an inviolable file: empty
```

At gate 1 each milestone lists the files it will touch; where the two lists overlap, the owner names one writer
or the order, and the brief says so. Each coordinator writes only its milestone's section of `HANDOFF.md` and
`ROADMAP.md`.

## GitHub pull-request merge methods

The repository allows `merge` only (`AGENTS.md` › Project rules): a merge commit keeps every delegate's commit under
its author; squash would attribute the result to the account that pressed the button. The owner keeps **Settings →
General → Pull Requests** aligned.

## Scripting it

A project may script this routine in its own repository (start, review, status, clean): one Python / ImGui project
did, in about 400 lines with tests, and used it for a whole batch. Bive ships no such script (HANDOFF › Decisions,
*No machinery*): the prompt and this page are enough for any coordinator, and a script stays the project's own,
outside Bive's files.
