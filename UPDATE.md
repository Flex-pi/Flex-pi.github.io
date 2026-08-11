# Update — real-robot results and the configurator card

What changed on the `latency-frontier` branch, and what still needs a decision.
Read alongside `README.md`, which describes the page as a whole.

## Where the numbers come from

Every real-robot figure on the page now traces to one file:

```
FastWAM/real_world_eval/flex_pi_final_results.json
```

`normalized_score` × 100 is what the page calls **task completion**;
`full_success_rate` × 100 is the **full-success rate**. Nothing is read off a
figure any more, and no number on the page is reverse-derived from a caption.

| page | JSON path |
|------|-----------|
| In-distribution chart | each task's in-distribution condition, plus an unweighted mean over the five |
| Put Plate on the Rack, in-distribution | `seen_full_combined` (the 1-plate and 2-plate runs pooled over 30 attainable points) |
| Generalization chart, reference bar | `seen_full_1plate` / `seen_sub` / pen-bag `seen` |
| Generalization chart, held-out bar | plate: mean of `unseen_big_plate_1plate` and `unseen_distractor_1plate`; sort: `unseen_distractor_sub`; bag: `unseen` |
| Data efficiency | `seen_full_1plate` against `seen_sub_1plate` |
| Frontier scatter | the mean of the five in-distribution scores, per method |

**Put Plate on the Rack merges its two held-out conditions into one bar**, as
the paper's `real_robot_gen.pdf` does. Averaging `unseen_big_plate` with
`unseen_distractor` reproduces that figure's baseline bars and deltas exactly,
which is how the aggregation was confirmed.

**Fast-WAM was only run on three of the five tasks.** Its bars are absent on
Self-Repair and Soft-Bag Zipping and its average covers the three it has, said
plainly in the caption rather than filled in.

## What changed on the page

**Baselines.** ManiFlow and Fast-WAM now appear throughout, not just on
self-repair. Every chart carries the same five-method series in the same order.

**colors are the paper's own legend**, sampled out of `real_robot_gen.pdf`:
π<sub>0.5</sub> grey `#9e9e9e`, ManiFlow blue `#7fb3d5`, Fast-WAM amber
`#e0a526`, action-only `#5ba463`, full joint `#2e7d3e`. This **swapped two
roles** against the old page, where π<sub>0.5</sub> was amber and Fast-WAM grey.
The day-theme tokens hold the exact hues; the night tokens lighten the same ones
for the dark ground. Change one, change the other.

**Soft-Bag Zipping is a scored task now**, in-distribution and held out against
bags of unseen colors and patterns.

**Kitchen Organization** replaces "Clean the Kitchen Rack". It is no longer the
task where the baseline collapses — it is the most forgiving one in the suite
(π<sub>0.5</sub> 73.8%), so its card is written around the all-or-nothing
measure instead. The old "+45 points" framing is gone with it.

**The generalization chart is a paired comparison**, faded bar for
in-distribution against solid for held out, labelled with the drop, because the
claim there is about how much each policy *loses*, not how tall its bar is.

**Error bars are the paper's own convention**, recovered by measuring the
whiskers in `real_robot_main.pdf` and `real_robot_gen.pdf` against the JSON:

```
half-width = sqrt(p(1-p)/n) x 100        p = score/100, n = rollouts behind the bar
```

the binomial standard error of the completion score. It reproduced all twelve
whiskers in `real_robot_main` and all seven measurable ones in `real_robot_gen`
to within a pixel, and rules out both the raw spread and the plain SEM of the
per-rollout scores, which are off by 2–3×. `seOf()` in `main.js` is that
formula; a bar states its `n` and gets a whisker, or omits it and gets none —
never a zero-length one. The Average bars pool every rollout behind them: 90
across the five tasks, 50 for Fast-WAM's three.

Because five labelled bars per group leaves no room once the whiskers push the
labels up, the in-distribution chart **stands its value labels on end**, as the
paper's figure does.

**Soft-Bag Zipping has its own chart** in the dexterity section, under the
zipping clips: in-distribution against the unseen bag, laid out like the
self-repair chart. It was pulled out of the generalization chart, which is now
Put Plate on the Rack and Sort Utensils only.

**The configurator card** carries the real-robot frontier. Its layout is three
bands: diagram on the left, the two measured readouts over the mask controls on
the right, and the frontier across the foot. Changing `m`<sup>out</sup> rings
the matching operating point and updates the readouts.

**"Choosing the operating point" lost its Inference configuration panel**, which
was a second copy of the configurator over RoboTwin numbers. The section is now
"One checkpoint, four measured operating points" and holds the two measured
charts only. `initExplorer`, `paintExplorer`, `setConfig` and the pareto click
handler went with it.

## Settled

**The JSON is the source of truth where it disagrees with the paper.** Every
baseline matches the v17 figures to the decimal, but Flex-π's own Put Plate on
the Rack numbers differ:

| | paper v17 figs | JSON (used) |
|---|---|---|
| action-only, in-distribution | 79.2 | **84.2** |
| full joint, in-distribution | 92.5 | **95.0** |
| action-only, half data | 67.5 | **80.0** |
| full joint, half data | 77.5 | **95.0** |

The paper simply has not been updated yet; the JSON is the newer evaluation. The
page is correct as it stands, and the paper figures are what has to move.

**All eight output masks are timed.** `REAL_MODE` in `main.js` keys on the
**output** mask — `rgb | dino<<1 | p3d<<2`. What is observed does not change the
cost, only what is generated does, so there are eight operating points rather
than the 56 configurations the card can express. And the key is the mask, not
the count of generated streams: video-only, DINO-only and pointmap-only each
generate one future and cost 136, 138 and 136 ms.

Action-only (60) and full joint (193) keep their published figures; the other
six are engine p50s from a later sweep, which re-measured those two at 61.1 and
194.9 — close enough to leave them alone. Both p50 columns for all eight are in
the comment above `REAL_MODE`. Only the two shipped modes are scored on the
real-robot suite, so the other six show a latency and an em dash for task
completion.

**Kitchen Organization is qualitative by design.** There is no scored held-out
condition because the task is easy enough that the number would not carry
information — `unseen-kitchen.mp4` is there to show the policy working, not to
be measured. The old 5% / 80% numbers stay removed. Nothing to chase.

## Open items

**Still placeholders:** the workcell and multi-view clips, and every predicted
future in the "futures behind the actions" strip.

**The branch is unmerged.** `latency-frontier` is 14 commits ahead of `main` and
pushed; everything above lives there.
