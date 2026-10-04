/* ═══════════════════════════════════════════════════════════════════
   js/limits.js — reyy tools v2.1
   ─────────────────────────────────────────────────────────────────
   Quota system per tier:
   - Basic (free)   : Patch (2x) + Analyzer (5x)
   - Premium (basic): Semua tools (20x/hari)
   - VIP+ (pro)     : Unlimited
   ═══════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════
   CONFIG
   ═══════════════════════════════════════════════════════════════ */

const LIMITS = {
  free: {
    patchOnly:    2,
    encodePatch:  0,      // LOCKED
    reyy60:       0,      // LOCKED
    its:          0,      // LOCKED
    aiUpscale:    0,      // LOCKED
    cloudUpscale: 0,      // LOCKED
    analyzer:     5
  },
  basic: {
    patchOnly:    20,
    encodePatch:  20,
    reyy60:       20,
    its:          20,
    aiUpscale:    20,
    cloudUpscale: 20,
    analyzer:     20
  },
  pro: {
    patchOnly:    999999,
    encodePatch:  999999,
    reyy60:       999999,
    its:          999999,
    aiUpscale:    999999,
    cloudUpscale: 999999,
    analyzer:     999999
  }
};

const FEATURE_LABELS = {
  patchOnly:    'Magic Patch',
  encodePatch:  'Encoder',
  reyy60:       '60fps Boost',
  its:          'Speed Booster',
  aiUpscale:    'AI Upscaler',
  cloudUpscale: 'Cloud Upscale',
  analyzer:     'Analyzer'
};

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */

function _getTier() {
  return (typeof currentTier !== 'undefined' && currentTier) ? currentTier : 'free';
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 1 — QUOTA CHECK (increment)
   ═══════════════════════════════════════════════════════════════ */

function checkQuota(feature) {
  const tier  = _getTier();
  const limit = (LIMITS[tier] || LIMITS.free)[feature] ?? 0;

  /* Unlimited tier */
  if (limit >= 999999) return true;

  /* Feature locked */
  if (limit === 0) {
    showLimitModal(feature, 0, 0);
    return false;
  }

  /* Check daily usage */
  const today = new Date().toDateString();
  const usage = JSON.parse(localStorage.getItem('reyy_usage') || '{}');

  if (!usage[feature] || usage[feature].date !== today) {
    usage[feature] = { count: 0, date: today };
  }

  if (usage[feature].count >= limit) {
    showLimitModal(feature, usage[feature].count, limit);
    return false;
  }

  /* Increment */
  usage[feature].count++;
  localStorage.setItem('reyy_usage', JSON.stringify(usage));
  updateUsageDisplay();
  return true;
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 2 — GET REMAINING (read-only)
   ═══════════════════════════════════════════════════════════════ */

function getRemainingQuota(feature) {
  const tier  = _getTier();
  const limit = (LIMITS[tier] || LIMITS.free)[feature] ?? 0;

  if (limit >= 999999) return '∞';
  if (limit === 0)     return 'LOCKED';

  const today = new Date().toDateString();
  const usage = JSON.parse(localStorage.getItem('reyy_usage') || '{}');
  if (!usage[feature] || usage[feature].date !== today) return limit;

  return Math.max(0, limit - usage[feature].count);
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 3 — LIMIT MODAL
   ═══════════════════════════════════════════════════════════════ */

function showLimitModal(feature, used, limit) {
  const modal = document.getElementById('limitModal');
  const desc  = document.getElementById('limitModalDesc');
  if (!modal || !desc) return;

  const label = FEATURE_LABELS[feature] || feature;

  if (limit === 0) {
    desc.innerHTML =
      `Fitur <b>${label}</b> hanya tersedia untuk <b>Premium</b> dan <b>VIP+</b>.<br><br>` +
      `Upgrade sekarang untuk mengakses semua tools!`;
  } else {
    desc.innerHTML =
      `Kamu sudah menggunakan <b>${label} ${used}/${limit}</b> hari ini.<br><br>` +
      `Upgrade ke <b>Premium</b> (20x/hari) atau <b>VIP+</b> (unlimited).`;
  }

  modal.classList.add('show');
}

function closeLimitModal() {
  const modal = document.getElementById('limitModal');
  if (modal) modal.classList.remove('show');
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 4 — USAGE DISPLAY (Navbar)
   ═══════════════════════════════════════════════════════════════ */

function updateUsageDisplay() {
  const el = document.getElementById('usageDisplay');
  if (!el) return;
  if (typeof currentUser === 'undefined' || !currentUser) return;

  const tier = _getTier();

  if (tier === 'pro') {
    el.innerHTML = '👑 <b>VIP+</b> · Unlimited';
    el.className = 'usage-display pro';
  } else if (tier === 'basic') {
    const remaining = getRemainingQuota('patchOnly');
    el.innerHTML = `⭐ <b>Premium</b> · Sisa: ${remaining}`;
    el.className = 'usage-display basic';
  } else {
    const remaining = getRemainingQuota('patchOnly');
    el.innerHTML = `🎁 <b>Basic</b> · Sisa patch: ${remaining}`;
    el.className = 'usage-display free';
  }
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 5 — AUTO RESET (daily)
   ═══════════════════════════════════════════════════════════════ */

function autoResetDailyLimits() {
  const today     = new Date().toDateString();
  const lastReset = localStorage.getItem('reyy_last_reset');

  if (lastReset !== today) {
    localStorage.removeItem('reyy_usage');
    localStorage.setItem('reyy_last_reset', today);
  }
}

/* ═══════════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  autoResetDailyLimits();
  setTimeout(updateUsageDisplay, 800);
});