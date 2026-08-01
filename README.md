# Flex-π — project page

Source for **https://flex-pi.github.io** — the project page for
*Flex-π: A Latent and 3D World-Action Model with Compute Flexibility*.

## Layout

```
index.html              the whole page (single file)
assets/css/style.css    design tokens + components
assets/js/main.js       charts, the flexibility explorer, video/lightbox, theme
assets/figures/*.png    figures extracted from the paper at 400 dpi
assets/videos/*.mp4     task clips (+ .jpg poster frames)
```

No build step and no dependencies — it is static HTML/CSS/JS. To preview:

```sh
python3 -m http.server 8000    # then open http://localhost:8000
```

## Structure

The page is in three parts, each introduced by a `.part` divider and listed in
the left outline rail:

```
I   · What Flex-π does    #overview #real-robot #precision #generalization
II  · How it works        #streams #method #explorer
III · How it compares     #simulation #limitations #bibtex
```

Three heading levels, and nothing else:

| level | class            | tag  | column           |
|-------|------------------|------|------------------|
| part  | `.part__t`       | `h2` | `.wrap--wide`    |
| section | `.sec__title` + `.sec__sub` | `h3` | `.wrap` (812px) |
| point | `.sub__title` + `.sub__lede` | `h4` | `.wrap` (812px) |

Every sub-heading sits in the 812px text column so it lines up under its
section title; only the media it introduces (video grids, charts, tables,
figure plates) widens to `.wrap--mid` / `.wrap--wide`. Task names inside a
`.vfeature` are `h4.vfeature__name` and align with their video instead — they
read as figure labels, not outline entries.

### The outline rail

`aside.rail` is the in-page navigation, copied from ENPIRE: a hairline on the
left, one entry per section, a tick that slides to the current one. It is
`position: fixed` rather than a grid column, because every section here is an
independently centred `.wrap` and making them grid cells would mean re-wrapping
the whole document. Instead everything below the hero is pushed right by
`--rail-shift` and the rail parks in the space that frees up, aligned to the
left edge of `--col-wide` so it can never collide with a full-width figure.

Above 1024px the top bar stops being a second outline and takes a job the rail
cannot do: a condensed title that fades in once you leave the hero, plus the
Paper / Code / BibTeX actions. Below 1024px it reverts to section links. Both
key off one `IntersectionObserver` on `.stage`, which sets `data-over-hero` on
`.rail` and `.nav`.

The rail is the primary navigation and turns on at **1024px**, so a laptop
window does not have to be maximised to get it; below that the top bar's links
stand in, where a 176px column would cost more than it gives. **Exactly one
in-page navigation is ever visible** — keep the two label sets in sync when
renaming a section. The rail fades out while the hero is on screen
(`initRail()` in `main.js`) because a fixed element would otherwise sit on top
of the full-bleed video.

The shift costs 220px of viewport, and the component breakpoints all read the
*viewport*, so a few side-by-side layouts would hold their multi-column form
~300px too long while the rail is on. The `rail-aware layout guards` block at
the end of `style.css` folds them one step earlier. It has to stay last in the
file: the declarations it overrides come later and match at equal specificity.

## Design

The visual system follows NVIDIA GEAR's
[ENPIRE](https://research.nvidia.com/labs/gear/enpire/) project page: a
near-black cinematic hero, then a cream `#f6f6ef` article body set in Source
Serif 4 with JetBrains Mono for metadata, a claret accent and 4px radii.

The accent is **one colour, used everywhere** — `--primary` / `--primary-ink` /
`--primary-soft`, plus the favicon. Day `#6e1f35`, night `#b8455f` for fills and
`#de93a8` for text, which needs the lighter value to clear contrast on `#0c0c0c`.
It is deliberately not blue, green, amber, red or grey: those are all spoken for
by the stream colours and the chart series (green is "ours", amber is π0.5,
brick red is the action stream), so an accent in any of them would read as
carrying that meaning.

**If you change the accent, change the favicon too.** It is an inline
`data:image/svg+xml` URI in `index.html` with the colour hardcoded — a claret
tile with a white "F". It is deliberately not a π: at tab size a π reads as the
π0.5/π0.6 lineage rather than as this model. Abstract marks were tried and
rejected — three stream bars are indistinguishable from a hamburger menu icon
at 16px.

**The title is capped at 38px on purpose — do not put it back up.** Source
Serif 4 is a variable font with an `opsz 8..60` axis and `font-optical-sizing`
defaults to `auto`, so `font-size` alone drives the optical axis: at the old
58px the browser rendered the 60pt *display* master — high stroke contrast,
hairline serifs, tightened fit, which reads as decorative rather than formal.
Nothing in the CSS asked for that; the size did. At 38px it stays in the
text/subhead range. [ManiFlow](https://maniflow-policy.github.io/) sets its
title at `2.5vw` (36px at 1440) for the same reason, and this page follows it:
one serif throughout, bold title, monochrome except the model name.

The accent tints the **whole "Flex-π"**, in the title and in the nav wordmark —
the model name is one unit, and tinting a single glyph read as a logo dropped
mid-word. It is the existing `--primary-ink`, not a second hue: that colour
also carries links, part numbers and the active rail tick, so a separate title
colour would dilute what it signals.

Mono is for metadata and numerals only — anything read as words (nav, buttons,
chips, badges, diagram labels) is set in the body face. Uppercase mono labels
all use `--fs-meta` / `--ls-meta`; a label with its own size is a bug.
Both themes are fully authored — dark is the base token set and
`[data-theme="day"]` overrides it — and the page ships `day`, with a toggle in
the nav (persisted to `localStorage`). Accent colors for the three visual
streams (RGB / pointmap / DINO) mirror the legend of the paper's own Figures 2
and 4.

All charts are hand-built inline SVG generated in `main.js`, so they follow the
active theme rather than being baked-in images. Chart data is defined in
`renderCharts()`; the explorer's operating points are in the `MEASURED` object.

## ⚠ Placeholder media

**The videos are placeholders and do not show Flex-π rollouts.** They stand in
for layout while our own recordings are prepared. Clips of the bimanual
workcell come from the [FACTR2](https://jasonjzliu.com/factr2/) project page,
which uses the same YAM platform; one comes from
[ENPIRE](https://research.nvidia.com/labs/gear/enpire/). This is disclosed in
the page footer and in an on-video badge.

Replace them by dropping real files over the same paths in `assets/videos/`
(keep the `.jpg` poster next to each `.mp4`). Filenames are semantic, e.g.
`task-plate-rack.mp4`, `gen-handover-distractor.mp4`.

## Results not yet on the page

Deliberately omitted because the paper does not yet report them:

- **Key unlocking** (Table 3) — task spec is final, quantitative results pending.
- **Flex-π on LIBERO-Plus** — evaluation in progress.

The `Paper` and `Code` buttons are rendered as disabled "soon" chips; wire them
up in the `.links` block of `index.html` once there is an arXiv ID and a repo.
