# Design assets (Phase 2, issue #278)

SVG assets written by hand from the tokens of `docs/DESIGN-BRIEF.md`: no image provider, no generated picture. They are
for Bive only (owner, 2026-11-14: not for a public front end): its docs and README. No other repository uses them.

| File | What | Colour |
| --- | --- | --- |
| `flow.svg` | the Bive flow: owner, advisor, coordinator, delegates, gates 1, 2 and 3 | role colours on the soft base |
| `role-owner.svg` | a key in a gold ring (the ring is decorative) | ink, gold |
| `role-advisor.svg` | a magnifier | teal |
| `role-coordinator.svg` | a clipboard | amber |
| `role-delegate.svg` | a laptop | violet |
| `icon-template.svg`, `icon-workspace.svg`, `icon-registry.svg`, `icon-bench.svg`, `icon-university.svg` | page icons | ink |
| `icon/` | three candidate icons for the project, the organization and the GitHub App, until the owner chooses ([guide](icon/README.md)) | the cast's colours |
| `companions/` | one square icon per companion of the cast, for the README's role table ([guide](companions/README.md)) | the cast's colours |
| `flower.svg`, `flower.png` | the roles as one flower (issue #368), for the icon of the App `bived-agents` and the site's roles section (the owner's uploads): Maren, the owner, at the centre in a gold ring, a little larger; five evenly spaced petals around her, each carrying one upright companion: Odet at the top, then clockwise Brae, Pim, Fenn, Sill (each once, no second ring). 512 x 512, full-bleed cream, everything inside the centred circle of radius 0.4 of the side, so a round crop keeps it; at 32 px it is a face in a gold ring among one teal, one amber and three violet petals. The PNG is `rsvg-convert -w 1024 flower.svg -o flower.png`. Provenance: written as SVG code by `claude-fable-5-2` (through OpenCode's `claude-agent` route, 2026-11-15), reusing the paths of the [companion icons](companions/README.md); no image generator, no source image. **Not verified**: originality (no search for similar marks was run; figures as the petals of a flower are a common motif) and the usage rights of model-written SVG, the owner's to confirm. Checked by `tests/design-flower.test.ts` | the cast's colours; petals in teal, amber and violet tints |
| `role-column-board.md`, `role-column-board.svg` | the choosing board for the first column of the README's role table, options A to E ([board](role-column-board.md)) | ink, role colours |
| `social/` | the 1280 x 640 social preview card and its guide ([guide](social/README.md)) | the brief's colours |

Rules each file follows (checked by `tests/design-assets.test.ts`): a 24 x 24 grid with a 2 px round stroke for glyphs and
icons; `role="img"` with a `<title>` and a `<desc>`; only the brief's palette; no script, no external reference, no
embedded bitmap. Embed with real alt text, for example `![Coordinator](docs/design/role-coordinator.svg)`; the flow keeps
its text twin in the README's Mermaid diagram.

Checked visually at 24 px and enlarged, and the flow, 1180 wide, looked at 1000 px. A different renderer may place text
slightly differently: the diagram uses system fonts and keeps generous margins for that reason.
