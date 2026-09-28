/* Immersive hero (PROTOTYPE): the hero's folding box, drawn as a point cloud.

   Same geometry, fold rhythm and camera as fold.js: a flat dieline that folds
   into a closed box, holds, unfolds, holds flat, and turns the whole time.
   The points first fly in from a scatter and settle on the flat sheet, then
   the cycle starts. Every point belongs to a face at a fixed (u, v), so it
   rides that face as it folds.

   It sits on the page's own background in every mode; colours come from the
   tokens: cut edges in the accent, creases in the faint grey, faces and dust
   in the ink at low opacity. Reduced motion gets one still, closed box. */
(function () {
  'use strict';
  var canvas = document.querySelector('canvas.particles');
  if (!canvas) return;
  var root = document.documentElement;
  var ctx = canvas.getContext('2d');
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Two layouts share this one canvas:
       immersive  behind a centred headline, filling the hero
       split      beside the text, in the hero's 3D stage (like fold.js)
     The canvas moves between them, so both behave identically. */
  var heroEl = canvas.closest('.hero') || canvas.parentNode;
  var stageEl = heroEl.querySelector('.stage');
  function layout() {
    var v = root.getAttribute('data-hero');
    return v === 'immersive' || v === 'split' ? v : null;
  }
  function place() {
    var target = layout() === 'split' && stageEl ? stageEl : heroEl;
    if (canvas.parentNode === target) return;
    if (target === heroEl) heroEl.insertBefore(canvas, heroEl.firstChild);
    else target.appendChild(canvas);
  }

  /* ---- geometry, identical to fold.js ------------------------------------ */
  var s = 1, h = s / 2;
  function faces(t) {
    var c = Math.cos(t), sn = Math.sin(t);
    var hy = h + s * c, hz = s * sn;
    var c2 = Math.cos(2 * t), s2 = Math.sin(2 * t);
    return [
      { p: [[-h,-h,0], [h,-h,0], [h,h,0], [-h,h,0]], crease: [0,1,2,3] },
      { p: [[-h,h,0], [h,h,0], [h, h+s*c, s*sn], [-h, h+s*c, s*sn]], crease: [0, 2] },
      { p: [[-h,-h,0], [h,-h,0], [h, -h-s*c, s*sn], [-h, -h-s*c, s*sn]], crease: [0] },
      { p: [[h,-h,0], [h,h,0], [h+s*c, h, s*sn], [h+s*c, -h, s*sn]], crease: [0] },
      { p: [[-h,-h,0], [-h,h,0], [-h-s*c, h, s*sn], [-h-s*c, -h, s*sn]], crease: [0] },
      { p: [[-h, hy, hz], [h, hy, hz], [h, hy + s*c2, hz + s*s2], [-h, hy + s*c2, hz + s*s2]], crease: [0] }
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

  /* ---- sample the dieline once ------------------------------------------ */
  var rand = (function (x) { return function () { x = (x * 16807) % 2147483647; return (x - 1) / 2147483646; }; })(11);
  var pts = [];
  var base = faces(0);
  // edge e of a face runs from corner e to corner e+1; as (u, v):
  var EDGE = [function (k) { return [k, 0]; }, function (k) { return [1, k]; },
              function (k) { return [1 - k, 1]; }, function (k) { return [0, 1 - k]; }];
  // A fold line belongs to two faces. Key each edge by its midpoint on the
  // flat sheet so a shared fold is sampled once, and always as a crease.
  var seen = {};
  var key = function (f, e) {
    var a = f.p[e], b = f.p[(e + 1) % 4];
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2].map(function (x) { return Math.round(x * 1000); }).join(',');
  };
  base.forEach(function (f, fi) {
    for (var e = 0; e < 4; e++) {
      var crease = f.crease.indexOf(e) !== -1;
      var k = key(f, e);
      if (seen[k]) continue;
      seen[k] = true;
      var n = crease ? 30 : 46;
      for (var i = 0; i < n; i++) {
        var uv = EDGE[e]((i + rand() * .6) / n);
        pts.push({ f: fi, u: uv[0], v: uv[1], k: crease ? 'crease' : 'edge' });
      }
    }
    for (var j = 0; j < 110; j++) pts.push({ f: fi, u: rand(), v: rand(), k: 'face' });
  });
  var dust = [];
  for (var d = 0; d < 220; d++) {
    var r = 1.6 + rand() * 1.8, th = rand() * Math.PI * 2, ph = Math.acos(rand() * 2 - 1);
    dust.push({ x: r * Math.sin(ph) * Math.cos(th), y: r * Math.sin(ph) * Math.sin(th), z: .5 + r * Math.cos(ph) * .6, ph: rand() * 6.3 });
  }
  pts.forEach(function (p) {
    p.sx = (rand() - .5) * 7; p.sy = (rand() - .5) * 7; p.sz = (rand() - .5) * 4;
    p.delay = rand() * .4;
  });

  /* ---- fold rhythm and camera, as fold.js -------------------------------- */
  var FOLD = 2600, HOLD_SHUT = 2200, UNFOLD = 2200, HOLD_FLAT = 1400;
  var CYCLE = FOLD + HOLD_SHUT + UNFOLD + HOLD_FLAT;
  var ASSEMBLE = 2400;
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
    col.edge = get('--accent', '#111111');
    col.crease = get('--faint', '#A8A8A8');
    col.ink = get('--ink-rgb', '17 17 17');
  }

  /* ---- sizing ------------------------------------------------------------ */
  var W = 0, H = 0, dpr = 1;
  function resize() {
    var rc = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = rc.width; H = rc.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!running) draw(performance.now());
  }

  /* ---- draw -------------------------------------------------------------- */
  // camera: azimuth and elevation, as fold.js; the spin, a drag and the arrow keys all move them
  var t0 = null, az = -.62, el = .6, last = null, dragging = false;
  function draw(now) {
    if (!W) return;
    if (t0 === null) t0 = now;
    var ms = now - t0;
    var build = reduced ? 1 : Math.min(1, ms / ASSEMBLE);
    var t = reduced ? Math.PI / 2 : (Math.PI / 2) * (ms < ASSEMBLE ? 0 : foldAt(ms - ASSEMBLE));
    var dt = last === null ? 0 : Math.min(now - last, 100);   // clamp after a background tab
    last = now;
    if (!reduced && !dragging) az += .14 * dt / 1000;
    var fl = faces(t);

    // fit like fold.js, but framed large so the box surrounds the headline
    var lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    fl.forEach(function (f) { f.p.forEach(function (p) { for (var i = 0; i < 3; i++) { if (p[i] < lo[i]) lo[i] = p[i]; if (p[i] > hi[i]) hi[i] = p[i]; } }); });
    var c = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2], rr = 0;
    fl.forEach(function (f) { f.p.forEach(function (p) { var dx = p[0] - c[0], dy = p[1] - c[1], dz = p[2] - c[2]; rr = Math.max(rr, Math.sqrt(dx * dx + dy * dy + dz * dz)); }); });
    // immersive: framed large around the headline; split: framed like fold.js in its stage
    var fit = layout() === 'split' ? Math.min(W, H) * .42 : Math.min(W * .44, H * .5);
    var scale = fit / rr, cx = W / 2, cy = H / 2;

    ctx.clearRect(0, 0, W, H);
    var inkFill = 'rgb(' + col.ink + ')';
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      var target = onFace(fl[p.f], p.u, p.v);
      var k = easeOut(Math.max(0, Math.min(1, (build - p.delay) / (1 - p.delay))));
      var pos = k >= 1 ? target : [p.sx + (target[0] - p.sx) * k, p.sy + (target[1] - p.sy) * k, p.sz + (target[2] - p.sz) * k];
      var q = project(pos, az, el, scale, cx, cy, c);
      var near = Math.max(.25, Math.min(1, 1 - (q.d + 1.2) / 3.2));  // front points stronger
      if (p.k === 'edge') { ctx.fillStyle = col.edge; ctx.globalAlpha = .35 + .6 * near; var z = 2.6 * q.w; ctx.fillRect(q.x - z / 2, q.y - z / 2, z, z); }
      else if (p.k === 'crease') { ctx.fillStyle = col.crease; ctx.globalAlpha = .3 + .55 * near; var zc = 2 * q.w; ctx.fillRect(q.x - zc / 2, q.y - zc / 2, zc, zc); }
      else { ctx.fillStyle = inkFill; ctx.globalAlpha = (.1 + .22 * near) * k; var zf = 1.6 * q.w; ctx.fillRect(q.x - zf / 2, q.y - zf / 2, zf, zf); }
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

  /* ---- run only while it matters ---------------------------------------- */
  var running = false, visible = true, raf = 0;
  function loop(now) { draw(now); raf = requestAnimationFrame(loop); }
  function sync() {
    place();
    var on = layout() !== null && visible;
    if (on && !reduced && !running) { running = true; t0 = null; raf = requestAnimationFrame(loop); }
    else if ((!on || reduced) && running) { running = false; cancelAnimationFrame(raf); }
    if (on && reduced) draw(performance.now());
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { visible = en[0].isIntersecting; sync(); }).observe(canvas);
  }
  window.addEventListener('themechange', function () { readColors(); resize(); sync(); });
  if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
  else window.addEventListener('resize', resize);
  /* ---- interaction, as the original hero: drag to turn, arrows to step ---
     The canvas sits behind the words, so the hero itself takes the drag.
     Links and buttons keep working; on touch, vertical swipes still scroll
     (touch-action: pan-y) and horizontal ones turn the box. */
  var hero = heroEl;
  var px = 0, py = 0;

  function nudge(dx, dy) {
    az += dx * .008;
    el = Math.max(.12, Math.min(1.35, el + dy * .006));
    if (!running) draw(performance.now());   // reduced motion has no loop; redraw now
  }
  hero.addEventListener('pointerdown', function (e) {
    var lay = layout();
    if (!lay || e.button > 0) return;
    // beside the text, only the box itself takes the drag, as in the original
    if (lay === 'split' && !(e.target.closest && e.target.closest('.stage'))) return;
    if (e.target.closest && e.target.closest('a,button,input,textarea,select,label')) return;
    dragging = true; px = e.clientX; py = e.clientY;
    hero.classList.add('dragging');
    if (e.pointerType === 'mouse') e.preventDefault();   // no text selection while turning
    try { hero.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ }
  });
  hero.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    var dx = e.clientX - px, dy = e.clientY - py;
    px = e.clientX; py = e.clientY;
    nudge(dx, dy);
  });
  function up() { dragging = false; hero.classList.remove('dragging'); }
  hero.addEventListener('pointerup', up);
  hero.addEventListener('pointercancel', up);
  hero.addEventListener('lostpointercapture', up);

  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'A box drawn in points, folding open and shut as it turns. Drag it, or use the arrow keys, to turn it.');
  canvas.addEventListener('keydown', function (e) {
    var step = 15;
    if (e.key === 'ArrowLeft') { nudge(-step, 0); e.preventDefault(); }
    if (e.key === 'ArrowRight') { nudge(step, 0); e.preventDefault(); }
    if (e.key === 'ArrowUp') { nudge(0, step * 1.33); e.preventDefault(); }
    if (e.key === 'ArrowDown') { nudge(0, -step * 1.33); e.preventDefault(); }
  });

  place(); readColors(); resize(); sync();
})();
