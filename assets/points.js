/* ==========================================================================
   Sivi Quant Labs, hero renderer
   A flat dieline that folds into a closed box, drawn as a point cloud.
   The points fly in and settle on the flat sheet, then the box folds up,
   holds shut, unfolds, holds flat, and turns the whole time. Canvas 2D,
   perspective projection, no dependencies.

   Cut edges take the accent colour; crease (fold) lines are fainter dots,
   the same convention a printed dieline uses. Colours come from the page's
   tokens. Drag or use the arrow keys to turn it. Reduced motion gets one
   still, closed box that can still be turned.
   ========================================================================== */

(function () {
  'use strict';

  var stage = document.querySelector('[data-fold]');
  if (!stage) return;
  var root = document.documentElement;

  var canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label',
    'A flat sheet drawn in points, folding into a closed box and opening again as it turns. Drag it, or use the arrow keys, to turn it.');
  canvas.tabIndex = 0;
  stage.appendChild(canvas);
  var ctx = canvas.getContext('2d');
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- geometry ---------------------------------------------------------
     Unit box, base in the z = 0 plane. Four walls hinge on the base; the lid
     hinges on the far edge of the +Y wall. `t` is the fold angle: 0 flat,
     PI/2 closed. A face's `crease` lists which of its edges are folds.     */

  var s = 1, h = s / 2;
  function faces(t) {
    var c = Math.cos(t), sn = Math.sin(t);
    var hy = h + s * c, hz = s * sn;                 // lid hinge, after the wall folds
    var c2 = Math.cos(2 * t), s2 = Math.sin(2 * t);  // the lid turns through twice the angle
    return [
      { p: [[-h,-h,0], [h,-h,0], [h,h,0], [-h,h,0]], crease: [0,1,2,3] },                           // base
      { p: [[-h,h,0], [h,h,0], [h, h+s*c, s*sn], [-h, h+s*c, s*sn]], crease: [0,2] },                // +Y wall
      { p: [[-h,-h,0], [h,-h,0], [h, -h-s*c, s*sn], [-h, -h-s*c, s*sn]], crease: [0] },              // -Y wall
      { p: [[h,-h,0], [h,h,0], [h+s*c, h, s*sn], [h+s*c, -h, s*sn]], crease: [0] },                  // +X wall
      { p: [[-h,-h,0], [-h,h,0], [-h-s*c, h, s*sn], [-h-s*c, -h, s*sn]], crease: [0] },              // -X wall
      { p: [[-h, hy, hz], [h, hy, hz], [h, hy + s*c2, hz + s*s2], [-h, hy + s*c2, hz + s*s2]], crease: [0] } // lid
    ];
  }
  // a point at (u, v) on a face: bilinear between its four corners
  function onFace(f, u, v) {
    var a = f.p[0], b = f.p[1], c = f.p[2], d = f.p[3], o = [0, 0, 0];
    for (var i = 0; i < 3; i++) {
      var top = a[i] + (b[i] - a[i]) * u, bot = d[i] + (c[i] - d[i]) * u;
      o[i] = top + (bot - top) * v;
    }
    return o;
  }

  /* ---- sample the dieline once ------------------------------------------
     Every point lives at a fixed (u, v) on a face, so it rides that face as
     it folds. A fold line belongs to two faces: edges are keyed by their
     midpoint on the flat sheet so each is sampled once, and a fold always as
     a crease (the sheet has 14 cut edges and 5 folds).                      */

  var rand = (function (x) { return function () { x = (x * 16807) % 2147483647; return (x - 1) / 2147483646; }; })(11);
  var EDGE = [function (k) { return [k, 0]; }, function (k) { return [1, k]; },
              function (k) { return [1 - k, 1]; }, function (k) { return [0, 1 - k]; }];
  var pts = [], seen = {};
  faces(0).forEach(function (f, fi) {
    for (var e = 0; e < 4; e++) {
      var a = f.p[e], b = f.p[(e + 1) % 4];
      var key = Math.round((a[0] + b[0]) * 500) + ',' + Math.round((a[1] + b[1]) * 500);
      if (seen[key]) continue;
      seen[key] = true;
      var crease = f.crease.indexOf(e) !== -1, n = crease ? 30 : 46;
      for (var i = 0; i < n; i++) {
        var uv = EDGE[e]((i + rand() * .6) / n);
        pts.push({ f: fi, u: uv[0], v: uv[1], k: crease ? 'crease' : 'edge' });
      }
    }
    for (var j = 0; j < 110; j++) pts.push({ f: fi, u: rand(), v: rand(), k: 'face' });
  });
  pts.forEach(function (p) {
    p.sx = (rand() - .5) * 7; p.sy = (rand() - .5) * 7; p.sz = (rand() - .5) * 4;
    p.delay = rand() * .4;
  });
  var dust = [];
  for (var d = 0; d < 120; d++) {
    var r = 1.4 + rand() * 1.2, th = rand() * Math.PI * 2, ph = Math.acos(rand() * 2 - 1);
    dust.push({ x: r * Math.sin(ph) * Math.cos(th), y: r * Math.sin(ph) * Math.sin(th), z: .5 + r * Math.cos(ph) * .6, ph: rand() * 6.3 });
  }

  /* ---- fold rhythm and camera ------------------------------------------- */

  var FOLD = 2600, HOLD_SHUT = 2200, UNFOLD = 2200, HOLD_FLAT = 1400;
  var CYCLE = FOLD + HOLD_SHUT + UNFOLD + HOLD_FLAT, ASSEMBLE = 2400;
  function easeInOut(x) { return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function easeOut(x) { return 1 - Math.pow(1 - x, 3); }
  function foldAt(ms) {
    var u = ms % CYCLE;
    if (u < FOLD) return easeInOut(u / FOLD);
    u -= FOLD; if (u < HOLD_SHUT) return 1;
    u -= HOLD_SHUT; if (u < UNFOLD) return 1 - easeInOut(u / UNFOLD);
    return 0;
  }
  var FOCAL = 4.2;
  function project(p, az, el, scale, cx, cy, c) {
    var x = p[0] - c[0], y = p[1] - c[1], z = p[2] - c[2];
    var ca = Math.cos(az), sa = Math.sin(az);
    var x1 = x * ca - y * sa, y1 = x * sa + y * ca;
    var ce = Math.cos(el), se = Math.sin(el);
    var sy = z * ce - y1 * se, depth = -(y1 * ce + z * se);
    var w = FOCAL / (FOCAL + depth);
    return { x: cx + x1 * scale * w, y: cy - sy * scale * w, d: depth, w: w };
  }

  /* ---- colours from the page tokens -------------------------------------- */

  var col = {};
  function readColors() {
    var cs = getComputedStyle(root);
    var get = function (n, fb) { return (cs.getPropertyValue(n) || '').trim() || fb; };
    col.edge = get('--accent', '#FF4F00');
    col.crease = get('--faint', '#ABABAB');
    col.ink = get('--ink-rgb', '20 20 20');
  }

  /* ---- sizing ------------------------------------------------------------ */

  var W = 0, H = 0, dpr = 1;
  function resize() {
    var rc = stage.getBoundingClientRect();
    if (!rc.width) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = rc.width; H = rc.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!running) draw(performance.now());   // resizing wipes a canvas
  }

  /* ---- draw -------------------------------------------------------------- */

  var t0 = null, last = null, az = -.62, el = .6, dragging = false;
  function draw(now) {
    if (!W) return;
    if (t0 === null) t0 = now;
    var ms = now - t0;
    var dt = last === null ? 0 : Math.min(now - last, 100);   // clamp after a background tab
    last = now;
    if (!reduced && !dragging) az += .14 * dt / 1000;
    var build = reduced ? 1 : Math.min(1, ms / ASSEMBLE);
    var t = reduced ? Math.PI / 2 : (Math.PI / 2) * (ms < ASSEMBLE ? 0 : foldAt(ms - ASSEMBLE));
    var fl = faces(t);

    // auto-fit on the bounding box and radius, so it stays framed at every angle
    var lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    fl.forEach(function (f) { f.p.forEach(function (p) { for (var i = 0; i < 3; i++) { if (p[i] < lo[i]) lo[i] = p[i]; if (p[i] > hi[i]) hi[i] = p[i]; } }); });
    var c = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2], rr = 0;
    fl.forEach(function (f) { f.p.forEach(function (p) { var dx = p[0] - c[0], dy = p[1] - c[1], dz = p[2] - c[2]; rr = Math.max(rr, Math.sqrt(dx * dx + dy * dy + dz * dz)); }); });
    var scale = Math.min(W, H) * .42 / rr, cx = W / 2, cy = H / 2;

    ctx.clearRect(0, 0, W, H);
    var inkFill = 'rgb(' + col.ink + ')';
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      var target = onFace(fl[p.f], p.u, p.v);
      var k = easeOut(Math.max(0, Math.min(1, (build - p.delay) / (1 - p.delay))));
      var pos = k >= 1 ? target : [p.sx + (target[0] - p.sx) * k, p.sy + (target[1] - p.sy) * k, p.sz + (target[2] - p.sz) * k];
      var q = project(pos, az, el, scale, cx, cy, c);
      var near = Math.max(.25, Math.min(1, 1 - (q.d + 1.2) / 3.2));   // nearer points read stronger
      var z;
      if (p.k === 'edge') { ctx.fillStyle = col.edge; ctx.globalAlpha = .35 + .6 * near; z = 2.6 * q.w; }
      else if (p.k === 'crease') { ctx.fillStyle = col.crease; ctx.globalAlpha = .3 + .55 * near; z = 2 * q.w; }
      else { ctx.fillStyle = inkFill; ctx.globalAlpha = (.1 + .22 * near) * k; z = 1.6 * q.w; }
      ctx.fillRect(q.x - z / 2, q.y - z / 2, z, z);
    }
    ctx.fillStyle = inkFill;
    for (var j = 0; j < dust.length; j++) {
      var du = dust[j], drift = reduced ? 0 : Math.sin(ms / 1600 + du.ph) * .05;
      var qd = project([du.x, du.y, du.z + drift], az * .6, el, scale * .95, cx, cy, [0, 0, .5]);
      ctx.globalAlpha = .16 * Math.max(.3, 1 - (qd.d + 2) / 5) * build;
      ctx.fillRect(qd.x, qd.y, 1.2, 1.2);
    }
    ctx.globalAlpha = 1;
  }

  /* ---- run only while on screen ------------------------------------------ */

  var running = false, visible = true, raf = 0;
  function loop(now) { draw(now); raf = requestAnimationFrame(loop); }
  function sync() {
    if (visible && !reduced && !running) { running = true; last = null; raf = requestAnimationFrame(loop); }
    else if ((!visible || reduced) && running) { running = false; cancelAnimationFrame(raf); }
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { visible = en[0].isIntersecting; sync(); }).observe(canvas);
  }

  /* ---- interaction: drag to turn, arrow keys to step --------------------- */

  var px = 0, py = 0;
  function nudge(dx, dy) {
    az += dx * .008;
    el = Math.max(.12, Math.min(1.35, el + dy * .006));
    if (!running) draw(performance.now());   // reduced motion has no loop
  }
  canvas.addEventListener('pointerdown', function (e) {
    dragging = true; px = e.clientX; py = e.clientY;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ }
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    e.preventDefault();
    nudge(e.clientX - px, e.clientY - py);
    px = e.clientX; py = e.clientY;
  });
  function up() { dragging = false; }
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('lostpointercapture', up);
  canvas.addEventListener('keydown', function (e) {
    var step = 15;
    if (e.key === 'ArrowLeft')  { nudge(-step, 0); e.preventDefault(); }
    if (e.key === 'ArrowRight') { nudge(step, 0); e.preventDefault(); }
    if (e.key === 'ArrowUp')    { nudge(0, step * 1.33); e.preventDefault(); }
    if (e.key === 'ArrowDown')  { nudge(0, -step * 1.33); e.preventDefault(); }
  });

  /* ---- boot --------------------------------------------------------------- */

  readColors();
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
  else window.addEventListener('resize', resize);
  resize();
  sync();
})();
