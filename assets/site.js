/* Shared behaviour: email-copy confirmation + a light scroll reveal. */
(function () {
  'use strict';

  /* ---- copy any mailto address, whether or not a mail client opens ------ */

  function fallbackCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    } catch (e) { /* clipboard unavailable, the mailto link still works */ }
  }

  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)['catch'](function () { fallbackCopy(text); });
    } else {
      fallbackCopy(text);
    }
  }

  var toast = document.getElementById('toast');
  var timer;

  function show(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('on');
    clearTimeout(timer);
    timer = setTimeout(function () { toast.classList.remove('on'); }, 2800);
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="mailto:"]');
    if (!a) return;
    // Triggers that open the contact dialog handle their own click.
    if (a.hasAttribute('data-form')) return;
    var addr = (a.getAttribute('href') || '').replace(/^mailto:/i, '').split('?')[0];
    if (!addr) return;
    copy(decodeURIComponent(addr));
    show('✓  ' + decodeURIComponent(addr) + ' copied to clipboard');
  });

  /* ---- scroll reveal ---------------------------------------------------- */

  var targets = document.querySelectorAll('.reveal');
  if (!targets.length) return;

  if (!('IntersectionObserver' in window) ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    Array.prototype.forEach.call(targets, function (el) { el.classList.add('in'); });
    return;
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });

  Array.prototype.forEach.call(targets, function (el) { io.observe(el); });
})();

/* Mobile menu + in-page sub-navigation. */
(function () {
  'use strict';

  /* ---- mobile menu ------------------------------------------------------ */

  var btn = document.querySelector('.menu-btn');
  var menu = document.getElementById('menu');
  if (btn && menu) {
    var root = document.documentElement;

    var setOpen = function (open, restoreFocus) {
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      menu.hidden = !open;
      root.classList.toggle('menu-open', open);
      if (open) {
        var first = menu.querySelector('a');
        if (first) first.focus();
      } else if (restoreFocus) {
        btn.focus();
      }
    };

    btn.addEventListener('click', function () {
      setOpen(btn.getAttribute('aria-expanded') !== 'true', true);
    });

    // Any link in the menu (including the contact dialog trigger) closes it.
    menu.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('a')) setOpen(false, false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !menu.hidden) setOpen(false, true);
    });

    // Rotating a phone or widening a window past the breakpoint.
    var wide = window.matchMedia('(min-width: 721px)');
    var onWide = function () { if (wide.matches && !menu.hidden) setOpen(false, false); };
    if (wide.addEventListener) wide.addEventListener('change', onWide);
    else if (wide.addListener) wide.addListener(onWide);
  }

  /* ---- sub-navigation: mark the section in view ------------------------- */

  var bar = document.querySelector('.subnav-links');
  if (!bar) return;

  var links = Array.prototype.slice.call(bar.querySelectorAll('a[href^="#"]'));
  var byId = {};
  var sections = [];
  links.forEach(function (a) {
    var el = document.getElementById(a.getAttribute('href').slice(1));
    if (el) { byId[el.id] = a; sections.push(el); }
  });
  if (!sections.length) return;

  var current = null;
  var mark = function (id) {
    if (id === current) return;
    current = id;
    links.forEach(function (a) { a.removeAttribute('aria-current'); });
    var a = byId[id];
    if (!a) return;
    a.setAttribute('aria-current', 'true');
    // Keep the active link visible when the bar scrolls sideways on phones,
    // without moving the page itself.
    var l = a.offsetLeft, r = l + a.offsetWidth;
    if (l < bar.scrollLeft || r > bar.scrollLeft + bar.clientWidth) {
      bar.scrollTo({ left: Math.max(0, l - 24), behavior: 'smooth' });
    }
  };

  // The active section is the last one whose top has passed the line just
  // under the two sticky bars. At the very bottom of the page the last
  // section wins even if it is too short to reach that line.
  var LINE = 150;
  var update = function () {
    var id = sections[0].id;
    for (var i = 0; i < sections.length; i++) {
      if (sections[i].getBoundingClientRect().top <= LINE) id = sections[i].id;
    }
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
      var last = sections[sections.length - 1];
      if (last.getBoundingClientRect().top < window.innerHeight) id = last.id;
    }
    mark(id);
  };
  var queued = false;
  window.addEventListener('scroll', function () {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; update(); });
  }, { passive: true });
  window.addEventListener('resize', update);
  update();
})();
