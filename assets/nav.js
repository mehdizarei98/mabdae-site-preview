/*
 * nav.js — site chrome: mega disclosure, mobile sheet, search overlay,
 * mobile bottom bar and placeholder-link handling.
 * Classic script. Depends on window.Mabda (common.js) and, for search,
 * window.SEARCH_INDEX (assets/search-index.js).
 *
 * Listener budget (one per concern, no double handling):
 *   click   — one document-level delegated handler for every nav action.
 *   keydown — one document-level handler for Escape. Arrow keys inside the sheet
 *             tablist have their own scoped handler (a different concern).
 *   submit  — one scoped handler on the search form.
 *   input   — one scoped handler on the search field.
 * The «چه مدارکی بیاورم؟» drawer (#drawer-dialog) belongs to pages.js: its open/close
 * buttons, tabs, scrim and Escape handling are deliberately ignored here.
 * Ownership that must NOT be repeated in pages.js: [data-placeholder] and [data-toast]
 * are handled globally below (including the copy-address button while the address is
 * still a bracket placeholder — the real copy action only runs once config is filled).
 */
(function () {
  'use strict';

  var M = window.Mabda;
  if (!M) return;

  var $ = M.$;
  var qa = M.$$;
  var DRAWER_ID = 'drawer-dialog';
  var MEGA_ID = 'mega-menu';
  var MAX_RESULTS = 8;

  var mega = null;
  var sheet = null;
  var search = null;
  var searchForm = null;
  var searchInput = null;
  var searchResults = null;
  var searchStatus = null;
  var tablist = null;
  var tabs = [];
  var base = '';

  /* ---------- small helpers ---------- */

  function pageBase() {
    var value = document.body ? document.body.getAttribute('data-base') : null;
    return value ? value : '';
  }

  function setExpanded(selector, open) {
    qa(selector).forEach(function (el) {
      if (el.hasAttribute('aria-expanded')) el.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  function inDrawer(node) {
    return !!node && node.id === DRAWER_ID;
  }

  /* ---------- mega menu (disclosure, desktop only) ---------- */

  function megaOpen() {
    return M.overlay.isOpen(mega);
  }

  // One panel per section; the trigger's data-open-mega names it.
  function showPanel(opener) {
    var key = opener ? opener.getAttribute('data-open-mega') : '';
    qa('.mp', mega).forEach(function (panel) {
      panel.hidden = panel.getAttribute('data-mega') !== key;
    });
    qa('[data-open-mega]').forEach(function (btn) {
      btn.setAttribute('aria-expanded', btn === opener ? 'true' : 'false');
    });
  }

  var activeTrigger = null;
  var openedBy = null;
  var closeTimer = 0;
  var focusDismissed = false;

  // quiet = opened by the pointer: no focus jump into the panel.
  function openMega(opener, quiet) {
    if (!mega) return;
    activeTrigger = opener || null;
    showPanel(opener);
    if (!megaOpen()) openedBy = opener || null;
    if (!megaOpen()) M.overlay.open(mega, { modal: false, trap: false, opener: opener || null, focus: !quiet });
  }

  function closeMega(restoreFocus) {
    if (!mega || !megaOpen()) return;
    var last = activeTrigger;
    focusDismissed = true; // Escape's focus restoration must not reopen the menu.
    M.overlay.close(mega, { restore: restoreFocus !== false });
    // The overlay restores focus to the trigger that opened it; after switching sections, go to the last one used.
    if (restoreFocus !== false && last && last !== openedBy) setTimeout(function () { last.focus(); }, 50);
  }

  /* ---------- sheet + search (modal dialogs) ---------- */

  function openDialog(el, opener) {
    if (!el) return;
    closeMega(false);
    M.overlay.open(el, { opener: opener || null });
  }

  function closeDialog(el, restoreFocus) {
    if (!el || !M.overlay.isOpen(el)) return false;
    return M.overlay.close(el, { restore: restoreFocus !== false });
  }

  function openSheet(opener) {
    openDialog(sheet, opener);
  }

  function openSearch(opener) {
    if (!search) return;
    if (searchInput) searchInput.value = '';
    drawResults('');
    openDialog(search, opener);
  }

  /* ---------- sheet tabs ---------- */

  function indexOfTab(tab) {
    return tab ? tabs.indexOf(tab) : -1;
  }

  function selectTab(index, moveFocus) {
    if (!tabs.length) return;
    var chosen = Math.max(0, Math.min(tabs.length - 1, index));
    tabs.forEach(function (tab, i) {
      var on = i === chosen;
      tab.classList.toggle('on', on);
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.setAttribute('tabindex', on ? '0' : '-1');
      var panel = document.getElementById(tab.getAttribute('aria-controls') || '');
      if (panel) {
        if (on) panel.removeAttribute('hidden');
        else panel.setAttribute('hidden', '');
      }
    });
    if (moveFocus) {
      try {
        tabs[chosen].focus();
      } catch (err) { /* ignore */ }
    }
  }

  function initialTab() {
    for (var i = 0; i < tabs.length; i += 1) {
      if (tabs[i].getAttribute('aria-selected') === 'true' || tabs[i].classList.contains('on')) return i;
    }
    return 0;
  }

  function onTablistKeys(event) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    var current = indexOfTab(document.activeElement);
    if (current === -1) return;
    var step = 0;
    if (event.key === 'ArrowLeft') step = 1;                 // RTL: left points to the next tab
    else if (event.key === 'ArrowRight') step = -1;
    else if (event.key === 'Home') { event.preventDefault(); selectTab(0, true); return; }
    else if (event.key === 'End') { event.preventDefault(); selectTab(tabs.length - 1, true); return; }
    else return;
    event.preventDefault();
    if (document.documentElement.dir === 'ltr') step = -step;
    selectTab((current + step + tabs.length) % tabs.length, true);
  }

  /* ---------- search ---------- */

  function normalize(value) {
    return M.digits.toLatin(value === null || value === undefined ? '' : String(value))
      .toLowerCase()
      .replace(/[\u064A\u06CC]/g, '\u06CC')            // Arabic/Persian y -> ی
      .replace(/\u0643/g, '\u06A9')                    // ك -> ک
      .replace(/[\u0623\u0625\u0622\u0671]/g, '\u0627') // أ إ آ ٱ -> ا
      .replace(/\u0629/g, '\u0647')                    // ة -> ه
      .replace(/[\u200c\u200d\u200e\u200f]/g, ' ')     // ZWNJ, ZWJ, direction marks
      .replace(/\s+/g, ' ')
      .trim();
  }

  function score(entry, needle) {
    var title = normalize(entry.title);
    var desc = normalize(entry.desc);
    var kind = normalize(entry.kind);
    if (!title && !desc && !kind) return 0;
    if (title === needle) return 60;
    if (title.indexOf(needle) === 0) return 50;
    if (title.indexOf(needle) !== -1) return 40;
    if (kind.indexOf(needle) !== -1) return 25;
    if (desc.indexOf(needle) !== -1) return 15;
    var words = needle.split(' ');
    var hit = 0;
    for (var i = 0; i < words.length; i += 1) {
      if (words[i] && (title.indexOf(words[i]) !== -1 || desc.indexOf(words[i]) !== -1)) hit += 1;
    }
    return hit && hit === words.length ? 10 : 0;
  }

  function find(needle) {
    var index = window.SEARCH_INDEX;
    if (!Array.isArray(index) || needle.length < 2) return [];
    var scored = [];
    for (var i = 0; i < index.length; i += 1) {
      var entry = index[i];
      if (!entry || !entry.title || !entry.url) continue;
      if (entry.url.startsWith('en/') !== (document.documentElement.lang === 'en')) continue;
      var value = score(entry, needle);
      if (value > 0) scored.push({ entry: entry, value: value, order: i });
    }
    scored.sort(function (a, b) {
      return b.value !== a.value ? b.value - a.value : a.order - b.order;
    });
    return scored.slice(0, MAX_RESULTS);
  }

  function announce(text) {
    if (searchStatus) searchStatus.textContent = text || '';
  }

  function paragraph(text, className) {
    var node = document.createElement('p');
    node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function resultLink(found) {
    var entry = found.entry;
    var link = document.createElement('a');
    link.className = 'row2';
    link.href = base + entry.url;
    var title = document.createElement('b');
    title.textContent = entry.title;
    var kind = document.createElement('span');
    kind.className = 'muted';
    kind.textContent = entry.kind || '';
    link.appendChild(title);
    link.appendChild(kind);
    return link;
  }

  function drawResults(rawQuery) {
    if (!searchResults) return;
    while (searchResults.firstChild) searchResults.removeChild(searchResults.firstChild);

    var needle = normalize(rawQuery);
    var suggestions = search ? $('.srch-sug', search) : null;
    if (suggestions) suggestions.hidden = needle.length >= 2;
    if (needle.length < 2) {
      announce('');
      return;
    }

    var found = find(needle);
    var countTemplate = M.ui('overlays.searchCount');
    var countText = countTemplate ? M.fill(countTemplate, { n: document.documentElement.lang === 'en' ? found.length : M.digits.toFa(found.length) }) : '';
    announce(countText);
    if (countText) searchResults.appendChild(paragraph(countText, 'search-count'));

    if (!found.length) {
      var empty = M.ui('overlays.searchEmpty');
      if (empty) searchResults.appendChild(paragraph(empty, 'muted'));
      return;
    }
    for (var i = 0; i < found.length; i += 1) searchResults.appendChild(resultLink(found[i]));
  }

  function onSearchSubmit(event) {
    if (event.preventDefault) event.preventDefault();
    var first = searchResults ? searchResults.querySelector('a.row2') : null;
    var href = first ? first.getAttribute('href') : null;
    if (!href) return;
    try {
      window.location.assign(href);
    } catch (err) {
      if (first && first.click) first.click();
    }
  }

  function onSearchInput() {
    drawResults(searchInput ? searchInput.value : '');
  }

  function resetSearch() {
    if (searchInput) searchInput.value = '';
    announce('');
  }

  /* ---------- one delegated click handler ---------- */

  function onClick(event) {
    var node = event.target;
    if (!node || !node.closest) return;

    var placeholder = node.closest('[data-placeholder]');
    if (placeholder) {
      if (event.preventDefault) event.preventDefault();
      M.toastFor(placeholder, 'toasts.placeholder');
      return;
    }

    var said = node.closest('[data-toast]');
    if (said && said.tagName !== 'INPUT' && said.tagName !== 'SELECT') {
      if (said.getAttribute('href')) event.preventDefault();
      M.toast(M.attr(said, 'data-toast') || M.ui('toasts.placeholder'));
      return;
    }

    if (inDrawer(node.closest('#' + DRAWER_ID))) return;   // pages.js owns the drawer

    var chip = node.closest('[data-search-chip]');
    if (chip && searchInput) {
      searchInput.value = chip.textContent.trim();
      drawResults(searchInput.value);
      searchInput.focus();
      return;
    }

    var sheetBtn = node.closest('[data-open-sheet]');
    if (sheetBtn) {
      if (event.preventDefault) event.preventDefault();
      openSheet(sheetBtn);
      return;
    }

    var searchBtn = node.closest('[data-open-search]');
    if (searchBtn) {
      if (event.preventDefault) event.preventDefault();
      openSearch(searchBtn);
      return;
    }

    var closer = node.closest('[data-close]');
    if (closer) {
      var owner = closer.closest('.overlay');
      if (owner) closeDialog(owner, true);
      return;
    }

    var tab = node.closest('.stabs [role="tab"], .sheet-tabs [role="tab"]');
    var position = indexOfTab(tab);
    if (position !== -1) {
      if (event.preventDefault) event.preventDefault();
      selectTab(position, false);
      return;
    }

    var scrim = node.closest('.overlay');
    if (scrim) {
      if (node === scrim) closeDialog(scrim, true);
      return;
    }

    if (megaOpen() && !node.closest('#' + MEGA_ID)) closeMega(false);
  }

  // Left/Right arrows move between the section triggers (RTL: Left = next in the row).
  function onTriggerArrows(event) {
    var btn = event.target.closest ? event.target.closest('.nav [data-open-mega]') : null;
    if (!btn || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return false;
    var list = qa('.nav [data-open-mega]');
    var step = event.key === 'ArrowLeft' ? 1 : -1;
    if (document.documentElement.dir === 'ltr') step = -step;
    var next = list[(list.indexOf(btn) + step + list.length) % list.length];
    event.preventDefault();
    next.focus();
    return true;
  }

  // A section trigger is a real link (click goes to the section); ArrowDown opens its menu and enters it.
  function onTriggerDown(event) {
    var btn = event.target.closest ? event.target.closest('.nav [data-open-mega]') : null;
    if (!btn || event.key !== 'ArrowDown') return false;
    event.preventDefault();
    openMega(btn, true);
    var first = mega.querySelector('.mp:not([hidden]) a');
    if (first) first.focus();
    return true;
  }

  function onKeydown(event) {
    if (event.key !== 'Escape' && event.key !== 'Esc') focusDismissed = false;
    if (onTriggerArrows(event) || onTriggerDown(event)) return;
    if (event.key !== 'Escape' && event.key !== 'Esc') return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (megaOpen()) {
      if (event.preventDefault) event.preventDefault();
      closeMega(true);
      return;
    }
    var top = M.overlay.topmostId();
    if (!top || top === DRAWER_ID) return;   // the drawer closes itself (pages.js)
    if (event.preventDefault) event.preventDefault();
    M.overlay.closeTopmost();
  }

  /* ---------- hover: the pointer opens the section menu, leaving it closes after a short grace ---------- */

  function cancelClose() {
    clearTimeout(closeTimer);
  }

  function scheduleClose() {
    cancelClose();
    closeTimer = setTimeout(function () { closeMega(false); }, 250);
  }

  function onTriggerEnter(event) {
    focusDismissed = false;
    cancelClose();
    openMega(event.currentTarget, true);
  }

  /* ---------- trigger state follows the overlay ---------- */

  function onOverlayOpen(event) {
    if (event.currentTarget === sheet) setExpanded('[data-open-sheet]', true);
  }

  function onOverlayClose(event) {
    if (event.currentTarget === sheet) setExpanded('[data-open-sheet]', false);
    else if (event.currentTarget === mega) setExpanded('[data-open-mega]', false);
    else if (event.currentTarget === search) resetSearch();
  }

  /* ---------- init ---------- */

  function init() {
    mega = document.getElementById(MEGA_ID);
    sheet = document.getElementById('sheet-dialog');
    search = document.getElementById('search-dialog');
    searchForm = search ? $('[data-search-form]', search) : null;
    searchInput = search ? document.getElementById('site-search') : null;
    searchResults = search ? document.getElementById('search-results') : null;
    searchStatus = search ? document.getElementById('search-status') : null;
    tablist = sheet ? $('.stabs', sheet) : null;
    tabs = tablist ? qa('[role="tab"]', tablist) : [];
    base = pageBase();

    document.addEventListener('click', onClick, false);
    document.addEventListener('keydown', onKeydown, false);

    [mega, sheet, search].forEach(function (el) {
      if (!el) return;
      el.addEventListener('mabda:open', onOverlayOpen, false);
      el.addEventListener('mabda:close', onOverlayClose, false);
    });

    qa('.nav [data-open-mega]').forEach(function (btn) {
      btn.addEventListener('mouseenter', onTriggerEnter, false);
      btn.addEventListener('mouseleave', scheduleClose, false);
      btn.addEventListener('focus', function (event) { if (!focusDismissed) onTriggerEnter(event); }, false);
    });
    if (mega) {
      mega.addEventListener('mouseenter', cancelClose, false);
      mega.addEventListener('mouseleave', scheduleClose, false);
    }

    // Swipe down on a bottom sheet (from its top, not mid-scroll) closes it, like tapping outside.
    function swipeToClose(dialog, scroller) {
      var panel = dialog ? $('.panel', dialog) : null;
      var from = null;
      if (!panel) return;
      panel.addEventListener('touchstart', function (e) {
        from = (!scroller || scroller.scrollTop <= 0) ? e.touches[0].clientY : null;
      }, { passive: true });
      panel.addEventListener('touchend', function (e) {
        if (from === null) return;
        var dy = e.changedTouches[0].clientY - from;
        from = null;
        if (dy > 72) closeDialog(dialog, true);
      }, { passive: true });
    }
    swipeToClose(sheet, sheet ? $('.sheet-body', sheet) : null);
    if (window.matchMedia("(min-width: 768px)").matches) swipeToClose(search, searchResults);

    // The soft keyboard covers the bottom of the screen: keep the search panel inside the visible part.
    if (search && window.visualViewport) {
      var fit = function () {
        if (!M.overlay.isOpen(search)) return;
        search.style.setProperty('--vvh', window.visualViewport.height + 'px');
        search.style.setProperty('--vvt', window.visualViewport.offsetTop + 'px');
      };
      window.visualViewport.addEventListener('resize', fit);
      window.visualViewport.addEventListener('scroll', fit);
    }

    if (tablist) tablist.addEventListener('keydown', onTablistKeys, false);
    if (tabs.length) selectTab(initialTab(), false);
    if (searchForm) searchForm.addEventListener('submit', onSearchSubmit, false);
    if (searchInput) searchInput.addEventListener('input', onSearchInput, false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
