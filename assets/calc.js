/*
 * calc.js — Jalali calendar math and calculator primitives.
 * Pure functions, classic script: works in the browser (window.MabdaCalc)
 * and in node (module.exports) for tests/calc.test.js.
 * Jalali<->Gregorian: the jalaali-js toJalaali/toGregorian algorithm
 * (33-year-cycle leap pattern anchored on the break table).
 */
(function () {
  'use strict';

  // Break points of the Jalali 33-year-cycle pattern (jalaali-js table).
  var BREAKS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210,
    2875, 2957, 3059, 3137, 3313, 3414, 3457, 3552, 3644, 3666, 3695,
    3725, 3759, 3788, 3822, 3856, 3890, 3925, 3958, 3991, 4024, 4057,
    4090, 4123, 4156, 4189, 4222, 4255, 4290];

  var JY_MIN = 1300, JY_MAX = 1500; // range the site supports and the table is tested for
  var GY_MIN = 1900, GY_MAX = 2200;

  // Indexed by (daysSinceEpoch + 4) % 7, 0 = Sunday.
  var WEEKDAYS_FA = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];

  function div(a, b) { return Math.floor(a / b); }
  function mod(a, b) { var c = a % b; return c < 0 ? c + b : c; }
  function isIntNum(v) { return typeof v === 'number' && isFinite(v) && Math.floor(v) === v; }

  function gregorianLeap(gy) {
    return gy % 4 === 0 && (gy % 100 !== 0 || gy % 400 === 0);
  }

  // Hinnant days<->civil: days since 1970-01-01 (Thursday).
  function g2d(gy, gm, gd) {
    var y = gy - (gm <= 2 ? 1 : 0);
    var era = div(y, 400);
    var yoe = y - era * 400;
    var doy = div(153 * (gm + (gm > 2 ? -3 : 9)) + 2, 5) + gd - 1;
    var doe = yoe * 365 + div(yoe, 4) - div(yoe, 100) + doy;
    return era * 146097 + doe - 719468;
  }

  function d2g(dayNo) {
    var z = dayNo + 719468;
    var era = div(z, 146097);
    var doe = z - era * 146097;
    var yoe = div(doe - div(doe, 1460) + div(doe, 36524) - div(doe, 146096), 365);
    var y = yoe + era * 400;
    var doy = doe - (365 * yoe + div(yoe, 4) - div(yoe, 100));
    var mp = div(5 * doy + 2, 153);
    var gd = doy - div(153 * mp + 2, 5) + 1;
    var gm = mp + (mp < 10 ? 3 : -9);
    return { gy: y + (gm <= 2 ? 1 : 0), gm: gm, gd: gd };
  }

  // { leap, gy, march } for a Jalali year; `march` is the Gregorian day of
  // Farvardin 1 (the year's vernal point used by the table).
  function jalCal(jy) {
    var bl = BREAKS.length, gy = jy + 621, leapJ = -14, jp = BREAKS[0];
    var jm, jump = 0, leap, leapG, march, n, i;

    for (i = 1; i < bl; i += 1) {
      jm = BREAKS[i];
      jump = jm - jp;
      if (jy < jm) break;
      leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
      jp = jm;
    }
    n = jy - jp;

    leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
    if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;

    leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
    march = 20 + leapJ - leapG;

    if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;

    leap = mod(mod(n + 1, 33) - 1, 4);
    if (leap === -1) leap = 4;

    return { leap: leap, gy: gy, march: march };
  }

  function isJalaliLeap(y) {
    if (!isIntNum(y) || y < JY_MIN || y > JY_MAX) return null;
    return jalCal(y).leap === 0;
  }

  function jalaliMonthLength(y, m) {
    if (!isIntNum(y) || y < JY_MIN || y > JY_MAX) return null;
    if (!isIntNum(m) || m < 1 || m > 12) return null;
    if (m <= 6) return 31;
    if (m <= 11) return 30;
    return jalCal(y).leap === 0 ? 30 : 29;
  }

  function validJalali(jy, jm, jd) {
    if (!isIntNum(jy) || jy < JY_MIN || jy > JY_MAX) return false;
    if (!isIntNum(jm) || jm < 1 || jm > 12) return false;
    if (!isIntNum(jd) || jd < 1) return false;
    return jd <= jalaliMonthLength(jy, jm);
  }

  function validGregorian(gy, gm, gd) {
    if (!isIntNum(gy) || gy < GY_MIN || gy > GY_MAX) return false;
    if (!isIntNum(gm) || gm < 1 || gm > 12) return false;
    if (!isIntNum(gd) || gd < 1) return false;
    var days = gm === 2 ? (gregorianLeap(gy) ? 29 : 28) : (gm in {1:1,3:1,5:1,7:1,8:1,10:1,12:1} ? 31 : 30);
    return gd <= days;
  }

  function j2d(jy, jm, jd) {
    var r = jalCal(jy);
    return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
  }

  function d2j(dayNo) {
    var g = d2g(dayNo);
    var jy = g.gy - 621;
    var r = jalCal(jy);
    var k = dayNo - g2d(r.gy, 3, r.march);
    var jm, jd;

    if (k >= 0) {
      if (k <= 185) {
        return { jy: jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 };
      }
      k -= 186;
    } else {
      jy -= 1;
      // day is Dey/Bahman/Esfand of the previous Jalali year (its length varies)
      k += (jalCal(jy).leap === 0 ? 366 : 365) - 186;
    }
    jm = 7 + div(k, 30);
    jd = mod(k, 30) + 1;
    return { jy: jy, jm: jm, jd: jd };
  }

  function jalaliToGregorian(jy, jm, jd) {
    if (!validJalali(jy, jm, jd)) return null;
    return d2g(j2d(jy, jm, jd));
  }

  function gregorianToJalali(gy, gm, gd) {
    if (!validGregorian(gy, gm, gd)) return null;
    return d2j(g2d(gy, gm, gd));
  }

  function weekdayNameFa(gy, gm, gd) {
    if (!validGregorian(gy, gm, gd)) return null;
    return WEEKDAYS_FA[mod(g2d(gy, gm, gd) + 4, 7)];
  }

  function addDaysJalali(jy, jm, jd, days) {
    if (!validJalali(jy, jm, jd)) return null;
    if (!isIntNum(days) || days < 0 || days > 36500) return null;
    var dayNo = j2d(jy, jm, jd) + days;
    var j = d2j(dayNo);
    return { jy: j.jy, jm: j.jm, jd: j.jd, weekday: WEEKDAYS_FA[mod(dayNo + 4, 7)] };
  }

  function severance(monthlyWage, years) {
    if (typeof monthlyWage !== 'number' || !isFinite(monthlyWage) || monthlyWage < 0) return null;
    if (typeof years !== 'number' || !isFinite(years) || years < 0) return null;
    return monthlyWage * years;
  }

  var FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
  var AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

  function normalizeDigits(str) {
    if (str === null || str === undefined) return '';
    var out = '', i, c, d;
    var s = String(str);
    for (i = 0; i < s.length; i += 1) {
      c = s.charAt(i);
      d = FA_DIGITS.indexOf(c);
      if (d !== -1) { out += String(d); continue; }
      d = AR_DIGITS.indexOf(c);
      if (d !== -1) { out += String(d); continue; }
      if (c === '٫') { out += '.'; continue; }   // Persian decimal separator
      if (c === '٬') { continue; }               // Persian thousands separator
      out += c;
    }
    return out;
  }

  function formatNumber(n) {
    if (typeof n !== 'number' || !isFinite(n)) return null;
    var neg = n < 0;
    var s = Math.abs(n).toString();
    if (s.indexOf('e') !== -1 || s.indexOf('E') !== -1) return null;
    var parts = s.split('.');
    var int = parts[0], frac = parts[1] || '';
    var out = '', i, rem;
    for (i = 0; i < int.length; i += 1) {
      out += FA_DIGITS.charAt(Number(int.charAt(i)));
      rem = int.length - i - 1;
      if (rem > 0 && rem % 3 === 0) out += '٬';
    }
    if (frac) {
      out += '٫';
      for (i = 0; i < frac.length; i += 1) out += FA_DIGITS.charAt(Number(frac.charAt(i)));
    }
    return (neg ? '−' : '') + out;
  }

  // Tabular civil Hijri: 30-year leap cycle; Friday epoch (622-07-19 Gregorian).
  // Reference: Unicode ICU IslamicCivilCalendar, not observed lunar dates.
  function h2d(y, m, d) {
    return g2d(622, 7, 19) + 354 * (y - 1) + div(3 + 11 * y, 30) + Math.ceil(29.5 * (m - 1)) + d - 1;
  }
  function hijriToGregorian(y, m, d) {
    var length = m === 12 ? (mod(11 * y + 14, 30) < 11 ? 30 : 29) : (m % 2 ? 30 : 29);
    if (![y, m, d].every(isIntNum) || y < 1 || y > 2000 || m < 1 || m > 12 || d < 1 || d > length) return null;
    return d2g(h2d(y, m, d));
  }
  function d2h(day) {
    var y = div(30 * (day - g2d(622, 7, 19)) + 10646, 10631), m = 1;
    while (m < 12 && h2d(y, m + 1, 1) <= day) m += 1;
    return { y: y, m: m, d: day - h2d(y, m, 1) + 1 };
  }
  function gregorianToHijri(y, m, d) {
    return validGregorian(y, m, d) ? d2h(g2d(y, m, d)) : null;
  }
  function convertDate(calendar, date) {
    if (!date) return null;
    var y = date.y, m = date.m, d = date.d, g;
    if (calendar === 'jalali') g = jalaliToGregorian(y, m, d);
    else if (calendar === 'gregorian' && validGregorian(y, m, d)) g = { gy: y, gm: m, gd: d };
    else if (calendar === 'hijri') g = hijriToGregorian(y, m, d);
    if (!g) return null;
    var day = g2d(g.gy, g.gm, g.gd);
    if (day < j2d(JY_MIN, 1, 1) || day > j2d(JY_MAX, 12, jalaliMonthLength(JY_MAX, 12))) return null;
    var j = d2j(day);
    return { jalali: { y: j.jy, m: j.jm, d: j.jd }, gregorian: { y: g.gy, m: g.gm, d: g.gd }, hijri: d2h(day), day: day };
  }
  function dateInterval(calendar, first, otherCalendar, second) {
    var a = convertDate(calendar, first), b = convertDate(otherCalendar, second);
    return a && b ? Math.abs(b.day - a.day) : null;
  }
  function documentsFor(docsets, topic) {
    var set = docsets.find(function (item) { return item.id === topic; });
    return set && Array.isArray(set.docs) ? set.docs.slice() : null;
  }
  function indexAdjustment(amount, base, claim, table) {
    if (!Number.isFinite(amount) || amount < 0 || amount > 1e12 || !isIntNum(base) || !isIntNum(claim) || claim < base) return null;
    var values = table && table.values;
    var a = values && values[String(base)], b = values && values[String(claim)];
    if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return null;
    var adjusted = Math.round(amount * b / a * 100) / 100;
    if (!Number.isSafeInteger(Math.round(adjusted * 100))) return null;
    return { adjusted: adjusted, damages: Math.round((adjusted - amount) * 100) / 100 };
  }
  function calendarFile(y, m, d, days, summary, stamp) {
    var end = addDaysJalali(y, m, d, days);
    var g = end && jalaliToGregorian(end.jy, end.jm, end.jd);
    if (!g || typeof summary !== 'string') return null;
    function compact(date) { return String(date.gy).padStart(4, '0') + String(date.gm).padStart(2, '0') + String(date.gd).padStart(2, '0'); }
    function escape(text) { return text.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/[,;]/g, '\\$&'); }
    function fold(line) {
      var size = 0, out = '';
      Array.from(line).forEach(function (char) {
        var bytes = new TextEncoder().encode(char).length;
        if (size + bytes > 75) { out += '\r\n '; size = 1; }
        out += char; size += bytes;
      });
      return out;
    }
    var start = compact(g), after = compact(d2g(g2d(g.gy, g.gm, g.gd) + 1));
    var now = stamp || new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    if (!/^\d{8}T\d{6}Z$/.test(now)) return null;
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mabda//Deadline//EN', 'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT', 'UID:' + y + '-' + m + '-' + d + '-' + days + '@mabda.local', 'DTSTAMP:' + now,
      'DTSTART;VALUE=DATE:' + start, 'DTEND;VALUE=DATE:' + after, 'SUMMARY:' + escape(summary),
      'END:VEVENT', 'END:VCALENDAR'].map(fold).join('\r\n') + '\r\n';
  }
  // Prototype first-degree cases only; the page requires explicit scope confirmation and lawyer review.
  // Civil Code arts. 905-909, 913-914: https://wipolex-res.wipo.int/edocs/lexdocs/laws/en/ir/ir009en.html
  function inheritanceShares(estate, heirs) {
    if (!Number.isFinite(estate) || estate < 0 || estate > 1e12 || !heirs || heirs.simple !== true) return null;
    var sons = heirs.sons, daughters = heirs.daughters, father = heirs.father, mother = heirs.mother, spouse = heirs.spouse;
    if (![sons, daughters].every(function (n) { return isIntNum(n) && n >= 0 && n <= 30; }) ||
        typeof father !== 'boolean' || typeof mother !== 'boolean' || ['none', 'husband', 'wife'].indexOf(spouse) < 0) return null;
    var children = sons + daughters, parents = Number(father) + Number(mother), rows = [];
    if (!children && !parents && spouse !== 'husband') return null;
    var marital = spouse === 'husband' ? (children ? 6 : 12) : spouse === 'wife' ? (children ? 3 : 6) : 0;
    function add(heir, n, numerator, denominator) {
      function gcd(a, b) { return b ? gcd(b, a % b) : a; }
      var factor = gcd(numerator, denominator);
      rows.push({ heir: heir, number: n, numerator: numerator / factor, denominator: denominator / factor });
    }
    if (!children && !parents) { add('husband', 1, 1, 1); }
    else {
      if (marital) add(spouse, 1, marital, 24);
      if (sons) {
        if (father) add('father', 1, 1, 6);
        if (mother) add('mother', 1, 1, 6);
        var remaining = 24 - marital - parents * 4, weights = sons * 2 + daughters;
        for (var s = 1; s <= sons; s += 1) add('son', s, remaining * 2, 24 * weights);
        for (var d = 1; d <= daughters; d += 1) add('daughter', d, remaining, 24 * weights);
      } else if (daughters) {
        var daughterWeight = daughters === 1 ? 12 : 16, total = parents * 4 + daughterWeight, available = 24 - marital;
        var parentN = total > available ? 4 : available * 4, parentD = total > available ? 24 : 24 * total;
        if (father) add('father', 1, parentN, parentD);
        if (mother) add('mother', 1, parentN, parentD);
        var daughterN = total > available ? available - parents * 4 : available * daughterWeight;
        var daughterD = total > available ? 24 * daughters : 24 * total * daughters;
        for (var i = 1; i <= daughters; i += 1) add('daughter', i, daughterN, daughterD);
      } else if (parents === 2) {
        add('mother', 1, 1, 3); add('father', 1, 24 - marital - 8, 24);
      } else add(father ? 'father' : 'mother', 1, 24 - marital, 24);
    }
    var cents = Math.round(estate * 100), assigned = 0;
    rows.forEach(function (row) {
      var exact = cents * row.numerator / row.denominator;
      row.cents = Math.floor(exact); row.remainder = exact - row.cents; assigned += row.cents;
    });
    rows.slice().sort(function (a, b) { return b.remainder - a.remainder; }).forEach(function (row) {
      if (assigned < cents) { row.cents += 1; assigned += 1; }
    });
    rows.forEach(function (row) { row.amount = row.cents / 100; delete row.cents; delete row.remainder; });
    return rows;
  }

  var api = {
    normalizeDigits: normalizeDigits,
    formatNumber: formatNumber,
    isJalaliLeap: isJalaliLeap,
    jalaliMonthLength: jalaliMonthLength,
    jalaliToGregorian: jalaliToGregorian,
    gregorianToJalali: gregorianToJalali,
    addDaysJalali: addDaysJalali,
    weekdayNameFa: weekdayNameFa,
    severance: severance,
    hijriToGregorian: hijriToGregorian,
    gregorianToHijri: gregorianToHijri,
    convertDate: convertDate,
    dateInterval: dateInterval,
    documentsFor: documentsFor,
    indexAdjustment: indexAdjustment,
    calendarFile: calendarFile,
    inheritanceShares: inheritanceShares
  };

  if (typeof module !== 'undefined') module.exports = api;
  if (typeof window !== 'undefined') window.MabdaCalc = api;
})();
