---
name: bive-ask-owner
description: How a Bive role asks the owner a yes/no/other question: the premade question block, who asks whom (delegate to coordinator to owner), how to batch, and how answers are recorded. Use whenever a decision belongs to the owner.
---

# Asking the owner

The owner answers three kinds of reply: **yes**, **no**, **other** (free text). Make every question answerable in one
line. The block to fill is `.bive/templates/question.md`.

## The ladder: nobody skips a rung

| Role | Does | Never |
|---|---|---|
| **Delegate** | Writes each question as a filled block under `**Left**` of its report (or in its final commit body), says what it will assume meanwhile only if *Reversible* is yes, then **stops that part**. | Asks the owner, opens an issue, comments on a pull request, or guesses on something irreversible. |
| **Coordinator** | Collects the delegates' blocks, answers what the rules already answer (cite `AGENTS.md` / prompt section instead of asking), merges duplicates, and asks the rest in **one batch**. | Sends the owner the same question twice, or a question a rule answers. |
| **Supervisor / owner** | Answers `Q<n> yes`, `Q<n> no` or `Q<n> other: <text>`. | |

A delegate's report is the only channel from a delegate; the coordinator is the only one who talks to the owner.

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
