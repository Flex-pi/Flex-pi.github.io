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
      oursL: css('--c-ours-l') || '#8fd9b0',
      oursD: css('--c-ours-d') || '#2f8f5b',
      base: css('--c-base') || '#9a9a9a',
      base2: css('--c-base2') || '#e0b04a',
      base3: css('--c-base3') || '#7b8b9e',
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
          { label: 'Clean the|Kitchen Rack', values: [15, 50, 95] },
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
          { label: 'Kitchen Rack:|distractor', values: [5, 45, 80] }
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

    /* real-robot latency (Figure 12, all at the deployed 4 denoise steps) */
    if ((m = find('latency'))) {
      barChart(m, {
        groups: [
          { label: 'π₀.₅|baseline', values: [66], colors: [C.base2] },
          { label: 'ManiFlow|baseline', values: [103], colors: [C.base3] },
          { label: 'Fast-WAM|baseline', values: [86], colors: [C.base] },
          { label: 'Flex-π|action-only', values: [60], colors: [C.oursL] },
          { label: 'Flex-π|full joint', values: [193], colors: [C.oursD] }
        ],
        series: [{ name: 'Latency' }],
        max: 210, yTicks: [0, 50, 100, 150, 200], plotH: 230,
        valFmt: function (v) { return String(v); },
        yLabel: 'Latency (ms)',
        ariaLabel: 'Measured latency at four denoise steps: 60 ms for Flex-π action-only — under π0.5 at 66 ms, Fast-WAM at 86 ms and ManiFlow at 103 ms — and 193 ms for full joint generation.'
      });
    }
  }

  /* ---------------------------------------------------------------------
     the real-world frontier, run as a race (streams section)
     The x axis is latency, i.e. time, so the animation is physically exact:
     five dots launch together in parallel runway lanes and advance at the
     same true speed (slowed 5×); each stops the moment its inference
     completes, then climbs to its measured task completion. Colors are
     var() references so the chart follows the theme without re-rendering —
     which also means it is built once and never re-run on toggle/resize.
     ?freeze=<real ms> renders that instant statically (paper/slide frames).
     --------------------------------------------------------------------- */
  function initFrontierRace() {
    var mount = document.getElementById('frontier-race');
    if (!mount) return;

    var SLOW = 5, RISE = 500, HOLD = 500;
    var M = [
      { name: 'π₀.₅',                 lat: 66,  sr: 45.2, c: 'var(--c-base2)',  dx: 18,  dy: 6,   anchor: 'start' },
      { name: 'Fast-WAM',             lat: 86,  sr: 37.2, c: 'var(--c-base)',   dx: 18,  dy: 6,   anchor: 'start' },
      { name: 'ManiFlow',             lat: 103, sr: 51.6, c: 'var(--c-base3)',  dx: 18,  dy: 6,   anchor: 'start' },
      { name: 'Flex-π (action-only)', lat: 60,  sr: 73.9, c: 'var(--c-ours-l)', dx: 20,  dy: -13, anchor: 'start', ours: true },
      { name: 'Flex-π (full joint)',  lat: 193, sr: 81.2, c: 'var(--c-ours-d)', dx: -20, dy: -16, anchor: 'end',   ours: true }
    ];
    var MAXLAT = 193;

    var W = 1000, padL = 60, padR = 34, padT = 36, plotH = 400, H = 492;
    var plotW = W - padL - padR;
    var xMin = 0, xMax = 215, yMin = 28, yMax = 90;
    function X(v) { return padL + (v - xMin) / (xMax - xMin) * plotW; }
    function Y(v) { return padT + plotH - (v - yMin) / (yMax - yMin) * plotH; }
    function easeOut(p) { return 1 - Math.pow(1 - p, 3); }

    var svg = el('svg', {
      'class': 'chart', viewBox: '0 0 ' + W + ' ' + H,
      preserveAspectRatio: 'xMidYMid meet', role: 'img',
      'aria-label': 'Animated scatter plot of task completion versus inference latency. Five dots race ' +
        'rightward in parallel lanes along the time axis; each stops when its inference completes, then ' +
        'climbs to its task-completion score. Flex-π action-only stops first at 60 ms and climbs to 73.9%; ' +
        'π0.5 stops at 66 ms, 45.2%; Fast-WAM at 86 ms, 37.2%; ManiFlow at 103 ms, 51.6%; Flex-π full ' +
        'joint stops last at 193 ms but climbs highest, to 81.2%.'
    });

    [30, 40, 50, 60, 70, 80, 90].forEach(function (t) {
      svg.appendChild(el('line', { 'class': 'grid', x1: padL, x2: W - padR, y1: Y(t), y2: Y(t) }));
      svg.appendChild(el('text', { 'class': 'tick', x: padL - 9, y: Y(t) + 3.5, 'text-anchor': 'end' }, t + '%'));
    });

    /* the chart is compact from the start: the axis IS the plot floor. The
       runway borrows the lower stripe of the plot itself (~30-42%) during the
       race; the racers climb out of it and the green band morphs into the
       claret verdict box, so no region is ever left idle. Fastest lane on top. */
    var AXIS_Y = Y(yMin);
    var LANE_GAP = 17, LANE_TOP = AXIS_Y - 16 - 4 * LANE_GAP;
    var band = { x: padL, y: LANE_TOP - 12, w: W - padL - padR, h: (AXIS_Y - 6) - (LANE_TOP - 12) };
    var greenBand = el('rect', { x: band.x, y: band.y, width: band.w, height: band.h,
      fill: 'var(--c-ours)', opacity: .07, rx: 3 });
    svg.appendChild(greenBand);
    M.slice().sort(function (a, b) { return a.lat - b.lat; }).forEach(function (m, i) {
      m.laneY = LANE_TOP + i * LANE_GAP;
      m.guide = el('line', { x1: padL, x2: W - padR, y1: m.laneY, y2: m.laneY,
        stroke: 'var(--c-ours)', 'stroke-width': 1, 'stroke-dasharray': '1 5', opacity: .35 });
      svg.appendChild(m.guide);
    });
    var laneLab = el('text', { 'class': 'lanelab lanelab--live', x: W - padR, y: band.y - 7,
      'text-anchor': 'end' }, 'computing…');
    svg.appendChild(laneLab);

    svg.appendChild(el('line', { 'class': 'axis', x1: padL, x2: padL, y1: padT - 8, y2: AXIS_Y }));
    svg.appendChild(el('line', { 'class': 'axis', x1: padL, x2: W - padR, y1: AXIS_Y, y2: AXIS_Y }));
    [0, 50, 100, 150, 200].forEach(function (t) {
      svg.appendChild(el('line', { 'class': 'axis', x1: X(t), x2: X(t), y1: AXIS_Y, y2: AXIS_Y + 4 }));
      svg.appendChild(el('text', { 'class': 'tick', x: X(t), y: AXIS_Y + 20, 'text-anchor': 'middle' }, String(t)));
    });
    svg.appendChild(el('text', { 'class': 'alab', x: padL + plotW / 2, y: AXIS_Y + 44,
      'text-anchor': 'middle' }, 'inference latency (ms) → slower'));
    svg.appendChild(el('text', { 'class': 'alab', x: 0, y: 0, 'text-anchor': 'middle',
      transform: 'translate(14,' + (padT + plotH / 2) + ') rotate(-90)' }, 'task completion (%)'));

    var clock = el('text', { 'class': 'clock', x: W - padR, y: padT - 14, 'text-anchor': 'end' }, 't = 0 ms');
    svg.appendChild(clock);

    /* verdict box: everything slower AND lower than the fast path. It starts
       life as the green runway band — setMorph() carries geometry and color
       from one to the other. */
    var AO = M[3];
    var dom = { x: X(AO.lat), y: Y(AO.sr), w: X(xMax) - X(AO.lat), h: (AXIS_Y - 6) - Y(AO.sr) };
    var domRect = el('rect', { x: band.x, y: band.y, width: band.w, height: band.h,
      fill: 'var(--primary-soft)', opacity: 0, rx: 3 });
    svg.appendChild(domRect);
    var domEdgeV = el('line', { x1: dom.x, x2: dom.x, y1: dom.y, y2: dom.y + dom.h,
      stroke: 'var(--primary-ink)', 'stroke-width': 1, 'stroke-dasharray': '3 4', opacity: 0 });
    var domEdgeH = el('line', { x1: dom.x, x2: dom.x + dom.w, y1: dom.y, y2: dom.y,
      stroke: 'var(--primary-ink)', 'stroke-width': 1, 'stroke-dasharray': '3 4', opacity: 0 });
    svg.appendChild(domEdgeV); svg.appendChild(domEdgeH);
    var domT = el('text', { 'class': 'domlab', x: X(207), y: Y(66), 'text-anchor': 'end', opacity: 0 },
      'every baseline: slower and lower');
    svg.appendChild(domT);

    function lerp(a, b, p) { return a + (b - a) * p; }
    function setMorph(p) {
      var e = easeOut(p);
      var x = lerp(band.x, dom.x, e), y = lerp(band.y, dom.y, e);
      var w = lerp(band.w, dom.w, e), h = lerp(band.h, dom.h, e);
      [greenBand, domRect].forEach(function (r) {
        r.setAttribute('x', x); r.setAttribute('y', y);
        r.setAttribute('width', w); r.setAttribute('height', h);
        r.setAttribute('rx', 3 * (1 - p));
      });
      greenBand.setAttribute('opacity', .07 * (1 - p));
      domRect.setAttribute('opacity', p);
    }
    function setVerdictTrim(p) {
      domEdgeV.setAttribute('opacity', .5 * p);
      domEdgeH.setAttribute('opacity', .5 * p);
      domT.setAttribute('opacity', p);
    }

    var dots = M.map(function (m) {
      var g = el('g', {});
      var ring = el('circle', { cx: X(m.lat), cy: Y(m.sr), r: 11, fill: 'none',
        stroke: m.c, 'stroke-width': 2.5, opacity: 0 });
      var dot = el('circle', { cx: padL, cy: m.laneY, r: m.ours ? 11 : 10, fill: m.c,
        stroke: 'var(--bg-raise)', 'stroke-width': 2.5 });
      var lab = el('text', { 'class': 'dlab' + (m.ours ? ' dlab--hi' : ''), x: X(m.lat) + m.dx,
        y: Y(m.sr) + m.dy, 'text-anchor': m.anchor, opacity: 0 }, m.name);
      /* exact numbers only on hover — the picture carries the comparison */
      var val = el('text', { 'class': 'dval', x: X(m.lat) + m.dx, y: Y(m.sr) + m.dy + 18,
        'text-anchor': m.anchor, opacity: 0 }, m.lat + ' ms · ' + m.sr.toFixed(1) + '%');
      var hit = el('circle', { cx: X(m.lat), cy: Y(m.sr), r: 24, fill: 'transparent' });
      var d = { m: m, dot: dot, ring: ring, lab: lab, val: val, phase: 'run', riseT0: null };
      hit.addEventListener('mouseenter', function () { if (d.phase === 'done') val.setAttribute('opacity', 1); });
      hit.addEventListener('mouseleave', function () { val.setAttribute('opacity', 0); });
      g.appendChild(ring); g.appendChild(dot); g.appendChild(lab); g.appendChild(val); g.appendChild(hit);
      svg.appendChild(g);
      return d;
    });

    mount.appendChild(svg);

    function setFinal() {
      dots.forEach(function (d) {
        d.dot.setAttribute('cx', X(d.m.lat)); d.dot.setAttribute('cy', Y(d.m.sr));
        d.lab.setAttribute('opacity', 1);
        d.m.guide.setAttribute('opacity', 0); d.phase = 'done';
      });
      laneLab.setAttribute('opacity', 0);
      clock.textContent = 't = ' + MAXLAT + ' ms';
      clock.setAttribute('class', 'clock clock--done');
      setMorph(1); setVerdictTrim(1);
    }

    function flashRing(d) {
      d.ring.setAttribute('cx', X(d.m.lat));
      d.ring.setAttribute('cy', d.m.laneY);
      var t0 = null, DUR = 460;
      function step(ts) {
        if (!t0) t0 = ts;
        var p = Math.min(1, (ts - t0) / DUR);
        d.ring.setAttribute('r', 11 + p * 15);
        d.ring.setAttribute('opacity', (1 - p) * .7);
        if (p < 1) requestAnimationFrame(step); else d.ring.setAttribute('opacity', 0);
      }
      requestAnimationFrame(step);
    }

    /* the runway becomes the verdict: morph the green band into the claret
       box — geometry and color together — then fade in its dashed edges and
       label. The axes never move. */
    function finale(done) {
      var MORPH = 700, TRIM = 300, t0 = null;
      laneLab.setAttribute('opacity', 0);
      function step(ts) {
        if (!t0) t0 = ts;
        var t = ts - t0;
        if (t < MORPH) {
          setMorph(t / MORPH);
        } else if (t < MORPH + TRIM) {
          setMorph(1);
          setVerdictTrim((t - MORPH) / TRIM);
        } else {
          setMorph(1); setVerdictTrim(1);
          if (done) done();
          return;
        }
        requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    var btn = document.getElementById('fr-replay');
    var raf = null;
    function race() {
      if (raf) cancelAnimationFrame(raf);
      setMorph(0); setVerdictTrim(0);
      clock.setAttribute('class', 'clock');
      laneLab.setAttribute('opacity', 1);
      dots.forEach(function (d) {
        d.phase = 'run'; d.riseT0 = null;
        d.dot.setAttribute('cx', padL); d.dot.setAttribute('cy', d.m.laneY);
        d.lab.setAttribute('opacity', 0); d.val.setAttribute('opacity', 0);
        d.m.guide.setAttribute('opacity', .35);
      });
      if (btn) btn.disabled = true;
      var t0 = performance.now(), sweepAt = null;
      function step(now) {
        var tms = (now - t0) / SLOW;                 /* elapsed, in real ms */
        clock.textContent = 't = ' + Math.floor(Math.min(tms, MAXLAT)) + ' ms';
        var allDone = true;
        dots.forEach(function (d) {
          if (d.phase === 'done') return;
          allDone = false;
          if (d.phase === 'run') {
            if (tms >= d.m.lat) {
              d.phase = 'rise'; d.riseT0 = now;
              d.dot.setAttribute('cx', X(d.m.lat));
              flashRing(d);
            } else {
              d.dot.setAttribute('cx', X(tms));
            }
          }
          if (d.phase === 'rise') {
            var p = Math.min(1, (now - d.riseT0) / RISE);
            d.dot.setAttribute('cy', d.m.laneY + (Y(d.m.sr) - d.m.laneY) * easeOut(p));
            d.m.guide.setAttribute('opacity', .35 * (1 - p));
            if (p >= 1) {
              d.phase = 'done';
              d.lab.setAttribute('opacity', 1);
            }
          }
        });
        if (allDone) {
          clock.setAttribute('class', 'clock clock--done');
          if (sweepAt === null) sweepAt = now + HOLD;
          if (now >= sweepAt) { finale(function () { if (btn) btn.disabled = false; }); return; }
        }
        raf = requestAnimationFrame(step);
      }
      raf = requestAnimationFrame(step);
    }

    if (btn) btn.addEventListener('click', race);

    /* static frame for screenshots: ?freeze=<real ms> */
    var freeze = new URLSearchParams(location.search).get('freeze');
    if (freeze !== null) {
      /* frames are shot headless, where smooth anchor scrolling never lands */
      document.documentElement.style.scrollBehavior = 'auto';
      var ft = Math.max(0, parseFloat(freeze) || 0);
      clock.textContent = 't = ' + Math.floor(Math.min(ft, MAXLAT)) + ' ms';
      var allLanded = true;
      dots.forEach(function (d) {
        if (ft < d.m.lat) {
          d.dot.setAttribute('cx', X(ft)); d.dot.setAttribute('cy', d.m.laneY);
          allLanded = false;
        } else {
          var p = Math.min(1, (ft - d.m.lat) * SLOW / RISE);
          d.dot.setAttribute('cx', X(d.m.lat));
          d.dot.setAttribute('cy', d.m.laneY + (Y(d.m.sr) - d.m.laneY) * easeOut(p));
          d.m.guide.setAttribute('opacity', .35 * (1 - p));
          if (p >= 1) { d.lab.setAttribute('opacity', 1); d.phase = 'done'; }
          else allLanded = false;
        }
      });
      if (allLanded) {
        laneLab.setAttribute('opacity', 0);
        clock.setAttribute('class', 'clock clock--done');
        if (ft >= 400) { setMorph(1); setVerdictTrim(1); }
      }
      return;
    }

    if (reduceMotion) { setFinal(); return; }

    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { race(); io.disconnect(); }
      });
    }, { threshold: .45 });
    io.observe(svg);
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
      latEl.innerHTML = '68&ndash;398<span class="unit">ms</span>';
      srEl.innerHTML = '&mdash;';
      modeEl.textContent = 'Deployable, but not benchmarked';
      descEl.textContent = 'The checkpoint supports this combination — stream masks are runtime arguments, not ' +
        'architectural choices — but the paper reports the four configurations on the cumulative ladder. ' +
        'Click a point on the chart below to jump to a measured one.';
      latNote.innerHTML = 'Bracketed by the measured endpoints; not benchmarked individually.';
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
    var badge = document.getElementById('lb-badge');
    var speeds = document.getElementById('lb-speeds');
    var lastFocus = null;
    var native = 1; /* the clip's baked speed — real-world speed at playbackRate 1 */

    /* clips are exported at varied speeds (1×, 1.7×, 2× …) — the speed lives in
       the player's badge (or an explicit data-speed override), so the lightbox
       can offer real-world rates instead of file-relative ones */
    function bakedRate(p) {
      if (!p) return 1;
      var ds = parseFloat(p.getAttribute('data-speed'));
      if (ds > 0) return ds;
      var m = speedBadge(p);
      return m ? parseFloat(m.text.match(/([\d.]+)\s*[×x]/)[1]) || 1 : 1;
    }
    function speedBadge(p) {
      if (!p) return null;
      var bs = p.querySelectorAll('.player__badge');
      for (var i = 0; i < bs.length; i++) {
        var t = bs[i].textContent.trim();
        if (/[\d.]+\s*[×x]/.test(t)) return { text: t };
      }
      return null;
    }
    function fmtRate(r) { return (Math.round(r * 100) / 100) + '×'; }
    function buildSpeeds() {
      var opts = [1, 2];
      if (opts.indexOf(native) === -1) opts.push(native);
      opts.sort(function (a, b) { return a - b; });
      speeds.innerHTML = '';
      opts.forEach(function (r) {
        var b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('data-real', r);
        b.title = r === 1 ? 'real-world speed' : fmtRate(r) + ' real-world speed';
        b.textContent = fmtRate(r);
        speeds.appendChild(b);
      });
    }

    function open(src, poster, caption, p) {
      lastFocus = document.activeElement;
      lv.src = src;
      if (poster) lv.poster = poster;
      cap.textContent = caption || '';
      native = bakedRate(p);
      var sb = speedBadge(p);
      badge.textContent = sb ? sb.text : '';
      badge.hidden = !sb;
      buildSpeeds();
      lb.setAttribute('data-open', 'true');
      document.body.style.overflow = 'hidden';
      setRate(native); /* open at the baked speed so the pressed button matches the badge */
      lv.play().catch(function () {});
      document.getElementById('lb-close').focus();
    }
    function close() {
      lb.setAttribute('data-open', 'false');
      lv.pause(); lv.removeAttribute('src'); lv.load();
      document.body.style.overflow = '';
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    /* r is the real-world speed; the file itself is `native`× already */
    function setRate(r) {
      lv.playbackRate = Math.max(0.25, r / native);
      speeds.querySelectorAll('button').forEach(function (b) {
        b.setAttribute('aria-pressed', parseFloat(b.getAttribute('data-real')) === r ? 'true' : 'false');
      });
    }

    document.querySelectorAll('[data-player]').forEach(function (p) {
      var btn = p.querySelector('.player__expand');
      if (!btn) return;
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var v = p.querySelector('video:not([hidden])') || p.querySelector('video');
        if (!v) return;
        open(v.currentSrc || v.src, v.getAttribute('poster'), p.getAttribute('data-caption'), p);
      });
    });

    /* the cinematic stage video expands too */
    var se = document.getElementById('stage-expand');
    var sv = document.querySelector('.stage__video');
    if (se && sv) {
      se.addEventListener('click', function () {
        open(sv.currentSrc || sv.src, sv.getAttribute('poster'),
          'Flex-π on a stationary bimanual YAM workcell. Placeholder footage — see the note in the footer.',
          sv.closest('.stage'));
      });
    }

    /* buttons are rebuilt per clip — delegate */
    speeds.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (b) setRate(parseFloat(b.getAttribute('data-real')));
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
  /* Two things key off "has the reader left the hero yet": the rail, which is
     fixed and would otherwise sit on top of the full-bleed video, and the top
     bar's condensed title, which is redundant while the real title is on
     screen. One observer, both consumers. The sentinel is the paper title:
     both stay hidden until it has scrolled off the top of the viewport, so
     the rail never overlaps the video or the masthead. */
  function initRail() {
    var targets = [document.querySelector('.rail'), document.querySelector('.nav')]
      .filter(Boolean);
    var title = document.querySelector('.hero__title') || document.querySelector('.stage');
    if (!targets.length) return;
    function set(v) { targets.forEach(function (t) { t.setAttribute('data-over-hero', v); }); }
    if (!title || !('IntersectionObserver' in window)) { set('false'); return; }
    new IntersectionObserver(function (es) {
      var e = es[0];
      /* "past the hero" means the title left through the TOP -- if it is
         merely below the fold (reader still on the video), stay hidden */
      var past = !e.isIntersecting && e.boundingClientRect.bottom <= 0;
      set(past ? 'false' : 'true');
    }, { threshold: 0 }).observe(title);
  }

  function initNav() {
    /* Two navigations point at the same sections -- the top bar below 1400px
       and the left rail above it -- so an id maps to a LIST of links, not one. */
    var links = Array.prototype.slice.call(
      document.querySelectorAll('.nav__links a[href^="#"], .rail__links a[href^="#"]'));
    var map = {};
    links.forEach(function (a) {
      var id = a.getAttribute('href').slice(1);
      if (!document.getElementById(id)) return;
      (map[id] = map[id] || []).push(a);
    });
    var ids = Object.keys(map);
    if (!ids.length || !('IntersectionObserver' in window)) return;

    /* Part dividers are only a few pixels tall, so they would never win on
       visible area. Light the part up from whichever section is current. */
    var partOf = {};
    links.forEach(function (a) {
      var p = a.getAttribute('data-part');
      if (p) partOf[a.getAttribute('href').slice(1)] = p;
    });

    var visible = {};
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { visible[e.target.id] = e.isIntersecting ? e.intersectionRatio : 0; });
      var best = null, bv = 0;
      ids.forEach(function (id) { if ((visible[id] || 0) > bv) { bv = visible[id]; best = id; } });
      links.forEach(function (a) { a.removeAttribute('aria-current'); a.removeAttribute('data-in'); });
      if (!best) return;
      map[best].forEach(function (a) { a.setAttribute('aria-current', 'true'); });
      var part = partOf[best];
      if (part && map[part]) {
        map[part].forEach(function (a) {
          if (!a.hasAttribute('aria-current')) a.setAttribute('data-in', 'true');
        });
      }
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
     dynamic architecture: mask state and regimes. The three stream clips are
     plain looping videos in the triptych above — no JS switching involved.
     --------------------------------------------------------------------- */
  /* --- narrow, always-on action readout: real 14-DoF traces from one episode --- */
  function buildActionStrip(host) {
    var W = 108, H = 320, padT = 26, padB = 20, padL = 5, padR = 5;
    var plotW = W - padL - padR, plotH = H - padT - padB;

    /* the source render is 580×2380 with its own title block; map only the
       trace region below the title onto the plot area, and redraw the labels
       as SVG text so they stay crisp at strip size */
    var SRC = 'assets/figures/fig-action_14dof_ep349.png';
    var IMG_W = 580, IMG_H = 2380, CROP_TOP = 100, SEP_Y = 1237;
    var s = plotH / (IMG_H - CROP_TOP);
    var mx = function (xi) { return padL + xi / IMG_W * plotW; };
    var my = function (yi) { return padT + (yi - CROP_TOP) * s; };

    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'none',
                          role: 'img', 'aria-label': host.getAttribute('aria-label') || 'action chunk' });
    var defs = el('defs', {});
    var clip = el('clipPath', { id: 'ac-clip' });
    clip.appendChild(el('rect', { x: padL, y: padT, width: plotW, height: plotH }));
    defs.appendChild(clip);
    svg.appendChild(defs);

    svg.appendChild(el('text', { 'class': 'ac-lab', x: padL, y: 13 }, 'action'));
    svg.appendChild(el('text', { 'class': 'ac-lab--dim', x: padL, y: 22, style: 'font-size:8px' }, '14 DoF (joints + gripper)'));
    svg.appendChild(el('text', { 'class': 'ac-lab--dim', x: padL, y: H - 7 }, 'always on'));

    svg.appendChild(el('image', { href: SRC, x: padL, y: padT - CROP_TOP * s,
                                  width: plotW, height: IMG_H * s,
                                  preserveAspectRatio: 'none', 'clip-path': 'url(#ac-clip)' }));

    /* mask the render's own tiny arm labels (illegible at strip size) with its
       background colour, then redraw them as crisp text over the divider */
    [1186, 1245].forEach(function (yi) {
      svg.appendChild(el('rect', { x: mx(528), y: my(yi), width: mx(562) - mx(528),
                                   height: 38 * s, fill: '#0b0b0d' }));
    });
    var sy = my(SEP_Y);
    svg.appendChild(el('text', { 'class': 'ac-lab--dim', x: W - padR, y: sy - 3, 'text-anchor': 'end' }, 'L'));
    svg.appendChild(el('text', { 'class': 'ac-lab--dim', x: W - padR, y: sy + 9, 'text-anchor': 'end' }, 'R'));

    var head = el('g', { transform: 'translate(' + padL + ',0)' });
    head.appendChild(el('line', { 'class': 'ac-head', x1: 0, y1: padT - 4, x2: 0, y2: padT + plotH + 3 }));
    svg.appendChild(head);

    host.innerHTML = '';
    host.appendChild(svg);

    /* sync the playhead to the stream clips: one sweep = one loop of the
       triptych. The RGB clip is the master; the other two are nudged back
       into lockstep whenever they drift, so all four panels read as one
       synchronized episode. */
    var vids = Array.prototype.slice.call(document.querySelectorAll('.streamrow video'));
    var master = vids[0];
    if (master) {
      (function tick() {
        var d = master.duration;
        if (d && isFinite(d) && d > 0) {
          var x = padL + (master.currentTime / d) * plotW;
          head.setAttribute('transform', 'translate(' + x + ',0)');
          for (var i = 1; i < vids.length; i++) {
            var v = vids[i];
            if (v.paused || v.seeking || !v.duration) continue;
            var drift = Math.abs(v.currentTime - master.currentTime);
            /* modular distance, so the moment one clip wraps around the
               loop boundary does not read as a huge drift */
            if (drift > 0.3 && Math.abs(drift - d) > 0.3) v.currentTime = master.currentTime;
          }
        }
        requestAnimationFrame(tick);
      })();
    } else {
      head.appendChild(el('animateTransform', { attributeName: 'transform', type: 'translate',
        from: padL + ',0', to: (padL + plotW) + ',0', dur: '4s', repeatCount: 'indefinite' }));
    }
  }

  function initArchviz() {
    var root = document.getElementById('archviz');
    if (!root) return;
    var rnote = document.getElementById('av-regime-note');
    var strip = document.getElementById('av-strip');

    if (strip) buildActionStrip(strip);

    /* --- mask state: any subset observed, any subset generated --------------
       The two masks are independent, exactly as in training, so cross-modality
       forcing is not a preset — it is whatever happens when a stream is
       generated without being observed. --------------------------------- */
    var SNAME = { rgb: 'RGB', dino: 'DINO', p3d: '3D' };
    var SKEYS = ['rgb', 'dino', 'p3d'];
    var mIn  = { rgb: true, dino: true, p3d: true };
    var mOut = { rgb: true, dino: true, p3d: true };

    var PRESETS = {
      joint:  { i: { rgb: 1, dino: 1, p3d: 1 }, o: { rgb: 1, dino: 1, p3d: 1 } },
      action: { i: { rgb: 1, dino: 1, p3d: 1 }, o: { rgb: 0, dino: 0, p3d: 0 } },
      p3d:    { i: { rgb: 1, dino: 1, p3d: 1 }, o: { rgb: 0, dino: 0, p3d: 1 } },
      xmod:   { i: { rgb: 1, dino: 1, p3d: 0 }, o: { rgb: 0, dino: 0, p3d: 1 } }
    };

    function describe() {
      var gen    = SKEYS.filter(function (k) { return mOut[k]; });
      var forced = SKEYS.filter(function (k) { return mOut[k] && !mIn[k]; });
      var obs    = SKEYS.filter(function (k) { return mIn[k]; });
      var name, note;

      if (!gen.length) {
        name = 'Action-only fast path';
        note = 'No future visual stream is read, so none is computed. This is the cheapest point on the ' +
               'frontier and recovers VLA-level latency.';
      } else if (gen.length === 3 && obs.length === 3) {
        name = 'Full joint generation';
        note = 'All three futures are co-denoised with the action, and the action expert reads every one of them. ' +
               'The most accurate — and the slowest — configuration.';
      } else {
        name = gen.map(function (k) { return SNAME[k]; }).join(' + ') + ' + action';
        note = 'One of many intermediate regimes. Only the ' +
               gen.map(function (k) { return SNAME[k]; }).join(' and ') +
               ' future' + (gen.length > 1 ? 's are' : ' is') + ' generated and read, so you pay for exactly the ' +
               'grounding you want.';
      }
      if (forced.length) {
        note += ' The ' + forced.map(function (k) { return SNAME[k]; }).join(' and ') + ' stream' +
                (forced.length > 1 ? 's are' : ' is') + ' never observed, yet ' +
                (forced.length > 1 ? 'their futures are' : 'its future is') +
                ' still generated from the streams that remain — the ★ marks it.';
      }
      return { name: name, note: note, forced: forced };
    }

    function paintMasks() {
      root.querySelectorAll('.maskbtn[data-mask]').forEach(function (b) {
        var set = b.getAttribute('data-mask') === 'in' ? mIn : mOut;
        b.setAttribute('aria-pressed', set[b.getAttribute('data-s')] ? 'true' : 'false');
      });
      root.querySelectorAll('.av-row').forEach(function (g) {
        g.setAttribute('data-on', mIn[g.getAttribute('data-s')] ? 'true' : 'false');
      });
      var d = describe();
      root.querySelectorAll('.av-out').forEach(function (g) {
        var o = g.getAttribute('data-o');
        g.setAttribute('data-on', (o === 'act' || mOut[o]) ? 'true' : 'false');
        g.classList.toggle('is-forced', d.forced.indexOf(o) > -1);
      });
      root.querySelectorAll('.regimechip[data-preset]').forEach(function (b) {
        var pr = PRESETS[b.getAttribute('data-preset')];
        var hit = pr && SKEYS.every(function (k) {
          return !!pr.i[k] === !!mIn[k] && !!pr.o[k] === !!mOut[k];
        });
        b.setAttribute('aria-pressed', hit ? 'true' : 'false');
      });
      var nEl = document.getElementById('av-regime-name');
      var fEl = document.getElementById('av-xmod-flag');
      var cEl = document.getElementById('av-combo');
      if (nEl) nEl.textContent = d.name;
      if (fEl) fEl.hidden = !d.forced.length;
      if (rnote) rnote.textContent = d.note;
      if (cEl) {
        /* index this configuration among the 7 x 8 = 56 valid ones */
        var i = SKEYS.reduce(function (a, k, n) { return a + (mIn[k] ? (1 << n) : 0); }, 0);
        var o = SKEYS.reduce(function (a, k, n) { return a + (mOut[k] ? (1 << n) : 0); }, 0);
        cEl.textContent = String((i - 1) * 8 + o + 1);
      }
    }

    root.querySelectorAll('.maskbtn[data-mask]').forEach(function (b) {
      b.addEventListener('click', function () {
        var which = b.getAttribute('data-mask'), k = b.getAttribute('data-s');
        var set = which === 'in' ? mIn : mOut;
        /* rejection sampling in the paper guarantees at least one visual input */
        if (which === 'in' && set[k] && SKEYS.filter(function (x) { return mIn[x]; }).length === 1) {
          b.classList.remove('is-refused');
          void b.offsetWidth;
          b.classList.add('is-refused');
          if (rnote) rnote.textContent = 'At least one visual input must be observed — the paper rejection-samples ' +
                                         'the input mask to guarantee it.';
          return;
        }
        set[k] = !set[k];
        paintMasks();
      });
    });

    root.querySelectorAll('.regimechip[data-preset]').forEach(function (b) {
      b.addEventListener('click', function () {
        var pr = PRESETS[b.getAttribute('data-preset')];
        if (!pr) return;
        SKEYS.forEach(function (k) { mIn[k] = !!pr.i[k]; mOut[k] = !!pr.o[k]; });
        paintMasks();
      });
    });

    var drawBtn = document.getElementById('av-draw');
    if (drawBtn) {
      drawBtn.addEventListener('click', function () {
        do { SKEYS.forEach(function (k) { mIn[k] = Math.random() < 0.5; }); }
        while (!SKEYS.some(function (k) { return mIn[k]; }));
        SKEYS.forEach(function (k) { mOut[k] = Math.random() < 0.5; });
        paintMasks();
      });
    }

    if (reduceMotion) {
      var svg = document.getElementById('av-svg');
      if (svg && svg.pauseAnimations) svg.pauseAnimations();
    }

    paintMasks();
  }

  /* ---------------------------------------------------------------------
     juxtapose slider (Figure 3): wipe between two pixel-aligned layers.
     Pointer drags anywhere on the image; arrow keys move it when focused.
     --------------------------------------------------------------------- */
  function initJuxta() {
    document.querySelectorAll('[data-juxta]').forEach(function (j) {
      function set(pct) {
        pct = Math.max(0, Math.min(100, pct));
        j.style.setProperty('--x', pct + '%');
        j.setAttribute('aria-valuenow', String(Math.round(pct)));
      }
      function fromX(clientX) {
        var r = j.getBoundingClientRect();
        set((clientX - r.left) / r.width * 100);
      }
      j.addEventListener('pointerdown', function (e) {
        j.setPointerCapture(e.pointerId);
        fromX(e.clientX);
      });
      j.addEventListener('pointermove', function (e) {
        if (e.buttons) fromX(e.clientX);
      });
      j.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowLeft' ? -4 : e.key === 'ArrowRight' ? 4 : 0;
        if (!d) return;
        e.preventDefault();
        set((parseFloat(j.style.getPropertyValue('--x')) || 50) + d);
      });
    });
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
    initFrontierRace();
    initExplorer();
    initMaskDemo();
    initVideos();
    initArchviz();
    initJuxta();
    initLightbox();
    initNav();
    initRail();
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
