/*
 * common.js — shared helpers used by nav.js / pages.js.
 * Classic script, no modules. Exposes one global: window.Mabda
 */
(function () {
  'use strict';

  var FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
  var AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
  var LATIN = '0123456789';
  var THOUSAND = '٬';
  var DECIMAL = '٫';
  var LOCK_CLASS = 'has-overlay';
  var IGNORED_TAGS = { SCRIPT: 1, NOSCRIPT: 1, TEMPLATE: 1, STYLE: 1, LINK: 1, META: 1 };

  var records = {};   // overlay id -> record
  var stack = [];     // overlay ids in open order (innermost last)
  var lastClosed = null;
  var historyWorks = true;
  var pendingOpener = null;
  var toastTimer = null;
  function $(selector, root) {
    if (!root) root = document;
    return root.querySelector ? root.querySelector(selector) : null;
  }
  function qa(selector, root) {
    if (!root) root = document;
    var list = root.querySelectorAll ? root.querySelectorAll(selector) : [];
    return Array.prototype.slice.call(list);
  }
  function attr(el, name) {
    return el && el.getAttribute ? el.getAttribute(name) : null;
  }

  /* ---------- text / data ---------- */

  function ui(path) {
    var data = window.SITE_DATA;
    var node = data && data.ui;
    if (!node) return null;
    var parts = String(path).split('.');
    for (var i = 0; i < parts.length; i += 1) {
      if (!node || typeof node !== 'object') return null;
      node = node[parts[i]];
    }
    return typeof node === 'string' ? node : null;
  }

  function fill(template, map) {
    var text = String(template === null || template === undefined ? '' : template);
    if (!map) return text;
    return text.replace(/\{(\w+)\}/g, function (whole, key) {
      return key in map ? String(map[key]) : whole;
    });
  }

  /* ---------- digits ---------- */

  function toLatin(value) {
    if (value === null || value === undefined) return '';
    var s = String(value), out = '', i, c, index;
    for (i = 0; i < s.length; i += 1) {
      c = s.charAt(i);
      index = FA_DIGITS.indexOf(c);
      if (index !== -1) { out += LATIN.charAt(index); continue; }
      index = AR_DIGITS.indexOf(c);
      if (index !== -1) { out += LATIN.charAt(index); continue; }
      if (c === DECIMAL) { out += '.'; continue; }
      if (c === THOUSAND) { continue; }
      out += c;
    }
    return out;
  }

  function toFa(value) {
    if (value === null || value === undefined) return '';
    var s = String(value), out = '', i, index;
    for (i = 0; i < s.length; i += 1) {
      index = LATIN.indexOf(s.charAt(i));
      out += index === -1 ? s.charAt(i) : FA_DIGITS.charAt(index);
    }
    return out;
  }

  function group(value) {
    var text = toLatin(value).trim();
    if (!text) return '';
    var parts = text.replace(/[^\d.\-]/g, '').split('.');
    var int = parts[0] || '0', frac = parts.length > 1 ? parts.slice(1).join('') : '';
    var signed = int.charAt(0) === '-';
    if (signed) int = int.slice(1);
    var out = '', i, rem;
    for (i = 0; i < int.length; i += 1) {
      out += int.charAt(i);
      rem = int.length - i - 1;
      if (rem > 0 && rem % 3 === 0) out += THOUSAND;
    }
    return (signed ? '-' : '') + toFa(out) + (frac ? DECIMAL + toFa(frac) : '');
  }

  /* ---------- storage ---------- */

  var memory = {};
  var storage = (function () {
    try {
      var probe = '__mabda_probe__';
      window.sessionStorage.setItem(probe, '1');
      window.sessionStorage.removeItem(probe);
      return window.sessionStorage;
    } catch (err) {
      return null;
    }
  })();

  var store = {
    get: function (key, fallback) {
      try {
        var value = storage ? storage.getItem(key) : memory[key];
        return value === null || value === undefined ? (fallback === undefined ? null : fallback) : value;
      } catch (err) {
        return fallback === undefined ? null : fallback;
      }
    },
    set: function (key, value) {
      try {
        if (storage) storage.setItem(key, String(value));
        else memory[key] = String(value);
        return true;
      } catch (err) {
        return false;
      }
    },
    del: function (key) {
      try {
        if (storage) storage.removeItem(key);
        else delete memory[key];
      } catch (err) { /* ignore */ }
    },
    getJson: function (key, fallback) {
      var raw = store.get(key, null);
      if (raw === null) return fallback;
      try {
        return JSON.parse(raw);
      } catch (err) {
        return fallback;
      }
    },
    setJson: function (key, value) {
      var raw;
      try {
        raw = JSON.stringify(value);
      } catch (err) {
        return false;
      }
      return store.set(key, raw);
    }
  };

  /* ---------- toast ---------- */

  function toast(message, ms) {
    var el = document.getElementById('toast');
    if (!el) return;
    var text = message === null || message === undefined ? '' : String(message);
    if (!text) return;
    el.textContent = text;
    el.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove('show');
      toastTimer = null;
    }, ms || 2800);
  }

  function toastFor(el, fallbackPath) {
    var text = attr(el, 'data-toast');
    if (!text) text = ui(fallbackPath || 'toasts.placeholder');
    toast(text);
  }

  /* ---------- focus ---------- */

  var FOCUSABLE = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  function isRendered(el) {
    if (!el || !el.getClientRects) return false;
    if (el.closest && el.closest('[hidden]')) return false;
    return el.getClientRects().length > 0 || el === document.activeElement;
  }

  function focusables(root) {
    return qa(FOCUSABLE, root).filter(function (el) {
      return isRendered(el) && (!root || root.contains(el));
    });
  }

  function focusFirst(root) {
    if (!root) return false;
    var target = $('[data-autofocus]', root);
    if (!target) {
      var list = focusables(root);
      target = list.length ? list[0] : null;
    }
    if (!target || !isRendered(target)) return false;
    try {
      target.focus({ preventScroll: true });
    } catch (err) {
      try { target.focus(); } catch (err2) { return false; }
    }
    if (document.activeElement !== target) {
      try { target.focus(); } catch (err3) { return false; }
    }
    return true;
  }

  function trap(container) {
    if (!container) return null;

    function onKey(event) {
      if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) return;
      var list = focusables(container);
      if (!list.length) {
        event.preventDefault();
        return;
      }
      var first = list[0];
      var last = list[list.length - 1];
      var active = document.activeElement;
      if (!container.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    container.addEventListener('keydown', onKey);
    return {
      stop: function () {
        container.removeEventListener('keydown', onKey);
      }
    };
  }

  /* ---------- background inert + scroll lock ---------- */

  function setInert(el, on) {
    if (!el || el.nodeType !== 1) return;
    try {
      el.inert = !!on;
    } catch (err) { /* older browsers: aria-hidden only */ }
    if (on) el.setAttribute('aria-hidden', 'true');
    else if (el.getAttribute('aria-hidden') === 'true') el.removeAttribute('aria-hidden');
  }

  function overlayHost() {
    return $('.overlay-host');
  }

  // Every node that must become inert while `dialog` is the top modal overlay.
  function nodesToInert(dialog) {
    var list = [];
    var body = document.body;
    if (!body) return list;
    var children = body.children;
    var i, j, node;
    for (i = 0; i < children.length; i += 1) {
      node = children[i];
      if (IGNORED_TAGS[node.tagName]) continue;
      if (node === dialog) continue;
      if (node.id === 'toast') continue;
      if (node.contains && node.contains(dialog)) {
        for (j = 0; j < node.children.length; j += 1) {
          if (node.children[j] !== dialog && node.children[j].id !== 'toast') list.push(node.children[j]);
        }
        continue;
      }
      list.push(node);
    }
    return list;
  }

  function topmostModal() {
    for (var i = stack.length - 1; i >= 0; i -= 1) {
      var record = records[stack[i]];
      if (record && record.modal && record.el && !record.el.hasAttribute('hidden')) return record.el;
    }
    return null;
  }

  function allOverlayNodes() {
    var nodes = [], host = overlayHost(), i;
    if (document.body) {
      for (i = 0; i < document.body.children.length; i += 1) nodes.push(document.body.children[i]);
    }
    if (host) {
      for (i = 0; i < host.children.length; i += 1) nodes.push(host.children[i]);
    }
    return nodes;
  }

  function syncBackground() {
    var top = topmostModal();
    var inert = top ? nodesToInert(top) : [];
    var nodes = allOverlayNodes();
    for (var i = 0; i < nodes.length; i += 1) {
      var node = nodes[i];
      if (IGNORED_TAGS[node.tagName] || node.id === 'toast' || node === top) continue;
      if (top && node.contains && node.contains(top)) continue; // wrapper around the dialog
      setInert(node, !!top && inert.indexOf(node) !== -1);
    }
    var locked = !!top;
    var html = document.documentElement;
    if (document.body) document.body.classList.toggle(LOCK_CLASS, locked);
    if (html && html.classList) html.classList.toggle(LOCK_CLASS, locked);
  }

  /* ---------- history (Back closes overlays) ---------- */

  function pushState(id) {
    if (!historyWorks || typeof history.pushState !== 'function') return;
    try {
      history.pushState({ mabdaOverlay: id }, '');
    } catch (err) {
      historyWorks = false;
    }
  }

  // Step back over the entry we pushed for `id`, and remember that this pop is ours.
  function backState(id) {
    if (!historyWorks || typeof history.back !== 'function') return;
    var current = null;
    try {
      current = history.state ? history.state.mabdaOverlay : null;
    } catch (err) { /* ignore */ }
    if (current !== id) return;
    lastClosed = id;
    try {
      history.back();
    } catch (err) {
      lastClosed = null;
    }
  }

  function onPopState() {
    if (lastClosed) {
      lastClosed = null;   // this pop came from our own close(); the layer below stays open
      // With a #hash in the URL the browser re-focuses the fragment target after this pop.
      var opener = pendingOpener;
      pendingOpener = null;
      if (opener) setTimeout(function () { restoreFocus(opener); }, 0);
      return;
    }
    var top = stack.length ? stack[stack.length - 1] : null;
    if (!top) return;
    var record = records[top];
    if (!record || !record.el) {
      stack.pop();
      return;
    }
    close(record.el, { restore: false, history: false });
  }

  /* ---------- overlay controller ---------- */

  function idOf(el) {
    if (!el.id) el.id = 'overlay-' + (idOf.n = (idOf.n || 0) + 1);
    return el.id;
  }

  function isOpen(el) {
    return !!el && !el.hasAttribute('hidden');
  }

  function emit(el, name) {
    try {
      el.dispatchEvent(new CustomEvent('mabda:' + name, { bubbles: false }));
    } catch (err) { /* very old browsers: callers fall back to isOpen() */ }
  }

  function open(el, options) {
    if (!el || isOpen(el)) return null;
    var opts = options || {};
    var id = idOf(el);
    var opener = opts.opener && opts.opener !== el ? opts.opener : document.activeElement;
    if (opener && el.contains(opener)) opener = null;

    var record = records[id] || {
      el: el,
      modal: opts.modal !== false,
      trapOn: opts.trap !== false,
      handle: null,
      opener: null
    };
    record.modal = opts.modal !== false;
    record.trapOn = opts.trap !== false;
    record.opener = opener || null;
    records[id] = record;

    el.removeAttribute('hidden');
    stack.push(id);

    if (record.modal) syncBackground();
    if (record.trapOn && !record.handle) record.handle = trap(el);

    pushState(id);

    if (opts.focus !== false) focusFirst(el);
    emit(el, 'open');
    return record;
  }

  function close(el, options) {
    var opts = options || {};
    if (typeof el === 'string') el = (records[el] && records[el].el) || document.getElementById(el);
    var id = el && el.id;
    if (!el || !isOpen(el)) return false;

    el.setAttribute('hidden', '');
    var record = records[id];
    if (record) {
      if (record.handle) {
        record.handle.stop();
        record.handle = null;
      }
      blurInside(record.el);
    }
    var index = stack.indexOf(id);
    if (index !== -1) stack.splice(index, 1);
    syncBackground();

    if (opts.history !== false && id) backState(id);
    pendingOpener = lastClosed && opts.restore !== false && record ? record.opener : null;
    if (opts.restore !== false && record && record.opener) restoreFocus(record.opener);
    emit(el, 'close');
    return true;
  }

  // Focus can still sit inside the dialog we just hid.
  function blurInside(el) {
    var active = document.activeElement;
    if (active && el.contains(active)) {
      try {
        active.blur();
      } catch (err) { /* ignore */ }
    }
  }

  function restoreFocus(opener) {
    if (!opener || !opener.focus) return;
    if (opener.isConnected === false) return;
    if (!isRendered(opener)) return;
    try {
      opener.focus({ preventScroll: true });
    } catch (err) {
      try { opener.focus(); } catch (err2) { /* ignore */ }
    }
  }

  function closeTopmost() {
    var id = stack.length ? stack[stack.length - 1] : null;
    if (!id) return false;
    var record = records[id];
    if (!record || !record.el) {
      stack.pop();
      return false;
    }
    return close(record.el, { restore: true });
  }

  function topmostId() { return stack.length ? stack[stack.length - 1] : null; }
  function isOpenId(id) { return stack.indexOf(id) !== -1; }

  /* ---------- header solid-on-scroll ---------- */

  function initHeaderScroll() {
    var header = document.getElementById('site-nav');
    if (!header) return;
    var firstSection = $('#main .pg > .sec') || $('#main .sec');
    var pageSolid = header.classList.contains('is-solid') ||
      !!(firstSection && firstSection.classList.contains('paper'));
    function update() {
      var y = window.pageYOffset || (document.documentElement ? document.documentElement.scrollTop : 0) || 0;
      header.classList.toggle('is-solid', pageSolid || y > 8);
    }
    /* Direct update: a classList toggle is cheap; rAF throttling stalled under headless virtual time. */
    var onScroll = update;

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
  }

  window.addEventListener('popstate', onPopState);

  /* Owner's notice: shown only between data-start and data-end (YYYY-MM-DD) and until dismissed in this tab. */
  function initNotice() {
    var box = $('[data-notice]');
    if (!box) return;
    var d = new Date(), pad = function (n) { return (n < 10 ? '0' : '') + n; };
    var today = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    var start = attr(box, 'data-start'), end = attr(box, 'data-end'), key = attr(box, 'data-key');
    box.hidden = Boolean((start && today < start) || (end && today > end) || store.get('mabda-notice') === key);
    function sizeNotice() {
      var root = document.documentElement, height = box.getBoundingClientRect().height + 'px';
      if (root.style.getPropertyValue('--notice-h') === height) return;
      root.style.setProperty('--notice-h', height);
      window.dispatchEvent(new Event('resize'));
    }
    sizeNotice();
    if (window.ResizeObserver) new ResizeObserver(sizeNotice).observe(box);
    else window.addEventListener('resize', sizeNotice);
    $('[data-notice-close]', box).addEventListener('click', function () {
      box.hidden = true;
      sizeNotice();
      store.set('mabda-notice', key);
    });
  }

  function initReveal() {
    if (typeof window.IntersectionObserver !== 'function') return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var targets = qa('[data-reveal], .acard, .tile2, .pc, .nc, .news-row, .irow, .ab-pillars li, .ab-team li, .ac, .ct-steps li, .lw-sec, .lw-actions, .keypoints, .callout, .tp-situation');
    if (!targets.length) return;
    var skip = '#home-choices, .topics-wrap.is-hscroll, .overlay, #mega-menu, .site-footer, [hidden]';
    var fold = (window.innerHeight || 800) * 0.95, below = [];
    targets.forEach(function (el) {
      if (!el || (el.closest && el.closest(skip))) return;
      if (el.parentElement && el.parentElement.closest && el.parentElement.closest('[data-reveal]')) return;
      if (el.getBoundingClientRect().top > fold) {
        el.setAttribute('data-reveal', '');
        below.push(el);
      } else if (el.hasAttribute('data-reveal')) {
        el.classList.add('is-revealed');
      }
    });
    if (!below.length) return;
    document.documentElement.classList.add('js-reveal');
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting || entry.boundingClientRect.top <= (window.innerHeight || 800)) {
          entry.target.classList.add('is-revealed');
          obs.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -24px 0px', threshold: 0.05 });
    below.forEach(function (el) { obs.observe(el); });
  }

  function initPage() {
    initNotice();
    initHeaderScroll();
    initReveal();
    if ($('.notfound') && /^https?:$/.test(location.protocol) && location.pathname.split('/').length > 2) {
      qa('link[href], a[href], img[src]').forEach(function (el) {
        var k = el.hasAttribute('src') ? 'src' : 'href', v = attr(el, k);
        if (v && !/^(https?:|mailto:|tel:|data:|#|\/)/.test(v)) el.setAttribute(k, location.origin + '/' + v.replace(/^(\.\/)+/, ''));
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPage);
  else initPage();

  window.Mabda = {
    $: $, $$: qa, qa: qa, attr: attr, ui: ui, fill: fill,
    digits: { toLatin: toLatin, toFa: toFa, group: group },
    normalizeDigits: toLatin, faDigits: toFa, formatNumber: group,
    store: store, toast: toast, toastFor: toastFor,
    isRendered: isRendered, focusables: focusables, focusFirst: focusFirst, trap: trap, setInert: setInert,
    overlay: { open: open, close: close, isOpen: isOpen, closeTopmost: closeTopmost, topmostId: topmostId, isOpenId: isOpenId }
  };
})();
