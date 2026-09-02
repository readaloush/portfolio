/**
 * WHAT A SEARCH ENGINE SEES
 * =================================================================
 * Every word on this site arrives from /api/content after the page
 * has loaded. That is a fine way to build a site and a poor way to be
 * found: the HTML that leaves the server contains the navigation, the
 * headings, and nothing else. Measured on the live site — 94 words, of
 * which not one was a project, a skill, or a sentence about him.
 *
 * Google does run JavaScript, but it does it on a second pass, days
 * later, and it is the first pass that decides whether a brand new
 * domain is worth coming back to. So the words go into the HTML.
 *
 * This is not a second copy of the front end. It fills the same empty
 * containers app.js fills, from the same database, and app.js then
 * replaces them with the animated version on load. A visitor and a
 * crawler read the same sentences — which matters, because showing a
 * crawler something a visitor cannot see is cloaking, and Google
 * removes sites for it.
 *
 * No template engine, no npm: string replacement into known ids.
 */

const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Put `inner` inside the (empty) element carrying this id.
 *
 * The containers really are empty in index.html — `<div id="x"></div>` —
 * so this only has to find the opening tag and the closing tag that
 * immediately follows it. Anything more clever would be a parser, and a
 * parser is a dependency.
 */
function fill(html, id, inner) {
  if (!inner) return html;
  const re = new RegExp(`(<([a-z0-9]+)[^>]*\\sid="${id}"[^>]*>)\\s*(</\\2>)`, 'i');
  return re.test(html) ? html.replace(re, `$1${inner}$3`) : html;
}

/** Replace the text of an element that already has placeholder text. */
function setText(html, id, text) {
  if (!text) return html;
  const re = new RegExp(`(<([a-z0-9]+)[^>]*\\sid="${id}"[^>]*>)[^<]*(</\\2>)`, 'i');
  return re.test(html) ? html.replace(re, `$1${esc(text)}$3`) : html;
}

const li = (items) => items.map((t) => `<li>${esc(t)}</li>`).join('');

/* ------------------------------------------------------- the sections */

function aboutHTML(c) {
  const summary = (c.profile && c.profile.summary) || '';
  return summary.split(/\n{2,}/).map((p) => `<p>${esc(p)}</p>`).join('');
}

function skillsHTML(c) {
  return (c.skills || []).map((g) => `<div class="skill-card"><h3>${esc(g.category)}</h3><ul>${
    li((g.items || []).map((i) => `${i.name} — ${i.level}%`))
  }</ul></div>`).join('');
}

function experienceHTML(c) {
  return (c.experience || []).map((x) => `<article class="tl-item">
    <h3>${esc(x.role)}</h3>
    <p>${esc(x.company)} · ${esc(x.period)}</p>
    ${x.tools ? `<p>${esc(x.tools)}</p>` : ''}
    <ul>${li(x.bullets || [])}</ul>
  </article>`).join('');
}

function projectsHTML(c) {
  return (c.projects || []).map((p) => `<article class="project">
    <h3>${esc(p.title)}</h3>
    <p>${esc(p.period)}</p>
    <ul>${li(p.bullets || [])}</ul>
    <ul>${li(p.tags || [])}</ul>
    ${p.repo ? `<a href="${esc(p.repo)}" rel="noopener">Code</a>` : ''}
  </article>`).join('');
}

function educationHTML(c) {
  return (c.education || []).map((e) => `<div class="edu-card">
    <h3>${esc(e.degree)}</h3>
    <p>${esc(e.school)} · ${esc(e.period)}</p>
    ${e.note ? `<p>${esc(e.note)}</p>` : ''}
  </div>`).join('');
}

function newsHTML(c) {
  const live = (c.announcements || [])
    .filter((a) => a && a.published !== false && (a.title || a.body))
    .sort((a, b) => (!!b.pinned !== !!a.pinned)
      ? (b.pinned ? 1 : -1)
      : String(b.date || '').localeCompare(String(a.date || '')));
  return live.map((a) => `<article class="news-card">
    <p>${esc(a.date || '')}${a.tag ? ' · ' + esc(a.tag) : ''}</p>
    <h3>${esc(a.title)}</h3>
    <p>${esc(a.body)}</p>
  </article>`).join('');
}

/* ------------------------------------------------------ structured data

   Tells Google that this page is about a *person*, and which one. Without
   it the engine has to infer from prose that "Read Aloush" is a name and
   not a phrase — and "read" is one of the most common words in English,
   so that inference is genuinely hard. `sameAs` is the important field:
   it links this page to the GitHub and LinkedIn profiles carrying the
   same name, which is how a search engine gains confidence that the three
   are one person.
*/
function jsonLd(c, origin) {
  const p = c.profile || {};
  const sameAs = (c.socials || [])
    .map((s) => s && s.url)
    .filter((u) => u && /^https?:/i.test(u));

  const knows = [];
  (c.skills || []).forEach((g) => (g.items || []).forEach((i) => i.name && knows.push(i.name)));

  const data = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: p.name || '',
    alternateName: p.shortName || undefined,
    url: origin + '/',
    image: p.photo ? origin + p.photo : undefined,
    jobTitle: p.title || undefined,
    description: p.summary || undefined,
    email: p.email ? 'mailto:' + p.email : undefined,
    address: p.location ? { '@type': 'PostalAddress', addressLocality: p.location } : undefined,
    knowsAbout: knows.length ? knows : undefined,
    sameAs: sameAs.length ? sameAs : undefined,
    alumniOf: (c.education || []).map((e) => e.school).filter(Boolean).length
      ? [...new Set((c.education || []).map((e) => e.school).filter(Boolean))]
        .map((n) => ({ '@type': 'EducationalOrganization', name: n }))
      : undefined
  };

  // JSON.stringify drops the undefined keys for us.
  return `<script type="application/ld+json">${
    JSON.stringify(data).replace(/</g, '\\u003c')
  }</script>`;
}

/* ------------------------------------------------------------- the page */

/**
 * Take index.html as it sits on disk and hand back the version a crawler
 * should receive: same markup, but with the database's words in it.
 */
function render(html, content, origin) {
  const c = content || {};
  const p = c.profile || {};
  const s = c.sections || {};
  const m = c.meta || {};

  // headings and hero
  html = setText(html, 'heroName', p.name);
  html = setText(html, 'heroTagline', p.tagline);
  html = setText(html, 'heroSummary', p.summary);
  html = setText(html, 'heroAvailability', p.availability);
  html = setText(html, 'photoCaption', p.location);
  html = setText(html, 'footerNote', m.footerNote);

  // section titles, so the words in them are his and not the placeholders
  const titles = {
    newsTitle: s.newsTitle, newsKicker: s.newsKicker,
    aboutTitle: s.aboutTitle, aboutKicker: s.aboutKicker,
    skillsTitle: s.skillsTitle, skillsKicker: s.skillsKicker,
    experienceTitle: s.experienceTitle, experienceKicker: s.experienceKicker,
    projectsTitle: s.projectsTitle, projectsKicker: s.projectsKicker,
    educationTitle: s.educationTitle, educationKicker: s.educationKicker,
    contactTitle: s.contactTitle, contactKicker: s.contactKicker
  };
  for (const [id, text] of Object.entries(titles)) html = setText(html, id, text);

  // the substance
  html = fill(html, 'aboutCopy', aboutHTML(c));
  html = fill(html, 'skillGrid', skillsHTML(c));
  html = fill(html, 'projectGrid', projectsHTML(c));
  html = fill(html, 'eduGrid', educationHTML(c));
  html = fill(html, 'newsGrid', newsHTML(c));
  html = fill(html, 'langList', li((c.languages || []).map((l) => `${l.name} — ${l.level}`)));

  // the timeline keeps its rail, so it is filled by appending rather than
  // replacing an empty element
  const tl = experienceHTML(c);
  if (tl) html = html.replace(/(<div class="timeline" id="timeline">)/i, `$1${tl}`);

  // title and description from the database, not the file
  if (m.siteTitle) html = html.replace(/<title>[^<]*<\/title>/i, `<title>${esc(m.siteTitle)}</title>`);
  if (m.metaDescription) {
    html = html.replace(/(<meta name="description" id="metaDescription" content=")[^"]*(")/i,
      `$1${esc(m.metaDescription)}$2`);
  }

  // canonical + structured data, injected just before </head>
  const canonical = `<link rel="canonical" href="${esc(origin)}/">`;
  html = html.replace(/<\/head>/i, `${canonical}\n${jsonLd(c, origin)}\n</head>`);

  return html;
}

module.exports = { render, jsonLd, esc };
