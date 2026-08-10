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

**Colours are the paper's own legend**, sampled out of `real_robot_gen.pdf`:
π<sub>0.5</sub> grey `#9e9e9e`, ManiFlow blue `#7fb3d5`, Fast-WAM amber
`#e0a526`, action-only `#5ba463`, full joint `#2e7d3e`. This **swapped two
roles** against the old page, where π<sub>0.5</sub> was amber and Fast-WAM grey.
The day-theme tokens hold the exact hues; the night tokens lighten the same ones
for the dark ground. Change one, change the other.

**Soft-Bag Zipping is a scored task now**, in-distribution and held out against
bags of unseen colours and patterns.

**Kitchen Organization** replaces "Clean the Kitchen Rack". It is no longer the
task where the baseline collapses — it is the most forgiving one in the suite
(π<sub>0.5</sub> 73.8%), so its card is written around the all-or-nothing
measure instead. The old "+45 points" framing is gone with it.

**The generalization chart is a paired comparison**, faded bar for
in-distribution against solid for held out, labelled with the drop, because the
claim there is about how much each policy *loses*, not how tall its bar is.

**The configurator card** carries the real-robot frontier. Its layout is three
bands: diagram on the left, the two measured readouts over the mask controls on
the right, and the frontier across the foot. Changing `m`<sup>out</sup> rings
the matching operating point and updates the readouts.

**"Choosing the operating point" lost its Inference configuration panel**, which
was a second copy of the configurator over RoboTwin numbers. The section is now
"One checkpoint, four measured operating points" and holds the two measured
charts only. `initExplorer`, `paintExplorer`, `setConfig` and the pareto click
handler went with it.

## Open items

**The paper and the JSON disagree on Flex-π's plate numbers.** Every baseline
matches to the decimal, but for Put Plate on the Rack:

| | paper v17 figs | JSON |
|---|---|---|
| action-only, in-distribution | 79.2 | **84.2** |
| full joint, in-distribution | 92.5 | **95.0** |
| action-only, half data | 67.5 | **80.0** |
| full joint, half data | 77.5 | **95.0** |

The page uses the JSON. The v17 PDFs are dated *later* than the JSON, so one of
the two is stale and it is not obvious which — worth resolving before the paper
and the site have to agree.

**Kitchen Organization has no scored held-out condition** in the JSON, but
`unseen-kitchen.mp4` exists. The footage is kept and labelled qualitative-only;
its former 5% / 80% numbers are removed rather than carried forward. If that
evaluation does exist somewhere, the numbers can go back in.

**Six of the eight output masks are unbenchmarked.** The readout cells show
measured values for action-only and full joint and em dashes for the rest. When
the other six are timed on our own hardware, add them to `REAL_MODE` in
`main.js` — keys are the number of generated visual streams — and the cells
pick them up with no other change.

**Still placeholders:** the workcell and multi-view clips, and every predicted
future in the "futures behind the actions" strip.
