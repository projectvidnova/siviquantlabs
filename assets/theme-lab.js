/* Theme lab (PROTOTYPE ONLY): applies neutral / mode / accent to <html>,
   remembers the choice across the preview pages, and tells the page (the 3D
   hero) to repaint. The first paint is handled by a tiny inline script in
   <head>, so there is no flash of the wrong theme. */
(function () {
  'use strict';
  var root = document.documentElement;
  var KEY = 'sql-theme-lab';
  var DEFAULTS = { accent: 'signal', neutral: 'graphite', mode: 'system',
                   type: 'refined', hero: 'standard', media: 'tinted', extras: 'on' };
  var CURRENT_SITE = { accent: 'mono', neutral: 'pure', mode: 'light',
                       type: 'current', hero: 'standard', media: 'grey', extras: 'off' };
  var LAYOUT = ['type', 'hero', 'media', 'extras'];
  var DARK_MODES = { dim: 1, dark: 1, midnight: 1 };
  var NOTES = {
    light: 'The default. White page, near-black text.',
    dim: 'A softer dark: charcoal rather than black. Easier on the eyes for long reading.',
    dark: 'Near-black. The standard dark mode.',
    midnight: 'True black. Saves power on OLED phones; strongest night-time comfort.',
    contrast: 'For low vision: pure black on white, strong borders, no translucency, thicker focus rings. Follows the device\'s "increase contrast" setting under System.',
    system: 'Follows the device: light or dark, and high contrast when the device asks for it.'
  };
  var mq = function (q) { return window.matchMedia ? window.matchMedia(q) : null; };
  var darkMq = mq('(prefers-color-scheme: dark)');
  var moreMq = mq('(prefers-contrast: more)');

  var state;
  try { state = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { state = {}; }
  Object.keys(DEFAULTS).forEach(function (k) { if (!state[k]) state[k] = DEFAULTS[k]; });

  function resolve(mode) {
    if (mode !== 'system') return mode;
    if (moreMq && moreMq.matches && !(darkMq && darkMq.matches)) return 'contrast';
    return darkMq && darkMq.matches ? 'dark' : 'light';
  }

  function label(kind, value) {
    var b = document.querySelector('.lab [data-set="' + kind + ':' + value + '"]');
    return b ? b.textContent.trim() : value;
  }

  function apply() {
    var theme = resolve(state.mode);
    root.setAttribute('data-accent', state.accent);
    root.setAttribute('data-neutral', state.neutral);
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-tone', DARK_MODES[theme] ? 'dark' : 'light');
    LAYOUT.forEach(function (k) { root.setAttribute('data-' + k, state[k]); });
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage blocked */ }

    Array.prototype.forEach.call(document.querySelectorAll('.lab [data-set]'), function (b) {
      var kv = b.getAttribute('data-set').split(':');
      b.setAttribute('aria-pressed', state[kv[0]] === kv[1] ? 'true' : 'false');
    });
    var sum = document.querySelector('.lab-sum');
    if (sum) {
      var m = label('mode', state.mode) + (state.mode === 'system' ? ' (' + label('mode', theme) + ')' : '');
      var changed = LAYOUT.filter(function (k) { return state[k] !== CURRENT_SITE[k]; }).length;
      sum.textContent = label('accent', state.accent) + ' · ' + label('neutral', state.neutral) + ' · ' + m +
        (changed ? ' · ' + changed + ' layout change' + (changed > 1 ? 's' : '') : '');
    }
    var note = document.querySelector('.lab-note');
    if (note) note.textContent = NOTES[state.mode] || '';
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', getComputedStyle(root).getPropertyValue('--bg').trim());
    window.dispatchEvent(new Event('themechange'));
    // let the glass header re-check what it is floating over (the hero may have turned dark)
    window.dispatchEvent(new Event('scroll'));
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target : null;
    if (!t) return;
    var b = t.closest('.lab [data-set]');
    if (b) {
      var kv = b.getAttribute('data-set').split(':');
      state[kv[0]] = kv[1];
      apply();
      return;
    }
    var p = t.closest('.lab [data-preset]');
    if (p) {
      var src = p.getAttribute('data-preset') === 'current' ? CURRENT_SITE : DEFAULTS;
      state = {};
      Object.keys(src).forEach(function (k) { state[k] = src[k]; });
      apply();
      return;
    }
    var tg = t.closest('.lab-toggle');
    if (tg) {
      var lab = tg.closest('.lab');
      var open = !lab.classList.contains('open');
      lab.classList.toggle('open', open);
      tg.setAttribute('aria-expanded', open ? 'true' : 'false');
      tg.textContent = open ? 'Close' : 'Adjust';
    }
  });

  [darkMq, moreMq].forEach(function (q) {
    if (!q) return;
    var on = function () { if (state.mode === 'system') apply(); };
    if (q.addEventListener) q.addEventListener('change', on);
    else if (q.addListener) q.addListener(on);
  });

  // open by default on wide screens, collapsed on phones
  var lab = document.querySelector('.lab');
  if (lab && window.innerWidth > 900) {
    lab.classList.add('open');
    var tg = lab.querySelector('.lab-toggle');
    if (tg) { tg.setAttribute('aria-expanded', 'true'); tg.textContent = 'Close'; }
  }
  apply();
})();
