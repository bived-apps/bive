# Direct OpenCode server access from an external chat harness

Research for [#222](https://github.com/bived-apps/bive/issues/222). **observed** means the coordinator saw it live on
OpenCode 2.3.0 on 2026-11-14/15 or read it in the running server's /openapi.json; **hypothesis** means a documented
or inferred claim this research did not exercise.

## Question

Does a chat harness that connects straight to the running OpenCode server give a Bive project a reusable capability
that Bive's own OpenCode API use (delegate sessions, schedules) and its managed skills (`.bive/skills.json`) lack?

## What Bive already does

- Delegate sessions: `docs/COORDINATING.md` (*Start a delegate as a session*) builds `POST /api/session`,
  `POST /api/session/<id>/move` and `POST /api/session/<id>/prompt` with the pure builders of `lib/delegate-session.ts`
  (`buildCreateRequest`, `buildMoveRequest`, `buildPromptRequest`, `authHeader`); `lib/delegate-run.ts` adds the wait
  and the event and branch readers.
- The same server without a password: `docs/COORDINATING.md` records that a running local OpenCode service reached with
  `opencode api` works as well as `opencode serve`, whose printed password feeds the basic auth of `authHeader`.
- Schedules: `docs/COORDINATING.md` (*Be woken when a pull request is merged*, issue #242) registers
  `POST /api/experimental/schedule` on the coordinator's own session and deletes it by id.
- Managed skills: `.bive/skills.json` declares the skills of each role with a revision; `lib/skill-provisioning.ts`,
  `lib/skill-permissions.ts` and `docs/SKILL-PROVISIONING.md` provision them and report source and revision.
- Roles and authority: `AGENTS.md` gives the owner alone the merge right; a delegate never merges or approves.

## What direct server access adds

- **hypothesis** — a harness that reaches the server can drive the same HTTP surface Bive already uses (session
  create, prompt, move, wait, event stream), described at https://opencode.ai/docs/api; not exercised here.
- **observed** — the running server's /openapi.json lists routes Bive does not use, all experimental: background jobs,
  session fork, session instruction entries and the plugin RPC route `POST /api/rpc/{rpcID}/{method}` (as the
  coordinator reported; the RPC route is described at https://opencode.ai/docs/build/plugins/rpc).
- **observed** — a plain HTTP call to the local ports is refused with HTTP 407, and `opencode api <METHOD> <path>`
  reaches the running background service with its own authentication.
- **hypothesis** — `opencode serve --port <p>` prints a password and the requests use basic auth
  `opencode:<password>` (`authHeader` in `lib/delegate-session.ts`); documented in `docs/COORDINATING.md`, not
  exercised here.
- **observed** — the running server's /openapi.json lists a pairing route (`POST /api/pair`, `GET /auth/connect/{code}`)
  and a client-MCP attach route (`POST /api/experimental/client-mcp`, plus its token route), as the coordinator
  reported.
- **hypothesis** — that client-MCP attach route is the only candidate for a genuinely new capability: it could let a
  harness expose its own tools to OpenCode sessions, which Bive cannot do from its own shell. Not exercised here.
- **hypothesis** — a harness on the same server could list Bive's sessions and read their messages (`GET /api/session`,
  `GET /api/session/<id}/message`, both listed in the server's /openapi.json). That would be visibility rather than
  capability: Bive reads the same routes through `opencode api` (`docs/COORDINATING.md`, not exercised here).
- **observed** — a session's Code Mode runtime exposes a built-in `tools.opencode.*` namespace (models search, session
  move, worktrees, MCP resources); https://opencode.ai/docs/build/client documents the client and the service entry
  points.

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
