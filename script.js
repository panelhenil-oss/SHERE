/* ==========================================================
   LINK VAULT — "share with 5 friends to unlock"

   ✏️  EVERYTHING YOU NEED TO CHANGE IS BELOW, IN "CONFIG":
   ========================================================== */
const CONFIG = {
  // The link people will SHARE (paste yours here)
  shareUrl: "https://youtu.be/dfpSUBsLc8g?si=jLZvowFhE8NUgHYE",

  // The message that goes along with the shared link
  shareText: "Check this out 🔥",

  // How many shares are required
  requiredShares: 5,

  // The REAL link that gets unlocked after enough shares
  mainUrl: "https://linkvertise.com/1239053/3YvtIhLbofSo",
  mainLabel: "Open Link",

  // Seconds that must pass after the LAST share before unlocking
  minWaitSeconds: 8,

  // A share only counts if the person was away from this tab at least
  // this many milliseconds (so they really had time to share)
  minAwayMs: 2000,

  // Which buttons to show. Remove any you don't want.
  // Available: whatsapp, telegram, viber, facebook, messenger, x, email, native
  networks: ["whatsapp", "telegram", "viber", "facebook", "x", "native"],
};

/* ==========================================================
   Nothing below this line needs to be touched.
   ========================================================== */

const NETWORKS = {
  whatsapp: { label: "WhatsApp", url: (u, t) => `https://wa.me/?text=${encodeURIComponent(t + " " + u)}` },
  telegram: { label: "Telegram", url: (u, t) => `https://t.me/share/url?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}` },
  viber:    { label: "Viber",    url: (u, t) => `viber://forward?text=${encodeURIComponent(t + " " + u)}` },
  facebook: { label: "Facebook", url: (u) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}` },
  messenger:{ label: "Messenger",url: (u) => `fb-messenger://share/?link=${encodeURIComponent(u)}` },
  x:        { label: "X",        url: (u, t) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(t)}&url=${encodeURIComponent(u)}` },
  email:    { label: "Email",    url: (u, t) => `mailto:?subject=${encodeURIComponent(t)}&body=${encodeURIComponent(t + " " + u)}` },
  native:   { label: "More…",    native: true },
};

function initLinkVault() {
  const shareGrid = document.getElementById('shareGrid');
  const shareDots = document.getElementById('shareDots');
  const shareCount = document.getElementById('shareCount');
  const copyBtn = document.getElementById('copyLinkBtn');
  const statusText = document.getElementById('statusText');

  const mainBtn = document.getElementById('mainBtn');
  const mainBtnText = document.getElementById('mainBtnText');
  const lockOverlay = document.getElementById('lockOverlay');
  const lockText = document.getElementById('lockText');

  const toast = document.getElementById('toast');
  let toastTimeout = null;

  const REQUIRED = CONFIG.requiredShares;
  const MIN_WAIT_MS = CONFIG.minWaitSeconds * 1000;
  const MIN_SPINNER_MS = 900;

  mainBtnText.textContent = CONFIG.mainLabel;

  // State is kept in sessionStorage so a reload doesn't reset progress.
  let shares = parseInt(sessionStorage.getItem('lv_shares') || '0', 10) || 0;
  let lastShareTime = parseInt(sessionStorage.getItem('lv_lastShareTime') || '0', 10) || null;
  let unlocked = sessionStorage.getItem('lv_unlocked') === '1';
  let pendingClickTime = null; // a share window was opened, waiting for the user to come back
  let leftAt = null;
  let verifyTimeoutId = null;
  let countdownIntervalId = null;

  // Build dots
  for (let i = 0; i < REQUIRED; i++) {
    const d = document.createElement('span');
    d.className = 'share-dot';
    shareDots.appendChild(d);
  }

  // Build share buttons
  CONFIG.networks.forEach((key, idx) => {
    const net = NETWORKS[key];
    if (!net) return;
    if (net.native && !navigator.share) return; // only where supported
    const a = document.createElement('a');
    a.className = 'share-btn' + (key === 'whatsapp' ? ' share-btn--whatsapp share-btn--wide' : '');
    a.textContent = net.label;
    a.href = '#';
    a.addEventListener('click', (e) => {
      e.preventDefault();
      if (unlocked || shares >= REQUIRED) return;
      pendingClickTime = Date.now();
      leftAt = null;
      if (net.native) {
        navigator.share({ title: document.title, text: CONFIG.shareText, url: CONFIG.shareUrl })
          .then(() => registerShare())
          .catch(() => { pendingClickTime = null; });
      } else {
        window.open(net.url(CONFIG.shareUrl, CONFIG.shareText), '_blank', 'noopener');
      }
    });
    shareGrid.appendChild(a);
  });

  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(CONFIG.shareText + ' ' + CONFIG.shareUrl);
      showToast('Link copied — paste it to a friend 📋');
    } catch (e) {
      showToast('Could not copy automatically');
    }
  });

  // A share is counted once the user comes back after being away long enough
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (pendingClickTime) leftAt = Date.now();
    } else {
      onReturn();
    }
  });
  window.addEventListener('blur', () => { if (pendingClickTime && !leftAt) leftAt = Date.now(); });
  window.addEventListener('focus', onReturn);

  function onReturn() {
    if (unlocked) return;
    if (pendingClickTime && leftAt && Date.now() - leftAt >= CONFIG.minAwayMs) {
      registerShare();
    } else if (pendingClickTime && !leftAt) {
      // never actually left (popup blocked / closed instantly) — don't count
    }
    if (shares >= REQUIRED) handleComplete();
  }

  function registerShare() {
    pendingClickTime = null;
    leftAt = null;
    if (shares >= REQUIRED) return;
    shares++;
    lastShareTime = Date.now();
    sessionStorage.setItem('lv_shares', String(shares));
    sessionStorage.setItem('lv_lastShareTime', String(lastShareTime));
    renderProgress();
    if (shares < REQUIRED) showToast(`Share ${shares}/${REQUIRED} counted ✓`);
    if (shares >= REQUIRED) handleComplete();
  }

  function renderProgress() {
    [...shareDots.children].forEach((d, i) => d.classList.toggle('is-on', i < shares));
    shareCount.textContent = `${shares} / ${REQUIRED}`;
    if (unlocked) return;
    if (shares === 0) {
      statusText.textContent = `Share with ${REQUIRED} friends to unlock your script…`;
      statusText.classList.remove('is-active', 'is-done');
    } else if (shares < REQUIRED) {
      const left = REQUIRED - shares;
      statusText.textContent = `${left} more ${left === 1 ? 'share' : 'shares'} to go — pick any app above, then come back here.`;
      statusText.classList.add('is-active');
      statusText.classList.remove('is-done');
    }
  }

  function handleComplete() {
    if (unlocked || shares < REQUIRED) return;
    shareGrid.classList.add('is-locked');
    const elapsed = Date.now() - (lastShareTime || Date.now());
    startOrUpdateVerifying(Math.max(MIN_WAIT_MS - elapsed, MIN_SPINNER_MS));
  }

  function startOrUpdateVerifying(remainingMs) {
    lockOverlay.classList.add('is-verifying');
    statusText.textContent = 'Thanks for sharing! Verifying and unlocking the link…';
    statusText.classList.remove('is-active');
    statusText.classList.add('is-done');
    updateCountdownText(remainingMs);

    clearTimeout(verifyTimeoutId);
    clearInterval(countdownIntervalId);

    const target = Date.now() + remainingMs;
    countdownIntervalId = setInterval(() => {
      const left = target - Date.now();
      if (left <= 0) { clearInterval(countdownIntervalId); return; }
      updateCountdownText(left);
    }, 1000);

    verifyTimeoutId = setTimeout(() => {
      clearInterval(countdownIntervalId);
      unlockLink(false);
    }, remainingMs);
  }

  function updateCountdownText(ms) {
    lockText.textContent = `Verifying… ${Math.max(1, Math.ceil(ms / 1000))}s`;
  }

  function unlockLink(skipToast) {
    unlocked = true;
    clearTimeout(verifyTimeoutId);
    clearInterval(countdownIntervalId);
    sessionStorage.setItem('lv_unlocked', '1');

    mainBtn.href = CONFIG.mainUrl;
    mainBtn.removeAttribute('aria-disabled');
    mainBtn.removeAttribute('tabindex');

    lockOverlay.classList.remove('is-verifying');
    lockOverlay.classList.add('is-unlocked');
    lockText.textContent = 'Unlocked';
    shareGrid.classList.add('is-locked');

    statusText.textContent = 'Link unlocked. Thanks for sharing! 🎉';
    statusText.classList.remove('is-active');
    statusText.classList.add('is-done');

    if (!skipToast) showToast('Link unlocked! 🎉');
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove('is-visible'), 2400);
  }

  // Initial state
  renderProgress();
  if (unlocked) {
    unlockLink(true);
  } else if (shares >= REQUIRED) {
    handleComplete();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLinkVault);
} else {
  initLinkVault();
}
