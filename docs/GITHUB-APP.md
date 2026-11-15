# One GitHub App for the agents (owner decision, 2026-11-14; issue #235)

Today every role acts under the owner's GitHub account, so GitHub cannot tell the owner from an agent (#130). The owner
chose **one App for all agents**, not one per role. It separates agents from the owner; it does not separate the
coordinator from a delegate (that stays with the guard, the role file and signed comments).

## What exists (2026-11-14)

- App slug `bive-agents`, App ID 5761164 (public), owned by bived-apps, installed on bived-apps/bive only.
- Permissions: contents, issues, pull requests (write); actions, checks, metadata (read); no events.
- The private key is kept in the owner's password manager, nowhere on disk.
- `main` ruleset has Restrict updates and the Repository admin role as the only bypass, for pull requests only; no App
  bypass anywhere.

## Tests passed

- An agent comment shows as `bive-agents[bot]` (type Bot).
- A dated label applied with the App token (by the owner, on scratch PR #300) was refused by bive-merge-gate.
- The owner's own label passes (every merged PR).

## Tokens for a session (option A, #299)

The owner runs a private helper outside every repository. It unlocks the password manager, mints a one-hour token for
bived-apps/bive, and starts `opencode --standalone` with `GH_TOKEN`. It never puts the key or the unlocked vault session
in the environment.

Limits: the token lasts one hour; `gh` uses the App but `git push` keeps its existing credentials (#236); OpenCode
Desktop's background service still uses the owner's account (options C + D, #299).

## Revoke, rotate, stop

- **Rotate**: generate a new key on the App page, store it, delete the old key on the App page.
- **Revoke at once**: delete every key or suspend/uninstall the App on the organisation's installed Apps page.
- **Stop all agent activity**: uninstall the App to stop App-token sessions; stop the OpenCode service and sessions
  (`opencode service stop`) to stop the others.

None of these needs an agent.

## What it gives

- Every agent action (push, comment, pull request, label) shows as `<slug>[bot]`, `actor.type: "Bot"`.
- The merge gate already refuses a dated label or an override label applied by a Bot or an App
  (`docs/REQUIRED-CHECKS.md` › Agent identity): with the App in place, only the owner's own account can authorize a
  merge, for real.
- The owner's account is used for the dated label and the merge only.

## Owner checklist (the owner does each step; no agent creates or installs the App)

1. Create a GitHub App owned by the organization: name of your choice, no webhook, no user authorization.
2. Repository permissions, nothing else: contents write, pull requests write, issues write, checks read, actions read,
   metadata read. **Not**: administration, workflows, secrets, members.
3. Install it on the repositories the agents work in (Bive first), not on all repositories.
4. Rulesets: keep `main` restricted to the owner (bypass: repository admin role only); on `bived` and `milestone/*`,
   pull requests required, merge commits only. Do not give the App any bypass.
5. Generate one private key. Keep it on the owner's machine outside every repository (for example in the system
   keychain), never in a worktree, `.bive/state/` or an environment file an agent can read.
6. Give agents short-lived installation tokens only: the owner (or a small owner-run helper outside the repository)
   mints a token per session and passes it as `GH_TOKEN`. Tokens expire within an hour; the key itself is never handed
   to an agent.
7. Test once: an agent comment shows as the App; an agent-applied dated label is refused by the gate; the owner's label
   passes.

## Limits

- Coordinator and delegate share the App: the gate cannot tell them apart. Separation stays with the guard, the role
  file, worktree paths and the signed `— <role> <provider/model>` comments.
- A token handed to a session can do anything the App's permissions allow until it expires.
- Per-role Apps (#236–#238, #240) are not planned under this decision; they remain open for a later owner decision.
