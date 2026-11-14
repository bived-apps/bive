# One GitHub App for the agents (owner decision, 2026-11-14; issue #235)

Today every role acts under the owner's GitHub account, so GitHub cannot tell the owner from an agent (#130). The owner
chose **one App for all agents**, not one per role. It separates agents from the owner; it does not separate the
coordinator from a delegate (that stays with the guard, the role file and signed comments).

## What it gives

- Every agent action (push, comment, pull request, label) shows as `<slug>[bot]`, `actor.type: "Bot"`.
- The merge gate already refuses a dated label or an override label applied by a Bot or an App (`docs/REQUIRED-CHECKS.md`
  › Agent identity): with the App in place, only the owner's own account can authorize a merge, for real.
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

- Coordinator and delegate share the App: the gate cannot tell them apart. Separation stays with the guard, the role file,
  worktree paths and the signed `— <role> <provider/model>` comments.
- A token handed to a session can do anything the App's permissions allow until it expires.
- Per-role Apps (#236–#238, #240) are not planned under this decision; they remain open for a later owner decision.
