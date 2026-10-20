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

  // After the LAST counted share, this countdown runs before unlocking
  minWaitSeconds: 60,

  // A share only counts if the person stays away at least this long.
  // If they come back sooner, it is NOT counted and they must try again.
  minShareSeconds: 8,

  // Only used on devices without the system share sheet (e.g. most desktops):
  // available: whatsapp, telegram, viber, facebook, messenger, x, email
  fallbackNetworks: ["whatsapp", "telegram", "viber", "facebook", "x", "email"],
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
};

function initLinkVault() {
  const shareMainBtn = document.getElementById('shareMainBtn');
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
  const MIN_SHARE_MS = CONFIG.minShareSeconds * 1000;
  const hasNativeShare = typeof navigator.share === 'function';

  mainBtnText.textContent = CONFIG.mainLabel;

  let shares = parseInt(sessionStorage.getItem('lv_shares') || '0', 10) || 0;
  let lastShareTime = parseInt(sessionStorage.getItem('lv_lastShareTime') || '0', 10) || null;
  let unlocked = sessionStorage.getItem('lv_unlocked') === '1';
  let awaiting = null; // { t, left, resolved, needLeft }
  let checkTimer = null;
  let verifyTimeoutId = null;
  let countdownIntervalId = null;

  for (let i = 0; i < REQUIRED; i++) {
    const d = document.createElement('span');
    d.className = 'share-dot';
    shareDots.appendChild(d);
  }

  // Fallback menu (desktop without system share sheet)
  if (!hasNativeShare) {
    CONFIG.fallbackNetworks.forEach((key) => {
      const net = NETWORKS[key];
      if (!net) return;
      const a = document.createElement('a');
      a.className = 'share-btn' + (key === 'whatsapp' ? ' share-btn--whatsapp share-btn--wide' : '');
      a.textContent = net.label;
      a.href = '#';
      a.addEventListener('click', (e) => {
        e.preventDefault();
        if (unlocked || shares >= REQUIRED) return;
        beginShare({ resolved: true, needLeft: true });
        window.open(net.url(CONFIG.shareUrl, CONFIG.shareText), '_blank', 'noopener');
        shareGrid.hidden = true;
      });
      shareGrid.appendChild(a);
    });
  }

  shareMainBtn.addEventListener('click', () => {
    if (unlocked || shares >= REQUIRED || awaiting) return;
    if (hasNativeShare) {
      beginShare({ resolved: false, needLeft: false });
      navigator.share({ title: document.title, text: CONFIG.shareText, url: CONFIG.shareUrl })
        .then(() => { if (awaiting) { awaiting.resolved = true; check(); } })
        .catch(() => cancelShare()); // cancelled / failed -> not counted
    } else {
      shareGrid.hidden = !shareGrid.hidden;
    }
  });

  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(CONFIG.shareText + ' ' + CONFIG.shareUrl);
      showToast('Link copied — paste it to a friend 📋');
    } catch (e) {
      showToast('Could not copy automatically');
    }
  });

  function beginShare(opts) {
    awaiting = { t: Date.now(), left: null, resolved: opts.resolved, needLeft: opts.needLeft };
    shareMainBtn.classList.add('is-waiting');
    shareMainBtn.textContent = 'Waiting for your share…';
    clearTimeout(checkTimer);
    checkTimer = setTimeout(check, MIN_SHARE_MS + 300);
  }

  function cancelShare() {
    awaiting = null;
    clearTimeout(checkTimer);
    resetShareBtn();
  }

  function resetShareBtn() {
    shareMainBtn.classList.remove('is-waiting');
    shareMainBtn.textContent = shares >= REQUIRED ? 'Done ✓' : 'Share';
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') markLeft(); else check();
  });
  window.addEventListener('blur', markLeft);
  window.addEventListener('focus', check);

  function markLeft() {
    if (awaiting && !awaiting.left) awaiting.left = Date.now();
  }

  // Decides whether the pending share counts.
  function check() {
    if (unlocked || !awaiting || !awaiting.resolved) return;
    const visible = document.visibilityState === 'visible';
    const elapsed = Date.now() - awaiting.t;

    if (elapsed >= MIN_SHARE_MS) {
      if (awaiting.left && !visible) return;           // still away — wait for return
      if (awaiting.needLeft && !awaiting.left) return; // popup never opened
      registerShare();
    } else if (awaiting.left && visible) {
      cancelShare(); // came back too fast -> doesn't count
      showToast('Too fast — take your time and actually send it ⏱️');
    }
  }

  function registerShare() {
    cancelShare();
    if (shares >= REQUIRED) return;
    shares++;
    lastShareTime = Date.now();
    sessionStorage.setItem('lv_shares', String(shares));
    sessionStorage.setItem('lv_lastShareTime', String(lastShareTime));
    renderProgress();
    if (shares < REQUIRED) showToast(`Share ${shares}/${REQUIRED} counted ✓`);
    else handleComplete();
  }

  function renderProgress() {
    [...shareDots.children].forEach((d, i) => d.classList.toggle('is-on', i < shares));
    shareCount.textContent = `${shares} / ${REQUIRED}`;
    if (!awaiting) resetShareBtn();
    if (unlocked) return;
    if (shares === 0) {
      statusText.textContent = `Share with ${REQUIRED} friends to unlock your script…`;
      statusText.classList.remove('is-active', 'is-done');
    } else if (shares < REQUIRED) {
      const left = REQUIRED - shares;
      statusText.textContent = `${left} more ${left === 1 ? 'share' : 'shares'} to go — tap Share again.`;
      statusText.classList.add('is-active');
      statusText.classList.remove('is-done');
    }
  }

  function handleComplete() {
    if (unlocked || shares < REQUIRED) return;
    shareMainBtn.disabled = true;
    shareGrid.hidden = true;
    resetShareBtn();
    const elapsed = Date.now() - (lastShareTime || Date.now());
    startVerifying(Math.max(MIN_WAIT_MS - elapsed, 900));
  }

  function startVerifying(remainingMs) {
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
    shareMainBtn.disabled = true;

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

  renderProgress();
  if (unlocked) unlockLink(true);
  else if (shares >= REQUIRED) handleComplete();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLinkVault);
} else {
  initLinkVault();
}
