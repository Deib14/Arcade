/* ============================================================
   Corner Arcade — pwa.js
   Registers the service worker and shows a small banner when a
   new version is waiting, instead of silently swapping under
   the user mid-session.
   ============================================================ */

(function () {
  if (!('serviceWorker' in navigator)) return;

  function showUpdateBanner(registration) {
    if (document.getElementById('updateBanner')) return; // already showing

    const banner = document.createElement('div');
    banner.id = 'updateBanner';
    banner.className = 'update-banner';
    banner.innerHTML = `
      <span>A new version of Corner Arcade is ready.</span>
      <button id="updateBannerBtn">Refresh</button>
    `;
    document.body.appendChild(banner);
    requestAnimationFrame(() => banner.classList.add('is-visible'));

    document.getElementById('updateBannerBtn').addEventListener('click', () => {
      const waiting = registration.waiting;
      if (waiting) waiting.postMessage('SKIP_WAITING');
    });
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      // A worker was already waiting when we registered (e.g. previous
      // session downloaded an update but never activated it).
      if (registration.waiting) showUpdateBanner(registration);

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // installed + there's already an active controller means this
            // is an update, not the first-ever install
            showUpdateBanner(registration);
          }
        });
      });
    }).catch(() => {
      // Registration can fail (e.g. running from a file:// URL during
      // local testing) — the app still works fully online in that case.
    });

    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });
  });
})();
