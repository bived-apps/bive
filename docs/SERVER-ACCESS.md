# Direct OpenCode server access from an external chat harness

Research for [#222](https://github.com/bived-apps/bive/issues/222). **observed** marks a fact the coordinator saw on
OpenCode 2.3.0 on 2026-11-14/15; **hypothesis** marks a claim this research did not verify.

## Question

Does a chat harness that connects straight to the running OpenCode server give a Bive project a reusable capability
that Bive's own use of the OpenCode API (delegate sessions, schedules) and its managed skills (`.bive/skills.json`) do
not already give?

## What Bive already does

- Delegate sessions: `docs/COORDINATING.md` (*Start a delegate as a session*) builds `POST /api/session`,
  `POST /api/session/<id>/move` and `POST /api/session/<id>/prompt` with the pure builders of `lib/delegate-session.ts`
  (`buildCreateRequest`, `buildMoveRequest`, `buildPromptRequest`, `authHeader`); `lib/delegate-run.ts` adds the wait,
  the event reader and the branch reader.
- The same server without a password: `docs/COORDINATING.md` records that a running local OpenCode service reached with
  `opencode api` works as well as `opencode serve`, which prints the password of the basic auth built by `authHeader`.
- Schedules: `docs/COORDINATING.md` (*Be woken when a pull request is merged*, issue #242) registers
  `POST /api/experimental/schedule` on the coordinator's own session and deletes it by id.
- Managed skills: `.bive/skills.json` declares the skills of each role with a revision; `lib/skill-provisioning.ts`,
  `lib/skill-permissions.ts` and `docs/SKILL-PROVISIONING.md` (sections 4, 5, 6) provision them and report their
  source and revision.
- Roles and authority: `AGENTS.md` gives the owner alone the merge right; a delegate never merges, approves or
  releases anything.

## What direct server access adds

- **observed** — the harness reaches the same HTTP surface Bive already uses (session create, prompt, move, wait, event
  stream): https://opencode.ai/docs/api. Nothing is gained that `lib/delegate-session.ts` does not already build.
- **observed** — the server exposes routes Bive does not use, all experimental: background jobs, session fork, session
  instruction entries and the plugin RPC route `POST /api/rpc/{rpcID}/{method}`:
  https://opencode.ai/docs/api and https://opencode.ai/docs/build/plugins/rpc.
- **observed** — the server authenticates: `opencode serve --port <p>` prints a password and requests use basic auth
  `opencode:<password>` (`authHeader`), while a plain HTTP call to the local port is refused (HTTP 407); the
  `opencode api` command uses service discovery and authentication: https://opencode.ai/docs/troubleshooting.
- **observed** — the server also exposes a pairing route (`POST /api/pair`, `GET /auth/connect/{code}`) and a
  client-MCP attach route (`POST /api/experimental/client-mcp`, plus its token route): https://opencode.ai/docs/api.
- **hypothesis** — the client-MCP attach route is the only candidate for a genuinely new capability: it could let a
  harness expose its own tools to OpenCode sessions, which Bive cannot do from its own shell. Not verified here, and
  the route is experimental.
- **hypothesis** — a harness on the same server could list Bive's sessions and read their messages
  (`GET /api/session`, `GET /api/session/<id>/message`). That is visibility, not capability: the coordinator already
  reads the same routes through `opencode api`.
- **observed** — a session's Code Mode runtime exposes a built-in `tools.opencode.*` namespace (models search,
  session move, worktrees, MCP resources); the client and the local service entry points are at
  https://opencode.ai/docs/build/client.

## Gaps and risks

- Authentication: every route needs the server's credentials, so a harness holding them holds Bive's whole authority.
  Bive's own use of `opencode api` keeps those credentials in the CLI, out of the model's reach.
- Privacy: messages, diffs, shell output and instruction entries are readable by any client with the password; the
  worktree guard protects files, not the conversation.
- Experimental routes: schedules, jobs, fork, instruction entries and the client-MCP attach route may change or
  vanish; Bive already depends on the experimental schedule route.
- Authority: a connected client could create a session, prompt a delegate or delete one, which only the owner may do;
  the server knows nothing about Bive's roles.
- Scope: the shared background service owns every session of the machine, not only the project's.

## Recommendation

leave it as a harness capability

Reason: every route a harness can reach is either already used by Bive through the same API
(`lib/delegate-session.ts`, the schedule route of `docs/COORDINATING.md`) or an experimental route that would hand an
outside client more authority over Bive's sessions than Bive's own roles allow. No distinct reusable Bive capability
was demonstrated, so Bive should not build on a connection it does not control.
