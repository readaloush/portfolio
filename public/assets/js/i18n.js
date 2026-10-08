(function (root) {
  'use strict';

  const LANGS = {
    en: { name: 'English', short: 'EN', dir: 'ltr', locale: 'en-GB' },
    tr: { name: 'Türkçe', short: 'TR', dir: 'ltr', locale: 'tr-TR' },
    ar: { name: 'العربية', short: 'ع', dir: 'rtl', locale: 'ar-u-nu-latn' }
  };
  const ORDER = ['en', 'tr', 'ar'];
  const valid = (l) => Object.prototype.hasOwnProperty.call(LANGS, l);

  const SKIP = /^(url|image|images|photo|icon|email|phone|pdf|id|slug|href|link|file|files|logo|cvUrl|calendarUrl|video|shortName|accent|theme|translations|code|repo|live|report|demo)$/i;
  const DATEISH = /^(period|date|duration)$/i;

  const norm = (s) => String(s).replace(/\s+/g, ' ').trim();

  const MONTHS = {
    tr: { January: 'Ocak', February: 'Şubat', March: 'Mart', April: 'Nisan', May: 'Mayıs', June: 'Haziran', July: 'Temmuz', August: 'Ağustos', September: 'Eylül', October: 'Ekim', November: 'Kasım', December: 'Aralık',
      Jan: 'Oca', Feb: 'Şub', Mar: 'Mar', Apr: 'Nis', Jun: 'Haz', Jul: 'Tem', Aug: 'Ağu', Sep: 'Eyl', Sept: 'Eyl', Oct: 'Eki', Nov: 'Kas', Dec: 'Ara',
      Present: 'Günümüz', present: 'günümüz', Now: 'Şimdi', NOW: 'ŞİMDİ', now: 'şimdi', months: 'ay', month: 'ay', years: 'yıl', year: 'yıl', weeks: 'hafta', week: 'hafta', people: 'kişi', person: 'kişi' },
    ar: { January: 'يناير', February: 'فبراير', March: 'مارس', April: 'أبريل', May: 'مايو', June: 'يونيو', July: 'يوليو', August: 'أغسطس', September: 'سبتمبر', October: 'أكتوبر', November: 'نوفمبر', December: 'ديسمبر',
      Jan: 'يناير', Feb: 'فبراير', Mar: 'مارس', Apr: 'أبريل', Jun: 'يونيو', Jul: 'يوليو', Aug: 'أغسطس', Sep: 'سبتمبر', Sept: 'سبتمبر', Oct: 'أكتوبر', Nov: 'نوفمبر', Dec: 'ديسمبر',
      Present: 'الآن', present: 'الآن', Now: 'الآن', NOW: 'الآن', now: 'الآن', months: 'أشهر', month: 'شهر', years: 'سنوات', year: 'سنة', weeks: 'أسابيع', week: 'أسبوع', people: 'أشخاص', person: 'شخص' }
  };
  const DATE_WORD = /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec|Present|present|Now|NOW|now|months?|years?|weeks?|people|person)\b\.?/g;
  const LOOKS_DATE = /^[\s\d.,·–—\-/:]*(?:(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec|Present|present|Now|NOW|now|months?|years?|weeks?|people|person)\.?[\s\d.,·–—\-/:]*)+$/;

  function localDate(s, lang) {
    const m = MONTHS[lang];
    if (!m) return s;
    return String(s).replace(DATE_WORD, (w) => {
      const k = w.replace(/\.$/, '');
      return m[k] != null ? m[k] : w;
    });
  }

  function translate(s, lang, dict, over) {
    if (typeof s !== 'string' || lang === 'en' || !s) return s;
    const k = norm(s);
    if (over && over[k]) return over[k];
    if (dict && dict[k]) return dict[k];
    if (LOOKS_DATE.test(k)) return localDate(s, lang);
    return s;
  }

  function translateContent(content, lang, dict) {
    if (!content || lang === 'en' || !valid(lang)) return content;
    const over = (content.translations && content.translations[lang]) || {};
    const walk = (o, key) => {
      if (Array.isArray(o)) return o.map((v) => walk(v, key));
      if (o && typeof o === 'object') {
        const out = {};
        for (const k of Object.keys(o)) out[k] = (k === 'translations' || SKIP.test(k)) ? o[k] : walk(o[k], k);
        return out;
      }
      if (typeof o !== 'string') return o;
      if (DATEISH.test(key || '')) return over[norm(o)] || (dict && dict[norm(o)]) || localDate(o, lang);
      return translate(o, lang, dict, over);
    };
    const slugify = (s) => String(s || '').toLowerCase()
      .replace(/[çÇ]/g, 'c').replace(/[ğĞ]/g, 'g').replace(/[ıİ]/g, 'i').replace(/[öÖ]/g, 'o').replace(/[şŞ]/g, 's').replace(/[üÜ]/g, 'u')
      .normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item';
    const pinned = Object.assign({}, content);
    const pin = (list, f) => (Array.isArray(list) ? list.map((it) => (it && typeof it === 'object' && !it.slug) ? Object.assign({}, it, { slug: f(it) }) : it) : list);
    pinned.projects = pin(content.projects, (it) => slugify(it.title));
    pinned.experience = pin(content.experience, (it) => slugify(`${it.company || ''} ${String(it.role || '').trim()}`));
    pinned.education = pin(content.education, (it) => slugify(`${it.degree || ''} ${it.school || ''}`));
    return walk(pinned, '');
  }

  function translatableStrings(content) {
    const seen = new Set();
    const out = [];
    const walk = (o, key, path) => {
      if (Array.isArray(o)) return o.forEach((v, i) => walk(v, key, path + '.' + i));
      if (o && typeof o === 'object') {
        for (const k of Object.keys(o)) {
          const p = path ? path + '.' + k : k;
          if (k === 'translations' || SKIP.test(k) || DATEISH.test(k) || /^(profile\.name|socials)$/.test(p)) continue;
          walk(o[k], k, p);
        }
        return;
      }
      if (typeof o !== 'string') return;
      const s = norm(o);
      if (!/[A-Za-zÀ-ž]{2}/.test(s) || /^(https?:|\/|mailto:|tel:|#)/.test(s) || seen.has(s)) return;
      seen.add(s);
      out.push({ text: s, where: path });
    };
    walk(content, '', '');
    return out;
  }

  function pickForRequest({ query, cookie, acceptLanguage }) {
    if (valid(query)) return query;
    if (valid(cookie)) return cookie;
    for (const part of String(acceptLanguage || '').split(',')) {
      const code = part.trim().slice(0, 2).toLowerCase();
      if (valid(code)) return code;
    }
    return 'en';
  }

  const core = { LANGS, ORDER, valid, norm, translate, translateContent, translatableStrings, localDate, pickForRequest };

  if (typeof module === 'object' && module.exports) { module.exports = core; return; }

  root.I18N_CORE = core;
  if (root.I18N_CORE_ONLY) return;
  const doc = root.document;
  const html = doc.documentElement;
  const KEY = 'rp_lang';

  function decide() {
    let q = null;
    try { q = new URLSearchParams(root.location.search).get('lang'); } catch {  }
    if (valid(q)) { try { root.localStorage.setItem(KEY, q); } catch {  } return q; }
    try { const s = root.localStorage.getItem(KEY); if (valid(s)) return s; } catch {  }
    if (valid(html.dataset.lang)) return html.dataset.lang;
    for (const l of (root.navigator.languages || [root.navigator.language || ''])) {
      const code = String(l).slice(0, 2).toLowerCase();
      if (valid(code)) return code;
    }
    return 'en';
  }

  const lang = decide();
  const meta = LANGS[lang];
  html.lang = lang;
  html.dir = meta.dir;
  html.dataset.lang = lang;
  try { doc.cookie = `${KEY}=${lang}; path=/; max-age=31536000; samesite=lax`; } catch {  }

  root.I18N_DICTS = root.I18N_DICTS || {};
  if (lang !== 'en' && !root.I18N_DICTS[lang]) {
    const me = doc.currentScript && doc.currentScript.src;
    const base = me ? me.replace(/js\/i18n\.js.*$/, 'i18n/') : '/assets/i18n/';
    doc.write(`<script src="${base}${lang}.js?v=6"><\/script>`);
  }
  if (lang === 'ar') {
    doc.write('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Noto+Kufi+Arabic:wght@400..800&display=swap">');
  }

  const dict = () => root.I18N_DICTS[lang] || {};
  const rx = () => (root.I18N_DICTS[lang + ':rx'] || []);
  let override = (root.I18N_OVERRIDE && typeof root.I18N_OVERRIDE === 'object') ? root.I18N_OVERRIDE : {};

  function t(s) {
    if (lang === 'en' || typeof s !== 'string') return s;
    const k = norm(s);
    if (!k) return s;
    const hit = override[k] || dict()[k];
    if (hit) return hit;
    for (const [re, to] of rx()) if (re.test(k)) return k.replace(re, typeof to === 'function' ? to : to);
    if (LOOKS_DATE.test(k)) return localDate(s, lang);
    return s;
  }

  const ATTRS = ['aria-label', 'title', 'placeholder', 'alt', 'data-label'];
  const SKIP_EL = 'script,style,textarea,input,code,pre[data-raw],[data-noi18n],#heroName,.ph-name,.nav-logo';

  function swapText(n) {
    const v = n.nodeValue;
    if (!v || !/[A-Za-z]/.test(v)) return;
    const p = n.parentElement;
    if (!p || p.closest(SKIP_EL)) return;
    const k = norm(v);
    const tr = t(k);
    if (tr !== k) {
      const lead = v.match(/^\s*/)[0], tail = v.match(/\s*$/)[0];
      n.nodeValue = lead + tr + tail;
    }
  }
  function swapAttrs(el) {
    if (el.closest && el.closest('[data-noi18n]')) return;
    for (const a of ATTRS) {
      const v = el.getAttribute && el.getAttribute(a);
      if (v && /[A-Za-z]/.test(v)) { const tr = t(v); if (tr !== norm(v)) el.setAttribute(a, tr); }
    }
  }
  function sweep(node) {
    if (lang === 'en' || !node) return;
    if (node.nodeType === 3) { swapText(node); return; }
    if (node.nodeType !== 1) return;
    swapAttrs(node);
    const w = doc.createTreeWalker(node, 5 );
    let n;
    while ((n = w.nextNode())) {
      if (n.nodeType === 3) swapText(n);
      else swapAttrs(n);
    }
  }

  if (lang !== 'en') {
    const mo = new MutationObserver((list) => {
      for (const m of list) {
        if (m.type === 'childList') m.addedNodes.forEach(sweep);
        else if (m.type === 'attributes') swapAttrs(m.target);
        else if (m.type === 'characterData' && m.target.parentElement && m.target.parentElement.hasAttribute('data-i18n-live')) swapText(m.target);
      }
    });
    mo.observe(html, { childList: true, subtree: true, attributes: true, attributeFilter: ATTRS });
    doc.addEventListener('DOMContentLoaded', () => sweep(doc.body));
  }

  function arabicFallbacks() {
    for (const sheet of Array.from(doc.styleSheets)) {
      let rules;
      try { rules = sheet.cssRules; } catch { continue; }
      const visit = (list) => {
        for (const r of Array.from(list || [])) {
          if (r.cssRules && !r.style) { visit(r.cssRules); continue; }
          if (r.cssRules) visit(r.cssRules);
          const st = r.style;
          if (!st || r.type === 5 ) continue;
          const ff = st.getPropertyValue('font-family');
          if (!ff || /Arabic|Amiri|inherit|initial|var\(/i.test(ff)) continue;
          const pick = /Mono|Fira|Code|monospace|Antic/i.test(ff) ? "'Noto Kufi Arabic'" : "'Amiri'";
          const parts = ff.split(',').map((x) => x.trim());
          parts.splice(1, 0, pick);
          st.setProperty('font-family', parts.join(', '), st.getPropertyPriority('font-family'));
        }
      };
      visit(rules);
    }
    const rs = getComputedStyle(html);
    for (const v of ['--hand', '--text-font']) {
      const cur = rs.getPropertyValue(v).trim();
      if (cur && !/Arabic|Amiri/.test(cur)) {
        const parts = cur.split(',').map((x) => x.trim());
        parts.splice(1, 0, "'Amiri'");
        html.style.setProperty(v, parts.join(', '));
      }
    }
  }
  if (lang === 'ar') {
    doc.addEventListener('DOMContentLoaded', arabicFallbacks);
    root.addEventListener('load', arabicFallbacks);
  }

  function choose(next) {
    if (!valid(next) || next === lang) return;
    try { root.localStorage.setItem(KEY, next); } catch {  }
    try { doc.cookie = `${KEY}=${next}; path=/; max-age=31536000; samesite=lax`; } catch {  }
    const u = new URL(root.location.href);
    if (u.searchParams.has('lang')) { u.searchParams.set('lang', next); root.location.replace(u.toString()); }
    else root.location.reload();
  }

  const GLOBE = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>';

  function buildSwitcher() {
    const actions = doc.querySelector('#nav .nav-actions');
    if (actions && !doc.getElementById('langSwitch')) {
      const box = doc.createElement('div');
      box.className = 'lang-sw';
      box.id = 'langSwitch';
      box.setAttribute('data-noi18n', '');
      box.innerHTML =
        `<button type="button" class="lang-btn" aria-haspopup="true" aria-expanded="false" aria-label="${t('Language')}: ${meta.name}">${GLOBE}<span>${meta.short}</span></button>` +
        `<div class="lang-menu" role="menu" hidden>${ORDER.map((l) =>
          `<button type="button" role="menuitemradio" aria-checked="${l === lang}" lang="${l}" data-lang="${l}"><b>${LANGS[l].short}</b>${LANGS[l].name}</button>`).join('')}</div>`;
      const sw = doc.getElementById('themeSwitch');
      actions.insertBefore(box, sw || actions.firstChild);
      const btn = box.querySelector('.lang-btn'), menu = box.querySelector('.lang-menu');
      const shut = () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.hidden = !menu.hidden;
        btn.setAttribute('aria-expanded', String(!menu.hidden));
        if (!menu.hidden) menu.querySelector('[aria-checked="true"]')?.focus();
      });
      menu.addEventListener('click', (e) => { const b = e.target.closest('[data-lang]'); if (b) choose(b.dataset.lang); });
      doc.addEventListener('click', (e) => { if (!box.contains(e.target)) shut(); });
      doc.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { shut(); btn.focus(); } });
    }
    const links = doc.getElementById('navLinks');
    if (links && !doc.getElementById('langRow')) {
      const row = doc.createElement('div');
      row.className = 'lang-row';
      row.id = 'langRow';
      row.setAttribute('data-noi18n', '');
      row.setAttribute('role', 'group');
      row.setAttribute('aria-label', t('Language'));
      row.innerHTML = ORDER.map((l) =>
        `<button type="button" lang="${l}" data-lang="${l}" class="${l === lang ? 'on' : ''}" aria-pressed="${l === lang}">${LANGS[l].name}</button>`).join('');
      row.addEventListener('click', (e) => { const b = e.target.closest('[data-lang]'); if (b) choose(b.dataset.lang); });
      links.appendChild(row);
    }
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', buildSwitcher); else buildSwitcher();

  root.I18N = {
    lang, dir: meta.dir, locale: meta.locale, langs: LANGS, order: ORDER,
    t,
    content(c) {
      if (!c || lang === 'en') return c;
      override = Object.assign({}, override, (c.translations && c.translations[lang]) || {});
      return translateContent(c, lang, dict());
    },
    date(s) { return localDate(s, lang); },
    choose, sweep
  };
})(typeof window !== 'undefined' ? window : globalThis);
