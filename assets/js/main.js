/* =========================================================================
   Flex-π project page — interactions
   Dependency-free. Charts are hand-built inline SVG (ENPIRE-style), so they
   inherit the page's dark palette and stay crisp at any width.
   ========================================================================= */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function css(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  function el(tag, attrs, text) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
    if (text !== undefined) n.textContent = text;
    return n;
  }

  /* ---------------------------------------------------------------------
     grouped / single-series bar chart
     --------------------------------------------------------------------- */
  function barChart(mount, cfg) {
    var W = 1000;
    var padL = cfg.padL != null ? cfg.padL : 46;
    var padR = 14;
    var padT = 30;
    var padB = cfg.padB != null ? cfg.padB : 52;
    var plotH = cfg.plotH != null ? cfg.plotH : 250;
    var H = padT + plotH + padB;

    var groups = cfg.groups;
    var series = cfg.series;
    var nS = series.length;
    var lo = cfg.min != null ? cfg.min : 0;
    var hi = cfg.max;

    var svg = el('svg', {
      'class': 'chart', viewBox: '0 0 ' + W + ' ' + H,
      preserveAspectRatio: 'xMidYMid meet', role: 'img',
      'aria-label': cfg.ariaLabel || cfg.title || 'bar chart'
    });

    var plotW = W - padL - padR;
    function y(v) { return padT + plotH - ((v - lo) / (hi - lo)) * plotH; }

    /* gridlines + y ticks */
    var ticks = cfg.yTicks || [];
    ticks.forEach(function (t) {
      var yy = y(t);
      svg.appendChild(el('line', { 'class': 'grid', x1: padL, x2: W - padR, y1: yy, y2: yy }));
      svg.appendChild(el('text', {
        'class': 'tick', x: padL - 9, y: yy + 3.5, 'text-anchor': 'end'
      }, cfg.tickFmt ? cfg.tickFmt(t) : String(t)));
    });

    /* zero / base axis */
    var yBase = y(Math.max(lo, Math.min(0, hi)) === 0 ? 0 : lo);
    svg.appendChild(el('line', { 'class': 'axis', x1: padL, x2: W - padR, y1: yBase, y2: yBase }));

    var gW = plotW / groups.length;
    var innerFrac = nS === 1 ? 0.42 : 0.78;
    var bandW = gW * innerFrac;
    var barW = bandW / nS;

    groups.forEach(function (g, gi) {
      var gx = padL + gi * gW + (gW - bandW) / 2;

      (g.values || []).forEach(function (v, si) {
        if (v === null || v === undefined) return;
        var color = g.colors ? g.colors[si] : series[si].color;
        var x = gx + si * barW;
        var top = Math.min(y(v), yBase);
        var h = Math.abs(y(v) - yBase);
        var inset = nS === 1 ? 0 : 2;

        var r = el('rect', {
          'class': 'bar', x: x + inset / 2, y: top,
          width: Math.max(1, barW - inset), height: Math.max(1, h),
          fill: color, rx: 1.5
        });
        r.appendChild(el('title', {}, (series[si].name ? series[si].name + ' — ' : '') +
          (g.label || '') + ': ' + (cfg.valFmt ? cfg.valFmt(v) : v)));
        svg.appendChild(r);

        /* value label */
        var isOurs = /Flex/i.test(series[si].name || '') || (g.hi && g.hi[si]);
        var lab = el('text', {
          'class': 'vlab' + (isOurs ? ' vlab--hi' : ''),
          x: x + (barW - inset) / 2 + inset / 2,
          y: v >= 0 ? top - 7 : top + h + 13,
          'text-anchor': 'middle'
        }, cfg.valFmt ? cfg.valFmt(v) : String(v));
        svg.appendChild(lab);
      });

      /* group label, wrapped on | */
      var lines = String(g.label || '').split('|');
      lines.forEach(function (ln, li) {
        svg.appendChild(el('text', {
          'class': 'glab', x: padL + gi * gW + gW / 2,
          y: padT + plotH + 22 + li * 15, 'text-anchor': 'middle'
        }, ln.trim()));
      });
    });

    /* axis titles */
    if (cfg.yLabel) {
      var t = el('text', { 'class': 'alab', x: 0, y: 0, 'text-anchor': 'middle',
        transform: 'translate(13,' + (padT + plotH / 2) + ') rotate(-90)' }, cfg.yLabel);
      svg.appendChild(t);
    }
    if (cfg.xLabel) {
      svg.appendChild(el('text', { 'class': 'alab', x: padL + plotW / 2,
        y: H - 6, 'text-anchor': 'middle' }, cfg.xLabel));
    }

    mount.innerHTML = '';
    mount.appendChild(svg);

    /* legend */
    if (cfg.legendEl && nS > 1) {
      var lg = document.querySelector(cfg.legendEl);
      if (lg) {
        lg.innerHTML = '';
        series.forEach(function (s) {
          var span = document.createElement('span');
          span.className = 'legend__item';
          var sw = document.createElement('span');
          sw.className = 'legend__sw';
          sw.style.background = s.color;
          span.appendChild(sw);
          span.appendChild(document.createTextNode(s.label || s.name));
          lg.appendChild(span);
        });
      }
    }
  }

  /* ---------------------------------------------------------------------
     pareto (latency vs success) scatter + line
     --------------------------------------------------------------------- */
  var paretoPts = [];
  function paretoChart(mount) {
    var W = 1000, padL = 54, padR = 92, padT = 26, padB = 54, plotH = 300;
    var H = padT + plotH + padB;
    var xMin = 40, xMax = 430, yMin = 0, yMax = 75;

    var green = css('--c-ours') || '#57c98b';
    var amber = css('--c-base2') || '#e0b04a';

    var svg = el('svg', {
      'class': 'chart', viewBox: '0 0 ' + W + ' ' + H,
      preserveAspectRatio: 'xMidYMid meet', role: 'img',
      'aria-label': 'Latency versus success rate. Flex-π rises from 41.6% at 68 ms in action-only mode to 66.8% at 398 ms with all streams generated, while Fast-WAM stays at 10% at 90 and 345 ms.'
    });
    var plotW = W - padL - padR;
    function X(v) { return padL + ((v - xMin) / (xMax - xMin)) * plotW; }
    function Y(v) { return padT + plotH - ((v - yMin) / (yMax - yMin)) * plotH; }

    [0, 15, 30, 45, 60, 75].forEach(function (t) {
      svg.appendChild(el('line', { 'class': 'grid', x1: padL, x2: W - padR, y1: Y(t), y2: Y(t) }));
      svg.appendChild(el('text', { 'class': 'tick', x: padL - 10, y: Y(t) + 3.5, 'text-anchor': 'end' }, t + '%'));
    });
    [100, 200, 300, 400].forEach(function (t) {
      svg.appendChild(el('text', { 'class': 'tick', x: X(t), y: padT + plotH + 20, 'text-anchor': 'middle' }, String(t)));
      svg.appendChild(el('line', { 'class': 'grid', x1: X(t), x2: X(t), y1: padT, y2: padT + plotH }));
    });
    svg.appendChild(el('line', { 'class': 'axis', x1: padL, x2: W - padR, y1: Y(0), y2: Y(0) }));
    svg.appendChild(el('line', { 'class': 'axis', x1: padL, x2: padL, y1: padT, y2: Y(0) }));
    svg.appendChild(el('text', { 'class': 'alab', x: padL + plotW / 2, y: H - 12, 'text-anchor': 'middle' },
      'Inference latency (ms)'));
    svg.appendChild(el('text', { 'class': 'alab', x: 0, y: 0, 'text-anchor': 'middle',
      transform: 'translate(15,' + (padT + plotH / 2) + ') rotate(-90)' }, 'Avg. success (%)'));

    /* Fast-WAM dashed baseline */
    var fw = [[90, 10.0, 'compiled'], [345, 10.0, 'as released']];
    svg.appendChild(el('line', {
      x1: X(fw[0][0]), y1: Y(fw[0][1]), x2: X(fw[1][0]), y2: Y(fw[1][1]),
      stroke: amber, 'stroke-width': 2, 'stroke-dasharray': '7 6', 'stroke-linecap': 'round'
    }));
    fw.forEach(function (p, i) {
      var g = el('g', {});
      if (i === 0) {
        g.appendChild(el('rect', { x: X(p[0]) - 5, y: Y(p[1]) - 5, width: 10, height: 10, fill: amber, rx: 1 }));
      } else {
        g.appendChild(el('rect', {
          x: X(p[0]) - 5.5, y: Y(p[1]) - 5.5, width: 11, height: 11, fill: amber,
          transform: 'rotate(45 ' + X(p[0]) + ' ' + Y(p[1]) + ')', rx: 1
        }));
      }
      g.appendChild(el('title', {}, 'Fast-WAM (' + p[2] + '): ' + p[1] + '% at ' + p[0] + ' ms'));
      svg.appendChild(g);
    });
    svg.appendChild(el('text', { 'class': 'ptlab', x: X(90), y: Y(10) - 14, 'text-anchor': 'middle',
      fill: amber }, 'Fast-WAM'));
    svg.appendChild(el('text', { 'class': 'ptlab', x: X(345), y: Y(10) + 22, 'text-anchor': 'middle',
      fill: amber }, 'as released'));

    /* Flex-π ladder */
    var pts = [
      { x: 68,  y: 41.6, name: 'Action',      dx: 6,  dy: 22 },
      { x: 139, y: 60.0, name: '+ Video',     dx: 8,  dy: 22 },
      { x: 280, y: 62.0, name: '+ DINO',      dx: 0,  dy: 24 },
      { x: 398, y: 66.8, name: '+ Pointmap',  dx: -6, dy: -18 }
    ];
    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + X(p.x) + ' ' + Y(p.y); }).join(' ');
    svg.appendChild(el('path', { d: d, fill: 'none', stroke: green, 'stroke-width': 2.5,
      'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));

    paretoPts = [];
    pts.forEach(function (p, i) {
      var g = el('g', { 'class': 'pareto__pt', 'data-i': i, tabindex: '0', role: 'button',
        'aria-label': p.name + ': ' + p.y + '% at ' + p.x + ' ms' });
      g.appendChild(el('circle', { 'class': 'pareto__halo', cx: X(p.x), cy: Y(p.y), r: 12 }));
      g.appendChild(el('circle', { cx: X(p.x), cy: Y(p.y), r: 16, fill: 'transparent' }));
      g.appendChild(el('circle', { 'class': 'pareto__ring', cx: X(p.x), cy: Y(p.y), r: 5.5, fill: green }));
      g.appendChild(el('title', {}, p.name + ': ' + p.y + '% at ' + p.x + ' ms'));
      svg.appendChild(g);
      svg.appendChild(el('text', {
        'class': 'ptlab', x: X(p.x) + p.dx, y: Y(p.y) + p.dy,
        'text-anchor': i === 3 ? 'end' : 'start', fill: green
      }, p.name));
      paretoPts.push(g);

      function pick() { setConfig(CONFIG_FOR_INDEX[i]); }
      g.addEventListener('click', pick);
      g.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); }
      });
    });

    svg.appendChild(el('text', { 'class': 'ptlab', x: padL + 12, y: Y(71),
      'text-anchor': 'start', fill: green, 'font-size': '13' }, 'Flex-π'));

    mount.innerHTML = '';
    mount.appendChild(svg);
  }

  /* ---------------------------------------------------------------------
     chart data + wiring
     --------------------------------------------------------------------- */
  function renderCharts() {
    var C = {
      rgb: css('--s-rgb') || '#b9bec9',
      p3d: css('--s-3d') || '#6aa9f0',
      dino: css('--s-dino') || '#57c98b',
      ours: css('--c-ours') || '#57c98b',
      oursD: css('--c-ours-d') || '#2f8f5b',
      base: css('--c-base') || '#9a9a9a',
      base2: css('--c-base2') || '#e0b04a',
      blue: '#6aa9f0'
    };
    var pct = function (v) { return v.toFixed(1); };
    var find = function (k) { return document.querySelector('[data-chart="' + k + '"]'); };
    var m;

    /* cross-modality forcing */
    if ((m = find('xmodal'))) {
      barChart(m, {
        groups: [
          { label: 'with|cross-modality forcing', values: [66.4], colors: [C.ours], hi: [true] },
          { label: 'without', values: [45.2], colors: [C.base] }
        ],
        series: [{ name: 'Avg. success' }],
        max: 80, yTicks: [0, 20, 40, 60, 80], plotH: 190,
        tickFmt: function (t) { return t + '%'; }, valFmt: pct,
        yLabel: 'Avg. success (%)',
        ariaLabel: 'Cross-modality forcing raises RoboTwin average success from 45.2% to 66.4%.'
      });
    }

    /* input streams, cumulative */
    if ((m = find('inputs'))) {
      barChart(m, {
        groups: [
          { label: 'Video', values: [39.6], colors: [C.rgb] },
          { label: 'Video|+ DINO', values: [46.4], colors: [C.dino] },
          { label: 'Video + DINO|+ Pointmap', values: [66.4], colors: [C.p3d], hi: [true] }
        ],
        series: [{ name: 'Avg. success' }],
        max: 80, yTicks: [0, 20, 40, 60, 80], plotH: 200,
        tickFmt: function (t) { return t + '%'; }, valFmt: pct,
        yLabel: 'Avg. success (%)',
        ariaLabel: 'Adding DINO raises success from 39.6 to 46.4 percent; adding pointmaps raises it to 66.4 percent.'
      });
    }

    /* pareto */
    if ((m = find('pareto'))) paretoChart(m);

    /* RoboTwin data scaling */
    if ((m = find('scaling'))) {
      barChart(m, {
        series: [
          { name: 'π0.5', label: 'π₀.₅', color: C.base },
          { name: 'LingBot-VA', label: 'LingBot-VA', color: '#7b8b9e' },
          { name: 'Fast-WAM', label: 'Fast-WAM', color: C.base2 },
          { name: 'Flex-π (action-only)', label: 'Flex-π (action-only)', color: '#8fd9b0' },
          { name: 'Flex-π (full joint)', label: 'Flex-π (full joint)', color: C.oursD }
        ],
        groups: [
          { label: '50 demos',  values: [31.4, 17.2, 41.9, 73.4, 78.8] },
          { label: '100 demos', values: [44.7, 32.2, 68.1, 86.6, 87.0] },
          { label: '500 demos', values: [76.8, 91.6, 91.8, 93.6, 93.3] }
        ],
        max: 100, yTicks: [0, 20, 40, 60, 80, 100], plotH: 260,
        tickFmt: function (t) { return t + '%'; }, valFmt: pct,
        yLabel: 'Avg. success (%)', xLabel: 'Demonstrations per task (50 tasks total)',
        legendEl: '#lg-scaling',
        ariaLabel: 'Flex-π leads at every data scale, with the largest margin at 50 demos per task.'
      });
    }

    /* real-robot in-distribution */
    if ((m = find('real'))) {
      barChart(m, {
        series: [
          { name: 'π0.5', label: 'π₀.₅', color: C.base2 },
          { name: 'Flex-π (action-only)', label: 'Flex-π (action-only)', color: '#8fd9b0' },
          { name: 'Flex-π (joint)', label: 'Flex-π (joint)', color: C.oursD }
        ],
        groups: [
          { label: 'Bimanual Put Plate|on the Rack', values: [74, 82, 94] },
          { label: 'Sort Utensils',   values: [45, 70, 75] },
          { label: 'Handover + Rack', values: [15, 50, 95] },
          { label: 'Average',         values: [44.7, 67.3, 88.0] }
        ],
        max: 100, yTicks: [0, 20, 40, 60, 80, 100], plotH: 250,
        tickFmt: function (t) { return t + '%'; },
        valFmt: function (v) { return v % 1 === 0 ? String(v) : v.toFixed(1); },
        yLabel: 'Normalized score (%)', legendEl: '#lg-real',
        ariaLabel: 'Flex-π beats π0.5 on all three real-robot tasks; averages are 44.7, 67.3 and 88.0 percent.'
      });
    }

    /* generalization */
    if ((m = find('gen'))) {
      barChart(m, {
        series: [
          { name: 'π0.5', label: 'π₀.₅', color: C.base2 },
          { name: 'Flex-π (action-only)', label: 'Flex-π (action-only)', color: '#8fd9b0' },
          { name: 'Flex-π (joint)', label: 'Flex-π (joint)', color: C.oursD }
        ],
        groups: [
          { label: 'Plate:|big plate',        values: [70, 85, 98] },
          { label: 'Plate:|distractor',       values: [75, 85, 92] },
          { label: 'Sort:|distractor',        values: [40, 70, 70] },
          { label: 'Handover:|distractor',    values: [5, 45, 80] }
        ],
        max: 100, yTicks: [0, 20, 40, 60, 80, 100], plotH: 250,
        tickFmt: function (t) { return t + '%'; }, valFmt: function (v) { return String(v); },
        yLabel: 'Unseen success rate (%)', legendEl: '#lg-gen',
        ariaLabel: 'On held-out conditions Flex-π joint reaches 98, 92, 70 and 80 percent where π0.5 reaches 70, 75, 40 and 5 percent.'
      });
    }

    /* self-repair gripper */
    if ((m = find('selfrepair'))) {
      barChart(m, {
        series: [
          { name: 'ManiFlow', label: 'ManiFlow', color: C.base },
          { name: 'Flex-π (action-only)', label: 'Flex-π (action-only)', color: '#8fd9b0' },
          { name: 'Flex-π (full joint)', label: 'Flex-π (full joint)', color: C.oursD }
        ],
        groups: [
          { label: 'Normalized score',  values: [33.3, 52.7, 74.6] },
          { label: 'Full-task success', values: [5, 15, 55] }
        ],
        max: 100, yTicks: [0, 20, 40, 60, 80, 100], plotH: 240,
        tickFmt: function (t) { return t + '%'; },
        valFmt: function (v) { return v % 1 === 0 ? String(v) : v.toFixed(1); },
        legendEl: '#lg-selfrepair',
        ariaLabel: 'Flex-π full joint reaches 74.6 percent normalized score and 55 percent full-task success, against 33.3 and 5 percent for ManiFlow.'
      });
    }

    /* data efficiency (negative deltas) */
    if ((m = find('dataeff'))) {
      barChart(m, {
        groups: [
          { label: 'π₀.₅', values: [-37.5], colors: [C.base2] },
          { label: 'Flex-π|(action-only)', values: [-22.5], colors: ['#8fd9b0'] },
          { label: 'Flex-π|(joint)', values: [-20.0], colors: [C.oursD], hi: [true] }
        ],
        series: [{ name: 'Δ success' }],
        min: -45, max: 5, yTicks: [5, -5, -15, -25, -35, -45], plotH: 200,
        valFmt: function (v) { return v.toFixed(1); },
        yLabel: 'Δ success (points)',
        ariaLabel: 'When data is halved, π0.5 drops 37.5 points, Flex-π action-only 22.5 points and Flex-π joint 20.0 points.'
      });
    }

    /* real-robot latency */
    if ((m = find('latency'))) {
      barChart(m, {
        groups: [
          { label: 'π₀.₅|baseline', values: [66], colors: [C.base2] },
          { label: 'Action-only|4 steps', values: [118], colors: ['#8fd9b0'] },
          { label: 'Action-only|10 steps', values: [152], colors: ['#8fd9b0'] },
          { label: 'Joint + skips|10 steps', values: [600], colors: [C.oursD] },
          { label: 'Joint|10 steps', values: [1857], colors: [C.oursD] }
        ],
        series: [{ name: 'Latency' }],
        max: 2000, yTicks: [0, 500, 1000, 1500, 2000], plotH: 230,
        valFmt: function (v) { return String(v); },
        yLabel: 'Latency (ms)',
        ariaLabel: 'Measured latency: 66 ms for π0.5, 118 to 152 ms for Flex-π action-only, 600 ms for joint with skips and 1857 ms for full joint.'
      });
    }
  }

  /* ---------------------------------------------------------------------
     compute-flexibility explorer
     --------------------------------------------------------------------- */
  var CONFIG_FOR_INDEX = [
    { rgb: false, dino: false, p3d: false },
    { rgb: true,  dino: false, p3d: false },
    { rgb: true,  dino: true,  p3d: false },
    { rgb: true,  dino: true,  p3d: true }
  ];

  /* Measured operating points (RoboTwin 5-task ablation set, video-only input).
     Only the four configurations on the paper's ladder were benchmarked. */
  var MEASURED = {
    '000': { lat: 68,  sr: 41.6, i: 0, name: 'Action-only fast path',
      desc: 'No future visual streams are computed; action tokens attend only to the current observation, ' +
            'preserving a VLA-level inference path.',
      latNote: 'Faster than a PyTorch-compiled Fast-WAM (90 ms).',
      srNote: 'Fast-WAM reaches 10.0% at comparable latency.' },
    '100': { lat: 139, sr: 60.0, i: 1, name: 'Joint RGB + action',
      desc: 'Future RGB latents are generated alongside the actions, and the action expert reads them. ' +
            'This is where most of the accuracy gain appears.',
      latNote: 'Roughly 2× the action-only path.',
      srNote: '+18.4 points over action-only, for +71 ms.' },
    '110': { lat: 280, sr: 62.0, i: 2, name: 'Joint RGB + DINO + action',
      desc: 'Object-level semantics are co-generated, grounding prediction in what the objects are as well as ' +
            'how the scene looks.',
      latNote: 'Read from Figure 6b of the paper.',
      srNote: 'Semantics alone add modestly here; geometry is what pays.' },
    '111': { lat: 398, sr: 66.8, i: 3, name: 'Full joint generation',
      desc: 'All three visual futures are co-denoised with the actions, so the policy is grounded in appearance, ' +
            'geometry and semantics simultaneously. The most accurate mode.',
      latNote: '6× the action-only latency.',
      srNote: 'Best of the four — +25.2 points over action-only.' }
  };

  var state = { rgb: false, dino: false, p3d: false };

  function keyOf(s) { return (s.rgb ? '1' : '0') + (s.dino ? '1' : '0') + (s.p3d ? '1' : '0'); }

  function setConfig(next) {
    state.rgb = !!next.rgb; state.dino = !!next.dino; state.p3d = !!next.p3d;
    paintExplorer();
  }

  function paintExplorer() {
    var root = document.getElementById('explorer');
    if (!root) return;

    root.querySelectorAll('.toggle[data-stream]').forEach(function (b) {
      b.setAttribute('aria-pressed', state[b.getAttribute('data-stream')] ? 'true' : 'false');
    });

    var chips = document.getElementById('ex-chips');
    if (chips) {
      var map = { action: true, rgb: state.rgb, dino: state.dino, pointmap: state.p3d };
      chips.querySelectorAll('.chip').forEach(function (c) {
        c.setAttribute('data-on', map[c.textContent.trim()] ? 'true' : 'false');
      });
    }

    var k = keyOf(state);
    var hit = MEASURED[k];
    var latEl = document.getElementById('ex-lat');
    var srEl = document.getElementById('ex-sr');
    var modeEl = document.getElementById('ex-mode');
    var descEl = document.getElementById('ex-desc');
    var latNote = document.getElementById('ex-lat-note');
    var srNote = document.getElementById('ex-sr-note');

    if (hit) {
      latEl.innerHTML = hit.lat + '<span class="unit">ms</span>';
      srEl.innerHTML = hit.sr.toFixed(1) + '<span class="unit">%</span>';
      modeEl.textContent = hit.name;
      descEl.textContent = hit.desc;
      latNote.innerHTML = hit.latNote;
      srNote.innerHTML = hit.srNote;
    } else {
      latEl.innerHTML = '&mdash;';
      srEl.innerHTML = '&mdash;';
      modeEl.textContent = 'Deployable, but not benchmarked';
      descEl.textContent = 'The checkpoint supports this combination — stream masks are runtime arguments, not ' +
        'architectural choices — but the paper reports the four configurations on the cumulative ladder. ' +
        'Click a point on the chart below to jump to a measured one.';
      latNote.innerHTML = 'No published measurement.';
      srNote.innerHTML = 'No published measurement.';
    }

    paretoPts.forEach(function (g, i) {
      g.setAttribute('data-active', hit && hit.i === i ? 'true' : 'false');
    });
  }

  function initExplorer() {
    var root = document.getElementById('explorer');
    if (!root) return;
    root.querySelectorAll('.toggle[data-stream]').forEach(function (b) {
      b.addEventListener('click', function () {
        var s = b.getAttribute('data-stream');
        state[s] = !state[s];
        paintExplorer();
      });
    });
    paintExplorer();
  }

  /* ---------------------------------------------------------------------
     stream-dropout mask demo
     --------------------------------------------------------------------- */
  function initMaskDemo() {
    var wrap = document.getElementById('mask-demo');
    if (!wrap) return;
    var STREAMS = [
      { k: 'V', v: '--s-rgb', name: 'RGB' },
      { k: 'D', v: '--s-dino', name: 'DINO' },
      { k: 'P', v: '--s-3d', name: 'pointmap' }
    ];
    var rows = {};
    ['in', 'out'].forEach(function (which) {
      var host = wrap.querySelector('[data-mask="' + which + '"]');
      rows[which] = STREAMS.map(function (s) {
        var c = document.createElement('span');
        c.className = 'cell';
        c.style.setProperty('--dot', 'var(' + s.v + ')');
        c.textContent = s.k;
        c.setAttribute('data-on', 'true');
        host.appendChild(c);
        return c;
      });
    });

    var noteEl = document.getElementById('mask-note');
    var nEl = document.getElementById('mask-n');
    var btn = document.getElementById('mask-toggle');
    var n = 0, timer = null, running = !reduceMotion;

    function draw() {
      var mi, tries = 0;
      do { mi = STREAMS.map(function () { return Math.random() < 0.5; }); tries++; }
      while (!mi.some(Boolean) && tries < 20);
      if (!mi.some(Boolean)) mi[0] = true;               // rejection sampling guarantee
      var mo = STREAMS.map(function () { return Math.random() < 0.5; });

      n += 1;
      nEl.textContent = String(n);
      rows.in.forEach(function (c, i) { c.setAttribute('data-on', mi[i] ? 'true' : 'false'); });
      rows.out.forEach(function (c, i) { c.setAttribute('data-on', mo[i] ? 'true' : 'false'); });

      var forced = STREAMS.filter(function (s, i) { return !mi[i] && mo[i]; });
      var msg;
      if (!mo.some(Boolean)) {
        msg = 'No future is read by the action expert — this draw trains the <b>action-only fast path</b>. ' +
              'All three visual streams are still denoised and still incur their loss.';
      } else if (forced.length) {
        msg = '<b>Cross-modality forcing:</b> the ' + forced.map(function (s) { return s.name; }).join(' and ') +
              ' stream' + (forced.length > 1 ? 's are' : ' is') + ' never observed, yet ' +
              (forced.length > 1 ? 'their futures are' : 'its future is') +
              ' generated from the remaining streams and read by the action expert.';
      } else {
        msg = 'The action expert reads ' + STREAMS.filter(function (s, i) { return mo[i]; })
              .map(function (s) { return s.name; }).join(' + ') +
              ' futures, conditioning actions on a jointly generated future.';
      }
      noteEl.innerHTML = msg;
    }

    function start() { running = true; btn.textContent = 'Pause sampling'; timer = setInterval(draw, 2400); draw(); }
    function stop() { running = false; btn.textContent = 'Resume sampling'; clearInterval(timer); timer = null; }

    btn.addEventListener('click', function () { running ? stop() : start(); });

    /* only run while visible */
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { if (running && !timer) { timer = setInterval(draw, 2400); } }
        else if (timer) { clearInterval(timer); timer = null; }
      });
    }, { threshold: 0.15 });
    io.observe(wrap);

    draw();
    if (reduceMotion) { btn.textContent = 'Resume sampling'; }
    else { timer = setInterval(draw, 2400); }
  }

  /* ---------------------------------------------------------------------
     videos: play only while on screen  (16 clips — do not run them all)
     --------------------------------------------------------------------- */
  function initVideos() {
    var vids = Array.prototype.slice.call(document.querySelectorAll('video[data-autoplay]'));
    if (!('IntersectionObserver' in window)) {
      vids.forEach(function (v) { v.play().catch(function () {}); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) {
          if (v.preload !== 'auto') v.preload = 'auto';
          v.play().catch(function () {});
        } else {
          v.pause();
        }
      });
    }, { threshold: 0.25, rootMargin: '120px 0px' });
    vids.forEach(function (v) { io.observe(v); });
  }

  /* ---------------------------------------------------------------------
     lightbox
     --------------------------------------------------------------------- */
  function initLightbox() {
    var lb = document.getElementById('lightbox');
    if (!lb) return;
    var lv = document.getElementById('lb-video');
    var cap = document.getElementById('lb-cap');
    var lastFocus = null;

    function open(src, poster, caption) {
      lastFocus = document.activeElement;
      lv.src = src;
      if (poster) lv.poster = poster;
      cap.textContent = caption || '';
      lb.setAttribute('data-open', 'true');
      document.body.style.overflow = 'hidden';
      setRate(1);
      lv.play().catch(function () {});
      document.getElementById('lb-close').focus();
    }
    function close() {
      lb.setAttribute('data-open', 'false');
      lv.pause(); lv.removeAttribute('src'); lv.load();
      document.body.style.overflow = '';
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    function setRate(r) {
      lv.playbackRate = r;
      lb.querySelectorAll('.lb__speeds button').forEach(function (b) {
        b.setAttribute('aria-pressed', parseFloat(b.getAttribute('data-rate')) === r ? 'true' : 'false');
      });
    }

    document.querySelectorAll('[data-player]').forEach(function (p) {
      var btn = p.querySelector('.player__expand');
      if (!btn) return;
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var v = p.querySelector('video:not([hidden])') || p.querySelector('video');
        if (!v) return;
        open(v.currentSrc || v.src, v.getAttribute('poster'), p.getAttribute('data-caption'));
      });
    });

    /* the cinematic stage video expands too */
    var se = document.getElementById('stage-expand');
    var sv = document.querySelector('.stage__video');
    if (se && sv) {
      se.addEventListener('click', function () {
        open(sv.currentSrc || sv.src, sv.getAttribute('poster'),
          'Flex-π on a stationary bimanual YAM workcell. Placeholder footage — see the note in the footer.');
      });
    }

    lb.querySelectorAll('.lb__speeds button').forEach(function (b) {
      b.addEventListener('click', function () { setRate(parseFloat(b.getAttribute('data-rate'))); });
    });
    document.getElementById('lb-close').addEventListener('click', close);
    lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && lb.getAttribute('data-open') === 'true') close();
    });
  }

  /* ---------------------------------------------------------------------
     nav current-section highlight
     --------------------------------------------------------------------- */
  function initNav() {
    var links = Array.prototype.slice.call(document.querySelectorAll('.nav__links a[href^="#"]'));
    var map = {};
    links.forEach(function (a) {
      var id = a.getAttribute('href').slice(1);
      var sec = document.getElementById(id);
      if (sec) map[id] = a;
    });
    var ids = Object.keys(map);
    if (!ids.length || !('IntersectionObserver' in window)) return;

    var visible = {};
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { visible[e.target.id] = e.isIntersecting ? e.intersectionRatio : 0; });
      var best = null, bv = 0;
      ids.forEach(function (id) { if ((visible[id] || 0) > bv) { bv = visible[id]; best = id; } });
      links.forEach(function (a) { a.removeAttribute('aria-current'); });
      if (best) map[best].setAttribute('aria-current', 'true');
    }, { threshold: [0, 0.15, 0.4, 0.75], rootMargin: '-70px 0px -40% 0px' });

    ids.forEach(function (id) { io.observe(document.getElementById(id)); });
  }

  /* ---------------------------------------------------------------------
     scroll reveal
     --------------------------------------------------------------------- */
  function initReveal() {
    var items = document.querySelectorAll('.reveal');
    if (reduceMotion || !('IntersectionObserver' in window)) {
      items.forEach(function (n) { n.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    items.forEach(function (n) { io.observe(n); });
  }

  /* ---------------------------------------------------------------------
     bibtex copy
     --------------------------------------------------------------------- */
  function initCopy() {
    var btn = document.getElementById('bib-copy');
    var pre = document.getElementById('bib-text');
    if (!btn || !pre) return;
    btn.addEventListener('click', function () {
      var done = function () {
        btn.textContent = 'Copied';
        setTimeout(function () { btn.textContent = 'Copy'; }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(pre.textContent).then(done, function () {});
      } else {
        var r = document.createRange(); r.selectNodeContents(pre);
        var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
        try { document.execCommand('copy'); done(); } catch (err) {}
        s.removeAllRanges();
      }
    });
  }

  /* ---------------------------------------------------------------------
     dynamic architecture: mask state, regimes, and the stream panel
     --------------------------------------------------------------------- */
  var STREAM_INFO = {
    rgb:  { badge: 'RGB · appearance',
            note: 'Appearance. The observation image, encoded by a frozen Wan-2.2 VAE into latent tokens that ' +
                  'inherit spatiotemporal priors from internet-scale video pre-training.' },
    p3d:  { badge: 'Pointmap · 3D geometry',
            note: 'Geometry. A 3D pointmap pushed through the same frozen VAE — an encoder trained only on RGB ' +
                  'reconstructs pointmaps at 38 dB PSNR on the paper’s example, so the latent space carries scene ' +
                  'geometry directly.' },
    dino: { badge: 'DINO · object semantics',
            note: 'Semantics. Object-level tokens from a frozen DINOv3 encoder, folded 2×2 into the channel ' +
                  'dimension to remove 75% of the tokens losslessly, then projected into the shared trunk.' },
    act:  { badge: 'Action · 32 steps × 14 DoF',
            note: 'Action. The policy emits a chunk of 32 future steps across 14 commanded degrees of freedom — ' +
                  'two 6-DoF arms plus a gripper each. The robot executes the whole chunk before re-planning, once ' +
                  'every 1.07 s.' }
  };

  /* the four rows of the paper’s Figure 4 */
  var REGIMES = {
    joint:  { min: { rgb: 1, p3d: 1, dino: 1 }, out: { rgb: 1, p3d: 1, dino: 1 },
              note: 'All three futures are co-denoised with the action, and the action expert reads every one of them.' },
    action: { min: { rgb: 1, p3d: 1, dino: 1 }, out: { rgb: 0, p3d: 0, dino: 0 },
              note: 'The action-only fast path. No future visual stream is read, so none is computed — this is where ' +
                    'the VLA-level latency comes from.' },
    p3d:    { min: { rgb: 1, p3d: 1, dino: 1 }, out: { rgb: 0, p3d: 1, dino: 0 },
              note: 'One of many intermediate regimes: only the 3D future is generated and read, buying geometric ' +
                    'grounding without paying for the other two streams.' },
    xmod:   { min: { rgb: 1, p3d: 0, dino: 1 }, out: { rgb: 0, p3d: 1, dino: 0 },
              note: 'Cross-modality forcing. The pointmap is never observed, yet its future is generated from RGB and ' +
                    'DINO alone and read by the action expert — which is what forces the three streams to stay ' +
                    'mutually predictive.' }
  };

  /* --- schematic action chunk: 14 joint traces over 32 steps --- */
  function buildActionViz(host) {
    var W = 640, H = 360, padL = 52, padR = 18, padT = 30, padB = 34;
    var DOF = 14, STEPS = 32;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var lane = plotH / DOF;

    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'xMidYMid meet',
                          role: 'img', 'aria-label': host.getAttribute('aria-label') || 'action chunk schematic' });

    svg.appendChild(el('text', { 'class': 'ac-lab', x: padL, y: 18 }, 'action chunk'));
    svg.appendChild(el('text', { 'class': 'ac-lab--dim', x: W - padR, y: 18, 'text-anchor': 'end' },
      '32 steps × 14 DoF · 30 Hz'));
    svg.appendChild(el('text', { 'class': 'ac-lab--dim', x: padL, y: H - 12 }, 't'));
    svg.appendChild(el('text', { 'class': 'ac-lab--dim', x: W - padR, y: H - 12, 'text-anchor': 'end' },
      't + 32  (re-plan)'));

    /* vertical step grid */
    for (var s = 0; s <= STEPS; s += 8) {
      var gx = padL + (s / STEPS) * plotW;
      svg.appendChild(el('line', { 'class': 'ac-grid', x1: gx, y1: padT - 6, x2: gx, y2: padT + plotH + 4 }));
    }

    /* deterministic smooth traces: sum of a few sines per joint */
    var names = ['L·j1','L·j2','L·j3','L·j4','L·j5','L·j6','L·grip',
                 'R·j1','R·j2','R·j3','R·j4','R·j5','R·j6','R·grip'];
    for (var d = 0; d < DOF; d++) {
      var cy = padT + lane * (d + 0.5);
      svg.appendChild(el('text', { 'class': 'ac-lab--dim', x: padL - 8, y: cy + 3.5, 'text-anchor': 'end' }, names[d]));
      var pts = [], amp = lane * 0.42;
      for (var k = 0; k <= STEPS; k++) {
        var u = k / STEPS;
        var v = Math.sin(u * 3.1 + d * 0.9) * 0.55
              + Math.sin(u * 6.7 + d * 2.3) * 0.28
              + Math.sin(u * 11.3 + d * 1.7) * 0.14;
        if (names[d].indexOf('grip') > -1) v = Math.tanh(Math.sin(u * 2.2 + d) * 3) * 0.85;  /* grippers step */
        pts.push([padL + u * plotW, cy - v * amp]);
      }
      var dstr = pts.map(function (q, i) { return (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join(' ');
      var hue = d < 7 ? 'var(--s-action)' : 'var(--s-3d)';
      svg.appendChild(el('path', { 'class': 'ac-trace', d: dstr, stroke: hue,
                                   opacity: (0.55 + 0.35 * (1 - Math.abs(d - 6.5) / 7)).toFixed(2) }));
    }

    /* sweeping playhead */
    var head = el('g', {});
    head.appendChild(el('line', { 'class': 'ac-head', x1: 0, y1: padT - 6, x2: 0, y2: padT + plotH + 4 }));
    head.appendChild(el('circle', { 'class': 'ac-headdot', cx: 0, cy: padT - 8, r: 3.5 }));
    var anim = el('animateTransform', { attributeName: 'transform', type: 'translate',
      from: padL + ',0', to: (padL + plotW) + ',0', dur: '4s', repeatCount: 'indefinite' });
    head.appendChild(anim);
    svg.appendChild(head);

    host.innerHTML = '';
    host.appendChild(svg);
  }

  function initArchviz() {
    var root = document.getElementById('archviz');
    if (!root) return;
    var chips   = Array.prototype.slice.call(root.querySelectorAll('.streamchip'));
    var rchips  = Array.prototype.slice.call(root.querySelectorAll('.regimechip'));
    var badge   = document.getElementById('av-badge');
    var note    = document.getElementById('av-note');
    var rnote   = document.getElementById('av-regime-note');
    var actHost = document.getElementById('av-v-act');
    var panels  = { rgb: document.getElementById('av-v-rgb'), p3d: document.getElementById('av-v-p3d'),
                    dino: document.getElementById('av-v-dino'), act: actHost };
    var order   = ['rgb', 'p3d', 'dino', 'act'];
    var touched = false, current = 'rgb', actTimer = null, onScreen = false;

    if (actHost) buildActionViz(actHost);

    function nextStream() {
      if (touched) return;
      showStream(order[(order.indexOf(current) + 1) % order.length]);
    }

    function showStream(key) {
      current = key;
      root.setAttribute('data-active', key);
      chips.forEach(function (c) {
        c.setAttribute('aria-pressed', c.getAttribute('data-stream') === key ? 'true' : 'false');
      });
      order.forEach(function (k) {
        var node = panels[k];
        if (!node) return;
        var on = (k === key);
        node.hidden = !on;
        if (node.tagName === 'VIDEO') {
          if (on) {
            try { node.currentTime = 0; } catch (e) {}
            node.play().catch(function () {});
          } else { node.pause(); }
        }
      });
      root.querySelectorAll('.av-row, .av-out').forEach(function (g) {
        var s = g.getAttribute('data-s') || g.getAttribute('data-o');
        g.classList.toggle('is-sel', s === key);
      });
      if (badge && STREAM_INFO[key]) badge.textContent = STREAM_INFO[key].badge;
      if (note && STREAM_INFO[key]) note.textContent = STREAM_INFO[key].note;

      /* the action panel is SVG, so it has no 'ended' event to wait on */
      clearTimeout(actTimer);
      if (!touched && key === 'act') actTimer = setTimeout(nextStream, 9000);
    }

    function applyRegime(name) {
      var r = REGIMES[name];
      if (!r) return;
      rchips.forEach(function (c) {
        c.setAttribute('aria-pressed', c.getAttribute('data-regime') === name ? 'true' : 'false');
      });
      root.querySelectorAll('.av-row').forEach(function (g) {
        g.setAttribute('data-on', r.min[g.getAttribute('data-s')] ? 'true' : 'false');
      });
      root.querySelectorAll('.av-out').forEach(function (g) {
        var o = g.getAttribute('data-o');
        g.setAttribute('data-on', (o === 'act' || r.out[o]) ? 'true' : 'false');
      });
      if (rnote) rnote.textContent = r.note;
    }

    /* auto-advance when the current clip finishes; a click hands control over for good */
    ['rgb', 'p3d', 'dino'].forEach(function (k) {
      var v = panels[k];
      if (!v) return;
      v.loop = false;
      v.addEventListener('ended', function () {
        if (touched) { v.play().catch(function () {}); return; }
        if (onScreen) nextStream();
      });
    });

    function takeOver() {
      touched = true;
      clearTimeout(actTimer);
      ['rgb', 'p3d', 'dino'].forEach(function (k) { if (panels[k]) panels[k].loop = true; });
    }

    chips.forEach(function (c) {
      c.addEventListener('click', function () {
        takeOver();
        showStream(c.getAttribute('data-stream'));
      });
    });
    rchips.forEach(function (c) {
      c.addEventListener('click', function () { applyRegime(c.getAttribute('data-regime')); });
    });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          onScreen = e.isIntersecting;
          if (!onScreen) clearTimeout(actTimer);
          else if (!touched && current === 'act') actTimer = setTimeout(nextStream, 9000);
        });
      }, { threshold: 0.3 }).observe(root);
    } else { onScreen = true; }

    if (reduceMotion) {
      var svg = document.getElementById('av-svg');
      if (svg && svg.pauseAnimations) svg.pauseAnimations();
      takeOver();
    }

    applyRegime('joint');
    showStream('rgb');
  }

  /* ---------------------------------------------------------------------
     theme toggle — the page ships "day" (cream) like the ENPIRE anchor;
     both themes are fully authored, so this is a token swap. Charts read
     their colors from CSS custom properties, so they are re-rendered.
     --------------------------------------------------------------------- */
  function initTheme() {
    var btn = document.getElementById('theme-toggle');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-theme') === 'night' ? 'night' : 'day';
      var next = cur === 'day' ? 'night' : 'day';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('flexpi-theme', next); } catch (e) {}
      renderCharts();
      paintExplorer();
    });
  }

  /* ---------------------------------------------------------------------
     boot
     --------------------------------------------------------------------- */
  function boot() {
    initTheme();
    renderCharts();
    initExplorer();
    initMaskDemo();
    initVideos();
    initArchviz();
    initLightbox();
    initNav();
    initReveal();
    initCopy();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  /* re-lay-out charts on significant resize (viewBox is fluid, but labels are not) */
  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { renderCharts(); paintExplorer(); }, 260);
  });
})();
