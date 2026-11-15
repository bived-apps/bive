# The Folds: Bive's cast (owner's choice, 2026-11-14; issue #278)

Seven cut-paper companions that show Bive's roles by silhouette, prop and gesture. For Bive's own README and docs only.

| Companion | Role | How the role reads |
| --- | --- | --- |
| Maren | owner | the only human; the only one with a pen (neutral ink, capped until she decides) |
| Sill | advisor | a teal folded letter with no arms: it looks (a pale gaze cone), answers (a one-dot bubble), folds its flap shut and touches nothing |
| Brae | coordinator | an amber folder that fans task cards and hands out one at a time; empty hands, no pen |
| Pim, Odet, Fenn | delegates | violet shapes, one tool each (brush, thread, set square) |
| Tally | extra companion | a grey paper roll that records who asked, did and reviewed; no role, no tasks |

Ideas the pictures carry:
- **Skill, not rank**: the same mustard flag (asking the owner) is worn by Brae and by Fenn.
- **Learning**: a lesson gives Pim a small coral knot; same size, same place.
- **Peer review**: a peer points at a problem without marking the work (thread under the line, set square as a frame); the author fixes it; only Maren decides.

| File | Scene |
| --- | --- |
| `cast-sheet.svg` | the seven companions, each showing its reviewing gesture |
| `scene-handover.svg` | one card from Brae to Pim, Pim paints, the card goes to Maren |
| `scene-refusal.svg` | Pim offers finished work to Brae, who has no pen; both turn to Maren |
| `scene-peer-review.svg` | Odet lays a thread under Fenn's line; Fenn fixes it; Maren waits |
| `scene-learning.svg` | two returns on Tally's tape, then clean ticks and a knot for Pim |
| `scene-advisor.svg` | Brae asks; Sill looks, answers with one dot, and folds shut |
| `poses-odet.svg` | one delegate in three poses (consistency check) |

## Provenance

- Written as SVG code by `claude-fable-5-2` (through OpenCode's `claude-agent` route), in sessions started by the coordinator
  `anthropic/claude-opus-5-5`, from a cast first proposed by a Claude artifact and refined on the owner's instructions
  (2026-11-14). No image generator, no source image, no stock asset.
- Chosen by the owner after comparing other directions (patchwork, a research laboratory) and the same brief given to
  GPT-6.1 Sol, GPT-6 Astra, Gemini 4 Hydrogen and GLM 5.3 Flash. Those trials stay outside the repository.
- **Not verified**: originality rests on judgement (no search for similar existing characters or names was run), and the
  usage rights of model-written SVG are the owner's to confirm. The style (flat shapes, dot eyes) is a common idiom.

## Rules each file follows

`role="img"` with a `<title>` and a `<desc>`; no text inside the picture; no script, event handler, embedded image or
external link (only internal `#` references); 1600 x 900. Checked by `tests/design-cast.test.ts`.
