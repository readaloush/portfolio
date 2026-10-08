(function () {
  const loader = document.getElementById('site-loader');

  let handedOver = false;
  function reveal() {
    if (handedOver) return;
    handedOver = true;
    document.body.classList.remove('is-loading');
    document.body.classList.add('is-ready');
    document.dispatchEvent(new CustomEvent('loader:done'));
    if (loader) {
      loader.classList.add('fade-out');
      setTimeout(() => (loader.style.display = 'none'), 800);
    }
  }

  const D = window.SIGNATURE_PATH;
  if (!D) {
    console.warn('Signature not available - revealing the page without the intro.');
    return reveal();
  }

  const failsafe = setTimeout(() => {
    if (document.body.classList.contains('is-loading')) reveal();
  }, 5000);

  ['drawingPath', 'spinePath', 'clipMaskPath'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.setAttribute('d', D);
  });

  const animationDuration = 1700;
  const startTime = performance.now();

  const drawingPath = document.getElementById('drawingPath');
  const spinePath = document.getElementById('spinePath');
  const glowPointer = document.getElementById('glowPointer');
  const counterEl = document.getElementById('loaderCounter');
  const lineEl = document.getElementById('loaderLine');
  const sigContainer = document.getElementById('sigContainer');
  const shineBar = document.getElementById('shineBar');

  if (!drawingPath || !spinePath || !counterEl || !lineEl) { clearTimeout(failsafe); return reveal(); }

  if (window.SFX) window.SFX.unlockAudio();

  const totalSpineLength = spinePath.getTotalLength();
  drawingPath.style.strokeDasharray = totalSpineLength;
  drawingPath.style.strokeDashoffset = totalSpineLength;

  function updateLoader(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / animationDuration, 1);
    const easeProgress = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    const safeProgress = Math.min(Math.max(easeProgress, 0), 1);

    drawingPath.style.strokeDashoffset = totalSpineLength - safeProgress * totalSpineLength;

    if (totalSpineLength > 0 && glowPointer) {
      const point = spinePath.getPointAtLength(safeProgress * totalSpineLength);
      glowPointer.setAttribute('transform', 'translate(' + point.x + ', ' + point.y + ')');
      glowPointer.style.opacity = safeProgress > 0.002 && safeProgress < 0.998 ? '1' : '0';
    }

    const currentNumber = Math.floor(safeProgress * 100);
    counterEl.textContent = currentNumber < 10 ? '0' + currentNumber : currentNumber;
    lineEl.style.width = currentNumber + '%';

    if (progress < 1) requestAnimationFrame(updateLoader);
    else executeCompletionSequence();
  }

  function executeCompletionSequence() {
    clearTimeout(failsafe);
    counterEl.textContent = '100';
    lineEl.style.width = '100%';
    if (glowPointer) glowPointer.style.opacity = '0';

    if (sigContainer) {
      sigContainer.style.transition = 'transform 130ms cubic-bezier(0.25, 1, 0.5, 1)';
      sigContainer.style.transform = 'scale(1.025)';
      setTimeout(() => (sigContainer.style.transform = 'scale(1.00)'), 130);
    }

    setTimeout(() => {
      if (shineBar) {
        shineBar.style.transition = 'transform 600ms cubic-bezier(0.4, 0, 0.2, 1)';
        shineBar.style.transform = 'translateX(950px) skewX(-25deg)';
      }
      setTimeout(reveal, 450);
    }, 250);
  }

  requestAnimationFrame(updateLoader);
})();
