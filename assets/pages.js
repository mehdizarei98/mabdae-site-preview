/*
 * pages.js — the «چه مدارکی بیاورم؟» drawer, paper-guide chips,
 * accordions and the quiz. pages2.js continues with articles, lawyers, the address
 * copy button and the calculator wiring.
 *
 * Classic script, no modules. Depends on window.Mabda (common.js) and, for the quiz,
 * window.SITE_DATA.quiz (assets/site-data.js).
 *
 * Listener ownership (see also nav.js): nav.js never touches #drawer-dialog, so the
 * drawer open/close/scrim/chips/ticks/Escape belong to this file. There is one click
 * handler per concern and nothing is handled twice.
 */
(function () {
  'use strict';

  var M = window.Mabda;
  if (!M) return;

  var $ = M.$;
  var qa = M.$$;
  var ui = M.ui;
  var fill = M.fill;
  var attr = M.attr;

  var DRAWER_ID = 'drawer-dialog';
  var TICK_KEY = 'mabda:doc:ticks';
  var ACCORDION_MS = 240;
  var MOBILE_QUERY = '(max-width: 1023.98px)';
  var REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

  /* ---------- small shared helpers ---------- */

  function matches(query) {
    try {
      return !!(window.matchMedia && window.matchMedia(query).matches);
    } catch (err) {
      return false;
    }
  }

  function reduced() {
    return matches(REDUCED_QUERY);
  }

  function isMobile() {
    return matches(MOBILE_QUERY);
  }

  function fa(value) {
    return M.digits.toFa(String(value));
  }

  function setText(el, text) {
    if (el) el.textContent = text === null || text === undefined ? '' : String(text);
  }

  function show(el) {
    if (el) el.removeAttribute('hidden');
  }

  function hide(el) {
    if (el) el.setAttribute('hidden', '');
  }

  function clearChildren(el) {
    if (el) while (el.firstChild) el.removeChild(el.firstChild);
  }

  function scrollIntoViewSoon(el) {
    if (!el) return;
    var options = { block: 'start', inline: 'nearest', behavior: reduced() ? 'auto' : 'smooth' };
    try {
      el.scrollIntoView(options);
    } catch (err) {
      try {
        el.scrollIntoView(false);
      } catch (err2) { /* not scrollable: ignore */ }
    }
  }

  function setExpanded(selector, open) {
    qa(selector).forEach(function (el) {
      if (el.hasAttribute('aria-expanded')) el.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  /* ---------- paper guide: tabs (arrow keys, #type in the URL) ---------- */

  function initPaperTypes() {
    var tabs = qa('[data-paper-type]');
    var panels = qa('[data-paper-panel]');
    if (!tabs.length || tabs.length !== panels.length) return;

    function select(index, byUser) {
      tabs.forEach(function (tab, i) {
        var on = i === index;
        tab.classList.toggle('on', on);
        tab.setAttribute('aria-selected', on ? 'true' : 'false');
        tab.tabIndex = on ? 0 : -1;
        if (on) show(panels[i]); else hide(panels[i]);
      });
      if (!byUser) return;
      try {
        history.replaceState(null, '', '#' + attr(tabs[index], 'data-paper-id'));
      } catch (err) { /* some file:// contexts refuse; the tab still works */ }
      tabs[index].focus();
      if (tabs[index].scrollIntoView) tabs[index].scrollIntoView(window.matchMedia('(max-width: 767.98px)').matches ? { block: 'start', behavior: reduced() ? 'auto' : 'smooth' } : { block: 'nearest', inline: 'nearest' });
    }

    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { select(i, true); }, false);
      tab.addEventListener('keydown', function (event) {
        var rtl = window.getComputedStyle(document.documentElement).direction === 'rtl';
        var step = { ArrowLeft: rtl ? 1 : -1, ArrowRight: rtl ? -1 : 1 }[event.key];
        var target = step ? (i + step + tabs.length) % tabs.length
          : { Home: 0, End: tabs.length - 1 }[event.key];
        if (target === undefined) return;
        event.preventDefault();
        select(target, true);
      }, false);
    });

    var wanted = String(window.location.hash || '').replace('#', '');
    var start = 0;
    tabs.forEach(function (tab, i) {
      if (wanted && attr(tab, 'data-paper-id') === wanted) start = i;
    });
    select(start, false);
  }

  /* ---------- documents drawer ---------- */

  var drawer = null;
  var chips = [];
  var docsets = [];
  var items = [];
  var countEl = null;
  var ticks = {};

  function tickKey(input) {
    return input.value;
  }

  function loadTicks() {
    var stored = M.store.getJson(TICK_KEY, null);
    ticks = stored && typeof stored === 'object' ? stored : {};
  }

  function saveTicks() {
    M.store.setJson(TICK_KEY, ticks);
  }

  function applyTicks() {
    items.forEach(function (input) {
      var on = !!ticks[tickKey(input)];
      input.checked = on;
      var label = input.closest ? input.closest('.ck') : null;
      if (label) label.classList.toggle('on', on);
    });
    updateCount();
  }

  function updateCount() {
    if (!countEl) return;
    var total = 0;
    items.forEach(function (input) {
      if (input.checked) total += 1;
    });
    var template = ui('overlays.selected');
    setText(countEl, template ? fill(template, { n: fa(total) }) : fa(total));
  }

  function activeDocset() {
    for (var i = 0; i < chips.length; i += 1) {
      if (chips[i].getAttribute('aria-pressed') === 'true') return attr(chips[i], 'data-docset');
    }
    return chips.length ? attr(chips[0], 'data-docset') : null;
  }

  function selectDocset(id) {
    if (!id) return;
    var known = docsets.some(function (panel) {
      return attr(panel, 'data-docset-panel') === id;
    });
    if (!known) return;
    chips.forEach(function (chip) {
      var on = attr(chip, 'data-docset') === id;
      chip.classList.toggle('on', on);
      chip.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    docsets.forEach(function (panel) {
      var on = attr(panel, 'data-docset-panel') === id;
      if (on) show(panel); else hide(panel);
    });
  }

  function openDrawer(trigger) {
    if (!drawer) return;
    var id = trigger ? attr(trigger, 'data-docset') : null;
    if (M.overlay.isOpen(drawer)) {
      if (id) selectDocset(id);
      return;
    }
    if (id) selectDocset(id);
    else selectDocset(activeDocset());
    applyTicks();
    M.overlay.open(drawer, { opener: trigger || null });
  }

  // Swipe down from the top of the sheet closes it on phones (same as the menu and search sheets).
  function initDrawerSwipe() {
    var panel = drawer && drawer.querySelector('.panel');
    var body = panel && panel.querySelector('.drawer-body');
    var from = null;
    if (!panel || !body) return;
    panel.addEventListener('touchstart', function (e) {
      from = body.scrollTop <= 0 ? e.touches[0].clientY : null;
    }, { passive: true });
    panel.addEventListener('touchend', function (e) {
      var dy = from === null ? 0 : e.changedTouches[0].clientY - from;
      from = null;
      if (dy > 72) closeDrawer();
    }, { passive: true });
  }

  function closeDrawer() {
    if (drawer && M.overlay.isOpen(drawer)) M.overlay.close(drawer, { restore: true });
  }

  function onTickChange(event) {
    var input = event.target;
    if (!input || input.type !== 'checkbox' || !input.hasAttribute('data-doc-item')) return;
    var key = tickKey(input);
    if (input.checked) ticks[key] = 1;
    else delete ticks[key];
    saveTicks();
    var label = input.closest ? input.closest('.ck') : null;
    if (label) label.classList.toggle('on', input.checked);
    updateCount();
  }

  function onDrawerClick(event) {
    var node = event.target;
    if (!node || !node.closest || !drawer) return;

    var trigger = node.closest('[data-open-drawer]');
    if (trigger) {
      if (event.preventDefault) event.preventDefault();
      openDrawer(trigger);
      return;
    }

    var inside = node.closest('#' + DRAWER_ID);
    if (!inside) return;

    if (node.closest('[data-close]')) {
      if (event.preventDefault) event.preventDefault();
      closeDrawer();
      return;
    }
    if (node === drawer) {          // scrim
      closeDrawer();
      return;
    }
    var chip = node.closest('[data-docset]');
    if (chip && inside.contains(chip)) {
      selectDocset(attr(chip, 'data-docset'));
      return;
    }
    if (node.closest('[data-print-docs]')) { window.print(); return; }
    if (node.closest('[data-send-docs]')) {
      M.toast(ui('toasts.docsSend'));
    }
  }

  function onDrawerKeydown(event) {
    if (event.key !== 'Escape' && event.key !== 'Esc') return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (!drawer || !M.overlay.isOpen(drawer)) return;
    if (M.overlay.topmostId() !== DRAWER_ID) return;   // sheet/search on top close themselves
    if (event.preventDefault) event.preventDefault();
    closeDrawer();
  }

  function initDrawer() {
    drawer = document.getElementById(DRAWER_ID);
    if (!drawer) return;
    chips = qa('[data-docset]', drawer);
    docsets = qa('[data-docset-panel]', drawer);
    items = qa('[data-doc-item]', drawer);
    countEl = document.getElementById('doc-count');
    initDrawerSwipe();

    loadTicks();
    applyTicks();

    drawer.addEventListener('change', onTickChange, false);
    document.addEventListener('click', onDrawerClick, false);
    document.addEventListener('keydown', onDrawerKeydown, false);

    drawer.addEventListener('mabda:open', function () {
      setExpanded('[data-open-drawer]', true);
    }, false);
    drawer.addEventListener('mabda:close', function () {
      setExpanded('[data-open-drawer]', false);
    }, false);
  }

  /* ---------- accordions ---------- */
  var accordionTimers = typeof WeakMap === 'function' ? new WeakMap() : null;
  function stopAccordionTimer(panel) {
    if (!accordionTimers) return;
    var timer = accordionTimers.get(panel);
    if (timer) {
      clearTimeout(timer);
      accordionTimers.delete(panel);
    }
  }
  function openAccordion(ac, button, panel) {
    stopAccordionTimer(panel);
    show(panel);
    // Reading the height forces layout so the 0fr -> 1fr transition actually runs.
    void panel.offsetHeight;
    button.setAttribute('aria-expanded', 'true');
    ac.classList.add('is-open');
  }
  function closeAccordion(ac, button, panel) {
    button.setAttribute('aria-expanded', 'false');
    ac.classList.remove('is-open');
    if (!accordionTimers) {
      hide(panel);
      return;
    }
    stopAccordionTimer(panel);
    var delay = reduced() ? 0 : ACCORDION_MS;
    if (delay === 0) {
      hide(panel);
      return;
    }
    accordionTimers.set(panel, setTimeout(function () {
      accordionTimers.delete(panel);
      if (button.getAttribute('aria-expanded') !== 'true') hide(panel);
    }, delay));
  }
  function initAccordions() {
    qa('[data-accordion]').forEach(function (ac) {
      var button = $('.ah[aria-expanded]', ac);
      var id = button ? attr(button, 'aria-controls') : null;
      var panel = id ? document.getElementById(id) : null;
      if (!panel) return;
      var footer = ac.hasAttribute('data-footer-column');
      if (footer) {
        var phone = window.matchMedia('(max-width: 767.98px)');
        function syncFooter() {
          stopAccordionTimer(panel);
          button.disabled = !phone.matches;
          button.setAttribute('aria-expanded', phone.matches ? 'false' : 'true');
          ac.classList.toggle('is-open', !phone.matches);
          if (phone.matches) hide(panel); else show(panel);
        }
        syncFooter();
        phone.addEventListener('change', syncFooter);
      } else if (button.getAttribute('aria-expanded') === 'true') {
        ac.classList.add('is-open');
        show(panel);
      } else {
        hide(panel);
      }
      button.addEventListener('click', function () {
        if (button.getAttribute('aria-expanded') === 'true') closeAccordion(ac, button, panel);
        else openAccordion(ac, button, panel);
      }, false);
    });
  }
  /* ---------- quiz ---------- */

  function quizOption(row, value) {
    var list = qa('input[type="radio"]', row);
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].value === value) return list[i];
    }
    return null;
  }

  function initQuiz() {
    var box = $('[data-quiz]');
    if (!box) return;

    var data = window.SITE_DATA && window.SITE_DATA.quiz;
    var questions = data && data.questions ? data.questions : [];
    var cats = data && data.cats ? data.cats : [];
    if (!questions.length) return;

    var main = $('[data-quiz-main]', box);
    var segments = qa('.prog i', box);
    var why = $('.quiz-why', box);
    var progress = $('.prog', box);
    var numberEl = $('[data-quiz-number]', box);
    var questionEl = $('[data-quiz-question]', box);
    var whyEl = $('[data-quiz-why]', box);
    var form = $('[data-quiz-form]', box);
    var back = $('[data-quiz-back]', box);
    var result = $('[data-quiz-result]', box);
    var resultBody = $('[data-quiz-result-body]', box);
    var summary = $('[data-quiz-summary]');
    var started = false;
    var restart = $('[data-quiz-restart]', box);

    var answers = [];
    var index = 0;

    var catIndexes = cats.map(function (cat) {
      var list = [];
      questions.forEach(function (question, qi) {
        if (question.cat === cat.name) list.push(qi);
      });
      return list;
    });

    function gapCount(indexes) {
      var gap = 0;
      indexes.forEach(function (qi) {
        var answer = answers[qi];
        if (answer !== 'yes') gap += 1;
      });
      return gap;
    }

    function drawSummary(done) {
      if (!summary) return;
      var rows = qa('.summary-row', summary);
      var now = !done && questions[index] ? questions[index].cat : '';
      cats.forEach(function (cat, ci) {
        if (rows[ci]) rows[ci].classList.toggle('is-current', cat.name === now);
      });
    }

    function resultBlock(cat, gap) {
      var row = document.createElement('div');
      row.className = 'qr-row';
      var name = document.createElement('h3');
      name.className = 'h4';
      name.textContent = cat.name;
      var badge = document.createElement('span');
      badge.className = 'badge qr-badge' + (gap ? ' need' : '');
      badge.textContent = ui(gap ? 'quiz.badgeGap' : 'quiz.badgeOk') || '';
      var text = document.createElement('p');
      text.textContent = String(gap ? cat.gapText : cat.okText);
      row.appendChild(name);
      row.appendChild(badge);
      row.appendChild(text);
      return row;
    }

    function drawResult(done) {
      if (!result) return;
      if (!done) {
        hide(result);
        clearChildren(resultBody);
        return;
      }
      if (!resultBody) {
        if (done) show(result); else hide(result);
        return;
      }
      clearChildren(resultBody);
      cats.forEach(function (cat, ci) {
        resultBody.appendChild(resultBlock(cat, gapCount(catIndexes[ci])));
      });
      show(result);
      try {
        result.focus({ preventScroll: false });
      } catch (err) {
        try {
          result.focus();
        } catch (err2) { /* ignore */ }
      }
    }

    function render() {
      var done = index >= questions.length;
      var question = done ? null : questions[index];

      if (progress) progress.setAttribute('aria-valuenow', String(done ? questions.length : index));
      segments.forEach(function (seg, i) {
        seg.className = i < index ? 'done' : (i === index ? 'cur' : '');
      });
      if (main) {
        if (done) hide(main); else show(main);
      }

      if (numberEl) {
        var template = ui('quiz.progress');
        setText(numberEl, done ? ui('quiz.done') : (template
          ? fill(template, { n: fa(index + 1), total: fa(questions.length), cat: question.cat })
          : fa(index + 1)));
      }
      setText(questionEl, done ? ui('quiz.finished') : question.q);
      setText(whyEl, done ? ui('quiz.finishedWhy') : question.why);

      if (form) {
        qa('input[type="radio"]', form).forEach(function (input) {
          var on = !done && answers[index] === input.value;
          input.checked = on;
          var label = input.closest ? input.closest('.quiz-option') : null;
          if (label) label.classList.toggle('is-selected', on);
        });
      }
      if (back) back.classList.toggle('is-off', index === 0);

      drawSummary(done);
      drawResult(done);
      // Focus the new question heading (not on first paint) so screen readers announce it.
      if (started && !done) focusNode(questionEl);
      started = true;
    }

    function focusNode(el) {
      try {
        el.focus({ preventScroll: true });
      } catch (err) { /* ignore */ }
    }

    function answer(event) {
      var input = event.target;
      if (!input || input.type !== 'radio' || !input.checked) return;
      if (index >= questions.length) return;
      answers[index] = input.value;
      index += 1;
      render();
    }

    if (form) {
      form.addEventListener('change', answer, false);
      // No submit button in this form: Enter must never reload the page.
      form.addEventListener('submit', function (event) {
        if (event.preventDefault) event.preventDefault();
      }, false);
    }
    if (back) {
      back.addEventListener('click', function () {
        if (index > 0) index -= 1;
        render();
      }, false);
    }
    if (restart) {
      restart.addEventListener('click', function () {
        answers = [];
        index = 0;
        render();
        var first = form ? quizOption(form, 'yes') : null;
        if (first) {
          try {
            first.focus();
          } catch (err) { /* ignore */ }
        }
      }, false);
    }

    // Phones: the help line starts collapsed so question + answers fit one screen.
    if (why && matches('(max-width: 767.98px)')) why.removeAttribute('open');
    render();
  }

  /* ---------- start ---------- */

  function init() {
    initDrawer();
    initPaperTypes();
    initAccordions();
    initQuiz();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
