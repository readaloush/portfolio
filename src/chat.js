/**
 * The assistant that answers questions about Read.
 *
 * It has no model behind it and no API key. Every answer is built from
 * the CV content stored in SQLite, which means:
 *   - it cannot invent a job, a date or a number that is not in the CV
 *   - it costs nothing and answers instantly
 *   - editing the admin panel updates its answers too
 *
 * It understands Turkish and English.
 */

/* ------------------------------------------------------------ helpers */

// Turkish letters folded to ASCII so "yetenekleri" and "yetenekleri" both match
const fold = (s) =>
  String(s || '')
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i').replace(/İ/g, 'i')
    .replace(/ş/g, 's').replace(/ğ/g, 'g')
    .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/â/g, 'a').replace(/î/g, 'i').replace(/û/g, 'u')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const listOf = (arr, fn) => arr.map(fn).join('\n');

/**
 * Does a trigger fire for this question?
 *
 * Substring matching is wrong across two languages: the Turkish trigger
 * "iş" (work) would fire on the English word "is". So short triggers
 * must match a whole word, while longer ones may match a prefix —
 * Turkish glues suffixes on, so "proje" has to catch "projelerini".
 */
function triggerHit(qWords, q, raw) {
  const w = fold(raw);
  if (!w) return false;
  if (w.includes(' ')) return q.includes(w);
  if (w.length <= 3) return qWords.includes(w);
  return qWords.some((x) => x.startsWith(w));
}

/* ------------------------------------------------------------- intents
   Each intent has trigger words in both languages and a builder that
   renders an answer from the live content object.
--------------------------------------------------------------------- */

const INTENTS = [
  {
    id: 'greeting',
    words: ['merhaba', 'selam', 'hello', 'hi', 'hey', 'gunaydin', 'iyi aksamlar', 'naber', 'salam', 'marhaba'],
    exactish: true,
    build: (c) => ({
      text: `Hello. I am the assistant on ${c.profile.shortName || c.profile.name}'s site. I can tell you about his projects, experience, skills, education or how to reach him.`,
      chips: ['What does he do?', 'Show me his projects', 'What are his skills?', 'How can I contact him?']
    })
  },

  {
    id: 'who',
    // "hakkında" alone is too weak — "İHA projesi hakkında" is about the project
    words: ['kim', 'kimdir', 'kendini tanit', 'onun hakkinda', 'hakkinda bilgi', 'who is', 'who are you', 'about him', 'about read', 'ne is yapiyor', 'ne yapiyor', 'what does he do', 'tell me about'],
    // "who is the president" is not a question about him
    guard: (q) => /(^|\s)(read|alallos|o|bu|he|him|his|kendi|you|sen)(\s|$)/.test(q) || q.split(' ').length <= 3,
    build: (c) => ({
      text: `${c.profile.name} — ${c.profile.title}.\n\n${c.profile.summary}`,
      chips: ['His projects', 'His experience', 'His education']
    })
  },

  {
    id: 'projects',
    words: ['proje', 'projeler', 'project', 'projects', 'ne yapti', 'portfolio', 'calisma', 'works', 'built', 'drone', 'iha', 'tumor', 'mri', 'beyin', 'brain', 'atik', 'waste', 'geri donusum', 'recycl'],
    build: (c, q) => {
      const one = c.projects.find((p) => {
        const t = fold(p.title + ' ' + (p.tags || []).join(' '));
        return t.split(' ').filter((w) => w.length > 3).some((w) => q.includes(w));
      });
      if (one) {
        return {
          text: `**${one.title}** (${one.period})\n\n${one.bullets.map((b) => '• ' + b).join('\n')}\n\n${
            one.tags && one.tags.length ? 'Tech: ' + one.tags.join(', ') : ''
          }`,
          chips: ['Other projects', 'What are his skills?', 'Book a meeting']
        };
      }
      return {
        text: `He has ${c.projects.length} projects on this site:\n\n${listOf(
          c.projects,
          (p, i) => `${i + 1}. **${p.title}** — ${p.period}\n   ${p.bullets[0]}`
        )}\n\nAsk me about any of them by name.`,
        chips: c.projects.map((p) => p.title.split(' ').slice(0, 3).join(' '))
      };
    }
  },

  {
    id: 'experience',
    // no bare "iş" here: it collides with the English word "is"
    words: ['deneyim', 'tecrube', 'calis', 'staj', 'experience', 'work', 'worked', 'intern', 'internship', 'job', 'career', 'is deneyimi', 'nerede calisti', 'sirket', 'company'],
    build: (c) => ({
      text: `His experience so far:\n\n${listOf(
        c.experience,
        (e) => `**${e.role}** — ${e.company}\n${e.period}${e.tools ? ' · ' + e.tools : ''}\n${e.bullets.map((b) => '• ' + b).join('\n')}`
      )}`,
      chips: ['His projects', 'His education', 'Is he available?']
    })
  },

  {
    id: 'skills',
    words: ['yetenek', 'beceri', 'skill', 'skills', 'teknoloji', 'tech', 'stack', 'biliyor', 'bilir', 'kullaniyor', 'kullanir', 'know', 'knows', 'uses', 'familiar', 'python', 'ros', 'ros2', 'pytorch', 'tensorflow', 'opencv', 'plc', 'programlama', 'programming', 'dil', 'language', 'c++', 'matlab', 'raspberry', 'stm32'],
    build: (c, q) => {
      const hit = [];
      c.skills.forEach((g) =>
        (g.items || []).forEach((it) => {
          const n = fold(it.name);
          if (n && q.includes(n.split(' ')[0]) && n.split(' ')[0].length > 1) hit.push({ ...it, group: g.category });
        })
      );
      if (hit.length) {
        return {
          text: hit.map((h) => `**${h.name}** — ${h.level}/100 · ${h.group}`).join('\n'),
          chips: ['All his skills', 'His projects']
        };
      }
      return {
        text: `${listOf(
          c.skills,
          (g) => `**${g.category}**\n${g.items.map((i) => `• ${i.name} (${i.level}/100)`).join('\n')}`
        )}\n\nLanguages: ${c.languages.map((l) => `${l.name} — ${l.level}`).join(', ')}`,
        chips: ['His projects', 'His experience']
      };
    }
  },

  {
    id: 'education',
    words: ['egitim', 'okul', 'universite', 'bolum', 'mezun', 'yuksek lisans', 'lisans', 'education', 'study', 'studied', 'degree', 'university', 'school', 'master', 'bachelor', 'selcuk'],
    build: (c) => ({
      text: listOf(c.education, (e) => `**${e.degree}**\n${e.school} · ${e.period}${e.note ? '\n' + e.note : ''}`),
      chips: ['His experience', 'His skills']
    })
  },

  {
    id: 'contact',
    words: ['iletisim', 'ulas', 'mail', 'email', 'eposta', 'telefon', 'numara', 'contact', 'reach', 'phone', 'call', 'linkedin', 'github', 'instagram', 'sosyal', 'social', 'hire', 'ise al'],
    build: (c) => {
      const lines = [];
      if (c.profile.email) lines.push(`Email — ${c.profile.email}`);
      if (c.profile.phone) lines.push(`Phone — ${c.profile.phone}`);
      if (c.profile.location) lines.push(`Based in ${c.profile.location}`);
      const links = (c.socials || []).filter((s) => s.url && !/^https?:\/\/[a-z.]+\/?$/i.test(s.url) && !s.url.startsWith('mailto:'));
      if (links.length) lines.push('\n' + links.map((s) => `${s.label} — ${s.url}`).join('\n'));
      return {
        text: lines.join('\n'),
        chips: c.profile.calendarUrl ? ['Book a meeting'] : ['His projects'],
        action: c.profile.email ? { label: 'Send an email', url: 'mailto:' + c.profile.email } : null
      };
    }
  },

  {
    id: 'meeting',
    // "available" belongs to the availability intent, not this one
    words: ['randevu', 'gorusme', 'toplanti', 'takvim', 'meeting', 'book', 'schedule', 'appointment', 'ne zaman'],
    build: (c) => ({
      text: c.profile.calendarUrl
        ? `He keeps a live booking calendar — pick any free slot and it lands straight in his calendar with a video link.\n\n${c.profile.calendarNote || ''}`
        : `The best way is email: ${c.profile.email}`,
      chips: ['How can I contact him?', 'What does he do?'],
      action: c.profile.calendarUrl
        ? { label: 'See his availability', url: c.profile.calendarUrl }
        : c.profile.email
          ? { label: 'Send an email', url: 'mailto:' + c.profile.email }
          : null
    })
  },

  {
    id: 'cv',
    words: ['cv', 'ozgecmis', 'resume', 'pdf', 'indir', 'download'],
    build: (c) => ({
      text: 'His full CV is one click away.',
      chips: ['His experience', 'His projects'],
      action: { label: 'Open the CV', url: c.profile.cvUrl || '/assets/files/cv.pdf' }
    })
  },

  {
    id: 'availability',
    words: ['musait mi', 'is ariyor', 'available', 'looking for', 'open to', 'hiring', 'freelance', 'part time', 'full time'],
    build: (c) => ({
      text: `${c.profile.availability || 'He is open to opportunities.'}\n\nHe is based in ${c.profile.location}. The quickest way to talk is to book a slot on his calendar.`,
      chips: ['Book a meeting', 'How can I contact him?']
    })
  },

  {
    id: 'location',
    words: ['nerede', 'nereli', 'sehir', 'konum', 'where', 'located', 'city', 'based', 'konya', 'turkiye', 'turkey'],
    build: (c) => ({
      text: `He is based in ${c.profile.location}. Languages: ${c.languages.map((l) => `${l.name} (${l.level})`).join(', ')}.`,
      chips: ['Book a meeting', 'His experience']
    })
  },

  {
    id: 'stats',
    words: ['dogruluk', 'accuracy', 'basari', 'yuzde', 'oran', 'rakam', 'number', 'result', 'tubitak', 'odul', 'award', 'grant'],
    build: (c) => ({
      text: `Some numbers from his work:\n\n${listOf(
        c.stats,
        (s) => `• **${s.value}${s.suffix}** — ${s.label}${s.detail ? ` (${s.detail})` : ''}`
      )}`,
      chips: ['His projects', 'His experience']
    })
  },

  {
    id: 'site',
    words: ['bu site', 'siteyi kim', 'nasil yapildi', 'this site', 'website', 'built this', 'made this', 'imza', 'signature', 'ses', 'sound', 'chatbot', 'bot musun', 'are you ai', 'yapay zeka misin'],
    build: () => ({
      text: 'He built this site himself. The signature you saw drawing itself is his own, the background reacts to your cursor, and I answer from a database of his CV rather than a language model — so I am fast, free to run, and I cannot make things up.',
      chips: ['What does he do?', 'Show me his projects']
    })
  },

  {
    id: 'thanks',
    words: ['tesekkur', 'sagol', 'thanks', 'thank you', 'tamam', 'ok', 'gorusuruz', 'bye', 'hosca kal'],
    exactish: true,
    build: () => ({
      text: 'Anytime. If you want to talk to him directly, the booking calendar is the fastest route.',
      chips: ['Book a meeting', 'How can I contact him?']
    })
  }
];

/* ------------------------------------------------------------- scoring */

// words too generic to identify anything
const STOP = new Set([
  'system', 'analysis', 'powered', 'automated', 'based', 'using', 'with', 'from', 'this', 'that',
  'what', 'when', 'where', 'which', 'about', 'tell', 'show', 'does', 'his', 'him', 'the', 'and'
]);

/** Naming an actual project or skill is much stronger evidence than a generic phrase. */
function contentBoost(q, content) {
  const boost = {};
  const bump = (id, n) => (boost[id] = (boost[id] || 0) + n);
  const qWords = q.split(' ').filter(Boolean);
  // whole words only — otherwise "eğitimi" contains "git" and looks like a skill
  const said = (term) => qWords.some((x) => x === term || x.startsWith(term + 'i') || x.startsWith(term + 'l'));

  content.projects.forEach((p) => {
    const inTitle = fold(p.title).split(' ').filter((w) => w.length >= 4 && !STOP.has(w));
    const inTags = fold((p.tags || []).join(' ')).split(' ').filter((w) => w.length >= 3 && !STOP.has(w));
    // naming the project is strong; naming a tool it used is weak, because
    // that tool is usually a skill too ("does he know ROS2" is not a project question)
    if (inTitle.some(said)) bump('projects', 45);
    else if (inTags.some(said)) bump('projects', 18);
  });

  content.skills.forEach((g) =>
    (g.items || []).forEach((it) => {
      const w = fold(it.name).split(' ')[0];
      if (w.length >= 3 && !STOP.has(w) && said(w)) bump('skills', 40);
    })
  );

  content.experience.forEach((e) => {
    const w = fold(e.company).split(' ').filter((x) => x.length >= 4 && !STOP.has(x));
    if (w.some(said)) bump('experience', 30);
  });

  return boost;
}

function pick(question, content) {
  const q = fold(question);
  if (!q) return null;

  const boost = contentBoost(q, content);
  const qWords = q.split(' ').filter(Boolean);

  let best = null;
  for (const intent of INTENTS) {
    if (intent.guard && !intent.guard(q)) continue;
    let score = boost[intent.id] || 0;
    for (const w of intent.words) {
      if (!triggerHit(qWords, q, w)) continue;
      // longer trigger phrases are stronger evidence
      score += w.includes(' ') ? w.length * 2.5 : w.length;
      // short greeting words only count in short messages
      if (intent.exactish && q.split(' ').length > 6) score -= w.length * 0.8;
    }
    if (score > 0 && (!best || score > best.score)) best = { intent, score };
  }
  if (!best) return null;
  return best.intent.build(content, q);
}

/* --------------------------------------------------------------- reply */

function fallback(content) {
  return {
    text:
      `I only know what is on this page, so I could not match that one. I can help with:\n\n` +
      `• his projects and what he built\n• his work experience\n• his skills and tools\n• his education\n• how to contact him or book a meeting`,
    chips: ['Show me his projects', 'What are his skills?', 'His experience', 'Book a meeting']
  };
}

function answer(question, content) {
  const text = String(question || '').slice(0, 500);
  if (!text.trim()) return fallback(content);

  const hit = pick(text, content);
  if (hit) return hit;

  // last resort: search the raw CV text for the words they used
  const q = fold(text);
  const words = q.split(' ').filter((w) => w.length > 3);
  if (words.length) {
    const pool = [];
    content.projects.forEach((p) => p.bullets.forEach((b) => pool.push({ src: p.title, line: b })));
    content.experience.forEach((e) => e.bullets.forEach((b) => pool.push({ src: `${e.role}, ${e.company}`, line: b })));

    // whole words only, or "training" would answer a question about rain
    const mentions = (line, w) => fold(line).split(' ').some((x) => x === w || x.startsWith(w) || w.startsWith(x));

    const scored = pool
      .map((item) => ({ ...item, n: words.filter((w) => mentions(item.line, w)).length }))
      .filter((i) => i.n > 0)
      .sort((a, b) => b.n - a.n)
      .slice(0, 3);

    if (scored.length) {
      return {
        text: `Here is what I found in his CV:\n\n${scored.map((s) => `• ${s.line}\n  _${s.src}_`).join('\n\n')}`,
        chips: ['Show me his projects', 'His experience', 'Book a meeting']
      };
    }
  }
  return fallback(content);
}

function greeting(content) {
  const name = content.profile.shortName || content.profile.name;
  return {
    text: `Hi. Ask me anything about ${name} — his projects, experience, skills, or how to reach him.`,
    chips: ['What does he do?', 'Show me his projects', 'What are his skills?', 'Book a meeting']
  };
}

module.exports = { answer, greeting };
