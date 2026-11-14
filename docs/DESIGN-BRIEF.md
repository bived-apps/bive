# Design brief for the bived-apps organization (Phase 1, text only; issue #278)

> **Scope narrowed (owner, 2026-11-14): "I don't like the design, not for frontend, keep it for Bive."** The assets and
> the style stay inside Bive (its docs and README). Not pursued: the organization front door, the profile repository,
> per-repository descriptions and social images, a paid image team and Phase 3 and 4. The sections below that describe
> them are kept as the record of the plan, not as work to do. Nothing in other repositories is changed for this batch.

Status: a **brief for the owner's approval**. Text only: no image generated, no paid call, no repository, page or setting
changed. It applies `docs/DESIGN-PLAN.md` and the owner's answers in issue #278. Nothing here is adopted until approved;
Phase 2 (SVG diagrams and icons) starts only after approval.

## 1. Voice

- Tagline: **Agents write, you decide.**
- Friendly and precise, short sentences, plain words, second person ("you decide"). No hype, no emoji in headings.
- Say what a thing does before what it is. One idea per paragraph. Never promise what the guard or the gate does not do
  (Bive's own docs say "a text filter, not a sandbox"; the pages keep that honesty).
- Role words are fixed: **owner**, **advisor**, **coordinator**, **delegate**. No "supervisor" (retired).

## 2. Style tokens (candidates; contrast computed, WCAG relative luminance)

| Token | Value | On white | On soft base `#F7F5F0` | Use |
| --- | --- | --- | --- | --- |
| base | `#FFFFFF`, soft `#F7F5F0` | n/a | n/a | page and section backgrounds |
| ink | `#1F2430` | 15.5 | 14.2 | body text, headings |
| muted | `#5B6270` | 6.1 | 5.6 | secondary text |
| advisor (teal) | `#0F766E` | 5.5 | 5.0 | advisor glyph, links in advisor context |
| coordinator (amber) | `#B45309` | 5.0 | 4.6 | coordinator glyph |
| delegate (violet) | `#6D28D9` | 7.1 | 6.5 | delegate glyph |
| owner (ink + gold ring) | ink, ring `#B8860B` | decorative only | decorative only | owner marker, never text |

All text pairs above reach 4.5:1 (AA for body text). Rules: colour never carries meaning alone (every role has a glyph and
a label); a role colour is never used for body text on a tinted background; type scale of three sizes (heading, body,
small), one spacing unit (8 px), one corner radius (8 px), a 24 px icon grid with a 2 px stroke.

## 3. Role glyphs (Phase 2 will draw them as SVG)

| Role | Glyph | Colour |
| --- | --- | --- |
| owner | a key | ink with a gold ring |
| advisor | a magnifier | teal |
| coordinator | a clipboard | amber |
| delegate | a laptop | violet |

One stroke style, rounded ends, no gradients, readable at 16 px, always with an `aria-label`/alt text naming the role.

## 4. Diagram language

The Bive flow (owner, advisor, coordinator, delegates, gates 1 to 3) is drawn once and reused everywhere: left to right,
role glyphs as nodes, solid arrows for work, dashed arrows for questions and advice, a thick arrow for the owner's gate.
The text version stays beside every picture (the existing Mermaid in `README.md` is the source of truth).

## 5. Page organisation

### Organization profile (front door; needs `bived-apps/.github`, the owner's call)

```text
# Bive: Agents write, you decide.
One paragraph: a template and two small plugins for building software with LLM agents in separate roles, on OpenCode 2.
[the flow diagram]
The four roles (glyph, one line each).
Start here -> Bive (template)
Also: Workspace template | Registry | Bench | University
```

Copy (draft): "Bive is a repository template for building software with LLM agents in separate roles. Delegates write,
a coordinator splits and reviews, an advisor answers read-only questions, and you decide every merge." Card lines:
- **Bive**: the template and the flow. Start here.
- **Workspace template**: a ready-made Bive workspace for a milestone.
- **Registry**: an opt-in count of Bive projects and sessions.
- **Bench**: which models behave well in which role, measured.
- **University**: lessons from real runs, for less skilled models.

### Every repository: the shared README header

```text
<mark>  <name>
One line: what it does for you. (Agents write, you decide.)
Start here: <link>   Read next: <link>   Part of Bive: <link to the front door>
```

then the shared "how this fits" strip (one sentence and the role glyphs it concerns), and the footer: licence, where
decisions live (the issue tracker), how to report a problem.

### Repository settings (text proposals; the owner or a coordinator PR applies them)

| Repository | Description | Topics |
| --- | --- | --- |
| bive | A template for building software with LLM agents in separate roles. Agents write, you decide. | llm-agents, opencode, template, workflow |
| milestone-workspace-template | A ready-made Bive workspace for one milestone: roles, reports, required checks. | llm-agents, opencode, template |
| registry | Opt-in count of Bive projects and sessions. | llm-agents, opencode |
| bench | Which models behave well in which Bive role, measured per version. | llm-agents, benchmark |
| university | Lessons from real Bive runs, for less skilled models. | llm-agents, skills |

## 6. Findings to fix in Phase 4 (read-only, 2026-11-14; verify before editing)

- `bench`'s README begins as a copy of Bive's ("Bive 0.0" and the flow diagram), not its own front page. Owner decision
  2026-11-14: corrected when bench joins the current Bive version, not before; bench's frozen history and open PRs are untouched until then.
- `registry` and `university` READMEs link to `jcherfils/bive`; the repository now lives at `bived-apps/bive`.
- No repository has a description (except the workspace template and university), a homepage link or a social image.
- No organization profile page exists.

## 7. Social image spec (Phase 3 inputs)

1280 x 640 px, safe area 1000 x 480, the repo name in ink on the soft base, the role glyphs in a row, no small text,
alt text written for each. Three candidate sets per phase; the owner chooses.

## 8. Phase 2 SVG asset list

The flow diagram; four role glyphs (owner, advisor, coordinator, delegate); five page icons (template, workspace,
registry, bench, university); a shared divider. Each SVG has a title and description, uses only the tokens above,
contains no text outlines that replace real text, and is checked at 16 px and 128 px.

## 9. Safeguards that bind every phase

Original or licence-clear images only; no existing show, game or franchise character, name, logo or likeness; the model,
prompt and source recorded per asset; no private data or application names in any prompt or asset; the owner approves each
set before it is committed; no billing or provider change by an agent; nothing merged by an agent.

## 10. What the owner approves now

The voice, the tokens (colours may change; contrast must stay at 4.5:1), the glyph set, the page organisation and copy, and
the repository descriptions. Approval moves to Phase 2 (SVG, free). Phase 3 (candidate sets) still needs a provider with a
balance, named by the owner, and a total cap.
