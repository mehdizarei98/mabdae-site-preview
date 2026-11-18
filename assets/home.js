/* One home gesture controller; native scroll timelines keep the transition in sync. */
(function () {
  'use strict';
  var hero = document.querySelector('.home-hero');
  if (!hero) return;
  var root = document.documentElement;
  var choices = document.getElementById('home-choices');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var frame = 0;
  var glide = 0, glideTimer = 0, lockUntil = 0, wheelSum = 0, wheelAt = 0, touch = null;
  var controls = 'input, textarea, select, button, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="slider"], [role="spinbutton"]';
  root.classList.add('home-scroll-controlled');
  if (!root.classList.contains('home-intro-pending')) root.classList.add('home-ready');

  function blocked(target) {
    return root.classList.contains('has-overlay') ||
      (window.Mabda && window.Mabda.overlay.topmostId()) ||
      document.querySelector('dialog[open], [role="dialog"]:not([hidden]), #mega-menu:not([hidden])') ||
      (target && target.closest(controls)) ||
      (document.activeElement && document.activeElement.closest(controls));
  }
  function stop() {
    var interrupted = glide || glideTimer || performance.now() < lockUntil;
    cancelAnimationFrame(glide);
    clearTimeout(glideTimer);
    glide = 0; glideTimer = 0; lockUntil = interrupted ? performance.now() + 180 : 0; wheelSum = 0; touch = null;
  }
  function syncScreens() {
    // Native view timelines can lag behind scrollTo; arrival must have a definite final state.
    var bounds = hero.getBoundingClientRect(), settled = choices.getBoundingClientRect().top <= 1;
    // Do not wait for an asynchronous observer to start or resume a visible cue.
    root.classList.toggle('home-cue-visible', bounds.bottom > 0 && bounds.top < window.innerHeight);
    choices.classList.toggle('home-choices-settled', settled);
  }
  function destination(direction, target) {
    var top = window.scrollY + choices.getBoundingClientRect().top;
    // Nested scrollers keep their normal behaviour while they can consume the input.
    for (var node = target; node && node !== document.body; node = node.parentElement) {
      if (node.scrollHeight > node.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(node).overflowY) &&
          (direction > 0 ? node.scrollTop + node.clientHeight < node.scrollHeight - 1 : node.scrollTop > 0)) return null;
    }
    if (direction > 0 && window.scrollY < top - 2) return top;
    if (direction < 0 && Math.abs(window.scrollY - top) <= 2) return 0;
    return null;
  }
  // Smooth zero-initial-jerk S-curve glide.
  function ease(p) {
    return 0.5 - 0.5 * Math.cos(Math.PI * Math.pow(p, 0.82));
  }
  function go(top) {
    var from = window.scrollY, started = performance.now();
    wheelSum = 0;
    if (reduced.matches) {
      window.scrollTo({ top: top, behavior: 'instant' });
      syncScreens();
      lockUntil = started + 180;
      return;
    }
    function step() {
      cancelAnimationFrame(glide);
      clearTimeout(glideTimer);
      glide = 0; glideTimer = 0;
      if (blocked(null)) { stop(); return; }
      // Use one clock: a delayed frame/document timeline can precede the input timestamp.
      var now = performance.now();
      var progress = reduced.matches ? 1 : Math.max(0, Math.min(1, (now - started) / 800));
      window.scrollTo({ top: from + (top - from) * ease(progress), behavior: 'instant' });
      syncScreens();
      if (root.classList.contains('home-scroll-fallback')) update();
      if (progress < 1) queueStep();
      else lockUntil = Math.max(lockUntil, now + 180);
    }
    function queueStep() {
      glide = requestAnimationFrame(step);
      // Keep the same eased motion progressing when a throttled renderer withholds frames.
      glideTimer = setTimeout(step, 32);
    }
    queueStep();
  }
  function locked() { return glide || glideTimer || performance.now() < lockUntil; }

  // Wheel/touchmove must be cancellable to avoid a second native scroll under the glide.
  window.addEventListener('wheel', function (event) {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || blocked(event.target) ||
        Math.abs(event.deltaX) > Math.abs(event.deltaY) || !event.deltaY) return;
    var now = performance.now();
    if (locked()) { event.preventDefault(); lockUntil = now + 180; return; }
    var direction = Math.sign(event.deltaY), top = destination(direction, event.target);
    if (top === null) { wheelSum = 0; return; }
    event.preventDefault();
    var delta = event.deltaY * (event.deltaMode === 1 ? 24 : event.deltaMode === 2 ? hero.offsetHeight : 1);
    if (now - wheelAt > 180 || Math.sign(wheelSum) !== direction) wheelSum = 0;
    wheelAt = now; wheelSum += delta;
    if (Math.abs(wheelSum) >= 24) go(top);
  }, { passive: false });
  window.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') { stop(); return; }
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || blocked(event.target)) return;
    var direction = event.key === 'ArrowDown' || event.key === 'PageDown' || (event.key === ' ' && !event.shiftKey) ? 1 :
      event.key === 'ArrowUp' || event.key === 'PageUp' || (event.key === ' ' && event.shiftKey) ? -1 : 0;
    if (!direction) return;
    if (locked()) { event.preventDefault(); return; }
    var top = destination(direction, event.target);
    if (top === null) return;
    event.preventDefault();
    if (!event.repeat) go(top);
  });
  window.addEventListener('touchstart', function (event) {
    if (event.touches.length !== 1 || blocked(event.target)) { touch = null; return; }
    touch = { x: event.touches[0].clientX, y: event.touches[0].clientY, claimed: false };
  }, { passive: true });
  window.addEventListener('touchmove', function (event) {
    if (event.defaultPrevented || event.touches.length !== 1 || !touch || blocked(event.target)) return;
    var dy = touch.y - event.touches[0].clientY, dx = touch.x - event.touches[0].clientX;
    if (Math.abs(dx) > Math.abs(dy)) return;
    if (locked() || touch.claimed) { event.preventDefault(); return; }
    var top = destination(Math.sign(dy), event.target);
    if (top === null || !dy) return;
    event.preventDefault();
    if (Math.abs(dy) >= 24) { touch.claimed = true; go(top); }
  }, { passive: false });
  function endTouch() {
    if (touch && touch.claimed) lockUntil = performance.now() + 180;
    touch = null;
  }
  window.addEventListener('touchend', endTouch, { passive: true });
  window.addEventListener('touchcancel', function () { stop(); }, { passive: true });
  window.addEventListener('pointerdown', stop, { passive: true });
  window.addEventListener('hashchange', function () { stop(); syncScreens(); }, { passive: true });
  window.addEventListener('click', function (event) {
    var link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented) return;
    stop();
    if (link.matches('.home-scroll') && !blocked(event.target)) {
      event.preventDefault();
      go(window.scrollY + choices.getBoundingClientRect().top);
    }
  });
  window.addEventListener('resize', function () {
    stop(); syncScreens();
    if (root.classList.contains('home-scroll-fallback')) schedule();
  }, { passive: true });
  function update() {
    cancelAnimationFrame(frame);
    frame = 0;
    var progress = reduced.matches ? 0 : Math.max(0, Math.min(1, window.scrollY / hero.offsetHeight));
    hero.style.setProperty('--home-progress', progress);
    // Screen 2 is fully visible before snap settles, including anchor/keyboard jumps.
    choices.style.setProperty('--home-entry', reduced.matches ? 1 : Math.min(1, progress / 0.85));
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(update); }
  if (!CSS.supports('animation-timeline: view()')) {
    root.classList.add('home-scroll-fallback');
    schedule();
  }
  window.addEventListener('scroll', function () {
    syncScreens();
    if (root.classList.contains('home-scroll-fallback')) schedule();
  }, { passive: true });
  syncScreens();
  reduced.addEventListener('change', function () {
    if (reduced.matches) root.classList.remove('home-intro-pending', 'home-intro-leaving');
    schedule();
  });
  // Focusing a link must never leave it in a partly faded scroll state.
  choices.addEventListener('focusin', function () { choices.classList.add('home-choices-focused'); });
  choices.addEventListener('focusout', function (event) {
    if (!choices.contains(event.relatedTarget)) choices.classList.remove('home-choices-focused');
  });
}());
