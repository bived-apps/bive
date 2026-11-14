# Visual design and page organisation of the bived-apps organization (plan; issue #278)

Status: a **plan for the owner's approval**. No image was generated, no paid call made, no repository, page or setting
changed. Owner decisions so far (2026-11-14, answered with buttons) are recorded in issue #278 and summarised here.

## Decisions already taken

- **Audience**: developers adopting Bive. **Look**: illustrated and friendly, light base, one accent colour per role
  (advisor, coordinator, delegate). **Images**: diagrams and icons first, then hero and section art, then a brand mark and
  possibly a recurring character; **three** candidate sets per phase for the owner to choose from.
- **Structure**: one front door (the organization profile) with each repository as a section sharing one layout.
- **Characters**: original only, in a workplace-mockumentary spirit; no existing show, game or franchise character, name,
  logo or likeness, and no wording in a prompt that asks for one.
- **Safeguards (all)**: original or licence-clear images; source, model and prompt recorded per asset; no private data or
  names in prompts; the owner approves each image set before it is committed; no billing or provider change by an agent.
- **Team**: **text first**. A paid image team is approved by the owner by names and a total cap, after prices are
  verified. Probes on 2026-11-14: NVIDIA has no image model in the catalog; Google and the opencode route refused (no
  billing, no balance); no image was produced and nothing was charged. The `openai` provider lists chat models only.
- **No private application is named** in this plan, in prompts or in assets.

## What exists today (read-only inventory, 2026-11-14)

14 public repositories: `bive` (template), `milestone-workspace-template` (template), `registry`, `bench`, `university`,
`grooms`, and 8 synthetic `milestone-m-20261113-NN` workspaces (5 archived, 3 not). Findings:

- No organization profile page; no repository has a custom social image or a homepage link.
- `bive`, `registry` and `bench` have no repository description; each README is its own layout.
- The registry's public page is on GitHub Pages; the others have no site.
- The 8 synthetic workspaces appear in the organization's list beside the real repositories (an owner decision below).

## Proposed page organisation

1. **Organization front door** (profile README): what Bive is in three lines, a one-picture flow, the three roles with
   their accent colours, and five cards: Bive (start here), workspace template, registry, bench, university.
2. **Every repository** gets the same skeleton: one-line description and topics (repository settings), a README that
   begins with the same header (mark, one line, "start here / read next"), a shared "how this fits" strip, and the
   same footer (licence, owner decisions live in the issue tracker).
3. **Docs front door** in `bive`: `README.md` as the single entry, `docs/` pages grouped by role (owner, coordinator,
   delegate, advisor) instead of one flat list.
4. **Registry page** keeps its role, restyled with the shared tokens.
5. Repositories that are only fixtures (the synthetic workspaces) are named and described as such, or hidden from the
   front door (owner decision).

## Style guide (to be written first, text only)

Tokens (candidates to confirm): a light neutral base, one accent per role, one neutral ink colour, a type scale of three
sizes, a spacing unit, a corner radius, an icon grid. Plus: voice (friendly, precise, short), the diagram language
(roles as characters or glyphs, arrows, one flow), and accessibility (contrast, alt text for every image, no meaning by
colour alone).

## Phases and who does what

| Phase | Output | Team | Owner gate |
| --- | --- | --- | --- |
| 1 Brief | style guide, site map, copy, shared README header | text models (Claude coordinator; approved chat delegates) | approve the brief |
| 2 Diagrams and icons | the flow, three role glyphs, page icons as **SVG** (text, editable, exact) | Claude writes SVG; no image provider | approve the set |
| 3 Candidate sets | 3 sets each of brand mark, character option and hero art | an image provider, once the owner fixes a balance and approves names and the cap | choose one set per phase |
| 4 Apply | READMEs, profile, descriptions, social images | coordinator and free delegates, PRs per repository | owner merges each |

Each phase is its own milestone batch: one coordinator, free delegates for mechanical edits, PRs labelled
`coordinator`, nothing merged by an agent, no new label.

## Costs and caps

No cap is set. Catalog prices are per token and often shown as zero when unknown, which is not free. Before any paid
call: verified price per model, a probe cost per image (one capped test each, owner-approved), then a total cap the owner
sets. Claude models cannot generate pictures; they write SVG.

## Owner answers (round 3, 2026-11-14, buttons)

1. **Profile repository**: yes, once the brief is approved. A new repository is the owner's call, so it is proposed then.
2. **Synthetic workspaces**: archive all eight. Five are archived; the owner archives the other three
   (`milestone-m-20261113-07`, `-08`, `-09`); an agent archives nothing.
3. **Front door lead**: the Bive template, the other repositories hang off it.
4. **Role glyphs**: simple glyphs (magnifier, clipboard, laptop) in the role colours for diagrams and icons. People-like
   characters stay a candidate set for hero art only if the owner asks for it again.
5. **Tagline**: "Agents write, you decide." (chosen from five suggestions, 2026-11-14). **`grooms`**: archived by the owner's
   instruction on 2026-11-14, so it is not a front-door card. Accent colours (teal, amber, violet) remain candidates
   until the style guide is approved.

## Not decided here

Provider names, the price cap, the character, any image. Nothing is generated until the owner approves them.
