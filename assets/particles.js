/* Immersive hero (PROTOTYPE): the hero's 3D box redrawn as a point cloud.
   Edge points take the accent colour, face and dust points the band ink.
   The points assemble on load, then the box turns slowly. It only animates
   while the immersive hero is on and on screen; reduced motion gets one
   still, assembled frame. */
(function () {
  'use strict';
  var canvas = document.querySelector('canvas.particles');
  if (!canvas) return;
  var root = document.documentElement;
  var ctx = canvas.getContext('2d');
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- geometry: a unit cube as edge, face and dust points --------------- */
  var pts = [];
  var rand = (function (s) { return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })(7);
  var V = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
  var E = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
  E.forEach(function (e) {
    for (var i = 0; i <= 70; i++) {
      var t = i / 70, a = V[e[0]], b = V[e[1]], j = 0.012;
      pts.push({ x: a[0] + (b[0] - a[0]) * t + (rand() - .5) * j, y: a[1] + (b[1] - a[1]) * t + (rand() - .5) * j,
                 z: a[2] + (b[2] - a[2]) * t + (rand() - .5) * j, k: 'edge' });
    }
  });
  for (var f = 0; f < 520; f++) {           // sparse points on the six faces
    var ax = Math.floor(rand() * 3), s = rand() < .5 ? -1 : 1, p = [rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1];
    p[ax] = s;
    pts.push({ x: p[0], y: p[1], z: p[2], k: 'face' });
  }
  for (var d = 0; d < 260; d++) {           // ambient dust in a wide shell
    var r = 2.2 + rand() * 2.6, th = rand() * Math.PI * 2, ph = Math.acos(rand() * 2 - 1);
    pts.push({ x: r * Math.sin(ph) * Math.cos(th), y: r * Math.cos(ph) * .7, z: r * Math.sin(ph) * Math.sin(th), k: 'dust' });
  }
  // every point starts somewhere random and flies home
  pts.forEach(function (p) {
    p.sx = (rand() - .5) * 9; p.sy = (rand() - .5) * 6; p.sz = (rand() - .5) * 9;
    p.delay = rand() * .35;
  });

  /* ---- colours from the page tokens ------------------------------------- */
  var col = {};
  function readColors() {
    var cs = getComputedStyle(root);
    var get = function (n, fb) { return (cs.getPropertyValue(n) || '').trim() || fb; };
    col.edge = get('--accent-band', '#FF4F00');
    col.ink = get('--band-ink-rgb', '255 255 255');
  }

  /* ---- sizing ------------------------------------------------------------ */
  var w = 0, h = 0, dpr = 1;
  function resize() {
    var r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = r.width; h = r.height;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!running) draw(performance.now());
  }

  /* ---- draw -------------------------------------------------------------- */
  var t0 = null;
  function ease(x) { return x >= 1 ? 1 : 1 - Math.pow(1 - x, 3); }

  function draw(now) {
    if (!w) return;
    if (t0 === null) t0 = now;
    var el = (now - t0) / 1000;
    var build = reduced ? 1 : el / 2.6;
    var ay = reduced ? .75 : .75 + el * .12, ax = -.42;
    var cy = Math.cos(ay), sy = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax);
    // big enough that the box frames the headline instead of crossing it
    var scale = Math.min(w * .3, h * .36), ox = w / 2, oy = h / 2;
    ctx.clearRect(0, 0, w, h);
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      var k = ease(Math.max(0, Math.min(1, (build - p.delay) / (1 - p.delay))));
      var x = p.sx + (p.x - p.sx) * k, y = p.sy + (p.y - p.sy) * k, z = p.sz + (p.z - p.sz) * k;
      if (p.k === 'dust' && !reduced) y += Math.sin(el * .6 + i) * .04;
      var x1 = x * cy - z * sy, z1 = x * sy + z * cy;          // turn around Y
      var y2 = y * cx - z1 * sx, z2 = y * sx + z1 * cx;        // tilt around X
      var persp = 4.2 / (4.2 + z2);
      var X = ox + x1 * scale * persp, Y = oy + y2 * scale * persp;
      var depth = Math.max(0, Math.min(1, (z2 + 2.5) / 5));  // 0 near, 1 far
      if (p.k === 'edge') {
        ctx.fillStyle = col.edge;
        ctx.globalAlpha = .72 - depth * .5;
        ctx.fillRect(X, Y, 1.9 * persp, 1.9 * persp);
      } else {
        ctx.fillStyle = 'rgb(' + col.ink + ')';
        ctx.globalAlpha = (p.k === 'face' ? .5 : .28) * (1 - depth * .6);
        var sz = (p.k === 'face' ? 1.3 : 1.1) * persp;
        ctx.fillRect(X, Y, sz, sz);
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ---- run only while it matters ---------------------------------------- */
  var running = false, visible = true, raf = 0;
  function loop(now) { draw(now); raf = requestAnimationFrame(loop); }
  function sync() {
    var on = root.getAttribute('data-hero') === 'immersive' && visible;
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
  readColors(); resize(); sync();
})();
