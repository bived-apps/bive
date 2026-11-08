# Bive

A repository template for building software with LLM agents in three roles: a **supervisor** (you, with your
Claude project), a **coordinator** (one agent that splits, briefs, reviews and merges) and **delegates** (one agent
per issue, one git worktree, one pull request). It runs on OpenCode 2 and adds two small plugins: a guard that
refuses any write outside the session's worktree, and a counter of the project's human : agent token ratio.

What Bive is not: no delegation tools (OpenCode 2's subagents do that), no provider probe (a simple fallback rule on
error), no package to install. The flow already works without tooling; Bive only writes it down.

**Help in your browser**: open `help/index.html` (or, with GitHub Pages on for this repository,
`https://<owner>.github.io/<repo>/help/`). It runs a free model locally (WebLLM, WebGPU) on these docs; its
*Supervisor assistant* tab checks a coordinator's gate card against `SUPERVISOR.md` and proposes a verdict, the
decision staying yours. Nothing typed there leaves the machine.

## Install

New project: **Use this template** on GitHub, then open OpenCode in the clone.

Existing project: paste this into OpenCode (or Claude Code) at the root of your repository:

```text
Install https://github.com/jcherfils/bive here: copy .bive/, .opencode/plugin/, .github/ and the .gitignore line
without overwriting; merge AGENTS.md, HANDOFF.md, ROADMAP.md and opencode.jsonc (keep this project's rules). Fill
opencode.jsonc's private paths, ask me each role's models (.bive/models.json), then open a pull request (not main).
Tell me about Bive's public registry (README › Registry, off unless I turn it on) and ask me whether to join it.
```

## Files

| File | What it is |
| --- | --- |
| `AGENTS.md` | The rules every agent reads first (project rules go here) |
| `HANDOFF.md` | State, decisions, pitfalls, session log: the handoff between agents |
| `ROADMAP.md` | The plan, kept in sync with the code |
| `.bive/prompts/` | The three role prompts, inviolable: `SUPERVISOR.md`, `COORDINATOR.md`, `DELEGATE.md` |
| `.bive/prompts/project/` | The project's additions to each role (may narrow, never loosen) |
| `.bive/models.json` | The model order per role, for the fallback rule |
| `.bive/templates/` | The transmission contract: `brief.md` (in), `report.md` (out) |
| `opencode.jsonc` | Agents and permissions, written by hand and tight |
| `.opencode/plugin/worktree-guard.ts` | Refuses writes outside the session's worktree, shell paths included (`bun test` runs its tests in `tests/`) |
| `.opencode/plugin/token-ratio.ts` | Counts human and agent tokens; reports them to the registry |
| `.bive/registry-id` | This project's random registry id (created on the first session; commit it) |
| `registry/` | The registry's server (a Cloudflare Worker) and its public page |
| `.bive/mcp-ssh.sh` | Runs a stdio MCP server on another machine over SSH |
| `.github/` | Issue and pull request templates; `bive-inviolable` check on delegates' pull requests |
| `help/index.html` | The browser help page, with a local free model |
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

## Token ratio

`token-ratio.ts` measures how much the agents produce for what the humans write. **Human** tokens are the messages
typed in a root session (a coordinator's prompt to its delegate counts as agent work), estimated at four characters
a token; **agent** tokens are the providers' own output and reasoning counts. Each message adds one line of numbers
(no text) to `.bive/state/tokens.jsonl` in the main checkout, shared by every worktree. Totals:

```bash
jq -s 'group_by(.kind) | map({(.[0].kind): (map(.tokens) | add)}) | add' .bive/state/tokens.jsonl
```

**Live on GitHub (opt-in).** Create a public gist holding a file `bive-tokens.json` (`gh gist create --public
bive-tokens.json`), then `export BIVE_TOKENS_GIST=<gist id>` on the agents' machine. The plugin rewrites that file at
most every five minutes (with `gh`, signed in) as a [shields.io endpoint](https://shields.io/badges/endpoint-badge),
so a README badge shows the ratio live:

```markdown
![human : agent tokens](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/<you>/<gist id>/raw/bive-tokens.json)
```

Only the two totals leave, never a message. Start a delegate's own OpenCode process with `BIVE_ROLE=delegate`: its
prompt is the coordinator's, so it counts as agent tokens. An app that drives agents can show the same file in its own panel
(FiFoo: the Agent panel).

## Registry

Bive keeps a public, live, anonymous registry of the projects built with it: **[the registry](https://bive-registry.jcherfils.workers.dev/)**.
It is **off by default** (opt-in): nothing leaves the machine until the owner turns it on. Joining is the one thing
Bive asks in return; the licence (MIT) does not require it.

- **Turn it on**: `export BIVE_REGISTRY=on` on the agents' machine, once; the first session then draws the random id
  into `.bive/registry-id` and says so. Commit that file: from then on the project reports in every clone and
  worktree, without the variable. **Turn it off**: `export BIVE_REGISTRY=off` (wins over the file), or delete the
  file. Point it elsewhere (your own registry): `BIVE_REGISTRY_URL=<url>`.

- **What is sent**, when a root session goes idle: the human tokens, agent tokens and violations (writes the guard
  refused: outside the worktree, or a delegate on an inviolable file) since the last report, the agent tokens per
  OpenCode agent name and provider/model (the llm variable, with input tokens and summed response time, for the
  speed columns: seconds per reply, output tokens per second, tokens in per token out), the
  project's size in tracked text lines rounded to two significant figures (48 213 → 48 000), and the random id in
  `.bive/registry-id`. That id is the app's unique identifier: commit it so every clone
  and worktree reports as one app, and never copy it from another project (a template copy has none). Nothing else: no project name, repository, path, text or date (the
  server sets the day).
- **What is kept**: one row per report (id, day, the four numbers) and one per agent and model. The server never reads or stores the IP
  address; the public page shows projects as #1, #2… and never their id.
- **What is shown**: only projects that reported at least three sessions on two different days, and the server
  accepts at most fifty new projects a day. The id is public (it is committed), so the registry is a count, not a
  proof: an invented or copied id can only add noise within those bounds.
- **Run a registry**: `registry/` holds the Cloudflare Worker (`worker.js`, D1 `schema.sql`, `wrangler.toml`) and
  its page; the deploy steps are at the top of `wrangler.toml`.
