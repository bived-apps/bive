---
name: bive-ask-owner
description: How a Bive role asks the owner a yes/no/other question: the premade question block, who asks whom (delegate to coordinator to owner), how to batch, and how answers are recorded. Use whenever a decision belongs to the owner.
---

# Asking the owner

The owner answers one of five ways: **yes**, **no**, **other** (free text), **supervisor** ("ask the supervisor") or
**coordinator** ("you decide"). Make every question answerable in one
line. The block to fill is `.bive/templates/question.md`.

## The chain: answer what you may, pass up the rest, unchanged

Every role may ask the rung directly above it, during its session. Each role **answers** what is inside its authority
and **transmits** the rest, unchanged, adding itself and its reason to `Path`. Nobody answers beyond their authority,
and nobody answers "no" just to avoid passing a question up.

| Role | May answer | Transmits when |
|---|---|---|
| **Delegate** | Implementation choices inside its brief (say which you took in the report). | It is anything else: ask the coordinator and, if the answer blocks the part, stop that part (others may go on). |
| **Coordinator** | Anything a rule already answers (cite the section); brief ambiguity, sequencing, model fallback, test and doc choices within the rules. | It is a gate (the split, a delegate that failed twice, the pull request to `main`), shared-file arbitration, starting a coordinator, a rule interpretation that could change behaviour, or not reversible. |
| **Supervisor** | Gate decisions, shared-file arbitration, how a rule applies to a case, starting coordinators. | It is owner-only (below), or it would change a rule. |
| **Owner** | Everything. Only the owner decides: the dated merge label, who may merge before a bench pass (#120), promoting an agent to a role, any change to `AGENTS.md` or a role prompt, anything irreversible or outward (publishing, deleting, spending), credentials. | |

**Bypass**: a rung is skipped only when (a) it does not exist (no qualified supervisor agent: the question goes to the
owner or the person the owner named), or (b) it has not answered after the wait the question states (default one
day) and the question blocks work: the asker passes it to the next rung and records the bypass in `Path`. A bypass is
never a way to get a different answer: once a rung has answered, the question is not asked again higher up, unless
that answer was outside its authority, which makes it void.

**Transport**: during a session, a delegate asks by a comment on its issue (the block, `To: coordinator`) and, once
delegates are API sessions (ROADMAP 0.2), the coordinator may also prompt it; before that, the block goes under
`**Left**` in the delegate's report. The coordinator is the only role that posts to the owner: it batches, cites the
rule instead of asking when a rule answers, and merges duplicates. A role answering sends the answer to the asker
(comment on the issue) and records it as below.

## Writing a good question

1. **One decision per block.** Two decisions, two blocks.
2. **Lead with the decision**, not the story: the owner should be able to answer from the first line.
3. **Give a recommendation.** "Recommended: Yes, because ..." in one line. Never ask open-ended when you can propose.
4. **Say what is blocked** and whether it is **reversible**. If not reversible, wait for the answer.
5. **A default only for reversible questions.** "Default if unanswered: none" is the normal case.
6. **At most 3 context lines.** Link, do not paste.

## Asking (coordinator)

- Where the owner is in an OpenCode session: use the session's question tool with the options **Yes**, **No**,
  **Other** (put the recommended one first, labelled "(Recommended)"). Several questions go in one call.
- Otherwise: post the blocks as **one comment** on the issue (or the pull request), numbered Q1..Qn, and say
  "Answer with one line per question."
- Batch at the end of a part or when a delegate is blocked, not one by one. More than 5 in a batch means the split was
  wrong: raise that instead.

## When the owner answers "supervisor"

The coordinator forwards the same block, unchanged, to the supervisor (a person, or an agent that holds a published
bench pass) as one comment on the issue naming the supervisor, and waits. The supervisor answers yes, no or other like
the owner. The supervisor may not answer what is the owner's alone: the dated merge label, who may merge before a
bench pass (#120), promoting an agent to a role; those come back to the owner. While no agent is qualified, the
supervisor is the owner or a person the owner named, so "supervisor" then means that person.

## When the owner answers "coordinator"

The coordinator decides, says so on the issue (`Owner, <date>: Q2 coordinator; decided yes because ...`) and takes the
responsibility. It may not take over a decision about a merge, a dated label, a gate (the split, a delegate that
failed twice, the pull request to `main`), or a change to `AGENTS.md` or a role prompt: those go back to the owner as
a plain yes/no. If the question was marked not reversible, the coordinator repeats it once with its recommendation
rather than deciding.

## Recording the answer

- Quote the answer on the issue: `Owner, <date>: Q2 yes`.
- A decision that outlives the issue goes to `HANDOFF.md` › Decisions, dated and attributed to the owner, in a
  coordinator pull request. A decision that changes a rule goes to `AGENTS.md` or the role prompt the same way.
- "Ask again later" is an answer: record it on the issue and leave the issue open (see #120).

## Examples

```
**Question Q1** — from delegate opencode/big-pickle, issue #189
**Decision needed**: should a missing local alias map fall back to the canonical model id?
**Context**: docs/PROVIDERS.md says use the canonical id and tell the owner; lib/delegate-session.ts line 40.
**Options**:
- [ ] **Yes** — fall back and print one warning.
- [ ] **No** — fail the session start.
- [ ] **Other** — owner describes.
**Recommended**: Yes, it matches PROVIDERS.md.
**Blocks**: nothing; the part can finish with Yes.
**Reversible**: yes
**Default if unanswered**: Yes
```
