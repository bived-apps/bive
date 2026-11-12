# <Project>

<!-- One paragraph: what it does, for whom. -->

## Install and run

<!-- The commands. -->

## Development

Built with [Bive](https://github.com/jcherfils/bive): a coordinator agent and delegates, one issue = one worktree = one
pull request. Rules in `AGENTS.md`, state in `HANDOFF.md`, plan in `ROADMAP.md`. Run project CI on pull requests and
pushes to the default and integration branches so a red base is visible promptly. Projects on a
self-hosted runner follow `docs/SELF-HOSTED.md`.

## What to read

- **To run the software**: this README, then the project's own docs. Nothing else.
- **To start an agent**: `AGENTS.md` (roles and rules), then `.bive/prompts/` for the role you run. `HANDOFF.md`
  is state a newcomer needs (how to run, current decisions), not a restatement of the rules and not a merge journal;
  session logs and superseded decisions leave it on a schedule the template names. `docs/COORDINATING.md` stays the
  long form, in Bive, not copied into every project until it is longer than the architecture.
