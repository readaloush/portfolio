/* ==================================================================
   Cold-start survival.

   On a free host the server goes to sleep after a quiet spell and takes
   the better part of a minute to wake up. During that window the edge
   answers "Not Found" for anything it has not cached, which used to
   leave the first visitor staring at a black screen forever.

   This wraps fetch so any /api/ request that comes back 404/5xx is
   retried while the server wakes, and tells the visitor what is
   happening instead of failing silently.

   The distinction that matters: a *failure to reach* the server and a
   *reply from* the server are not the same thing. The first version
   retried anything that was not 200, which was fine while every endpoint
   either worked or was asleep — and then the site grew one that answers
   401 on purpose. /api/auth/me tells an anonymous visitor "you are not
   signed in", which is a complete and correct answer, and the retry loop
   read it as a sick server: seven requests over half a minute, and the
   "Waking the server up" banner shown to someone whose server was wide
   awake. Seen in the live log — six retries per page load, every load.
   ================================================================== */
(() => {
  const realFetch = window.fetch.bind(window);
  const START = Date.now();
  const WAKE_WINDOW = 75_000;   // how long a cold start may reasonably take
  const DELAYS = [1200, 2000, 3000, 4000, 6000, 8000, 10000];

  let notice = null;

  /**
   * Is this status a sleeping server, or the server saying something?
   *
   *   404  — Render's edge answers this for a service that is still
   *          starting, so it stays retryable even though it is a 4xx.
   *   5xx  — the app is up but not ready, or restarting mid-deploy.
   *
   * Everything else is an answer. 401 means not signed in. 403 means
   * not allowed. 429 means you are asking too often — retrying *that*
   * one is actively harmful, since it is the login rate limiter and
   * hammering it extends the lockout.
   */
  const worthRetrying = (status) => status === 404 || status >= 500;

  function showNotice() {
    if (notice) return;
    notice = document.createElement('div');
    notice.id = 'wakeNotice';
    notice.innerHTML =
      '<span class="wake-dot"></span>Waking the server up — this takes a moment on the free plan.';
    Object.assign(notice.style, {
      position: 'fixed', left: '50%', bottom: '28px', transform: 'translateX(-50%)',
      zIndex: '1000000', padding: '11px 20px', borderRadius: '999px',
      background: 'rgba(10,12,20,.92)', color: '#eef1f7', font: '13px/1.4 Sora, system-ui, sans-serif',
      border: '1px solid rgba(255,255,255,.16)', backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', gap: '9px', boxShadow: '0 14px 40px rgba(0,0,0,.5)'
    });
    const dot = notice.querySelector('.wake-dot');
    Object.assign(dot.style, {
      width: '7px', height: '7px', borderRadius: '50%', background: '#00e5ff',
      boxShadow: '0 0 10px #00e5ff', animation: 'wakePulse 1.1s ease-in-out infinite'
    });
    const style = document.createElement('style');
    style.textContent = '@keyframes wakePulse{0%,100%{opacity:.35;transform:scale(.8)}50%{opacity:1;transform:scale(1.25)}}';
    document.head.appendChild(style);
    (document.body || document.documentElement).appendChild(notice);
  }

  const hideNotice = () => { notice?.remove(); notice = null; };

  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const isApi = url.includes('/api/');

    let res;
    try {
      res = await realFetch(input, init);
    } catch (err) {
      if (!isApi) throw err;
      res = null;
    }

    if (!isApi || (res && res.ok)) return res;
    if (res && !worthRetrying(res.status)) return res;

    // Retry only while a cold start is plausible.
    for (const wait of DELAYS) {
      if (Date.now() - START > WAKE_WINDOW) break;
      showNotice();
      await new Promise((r) => setTimeout(r, wait));
      try {
        // cache-bust, because the edge may have cached the 404
        const bustUrl = url + (url.includes('?') ? '&' : '?') + '_w=' + Date.now();
        const retry = await realFetch(typeof input === 'string' ? bustUrl : input, {
          ...init,
          cache: 'reload'
        });
        if (retry.ok) { hideNotice(); return retry; }
        // The server woke up mid-loop and gave a real answer — stop.
        if (!worthRetrying(retry.status)) { hideNotice(); return retry; }
        res = retry;
      } catch { /* keep waiting */ }
    }

    hideNotice();
    return res || new Response('{"error":"unreachable"}', { status: 503, headers: { 'Content-Type': 'application/json' } });
  };
})();
