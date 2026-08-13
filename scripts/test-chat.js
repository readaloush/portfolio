#!/usr/bin/env node
/**
 * The assistant's exam.
 *
 * Two things matter: it answers real questions correctly in both
 * languages, and it never pretends to know something that is not in
 * the CV. Run with:  node scripts/test-chat.js
 */
const assert = require('assert');
const chat = require('../src/chat');
const content = require('../src/defaultContent');

let pass = 0;
let fail = 0;

function check(label, ok, detail = '') {
  if (ok) { pass++; console.log('  ✓ ' + label); }
  else { fail++; console.log('  ✗ ' + label + (detail ? '\n      ' + detail : '')); }
}

/* ---------- questions it must answer, in Turkish and English ---------- */
const MUST_ANSWER = [
  ['merhaba', 'assistant'],
  ['selam', 'assistant'],
  ['kimdir bu', 'READ LEVA'],
  ['kim bu adam', 'READ LEVA'],
  ['ne yapiyor', 'READ LEVA'],
  ['kendini tanit', 'READ LEVA'],
  ['who is he', 'READ LEVA'],
  ['what does he do', 'READ LEVA'],
  ['tell me about him', 'READ LEVA'],

  ['projelerini goster', 'projects on this site'],
  ['projeleri neler', 'projects on this site'],
  ['show me his projects', 'projects on this site'],
  ['drone projesi', 'Foldable'],
  ['iha projesi hakkinda', 'Foldable'],
  ['tell me about the waste sorting system', 'Waste Sorting'],
  ['beyin tumoru', 'Brain Tumor'],
  ['mri projesi', 'Brain Tumor'],

  ['yetenekleri', 'Programming'],
  ['hangi teknolojileri biliyor', 'Programming'],
  ['what are his skills', 'Programming'],
  ['python biliyor mu', 'Python'],
  ['does he know pytorch', 'PyTorch'],
  ['ros2 kullaniyor mu', 'ROS2'],
  ['does he know ros2', 'ROS2'],
  ['opencv biliyor mu', 'OpenCV'],
  ['raspberry pi', 'Raspberry'],
  ['siemens', 'Siemens'],

  ['deneyimi nedir', 'experience'],
  ['nerede calisti', 'experience'],
  ['staj yapti mi', 'experience'],
  ['work experience', 'experience'],
  ['mizan mekatronik', 'experience'],

  ['egitimi', 'Selçuk'],
  ['hangi universitede okudu', 'Selçuk'],
  ['where did he study', 'Selçuk'],
  ['yuksek lisans', 'Selçuk'],

  ['nasil ulasabilirim', 'readaloush'],
  ['iletisim bilgileri', 'readaloush'],
  ['how can I contact him', 'readaloush'],
  ['mail adresi', 'readaloush'],

  ['randevu almak istiyorum', 'booking calendar'],
  ['book a meeting', 'booking calendar'],
  ['gorusme ayarlayabilir miyim', 'booking calendar'],

  ['cv indir', 'CV'],
  ['resume', 'CV'],
  ['nereli', 'Konya'],
  ['where is he based', 'Konya'],
  ['musait mi', 'Open to'],
  ['is he available', 'Open to'],
  ['tubitak', 'TÜBİTAK'],
  ['dogruluk orani', '98.43'],
  ['bu siteyi kim yapti', 'built this site'],
  ['tesekkurler', 'Anytime']
];

/* ---------- questions it must refuse, because the CV cannot answer ---------- */
const MUST_DECLINE = [
  'who is the president',
  'who is elon musk',
  'write me a poem',
  '2+2 kac eder',
  'bitcoin fiyati ne',
  'hava durumu nasil',
  'recipe for cake',
  'is it raining',
  'tell me a joke',
  'what is the capital of France'
];

console.log('\nQUESTIONS IT MUST ANSWER\n');
for (const [q, expect] of MUST_ANSWER) {
  const a = chat.answer(q, content);
  check(q.padEnd(38) + '→ ' + a.text.split('\n')[0].slice(0, 40), a.text.includes(expect),
    'expected to contain "' + expect + '", got: ' + a.text.slice(0, 90));
}

console.log('\nQUESTIONS IT MUST REFUSE\n');
for (const q of MUST_DECLINE) {
  const a = chat.answer(q, content);
  check(q, /only know what is on this page/.test(a.text), 'it answered: ' + a.text.slice(0, 90));
}

console.log('\nSAFETY\n');

// it must never produce a fact that is not somewhere in the content
const flat = JSON.stringify(content).toLowerCase();
const numbers = new Set();
for (const [q] of MUST_ANSWER) {
  const a = chat.answer(q, content);
  a.text
    .replace(/\/100\b/g, '')       // "95/100" is our own scale, not a claim
    .match(/\d+[\d.,]*/g)
    ?.forEach((n) => numbers.add(n));
}
const invented = [...numbers].filter((n) => n.length > 2 && !flat.includes(n.replace(/,$/, '')));
check('every number it prints exists in the CV (' + numbers.size + ' checked)', invented.length === 0,
  'not found in content: ' + invented.join(', '));

const greet = chat.greeting(content);
check('opening message mentions him by name', greet.text.includes(content.profile.shortName || content.profile.name));
check('opening message offers starting questions', Array.isArray(greet.chips) && greet.chips.length >= 3);

check('a very long question does not crash it', (() => {
  try { return !!chat.answer('a'.repeat(5000), content).text; } catch { return false; }
})());
check('an empty question is handled', (() => {
  try { return !!chat.answer('', content).text; } catch { return false; }
})());
check('missing content sections do not crash it', (() => {
  try {
    const thin = JSON.parse(JSON.stringify(content));
    thin.projects = []; thin.socials = []; thin.stats = [];
    return !!chat.answer('projects', thin).text && !!chat.answer('contact', thin).text;
  } catch { return false; }
})());

console.log('\n  ' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
