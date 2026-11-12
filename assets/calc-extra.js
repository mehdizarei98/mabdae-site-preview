/* Working preview tools and FAQ filtering. Arithmetic lives in calc.js; data/copy remain in SITE_DATA. */
(function () {
  'use strict';
  var M = window.Mabda, C = window.MabdaCalc, data = window.SITE_DATA;
  if (!M || !C || !data) return;
  var ui = function (key) { return M.ui('c5.' + key); };
  var number = function (value) { return C.formatNumber(value); };
  var digits = function (value) { return M.digits.toFa(String(value)); };
  function dateText(date) { return digits(date.y + '/' + String(date.m).padStart(2, '0') + '/' + String(date.d).padStart(2, '0')); }
  function initFaq() {
    var input = M.$('[data-faq-search]'), root = M.$('[data-faq]');
    if (!input || !root) return;
    input.addEventListener('input', function () {
      var query = input.value.trim().toLocaleLowerCase(), count = 0;
      M.$$('[data-faq-group]', root).forEach(function (group) {
        var shown = 0;
        M.$$('[data-faq-item]', group).forEach(function (item) {
          item.hidden = M.$('.ac-q', item).textContent.toLocaleLowerCase().indexOf(query) === -1;
          if (!item.hidden) shown += 1;
        });
        group.hidden = !shown;
        count += shown;
      });
      M.$('[data-faq-empty]', root).hidden = count !== 0;
    });
  }
  function start() {
    initFaq();
    M.$$('[data-extra-calculator]').forEach(function (form) {
      var kind = form.getAttribute('data-extra-calculator'), result = M.$('[data-result]');
      var body = M.$('[data-result-body]', result), empty = M.$('[data-result-empty]', result);
      var output = M.$('[data-extra-output]', result), summary = M.$('[data-error-summary]', form);
      var download = M.$('[data-calendar-download]', result), print = M.$('[data-print]', result);
      var url = null, problems = [];
      function field(id) { return M.$('#' + id, form); }
      function problem(input, key) {
        problems.push({ input: input, text: key === 'unsupported' ? ui(key) : M.ui('calc.' + key) });
        return null;
      }
      function read(id, integer) {
        var input = field(id), raw = C.normalizeDigits(input.value).replace(/[,\s\u200c\u200e\u200f]/g, '');
        if (!raw) return problem(input, 'errRequired');
        if (!/^\d+(\.\d+)?$/.test(raw)) return problem(input, 'errNumber');
        var value = Number(raw), low = input.getAttribute('min'), high = input.getAttribute('max');
        if (!Number.isFinite(value) || (integer && !Number.isInteger(value))) return problem(input, 'errNumber');
        if ((low !== null && value < Number(low)) || (high !== null && value > Number(high))) return problem(input, 'errRange');
        return value;
      }
      function readDate(id, calendar) {
        var input = field(id), raw = C.normalizeDigits(input.value).trim();
        var parts = raw.match(/^(\d{1,4})[/-](\d{1,2})[/-](\d{1,2})$/);
        var date = parts && { y: Number(parts[1]), m: Number(parts[2]), d: Number(parts[3]) };
        if (!date || !C.convertDate(calendar, date)) return problem(input, 'errDate');
        return date;
      }
      function invalidate() {
        if (url) { URL.revokeObjectURL(url); url = null; }
        if (download) { download.hidden = true; download.removeAttribute('href'); }
        if (print) print.disabled = true;
        if (!body.hidden) {
          result.classList.add('is-stale');
          M.$('[data-result-stale]', result).hidden = false;
        }
      }
      function errors() {
        var list = M.$('ul', summary);
        list.textContent = '';
        problems.forEach(function (entry) {
          var input = entry.input, item = document.createElement('li'), link = document.createElement('a');
          var label = M.$('label[for="' + input.id + '"]', form) || input.closest('label');
          input.setAttribute('aria-invalid', 'true');
          var box = field(input.id + '-error');
          if (box) { box.textContent = entry.text; box.hidden = false; }
          link.href = '#' + input.id;
          link.textContent = (label ? label.textContent.trim() + ': ' : '') + entry.text;
          link.addEventListener('click', function (event) { event.preventDefault(); input.focus(); });
          item.appendChild(link); list.appendChild(item);
        });
        summary.hidden = false; summary.focus();
      }
      function line(text) { var p = document.createElement('p'); p.textContent = text; output.appendChild(p); }
      form.addEventListener('submit', function (event) {
        event.preventDefault(); invalidate(); problems = []; summary.hidden = true;
        M.$$('[aria-invalid]', form).forEach(function (input) { input.removeAttribute('aria-invalid'); });
        M.$$('.error-text', form).forEach(function (node) { node.hidden = true; });
        output.textContent = '';
        var value = '', unit = '', list, adjusted, first, second, calendar, days, converted;
        if (kind === 'documents') {
          list = C.documentsFor(data.docsets, field('document-topic').value);
          if (!list) problem(field('document-topic'), 'errRequired');
          else {
            value = field('document-topic').selectedOptions[0].textContent;
            var docs = document.createElement('div'); docs.className = 'checklist-print';
            list.forEach(function (text) {
              var label = document.createElement('label'), input = document.createElement('input'), span = document.createElement('span');
              label.className = 'ck'; input.type = 'checkbox'; span.textContent = text;
              label.append(input, span); docs.appendChild(label);
            });
            output.appendChild(docs);
          }
        } else if (kind === 'dates') {
          calendar = field('date-calendar').value;
          first = readDate('date-start', calendar);
          if (field('date-end').value.trim()) second = readDate('date-end', field('date-end-calendar').value);
          if (!problems.length) {
            converted = C.convertDate(calendar, first);
            ['jalali', 'gregorian', 'hijri'].forEach(function (key) { line(ui(key) + ': ' + dateText(converted[key])); });
            value = second ? number(C.dateInterval(calendar, first, field('date-end-calendar').value, second)) : dateText(converted.jalali);
            unit = second ? ui('interval') : ui('jalali');
          }
        } else if (kind === 'reminder') {
          var y = read('deadline-year', true), m = read('deadline-month', true), d = read('deadline-day', true);
          days = read('deadline-days', true);
          if (!problems.length) {
            var text = C.calendarFile(y, m, d, days, M.ui('calc.deadlineResult'));
            var end = C.addDaysJalali(y, m, d, days);
            if (!text) problem(field('deadline-day'), 'errDate');
            else {
              value = dateText({ y: end.jy, m: end.jm, d: end.jd }); unit = M.ui('calc.deadlineResult');
              url = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }));
              download.href = url; download.hidden = false;
            }
          }
        } else if (kind === 'mahriyeh' || kind === 'cheque') {
          var amount = read('index-amount'), base = read('index-base', true), claim = read('index-claim', true);
          if (!problems.length) {
            adjusted = C.indexAdjustment(amount, base, claim, data.indexTable);
            if (!adjusted) problem(field('index-claim'), 'errRange');
            else {
              value = number(kind === 'cheque' ? adjusted.damages : adjusted.adjusted); unit = M.ui('calc.unitToman');
              line(ui('adjusted') + ': ' + number(adjusted.adjusted));
              if (kind === 'cheque') line(ui('damages') + ': ' + number(adjusted.damages));
            }
          }
        } else if (kind === 'inheritance') {
          var estate = read('estate'), sons = read('sons', true), daughters = read('daughters', true);
          if (!problems.length) {
            list = C.inheritanceShares(estate, { sons: sons, daughters: daughters, spouse: field('spouse').value,
              father: field('father').checked, mother: field('mother').checked, simple: field('inheritance-scope').checked });
            if (!list) problem(field('inheritance-scope'), 'unsupported');
            else {
              value = number(estate); unit = M.ui('calc.unitToman');
              var shares = document.createElement('ul'); shares.className = 'heir-shares';
              list.forEach(function (row) {
                var item = document.createElement('li'), fraction = document.createElement('bdi'); fraction.dir = 'ltr';
                item.append(document.createTextNode(ui(row.heir) + (['son', 'daughter'].indexOf(row.heir) >= 0 ? ' ' + digits(row.number) : '') + ': '));
                fraction.textContent = digits(row.numerator) + '/' + digits(row.denominator);
                item.append(fraction, document.createTextNode(' · ' + number(row.amount) + ' ' + unit)); shares.appendChild(item);
              });
              output.appendChild(shares);
            }
          }
        }
        if (problems.length) { errors(); return; }
        M.$('[data-result-value]', result).textContent = value;
        M.$('[data-result-unit]', result).textContent = unit;
        M.$('[data-result-stale]', result).hidden = true;
        result.classList.remove('is-stale'); empty.hidden = true; body.hidden = false;
        if (print) print.disabled = false;
        result.focus();
      });
      ['input', 'change'].forEach(function (type) { form.addEventListener(type, invalidate); });
      window.addEventListener('pagehide', function () { if (url) URL.revokeObjectURL(url); });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
}());
