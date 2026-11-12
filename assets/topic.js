/* Compact screens read every situation; desktop keeps the docked selector. */
(function () {
  'use strict';
  var selector = document.querySelector('.topic-selector');
  if (!selector) return;
  var items = Array.from(selector.querySelectorAll('[data-situation]'));
  var panels = Array.from(document.querySelectorAll('[data-situation-panel]'));
  var workspace = document.querySelector('.topic-workspace');
  var host = document.querySelector('.topic-selector-host');
  var home = selector.parentNode;
  var bar = document.querySelector('.topic-number-bar');
  var numbers = Array.from(bar.querySelectorAll('[data-situation-number]'));
  var title = bar.querySelector('.topic-current-title');
  var prev = document.querySelector('[data-situation-prev]');
  var next = document.querySelector('[data-situation-next]');
  var compact = matchMedia('(max-width: 1023.98px)');
  var reduced = matchMedia('(prefers-reduced-motion: reduce)');
  var current = -1;
  var initial = true;
  var hashLocked = false;
  var destination = null, idle = 0;
  var scrollEnd = 'onscrollend' in document;
  if (!items.length || items.length !== panels.length || !workspace || !host) return;
  var panelIds = panels.map(function (panel) { return panel.id; });
  var initialTarget = compact.matches ? hashIndex() : -1;

  function headerHeight() {
    return document.querySelector(compact.matches ? '.mtop' : '.nav').getBoundingClientRect().height;
  }
  function dock() {
    if (compact.matches || selector.parentNode === host) return;
    var focused = document.activeElement;
    host.appendChild(selector);
    if (selector.contains(focused)) focused.focus({ preventScroll: true });
  }
  function paint(index) {
    current = index;
    workspace.classList.toggle('has-selection', index >= 0);
    items.forEach(function (item, i) {
      item.classList.toggle('on', i === index);
      if (compact.matches) item.removeAttribute('aria-expanded');
      else item.setAttribute('aria-expanded', i === index ? 'true' : 'false');
      if (i === index) item.setAttribute('aria-current', 'true');
      else item.removeAttribute('aria-current');
    });
    panels.forEach(function (panel, i) {
      panel.hidden = !compact.matches && i !== index;
      panel.classList.toggle('is-hidden', panel.hidden);
    });
    numbers.forEach(function (number, i) {
      if (i === index) number.setAttribute('aria-current', 'true');
      else number.removeAttribute('aria-current');
    });
    if (index >= 0) title.textContent = panels[index].querySelector('h2').textContent;
    prev.hidden = index <= 0;
    next.hidden = index < 0 || index === items.length - 1;
    prev.setAttribute('href', '#s' + Math.max(1, index));
    next.setAttribute('href', '#s' + Math.min(items.length, index + 2));
  }
  function offset() {
    return headerHeight() + (compact.matches ? bar.offsetHeight : 0) + parseFloat(getComputedStyle(workspace).rowGap);
  }
  function reveal(focus, instant) {
    if (current < 0) return;
    dock();
    paint(current);
    var top = panels[current].getBoundingClientRect().top + window.scrollY - offset();
    if (compact.matches) {
      clearTimeout(idle);
      destination = Math.max(0, Math.min(document.documentElement.scrollHeight - window.innerHeight, top));
      top = destination;
    }
    // Focus can dispatch a scroll before scrollTo starts; commit its guard first.
    if (focus) panels[current].focus({ preventScroll: true });
    window.scrollTo({ top: top,
      behavior: !compact.matches || instant || reduced.matches ? 'instant' : 'smooth' });
    if (compact.matches && destination !== null) {
      if (Math.abs(window.scrollY - destination) <= 2) settle();
      else if (!scrollEnd) idle = setTimeout(settle, 1000);
    }
  }
  function select(index) {
    hashLocked = false;
    if (compact.matches) initial = false;
    paint(index);
    try { history.replaceState(history.state, '', '#s' + (index + 1)); } catch (err) { /* file:// */ }
    reveal(true);
  }
  items.forEach(function (item, i) {
    item.addEventListener('click', function () { select(i); });
  });
  numbers.forEach(function (number, i) {
    number.addEventListener('click', function () { select(i); });
  });
  [prev, next].forEach(function (link) {
    link.addEventListener('click', function (event) {
      event.preventDefault();
      select(parseInt(link.hash.slice(2), 10) - 1);
    });
  });
  function hashIndex() {
    var match = /^#s(\d+)$/.exec(location.hash);
    var wanted = match ? Number(match[1]) - 1 : -1;
    return wanted >= 0 && wanted < items.length ? wanted : -1;
  }
  function fromHash() {
    var wanted = hashIndex();
    paint(Math.max(0, wanted));
    if (wanted >= 0) reveal(false, true);
  }
  function update() {
    if (compact.matches) {
      if (hashLocked || destination !== null || (initial && initialTarget >= 0)) return;
      var index = 0, edge = offset() + 2;
      panels.forEach(function (panel, i) { if (panel.getBoundingClientRect().top <= edge) index = i; });
      paint(index);
    } else if (current >= 0 && workspace.getBoundingClientRect().top <= headerHeight()) dock();
  }
  function settle(event) {
    if (event && event.target !== window && event.target !== document) return;
    // A previous scroll's end event must not cancel a newer tap's destination.
    if (event && destination !== null && Math.abs(window.scrollY - destination) > 2) return;
    clearTimeout(idle);
    destination = null;
    update();
  }
  function onScroll() {
    if (destination === null) { update(); return; }
    if (Math.abs(window.scrollY - destination) <= 2) { settle(); return; }
    if (!scrollEnd) { clearTimeout(idle); idle = setTimeout(settle, 160); }
  }
  function sync() {
    if (compact.matches && selector.parentNode !== home) home.appendChild(selector);
    paint(Math.max(0, current));
    if (compact.matches) bar.style.top = headerHeight() + 'px';
    else bar.style.removeProperty('top');
    panels.forEach(function (panel, i) {
      // Native #sN navigation must land on the same section as compact JS navigation.
      items[i].id = compact.matches ? 'situation-entry-' + (i + 1) : 's' + (i + 1);
      panel.id = compact.matches ? 's' + (i + 1) : panelIds[i];
      panel.setAttribute('aria-labelledby', items[i].id);
      items[i].setAttribute('aria-controls', panel.id);
      numbers[i].setAttribute('aria-controls', panel.id);
      if (compact.matches) panel.style.scrollMarginTop = offset() + 'px';
      else panel.style.removeProperty('scroll-margin-top');
    });
    settle();
  }
  sync();
  fromHash();
  window.addEventListener('load', function () {
    if (!/^#s\d+$/.test(location.hash)) return;
    if (compact.matches) {
      // Recheck the final header/bar geometry after the load layout.
      if (initialTarget >= 0) requestAnimationFrame(function () {
        if (!initial) return;
        sync();
        initial = false;
        fromHash();
      });
    } else requestAnimationFrame(function () { reveal(false, true); });
  });
  window.addEventListener('hashchange', function () {
    // Hash navigation owns selection until the next user scroll gesture or tap.
    hashLocked = compact.matches && hashIndex() >= 0;
    if (compact.matches) initial = false;
    fromHash();
  });
  ['wheel', 'touchstart', 'keydown'].forEach(function (type) {
    window.addEventListener(type, function () {
      if (!compact.matches) return;
      initial = false;
      hashLocked = false;
      clearTimeout(idle);
      destination = null;
    }, { passive: true });
  });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('scrollend', settle);
  window.addEventListener('resize', sync);
}());
