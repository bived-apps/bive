# Social preview card (issues #334, #364)

A 1280 x 640 social preview card for the repository: the word **Bive** drawn by the team (the
[wordmark](../icon/README.md): the B of Bive's mark, then i, v and e traced by delegates, advisors and coordinators,
the owner as the dot of the i) on the soft base, the tagline "Agents write, you decide." under it, and the four role
glyphs (owner, advisor, coordinator, delegate) in a row.

## What it is

- `social-card.svg` is the source: `viewBox="0 0 1280 640"`, system sans-serif for the tagline (the only typed text),
  no text smaller than 40 px, only the colours of `docs/DESIGN-BRIEF.md` §2 and of the cast sheet (the exact list is
  in `tests/design-social.test.ts`).
- The name is a copy of `../icon/wordmark.svg` under one scaled group (200 px tall, ids prefixed `w-`): change the
  wordmark, then copy it again.
- The drawn content is centred and stays inside x 120–1160, y 120–520: GitHub's repo-card safe area (x 80–1200,
  y 80–560) with 40 px to spare. Measured on the render: 523 x 396 at (377, 123)
  (`convert social-card.png -fuzz 3% -format '%@' info:`).
- `social-card.png` is the render for upload.

## Uploading it

Only the owner can set the social preview: GitHub Settings › General › Social preview. No agent can do this. Upload
`social-card.png`.

## Regenerating the PNG

```sh
rsvg-convert -w 1280 docs/design/social/social-card.svg -o docs/design/social/social-card.png
```
