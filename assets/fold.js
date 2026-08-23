/* ==========================================================================
   Sivi Quant Labs, hero renderer
   A flat dieline folding into a closed box. Canvas 2D, perspective projection
   and hidden-surface ordering written from first principles. No dependencies.

   Cut edges draw solid; crease (fold) edges draw dashed, the same convention
   the printing industry uses on a real dieline.
   ========================================================================== */

(function () {
  'use strict';

  var stage = document.querySelector('[data-fold]');
  if (!stage) return;

  var canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label',
    'A flat packaging dieline folding into a closed three-dimensional box. Drag to rotate.');
  canvas.tabIndex = 0;
  stage.appendChild(canvas);

  var ctx = canvas.getContext('2d');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- geometry ---------------------------------------------------------
     Unit box, side s, base lying in the z = 0 plane centered on the origin.
     Four walls hinge on the four edges of the base; the lid hinges on the
     far edge of the +Y wall. `t` is the fold angle in radians: 0 is flat,
     PI/2 is closed.                                                        */

  var s = 1, h = s / 2;

  function faces(t) {
    var c = Math.cos(t), sn = Math.sin(t);

    // Lid rides on top of the +Y wall, so it turns through twice the angle.
    var hy = h + s * c, hz = s * sn;          // lid hinge, after the wall folds
    var c2 = Math.cos(2 * t), s2 = Math.sin(2 * t);

    return [
      // base, every edge is a crease
      { p: [[-h,-h,0], [h,-h,0], [h,h,0], [-h,h,0]], crease: [0,1,2,3] },

      // +Y wall (hinge on edge 0)
      { p: [[-h,h,0], [h,h,0], [h, h+s*c, s*sn], [-h, h+s*c, s*sn]], crease: [0] },
      // -Y wall
      { p: [[-h,-h,0], [h,-h,0], [h, -h-s*c, s*sn], [-h, -h-s*c, s*sn]], crease: [0] },
      // +X wall
      { p: [[h,-h,0], [h,h,0], [h+s*c, h, s*sn], [h+s*c, -h, s*sn]], crease: [0] },
      // -X wall
      { p: [[-h,-h,0], [-h,h,0], [-h-s*c, h, s*sn], [-h-s*c, -h, s*sn]], crease: [0] },

      // lid, hinged to the far edge of the +Y wall
      { p: [[-h, hy, hz], [h, hy, hz],
            [h, hy + s*c2, hz + s*s2], [-h, hy + s*c2, hz + s*s2]], crease: [0] }
    ];
  }

  /* ---- camera -----------------------------------------------------------
     Azimuth spins about world Z; elevation lifts the eye. Perspective divide
     by focal length; `depth` orders the faces back-to-front.               */

  var FOCAL = 4.2;

  function project(p, az, el, scale, cx, cy, c) {
    var x = p[0] - c[0], y = p[1] - c[1], z = p[2] - c[2];

    var ca = Math.cos(az), sa = Math.sin(az);
    var x1 =  x * ca - y * sa;
    var y1 =  x * sa + y * ca;

    var ce = Math.cos(el), se = Math.sin(el);
    var sy    =  z * ce - y1 * se;
    var depth = -(y1 * ce + z * se);

    var w = FOCAL / (FOCAL + depth);
    return { x: cx + x1 * scale * w, y: cy - sy * scale * w, d: depth };
  }

  /* ---- animation state -------------------------------------------------- */

  var az = -0.62, el = 0.60;          // radians
  var dragging = false, px = 0, py = 0, moved = false;
  var spin = reduced ? 0 : 0.14;      // radians / second
  var start = null;

  // fold cycle, in milliseconds
  var FOLD = 2600, HOLD_SHUT = 2200, UNFOLD = 2200, HOLD_FLAT = 1400;
  var CYCLE = FOLD + HOLD_SHUT + UNFOLD + HOLD_FLAT;

  function easeInOut(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }

  function foldAt(ms) {
    var u = ms % CYCLE;
    if (u < FOLD) return easeInOut(u / FOLD);
    u -= FOLD;
    if (u < HOLD_SHUT) return 1;
    u -= HOLD_SHUT;
    if (u < UNFOLD) return 1 - easeInOut(u / UNFOLD);
    return 0;
  }

  /* ---- sizing ----------------------------------------------------------- */

  var w = 0, hgt = 0, dpr = 1;

  function resize() {
    var r = stage.getBoundingClientRect();
    if (!r.width) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = r.width; hgt = r.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(hgt * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ---- draw ------------------------------------------------------------- */

  function draw(t) {
    if (!w) return;
    ctx.clearRect(0, 0, w, hgt);

    var fl = faces(t);

    // Auto-fit: center on the model's bounding box and scale by its bounding
    // radius. Both are measured before rotation, so the artwork stays centered
    // and framed at every fold angle without breathing as it spins.
    var lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    fl.forEach(function (f) {
      f.p.forEach(function (p) {
        for (var i = 0; i < 3; i++) {
          if (p[i] < lo[i]) lo[i] = p[i];
          if (p[i] > hi[i]) hi[i] = p[i];
        }
      });
    });
    var c = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];

    var r = 0;
    fl.forEach(function (f) {
      f.p.forEach(function (p) {
        var dx = p[0] - c[0], dy = p[1] - c[1], dz = p[2] - c[2];
        var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d > r) r = d;
      });
    });

    var scale = Math.min(w, hgt) * 0.46 / r;
    var cx = w / 2, cy = hgt / 2;

    var fs = fl.map(function (f) {
      var pts = f.p.map(function (p) { return project(p, az, el, scale, cx, cy, c); });
      var d = (pts[0].d + pts[1].d + pts[2].d + pts[3].d) / 4;
      return { pts: pts, crease: f.crease, d: d };
    });

    fs.sort(function (a, b) { return b.d - a.d; });   // painter's algorithm

    fs.forEach(function (f) {
      var p = f.pts;

      // opaque white fill gives us hidden-surface removal for free
      ctx.beginPath();
      ctx.moveTo(p[0].x, p[0].y);
      for (var i = 1; i < 4; i++) ctx.lineTo(p[i].x, p[i].y);
      ctx.closePath();
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // edges: creases dashed and grey, cut lines solid and black
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      for (var e = 0; e < 4; e++) {
        var a = p[e], b = p[(e + 1) % 4];
        var isCrease = f.crease.indexOf(e) !== -1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        if (isCrease) {
          ctx.setLineDash([4, 5]);
          ctx.strokeStyle = '#B4B4B4';
          ctx.lineWidth = 1;
        } else {
          ctx.setLineDash([]);
          ctx.strokeStyle = '#111111';
          ctx.lineWidth = 1.35;
        }
        ctx.stroke();
      }
      ctx.setLineDash([]);
    });
  }

  /* ---- loop ------------------------------------------------------------- */

  var last = null;

  function frame(now) {
    if (start === null) { start = now; last = now; }
    var dt = Math.min(now - last, 100);        // clamp after a background tab
    last = now;
    // Both the spin and the fold run off elapsed time, so the animation plays
    // at the same speed on a 60Hz and a 120Hz display.
    if (!dragging) az += spin * (dt / 1000);
    draw((Math.PI / 2) * foldAt(now - start));
    requestAnimationFrame(frame);
  }

  /* ---- interaction ------------------------------------------------------ */

  function down(x, y) { dragging = true; moved = false; px = x; py = y; }

  function move(x, y) {
    if (!dragging) return;
    var dx = x - px, dy = y - py;
    px = x; py = y;
    if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
    az += dx * 0.008;
    el = Math.max(0.12, Math.min(1.35, el + dy * 0.006));
  }

  function up() { dragging = false; }

  canvas.addEventListener('pointerdown', function (e) {
    canvas.setPointerCapture(e.pointerId);
    down(e.clientX, e.clientY);
  });
  canvas.addEventListener('pointermove', function (e) {
    if (dragging) { e.preventDefault(); move(e.clientX, e.clientY); }
  });
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('lostpointercapture', up);

  canvas.addEventListener('keydown', function (e) {
    var step = 0.12;
    if (e.key === 'ArrowLeft')  { az -= step; e.preventDefault(); }
    if (e.key === 'ArrowRight') { az += step; e.preventDefault(); }
    if (e.key === 'ArrowUp')    { el = Math.min(1.35, el + step); e.preventDefault(); }
    if (e.key === 'ArrowDown')  { el = Math.max(0.12, el - step); e.preventDefault(); }
  });

  /* ---- boot ------------------------------------------------------------- */

  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
  else window.addEventListener('resize', resize);

  resize();
  if (reduced) draw(Math.PI / 2);
  else requestAnimationFrame(frame);
})();
