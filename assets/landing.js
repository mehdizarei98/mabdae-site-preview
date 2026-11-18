/* landing.js — audience pages (personal / business): horizontal topic panels. Loaded after pages2.js. */
(function () {
  'use strict';
  var wrap = document.querySelector('.topics-wrap');
  if (!wrap) return;
  var track = wrap.querySelector('.tp-track');
  var panels = Array.from(wrap.querySelectorAll('.tp-panel'));
  var tabs = Array.from(wrap.querySelectorAll('.tp-tabs a'));
  var desktop = window.matchMedia('(min-width: 1024px)');
  var phone = window.matchMedia('(max-width: 767.98px)');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var frame = 0;
  var current = 0, initialized = false;
  var observer;
  function active(index) {
    tabs.forEach(function (tab, i) {
      if (i === index) tab.setAttribute('aria-current', 'true');
      else tab.removeAttribute('aria-current');
    });
  }
  function update(snap) {
    frame = 0;
    if (!desktop.matches) return;
    var range = wrap.offsetHeight - window.innerHeight;
    var target = range > 0 ? Math.max(0, Math.min(1, (window.scrollY - (wrap.getBoundingClientRect().top + window.scrollY)) / range)) : 0;
    if (!initialized || snap === true || reduced.matches) {
      current = target;
      initialized = true;
    } else {
      current += (target - current) * 0.16;
      if (Math.abs(target - current) < 0.0008) current = target;
    }
    track.style.transform = 'translate3d(' + (current * (panels.length - 1) * 100 * (document.documentElement.dir === 'ltr' ? -1 : 1)) + '%,0,0)';
    active(Math.round(current * (panels.length - 1)));
    if (current !== target) schedule();
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(update); }
  function go(index, instant) {
    if (desktop.matches) {
      var top = wrap.getBoundingClientRect().top + window.scrollY;
      var dest = top + (wrap.offsetHeight - window.innerHeight) * index / Math.max(1, panels.length - 1);
      var jump = Boolean(instant || reduced.matches);
      window.scrollTo({ top: dest, behavior: jump ? 'instant' : 'smooth' });
      update(jump || Math.abs(window.scrollY - dest) <= 2);
    } else {
      panels[index].scrollIntoView({ behavior: (instant || reduced.matches) ? 'instant' : 'smooth', block: 'start' });
      active(index);
    }
  }
  tabs.forEach(function (tab, i) { tab.addEventListener('click', function (event) { if (phone.matches) return; event.preventDefault(); go(i); }); });
  wrap.addEventListener('focusin', function (event) {
    if (!desktop.matches) return;
    var index = panels.findIndex(function (panel) { return panel.contains(event.target); });
    if (index < 0) return;
    var rect = panels[index].getBoundingClientRect();
    if (rect.left < -1 || rect.right > window.innerWidth + 1) {
      wrap.querySelector('.tp-stick').scrollLeft = 0;
      go(index, true);
    }
  });
  function setup() {
    if (frame && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
    frame = 0;
    initialized = false;
    wrap.classList.toggle('is-hscroll', desktop.matches);
    if (observer) observer.disconnect();
    track.style.transform = '';
    if (desktop.matches) schedule();
    else if (!phone.matches) {
      observer = new IntersectionObserver(function (entries) {
        if (phone.matches || desktop.matches) return;
        entries.forEach(function (entry) { if (entry.isIntersecting) active(panels.indexOf(entry.target)); });
      }, { rootMargin: '-25% 0px -60% 0px' });
      panels.forEach(function (panel) { observer.observe(panel); });
    }
  }
  function followHash() {
    if (!desktop.matches || !location.hash) return;
    var target = document.getElementById(location.hash.slice(1));
    var panel = target && target.closest('.tp-panel'), index = panels.indexOf(panel);
    if (index < 0) return;
    wrap.querySelector('.tp-stick').scrollLeft = 0;
    go(index, true);
  }
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', setup);
  window.addEventListener('hashchange', followHash);
  setup(); followHash();
}());

/* Phone topics stay in normal flow; only the chip row scrolls horizontally. */
(function () {
  'use strict';
  var wrap = document.querySelector('.topics-wrap');
  if (!wrap) return;
  var phone = window.matchMedia('(max-width: 767.98px)');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var bar = wrap.querySelector('.tp-tabs');
  var tabs = Array.from(bar.querySelectorAll('a'));
  var panels = Array.from(wrap.querySelectorAll('.tp-panel[id]'));
  var header = document.querySelector('.mtop');
  var enabled = false;
  var initial = true;
  var destination = null, idle = 0;
  var scrollEnd = 'onscrollend' in document;

  function offset() { return header.getBoundingClientRect().bottom + bar.getBoundingClientRect().height; }

  function active(index) {
    tabs.forEach(function (tab, i) {
      tab.classList.toggle('on', i === index);
      if (i === index) tab.setAttribute('aria-current', 'true');
      else tab.removeAttribute('aria-current');
    });
    var bounds = bar.getBoundingClientRect();
    var chip = tabs[index].getBoundingClientRect();
    var delta = chip.left < bounds.left ? chip.left - bounds.left : Math.max(0, chip.right - bounds.right);
    if (delta) bar.scrollBy({ left: delta, behavior: 'instant' });
  }

  function update() {
    if (!phone.matches || destination !== null) return;
    var index = 0;
    var edge = offset() + 2; // Native scroll positions may round a fractional sticky edge.
    panels.forEach(function (panel, i) { if (panel.getBoundingClientRect().top <= edge) index = i; });
    active(index);
  }

  function settle(event) {
    if (event && event.target !== window && event.target !== document) return;
    clearTimeout(idle);
    destination = null;
    update();
  }

  function onScroll() {
    if (destination === null) { update(); return; }
    if (Math.abs(window.scrollY - destination) <= 2) { settle(); return; }
    // Browsers without scrollend settle after scroll activity stops.
    if (!scrollEnd) { clearTimeout(idle); idle = setTimeout(settle, 160); }
  }

  function go(index, instant) {
    clearTimeout(idle);
    destination = Math.max(0, Math.min(document.documentElement.scrollHeight - window.innerHeight,
      panels[index].getBoundingClientRect().top + window.scrollY - offset()));
    active(index);
    window.scrollTo({ top: destination,
      behavior: (instant || reduced.matches) ? 'instant' : 'smooth' });
    // Instant/no-op scrolls (including reduced motion) need not emit scrollend.
    if (destination === null) return;
    if (Math.abs(window.scrollY - destination) <= 2) settle();
    else if (!scrollEnd) idle = setTimeout(settle, 1000);
  }

  function hashIndex() {
    var hash = window.location.hash.slice(1);
    return panels.findIndex(function (panel) { return hash === panel.id || hash === panel.id.slice(3); });
  }

  function followHash() {
    if (!phone.matches) return;
    var index = hashIndex();
    if (index >= 0) go(index, true);
  }

  function sync() {
    if (phone.matches) {
      tabs.forEach(function (tab) { tab.classList.add('chip', 'chip-neutral'); });
      bar.style.top = header.getBoundingClientRect().bottom + 'px';
      panels.forEach(function (panel) { panel.style.scrollMarginTop = offset() + 'px'; });
      if (!enabled) followHash();
      enabled = true;
      settle();
      return;
    }
    if (!enabled) return;
    clearTimeout(idle); destination = null;
    tabs.forEach(function (tab) { tab.classList.remove('chip', 'chip-neutral', 'on'); });
    bar.style.removeProperty('top');
    bar.scrollLeft = 0;
    panels.forEach(function (panel) { panel.style.removeProperty('scroll-margin-top'); });
    enabled = false;
  }

  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function (event) {
      if (!phone.matches) return;
      event.preventDefault();
      initial = false;
      history.replaceState(null, '', tab.hash);
      go(i);
    });
  });
  window.addEventListener('hashchange', function () { initial = false; followHash(); });
  window.addEventListener('load', function () { if (initial) followHash(); });
  ['wheel', 'touchstart', 'keydown'].forEach(function (type) {
    window.addEventListener(type, function () { if (phone.matches) initial = false; }, { passive: true });
  });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('scrollend', settle);
  window.addEventListener('resize', sync);
  sync();
}());
