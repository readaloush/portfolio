

const foldArabicWord = (w) => w
  .replace(/^(?:[وفبل]?ال|لل)(?=.{3,})/, '');

const fold = (s) =>
  String(s || '')
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i').replace(/İ/g, 'i')
    .replace(/ş/g, 's').replace(/ğ/g, 'g')
    .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/â/g, 'a').replace(/î/g, 'i').replace(/û/g, 'u')
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/[^a-z0-9ء-ي\s+]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ').map((w) => (/[ء-ي]/.test(w) ? foldArabicWord(w) : w)).join(' ');

const isArabic = (s) => /[ء-ي]/.test(s);
const listOf = (arr, fn) => (arr || []).map(fn).join('\n');

function triggerHit(qWords, q, raw) {
  const w = fold(raw);
  if (!w) return false;
  if (w.includes(' ')) return q.includes(w);
  if (isArabic(w) && w.length >= 3) return qWords.some((x) => x.includes(w));
  if (w.length <= 3) return qWords.includes(w);
  return qWords.some((x) => x.startsWith(w));
}

const SAY = {
  en: {
    hello: (n) => `Hello. I am the assistant on ${n}'s site. I can tell you about his projects, experience, skills, education or how to reach him.`,
    greet: (n) => `Hi. Ask me anything about ${n} — his projects, experience, skills, or how to reach him.`,
    noNews: 'There are no announcements posted at the moment.',
    latest: 'The latest from him:',
    more: (n) => `…and ${n} more in the announcements section.`,
    tech: 'Tech',
    projectsIntro: (n) => `He has ${n} projects on this site:`,
    askByName: 'Ask me about any of them by name.',
    expIntro: 'His experience so far:',
    languages: 'Languages',
    email: 'Email', phone: 'Phone', based: (l) => `Based in ${l}`,
    sendEmail: 'Send an email',
    calendar: 'He keeps a live booking calendar — pick any free slot and it lands straight in his calendar with a video link.',
    bestEmail: (e) => `The best way is email: ${e}`,
    seeAvailability: 'See his availability',
    cvLine: 'His full CV is one click away.',
    openCv: 'Open the CV',
    openTo: 'He is open to opportunities.',
    availability: (a, l) => `${a}\n\nHe is based in ${l}. The quickest way to talk is to book a slot on his calendar.`,
    location: (l, langs) => `He is based in ${l}. Languages: ${langs}.`,
    numbers: 'Some numbers from his work:',
    site: 'He built this site himself, from scratch — no framework, no template. The signature that draws itself is his own, the site speaks English, Turkish and Arabic, and I answer from a database of his CV rather than a language model, so I am fast, free to run, and I cannot make things up.',
    thanks: 'Anytime. If you want to talk to him directly, the booking calendar is the fastest route.',
    found: 'Here is what I found in his CV:',
    fallback: 'I only know what is on this page, so I could not match that one. I can help with:\n\n• his projects and what he built\n• his work experience\n• his skills and tools\n• his education\n• how to contact him or book a meeting',
    chips: {
      whatDoes: 'What does he do?', projects: 'Show me his projects', skills: 'What are his skills?', contact: 'How can I contact him?',
      hisProjects: 'His projects', hisExperience: 'His experience', hisEducation: 'His education', hisSkills: 'His skills',
      book: 'Book a meeting', otherProjects: 'Other projects', allSkills: 'All his skills', available: 'Is he available?'
    }
  },
  tr: {
    hello: (n) => `Merhaba. Ben ${n}'in sitesindeki asistanım. Projeleri, deneyimi, yetenekleri, eğitimi ya da ona nasıl ulaşacağın hakkında bilgi verebilirim.`,
    greet: (n) => `Merhaba. ${n} hakkında her şeyi sorabilirsin — projeleri, deneyimi, yetenekleri ya da ona nasıl ulaşacağın.`,
    noNews: 'Şu anda yayınlanmış bir duyuru yok.',
    latest: 'Ondan son haberler:',
    more: (n) => `…ve duyurular bölümünde ${n} tane daha.`,
    tech: 'Teknolojiler',
    projectsIntro: (n) => `Bu sitede ${n} projesi var:`,
    askByName: 'Herhangi birini adıyla sorabilirsin.',
    expIntro: 'Şimdiye kadarki deneyimi:',
    languages: 'Diller',
    email: 'E-posta', phone: 'Telefon', based: (l) => `Konum: ${l}`,
    sendEmail: 'E-posta gönder',
    calendar: 'Canlı bir randevu takvimi var — boş bir saat seçmen yeterli, görüntülü görüşme bağlantısıyla doğrudan takvimine düşer.',
    bestEmail: (e) => `En iyi yol e-posta: ${e}`,
    seeAvailability: 'Müsaitliğini gör',
    cvLine: 'Tam CV\'si bir tık uzağında.',
    openCv: 'CV\'yi aç',
    openTo: 'Yeni fırsatlara açık.',
    availability: (a, l) => `${a}\n\n${l} merkezli. Konuşmanın en hızlı yolu takviminden bir saat ayırmak.`,
    location: (l, langs) => `${l} merkezli. Diller: ${langs}.`,
    numbers: 'Çalışmalarından birkaç rakam:',
    site: 'Bu siteyi kendisi, sıfırdan yaptı — framework yok, hazır şablon yok. Kendi kendini çizen imza onun imzası; site İngilizce, Türkçe ve Arapça konuşuyor. Ben de bir dil modeli değil, CV\'sinin veritabanından cevap veriyorum: hızlıyım, ücretsizim ve bir şey uyduramam.',
    thanks: 'Ne zaman istersen. Onunla doğrudan konuşmak istersen en hızlı yol randevu takvimi.',
    found: 'CV\'sinde bulduklarım:',
    fallback: 'Sadece bu sayfadakileri biliyorum, o yüzden bunu eşleştiremedim. Şunlarda yardımcı olabilirim:\n\n• projeleri ve neler geliştirdiği\n• iş deneyimi\n• yetenekleri ve araçları\n• eğitimi\n• ona nasıl ulaşılır ya da görüşme nasıl ayarlanır',
    chips: {
      whatDoes: 'Ne iş yapıyor?', projects: 'Projelerini göster', skills: 'Yetenekleri neler?', contact: 'Nasıl iletişime geçerim?',
      hisProjects: 'Projeleri', hisExperience: 'Deneyimi', hisEducation: 'Eğitimi', hisSkills: 'Yetenekleri',
      book: 'Görüşme ayarla', otherProjects: 'Diğer projeler', allSkills: 'Tüm yetenekleri', available: 'Müsait mi?'
    }
  },
  ar: {
    hello: (n) => `مرحبًا. أنا المساعد في موقع ${n}. يمكنني إخبارك عن مشاريعه وخبراته ومهاراته وتعليمه أو كيفية التواصل معه.`,
    greet: (n) => `مرحبًا. اسألني أي شيء عن ${n} — مشاريعه أو خبراته أو مهاراته أو كيفية التواصل معه.`,
    noNews: 'لا توجد إعلانات منشورة حاليًا.',
    latest: 'آخر أخباره:',
    more: (n) => `…و${n} أخرى في قسم الإعلانات.`,
    tech: 'التقنيات',
    projectsIntro: (n) => `لديه ${n} مشاريع على هذا الموقع:`,
    askByName: 'اسألني عن أيٍّ منها باسمه.',
    expIntro: 'خبراته حتى الآن:',
    languages: 'اللغات',
    email: 'البريد الإلكتروني', phone: 'الهاتف', based: (l) => `مقيم في ${l}`,
    sendEmail: 'أرسل بريدًا إلكترونيًا',
    calendar: 'لديه تقويم حجز مباشر — اختر أي موعد متاح ليُضاف مباشرة إلى تقويمه مع رابط مكالمة فيديو.',
    bestEmail: (e) => `أفضل طريقة هي البريد الإلكتروني: ${e}`,
    seeAvailability: 'اطّلع على أوقات فراغه',
    cvLine: 'سيرته الذاتية الكاملة على بُعد نقرة.',
    openCv: 'افتح السيرة الذاتية',
    openTo: 'منفتح على الفرص الجديدة.',
    availability: (a, l) => `${a}\n\nمقيم في ${l}. أسرع طريقة للتحدث معه هي حجز موعد في تقويمه.`,
    location: (l, langs) => `مقيم في ${l}. اللغات: ${langs}.`,
    numbers: 'بعض الأرقام من أعماله:',
    site: 'بنى هذا الموقع بنفسه من الصفر — بلا إطار عمل ولا قالب جاهز. التوقيع الذي يرسم نفسه هو توقيعه، والموقع يتحدث الإنجليزية والتركية والعربية. وأنا أجيب من قاعدة بيانات سيرته الذاتية لا من نموذج لغوي، لذلك أنا سريع ومجاني ولا أستطيع اختلاق المعلومات.',
    thanks: 'في أي وقت. إن أردت التحدث معه مباشرة فتقويم الحجز هو الطريق الأسرع.',
    found: 'هذا ما وجدته في سيرته الذاتية:',
    fallback: 'أعرف فقط ما هو موجود في هذه الصفحة، لذلك لم أجد ما يطابق سؤالك. يمكنني المساعدة في:\n\n• مشاريعه وما بناه\n• خبرته العملية\n• مهاراته وأدواته\n• تعليمه\n• كيفية التواصل معه أو حجز موعد',
    chips: {
      whatDoes: 'ماذا يعمل؟', projects: 'أرني مشاريعه', skills: 'ما مهاراته؟', contact: 'كيف أتواصل معه؟',
      hisProjects: 'مشاريعه', hisExperience: 'خبراته', hisEducation: 'تعليمه', hisSkills: 'مهاراته',
      book: 'احجز موعدًا', otherProjects: 'مشاريع أخرى', allSkills: 'كل مهاراته', available: 'هل هو متاح؟'
    }
  }
};
const say = (lang) => SAY[lang] || SAY.en;

const INTENTS = [
  {
    id: 'greeting',
    words: ['merhaba', 'selam', 'hello', 'hi', 'hey', 'gunaydin', 'iyi aksamlar', 'naber', 'salam', 'marhaba',
            'مرحبا', 'اهلا', 'السلام', 'سلام', 'صباح الخير', 'مساء الخير'],
    exactish: true,
    build: (c, q, S) => ({
      text: S.hello(c.profile.shortName || c.profile.name),
      chips: [S.chips.whatDoes, S.chips.projects, S.chips.skills, S.chips.contact]
    })
  },

  {
    id: 'who',
    words: ['kim', 'kimdir', 'kendini tanit', 'onun hakkinda', 'hakkinda bilgi', 'who is', 'who are you', 'about him', 'about read', 'ne is yapiyor', 'ne yapiyor', 'what does he do', 'tell me about',
            'من هو', 'ماذا يعمل', 'عنه', 'نبذه', 'عرفني'],
    guard: (q) => /(^|\s)(read|alallos|o|bu|he|him|his|kendi|you|sen|هو|عنه)(\s|$)/.test(q) || q.split(' ').length <= 3,
    build: (c, q, S) => ({
      text: `${c.profile.name} — ${c.profile.title}.\n\n${c.profile.summary}`,
      chips: [S.chips.hisProjects, S.chips.hisExperience, S.chips.hisEducation]
    })
  },

  {
    id: 'news',
    words: ['duyuru', 'duyurular', 'haber', 'haberler', 'yenilik', 'ne var ne yok', 'son durum',
            'news', 'announcement', 'announcements', 'update', 'updates', 'latest', 'what is new', 'whats new',
            'اخبار', 'اعلان', 'جديد', 'مستجدات'],
    build: (c, q, S) => {
      const live = (c.announcements || [])
        .filter((a) => a && a.published !== false && (a.title || a.body))
        .sort((a, b) => (!!b.pinned !== !!a.pinned)
          ? (b.pinned ? 1 : -1)
          : String(b.date || '').localeCompare(String(a.date || '')));

      if (!live.length) return { text: S.noNews, chips: [S.chips.projects, S.chips.hisExperience, S.chips.book] };
      const lines = live.slice(0, 3)
        .map((a) => `• ${a.title}${a.date ? ` (${a.date})` : ''}\n  ${a.body || ''}`.trimEnd());
      const more = live.length > 3 ? `\n\n${S.more(live.length - 3)}` : '';
      return { text: `${S.latest}\n\n${lines.join('\n\n')}${more}`, chips: [S.chips.projects, S.chips.hisExperience, S.chips.book] };
    }
  },

  {
    id: 'projects',
    words: ['proje', 'projeler', 'project', 'projects', 'ne yapti', 'portfolio', 'calisma', 'works', 'built', 'drone', 'iha', 'tumor', 'mri', 'beyin', 'brain', 'atik', 'waste', 'geri donusum', 'recycl',
            'مشروع', 'مشاريع', 'مسيره', 'طائره', 'ورم', 'دماغ', 'نفايات', 'فرز', 'اعمال'],
    build: (c, q, S) => {
      const qw = q.split(' ');
      let one = null, bestN = 0;
      (c.projects || []).forEach((p) => {
        const t = fold(p.title + ' ' + (p.tags || []).join(' '));
        const n = t.split(' ').filter((w) => w.length > 3 && !STOP.has(w))
          .filter((w) => qw.some((x) => x === w || x.startsWith(w) || (isArabic(w) && x.includes(w)))).length;
        if (n > bestN) { bestN = n; one = p; }
      });
      if (one) {
        return {
          text: `**${one.title}** (${one.period})\n\n${(one.bullets || []).map((b) => '• ' + b).join('\n')}\n\n${
            one.tags && one.tags.length ? S.tech + ': ' + one.tags.join(', ') : ''
          }`,
          chips: [S.chips.otherProjects, S.chips.skills, S.chips.book]
        };
      }
      return {
        text: `${S.projectsIntro((c.projects || []).length)}\n\n${listOf(
          c.projects,
          (p, i) => `${i + 1}. **${p.title}** — ${p.period}\n   ${(p.bullets || [])[0] || ''}`
        )}\n\n${S.askByName}`,
        chips: (c.projects || []).map((p) => p.title.split(' ').slice(0, 3).join(' '))
      };
    }
  },

  {
    id: 'experience',
    words: ['deneyim', 'tecrube', 'calis', 'staj', 'experience', 'work', 'worked', 'intern', 'internship', 'job', 'career', 'is deneyimi', 'nerede calisti', 'sirket', 'company',
            'خبره', 'خبرات', 'عمل', 'وظيف', 'تدريب', 'شركه', 'مسيره مهنيه'],
    build: (c, q, S) => ({
      text: `${S.expIntro}\n\n${listOf(
        c.experience,
        (e) => `**${e.role}** — ${e.company}\n${e.period}${e.tools ? ' · ' + e.tools : ''}\n${(e.bullets || []).map((b) => '• ' + b).join('\n')}`
      )}`,
      chips: [S.chips.hisProjects, S.chips.hisEducation, S.chips.available]
    })
  },

  {
    id: 'skills',
    words: ['yetenek', 'beceri', 'skill', 'skills', 'teknoloji', 'tech', 'stack', 'biliyor', 'bilir', 'kullaniyor', 'kullanir', 'know', 'knows', 'uses', 'familiar', 'python', 'ros', 'ros2', 'pytorch', 'tensorflow', 'opencv', 'plc', 'programlama', 'programming', 'dil', 'language', 'c++', 'matlab', 'raspberry', 'stm32',
            'مهار', 'مهارات', 'تقنيات', 'يعرف', 'يتقن', 'لغات', 'برمجه', 'ادوات'],
    build: (c, q, S) => {
      const hit = [];
      (c.skills || []).forEach((g) =>
        (g.items || []).forEach((it) => {
          const n = fold(it.name);
          if (n && q.includes(n.split(' ')[0]) && n.split(' ')[0].length > 1) hit.push({ ...it, group: g.category });
        })
      );
      if (hit.length) {
        return { text: hit.map((h) => `**${h.name}** — ${h.level}/100 · ${h.group}`).join('\n'), chips: [S.chips.allSkills, S.chips.hisProjects] };
      }
      return {
        text: `${listOf(
          c.skills,
          (g) => `**${g.category}**\n${(g.items || []).map((i) => `• ${i.name} (${i.level}/100)`).join('\n')}`
        )}\n\n${S.languages}: ${(c.languages || []).map((l) => `${l.name} — ${l.level}`).join(', ')}`,
        chips: [S.chips.hisProjects, S.chips.hisExperience]
      };
    }
  },

  {
    id: 'education',
    words: ['egitim', 'okul', 'universite', 'bolum', 'mezun', 'yuksek lisans', 'lisans', 'education', 'study', 'studied', 'degree', 'university', 'school', 'master', 'bachelor', 'selcuk',
            'تعليم', 'دراس', 'جامعه', 'شهاده جامعيه', 'ماجستير', 'بكالوريوس', 'تخرج'],
    build: (c, q, S) => ({
      text: listOf(c.education, (e) => `**${e.degree}**\n${e.school} · ${e.period}${e.note ? '\n' + e.note : ''}`),
      chips: [S.chips.hisExperience, S.chips.hisSkills]
    })
  },

  {
    id: 'contact',
    words: ['iletisim', 'ulas', 'mail', 'email', 'eposta', 'telefon', 'numara', 'contact', 'reach', 'phone', 'call', 'linkedin', 'github', 'instagram', 'sosyal', 'social', 'hire', 'ise al',
            'تواصل', 'اتصال', 'اتصل', 'بريد', 'هاتف', 'رقم', 'ايميل', 'توظيف'],
    build: (c, q, S) => {
      const lines = [];
      if (c.profile.email) lines.push(`${S.email} — ${c.profile.email}`);
      if (c.profile.phone) lines.push(`${S.phone} — ${c.profile.phone}`);
      if (c.profile.location) lines.push(S.based(c.profile.location));
      const links = (c.socials || []).filter((s) => s.url && !/^https?:\/\/[a-z.]+\/?$/i.test(s.url) && !s.url.startsWith('mailto:'));
      if (links.length) lines.push('\n' + links.map((s) => `${s.label} — ${s.url}`).join('\n'));
      return {
        text: lines.join('\n'),
        chips: c.profile.calendarUrl ? [S.chips.book] : [S.chips.hisProjects],
        action: c.profile.email ? { label: S.sendEmail, url: 'mailto:' + c.profile.email } : null
      };
    }
  },

  {
    id: 'meeting',
    words: ['randevu', 'gorusme', 'toplanti', 'takvim', 'meeting', 'book', 'schedule', 'appointment', 'ne zaman',
            'موعد', 'احجز', 'حجز', 'اجتماع', 'مقابله', 'تقويم'],
    build: (c, q, S) => ({
      text: c.profile.calendarUrl ? `${S.calendar}\n\n${c.profile.calendarNote || ''}`.trim() : S.bestEmail(c.profile.email),
      chips: [S.chips.contact, S.chips.whatDoes],
      action: c.profile.calendarUrl
        ? { label: S.seeAvailability, url: c.profile.calendarUrl }
        : c.profile.email ? { label: S.sendEmail, url: 'mailto:' + c.profile.email } : null
    })
  },

  {
    id: 'cv',
    words: ['cv', 'ozgecmis', 'resume', 'pdf', 'indir', 'download', 'سيره ذاتيه', 'سيرته', 'تحميل'],
    build: (c, q, S) => ({
      text: S.cvLine,
      chips: [S.chips.hisExperience, S.chips.hisProjects],
      action: { label: S.openCv, url: c.profile.cvUrl || '/assets/files/cv.pdf' }
    })
  },

  {
    id: 'availability',
    words: ['musait mi', 'is ariyor', 'available', 'looking for', 'open to', 'hiring', 'freelance', 'part time', 'full time',
            'متاح', 'يبحث عن عمل', 'فرص'],
    build: (c, q, S) => ({
      text: S.availability(c.profile.availability || S.openTo, c.profile.location),
      chips: [S.chips.book, S.chips.contact]
    })
  },

  {
    id: 'location',
    words: ['nerede', 'nereli', 'sehir', 'konum', 'where', 'located', 'city', 'based', 'konya', 'turkiye', 'turkey',
            'اين', 'مدينه', 'يقيم', 'يعيش', 'قونيه', 'تركيا'],
    build: (c, q, S) => ({
      text: S.location(c.profile.location, (c.languages || []).map((l) => `${l.name} (${l.level})`).join(', ')),
      chips: [S.chips.book, S.chips.hisExperience]
    })
  },

  {
    id: 'stats',
    words: ['dogruluk', 'accuracy', 'basari', 'yuzde', 'oran', 'rakam', 'number', 'result', 'tubitak', 'odul', 'award', 'grant',
            'دقه', 'نتائج', 'ارقام', 'جائزه', 'منحه', 'انجاز'],
    build: (c, q, S) => ({
      text: `${S.numbers}\n\n${listOf(
        c.stats,
        (s) => `• **${s.value}${s.suffix || ''}** — ${s.label}${s.detail ? ` (${s.detail})` : ''}`
      )}`,
      chips: [S.chips.hisProjects, S.chips.hisExperience]
    })
  },

  {
    id: 'site',
    words: ['bu site', 'siteyi kim', 'nasil yapildi', 'this site', 'website', 'built this', 'made this', 'imza', 'signature', 'chatbot', 'bot musun', 'are you ai', 'yapay zeka misin',
            'الموقع', 'موقع', 'توقيع', 'هل انت ذكاء'],
    build: (c, q, S) => ({ text: S.site, chips: [S.chips.whatDoes, S.chips.projects] })
  },

  {
    id: 'thanks',
    words: ['tesekkur', 'sagol', 'thanks', 'thank you', 'tamam', 'ok', 'gorusuruz', 'bye', 'hosca kal',
            'شكرا', 'مع السلامه', 'حسنا'],
    exactish: true,
    build: (c, q, S) => ({ text: S.thanks, chips: [S.chips.book, S.chips.contact] })
  }
];

const STOP = new Set([
  'system', 'analysis', 'powered', 'automated', 'based', 'using', 'with', 'from', 'this', 'that',
  'what', 'when', 'where', 'which', 'about', 'tell', 'show', 'does', 'his', 'him', 'the', 'and',
  'sistemi', 'sistem', 'نظام', 'تحليل'
]);

function contentBoost(q, content) {
  const boost = {};
  const bump = (id, n) => (boost[id] = (boost[id] || 0) + n);
  const qWords = q.split(' ').filter(Boolean);
  const said = (term) => qWords.some((x) => x === term || x.startsWith(term + 'i') || x.startsWith(term + 'l') || (isArabic(term) && term.length >= 4 && x.includes(term)));

  (content.projects || []).forEach((p) => {
    const inTitle = fold(p.title).split(' ').filter((w) => w.length >= 4 && !STOP.has(w));
    const inTags = fold((p.tags || []).join(' ')).split(' ').filter((w) => w.length >= 3 && !STOP.has(w));
    if (inTitle.some(said)) bump('projects', 45);
    else if (inTags.some(said)) bump('projects', 18);
  });

  (content.skills || []).forEach((g) =>
    (g.items || []).forEach((it) => {
      const w = fold(it.name).split(' ')[0];
      if (w.length >= 3 && !STOP.has(w) && said(w)) bump('skills', 40);
    })
  );

  (content.experience || []).forEach((e) => {
    const w = fold(e.company).split(' ').filter((x) => x.length >= 4 && !STOP.has(x));
    if (w.some(said)) bump('experience', 30);
  });

  return boost;
}

function pick(question, content, S, original) {
  const q = fold(question);
  if (!q) return null;

  const boost = contentBoost(q, content);
  if (original && original !== content) {
    const b2 = contentBoost(q, original);
    for (const k of Object.keys(b2)) boost[k] = Math.max(boost[k] || 0, b2[k]);
  }
  const qWords = q.split(' ').filter(Boolean);

  let best = null;
  for (const intent of INTENTS) {
    if (intent.guard && !intent.guard(q)) continue;
    let score = boost[intent.id] || 0;
    for (const w of intent.words) {
      if (!triggerHit(qWords, q, w)) continue;
      score += w.includes(' ') ? w.length * 2.5 : w.length;
      if (intent.exactish && q.split(' ').length > 6) score -= w.length * 0.8;
    }
    if (score > 0 && (!best || score > best.score)) best = { intent, score };
  }
  if (!best) return null;
  return best.intent.build(content, q, S);
}

function fallback(S) {
  return { text: S.fallback, chips: [S.chips.projects, S.chips.skills, S.chips.hisExperience, S.chips.book] };
}

function answer(question, content, lang = 'en', original = null) {
  const S = say(lang);
  const text = String(question || '').slice(0, 500);
  if (!text.trim()) return fallback(S);

  const hit = pick(text, content, S, original);
  if (hit) return hit;

  const q = fold(text);
  const words = q.split(' ').filter((w) => w.length > 3);
  if (words.length) {
    const pool = [];
    (content.projects || []).forEach((p) => (p.bullets || []).forEach((b) => pool.push({ src: p.title, line: b })));
    (content.experience || []).forEach((e) => (e.bullets || []).forEach((b) => pool.push({ src: `${e.role}, ${e.company}`, line: b })));

    const mentions = (line, w) => fold(line).split(' ').some((x) => x === w || x.startsWith(w) || w.startsWith(x));

    const scored = pool
      .map((item) => ({ ...item, n: words.filter((w) => mentions(item.line, w)).length }))
      .filter((i) => i.n > 0)
      .sort((a, b) => b.n - a.n)
      .slice(0, 3);

    if (scored.length) {
      return {
        text: `${S.found}\n\n${scored.map((s) => `• ${s.line}\n  _${s.src}_`).join('\n\n')}`,
        chips: [S.chips.projects, S.chips.hisExperience, S.chips.book]
      };
    }
  }
  return fallback(S);
}

function greeting(content, lang = 'en') {
  const S = say(lang);
  const name = content.profile.shortName || content.profile.name;
  return { text: S.greet(name), chips: [S.chips.whatDoes, S.chips.projects, S.chips.skills, S.chips.book] };
}

module.exports = { answer, greeting, fold };
