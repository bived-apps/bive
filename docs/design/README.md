# Design assets (Phase 2, issue #278)

SVG assets written by hand from the tokens of `docs/DESIGN-BRIEF.md`: no image provider, no generated picture. They are
staged here until the organization profile repository exists, then they move there (Bive itself only needs the flow).

| File | What | Colour |
| --- | --- | --- |
| `flow.svg` | the Bive flow: owner, advisor, coordinator, delegates, gates 1 and 3 | role colours on the soft base |
| `role-owner.svg` | a key in a gold ring (the ring is decorative) | ink, gold |
| `role-advisor.svg` | a magnifier | teal |
| `role-coordinator.svg` | a clipboard | amber |
| `role-delegate.svg` | a laptop | violet |
| `icon-template.svg`, `icon-workspace.svg`, `icon-registry.svg`, `icon-bench.svg`, `icon-university.svg` | page icons | ink |

Rules each file follows (checked by `tests/design-assets.test.ts`): a 24 x 24 grid with a 2 px round stroke for glyphs and
icons; `role="img"` with a `<title>` and a `<desc>`; only the brief's palette; no script, no external reference, no
embedded bitmap. Embed with real alt text, for example `![Coordinator](docs/design/role-coordinator.svg)`; the flow keeps
its text twin in the README's Mermaid diagram.

Checked visually at 24 px and enlarged, and the flow at 640 and 1000 px wide. A different renderer may place text
slightly differently: the diagram uses system fonts and keeps generous margins for that reason.
