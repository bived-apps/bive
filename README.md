# Bive 0.0

A repository template for building software with LLM agents in three roles, on OpenCode 2:

```text
   you + your Claude project          one agent                      one agent per issue
   ┌──────────────┐   plan, 3 gates   ┌──────────────┐  brief, worktree  ┌──────────────┐
   │  supervisor  │ ───────────────▶  │ coordinator  │ ────────────────▶ │   delegate   │
   └──────────────┘ ◀─────────────── └──────────────┘ ◀──────────────── └──────────────┘
                     PR to main          splits, reviews, merges        report.md, PR, stops
```

Bive is a template and two small plugins, nothing else: a **guard** that refuses any write outside the session's
worktree, and a **counter** of human and agent tokens. No delegation tools (OpenCode 2's subagents do that), no
provider probe (a fallback rule on error), no package to install. The flow ran by hand on
the owner's first project before Bive wrote it down; Bive now develops itself with it.

## Install

New project: **Use this template** on GitHub, open OpenCode in the clone, and start the coordinator with
`.bive/prompts/COORDINATOR.md`: its first step replaces this README, `HANDOFF.md` and `ROADMAP.md` with the skeletons
of `.bive/templates/`.

Existing project: paste this into OpenCode (or Claude Code) at the root of your repository:

```text
Install https://github.com/jcherfils/bive here: copy .bive/, .opencode/plugin/, .github/, docs/ and the .gitignore
line without overwriting; create AGENTS.md, HANDOFF.md and ROADMAP.md from .bive/templates/ if missing, else merge
(keep this project's rules); merge opencode.jsonc. Show me the diff before writing. Fill opencode.jsonc's private
paths, ask me each role's models (.bive/models.json), then open a pull request (not main). Tell me about Bive's
public registry (docs/REGISTRY.md, off unless I turn it on) and ask me whether to join it.
```

## The flow

1. You agree the plan in `ROADMAP.md` and the split of an epic into issues (gate 1).
2. The coordinator writes one brief per issue (`.bive/templates/brief.md`), creates a worktree `issue/<n>-<slug>`
   and starts a delegate in it.
3. The delegate works only in its worktree, runs the fast checks, opens a pull request whose body is its report
   (`.bive/templates/report.md`), and stops.
4. The coordinator reviews and merges into the integration branch; it asks you when a delegate fails twice (gate 2)
   and before the pull request to `main` (gate 3). You merge.

## Files

| File | What it is |
| --- | --- |
| `AGENTS.md` | The rules every agent reads first |
| `HANDOFF.md`, `ROADMAP.md` | State and plan, kept true by the coordinator (here: Bive's own) |
| `.bive/prompts/` | The three role prompts, inviolable; `project/` holds a project's additions |
| `.bive/templates/` | `brief.md` in, `report.md` out; the skeletons of `README.md`, `HANDOFF.md`, `ROADMAP.md` |
| `.bive/models.json` | The model order per role, for the fallback rule ([docs/PROVIDERS.md](docs/PROVIDERS.md)) |
| `opencode.jsonc` | Agents and permissions, written by hand and tight |
| `.opencode/plugin/worktree-guard.ts` | Refuses writes outside the worktree, shell paths included (`bun test`) |
| `.opencode/plugin/token-ratio.ts` | Counts human and agent tokens ([docs/TOKENS.md](docs/TOKENS.md)); reports to the registry if asked ([docs/REGISTRY.md](docs/REGISTRY.md)) |
| `.bive/mcp-ssh.sh` | Runs a stdio MCP server on another machine over SSH ([docs/SSH.md](docs/SSH.md)) |
| `.github/` | Issue and pull request templates; `bive-inviolable` check on delegates' pull requests |
| `registry/`, `help/` | The registry's Worker and page, the browser help: leaving for their own repository (ROADMAP 0.1 › 5) |

## Developing Bive

Agents work on the branch **`bived`** by pull request; `main` is the template people copy and only the owner merges
into it. Start the coordinator with the prompt in `HANDOFF.md › Running it`. MIT licence.
