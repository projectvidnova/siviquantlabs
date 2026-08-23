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
    } catch (e) { /* clipboard unavailable — the mailto link still works */ }
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
