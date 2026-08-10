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
    var padL = cfg.padL != null ? cfg.padL : (cfg.yLabel ? 58 : 46);
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
     paired bar chart: one light "before" bar and one solid "after" bar per
     method, with the drop between them written above the pair. Used for
     in-distribution vs out-of-distribution and full vs half data, following
     the paper's real_robot_gen figure.
     --------------------------------------------------------------------- */
  function pairedChart(mount, cfg) {
    var W = 1000, padL = 46, padR = 14, padT = 34;
    var padB = cfg.padB != null ? cfg.padB : 46;
    var plotH = cfg.plotH != null ? cfg.plotH : 240;
    var H = padT + plotH + padB;
    var groups = cfg.groups, series = cfg.series, nS = series.length;
    var hi = cfg.max != null ? cfg.max : 100;

    var svg = el('svg', {
      'class': 'chart', viewBox: '0 0 ' + W + ' ' + H,
      preserveAspectRatio: 'xMidYMid meet', role: 'img',
      'aria-label': cfg.ariaLabel || 'paired bar chart'
    });
    var plotW = W - padL - padR;
    function y(v) { return padT + plotH - (v / hi) * plotH; }

    (cfg.yTicks || [0, 20, 40, 60, 80, 100]).forEach(function (t) {
      svg.appendChild(el('line', { 'class': 'grid', x1: padL, x2: W - padR, y1: y(t), y2: y(t) }));
      svg.appendChild(el('text', { 'class': 'tick', x: padL - 9, y: y(t) + 3.5, 'text-anchor': 'end' }, t + '%'));
    });
    svg.appendChild(el('line', { 'class': 'axis', x1: padL, x2: W - padR, y1: y(0), y2: y(0) }));

    var gW = plotW / groups.length;
    var bandW = gW * (cfg.bandFrac != null ? cfg.bandFrac : 0.84);
    var cellW = bandW / nS;                 /* one method = two bars */
    var barW = Math.min(cellW * 0.42, cfg.maxBarW || 26);

    groups.forEach(function (g, gi) {
      var gx = padL + gi * gW + (gW - bandW) / 2;
      series.forEach(function (s, si) {
        var a = g.a[si], b = g.b[si];
        if (a === null || a === undefined) return;
        var cx = gx + si * cellW + cellW / 2;
        var xa = cx - barW - 1, xb = cx + 1;

        /* reference bar: same hue, washed out */
        var ra = el('rect', { 'class': 'bar', x: xa, y: y(a), width: barW,
          height: Math.max(1, y(0) - y(a)), fill: s.color, opacity: .34, rx: 1.5 });
        ra.appendChild(el('title', {}, s.name + ' — ' + (g.label || '') + ', ' + cfg.aName + ': ' + a + '%'));
        svg.appendChild(ra);

        var rb = el('rect', { 'class': 'bar', x: xb, y: y(b), width: barW,
          height: Math.max(1, y(0) - y(b)), fill: s.color, rx: 1.5 });
        rb.appendChild(el('title', {}, s.name + ' — ' + (g.label || '') + ', ' + cfg.bName + ': ' + b + '%'));
        svg.appendChild(rb);

        /* the reference level carried across, so the drop is visible */
        svg.appendChild(el('line', { x1: xa, x2: xb + barW, y1: y(a), y2: y(a),
          stroke: 'var(--fg-faint)', 'stroke-width': 1, 'stroke-dasharray': '2 3', opacity: .7 }));

        var d = Math.round((b - a) * 10) / 10;
        svg.appendChild(el('text', {
          'class': 'vlab' + (s.hi ? ' vlab--hi' : ''), x: cx, y: y(Math.max(a, b)) - 8,
          'text-anchor': 'middle'
        }, (d > 0 ? '+' : d === 0 ? '±' : '−') + Math.abs(d)));
      });

      String(g.label || '').split('|').forEach(function (ln, li) {
        svg.appendChild(el('text', { 'class': 'glab', x: padL + gi * gW + gW / 2,
          y: padT + plotH + 22 + li * 15, 'text-anchor': 'middle' }, ln.trim()));
      });
    });

    if (cfg.yLabel) {
      svg.appendChild(el('text', { 'class': 'alab', x: 0, y: 0, 'text-anchor': 'middle',
        transform: 'translate(13,' + (padT + plotH / 2) + ') rotate(-90)' }, cfg.yLabel));
    }

    mount.innerHTML = '';
    mount.appendChild(svg);

    if (cfg.legendEl) {
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
        [[cfg.aName, .34], [cfg.bName, 1]].forEach(function (p) {
          var span = document.createElement('span');
          span.className = 'legend__item legend__item--pair';
          var sw = document.createElement('span');
          sw.className = 'legend__sw';
          sw.style.background = 'var(--fg-dim)';
          sw.style.opacity = p[1];
          span.appendChild(sw);
          span.appendChild(document.createTextNode(p[0]));
          lg.appendChild(span);
        });
      }
    }
  }

  /* ---------------------------------------------------------------------
     pareto (latency vs success) scatter + line
     --------------------------------------------------------------------- */
  var paretoPts = [];
  var paretoPlayed = false;
  function paretoChart(mount) {
    var W = 1000, padL = 54, padR = 92, padT = 26, padB = 54, plotH = 300;
    var H = padT + plotH + padB;
    var xMin = 40, xMax = 430, yMin = 0, yMax = 75;

    var green = css('--c-ours') || '#57c98b';
    var amber = css('--c-base2') || '#e0b04a';

    var svg = el('svg', {
      'class': 'chart chart--pareto', viewBox: '0 0 ' + W + ' ' + H,
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

    /* Fast-WAM dashed baseline — one group so it can fade in as a unit */
    var fw = [[90, 10.0, 'compiled'], [345, 10.0, 'as released']];
    var fwG = el('g', { 'class': 'panim', style: '--ad:1.55s' });
    fwG.appendChild(el('line', {
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
      fwG.appendChild(g);
    });
    fwG.appendChild(el('text', { 'class': 'ptlab', x: X(90), y: Y(10) - 14, 'text-anchor': 'middle',
      fill: amber }, 'Fast-WAM'));
    fwG.appendChild(el('text', { 'class': 'ptlab', x: X(345), y: Y(10) + 22, 'text-anchor': 'middle',
      fill: amber }, 'as released'));
    svg.appendChild(fwG);

    /* Flex-π ladder */
    var pts = [
      { x: 68,  y: 41.6, name: 'Action',      dx: 6,  dy: 22 },
      { x: 139, y: 60.0, name: '+ Video',     dx: 8,  dy: 22 },
      { x: 280, y: 62.0, name: '+ DINO',      dx: 0,  dy: 24 },
      { x: 398, y: 66.8, name: '+ Pointmap',  dx: -6, dy: -18 }
    ];
    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + X(p.x) + ' ' + Y(p.y); }).join(' ');
    svg.appendChild(el('path', { 'class': 'pline', d: d, pathLength: 1, fill: 'none',
      stroke: green, 'stroke-width': 2.5,
      'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));

    /* stagger each point to the moment the drawing line reaches it */
    var xSpan = X(pts[pts.length - 1].x) - X(pts[0].x);
    function delayAt(p) {
      return (0.15 + 1.15 * (X(p.x) - X(pts[0].x)) / xSpan).toFixed(2) + 's';
    }

    paretoPts = [];
    pts.forEach(function (p, i) {
      var g = el('g', { 'class': 'pareto__pt panim', 'data-i': i, style: '--ad:' + delayAt(p) });
      g.appendChild(el('circle', { 'class': 'pareto__halo', cx: X(p.x), cy: Y(p.y), r: 12 }));
      g.appendChild(el('circle', { cx: X(p.x), cy: Y(p.y), r: 16, fill: 'transparent' }));
      g.appendChild(el('circle', { 'class': 'pareto__ring', cx: X(p.x), cy: Y(p.y), r: 5.5, fill: green }));
      g.appendChild(el('title', {}, p.name + ': ' + p.y + '% at ' + p.x + ' ms'));
      svg.appendChild(g);
      svg.appendChild(el('text', {
        'class': 'ptlab panim', style: '--ad:' + delayAt(p),
        x: X(p.x) + p.dx, y: Y(p.y) + p.dy,
        'text-anchor': i === 3 ? 'end' : 'start', fill: green
      }, p.name));
      paretoPts.push(g);
    });

    svg.appendChild(el('text', { 'class': 'ptlab panim', style: '--ad:0.05s',
      x: padL + 12, y: Y(71),
      'text-anchor': 'start', fill: green, 'font-size': '13' }, 'Flex-π'));

    mount.innerHTML = '';
    mount.appendChild(svg);

    /* entrance animation: draw the line, pop the points, then fade the
       baseline in. Plays once, on first scroll into view. */
    if (!reduceMotion && !paretoPlayed && 'IntersectionObserver' in window) {
      svg.setAttribute('data-anim', 'wait');
      var io = new IntersectionObserver(function (es) {
        if (!es[0].isIntersecting) return;
        io.disconnect();
        paretoPlayed = true;
        requestAnimationFrame(function () { svg.setAttribute('data-anim', 'in'); });
      }, { threshold: 0.4 });
      io.observe(svg);
    }
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
          { name: 'Flex-π (action-only)', label: 'Flex-π (action-only)', color: C.oursL },
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

    /* real-robot in-distribution — five tasks + the unweighted average.
       Source: real_world_eval/flex_pi_final_results.json (normalized_score).
       Fast-WAM was only run on three tasks; its average covers those three. */
    if ((m = find('real'))) {
      barChart(m, {
        series: [
          { name: 'π0.5', label: 'π₀.₅', color: C.base },
          { name: 'ManiFlow', label: 'ManiFlow', color: C.base3 },
          { name: 'Fast-WAM', label: 'Fast-WAM', color: C.base2 },
          { name: 'Flex-π (action-only)', label: 'Flex-π (action-only)', color: C.oursL },
          { name: 'Flex-π (full joint)', label: 'Flex-π (full joint)', color: C.oursD }
        ],
        groups: [
          { label: 'Put Plate|on the Rack', values: [72.5, 75.8, 12.5, 84.2, 95.0] },
          { label: 'Sort|Utensils',         values: [45.0, 55.0, 5.0, 70.0, 75.0] },
          { label: 'Kitchen|Organization',  values: [73.8, 93.8, 77.5, 96.2, 98.8] },
          { label: 'Self-Repair|Gripper',   values: [26.2, 33.3, null, 66.9, 76.0] },
          { label: 'Soft-Bag|Zipping',      values: [42.8, 31.9, null, 64.9, 70.0] },
          { label: 'Average',               values: [52.1, 58.0, 31.7, 76.4, 83.0] }
        ],
        max: 100, yTicks: [0, 20, 40, 60, 80, 100], plotH: 250, padB: 58,
        tickFmt: function (t) { return t + '%'; },
        valFmt: function (v) { return v % 1 === 0 ? String(v) : v.toFixed(1); },
        yLabel: 'Task completion (%)', legendEl: '#lg-real',
        ariaLabel: 'Across five real-robot tasks Flex-π full joint averages 83.0 percent task completion and ' +
          'action-only 76.4, against 58.0 for ManiFlow, 52.1 for π0.5 and 31.7 for Fast-WAM.'
      });
    }

    /* generalization: each task's in-distribution score paired with the
       held-out one. Put Plate on the Rack pools its two held-out conditions
       (unseen big plate, unseen distractors) into one out-of-distribution
       bar, as the paper's real_robot_gen figure does. */
    if ((m = find('gen'))) {
      pairedChart(m, {
        series: [
          { name: 'π0.5', label: 'π₀.₅', color: C.base },
          { name: 'ManiFlow', label: 'ManiFlow', color: C.base3 },
          { name: 'Fast-WAM', label: 'Fast-WAM', color: C.base2 },
          { name: 'Flex-π (action-only)', label: 'Flex-π (action-only)', color: C.oursL },
          { name: 'Flex-π (full joint)', label: 'Flex-π (full joint)', color: C.oursD, hi: true }
        ],
        groups: [
          { label: 'Put Plate on the Rack',
            a: [80.0, 87.5, 37.5, 90.0, 97.5], b: [72.5, 55.0, 33.8, 85.0, 95.0] },
          { label: 'Sort Utensils',
            a: [45.0, 55.0, 5.0, 70.0, 75.0],  b: [40.0, 32.5, 0.0, 70.0, 70.0] },
          { label: 'Soft-Bag Zipping',
            a: [42.8, 31.9, null, 64.9, 70.0], b: [17.2, 6.9, null, 57.5, 63.3] }
        ],
        aName: 'in-distribution', bName: 'held-out',
        max: 100, yTicks: [0, 20, 40, 60, 80, 100], plotH: 250,
        yLabel: 'Task completion (%)', legendEl: '#lg-gen',
        ariaLabel: 'Moving to held-out conditions, Flex-π full joint loses 2.5, 5 and 6.7 points on the three ' +
          'tasks, while ManiFlow loses 32.5, 22.5 and 25 and π0.5 loses 7.5, 5 and 25.6.'
      });
    }

    /* self-repair gripper (20 rollouts per method) */
    if ((m = find('selfrepair'))) {
      barChart(m, {
        series: [
          { name: 'π0.5', label: 'π₀.₅', color: C.base },
          { name: 'ManiFlow', label: 'ManiFlow', color: C.base3 },
          { name: 'Flex-π (action-only)', label: 'Flex-π (action-only)', color: C.oursL },
          { name: 'Flex-π (full joint)', label: 'Flex-π (full joint)', color: C.oursD }
        ],
        groups: [
          { label: 'Task completion',   values: [26.2, 33.3, 66.9, 76.0] },
          { label: 'Full-task success', values: [0, 5, 45, 55] }
        ],
        max: 100, yTicks: [0, 20, 40, 60, 80, 100], plotH: 240,
        tickFmt: function (t) { return t + '%'; },
        valFmt: function (v) { return v % 1 === 0 ? String(v) : v.toFixed(1); },
        legendEl: '#lg-selfrepair',
        ariaLabel: 'On self-repair Flex-π full joint reaches 76.0 percent task completion and 55 percent ' +
          'full-task success, against 33.3 and 5 for ManiFlow and 26.2 and 0 for π0.5.'
      });
    }

    /* data efficiency: the same task trained on the full set and on half */
    if ((m = find('dataeff'))) {
      pairedChart(m, {
        series: [
          { name: 'π0.5', label: 'π₀.₅', color: C.base },
          { name: 'ManiFlow', label: 'ManiFlow', color: C.base3 },
          { name: 'Fast-WAM', label: 'Fast-WAM', color: C.base2 },
          { name: 'Flex-π (action-only)', label: 'Flex-π (action-only)', color: C.oursL },
          { name: 'Flex-π (full joint)', label: 'Flex-π (full joint)', color: C.oursD, hi: true }
        ],
        groups: [
          { label: 'Put Plate on the Rack, single plate',
            a: [80.0, 87.5, 37.5, 90.0, 97.5], b: [42.5, 60.0, 25.0, 80.0, 95.0] }
        ],
        aName: 'full data', bName: 'half data',
        max: 100, yTicks: [0, 20, 40, 60, 80, 100], plotH: 230, bandFrac: 0.62, maxBarW: 46,
        yLabel: 'Task completion (%)', legendEl: '#lg-dataeff',
        ariaLabel: 'Halving the demonstrations costs π0.5 37.5 points, ManiFlow 27.5, Fast-WAM 12.5, ' +
          'Flex-π action-only 10 and Flex-π full joint only 2.5.'
      });
    }

    /* real-robot latency (Figure 12, all at the deployed 4 denoise steps) */
    if ((m = find('latency'))) {
      barChart(m, {
        groups: [
          { label: 'π₀.₅|baseline', values: [66], colors: [C.base] },
          { label: 'ManiFlow|baseline', values: [103], colors: [C.base3] },
          { label: 'Fast-WAM|baseline', values: [86], colors: [C.base2] },
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
     the real-world frontier, inside the configurator card
     Task completion against single-inference latency, with the region that
     is both slower and less accurate than the fast path shaded. Compact,
     because it sits under the mask controls that steer it: setFrontierMode()
     is called from the configurator so the dot for the chosen output mask
     lights up. Static otherwise; hover a dot for its figures.
     Numbers: real_world_eval/flex_pi_final_results.json — the unweighted
     mean of the five in-distribution scores. Fast-WAM covers 3 of 5 tasks.
     --------------------------------------------------------------------- */
  var setFrontierMode = function () {};

  /* Measured on our own RTX 5090 at the deployed 4 denoise steps. Only the two
     modes we ship have been benchmarked end to end; the other six output masks
     are deployable but not yet timed or scored, and say so. */
  var REAL_MODE = {
    0: { lat: 60,  sr: 76.4,
         latNote: 'Faster than every baseline we compare against.',
         srNote: '+18.4 points over the strongest baseline.' },
    3: { lat: 193, sr: 83.0,
         latNote: '3.2× the action-only path.',
         srNote: 'The highest of every method we compare against.' }
  };

  function initFrontier() {
    var mount = document.getElementById('frontier');
    if (!mount) return;

    var M = [
      { key: 'pi',   name: 'π₀.₅',    lat: 66,  sr: 52.1, c: 'var(--c-base)',  dx: -13, dy: 3,   anchor: 'end' },
      { key: 'mf',   name: 'ManiFlow', lat: 103, sr: 58.0, c: 'var(--c-base3)', dx: 13,  dy: 3,   anchor: 'start' },
      { key: 'fw',   name: 'Fast-WAM', lat: 86,  sr: 31.7, c: 'var(--c-base2)', dx: 13,  dy: 3,   anchor: 'start', partial: true },
      { key: 'ao',   name: 'Flex-π (action-only)', short: 'Flex-π action-only', lat: 60,  sr: 76.4, c: 'var(--c-ours-l)', dx: -14, dy: -4,  anchor: 'end',   ours: true },
      { key: 'joint', name: 'Flex-π (full joint)', short: 'Flex-π full joint', lat: 193, sr: 83.0, c: 'var(--c-ours-d)', dx: -14, dy: -10, anchor: 'end',   ours: true }
    ];

    var W = 1000, padL = 54, padR = 26, padT = 18, plotH = 186, H = 258;
    var plotW = W - padL - padR;
    var xMin = 0, xMax = 215, yMin = 22, yMax = 92;
    function X(v) { return padL + (v - xMin) / (xMax - xMin) * plotW; }
    function Y(v) { return padT + plotH - (v - yMin) / (yMax - yMin) * plotH; }

    var svg = el('svg', {
      'class': 'chart', viewBox: '0 0 ' + W + ' ' + H,
      preserveAspectRatio: 'xMidYMid meet', role: 'img',
      'aria-label': 'Task completion against inference latency. Flex-π action-only reaches 76.4% at 60 ms, ' +
        'faster and more accurate than every baseline — ManiFlow 58.0% at 103 ms, π0.5 52.1% at 66 ms, ' +
        'Fast-WAM 31.7% at 86 ms. Flex-π full joint is highest at 83.0%, at 193 ms.'
    });

    var AXIS_Y = Y(yMin);
    [25, 50, 75].forEach(function (t) {
      svg.appendChild(el('line', { 'class': 'grid', x1: padL, x2: W - padR, y1: Y(t), y2: Y(t) }));
      svg.appendChild(el('text', { 'class': 'tick', x: padL - 8, y: Y(t) + 3.5, 'text-anchor': 'end' }, t + '%'));
    });
    svg.appendChild(el('line', { 'class': 'axis', x1: padL, x2: padL, y1: padT - 6, y2: AXIS_Y }));
    svg.appendChild(el('line', { 'class': 'axis', x1: padL, x2: W - padR, y1: AXIS_Y, y2: AXIS_Y }));
    [0, 50, 100, 150, 200].forEach(function (t) {
      svg.appendChild(el('line', { 'class': 'axis', x1: X(t), x2: X(t), y1: AXIS_Y, y2: AXIS_Y + 4 }));
      svg.appendChild(el('text', { 'class': 'tick', x: X(t), y: AXIS_Y + 16, 'text-anchor': 'middle' }, String(t)));
    });
    svg.appendChild(el('text', { 'class': 'alab', x: padL + plotW / 2, y: AXIS_Y + 34,
      'text-anchor': 'middle' }, 'inference latency (ms) → slower'));
    svg.appendChild(el('text', { 'class': 'alab', x: 0, y: 0, 'text-anchor': 'middle',
      transform: 'translate(13,' + (padT + plotH / 2) + ') rotate(-90)' }, 'task completion'));

    /* everything slower AND less accurate than the fast path */
    var AO = M[3];
    var dom = { x: X(AO.lat), y: Y(AO.sr), w: X(xMax) - X(AO.lat), h: (AXIS_Y - 4) - Y(AO.sr) };
    svg.appendChild(el('rect', { x: dom.x, y: dom.y, width: dom.w, height: dom.h, fill: 'var(--primary-soft)' }));
    svg.appendChild(el('line', { x1: dom.x, x2: dom.x, y1: dom.y, y2: dom.y + dom.h,
      stroke: 'var(--primary-ink)', 'stroke-width': 1, 'stroke-dasharray': '3 4', opacity: .45 }));
    svg.appendChild(el('line', { x1: dom.x, x2: dom.x + dom.w, y1: dom.y, y2: dom.y,
      stroke: 'var(--primary-ink)', 'stroke-width': 1, 'stroke-dasharray': '3 4', opacity: .45 }));

    var read = document.getElementById('fr-read');
    var dots = {};
    M.forEach(function (m) {
      var g = el('g', {});
      var ring = el('circle', { 'class': 'fr-ring', cx: X(m.lat), cy: Y(m.sr), r: 12, stroke: m.c });
      var dot = el('circle', { 'class': 'fr-dot', cx: X(m.lat), cy: Y(m.sr), r: m.ours ? 8 : 7, fill: m.c,
        stroke: 'var(--bg-raise)', 'stroke-width': 2 });
      /* the name stays on the plot; the figures wait for a hover */
      var lx = X(m.lat) + m.dx, ly = Y(m.sr) + m.dy;
      var lab = el('text', { 'class': 'dlab' + (m.ours ? ' dlab--hi' : ''), x: lx, y: ly,
        'text-anchor': m.anchor }, m.name);
      var val = el('text', { 'class': 'dval', x: lx, y: ly + 13, 'text-anchor': m.anchor, opacity: 0 },
        m.lat + ' ms · ' + m.sr.toFixed(1) + '%' + (m.partial ? '  (3 of 5 tasks)' : ''));
      var hit = el('circle', { cx: X(m.lat), cy: Y(m.sr), r: 22, fill: 'transparent', cursor: 'default' });
      hit.addEventListener('mouseenter', function () { val.setAttribute('opacity', 1); });
      hit.addEventListener('mouseleave', function () { val.setAttribute('opacity', 0); });
      hit.appendChild(el('title', {}, m.name + ' — ' + m.lat + ' ms, ' + m.sr.toFixed(1) + '%' +
        (m.partial ? ' (3 of 5 tasks)' : '')));
      g.appendChild(ring); g.appendChild(dot); g.appendChild(lab); g.appendChild(val); g.appendChild(hit);
      svg.appendChild(g);
      dots[m.key] = { m: m, dot: dot, ring: ring, lab: lab, val: val };
    });

    mount.appendChild(svg);

    var latEl = document.getElementById('av-lat');
    var srEl = document.getElementById('av-sr');
    var latNoteEl = document.getElementById('av-lat-note');
    var srNoteEl = document.getElementById('av-sr-note');
    function num(elm, v, unit) {
      if (!elm) return;
      elm.textContent = v === null ? '—' : v;
      if (v !== null) {
        var u = document.createElement('span');
        u.className = 'unit'; u.textContent = unit;
        elm.appendChild(u);
      }
    }

    /* the configurator calls this with the number of generated visual streams */
    setFrontierMode = function (nGen) {
      var lit = nGen === 0 ? 'ao' : nGen === 3 ? 'joint' : null;
      ['ao', 'joint'].forEach(function (k) {
        dots[k].dot.setAttribute('data-lit', lit === null ? '' : (k === lit ? 'on' : 'off'));
        dots[k].ring.setAttribute('data-lit', k === lit ? 'on' : '');
      });
      /* the ring already names the operating point; only the unmeasured
         middle ground needs saying in words */
      if (read) read.textContent = lit ? '' : 'Between the two — deployable, not separately measured';

      var r = REAL_MODE[nGen];
      num(latEl, r ? r.lat : null, 'ms');
      num(srEl,  r ? r.sr.toFixed(1) : null, '%');
      if (latNoteEl) latNoteEl.textContent = r ? r.latNote : 'Deployable, but not yet benchmarked on our hardware.';
      if (srNoteEl)  srNoteEl.textContent  = r ? r.srNote  : 'Not yet evaluated on the real-robot suite.';
    };
    setFrontierMode(3);
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
     seen / unseen switch  (#generalization)

     One switch per task block; the three blocks share no state. Everything
     inside a block carrying data-cond -- player, description, scoreboard --
     is shown for the selected condition and hidden otherwise. The hidden
     clip is paused so only one video per block is ever decoding.
     --------------------------------------------------------------------- */
  function initTaskSwitch() {
    document.querySelectorAll('[data-taskswitch]').forEach(function (block) {
      var btns = Array.prototype.slice.call(block.querySelectorAll('.seg__btn[data-cond]'));
      if (btns.length < 2) return;
      var panes = Array.prototype.slice.call(block.querySelectorAll('[data-cond]'))
        .filter(function (n) { return btns.indexOf(n) === -1; });

      var seg = block.querySelector('.seg');

      function show(cond) {
        if (seg) seg.setAttribute('data-active', cond); /* slides the thumb */
        btns.forEach(function (b) {
          b.setAttribute('aria-selected', b.getAttribute('data-cond') === cond ? 'true' : 'false');
        });
        panes.forEach(function (n) {
          var on = n.getAttribute('data-cond') === cond;
          n.hidden = !on;
          var v = n.tagName === 'VIDEO' ? n : n.querySelector('video');
          if (!v) return;
          /* the IntersectionObserver in initVideos() only fires on visibility
             changes it can see, so drive playback explicitly here */
          if (on) { v.play().catch(function () {}); } else { v.pause(); }
        });
      }

      btns.forEach(function (b, i) {
        b.addEventListener('click', function () { show(b.getAttribute('data-cond')); });
        b.addEventListener('keydown', function (e) {
          var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
          if (!d) return;
          e.preventDefault();
          var next = btns[(i + d + btns.length) % btns.length];
          next.focus();
          show(next.getAttribute('data-cond'));
        });
      });
    });
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
     predicted futures: the prediction row is hidden until asked for
     --------------------------------------------------------------------- */
  function initPredReveal() {
    var strip = document.getElementById('predstrip');
    var btn = document.getElementById('pred-toggle');
    var note = document.getElementById('pred-note');
    if (!strip || !btn) return;
    btn.addEventListener('click', function () {
      var hidden = strip.getAttribute('data-pred') === 'hidden';
      strip.setAttribute('data-pred', hidden ? 'shown' : 'hidden');
      btn.setAttribute('aria-expanded', hidden ? 'true' : 'false');
      var label = btn.lastChild;
      label.textContent = hidden ? ' Hide the predicted futures' : ' Reveal the predicted futures';
      if (note) note.hidden = hidden;
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
      /* light up the operating point this output mask corresponds to */
      setFrontierMode(SKEYS.filter(function (k) { return mOut[k]; }).length);
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
    });
  }

  /* ---------------------------------------------------------------------
     boot
     --------------------------------------------------------------------- */
  function boot() {
    initTheme();
    renderCharts();
    initFrontier();      /* before initArchviz: the masks drive its highlight */
    initMaskDemo();
    initVideos();
    initTaskSwitch();
    initArchviz();
    initJuxta();
    initPredReveal();
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
    rt = setTimeout(function () { renderCharts(); }, 260);
  });
})();
