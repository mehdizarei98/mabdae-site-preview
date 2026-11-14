/* Home only, before paint. The independent deadline also works if home.js fails. */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var seen = false;
  try { seen = sessionStorage.getItem('mabda-home-intro') === '1'; } catch (error) { seen = true; }
  if (seen || reduced.matches || location.hash) return;
  try { sessionStorage.setItem('mabda-home-intro', '1'); } catch (error) { return; }
  root.classList.add('home-intro-pending');
  function finish() {
    root.classList.remove('home-intro-pending', 'home-intro-leaving');
    root.classList.add('home-ready');
  }
  setTimeout(function () { root.classList.add('home-intro-leaving'); }, 800);
  setTimeout(finish, 1200);
  ['keydown', 'pointerdown', 'focusin'].forEach(function (type) {
    window.addEventListener(type, finish, { once: true, passive: true });
  });
}());
