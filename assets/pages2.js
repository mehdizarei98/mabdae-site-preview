/*
 * pages2.js — articles filter/pagination, lawyer faces, copy-address and the
 * severance / deadline calculator wiring. Loaded after pages.js; classic script.
 * Depends on window.Mabda (common.js) and window.MabdaCalc (calc.js) for the forms.
 *
 * Not handled here (owned elsewhere): [data-placeholder] and [data-toast] links
 * (nav.js), the drawer and the quiz (pages.js).
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

  var SEPARATOR = ' · ';

  function fa(value) {
    return M.digits.toFa(String(value));
  }

  function pad2(value) {
    return (value < 10 ? '0' : '') + value;
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

  function focusQuiet(el) {
    if (!el) return;
    try {
      el.focus();
    } catch (err) { /* ignore */ }
  }

  /* ---------- articles: nine-card pages; legacy category hashes remain valid ---------- */
  function initArticles() {
    var chips = qa('[data-article-filter]');
    var grid = $('#articles-list'), pager = $('[data-article-pagination]');
    if (!chips.length || !grid || !pager) return;
    var cards = qa('[data-audience]', grid);
    var numbers = $('[data-page-numbers]', pager);
    var previous = $('[data-page-prev]', pager), next = $('[data-page-next]', pager);
    var scope = chips[0].parentNode;
    var kind = 'all', page = 1;

    function apply(nextKind, nextPage) {
      kind = nextKind;
      var matching = cards.filter(function (card) { return kind === 'all' || attr(card, 'data-audience') === kind; });
      var total = Math.max(1, Math.ceil(matching.length / 9));
      page = Math.max(1, Math.min(total, nextPage));
      var visible = matching.slice((page - 1) * 9, page * 9);
      chips.forEach(function (chip) {
        var on = attr(chip, 'data-article-filter') === kind;
        chip.classList.toggle('on', on);
        chip.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      cards.forEach(function (card) {
        if (visible.indexOf(card) >= 0) show(card); else hide(card);
      });
      numbers.textContent = '';
      for (var i = 1; i <= total; i += 1) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'chip chip-neutral' + (i === page ? ' on' : '');
        button.textContent = fa(i);
        button.setAttribute('data-article-page', i);
        button.setAttribute('aria-label', fill(ui('articles.pageLabel'), { n: fa(i) }));
        button.setAttribute('aria-controls', 'articles-list');
        if (i === page) button.setAttribute('aria-current', 'page');
        numbers.appendChild(button);
      }
      previous.disabled = page === 1;
      next.disabled = page === total;
      previous.setAttribute('data-article-page', page - 1);
      next.setAttribute('data-article-page', page + 1);
      show(pager);
    }

    function navigate(nextKind, nextPage, reading) {
      apply(nextKind, nextPage);
      var hash = '#articles-' + kind + (page > 1 ? '-' + page : '');
      if (window.location.hash !== hash) window.history.pushState(null, '', hash);
      if (reading) {
        var heading = $('#articles-heading');
        focusQuiet(heading);
        heading.scrollIntoView({ block: 'start', behavior: 'instant' });
      }
    }

    scope.addEventListener('click', function (event) {
      var node = event.target;
      if (!node || !node.closest) return;
      var chip = node.closest('[data-article-filter]');
      if (!chip || !scope.contains(chip)) return;
      if (event.preventDefault) event.preventDefault();
      navigate(attr(chip, 'data-article-filter'), 1, false);
    }, false);

    pager.addEventListener('click', function (event) {
      var button = event.target.closest('[data-article-page]');
      if (!button || !pager.contains(button) || button.disabled) return;
      navigate(kind, Number(attr(button, 'data-article-page')), true);
    });
    function restore() {
      var state = window.location.hash.slice(1).match(/^(?:articles-)?(all|personal|business)(?:-([1-9]\d*))?$/);
      apply(state ? state[1] : 'all', state ? Number(state[2] || 1) : 1);
    }
    restore();
    if (page > 1) $('#articles-heading').scrollIntoView({ block: 'start', behavior: 'instant' });
    window.addEventListener('hashchange', restore);
    window.addEventListener('popstate', restore);
  }

  /* ---------- article: print button + current section in the TOC ---------- */
  function initArticleReading() {
    qa('[data-print]').forEach(function (button) {
      button.addEventListener('click', function () { window.print(); }, false);
    });
    var links = qa('.art-toc a[href^="#"]');
    if (!links.length || !('IntersectionObserver' in window)) return;
    var seen = {};
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { seen[entry.target.id] = entry.isIntersecting; });
      var current = '';
      links.forEach(function (link) {
        var id = attr(link, 'href').slice(1);
        if (!current && seen[id]) current = id;
      });
      if (!current) return;
      links.forEach(function (link) {
        if (attr(link, 'href') === '#' + current) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    links.forEach(function (link) {
      var heading = document.getElementById(attr(link, 'href').slice(1));
      if (heading) observer.observe(heading);
    });
  }

  /* ---------- lawyers ---------- */

  function initLawyers() {
    var faces = qa('[data-lawyer]');
    var panels = qa('[data-lawyer-panel]');
    if (!faces.length || !panels.length) return;

    var current = -1;
    var named = !!$('[data-named]');

    function indexFrom(el) {
      var value = parseInt(attr(el, 'data-lawyer'), 10);
      if (isNaN(value) || value < 1 || value > faces.length) return -1;
      return value - 1;
    }

    function paint(index) {
      current = index;
      faces.forEach(function (face, i) {
        var on = i === index;
        face.classList.toggle('on', on);
        face.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      panels.forEach(function (panel, i) {
        if (i === index) show(panel); else hide(panel);
        var heading = named ? $('[id^="lawyer-name-"]', panel) : null;
        var tag = i === index ? 'H1' : 'H2';
        if (heading && heading.tagName !== tag) {
          var replacement = document.createElement(tag);
          replacement.className = heading.className;
          replacement.classList.toggle('visually-hidden', tag === 'H2');
          replacement.id = heading.id;
          replacement.textContent = heading.textContent;
          heading.replaceWith(replacement);
        }
      });
      var tab = $('[data-switch-lawyer="' + (index + 1) + '"]', panels[index]);
      if (tab) {
        var strip = tab.parentNode, bounds = strip.getBoundingClientRect(), chip = tab.getBoundingClientRect();
        var delta = chip.left < bounds.left ? chip.left - bounds.left : Math.max(0, chip.right - bounds.right);
        if (delta) strip.scrollBy({ left: delta, behavior: 'instant' });
      }
    }

    function select(index, scroll) {
      if (index < 0 || index >= faces.length) return;
      paint(index);
      var face = faces[index];
      if (attr(face, 'data-title')) document.title = attr(face, 'data-title');
      try {
        window.history.replaceState(null, '', named ? attr(face, 'data-href') : '#lawyer-' + (index + 1));
      } catch (err) { /* file:// may refuse; the selection still works */ }
      if (scroll) {
        // Stacked layout (phones, tablets): show the new portrait at the top; wide layout: go to the profile.
        var stacked = window.matchMedia('(max-width: 767.98px)').matches;
        var behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
        if (stacked) window.scrollTo({ top: 0, behavior: behavior });
        else panels[index].scrollIntoView({ behavior: behavior });
      }
      panels[index].focus({ preventScroll: true });
    }

    var start = 0;
    for (var i = 0; i < faces.length; i += 1) {
      if (faces[i].getAttribute('aria-pressed') === 'true' || faces[i].classList.contains('on')) {
        start = i;
        break;
      }
    }
    var hash = !named && window.location.hash.match(/^#lawyer-([1-5])$/);
    if (hash) start = Number(hash[1]) - 1;
    paint(start);

    faces.forEach(function (face) {
      var index = indexFrom(face);
      face.addEventListener('click', function () {
        select(index, true);
      }, false);
    });
    function step(dir) { select((current + dir + faces.length) % faces.length, false); } /* arrows + swipe on phones; RTL: swipe right = next */
    qa('[data-lawyer-step]').forEach(function (b) { b.addEventListener('click', function () { step(parseInt(attr(b, 'data-lawyer-step'), 10)); }, false); });
    var box = $('.faces'), sx = 0, sy = 0;
    if (box) {
      box.addEventListener('touchstart', function (ev) { sx = ev.touches[0].clientX; sy = ev.touches[0].clientY; }, { passive: true });
      box.addEventListener('touchend', function (ev) {
        var dx = ev.changedTouches[0].clientX - sx, dy = ev.changedTouches[0].clientY - sy; if (window.matchMedia('(max-width: 767.98px)').matches && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx > 0 ? 1 : -1);
      }, { passive: true });
    }
    qa('[data-switch-lawyer]').forEach(function (button) {
      button.addEventListener('click', function () {
        select(parseInt(attr(button, 'data-switch-lawyer'), 10) - 1, false);
      });
    });
  }

  /* ---------- contact: route apps toggle ---------- */

  function initRouteToggle() {
    var button = $('[data-route-toggle]');
    var apps = button && document.getElementById(attr(button, 'aria-controls'));
    if (!apps) return;
    button.addEventListener('click', function () {
      var open = button.getAttribute('aria-expanded') !== 'true';
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) show(apps); else hide(apps);
    }, false);
  }

  /* ---------- contact: copy the address ---------- */

  function copyFallback(value, done, failed) {
    var area = null;
    try {
      area = document.createElement('textarea');
      area.setAttribute('readonly', '');
      area.className = 'visually-hidden';
      area.value = value;
      document.body.appendChild(area);
      area.select();
      var copied = document.execCommand ? document.execCommand('copy') : false;
      document.body.removeChild(area);
      if (copied) done();
      else failed();
    } catch (err) {
      try {
        if (area && area.parentNode) document.body.removeChild(area);
      } catch (err2) { /* ignore */ }
      failed();
    }
  }

  function copyAddress(value) {
    if (!value) return;
    var done = function () { M.toast(ui('toasts.copySuccess')); };
    var failed = function () { M.toast(fill(ui('toasts.copyFail'), { address: value })); };
    try {
      if (window.navigator && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value).then(done, function () {
          copyFallback(value, done, failed);
        });
        return;
      }
    } catch (err) { /* fall back below */ }
    copyFallback(value, done, failed);
  }

  function initCopyAddress() {
    qa('[data-copy-address]').forEach(function (button) {
      button.addEventListener('click', function () {
        // nav.js toasts while the address is still a bracket placeholder.
        if (button.hasAttribute('data-placeholder')) return;
        copyAddress(attr(button, 'data-copy-value') || '');
      }, false);
    });
  }

  /* ---------- calculators ---------- */

  function message(key, fallback) {
    var text = ui(key);
    return text ? text : (fallback || '');
  }

  function errorBox(input) {
    var ids = String(attr(input, 'aria-describedby') || '').split(/\s+/);
    for (var i = 0; i < ids.length; i += 1) {
      var el = document.getElementById(ids[i]);
      if (el && el.getAttribute('role') === 'alert') return el;
    }
    return null;
  }

  function markError(input, text) {
    if (!input) return;
    var box = errorBox(input);
    if (text) {
      input.setAttribute('aria-invalid', 'true');
      input.classList.add('err');
      if (box) {
        setText(box, text);
        show(box);
      }
    } else {
      input.removeAttribute('aria-invalid');
      input.classList.remove('err');
      if (box) {
        setText(box, '');
        hide(box);
      }
    }
  }

  function formErrorNode(form) {
    return $('[data-form-error]', form);
  }

  function clearErrors(form) {
    qa('input, select', form).forEach(function (input) {
      markError(input, null);
    });
    var general = formErrorNode(form);
    if (general) {
      setText(general, '');
      hide(general);
    }
    hide($('[data-error-summary]', form));
  }

  // GOV.UK style summary: one link per invalid field, focused so the list is announced first.
  function reportErrors(form, problems) {
    problems.forEach(function (problem) {
      markError(problem.input, problem.error);
    });
    var box = $('[data-error-summary]', form);
    var list = box ? $('ul', box) : null;
    if (!list) {
      focusQuiet(problems[0].input);
      return;
    }
    while (list.firstChild) list.removeChild(list.firstChild);
    problems.forEach(function (problem) {
      var label = form.querySelector('label[for="' + problem.input.id + '"]');
      var item = document.createElement('li');
      var link = document.createElement('a');
      link.href = '#' + problem.input.id;
      link.textContent = (label ? label.textContent + ': ' : '') + problem.error;
      link.addEventListener('click', function (event) {
        event.preventDefault();
        focusQuiet(problem.input);
      }, false);
      item.appendChild(link);
      list.appendChild(item);
    });
    show(box);
    focusQuiet(box);
  }

  function showFormError(form, text) {
    var general = formErrorNode(form);
    if (general) {
      setText(general, text);
      show(general);
      return true;
    }
    return false;
  }

  function field(form, id) {
    return form.querySelector('#' + id) || document.getElementById(id);
  }

  function bounds(input) {
    var min = parseInt(attr(input, 'min'), 10);
    var max = parseInt(attr(input, 'max'), 10);
    return { min: isNaN(min) ? null : min, max: isNaN(max) ? null : max };
  }

  function readValue(calc, input, options) {
    var raw = String(input.value === null || input.value === undefined ? '' : input.value);
    raw = calc && calc.normalizeDigits ? calc.normalizeDigits(raw) : M.digits.toLatin(raw);
    raw = raw.replace(/[\s\u200c\u200e\u200f]/g, '');
    if (!raw) return { error: message('calc.errRequired') };
    if (!/^\d+(\.\d+)?$/.test(raw)) return { error: message('calc.errNumber') };
    var value = parseFloat(raw);
    if (!isFinite(value)) return { error: message('calc.errNumber') };
    if (options && options.integer && Math.floor(value) !== value) return { error: message('calc.errNumber') };
    if (options && options.positive && value <= 0) return { error: message('calc.errRange') };
    var limits = bounds(input);
    if (limits.min !== null && value < limits.min) return { error: message('calc.errRange') };
    if (limits.max !== null && value > limits.max) return { error: message('calc.errRange') };
    return { value: options && options.integer ? Math.round(value) : value };
  }

  function resultNode() {
    return $('[data-result]');
  }

  function showResult(result, value, unit) {
    if (!result) return;
    setText($('[data-result-value]', result), value);
    setText($('[data-result-unit]', result), unit);
    hide($('[data-result-empty]', result));
    hide($('[data-result-stale]', result));
    result.classList.remove('is-stale');
    show($('[data-result-body]', result));
    focusQuiet(result);
  }

  // Inputs changed after a result: keep the number but mark it as out of date.
  function markStale() {
    var result = resultNode();
    var body = result ? $('[data-result-body]', result) : null;
    if (!body || body.hasAttribute('hidden')) return;
    result.classList.add('is-stale');
    show($('[data-result-stale]', result));
  }

  function unitLabel(form) {
    var radio = form.querySelector('input[name="sev-unit"]:checked');
    var label = radio ? radio.closest('label') : null;
    return label ? String(label.textContent || '').trim() : '';
  }

  function runSeverance(form, calc) {
    var wage = field(form, 'sev-wage');
    var years = field(form, 'sev-years');
    var problems = [];

    if (!wage || !years) {
      showFormError(form, message('calc.errUnavailable'));
      return;
    }
    var wageRead = readValue(calc, wage, { positive: true });
    var yearsRead = readValue(calc, years, { positive: true });
    if (wageRead.error) problems.push({ input: wage, error: wageRead.error });
    if (yearsRead.error) problems.push({ input: years, error: yearsRead.error });
    if (problems.length) {
      reportErrors(form, problems);
      return;
    }

    var amount = calc.severance(wageRead.value, yearsRead.value);
    if (amount === null || amount === undefined || !isFinite(amount)) {
      problems.push({ input: wage, error: message('calc.errNumber') });
      reportErrors(form, problems);
      return;
    }
    amount = Math.round(amount * 100) / 100;
    var text = calc.formatNumber ? calc.formatNumber(amount) : M.formatNumber(amount);
    showResult(resultNode(), text || '', unitLabel(form));
  }

  function jalaliValid(calc, year, month, day) {
    if (calc.jalaliMonthLength && calc.jalaliMonthLength(year, month) === null) return false;
    if (calc.jalaliToGregorian && calc.gregorianToJalali) {
      var gregorian = calc.jalaliToGregorian(year, month, day);
      if (!gregorian) return false;
      var back = calc.gregorianToJalali(gregorian.gy, gregorian.gm, gregorian.gd);
      if (!back || back.jy !== year || back.jm !== month || back.jd !== day) return false;
    }
    return true;
  }

  function runDeadline(form, calc) {
    var year = field(form, 'deadline-year');
    var month = field(form, 'deadline-month');
    var day = field(form, 'deadline-day');
    var days = field(form, 'deadline-days');
    var problems = [];

    if (!year || !month || !day || !days) {
      showFormError(form, message('calc.errUnavailable'));
      return;
    }
    var read = [
      readValue(calc, year, { integer: true }),
      readValue(calc, month, { integer: true }),
      readValue(calc, day, { integer: true }),
      readValue(calc, days, { integer: true })
    ];
    var inputs = [year, month, day, days];
    read.forEach(function (entry, i) {
      if (entry.error) problems.push({ input: inputs[i], error: entry.error });
    });
    if (problems.length) {
      reportErrors(form, problems);
      return;
    }

    var jy = read[0].value;
    var jm = read[1].value;
    var jd = read[2].value;
    var count = read[3].value;

    if (!jalaliValid(calc, jy, jm, jd)) {
      problems.push({ input: day, error: message('calc.errDate') });
      reportErrors(form, problems);
      return;
    }

    var added = calc.addDaysJalali ? calc.addDaysJalali(jy, jm, jd, count) : null;
    if (!added) {
      if (!showFormError(form, message('calc.errDate'))) {
        problems.push({ input: days, error: message('calc.errRange') });
        reportErrors(form, problems);
      }
      return;
    }

    var weekday = added.weekday || '';
    if (calc.jalaliToGregorian && calc.weekdayNameFa) {
      var gregorian = calc.jalaliToGregorian(added.jy, added.jm, added.jd);
      if (gregorian) weekday = calc.weekdayNameFa(gregorian.gy, gregorian.gm, gregorian.gd) || weekday;
    }
    var dateText = fa(added.jy) + '/' + fa(pad2(added.jm)) + '/' + fa(pad2(added.jd));
    var label = message('calc.deadlineResult');
    showResult(resultNode(), dateText, [label, weekday].filter(Boolean).join(SEPARATOR));
  }

  function initCalculators() {
    qa('form[data-calculator]').forEach(function (form) {
      var kind = attr(form, 'data-calculator');
      if (kind !== 'severance' && kind !== 'deadline') return;

      form.addEventListener('submit', function (event) {
        if (event.preventDefault) event.preventDefault();
        var calc = window.MabdaCalc;
        clearErrors(form);
        if (!calc || typeof calc.severance !== 'function' || typeof calc.addDaysJalali !== 'function') {
          showFormError(form, message('calc.errUnavailable'));
          return;
        }
        if (kind === 'severance') runSeverance(form, calc);
        else if (kind === 'deadline') runDeadline(form, calc);
      }, false);

      // Typing again clears the message under the field.
      form.addEventListener('input', function (event) {
        var input = event.target;
        if (input && (input.tagName === 'INPUT' || input.tagName === 'SELECT')) markError(input, null);
        markStale();
      }, false);
      form.addEventListener('change', function (event) {
        var input = event.target;
        if (input && input.tagName === 'SELECT') markError(input, null);
      }, false);
    });
  }

  /* ---------- start ---------- */
  function init() {
    initArticles();
    initArticleReading();
    initLawyers();
    initCopyAddress();
    initRouteToggle();
    initCalculators();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
