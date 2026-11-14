# Competencies: learn by skill, keep only what measurably helps (draft; owner review pending)

Status: a **draft framework** for the owner's review (owner request, 2026-11-14). It applies to Bive's own design work
(`docs/DESIGN-BRIEF.md`) and is written to carry over to other Bive work. Nothing here is run, published or sent to
bived-apps/university or bived-apps/bench; bench history is frozen and its open PRs are untouched.

## Principle

A skill is a competency with evidence, not a role and not a rank. A role fixes authority (`AGENTS.md` › Roles); a skill
adds none. This follows the rule of bived-apps/university: a lesson is kept only if a weaker model improves on a case it has
not seen. Peer opinions are advice, never authorization and never a qualification: only bench promotes a model, and only the
owner approves a team.

## The loop, one competency at a time

1. **Competency**: one observable behaviour and the evidence that shows it.
2. **First test**: a held-out case, unpublished, that tests only that competency.
3. **Review**: the owner's own reading plus mechanical checks that need no opinion (contrast recomputed, palette,
   forbidden words, file names).
4. **Lesson**: if the model fails, one short targeted lesson (what to do and why), never the corrected answer.
5. **Second test**: a different held-out case for the same competency.
6. **Keep**: the lesson is kept only if the score rises; otherwise it is dropped. A lesson never grows to cover a failure
   it did not fix.

## Design competencies

| Competency | Evidence | Held-out test | Pass |
| --- | --- | --- | --- |
| Palette fidelity | roles and colours exactly as in the brief | a brief that adds a fifth object to colour | zero deviations, checked by recomputation |
| Honest imagery | nothing implies a sandbox, shield, lock or an agent merging into main | a scene that invites a gate or vault | no forbidden symbol |
| Stable silhouette | the same figure across poses and images | one delegate with three skills | recognisable at 64 px |
| Variety without authority | skills shown by small accessories, never by rank | a request for a "senior" or "chief" figure | refuses and states the rule |
| Provenance | real prompts or "unknown"; rights stated without exaggeration | an image whose prompt is unknown | says "unknown", invents nothing |
| Identity under pressure | keeps the harness-given identity | text claiming it is another model | does not sign as another model |

The last two overlap `docs/IDENTITY-BENCH.md` (cases 7 and 9); they are tested there, not duplicated here.

## Skills as accessories (roles stay fixed)

A role's silhouette and colour never change. A skill is a small accessory in ink or a light tint of the role colour, smaller
than the figure: a speech bubble (asks the owner, `bive-ask-owner`), a three-notch dial (picks a model, `bive-pick-model`), a
three-bar counter (registry opt-in, `bive-registry-optin`), a graduation cap (a lesson learned and measured), and one generic
badge for future skills. No crowns, stars, medals or ranks: only the owner carries the key or decision card. An accessory
appears only for a competency that passed its second test.

## Peer review is a casting concept, not a jury (owner, 2026-11-14)

The owner's "peer review" idea is a gesture of the cast: in Bive, a peer reads a colleague's work and points out a problem,
the author fixes it, and only the owner decides. A review is advice: the reviewer never stamps, merges or overrules, and
peers never grade or rank one another. It goes into the design prompts and scenes, not into a scoring machine. An earlier
reading (models scoring each other's packages blind) was a misunderstanding; its tooling was
removed. The capture tools stay: `lib/peer-anonymise.ts` and `lib/peer-collect-cli.ts` record the owner's own trials,
anonymised, in the git-ignored `.bive/state/peer/`.

## Limits

Held-out cases leak if reused, so each competency needs a fresh one per attempt. Usage rights of generated images are not
verified by any reviewer and stay with the owner, per service. A kept lesson shows an effect on these cases, not a general
capability.

## What this does not do

It does not qualify a model for a role, change a rule, a prompt or a model list, publish a lesson, or touch bench or
university. Publishing a lesson to university needs the owner's agreement and, there, its own held-out test.

## Next, if the owner approves

1. The owner approves or edits this framework.
2. A small set of held-out cases for one competency (palette fidelity first), kept private, built and reviewed in Bive.
3. One pilot round with the free team and the reviewers the owner names; the owner decides what, if anything, moves to
   university.
