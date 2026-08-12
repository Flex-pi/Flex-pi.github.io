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
     error bars
     The paper's real-robot figures draw the binomial standard error of the
     completion score, sqrt(p(1-p)/n), with p the score as a fraction and n the
     number of rollouts behind that bar. Verified against real_robot_main.pdf
     and real_robot_gen.pdf by measuring their whiskers. Bars whose rollout
     count is unknown get no whisker rather than a zero-length one.
     --------------------------------------------------------------------- */
  function seOf(v, n) {
    if (!n || v === null || v === undefined) return 0;
    var p = v / 100;
    return Math.sqrt(Math.max(0, p * (1 - p)) / n) * 100;
  }

  /* Draws the whisker and returns the half-width in data units (0 = none). */
  function errBar(svg, cx, v, n, barW, y, lo, hi) {
    var e = seOf(v, n);
    if (!e) return 0;
    var top = Math.min(hi, v + e), bot = Math.max(lo, v - e);
    var cap = Math.min(barW * 0.42, 7);
    var g = el('g', { 'class': 'ebar' });
    g.appendChild(el('line', { x1: cx, x2: cx, y1: y(bot), y2: y(top) }));
    [top, bot].forEach(function (t) {
      g.appendChild(el('line', { x1: cx - cap, x2: cx + cap, y1: y(t), y2: y(t) }));
    });
    g.appendChild(el('title', {}, '±' + e.toFixed(1) + ' points (binomial SE, n=' + n + ')'));
    svg.appendChild(g);
    return e;
  }

  /* Grow measured bars once when the chart first enters the viewport. The
     bars remain parallel comparisons; motion never connects methods or
     implies a causal sequence. Static values stay available in the SVG. */
  /* Stagger and durations, kept in step with .chart--barflow in style.css:
     the last bar starts at CAP*STEP and grows for .58s, the last annotation
     starts at .28 + CAP*STEP and fades for .34s. */
  var FLOW_STEP = 0.035, FLOW_CAP = 18;
  var FLOW_SETTLE_MS = Math.ceil(1000 * Math.max(
    FLOW_CAP * FLOW_STEP + 0.58,
    0.28 + FLOW_CAP * FLOW_STEP + 0.34
  )) + 120;

  function armBarFlow(mount, svg) {
    if (reduceMotion || !('IntersectionObserver' in window) || mount.getAttribute('data-bar-played') === 'true') return;

    var bars = Array.prototype.slice.call(svg.querySelectorAll('.bar'));
    if (!bars.length) return;
    svg.classList.add('chart--barflow');
    bars.forEach(function (bar, i) {
      bar.style.setProperty('--ad', (Math.min(i, FLOW_CAP) * FLOW_STEP).toFixed(3) + 's');
      /* A bar that carries its own opacity — the faded in-distribution half of
         a paired chart — has it as an SVG presentation attribute, which any CSS
         declaration outranks. Hand the value to the stylesheet so the entrance
         settles on it instead of flattening it to 1. */
      var o = bar.getAttribute('opacity');
      if (o !== null) bar.style.setProperty('--bar-o', o);
    });
    Array.prototype.slice.call(svg.querySelectorAll('.ebar, .vlab')).forEach(function (mark, i) {
      mark.style.setProperty('--ad', (0.28 + Math.min(i, FLOW_CAP) * FLOW_STEP).toFixed(3) + 's');
    });

    svg.setAttribute('data-anim', 'wait');
    var io = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      mount.setAttribute('data-bar-played', 'true');
      requestAnimationFrame(function () {
        svg.setAttribute('data-anim', 'in');
        /* Then give the marks back to their own attributes. The entrance rules
           set opacity on every .bar, .ebar and .vlab, and they never stopped
           applying: the faded halves of the paired charts stayed opaque for the
           rest of the session, and only came right if a theme toggle re-rendered
           the chart without the animation. */
        setTimeout(function () {
          svg.removeAttribute('data-anim');
          svg.classList.remove('chart--barflow');
        }, FLOW_SETTLE_MS);
      });
    }, { threshold: 0.28 });
    io.observe(svg);
  }

  /* ---------------------------------------------------------------------
     grouped / single-series bar chart
     --------------------------------------------------------------------- */
  function barChart(mount, cfg) {
    var W = 1000;
    var padL = cfg.padL != null ? cfg.padL : (cfg.yLabel ? 58 : 46);
    var padR = 14;
    var padT = cfg.padT != null ? cfg.padT : 30;
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
    var barW = Math.min(gW * innerFrac / nS, cfg.maxBarW || Infinity);
    var bandW = barW * nS;

    groups.forEach(function (g, gi) {
      var gx = padL + gi * gW + (gW - bandW) / 2;

      (g.values || []).forEach(function (v, si) {
        if (v === null || v === undefined) return;
        var color = g.colors ? g.colors[si] : series[si].color;
        var x = gx + si * barW;
        var top = Math.min(y(v), yBase);
        var h = Math.abs(y(v) - yBase);
        var inset = nS === 1 ? 0 : 2;
        var cx = x + (barW - inset) / 2 + inset / 2;

        var r = el('rect', {
          'class': 'bar', x: x + inset / 2, y: top,
          width: Math.max(1, barW - inset), height: Math.max(1, h),
          fill: color, rx: 1.5
        });
        r.appendChild(el('title', {}, (series[si].name ? series[si].name + ' — ' : '') +
          (g.label || '') + ': ' + (cfg.valFmt ? cfg.valFmt(v) : v)));
        svg.appendChild(r);

        var e = errBar(svg, cx, v, g.n && g.n[si], barW - inset, y, lo, hi);

        /* value label, clearing the error bar when there is one. Dense charts
           set vlabRotate and stand the labels on end, as the paper's own
           real-robot figure does, so neighbouring labels cannot collide. */
        var isOurs = /Flex/i.test(series[si].name || '') || (g.hi && g.hi[si]);
        var labY = v >= 0 ? Math.min(top, y(Math.min(hi, v + e))) - 7 : top + h + 13;
        var lab = el('text', {
          'class': 'vlab' + (isOurs ? ' vlab--hi' : ''),
          x: cfg.vlabRotate ? 0 : cx, y: cfg.vlabRotate ? 0 : labY,
          'text-anchor': cfg.vlabRotate ? 'start' : 'middle',
          'dominant-baseline': cfg.vlabRotate ? 'central' : null,
          transform: cfg.vlabRotate
            ? 'translate(' + cx + ',' + (labY + 3) + ') rotate(-90)' : null
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
    armBarFlow(mount, svg);

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

  /* Legend items: { label, color, dot: round swatch, hollow: outline only }.
     Shared by the charts whose marks are not plain filled rectangles. */
  function buildLegend(sel, items) {
    if (!sel) return;
    var lg = document.querySelector(sel);
    if (!lg) return;
    lg.innerHTML = '';
    (items || []).forEach(function (s) {
      var span = document.createElement('span');
      span.className = 'legend__item';
      var sw = document.createElement('span');
      sw.className = 'legend__sw' + (s.dot ? ' legend__sw--dot' : '');
      if (s.hollow) {
        sw.style.background = 'var(--bg-raise)';
        sw.style.boxShadow = 'inset 0 0 0 2.5px ' + s.color;
      } else {
        sw.style.background = s.color;
      }
      span.appendChild(sw);
      span.appendChild(document.createTextNode(s.label));
      lg.appendChild(span);
    });
  }

  /* ---------------------------------------------------------------------
     dumbbell chart: one row per task, the strongest baseline on that task
     against Flex-π's two deployment modes.

     A grouped bar chart of the same numbers spends 28 bars to say what the
     distance between two dots says on its own, and it draws "Fast-WAM was
     never run here" exactly like "Fast-WAM scored zero". Collapsing the
     baselines to whichever was strongest on each task avoids both, and
     makes the claim — every task, not just the average — the shape of the
     figure rather than something to verify bar by bar.
     --------------------------------------------------------------------- */
  function dumbbellChart(mount, cfg) {
    var W = 1000;
    var padL = cfg.padL != null ? cfg.padL : 178;
    var padR = 96;                     /* room for the end value and the delta */
    var padT = 26;
    var padB = 40;
    var rowH = cfg.rowH != null ? cfg.rowH : 48;
    var rows = cfg.rows;
    var hi = cfg.max != null ? cfg.max : 100;
    var plotH = rows.length * rowH;
    var H = padT + plotH + padB;
    var plotW = W - padL - padR;

    function X(v) { return padL + (v / hi) * plotW; }

    var svg = el('svg', {
      'class': 'chart', viewBox: '0 0 ' + W + ' ' + H,
      preserveAspectRatio: 'xMidYMid meet', role: 'img',
      'aria-label': cfg.ariaLabel || 'per-task comparison against the strongest baseline'
    });

    (cfg.xTicks || []).forEach(function (t) {
      var x = X(t);
      svg.appendChild(el('line', { 'class': 'grid', x1: x, x2: x, y1: padT, y2: padT + plotH }));
      svg.appendChild(el('text', {
        'class': 'tick', x: x, y: padT + plotH + 18, 'text-anchor': 'middle'
      }, t + '%'));
    });
    svg.appendChild(el('line', {
      'class': 'axis', x1: padL, x2: W - padR, y1: padT + plotH, y2: padT + plotH
    }));

    rows.forEach(function (r, i) {
      var cy = padT + i * rowH + rowH / 2;

      /* strongest baseline on this task, and which method that was */
      var bName = null, bVal = -Infinity;
      Object.keys(r.baselines).forEach(function (k) {
        var v = r.baselines[k];
        if (v !== null && v !== undefined && v > bVal) { bVal = v; bName = k; }
      });

      svg.appendChild(el('text', {
        'class': 'dlab dlab--hi', x: padL - 18, y: cy + 4.5, 'text-anchor': 'end'
      }, r.label));

      svg.appendChild(el('line', {
        'class': 'db-run', x1: X(bVal), x2: X(r.joint), y1: cy, y2: cy
      }));

      function dot(v, cls, rad, title) {
        var c = el('circle', { 'class': 'db-dot ' + cls, cx: X(v), cy: cy, r: rad });
        c.appendChild(el('title', {}, title));
        svg.appendChild(c);
      }
      dot(bVal, 'db-dot--base', 5.5,
        'Strongest baseline on ' + r.label + ' — ' + bName + ', ' + bVal.toFixed(1) + '%');
      dot(r.actionOnly, 'db-dot--fast', 5,
        'Flex-π (action-only) — ' + r.actionOnly.toFixed(1) + '%');
      dot(r.joint, 'db-dot--joint', 6.5,
        'Flex-π (full joint) — ' + r.joint.toFixed(1) + '%');

      /* name the baseline on its own dot — which method is strongest changes
         from task to task, and a legend cannot say that. One right-aligned
         text so the two parts stay set without measuring glyph widths. */
      var who = el('text', { x: X(bVal) - 12, y: cy + 4, 'text-anchor': 'end' });
      who.appendChild(el('tspan', { 'class': 'db-who' }, bName));
      who.appendChild(el('tspan', { 'class': 'vlab', dx: 6 }, bVal.toFixed(1)));
      svg.appendChild(who);
      svg.appendChild(el('text', {
        'class': 'vlab vlab--hi', x: X(r.joint) + 13, y: cy + 4
      }, r.joint.toFixed(1)));
      svg.appendChild(el('text', {
        'class': 'db-delta', x: W - 6, y: cy + 4, 'text-anchor': 'end'
      }, '+' + (r.joint - bVal).toFixed(1)));
    });

    mount.innerHTML = '';
    mount.appendChild(svg);

    buildLegend(cfg.legendEl, cfg.legend);
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

        var ea = errBar(svg, xa + barW / 2, a, g.aN && g.aN[si], barW, y, 0, hi);
        var eb = errBar(svg, xb + barW / 2, b, g.bN && g.bN[si], barW, y, 0, hi);

        var d = Math.round((b - a) * 10) / 10;
        var lift = Math.max(Math.min(hi, a + ea), Math.min(hi, b + eb));
        svg.appendChild(el('text', {
          'class': 'vlab' + (s.hi ? ' vlab--hi' : ''), x: cx, y: y(lift) - 8,
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
    armBarFlow(mount, svg);

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
     benchmark summary: one row per method, one panel per benchmark
     Rows rather than columns because seven method names have to stay legible,
     and three panels side by side because the benchmarks do not share a story
     — only the 0-100 scale. A cell with no published number draws an em dash
     where its bar would start, so the row stays readable as a row.
     --------------------------------------------------------------------- */
  function benchChart(mount, cfg) {
    var W = 1000, padL = 190, padR = 10, padT = 46, padB = 16;
    var ROW = 27, GRP = 30, BAR = 13, GAP = 44;

    var rows = [];                      /* flattened, group headers included */
    cfg.groups.forEach(function (g) {
      rows.push({ header: g.label });
      g.rows.forEach(function (r) { rows.push(r); });
    });
    var H = padT + rows.reduce(function (a, r) { return a + (r.header ? GRP : ROW); }, 0) + padB;

    var svg = el('svg', {
      'class': 'chart', viewBox: '0 0 ' + W + ' ' + H,
      preserveAspectRatio: 'xMidYMid meet', role: 'img',
      'aria-label': cfg.ariaLabel || 'benchmark summary'
    });

    var nP = cfg.panels.length;
    var panelW = (W - padL - padR - GAP * (nP - 1)) / nP;
    function px(pi, v) { return padL + pi * (panelW + GAP) + (v / 100) * panelW; }

    cfg.panels.forEach(function (p, pi) {
      var x0 = px(pi, 0);
      svg.appendChild(el('text', { 'class': 'glab', x: x0, y: padT - 26 }, p.title));
      svg.appendChild(el('text', { 'class': 'tick', x: x0, y: padT - 12 }, p.note));
      [0, 50, 100].forEach(function (t) {
        svg.appendChild(el('line', { 'class': 'grid', x1: px(pi, t), x2: px(pi, t),
          y1: padT - 4, y2: H - padB }));
        svg.appendChild(el('text', { 'class': 'tick', x: px(pi, t), y: H - padB + 12,
          'text-anchor': t === 0 ? 'start' : t === 100 ? 'end' : 'middle' }, t + '%'));
      });
      svg.appendChild(el('line', { 'class': 'axis', x1: x0, x2: x0, y1: padT - 4, y2: H - padB }));
    });

    var y = padT;
    rows.forEach(function (r) {
      if (r.header) {
        /* right-aligned in the label gutter so it cannot run into the panels */
        svg.appendChild(el('text', { 'class': 'benchgrp', x: padL - 12, y: y + GRP - 11,
          'text-anchor': 'end' }, r.header));
        y += GRP;
        return;
      }
      var cy = y + ROW / 2;
      svg.appendChild(el('text', {
        'class': 'benchlab' + (r.ours ? ' benchlab--hi' : ''),
        x: padL - 12, y: cy + 4, 'text-anchor': 'end'
      }, r.name));

      cfg.panels.forEach(function (p, pi) {
        var v = r[p.key];
        if (v === null || v === undefined) {
          svg.appendChild(el('text', { 'class': 'tick', x: px(pi, 0) + 7, y: cy + 4 }, '—'));
          return;
        }
        var fill = r.ours ? (r.ours === 'd' ? 'var(--c-ours-d)' : 'var(--c-ours-l)') : 'var(--c-base)';
        var bar = el('rect', { 'class': 'bar', x: px(pi, 0), y: cy - BAR / 2,
          width: Math.max(1, px(pi, v) - px(pi, 0)), height: BAR, fill: fill, rx: 1.5 });
        bar.appendChild(el('title', {}, r.name + ' — ' + p.title + ': ' + v + '%'));
        svg.appendChild(bar);
        svg.appendChild(el('text', {
          'class': 'vlab' + (r.ours ? ' vlab--hi' : ''),
          x: px(pi, v) + 6, y: cy + 4
        }, v.toFixed(1)));
      });
      y += ROW;
    });

    mount.innerHTML = '';
    mount.appendChild(svg);
  }

  var boardPlayed = false;

  /* ---------------------------------------------------------------------
     chart tooltip — a real card that follows the pointer

     The figures used to hand their numbers to a line of text under the chart,
     which nobody looks at, and to the browser's own <title> tooltip, which
     takes about a second to appear. This is an HTML card positioned over the
     mount: swatch, name, value. The native <title> stays on every mark as the
     fallback for anyone who never moves a pointer.
     --------------------------------------------------------------------- */
  function makeChartTip(mount) {
    var box = document.createElement('div');
    box.className = 'chartip';
    box.setAttribute('aria-hidden', 'true');
    box.innerHTML = '<span class="chartip__sw"></span>' +
                    '<span class="chartip__name"></span>' +
                    '<span class="chartip__val"></span>' +
                    '<span class="chartip__sub"></span>' +
                    '<span class="chartip__tasks"></span>';
    mount.appendChild(box);
    var sw = box.querySelector('.chartip__sw'),
        nm = box.querySelector('.chartip__name'),
        vl = box.querySelector('.chartip__val'),
        sb = box.querySelector('.chartip__sub'),
        tk = box.querySelector('.chartip__tasks');

    function at(cx, cy) {
      var m = mount.getBoundingClientRect();
      var w = box.offsetWidth, hh = box.offsetHeight;
      var x = cx - m.left + 16, y = cy - m.top + 18;
      if (x + w > m.width - 4) x = cx - m.left - w - 16;   /* flip before the edge */
      if (x < 4) x = 4;
      /* below the pointer by default, so it does not sit over the panel
         headers; above only when there is no room underneath */
      if (y + hh > m.height - 4) y = Math.max(4, cy - m.top - hh - 12);
      box.style.left = Math.round(x) + 'px';
      box.style.top = Math.round(y) + 'px';
    }
    return {
      show: function (color, name, value, sub, tasks, ev) {
        sw.style.background = color;
        nm.textContent = name; vl.textContent = value;
        sb.textContent = sub || ''; sb.hidden = !sub;
        tk.textContent = tasks || ''; tk.hidden = !tasks;
        box.setAttribute('data-on', 'true');
        at(ev.clientX, ev.clientY);
      },
      /* keyboard has no pointer, so anchor to the mark itself */
      showAt: function (color, name, value, sub, tasks, svg, ux, uy) {
        sw.style.background = color;
        nm.textContent = name; vl.textContent = value;
        sb.textContent = sub || ''; sb.hidden = !sub;
        tk.textContent = tasks || ''; tk.hidden = !tasks;
        box.setAttribute('data-on', 'true');
        var r = svg.getBoundingClientRect();
        /* ux/uy are in the anchor's own units: viewBox units for an <svg>,
           plain pixels for anything else. resultBoard anchors to a <div>, which
           has no viewBox at all — reading .baseVal off it threw. */
        var vb = svg.viewBox && svg.viewBox.baseVal;
        var s = vb && vb.width ? r.width / vb.width : 1;
        at(r.left + ux * s, r.top + uy * s);
      },
      move: function (ev) { at(ev.clientX, ev.clientY); },
      hide: function () { box.removeAttribute('data-on'); }
    };
  }

  /* ---------------------------------------------------------------------
     resultBoard — the at-a-glance figure, directly under the intro reel

     The page's own idiom, not a new one: a .chartbox with a title and a sub,
     the same plate every other figure here sits on. Inside it, the label gutter
     and the three unequal panels the lane chart already used — the asymmetry is
     structural, not styling. A row of margins across the top, one thick Flex-π
     meter under them, a hairline, then the field it was measured against in
     3px rules. Four rows, one card, no section furniture of its own.

     The margins are set at .readout__val's scale, the largest number size the
     site has, and in the only colour on the board. That is the focal point and
     it does not need to be bigger than the site's own largest thing to be it —
     against 11px labels and 13px names, 36px is already a 3x jump.

     Built as DOM rather than SVG, unlike the other figures here: this one is
     mostly type, and a viewBox scales type by whatever ratio the column happens
     to be. Grid placement is set explicitly so the panels can be written
     panel-major (which is the order they have to stack in on a phone) while
     laying out row-major on a wide screen.
     --------------------------------------------------------------------- */
  function resultBoard(mount, cfg) {
    var rows = cfg.rows, panels = cfg.panels;
    var heroI = -1;
    rows.forEach(function (r, i) { if (r.headline && heroI < 0) heroI = i; });
    if (heroI < 0) return;

    /* the reference each panel measures against: the strongest baseline drawn
       in it. Not the best method in the paper — the comparison set is one VLA,
       one world model and one 3D policy, and #taskgap scores every baseline. */
    panels.forEach(function (p) {
      var best = null;
      rows.forEach(function (r, ri) {
        if (r.ours) return;
        var v = p.values[ri];
        if (v !== null && v !== undefined && (best === null || v > best.v)) best = { v: v, i: ri, name: r.name };
      });
      p._wall = best;
      p._head = p.values[heroI];
      p._lead = (best && p._head != null) ? p._head - best.v : null;
    });

    mount.innerHTML = '';
    var tip = makeChartTip(mount);
    var board = document.createElement('div');
    board.className = 'rb';
    board.setAttribute('role', 'group');
    if (cfg.ariaLabel) board.setAttribute('aria-label', cfg.ariaLabel);
    board.style.setProperty('--cols', panels.map(function (p) {
      return (p.wF == null ? 1 : p.wF) + 'fr';
    }).join(' '));

    function fmt(v) { return v.toFixed(1); }
    function span(cls, s) {
      var n = document.createElement('span');
      n.className = cls;
      if (s !== undefined) n.textContent = s;
      return n;
    }
    function cell(group, col, row, cls) {
      var n = document.createElement('div');
      n.className = 'rb__c' + (cls ? ' ' + cls : '');
      n.style.gridColumn = col; n.style.gridRow = row;
      group.appendChild(n);
      return n;
    }
    /* the name as it appears in the gutter, and again inside each panel for the
       stacked layout, where there is no gutter to carry it */
    function nameNode(r, cls) {
      var n = span('rb__name' + (cls ? ' ' + cls : ''));
      n.appendChild(document.createTextNode(r.name));
      if (r.role) n.appendChild(span('rb__role', r.role));
      return n;
    }

    var cellsByMethod = [];

    /* One rule across the whole grid, gutter included, rather than a segment
       under each cell with the column gaps punched through it. */
    var rule = document.createElement('div');
    rule.className = 'rb__rule';
    rule.style.gridColumn = '1 / -1';
    rule.style.gridRow = String(heroI + 2);
    board.appendChild(rule);

    /* the gutter: one label per row, right-ranged against the panels */
    var gut = document.createElement('div');
    gut.className = 'rb__gut';
    cell(gut, 1, 1, 'rb__c--stat');
    rows.forEach(function (r, ri) {
      var c = cell(gut, 1, ri + 2, r.ours ? 'rb__c--ours' : 'rb__c--base');
      c.appendChild(nameNode(r, r.ours ? 'rb__name--ours' : ''));
      if (!r.ours) {
        c.tabIndex = 0;
        (cellsByMethod[ri] = cellsByMethod[ri] || []).push(c);
        c.addEventListener('focus', function () {
          setHi(ri);
          var line = panels.map(function (p) {
            var v = p.values[ri];
            return v === null || v === undefined ? null : p.title.toLowerCase() + ' ' + fmt(v);
          }).filter(Boolean).join('   ');
          var br = board.getBoundingClientRect(), cr = c.getBoundingClientRect();
          tip.showAt(r.hoverColor || r.color, r.name, '', line, '', board,
                     cr.right - br.left, cr.bottom - br.top);
        });
        c.addEventListener('blur', function () { setHi(null); tip.hide(); });
      }
    });
    board.appendChild(gut);

    panels.forEach(function (p, pi) {
      var col = pi + 2;
      var g = document.createElement('div');
      g.className = 'rb__p';

      /* Two lines: one metadata line naming the slice and the baseline the
         margin is over, then the margin. The baseline used to have a line of
         its own under the number, which put the word "over" in the card three
         times and made every stat block a three-line paragraph. */
      var stat = cell(g, col, 1, 'rb__c--stat');
      var eb = span('rb__eyebrow', p.title);
      if (p._wall) eb.appendChild(span('rb__vs', ' · vs. ' + p._wall.name));
      stat.appendChild(eb);
      if (p._lead != null) {
        var d = span('rb__delta');
        d.appendChild(span('rb__sign', p._lead < 0 ? '−' : '+'));
        d.appendChild(document.createTextNode(fmt(Math.abs(p._lead))));
        d.appendChild(span('rb__unit', '%'));
        stat.appendChild(d);
      }

      rows.forEach(function (r, ri) {
        var v = p.values[ri];
        var c = cell(g, col, ri + 2,
          (r.ours ? 'rb__c--ours' : 'rb__c--base') + (ri === heroI + 1 ? ' rb__c--first' : ''));
        if (p._wall && p._wall.i === ri) c.className += ' rb__c--best';
        c.appendChild(nameNode(r, 'rb__name--in' + (r.ours ? ' rb__name--ours' : '')));

        var meter = document.createElement('div');
        meter.className = 'rb__meter';
        if (v !== null && v !== undefined) {
          var fill = span('rb__fill');
          fill.style.setProperty('--w', v + '%');
          meter.appendChild(fill);
          /* the stretch past the best baseline, at full strength. This segment
             is the number at the top of the column, drawn to scale. */
          if (r.ours && p._wall && v > p._wall.v) {
            var lead = span('rb__lead');
            lead.style.setProperty('--x', p._wall.v + '%');
            lead.style.setProperty('--w', (v - p._wall.v) + '%');
            meter.appendChild(lead);
          }
        }
        c.appendChild(meter);

        var val = span('rb__val');
        if (v === null || v === undefined) { val.textContent = '—'; val.className += ' rb__val--none'; }
        else {
          val.appendChild(document.createTextNode(fmt(v)));
          if (r.ours) val.appendChild(span('rb__valunit', '%'));
        }
        c.appendChild(val);

        var partial = p.partial && p.partial[ri];
        c.setAttribute('aria-label', r.name + ', ' + p.title.toLowerCase() + ': ' +
          (v === null || v === undefined ? 'not run' : fmt(v) + ' percent') +
          (r.ours && p._lead != null ? ', ' + fmt(p._lead) + ' over ' + p._wall.name : '') +
          (partial ? ', covering ' + partial : ''));

        /* the drill-down: the per-task scores this column's mean is made of.
           Nothing on the board shows them, so the card is not repeating itself. */
        var brk = (p.tasks || []).map(function (t) {
          var tv = t.values[ri];
          return tv === null || tv === undefined ? null : t.name + ' ' + fmt(tv);
        }).filter(Boolean).join('   ');
        /* no "0.0 short of ManiFlow" on ManiFlow's own row */
        var sub = p.title +
          (r.ours || !p._wall || p._wall.i === ri || v === null || v === undefined ? '' :
            ' · ' + fmt(p._wall.v - v) + ' short of ' + p._wall.name) +
          (p._wall && p._wall.i === ri ? ' · best baseline here' : '') +
          (partial ? ' · ' + partial : '');
        var hoverC = r.hoverColor || r.color;
        c.__c = hoverC;
        c.addEventListener('pointerenter', function (ev) {
          setHi(ri);
          if (v !== null && v !== undefined) tip.show(hoverC, r.name, fmt(v) + '%', sub, brk, ev);
        });
        c.addEventListener('pointermove', function (ev) { tip.move(ev); });
        c.addEventListener('pointerleave', function () { setHi(null); tip.hide(); });

        (cellsByMethod[ri] = cellsByMethod[ri] || []).push(c);
      });
      board.appendChild(g);
    });

    /* At rest the three baselines share one neutral: the board names every row,
       so a hue per method identifies nothing the label does not. Pointing at one
       brings back its own colour from the paper's legend, in all three panels at
       once — following a method across the three is the reading the panels are
       side by side for. */
    function setHi(mi) {
      board.setAttribute('data-hi', mi === null ? 'off' : 'on');
      cellsByMethod.forEach(function (cells, i) {
        cells.forEach(function (c) {
          var on = mi !== null && i === mi;
          c.setAttribute('data-hi', on ? 'true' : 'false');
          c.style.setProperty('--c', on && c.__c ? c.__c : '');
        });
      });
    }

    mount.appendChild(board);

    /* Entrance: the meters run out from the left, panel by panel. Transform and
       opacity only — no rule here sets a colour, so nothing it does can be
       outranked by one that does. */
    if (!reduceMotion && !boardPlayed && 'IntersectionObserver' in window) {
      board.setAttribute('data-anim', 'wait');
      var io = new IntersectionObserver(function (es) {
        if (!es[0].isIntersecting) return;
        io.disconnect();
        boardPlayed = true;
        requestAnimationFrame(function () { board.setAttribute('data-anim', 'in'); });
      }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
      io.observe(board);
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
     data-efficiency slope flow

     The x positions are the three evaluated demonstration budgets, not a
     continuous interpolation. Flex-π values stay labelled; baseline values
     appear when their measured path is hovered or keyboard-focused.
     --------------------------------------------------------------------- */
  var scalingFlowPlayed = false;
  function scalingFlowChart(mount, C) {
    var W = 1000, padL = 58, padR = 28, padT = 28, padB = 64, plotH = 292;
    var H = padT + plotH + padB;
    var x = [150, 505, 860];
    var budgets = ['50', '100', '500'];
    var series = [
      { name: 'π₀.₅', color: C.base, values: [31.4, 44.7, 76.8] },
      { name: 'LingBot-VA', color: '#7b8b9e', values: [17.2, 32.2, 91.6] },
      { name: 'Fast-WAM', color: C.base2, values: [41.9, 68.1, 91.8] },
      { name: 'Flex-π (action-only)', color: C.oursL, values: [73.4, 86.6, 93.6], ours: true, labelDy: -11 },
      { name: 'Flex-π (full joint)', color: C.oursD, values: [78.8, 87.0, 93.3], ours: true, labelDy: 18 }
    ];
    function Y(v) { return padT + plotH - (v / 100) * plotH; }

    var svg = el('svg', {
      'class': 'chart chart--scaling-flow', viewBox: '0 0 ' + W + ' ' + H,
      preserveAspectRatio: 'xMidYMid meet', role: 'img',
      'aria-label': 'Data efficiency on domain-randomized RoboTwin over 50 tasks. At 50, 100 and 500 demonstrations per task: pi zero point five scores 31.4, 44.7 and 76.8 percent; LingBot-VA 17.2, 32.2 and 91.6; Fast-WAM 41.9, 68.1 and 91.8; Flex-pi action-only 73.4, 86.6 and 93.6; Flex-pi full joint 78.8, 87.0 and 93.3.'
    });

    [0, 25, 50, 75, 100].forEach(function (t) {
      svg.appendChild(el('line', { 'class': 'grid', x1: padL, x2: W - padR, y1: Y(t), y2: Y(t) }));
      svg.appendChild(el('text', { 'class': 'tick', x: padL - 9, y: Y(t) + 3.5, 'text-anchor': 'end' }, t + '%'));
    });
    svg.appendChild(el('line', { 'class': 'axis', x1: padL, x2: W - padR, y1: Y(0), y2: Y(0) }));
    budgets.forEach(function (b, i) {
      svg.appendChild(el('line', { 'class': 'grid sflow__guide', x1: x[i], x2: x[i], y1: padT, y2: Y(0) }));
      svg.appendChild(el('text', { 'class': 'glab', x: x[i], y: Y(0) + 24, 'text-anchor': 'middle' }, b + ' demos'));
    });
    svg.appendChild(el('text', { 'class': 'alab', x: (padL + W - padR) / 2, y: H - 11,
      'text-anchor': 'middle' }, 'Demonstrations per task'));
    svg.appendChild(el('text', { 'class': 'alab', x: 0, y: 0, 'text-anchor': 'middle',
      transform: 'translate(14,' + (padT + plotH / 2) + ') rotate(-90)' }, 'Average success'));

    var groups = [];
    function setHighlight(active) {
      groups.forEach(function (g, i) {
        g.setAttribute('data-dim', active !== null && i !== active ? 'true' : 'false');
        g.setAttribute('data-highlight', active === i ? 'true' : 'false');
      });
    }

    series.forEach(function (s, si) {
      var d = s.values.map(function (v, i) { return (i ? 'L' : 'M') + x[i] + ' ' + Y(v); }).join(' ');
      var g = el('g', {
        'class': 'sflow__series' + (s.ours ? ' sflow__series--ours' : ''),
        tabindex: '0', role: 'group',
        'aria-label': s.name + ': ' + s.values.join(', ') + ' percent at 50, 100 and 500 demonstrations per task.',
        style: '--c:' + s.color + ';--ad:' + (0.08 + si * 0.09).toFixed(2) + 's'
      });
      g.appendChild(el('path', { 'class': 'sflow__line', d: d, pathLength: 1, fill: 'none' }));
      g.appendChild(el('path', { 'class': 'sflow__hit', d: d, fill: 'none' }));

      s.values.forEach(function (v, i) {
        g.appendChild(el('circle', { 'class': 'sflow__point', cx: x[i], cy: Y(v), r: s.ours ? 5.5 : 4.3 }));
        var lab = el('text', {
          'class': 'vlab sflow__value', x: x[i], y: Y(v) + (s.labelDy || -10),
          'text-anchor': 'middle'
        }, v.toFixed(1));
        g.appendChild(lab);
      });

      g.addEventListener('mouseenter', function () { setHighlight(si); });
      g.addEventListener('mouseleave', function () { setHighlight(null); });
      g.addEventListener('focus', function () { setHighlight(si); });
      g.addEventListener('blur', function () { setHighlight(null); });
      svg.appendChild(g);
      groups.push(g);
    });

    mount.innerHTML = '';
    mount.appendChild(svg);

    var lg = document.getElementById('lg-scaling');
    if (lg) {
      lg.innerHTML = '';
      series.forEach(function (s) {
        var item = document.createElement('span');
        item.className = 'legend__item';
        var sw = document.createElement('span');
        sw.className = 'legend__sw legend__sw--line';
        sw.style.setProperty('--c', s.color);
        sw.style.background = s.color;
        item.appendChild(sw);
        item.appendChild(document.createTextNode(s.name));
        lg.appendChild(item);
      });
    }

    if (!reduceMotion && !scalingFlowPlayed && 'IntersectionObserver' in window) {
      svg.setAttribute('data-anim', 'wait');
      var io = new IntersectionObserver(function (es) {
        if (!es[0].isIntersecting) return;
        io.disconnect();
        scalingFlowPlayed = true;
        requestAnimationFrame(function () { svg.setAttribute('data-anim', 'in'); });
      }, { threshold: 0.35 });
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
      /* the at-a-glance figure's baselines: one ink for all three, because that
         figure labels every row and so has no use for a hue per method */
      laneBase: css('--c-lane-base') || '#b4b4ae',
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
      scalingFlowChart(m, C);
    }

    /* results at a glance, directly under the intro reel. Three aggregate
       slices of the real-robot suite, no per-task detail — that is what the
       #real-robot and #generalization charts below are for.

       Each bar is an unweighted mean over the tasks it covers, and the three
       groups cover different task sets, so read them as three summaries and
       not as a controlled in-to-out-of-distribution delta:
         in     five in-distribution tasks, unweighted mean
         out    the three tasks that have a held-out condition
                plate 72.5/55.0/33.8/85.0/95.0  (paired chart, held-out)
                sort  40.0/32.5/ 0.0/70.0/70.0  (paired chart, held-out)
                bag   17.2/ 6.9/  — /57.5/63.3  (softbag chart, unseen bag)
         50%    Put Plate on the Rack at half the demonstrations
       Fast-WAM was not run on the bag, so its out-of-distribution mean covers
       two tasks. */
    if ((m = find('summary'))) {
      /* One baseline of each kind — a VLA, a world model, a 3D policy — against
         Flex-π at its strongest. Only full joint is drawn: this is the opening
         figure and it should make one claim, not ask the reader to hold two
         Flex-π rows apart before they know what either mode is. The action-only
         path is the whole subject of the latency figure further down, which is
         where the trade it buys can actually be shown.

         Row order is fixed across panels and never re-sorted, so a method's bar
         can be followed panel to panel: Fast-WAM's halving from in- to
         out-of-distribution is the point, and re-sorting would hide it.

         The reference in each column is the best baseline drawn there, which is
         ManiFlow, then pi0.5, then ManiFlow. Note that is the max of the
         per-method means, not the mean of the per-task maxima that #taskgap
         below uses; the two differ, and naming the owner under each headline
         number keeps this figure exact. */
      resultBoard(m, {
        /* `hoverColor` is the method's own colour from the paper's legend,
           which the board shows only under the pointer; see setHi(). */
        rows: [
          { name: 'Flex-π', role: 'full joint', color: C.oursD,
            ours: true, headline: true },
          { name: 'π₀.₅',     role: 'VLA', color: C.laneBase, hoverColor: C.base },
          { name: 'Fast-WAM', role: 'WAM', color: C.laneBase, hoverColor: C.base2 },
          { name: 'ManiFlow', role: '3D',  color: C.laneBase, hoverColor: C.base3 }
        ],
        panels: [
          { title: 'In distribution',
            values: [83.0, 52.1, 31.7, 58.0],
            partial: [null, null, '3 of 5 tasks', null],
            /* #taskgap below, per task. Each column averages to the bar above. */
            tasks: [
              { name: 'Plate',  values: [95.0, 72.5, 12.5, 75.8] },
              { name: 'Sort',   values: [75.0, 45.0,  5.0, 55.0] },
              { name: 'Kitchen',values: [98.8, 73.8, 77.5, 93.8] },
              { name: 'Repair', values: [76.0, 26.2, null, 33.3] },
              { name: 'Bag',    values: [70.0, 42.8, null, 31.9] }
            ] },
          { title: 'Out of distribution',
            values: [76.1, 43.2, 16.9, 31.5],
            partial: [null, null, '2 of 3 tasks', null],
            /* #gen's unseen halves plus #softbag's unseen bag */
            tasks: [
              { name: 'Plate', values: [95.0, 72.5, 33.8, 55.0] },
              { name: 'Sort',  values: [70.0, 40.0,  0.0, 32.5] },
              { name: 'Bag',   values: [63.3, 17.2, null,  6.9] }
            ] },
          /* one task, so its column is drawn narrower — see the resultBoard comment */
          { title: '50% data',
            values: [95.0, 42.5, 25.0, 60.0], wF: 0.74,
            tasks: [
              { name: 'Plate', values: [95.0, 42.5, 25.0, 60.0] }
            ] }
        ],
        /* No legend. Nothing on the board is encoded in a colour a reader has
           to look up: every row prints its own name, and the one colour there
           is marks the stretch the headline number above already names. */
        ariaLabel: 'Task completion on the real robot, in three slices. In distribution, over five tasks: ' +
          'Flex-π full joint 83.0 percent, 25.0 points over ManiFlow, the best baseline there; ManiFlow 58.0, ' +
          'π0.5 52.1, Fast-WAM 31.7. Out of distribution, over three conditions: Flex-π 76.1, 32.9 points ' +
          'over π0.5; π0.5 43.2, ManiFlow 31.5, Fast-WAM 16.9. On one task trained on 50 percent of the ' +
          'data: Flex-π 95.0, 35.0 points over ManiFlow; ManiFlow 60.0, π0.5 42.5, Fast-WAM 25.0. Fast-WAM ' +
          'was not run on every task, so its in-distribution mean covers three of five tasks and its ' +
          'out-of-distribution mean two of three.'
      });
    }

    /* the five tasks against whichever baseline was strongest on each, at the
       head of the part. The unweighted average over these rows is the
       'In distribution' bar of the summary figure at the top of the page, so it
       is not repeated here. */
    if ((m = find('taskgap'))) {
      dumbbellChart(m, {
        rows: [
          { label: 'Put Plate on the Rack',
            baselines: { 'π₀.₅': 72.5, 'ManiFlow': 75.8, 'Fast-WAM': 12.5 }, actionOnly: 84.2, joint: 95.0 },
          { label: 'Sort Utensils',
            baselines: { 'π₀.₅': 45.0, 'ManiFlow': 55.0, 'Fast-WAM': 5.0 },  actionOnly: 70.0, joint: 75.0 },
          { label: 'Kitchen Organization',
            baselines: { 'π₀.₅': 73.8, 'ManiFlow': 93.8, 'Fast-WAM': 77.5 }, actionOnly: 96.2, joint: 98.8 },
          { label: 'Self-Repair Gripper',
            baselines: { 'π₀.₅': 26.2, 'ManiFlow': 33.3 },                   actionOnly: 66.9, joint: 76.0 },
          { label: 'Soft-Bag Zipping',
            baselines: { 'π₀.₅': 42.8, 'ManiFlow': 31.9 },                   actionOnly: 64.9, joint: 70.0 }
        ],
        max: 100, xTicks: [0, 20, 40, 60, 80, 100],
        legendEl: '#lg-taskgap',
        legend: [
          { label: 'Strongest baseline', color: C.base, dot: true },
          { label: 'Flex-π (action-only)', color: C.oursL, dot: true, hollow: true },
          { label: 'Flex-π (full joint)', color: C.oursD, dot: true }
        ],
        ariaLabel: 'On all five real-robot tasks Flex-π beats the strongest baseline for that task. Full joint ' +
          'generation leads by 19.2 points on Put Plate on the Rack, 20.0 on Sort Utensils, 5.0 on Kitchen ' +
          'Organization, 42.7 on Self-Repair Gripper and 27.2 on Soft-Bag Zipping. The faster action-only ' +
          'path also clears every baseline.'
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
          /* held-out plate pools the two conditions, so its n is the 20 of
             both runs against the 10 of the single in-distribution one. */
          { label: 'Put Plate on the Rack',
            a: [80.0, 87.5, 37.5, 90.0, 97.5], b: [72.5, 55.0, 33.8, 85.0, 95.0],
            aN: [10, 10, 10, 10, 10], bN: [20, 20, 20, 20, 20] },
          { label: 'Sort Utensils',
            a: [45.0, 55.0, 5.0, 70.0, 75.0],  b: [40.0, 32.5, 0.0, 70.0, 70.0],
            aN: [10, 10, 10, 10, 10], bN: [10, 10, 10, 10, 10] }
        ],
        aName: 'in-distribution', bName: 'unseen',
        max: 100, yTicks: [0, 20, 40, 60, 80, 100], plotH: 250,
        bandFrac: 0.74, maxBarW: 34,
        yLabel: 'Task completion (%)', legendEl: '#lg-gen',
        ariaLabel: 'Moving to unseen conditions, Flex-π full joint loses 2.5 points on Put Plate on the Rack ' +
          'and 5 on Sort Utensils, while ManiFlow loses 32.5 and 22.5 and π0.5 loses 7.5 and 5.'
      });
    }

    /* Soft-Bag Zipping on its own: in-distribution against bags of unseen
       color and pattern. 20 rollouts per cell; Fast-WAM was not run here. */
    if ((m = find('softbag'))) {
      barChart(m, {
        series: [
          { name: 'π0.5', label: 'π₀.₅', color: C.base },
          { name: 'ManiFlow', label: 'ManiFlow', color: C.base3 },
          { name: 'Flex-π (action-only)', label: 'Flex-π (action-only)', color: C.oursL },
          { name: 'Flex-π (full joint)', label: 'Flex-π (full joint)', color: C.oursD }
        ],
        groups: [
          { label: 'In-distribution', values: [42.8, 31.9, 64.9, 70.0], n: [20, 20, 20, 20] },
          { label: 'Unseen bag',      values: [17.2, 6.9, 57.5, 63.3],  n: [20, 20, 20, 20] }
        ],
        max: 100, yTicks: [0, 20, 40, 60, 80, 100], plotH: 240, maxBarW: 40,
        tickFmt: function (t) { return t + '%'; },
        valFmt: function (v) { return v % 1 === 0 ? String(v) : v.toFixed(1); },
        yLabel: 'Task completion (%)', legendEl: '#lg-softbag',
        ariaLabel: 'On an unseen bag Flex-π full joint holds 63.3 percent against 70.0 in-distribution, while ' +
          'π0.5 falls from 42.8 to 17.2 and ManiFlow from 31.9 to 6.9.'
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
          { label: 'Task completion',   values: [26.2, 33.3, 66.9, 76.0], n: [20, 20, 20, 20] },
          { label: 'Full-task success', values: [0, 5, 45, 55],           n: [20, 20, 20, 20] }
        ],
        max: 100, yTicks: [0, 20, 40, 60, 80, 100], plotH: 240, maxBarW: 40,
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
          { label: 'Put Plate on the Rack',
            a: [80.0, 87.5, 37.5, 90.0, 97.5], b: [42.5, 60.0, 25.0, 80.0, 95.0] }
        ],
        aName: 'full data', bName: 'half data',
        max: 100, yTicks: [0, 20, 40, 60, 80, 100], plotH: 230, bandFrac: 0.62, maxBarW: 46,
        yLabel: 'Task completion (%)', legendEl: '#lg-dataeff',
        ariaLabel: 'Halving the demonstrations costs π0.5 37.5 points, ManiFlow 27.5, Fast-WAM 12.5, ' +
          'Flex-π action-only 10 and Flex-π full joint only 2.5.'
      });
    }

    /* Both simulation benchmarks in one figure, replacing the two tables.
       Numbers are paper v23: Table 1 (RoboTwin, Avg. column) and the LIBERO
       wraptable in Sec. 4.3.

       Two kinds of checkpoint appear here. Flex-π is the flexible one this page
       is about — one model per benchmark, run action-only or jointly. Flex-π* is
       fine-tuned for a single fixed mode without stream dropout; the paper
       reports it on LIBERO only, so its RoboTwin cells are empty.

       LIBERO-Plus is deliberately not shown. The data exists (Appendix Table 5:
       Flex-π 80.9 full joint / 78.3 action-only against Fast-WAM 65.3, with
       π0.5 at 84.7 and Qwen-RobotManip at 91.4 ahead), and a third `lbp` panel
       renders correctly if it is ever wanted — benchChart is generic over
       cfg.panels, so it is one panel entry plus one key per row.

       π0's RoboTwin 62.2 is Table 1's Average column, which is the mean of the
       Clean and Randomized columns: (65.92 + 58.40) / 2. That reading is
       confirmed by π0.5 on the same row pair, (82.74 + 76.76) / 2 = 79.8, the
       figure it already carried. This cell sat empty for a while because the
       number could not be traced in v17–v22.

       Left out: Motus and LingBot-VA 2.0 (RoboTwin only), GR00T-N1,
       OpenVLA-OFT and MolmoAct2-Think (LIBERO only), and Qwen-RobotManip.

       Baselines share one grey: identity lives in the label, and a color each
       would be the clutter this figure exists to remove. Both panels run 0-100
       with no truncation — on LIBERO every method but π0 really does land inside
       2.3 points (96.9-99.2), and that saturation is worth seeing. */
    if ((m = find('bench'))) {
      benchChart(m, {
        panels: [
          { key: 'rt', title: 'RoboTwin', note: '50 tasks, clean + randomized' },
          { key: 'lb', title: 'LIBERO',   note: 'four standard suites' }
        ],
        groups: [
          { label: 'Vision-language-action', rows: [
            { name: 'π₀',                    rt: 62.2, lb: 94.1 },
            { name: 'π₀.₅',                  rt: 79.8, lb: 96.9 },
            { name: 'X-VLA',                 rt: 72.9, lb: 98.1 },
            { name: 'Flex-π (action-only)',  ours: 'l', rt: 94.6, lb: 98.4 },
            { name: 'Flex-π* (action-only)', ours: 'l', rt: null, lb: 98.7 }
          ]},
          { label: 'World-action', rows: [
            { name: 'Fast-WAM',             rt: 91.8, lb: 97.6 },
            { name: 'LingBot-VA',           rt: 92.2, lb: 98.5 },
            { name: 'Flex-π (full joint)',  ours: 'd', rt: 94.6, lb: 98.5 },
            { name: 'Flex-π* (full joint)', ours: 'd', rt: null, lb: 99.2 }
          ]}
        ],
        ariaLabel: 'Simulation results. On RoboTwin Flex-π reaches 94.6% in both modes, ahead of LingBot-VA at ' +
          '92.2, Fast-WAM at 91.8, π0.5 at 79.8, X-VLA at 72.9 and π0 at 62.2. On LIBERO the methods sit between ' +
          '94.1 and 99.2: Flex-π reaches 98.4 action-only and 98.5 at full joint generation, and the fixed-mode ' +
          'Flex-π* reaches 98.7 and 99.2, level with the best published result. Flex-π* is reported on LIBERO ' +
          'only.'
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
     the real-world frontier, its own figure in Part I
     Task completion against single-inference latency, with the region that
     is both slower and less accurate than the fast path shaded. A static
     figure: hover a dot for its figures, and nothing else changes it. It
     used to sit under the configurator's mask controls and light the dot for
     whichever output mask was chosen; once the figure moved out of that card
     the two were screens apart, so the link was cut rather than left firing
     where nobody could see it. The configurator's own readout is still live —
     that is setReadoutMode(), below.
     Numbers: real_world_eval/flex_pi_final_results.json — the unweighted
     mean of the five in-distribution scores. Fast-WAM covers 3 of 5 tasks.
     --------------------------------------------------------------------- */

  /* Measured on our own RTX 5090 at the deployed 4 denoise steps.

     Keyed by the OUTPUT mask alone — rgb | dino<<1 | p3d<<2. Which streams are
     observed does not change the cost; only which futures are generated does,
     so there are eight operating points here, not the 56 configurations the
     card can express. And the key is the mask rather than the number of
     generated streams because those are not the same thing: video-only,
     DINO-only and pointmap-only each generate one future and cost 136, 138 and
     136 ms.

     Action-only (60) and full joint (193) keep their published figures. The
     other six come from a later engine sweep, which re-measured those two at
     61.1 (compile p50; the fast path has no engine) and 194.9 (engine p50) —
     close enough to leave the published pair alone. Engine / compile p50 from
     that sweep:

       action-only        —   /  61.1      video            136.4 / 203.6
       DINO             137.7 / 214.0      pointmap         135.6 / 206.3
       video+DINO       176.1 / 309.6      video+pointmap   171.1 / 295.4
       DINO+pointmap    191.8 / 312.9      full joint       194.9 / 381.5

     Only the two modes we ship have been scored on the real-robot suite, and
     both were run with all three inputs observed — so `sr` belongs to that exact
     configuration, not to the output mask alone. setReadoutMode() gates on
     both masks; everything else shows an em dash for task completion. */
  var REAL_MODE = {
    0: { lat: 60,  sr: 76.4,
         latNote: 'Faster than every baseline we compare against.',
         srNote: '+18.4 points over the strongest baseline.' },
    1: { lat: 136, latNote: 'The RGB future alone: 2.3× the action-only path.' },
    2: { lat: 138, latNote: 'The DINO future alone: 2.3× the action-only path.' },
    4: { lat: 136, latNote: 'The pointmap future alone: 2.3× the action-only path.' },
    3: { lat: 176, latNote: 'RGB and DINO futures: 2.9× the action-only path.' },
    5: { lat: 171, latNote: 'RGB and pointmap futures: 2.9× the action-only path.' },
    6: { lat: 192, latNote: 'DINO and pointmap — within 1 ms of full joint.' },
    7: { lat: 193, sr: 83.0,
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

    M.forEach(function (m) {
      var g = el('g', {});
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
      g.appendChild(dot); g.appendChild(lab); g.appendChild(val); g.appendChild(hit);
      svg.appendChild(g);
    });

    mount.appendChild(svg);
  }

  /* The two measured numbers at the head of the configurator's control column.
     Driven by the mask buttons; independent of the frontier figure above. */
  var setReadoutMode = function () {};

  function initReadout() {
    if (!document.getElementById('av-lat')) return;
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

    /* Called with both masks, each as rgb | dino<<1 | p3d<<2.

       Latency depends only on what is generated, so it reads straight off the
       output mask. Task completion depends on what is *observed* as well — the
       two scored modes were both run with all three inputs present — so a score
       is shown only for those two exact configurations and every other one of
       the 56 gets an em dash. */
    setReadoutMode = function (oMask, iMask) {
      var r = REAL_MODE[oMask];
      var scored = iMask === 7 && (oMask === 0 || oMask === 7);

      num(latEl, r ? r.lat : null, 'ms');
      num(srEl,  scored ? r.sr.toFixed(1) : null, '%');
      if (latNoteEl) latNoteEl.textContent = r ? r.latNote : 'Deployable, but not yet benchmarked on our hardware.';
      if (srNoteEl) {
        srNoteEl.textContent = scored ? r.srNote
          : (oMask === 0 || oMask === 7) ? 'The scored runs observe all three inputs.'
          : 'Not yet evaluated on the real-robot suite.';
      }
    };
    setReadoutMode(0, 7);
  }

  /* ---------------------------------------------------------------------
     auto-scrolling strip (the at-a-glance rollout row).

     The strip drifts left to right on its own so every task is seen without
     anyone touching it. Rather than duplicating the cards to scroll into —
     which puts every task on the page twice the moment anyone scrolls by
     hand — the leading card is moved to the end once it has passed the left
     edge, and the offset is reduced by exactly the width it freed. Nothing
     moves on screen at that instant, so the loop is seamless and the strip
     keeps however many cards it was written with.

     It yields to the reader: hovering, focusing a child or holding a pointer
     down all pause it, and it stops entirely while off screen. Honour
     prefers-reduced-motion by never starting.
     --------------------------------------------------------------------- */
  function initAutoStrips() {
    if (reduceMotion) return;

    document.querySelectorAll('[data-autoscroll]').forEach(function (strip) {
      if (strip.children.length < 3) return;

      var speed = parseFloat(strip.getAttribute('data-autoscroll')) || 26; /* px per second */
      var raf = 0, last = 0, holds = 0;

      /* The drift is sub-pixel per frame — 26 px/s is 0.43 px at 60 Hz — and
         scrollLeft quantises to the device pixel grid on the way in. Reading
         it back to compute the next step therefore loses the remainder every
         frame, and on a 1x display it floors to zero and the strip never
         moves at all. Keep the true position here and only ever write it. */
      var pos = 0;

      /* card width plus the gap, straight off the layout so it tracks the
         responsive column sizing without restating it here */
      function pitch() {
        var a = strip.children[0], b = strip.children[1];
        return b ? b.offsetLeft - a.offsetLeft : 0;
      }

      function recycle() {
        var p = pitch();
        while (p > 0 && pos >= p) {
          var card = strip.firstElementChild;
          var vid = card.querySelector('video');
          var playing = vid && !vid.paused;
          strip.appendChild(card);
          /* re-inserting is synchronous, but a browser that queued a pause on
             removal would otherwise leave this card frozen for good */
          if (playing && vid.paused) vid.play().catch(function () {});
          pos -= p;
          p = pitch();
        }
      }

      function step(now) {
        var dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
        last = now;
        if (!holds) {
          pos += speed * dt;
          recycle();
          strip.scrollLeft = pos;
        }
        raf = requestAnimationFrame(step);
      }
      function start() { if (!raf) { last = 0; raf = requestAnimationFrame(step); } }
      function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

      /* a counter, not a flag: hover, focus and touch can overlap */
      function hold() { holds++; }
      function release() {
        holds = Math.max(0, holds - 1);
        if (!holds) pos = strip.scrollLeft;   /* resume from wherever they left it */
      }

      strip.addEventListener('mouseenter', hold);
      strip.addEventListener('mouseleave', release);
      strip.addEventListener('focusin', hold);
      strip.addEventListener('focusout', release);
      strip.addEventListener('pointerdown', function () {
        hold();
        var up = function () {
          release();
          window.removeEventListener('pointerup', up);
          window.removeEventListener('pointercancel', up);
        };
        window.addEventListener('pointerup', up);
        window.addEventListener('pointercancel', up);
      });

      /* Start regardless, then let the observer park it while off screen.
         Gating the start on the observer instead would leave the strip dead
         for good if that first callback never arrives. */
      start();
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (entries) {
          if (entries[entries.length - 1].isIntersecting) start(); else stop();
        }, { threshold: 0 });
        io.observe(strip);
        strip._autoIO = io;   /* keep a reference so it cannot be collected */
      }
    });
  }

  /* ---------------------------------------------------------------------
     videos: warm up shortly before they enter the viewport, then play only
     while they are nearby. This keeps the full video library off the initial
     loading path without making the next row feel late.
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
    }, { threshold: 0.01, rootMargin: '700px 0px' });
    vids.forEach(function (v) { io.observe(v); });
  }

  /* ---------------------------------------------------------------------
     synchronised clips: videos sharing a data-sync value play as one.

     Figure 3 wipes between two layers of the same episode, so a few frames
     of drift would read as reconstruction error that is not there. The first
     video of a group is the leader (it is the one carrying data-autoplay);
     the rest mirror its transport and get nudged back whenever they slip
     more than ~4 frames, including at every loop boundary.
     --------------------------------------------------------------------- */
  function initSyncedVideos() {
    var groups = {};
    document.querySelectorAll('video[data-sync]').forEach(function (v) {
      var k = v.getAttribute('data-sync');
      (groups[k] = groups[k] || []).push(v);
    });

    Object.keys(groups).forEach(function (k) {
      var vs = groups[k];
      if (vs.length < 2) return;
      var lead = vs[0];
      var rest = vs.slice(1);

      function each(fn) { rest.forEach(fn); }
      function align(v) {
        if (v.readyState >= 1 && Math.abs(v.currentTime - lead.currentTime) > 0.12) {
          v.currentTime = lead.currentTime;
        }
      }

      lead.addEventListener('play', function () {
        each(function (v) {
          if (v.preload !== 'auto') v.preload = 'auto';
          align(v);
          v.play().catch(function () {});
        });
      });
      lead.addEventListener('pause', function () { each(function (v) { v.pause(); }); });
      lead.addEventListener('seeked', function () { each(align); });
      lead.addEventListener('timeupdate', function () { each(align); });
    });
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
     rollout strip  (#real-robot, "Putting into Bag")

     Six rollouts of the same task -- five seen bags plus the held-out one --
     and the thumbnail strip is the only control: it swaps which clip is on
     screen and, because the unseen rollout is one of the entries, which half
     of the description reads. Prose keyed to the setting rather than to a
     single bag carries [data-bagpane="seen"|"unseen"] and lives outside the
     strip, so those are looked up on the whole .vfeature block.
     --------------------------------------------------------------------- */
  function initBagGallery() {
    document.querySelectorAll('[data-baggallery]').forEach(function (gal) {
      var block = gal.closest('.vfeature') || gal;
      var thumbs = Array.prototype.slice.call(gal.querySelectorAll('.bagswatch[data-bag]'));
      var panes = Array.prototype.slice.call(gal.querySelectorAll('.player[data-bag]'));
      var prose = Array.prototype.slice.call(block.querySelectorAll('[data-bagpane]'));
      if (thumbs.length < 2 || !panes.length) return;
      var current = thumbs[0].getAttribute('data-bag');

      /* autoplay is left to the IntersectionObserver in initVideos() on the
         first pass, so booting the page does not start an off-screen clip */
      function apply(autoplay) {
        thumbs.forEach(function (t) {
          t.setAttribute('aria-selected', t.getAttribute('data-bag') === current ? 'true' : 'false');
        });
        /* every bag but the held-out one is a *seen* rollout */
        var cond = current === 'unseen' ? 'unseen' : 'seen';
        prose.forEach(function (n) { n.hidden = n.getAttribute('data-bagpane') !== cond; });
        panes.forEach(function (p) {
          var on = p.getAttribute('data-bag') === current;
          p.hidden = !on;
          var v = p.querySelector('video');
          if (!v) return;
          if (on && autoplay && !gal.hidden) { v.play().catch(function () {}); } else { v.pause(); }
        });
      }

      thumbs.forEach(function (t) {
        t.addEventListener('click', function () {
          current = t.getAttribute('data-bag');
          apply(true);
        });
        t.addEventListener('keydown', function (e) {
          var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
          /* read the index live -- a variant with no clip on disk is pulled
             out of `thumbs` below, which would strand a captured one */
          var i = thumbs.indexOf(t);
          if (!d || i === -1) return;
          e.preventDefault();
          var next = thumbs[(i + d + thumbs.length) % thumbs.length];
          next.focus();
          current = next.getAttribute('data-bag');
          apply(true);
        });
      });

      /* a variant whose poster is not on disk yet drops out of the strip
         entirely, so a missing clip degrades to four bags rather than a
         broken thumbnail */
      thumbs.forEach(function (t) {
        var img = t.querySelector('img');
        if (!img) return;
        img.addEventListener('error', function () {
          var bag = t.getAttribute('data-bag');
          t.remove();
          thumbs = thumbs.filter(function (x) { return x !== t; });
          panes = panes.filter(function (p) {
            if (p.getAttribute('data-bag') !== bag) return true;
            p.remove();
            return false;
          });
          if (current === bag && thumbs.length) current = thumbs[0].getAttribute('data-bag');
          if (thumbs.length < 2) { var s = gal.querySelector('.bagswitch'); if (s) s.hidden = true; }
          apply(false);
        });
      });

      if (window.MutationObserver) {
        new MutationObserver(function () { apply(!gal.hidden); })
          .observe(gal, { attributes: true, attributeFilter: ['hidden'] });
      }

      apply(false);
    });
  }

  /* ---------------------------------------------------------------------
     task gallery  (#generalization)

     Two independent axes over one stage: the thumbnail rail on the left
     picks the task, the seen/unseen switch above picks the setting. Six
     clips live in the DOM; exactly one (task, setting) pair is visible and
     playing, everything else is hidden and paused so only one video decodes.

     Note the two attributes: [data-cond] marks things keyed to the setting
     alone (the switch buttons, the rail posters), [data-condpane] marks the
     setting-specific halves *inside* a task's meta block -- keeping them
     apart means a hidden task's meta never fights the visible one.

     The clips chain rather than loop: when one rollout runs out the rail steps
     to the next task and wraps, so leaving the section alone plays all three in
     turn. That is why these six videos carry no `loop` attribute -- without an
     `ended` event there is nothing to advance on.
     --------------------------------------------------------------------- */
  function initTaskGallery() {
    document.querySelectorAll('[data-taskgallery]').forEach(function (gal) {
      var thumbs = Array.prototype.slice.call(gal.querySelectorAll('.taskthumb[data-task]'));
      var players = Array.prototype.slice.call(gal.querySelectorAll('.player[data-task]'));
      var metas = Array.prototype.slice.call(gal.querySelectorAll('.vfeature__meta[data-task]'));
      var condBtns = Array.prototype.slice.call(gal.querySelectorAll('.seg__btn[data-cond]'));
      var shots = Array.prototype.slice.call(gal.querySelectorAll('.taskthumb img[data-cond]'));
      var seg = gal.querySelector('.seg');
      if (!thumbs.length || !players.length) return;

      var task = thumbs[0].getAttribute('data-task');
      /* the markup decides which setting leads (this gallery opens on Unseen) */
      var cond = (seg && seg.getAttribute('data-active')) || 'seen';

      /* autoplay is left to the IntersectionObserver in initVideos() on the
         first pass, so booting the page does not start an off-screen clip */
      function apply(autoplay) {
        if (seg) seg.setAttribute('data-active', cond); /* slides the thumb */
        condBtns.forEach(function (b) {
          b.setAttribute('aria-selected', b.getAttribute('data-cond') === cond ? 'true' : 'false');
        });
        thumbs.forEach(function (t) {
          t.setAttribute('aria-selected', t.getAttribute('data-task') === task ? 'true' : 'false');
        });
        shots.forEach(function (img) { img.hidden = img.getAttribute('data-cond') !== cond; });
        metas.forEach(function (m) {
          m.hidden = m.getAttribute('data-task') !== task;
          Array.prototype.forEach.call(m.querySelectorAll('[data-condpane]'), function (n) {
            n.hidden = n.getAttribute('data-condpane') !== cond;
          });
        });
        players.forEach(function (p) {
          var on = p.getAttribute('data-task') === task && p.getAttribute('data-cond') === cond;
          p.hidden = !on;
          var v = p.querySelector('video');
          if (!v) return;
          if (on && autoplay) {
            /* each rollout starts from its first frame -- a clip the chain has
               already run through would otherwise resume on its last */
            try { v.currentTime = 0; } catch (err) {}
            v.play().catch(function () {});
          } else {
            v.pause();
          }
        });
      }

      /* hand off to the next task when a rollout runs out. Guarded on the clip
         still being the selected one, so a stale `ended` from a clip the viewer
         has already switched away from cannot hijack the rail. */
      var lb = document.getElementById('lightbox');
      players.forEach(function (p) {
        var v = p.querySelector('video');
        if (!v) return;
        v.addEventListener('ended', function () {
          if (p.hidden) return;
          /* the lightbox plays its own copy; advancing behind the overlay would
             leave the viewer somewhere else when they close it */
          if (lb && lb.getAttribute('data-open') === 'true') return;
          var i = thumbs.map(function (t) { return t.getAttribute('data-task'); }).indexOf(task);
          if (i === -1) return;
          task = thumbs[(i + 1) % thumbs.length].getAttribute('data-task');
          apply(true);
        });
      });

      function wire(list, attr, set) {
        list.forEach(function (el) {
          el.addEventListener('click', function () { set(el.getAttribute(attr)); apply(true); });
          el.addEventListener('keydown', function (e) {
            var horiz = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
            var vert = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
            var d = horiz || vert;
            var i = list.indexOf(el);
            if (!d || i === -1) return;
            e.preventDefault();
            var next = list[(i + d + list.length) % list.length];
            next.focus();
            set(next.getAttribute(attr));
            apply(true);
          });
        });
      }

      wire(thumbs, 'data-task', function (v) { task = v; });
      wire(condBtns, 'data-cond', function (v) { cond = v; });

      apply(false);
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
      /* Preserve comparison-only color matching when a clip is expanded. */
      var sourceVideo = p && p.querySelector('video');
      var sourceFilter = sourceVideo ? getComputedStyle(sourceVideo).filter : 'none';
      lv.style.filter = sourceFilter && sourceFilter !== 'none' ? sourceFilter : '';
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
      lv.style.filter = '';
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
      if (p.classList.contains('player--todo')) return;
      if (!p.querySelector('.player__expand') && !p.querySelector('video')) return;
      p.addEventListener('click', function () {
        var v = p.querySelector('video:not([hidden])') || p.querySelector('video');
        if (!v || !(v.currentSrc || v.src)) return;
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
     predicted futures: the prediction row is hidden until asked for, and
     once shown it decodes one stream at a time

     The policy generates a future in three streams, so the reveal button is
     paired with a stream selector. Each pair carries a data-pred-<stream>
     attribute per stream holding that decode's clip path; picking a stream
     repoints every slot at once. An empty attribute means the decode is not
     exported yet, and that slot falls back to the placeholder — so the strip
     can go live one clip at a time as footage lands.
     --------------------------------------------------------------------- */
  function initPredReveal() {
    var strip = document.getElementById('predstrip');
    var btn = document.getElementById('pred-toggle');
    var note = document.getElementById('pred-note');
    var modes = document.getElementById('pred-modes');
    if (!strip || !btn) return;

    var LABEL = { rgb: 'RGB', dino: 'DINO', p3d: 'Pointmap' };
    var pairs = Array.prototype.slice.call(strip.querySelectorAll('.predpair'));

    /* ------------------------------------------------------------------
       The two clips in a pair are the same episode, so they have to run in
       step. The reveal only uncovers the row: the future is put at the
       rollout's position the moment it becomes visible, and nudged back
       whenever it drifts. Drift is real — the decodes are up to 70 ms
       shorter than their rollouts, so one loop boundary is enough to walk
       them apart — and the collapsed row is display:none, which the
       autoplay observer reads as off-screen and pauses.
       ------------------------------------------------------------------ */
    var SYNC_TOL = 0.18;

    function partsOf(fig) {
      return {
        real: fig.querySelector('.player:not(.predpair__gen) video'),
        gen: fig.querySelector('.predpair__gen video')
      };
    }

    function syncPair(fig, force) {
      var p = partsOf(fig);
      if (!p.real || !p.gen || !p.gen.getAttribute('src')) return;
      /* durations arrive with the metadata; before that there is nothing to
         seek against and a seek would be discarded anyway */
      if (!isFinite(p.gen.duration) || !isFinite(p.real.duration)) return;
      var t = Math.min(p.real.currentTime, Math.max(0, p.gen.duration - 0.05));
      if (force || Math.abs(p.gen.currentTime - t) > SYNC_TOL) p.gen.currentTime = t;
    }

    function shown() { return strip.getAttribute('data-pred') !== 'hidden'; }

    pairs.forEach(function (fig) {
      var p = partsOf(fig);
      if (!p.real || !p.gen) return;
      /* the rollout is the clock: every tick corrects the future against it */
      p.real.addEventListener('timeupdate', function () { if (shown()) syncPair(fig); });
      /* a fresh source starts at zero, so catch it as soon as it can seek */
      p.gen.addEventListener('loadeddata', function () { if (shown()) syncPair(fig, true); });
    });
    var modeBtns = modes
      ? Array.prototype.slice.call(modes.querySelectorAll('.predmode'))
      : [];

    /* While the strip is collapsed nothing is being decoded, so no stream is
       "current" — the pills carry a pending choice, not a live one, and showing
       one as pressed would claim a selection the reader can't see the effect
       of. Pressed state therefore only exists once the row is revealed. */
    function syncPressed() {
      var armed = strip.getAttribute('data-pred') !== 'hidden';
      var stream = strip.getAttribute('data-stream');
      if (modes) modes.setAttribute('data-armed', armed ? 'true' : 'false');
      modeBtns.forEach(function (m) {
        m.setAttribute('aria-pressed',
          armed && m.getAttribute('data-stream') === stream ? 'true' : 'false');
      });
    }

    function paint(stream) {
      var label = LABEL[stream] || LABEL.rgb;
      strip.setAttribute('data-stream', stream);
      syncPressed();

      pairs.forEach(function (fig) {
        var slot = fig.querySelector('.predpair__gen');
        if (!slot) return;
        var video = slot.querySelector('video');
        var badge = slot.querySelector('.predpair__badge');
        var src = (fig.getAttribute('data-pred-' + stream) || '').trim();
        var task = fig.getAttribute('data-task') || '';

        if (badge) badge.textContent = 'Predicted future · ' + label;

        if (!src) {
          slot.classList.add('player--todo');
          slot.setAttribute('data-todo', label + ' decode — footage not ready');
          slot.setAttribute('data-caption', '');
          if (video) { video.pause(); video.removeAttribute('src'); video.load(); }
          return;
        }

        slot.classList.remove('player--todo');
        slot.removeAttribute('data-todo');
        slot.setAttribute('data-caption',
          task + ' — the ' + label + ' future Flex-π generated for this episode, decoded after the fact.');
        if (video && video.getAttribute('src') !== src) {
          video.setAttribute('src', src);
          video.setAttribute('poster', src.replace(/\.mp4$/, '.jpg'));
          video.setAttribute('aria-label', 'Decoded ' + label + ' future for ' + task);
          video.load();
          if (strip.getAttribute('data-pred') === 'shown') video.play().catch(function () {});
        }
      });
    }

    function setHidden(hidden) {
      strip.setAttribute('data-pred', hidden ? 'hidden' : 'shown');
      btn.setAttribute('aria-expanded', hidden ? 'false' : 'true');
      btn.lastChild.textContent = hidden
        ? ' Reveal the predicted futures'
        : ' Hide the predicted futures';
      if (note) note.hidden = !hidden;
      syncPressed();
      /* a paused-off-screen clip in a collapsed row should not keep decoding;
         on the way back it joins the rollout where the rollout already is */
      pairs.forEach(function (fig) {
        var v = fig.querySelector('.predpair__gen video');
        if (!v) return;
        if (hidden) { v.pause(); return; }
        if (!v.getAttribute('src')) return;
        syncPair(fig, true);
        v.play().catch(function () {});
      });
    }

    btn.addEventListener('click', function () {
      setHidden(strip.getAttribute('data-pred') !== 'hidden');
    });

    if (modes) {
      modes.addEventListener('click', function (e) {
        var m = e.target.closest('.predmode');
        if (!m) return;
        paint(m.getAttribute('data-stream'));
        /* picking a stream is a request to see it */
        if (strip.getAttribute('data-pred') === 'hidden') setHidden(false);
      });
    }

    paint(strip.getAttribute('data-stream') || 'rgb');
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
       background color, then redraw them as crisp text over the divider */
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
    /* the card opens on the action-only fast path — everything observed,
       no future generated */
    var mIn  = { rgb: true, dino: true, p3d: true };
    var mOut = { rgb: false, dino: false, p3d: false };

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
               ' future' + (gen.length > 1 ? 's are' : ' is') + ' generated and read, so that is all you pay for.';
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
      var iBits = SKEYS.reduce(function (a, k, n) { return a + (mIn[k] ? (1 << n) : 0); }, 0);
      var oBits = SKEYS.reduce(function (a, k, n) { return a + (mOut[k] ? (1 << n) : 0); }, 0);
      /* index this configuration among the 7 x 8 = 56 valid ones */
      if (cEl) cEl.textContent = String((iBits - 1) * 8 + oBits + 1);
      /* latency follows the output mask alone; the completion score needs both,
         since only the fully-observed action-only and full-joint runs are scored */
      setReadoutMode(oBits, iBits);
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
      var badge = j.querySelector('.juxta__metrics__box');

      function set(pct) {
        pct = Math.max(0, Math.min(100, pct));
        j.style.setProperty('--x', pct + '%');
        j.setAttribute('aria-valuenow', String(Math.round(pct)));

        /* the metrics describe the reconstruction only, so retire them over
           the last few percent before the divider would reach the badge */
        if (badge) {
          var r = j.getBoundingClientRect();
          var b = badge.getBoundingClientRect();
          var edge = (b.left - r.left) / r.width * 100;
          j.style.setProperty('--mo', String(Math.max(0, Math.min(1, (edge - pct) / 6))));
        }
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
    initFrontier();      /* static figure, no longer steered by the masks */
    initReadout();       /* before initArchviz: the masks drive the readout */
    initSyncedVideos();  /* before initVideos: the leader must not play unheard */
    initAutoStrips();  /* clones strip children, so before initVideos() sees them */
    initVideos();
    initTaskSwitch();
    initBagGallery();
    initTaskGallery();
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
