(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const orb = $('#chatOrb');
  const panel = $('#chatPanel');
  const log = $('#chatLog');
  const chips = $('#chatChips');
  const form = $('#chatForm');
  const input = $('#chatInput');
  const badge = $('#orbBadge');
  if (!orb || !panel) return;

  let opened = false;
  let busy = false;

  const rich = (text) =>
    esc(text)
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/_(.+?)_/g, '<em>$1</em>');

  function bubble(who, text, action) {
    if (!text || !String(text).trim()) {
      text = 'Something went wrong on my side and I have no answer to show. Try again in a moment.';
      action = null;
    }
    const el = document.createElement('div');
    el.className = 'msg ' + who;
    el.innerHTML =
      `<div class="bubble">${rich(text)}` +
      (action ? `<a class="go" href="${esc(action.url)}" target="_blank" rel="noopener">${esc(action.label)} ↗</a>` : '') +
      `</div>`;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  function typing() {
    const el = document.createElement('div');
    el.className = 'msg bot';
    el.innerHTML = '<div class="bubble typing"><i></i><i></i><i></i></div>';
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  function setChips(list) {
    chips.innerHTML = '';
    (list || []).slice(0, 4).forEach((c, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = c;
      b.style.animationDelay = i * 60 + 'ms';
      b.addEventListener('click', () => ask(c));
      chips.appendChild(b);
    });
  }

  function explain(status) {
    if (status === 404)
      return 'My side of the site is not running yet. The server needs to be restarted once — double-click BASLAT.command and reload this page.';
    if (status === 429) return 'That was a lot of questions at once. Give me a few seconds.';
    if (status >= 500) return 'The server hit an error answering that. Try a different question.';
    return 'I could not get an answer for that one.';
  }

  async function ask(question) {
    if (busy || !question.trim()) return;
    busy = true;
    bubble('me', question);
    setChips([]);
    input.value = '';
    window.SFX?.click();

    const dots = typing();
    const started = Date.now();

    let reply;
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question, lang: (window.I18N && window.I18N.lang) || 'en' })
      });
      reply = await res.json().catch(() => ({}));
      if (!res.ok || !reply.text) reply = { text: explain(res.status), chips: [] };
    } catch {
      reply = { text: 'I cannot reach the server — it looks like it stopped running.', chips: [] };
    }

    const wait = Math.max(0, 420 - (Date.now() - started));
    setTimeout(() => {
      dots.remove();
      bubble('bot', reply.text || '…', reply.action);
      setChips(reply.chips);
      window.SFX?.hover();
      busy = false;
      input.focus();
    }, wait);
  }

  async function open() {
    panel.hidden = false;
    orb.classList.add('hidden');
    badge.classList.add('gone');
    window.SFX?.unlockAudio();
    window.SFX?.knock(3);
    setTimeout(() => input.focus(), 300);

    if (!opened) {
      opened = true;
      const dots = typing();
      try {
        const res = await fetch('/api/chat?lang=' + encodeURIComponent((window.I18N && window.I18N.lang) || 'en'));
        const hello = await res.json().catch(() => ({}));
        setTimeout(() => {
          dots.remove();
          if (!res.ok || !hello.text) bubble('bot', explain(res.status));
          else { bubble('bot', hello.text); setChips(hello.chips); }
        }, 500);
      } catch {
        dots.remove();
        bubble('bot', 'I cannot reach the server — it looks like it stopped running.');
      }
    }
  }

  function close() {
    panel.classList.add('closing');
    setTimeout(() => {
      panel.hidden = true;
      panel.classList.remove('closing');
      orb.classList.remove('hidden');
    }, 280);
  }

  orb.addEventListener('click', open);
  $('#chatClose').addEventListener('click', close);

  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) close();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    ask(input.value);
  });

  setTimeout(() => badge.classList.add('gone'), 25000);
})();
