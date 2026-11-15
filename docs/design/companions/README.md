# Companion icons (issue #347)

One square icon per companion of [the Folds cast](../cast/README.md), cut from `../cast/cast-sheet.svg` in its shapes
and its colours, for the first column of the README's role table. Tally has no role and no icon.

| File | Companion | Role | How it reads at 24 px |
| --- | --- | --- | --- |
| `maren.svg` | Maren | owner | a face with dark hair over a dark coat, the only human; the gold lapel is a gold stripe, the capped pen a dark bar at the right |
| `sill.svg` | Sill | advisor | a teal block with a paler pointed flap and two pale eyes; the answer bubble is a pale patch with a teal dot |
| `brae.svg` | Brae | coordinator | an amber block with a lighter top edge and two pale eyes; the flag is a mustard fleck, the task cards a violet corner, the smile is lost |
| `pim.svg` | Pim | delegate | a light violet drop with a pale tip; the brush is a thin upright line with a dark end; the beads are lost |
| `odet.svg` | Odet | delegate | a violet square with a pale corner and a coral fleck; the spool is a dark dot at the right, the thread is lost |
| `fenn.svg` | Fenn | delegate | a deep violet lozenge, the darkest of the three delegates, with a mustard fleck above and a lighter violet triangle at the right |

The three delegates differ by shape and by depth of violet (light, mid, deep), as on the cast sheet; their tools
(brush, thread, set square) are clear from 48 px. Each icon shows the head and shoulders (for Sill the top two folds,
for the others the body without legs) on a soft round ground, and is cut by that round: outside it the square is
transparent. Checked at 24 and 48 px with `rsvg-convert -w 24 maren.svg -o maren-24.png`.

## Provenance

- Written as SVG code by `claude-fable-5-2` (through OpenCode's `claude-agent` route), in a session started by the
  coordinator, from the shapes and colours of `../cast/cast-sheet.svg` (2026-11-15). No image generator, no source
  image, no stock asset.
- **Not verified**: originality rests on judgement (no search for similar existing characters or names was run), and the
  usage rights of model-written SVG are the owner's to confirm. The style (flat shapes, dot eyes) is a common idiom.

## Rules each file follows

`role="img"` with a `<title>` and a `<desc>`; no text inside the picture; no script, event handler, embedded image or
external link (only internal `#` references); colours from the cast sheet only; `viewBox="0 0 96 96"`; a soft round
ground. Checked by `tests/design-companions.test.ts`.
