# Bive

A repository template for building software with LLM agents in three roles: a **supervisor** (you, with your
Claude project), a **coordinator** (one agent that splits, briefs, reviews and merges) and **delegates** (one agent
per issue, one git worktree, one pull request). It runs on OpenCode 2 and adds no tooling of its own except one
guard: a ~30-line plugin that refuses any write outside the session's worktree.

What Bive is not: no delegation tools (OpenCode 2's subagents do that), no provider probe (a simple fallback rule on
error), no package to install. The flow already works without tooling; Bive only writes it down.

## Install

New project: **Use this template** on GitHub, then open OpenCode in the clone.

Existing project: paste this into OpenCode (or Claude Code) at the root of your repository:

```text
Install Bive from https://github.com/jcherfils/bive into this repository: copy .bive/, .opencode/plugin/,
.github/ISSUE_TEMPLATE/delegate.md, .github/pull_request_template.md and the .gitignore line, without overwriting
any existing file (merge AGENTS.md, HANDOFF.md, ROADMAP.md and opencode.jsonc by hand: keep this project's rules,
add Bive's). Then fill opencode.jsonc's private paths for this project and ask me which models each role uses (.bive/models.json).
Commit on a branch and open a pull request; do not push to main.
```

## Files

| File | What it is |
| --- | --- |
| `AGENTS.md` | The rules every agent reads first (project rules go here) |
| `HANDOFF.md` | State, decisions, pitfalls, session log: the handoff between agents |
| `ROADMAP.md` | The plan, kept in sync with the code |
| `.bive/prompts/` | The three role prompts: `SUPERVISOR.md`, `COORDINATOR.md`, `DELEGATE.md` |
| `.bive/models.json` | The model order per role, for the fallback rule |
| `.bive/templates/` | The transmission contract: `brief.md` (in), `report.md` (out) |
| `opencode.jsonc` | Agents and permissions, written by hand and tight |
| `.opencode/plugin/worktree-guard.ts` | Refuses writes outside the session's worktree |
| `.bive/mcp-ssh.sh` | Runs a stdio MCP server on another machine over SSH |
| `.github/` | Issue template for delegated tasks, pull request template |
| `.bive/state/` | Run-time state, ignored by git |

## The flow

1. The supervisor (you) agrees the plan in `ROADMAP.md` and the split of an epic into issues.
2. The coordinator writes one brief per issue (`.bive/templates/brief.md` → `.bive/state/briefs/<n>.md`), creates a
   worktree `issue/<n>-<slug>`, and starts a delegate subagent in it.
3. The delegate works only in its worktree, runs the fast checks, opens a pull request whose body is its report
   (`.bive/templates/report.md`), and stops.
4. The coordinator reviews, asks for changes or merges into the integration branch; you merge to `main`.

The coordinator asks you, by a card or a message, at three gates only: before opening an epic, when a delegate
fails twice, and before the pull request to `main`.

## MCP over SSH

An agent can use an MCP server that runs on another machine (the app's own machine, a GPU worker) without any port
opened: the stdio server is started over SSH and speaks through ssh's stdin and stdout.

1. On the remote machine, the server runs as a command (e.g. `~/FiFoo/.venv/bin/python -m fifoo.mcp_server`) and the
   agent's machine logs in with a key (no password prompt: `BatchMode`).
2. On the agent's machine, set the host in the environment, never in the repository: `export BIVE_MCP_SSH=user@host`
   (or a `Host` alias of `~/.ssh/config`).
3. In `opencode.jsonc` › `mcp`, the command is `["sh", ".bive/mcp-ssh.sh", "<remote command>", "<args>"...]` (an
   example is commented there).

**Which key: your choice.** Without `BIVE_MCP_SSH_KEY`, ssh uses your usual keys and agent (simplest). With it, MCP
gets a dedicated key that cannot open a shell:

```bash
ssh-keygen -t ed25519 -N "" -f ~/.ssh/bive_mcp -C "bive mcp"      # on the agent's machine
export BIVE_MCP_SSH_KEY=~/.ssh/bive_mcp                             # only this key is offered (IdentitiesOnly)
```

On the remote machine, one line in `~/.ssh/authorized_keys` pins the key to the server (a forced command: whatever
the client asks, sshd runs only this; no shell, no forwarding, no pty):

```text
restrict,command="/Users/you/FiFoo/.venv/bin/python -m fifoo.mcp_server" ssh-ed25519 AAAA... bive mcp
```

Revoke it by deleting that line. The agent never reads `~/.ssh` (denied in `opencode.jsonc`): only the `ssh`
program does. Everything the server
returns goes through the server's own rules (FiFoo: its consent scopes and egress gate) exactly as on one machine.

## Provider fallback

No probe by default. Each role lists models in order in `.bive/models.json`; when a call fails (unreachable, 429,
quota), the coordinator retries the same brief with the next model and says so in the report. When every model of
the list failed, a project can offer a provider search: FiFoo has `tools/find_providers.py` (and the MCP tool
`find_providers`, whose result is a card in its Questions window), which tries every model OpenCode knows with one
tiny prompt and prints the ones that answer, fastest first, as a `.bive/models.json` line. A delegate's work that a
reviewer rejects is redone by the next model, not patched by the same one.
