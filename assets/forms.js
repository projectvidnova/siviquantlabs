/* ==========================================================================
   Sivi Quant Labs, contact and application dialog.

   Any link carrying data-form opens this dialog instead of the mail client.
   Links keep their mailto: href, so with JavaScript unavailable the button
   still does something useful rather than nothing.

   Submission is a normal form POST to FormSubmit, deliberately not fetch():
   FormSubmit only sends the _autoresponse confirmation to the person who
   filled the form when the request is a real POST. The browser lands on
   /thanks/ via _next.
   ========================================================================== */

(function () {
  'use strict';

  var ENDPOINT = 'https://formsubmit.co/connect@siviquantlabs.com';
  var THANKS   = 'https://siviquantlabs.com/thanks/';

  var ROLES = [
    'Junior Developer',
    'Junior Designer',
    'Senior Developer',
    'Something else'
  ];

  var COPY = {
    general: {
      title: 'Talk to us.',
      sub: 'Tell us the outcome you want to move. We read everything that comes in, and we reply from a person.',
      label: 'What would you like to move?',
      placeholder: 'A cost, a cycle time, a conversion rate, or just the problem as you see it.',
      submit: 'Send',
      subject: 'Website enquiry',
      auto: 'Thanks for getting in touch with Sivi Quant Labs. We have your message and a person will reply, usually within one working day. This is an automatic confirmation so you know it arrived, no need to reply to it.'
    },
    apply: {
      title: 'Apply.',
      sub: 'Send us your work. We hire on what you can build, so links to real things count for more than a CV.',
      label: 'Anything you want to tell us',
      placeholder: 'What you built, what your part in it was, and why you want to work on this.',
      submit: 'Submit application',
      subject: 'Job application',
      auto: 'Thanks for applying to Sivi Quant Labs. Your application has arrived and a person will read it. This is an automatic confirmation so you know it got through, no need to reply to it.'
    }
  };

  var dlg = null, form = null, lastFocus = null;

  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { n.appendChild(c); });
    return n;
  }

  function field(opts) {
    var wrap = el('div', { 'class': 'field', 'data-field': opts.name });
    var lab = el('label', { 'for': 'f_' + opts.name });
    lab.textContent = opts.label;
    if (opts.optional) {
      lab.appendChild(el('span', { 'class': 'opt', text: '  (optional)' }));
    }
    wrap.appendChild(lab);

    var input;
    if (opts.type === 'textarea') {
      input = el('textarea', { rows: '4' });
    } else if (opts.type === 'select') {
      input = el('select');
      opts.options.forEach(function (o) {
        var op = el('option', { value: o, text: o });
        input.appendChild(op);
      });
    } else {
      input = el('input', { type: opts.type || 'text' });
    }
    input.id = 'f_' + opts.name;
    input.name = opts.name;
    if (opts.required) input.required = true;
    if (opts.placeholder) input.placeholder = opts.placeholder;
    if (opts.autocomplete) input.autocomplete = opts.autocomplete;
    if (opts.inputmode) input.inputMode = opts.inputmode;
    wrap.appendChild(input);
    wrap.appendChild(el('div', { 'class': 'err', text: opts.error || 'This field is required.' }));
    return wrap;
  }

  function build() {
    dlg = el('dialog', { 'class': 'modal', 'aria-labelledby': 'modal-title' });
    var inner = el('div', { 'class': 'modal-inner' });

    var head = el('div', { 'class': 'modal-head' });
    var titleWrap = el('div');
    titleWrap.appendChild(el('h2', { id: 'modal-title', text: '' }));
    titleWrap.appendChild(el('p', { 'class': 'modal-sub', text: '' }));
    head.appendChild(titleWrap);
    var close = el('button', { type: 'button', 'class': 'modal-close', 'aria-label': 'Close' });
    close.innerHTML = '&times;';
    close.addEventListener('click', function () { dlg.close(); });
    head.appendChild(close);
    inner.appendChild(head);

    form = el('form', { method: 'POST', action: ENDPOINT, novalidate: 'novalidate' });

    // FormSubmit control fields
    form.appendChild(el('input', { type: 'hidden', name: '_next', value: THANKS }));
    form.appendChild(el('input', { type: 'hidden', name: '_subject', value: '' }));
    form.appendChild(el('input', { type: 'hidden', name: '_autoresponse', value: '' }));
    form.appendChild(el('input', { type: 'hidden', name: '_template', value: 'table' }));
    form.appendChild(el('input', { type: 'hidden', name: '_captcha', value: 'false' }));
    // honeypot
    var hp = el('div', { 'class': 'hp', 'aria-hidden': 'true' });
    hp.appendChild(el('input', { type: 'text', name: '_honey', tabindex: '-1', autocomplete: 'off' }));
    form.appendChild(hp);

    form.appendChild(field({ name: 'name', label: 'Your name', required: true,
      autocomplete: 'name', error: 'Please tell us your name.' }));
    form.appendChild(field({ name: 'email', label: 'Email', type: 'email', required: true,
      autocomplete: 'email', placeholder: 'you@company.com',
      error: 'We need a valid email address to reply to.' }));
    form.appendChild(field({ name: 'mobile', label: 'Mobile', type: 'tel', optional: true,
      autocomplete: 'tel', inputmode: 'tel', placeholder: '+91 00000 00000' }));

    // apply-only fields, shown or hidden per mode
    form.appendChild(field({ name: 'role', label: 'Role', type: 'select', options: ROLES }));
    form.appendChild(field({ name: 'links', label: 'Links to your work', optional: true,
      placeholder: 'GitHub, portfolio, or a video walkthrough' }));

    form.appendChild(field({ name: 'message', label: '', type: 'textarea', required: true,
      error: 'Please add a short message.' }));

    var actions = el('div', { 'class': 'modal-actions' });
    var submit = el('button', { type: 'submit', 'class': 'btn btn-solid', text: 'Send' });
    actions.appendChild(submit);
    var cancel = el('button', { type: 'button', 'class': 'btn btn-ghost', text: 'Cancel' });
    cancel.addEventListener('click', function () { dlg.close(); });
    actions.appendChild(cancel);
    form.appendChild(actions);

    form.appendChild(el('p', { 'class': 'modal-note',
      text: 'We will email you a confirmation so you know it arrived. We use your details only to reply to this enquiry.' }));

    form.addEventListener('submit', validate);
    inner.appendChild(form);
    dlg.appendChild(inner);
    document.body.appendChild(dlg);

    dlg.addEventListener('close', function () {
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    });
    // clicking the backdrop closes
    dlg.addEventListener('click', function (e) {
      if (e.target === dlg) dlg.close();
    });
  }

  function setField(name, visible, required) {
    var f = form.querySelector('[data-field="' + name + '"]');
    if (!f) return;
    f.hidden = !visible;
    f.style.display = visible ? '' : 'none';
    var input = f.querySelector('input,select,textarea');
    if (input) {
      input.required = !!required && visible;
      input.disabled = !visible;      // disabled fields are not submitted
    }
  }

  function validate(e) {
    var ok = true, firstBad = null;
    Array.prototype.forEach.call(form.querySelectorAll('.field'), function (f) {
      var input = f.querySelector('input,select,textarea');
      if (!input || input.disabled || f.style.display === 'none') return;
      var bad = !input.checkValidity();
      f.classList.toggle('invalid', bad);
      if (bad) { ok = false; if (!firstBad) firstBad = input; }
    });
    if (!ok) {
      e.preventDefault();
      if (firstBad) firstBad.focus();
    }
    // valid: fall through and let the browser POST normally
  }

  function open(opts) {
    if (!dlg) build();
    var mode = opts.mode === 'apply' ? 'apply' : 'general';
    var c = COPY[mode];

    dlg.querySelector('#modal-title').textContent = opts.title || c.title;
    dlg.querySelector('.modal-sub').textContent = opts.sub || c.sub;

    var msg = form.querySelector('[data-field="message"]');
    msg.querySelector('label').textContent = c.label;
    msg.querySelector('textarea').placeholder = c.placeholder;

    form.querySelector('button[type="submit"]').textContent = c.submit;

    var isApply = mode === 'apply';
    setField('role', isApply, true);
    setField('links', isApply, false);

    if (isApply && opts.role) {
      var sel = form.querySelector('#f_role');
      for (var i = 0; i < sel.options.length; i++) {
        if (sel.options[i].value === opts.role) { sel.selectedIndex = i; break; }
      }
    }

    // The role travels as its own form field, so only fall back to appending
    // it when the caller gave no subject of its own.
    form.querySelector('[name="_subject"]').value =
      opts.subject || (c.subject + (isApply && opts.role ? ' - ' + opts.role : ''));
    form.querySelector('[name="_autoresponse"]').value = c.auto;

    Array.prototype.forEach.call(form.querySelectorAll('.field'), function (f) {
      f.classList.remove('invalid');
    });

    lastFocus = document.activeElement;
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', '');
    var first = form.querySelector('#f_name');
    if (first) first.focus();
  }

  // Intercept every trigger. Without JS these stay ordinary mailto: links.
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-form]');
    if (!t) return;
    if (typeof HTMLDialogElement === 'undefined') return;   // let mailto happen
    e.preventDefault();
    open({
      mode: t.getAttribute('data-form'),
      role: t.getAttribute('data-role') || '',
      subject: t.getAttribute('data-subject') || '',
      title: t.getAttribute('data-title') || '',
      sub: t.getAttribute('data-sub') || ''
    });
  });
})();
