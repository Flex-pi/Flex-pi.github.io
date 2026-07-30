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

## Design

The visual system follows NVIDIA GEAR's
[ENPIRE](https://research.nvidia.com/labs/gear/enpire/) project page: a
near-black cinematic hero, then a cream `#f6f6ef` article body set in Source
Serif 4 with JetBrains Mono for metadata, a periwinkle accent and 4px radii.
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
