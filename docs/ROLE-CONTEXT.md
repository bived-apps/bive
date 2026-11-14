# Role context: what each role loads and reads (issue #233, measured 2026-11-14)

Measured on `bived` at `f2bf72d`. Bytes are the file size; tokens are an estimate (bytes / 4), not a tokenizer count.
No live paid session was used. Whether OpenCode also injects `AGENTS.md` into every session by itself is **not
verified here**: the table counts it once as a file the role is told to read.

## Before and after

| Item | Before (`83e3d9f`) | After (`f2bf72d`) | Change |
| --- | --- | --- | --- |
| `HANDOFF.md` (read by every role) | 416 lines, 40,721 B (~10.2k tokens) | 81 lines, 6,880 B (~1.7k tokens) | -83 % |
| `.bive/prompts/DELEGATE.md` (delegate system prompt) | 39 lines, 3,681 B | unchanged (inviolable) | 0 |

## What each role loads (instructions) and reads (files)

| Role | System prompt | Told to read | Fixed total | Of which a brief could drop |
| --- | --- | --- | --- | --- |
| Delegate | `DELEGATE.md` 3,681 B | `AGENTS.md` 13,504 B, `HANDOFF.md` 6,880 B, `project/DELEGATE.md` 210 B, the brief, files the brief names | ~25 KB (~6.2k tokens) | `HANDOFF.md` (project history, not needed to do one issue), parts of `AGENTS.md` aimed at other roles |
| Coordinator | `COORDINATOR.md` 14,271 B | `AGENTS.md`, `HANDOFF.md`, `project/COORDINATOR.md`, the epic and its issues; `docs/COORDINATING.md` (29,242 B) when it starts a delegate | ~35 KB without `COORDINATING.md`, ~64 KB with it | read `COORDINATING.md` by section, not whole |
| Advisor | `ADVISOR.md` 1,804 B | `AGENTS.md`, `HANDOFF.md`, the question, relevant files | ~22 KB | the same as the delegate |

`ROADMAP.md` (26,793 B) is read by no role at start; keep it that way.

## Read contract (no boundary weakened)

- A **brief names the files to read**; it never tells a delegate to read `ROADMAP.md`, `docs/COORDINATING.md` or a whole
  doc. Section names, not files (`docs/COORDINATING.md` › Open and review a pull request).
- The coordinator reads `docs/COORDINATING.md` by the section its step needs.
- Every role still reads `AGENTS.md` first: it holds the identity, guard, report and authority rules. That is the core
  rule of `AGENTS.md`; this document changes none of it.

## Owner decision (blocked, not assumed)

The issue's target is a delegate of about twenty lines of rules. That needs one of these, both inviolable-file changes:

1. **Keep as is** (recommended now): the handoff cut already saved ~8.5k tokens per session at no rule change.
2. **Delegate reads only `DELEGATE.md` plus the brief**, with the rules a delegate needs (identity, guard, report,
   refusal) moved into `DELEGATE.md` and `AGENTS.md` told that a delegate need not read it. Saves ~3.4k more tokens,
   but duplicates rules in two files, which is how contradictions began (#117). Needs the owner's decision and a
   separately authorized core-prompt change.

Until the owner chooses, no core prompt, `AGENTS.md` or `opencode.jsonc` is edited, and the delegate is not described
as running on twenty-line prompts.

## What the tests hold

`tests/role-context.test.ts` fails if the fixed context of a role grows past its ceiling, so a later edit cannot
quietly undo the saving, and if a role prompt that must carry a safety rule loses it.
