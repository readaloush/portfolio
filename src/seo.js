
const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function fill(html, id, inner) {
  if (!inner) return html;
  const re = new RegExp(`(<([a-z0-9]+)[^>]*\\sid="${id}"[^>]*>)\\s*(</\\2>)`, 'i');
  return re.test(html) ? html.replace(re, `$1${inner}$3`) : html;
}

function setText(html, id, text) {
  if (!text) return html;
  const re = new RegExp(`(<([a-z0-9]+)[^>]*\\sid="${id}"[^>]*>)[^<]*(</\\2>)`, 'i');
  return re.test(html) ? html.replace(re, `$1${esc(text)}$3`) : html;
}

const li = (items) => items.map((t) => `<li>${esc(t)}</li>`).join('');

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

function certificatesHTML(c) {
  const list = (c.certificates || []).filter((x) => x && (x.title || x.image || x.pdf || x.url))
    .map((x, i) => ({ ...x, title: x.title || `Certificate ${i + 1}` }));
  if (!list.length) return '';
  return `<ul>${list.map((x) => `<li>${esc(x.title)}${x.issuer ? ' — ' + esc(x.issuer) : ''}${x.date ? ' · ' + esc(x.date) : ''}</li>`).join('')}</ul>`;
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

function jsonLd(c, origin) {
  const p = c.profile || {};
  const sameAs = (c.socials || [])
    .map((s) => s && s.url)
    .filter((u) => u && /^https?:/i.test(u));

  const knows = [];
  (c.skills || []).forEach((g) => (g.items || []).forEach((i) => i.name && knows.push(i.name)));

  const names = [...new Set([p.shortName, ...(((c.meta || {}).alternateNames) || [])]
    .map((x) => String(x || '').trim()).filter((x) => x && x !== p.name))];
  const now = (c.experience || []).find((e) => e && /present|now|günümüz|devam/i.test(String(e.period || '')));
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': origin + '/#person',
    name: p.name || '',
    alternateName: names.length ? names : undefined,
    worksFor: now && now.company ? { '@type': 'Organization', name: String(now.company).trim() } : undefined,
    hasOccupation: p.title ? { '@type': 'Occupation', name: p.title, occupationLocation: p.location ? { '@type': 'City', name: p.location } : undefined, skills: knows.slice(0, 20).join(', ') || undefined } : undefined,
    knowsLanguage: (c.languages || []).map((l) => l && l.name).filter(Boolean).length ? (c.languages || []).map((l) => l && l.name).filter(Boolean) : undefined,
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

  const page = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    url: origin + '/',
    name: (c.meta && c.meta.siteTitle) ? String(c.meta.siteTitle).trim() : (p.name || ''),
    inLanguage: ['en', 'tr', 'ar'],
    mainEntity: { '@id': origin + '/#person' }
  };
  return `<script type="application/ld+json">${
    JSON.stringify([page, data]).replace(/</g, '\\u003c')
  }</script>`;
}

function slugify(str) {
  return String(str || '').toLowerCase()
    .replace(/[çÇ]/g, 'c').replace(/[ğĞ]/g, 'g').replace(/[ıİ]/g, 'i').replace(/[öÖ]/g, 'o').replace(/[şŞ]/g, 's').replace(/[üÜ]/g, 'u')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item';
}
function caseFor(content, view) {
  const [kind, slug] = String(view || '').split('/');
  if (!slug) return null;
  const c = content || {};
  if (kind === 'projects') {
    const it = (c.projects || []).filter((x) => x && x.title).find((x) => slugify(x.slug || x.title) === slug);
    return it ? { title: it.title, text: it.summary || (it.bullets || [])[0] || '', image: it.image } : null;
  }
  if (kind === 'experience') {
    const it = (c.experience || []).filter((x) => x && (x.role || x.company))
      .find((x) => slugify(x.slug || `${x.company || ''} ${String(x.role || '').trim()}`) === slug);
    return it ? { title: `${String(it.role || '').trim()} — ${it.company || ''}`, text: it.summary || (it.bullets || [])[0] || '', image: it.image } : null;
  }
  if (kind === 'education') {
    const it = (c.education || []).filter((x) => x && x.degree).find((x) => slugify(x.slug || `${x.degree || ''} ${x.school || ''}`) === slug);
    return it ? { title: `${it.degree} — ${it.school || ''}`, text: it.summary || it.note || '', image: it.image } : null;
  }
  return null;
}

function render(html, content, origin, view = '') {
  const c = content || {};
  const p = c.profile || {};
  const s = c.sections || {};
  const m = c.meta || {};

  html = setText(html, 'heroName', p.name);
  html = setText(html, 'heroTagline', p.tagline);
  html = setText(html, 'heroSummary', p.summary);
  html = setText(html, 'heroAvailability', p.availability);
  html = setText(html, 'photoCaption', p.location);
  html = setText(html, 'footerNote', m.footerNote);

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

  html = fill(html, 'aboutCopy', aboutHTML(c));
  html = fill(html, 'skillGrid', skillsHTML(c));
  html = fill(html, 'projectList', projectsHTML(c));
  html = fill(html, 'journeyDetails', experienceHTML(c));
  html = fill(html, 'wheel', certificatesHTML(c));
  html = fill(html, 'eduGrid', educationHTML(c));
  html = fill(html, 'newsGrid', newsHTML(c));
  html = fill(html, 'langList', li((c.languages || []).map((l) => `${l.name} — ${l.level}`)));

  if (m.siteTitle) html = html.replace(/<title>[^<]*<\/title>/i, `<title>${esc(String(m.siteTitle).trim())}</title>`);
  if (m.metaDescription) {
    html = html.replace(/(<meta name="description" id="metaDescription" content=")[^"]*(")/i,
      `$1${esc(m.metaDescription)}$2`);
  }

  const who = p.name || '';
  const title = m.siteTitle ? String(m.siteTitle).trim() : (who && p.title ? `${who} — ${p.title}` : '');
  const meta = (attr, key, val) => {
    if (!val) return;
    const re = new RegExp(`(<meta ${attr}="${key}" content=")[^"]*(")`, 'i');
    html = html.replace(re, `$1${esc(val)}$2`);
  };
  meta('property', 'og:site_name', who);
  meta('property', 'og:title', title);
  meta('name', 'twitter:title', title);
  if (who) html = html.replace(/(<img id="profilePhoto"[^>]*alt=")[^"]*(")/i, `$1${esc(who)}$2`);
  if (p.photo) html = html.replace(/(<img id="profilePhoto" src=")[^"]*(")/i, `$1${esc(p.photo)}$2`);

  const cs = caseFor(c, view);
  if (cs) {
    const t = `${cs.title} — ${who || 'Portfolio'}`;
    html = html.replace(/<title>[^<]*<\/title>/i, `<title>${esc(t)}</title>`);
    meta('property', 'og:title', t);
    meta('name', 'twitter:title', t);
    if (cs.text) {
      const d = String(cs.text).replace(/\s+/g, ' ').slice(0, 200);
      html = html.replace(/(<meta name="description" id="metaDescription" content=")[^"]*(")/i, `$1${esc(d)}$2`);
      meta('property', 'og:description', d);
      meta('name', 'twitter:description', d);
    }
    if (cs.image && /^\//.test(cs.image) && !/\.svg$/i.test(cs.image)) meta('property', 'og:image', origin + cs.image);
  }

  const canonical = `<link rel="canonical" href="${esc(origin)}/${esc(view)}">`;
  if (view) html = html.replace(`<meta property="og:url" content="${origin}/">`, `<meta property="og:url" content="${esc(origin)}/${esc(view)}">`);
  html = html.replace(/<\/head>/i, `${canonical}\n${jsonLd(c, origin)}\n</head>`);

  return html;
}

module.exports = { render, jsonLd, esc, caseFor, slugify };
