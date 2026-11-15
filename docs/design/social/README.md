# Social preview card (issue #334)

A 1280 x 640 social preview card for the repository: the name **Bive** on the soft base, the tagline "Agents write,
you decide.", and the four role glyphs (owner, advisor, coordinator, delegate) in a row.

## What it is

- `social-card.svg` is the source: `viewBox="0 0 1280 640"`, safe area 1000 x 480 centred, system sans-serif, no text
  smaller than 40 px, only the colours of `docs/DESIGN-BRIEF.md` §2.
- `social-card.png` is the render for upload.

## Uploading it

Only the owner can set the social preview: GitHub Settings › General › Social preview. No agent can do this. Upload
`social-card.png`.

## Regenerating the PNG

```sh
rsvg-convert -w 1280 docs/design/social/social-card.svg -o docs/design/social/social-card.png
```
