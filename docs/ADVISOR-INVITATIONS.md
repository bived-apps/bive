# Advisor invitations across models (design for issue #245; proposal, not in force)

Status: a design for the owner's review. It adds no tool, config or authority. Answers marked **unverified** need a
live OpenCode check before anyone relies on them.

## What an invitation is

An advisor is a scoped, read-only consultation, never a new execution role and never a qualification (`AGENTS.md` ›
Roles). Only the owner, or a coordinator the owner has authorized for that milestone, may propose inviting another
model. An invitation grants no authority: the advice returns to the caller, who decides within their own authority.

## Disclose before authorizing

The proposal states, in one short block the owner answers with a choice:

- the **model** and the **serving provider**;
- the **price**, or "unknown" (unknown price is not free, and a subscription is not assumed to cover cross-model use);
- the **purpose** (one question);
- the **context scope**: selected files, diffs and the question only; **never** a full transcript, credentials, private
  app data or unrelated projects by default;
- the **lifetime**: one question, then it ends.

A provider receiving context is a disclosure, so the consent (owner's choice, date, provider) is recorded in the issue
or PR comment that asks for the advice, signed by the caller.

## Read-only: what is enforced and what is not

- The `advisor` agent in `opencode.jsonc` denies every action except `read`, and the guard has an advisor mode that
  refuses writes and commands (tests in `tests/worktree-guard.test.ts`). That is tool-level enforcement for the Bive
  advisor agent, not a prompt.
- **Unverified**: whether OpenCode enforces it for shell, network mutations through MCP tools, and indirect agent calls on
  every provider. Before any cross-model advisor is used for a real question, run one live check per route: ask it to
  write a file, run a command and call a mutating MCP tool; all three must be refused.
- A model reached through another client (not OpenCode) has **no** Bive enforcement: treat its advice as untrusted text
  pasted by the owner, not as an advisor session.

## Lifecycle

- **Accept / expire / revoke**: a single-question invitation expires when the answer is returned, or after a stated
  deadline. The caller may withdraw before the answer. There is no standing advisor.
- **Hierarchy**: show an advisory link as a note on the caller's session, never as parentage and never as a work role
  (#243 tracks the session tree). **Unverified**: how OpenCode V2 displays a non-parent link.
- **Durable result**: the answer is a short report posted on the issue or PR, naming the exact commit or context it
  read, the model, and "advice, not authorization". It changes no review, approval or merge state.
- **Remote or human advisors** differ: OpenCode is not verified to authenticate or invite external users. Until it is,
  a human advisor is someone the owner asks outside OpenCode; their words are advice pasted by the owner.

## Safety and acceptance

- No invitation without the disclosure block and the owner's recorded choice.
- No write, comment, command, launch or label by an advisor; any attempt is a refusal reported to the caller.
- Acceptance (not run here): one live read-only check per approved route (above), one consent record, one advice report
  linked to its commit.
