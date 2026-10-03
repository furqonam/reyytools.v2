/* ═══════════════════════════════════════════════════════════════
   limits.js — v6.2
   FIX: akses currentTier via window (fallback kalau belum di-set).
   ═══════════════════════════════════════════════════════════════ */

const LIMITS = {
  free: {
    patchOnly:    2,
    encodePatch:  0,
    ky60:         0,
    its:          0,
    aiUpscale:    0,
    cloudUpscale: 0,
    analyzer:     5
  },
  basic: {
    patchOnly:    20, encodePatch:  20, ky60:         20, its:          20,
    aiUpscale:    20, cloudUpscale: 20, analyzer:     20
  },
  pro: {
    patchOnly:    999999, encodePatch:  999999, ky60:         999999, its:          999999,
    aiUpscale:    999999, cloudUpscale: 999999, analyzer:     999999
  }
};

const FEATURE_LABELS = {
  patchOnly:    'Magic Patch',
  encodePatch:  'Encoder',
  ky60:         '60fps Boost',
  its:          'Speed Booster',
  aiUpscale:    'AI Upscaler',
  cloudUpscale: 'Cloud Upscale',
  analyzer:     'Analyzer'
};

function _getTier() {
  return (typeof currentTier !== 'undefined' && currentTier) ? currentTier : 'free';
}

function checkQuota(feature) {
  const tier = _getTier();
  const limit = (LIMITS[tier] || LIMITS.free)[feature] ?? 0;

  if (limit >= 999999) return true;   // VIP+ unlimited

  if (limit === 0) {
    showLimitModal(feature, 0, 0);
    return false;
  }

  const today = new Date().toDateString();
  const usage = JSON.parse(localStorage.getItem('reyy_usage') || '{}');

  if (!usage[feature] || usage[feature].date !== today) {
    usage[feature] = { count: 0, date: today };
  }
  if (usage[feature].count >= limit) {
    showLimitModal(feature, usage[feature].count, limit);
    return false;
  }

  usage[feature].count++;
  localStorage.setItem('reyy_usage', JSON.stringify(usage));
  updateUsageDisplay();
  return true;
}

function getRemainingQuota(feature) {
  const tier = _getTier();
  const limit = (LIMITS[tier] || LIMITS.free)[feature] ?? 0;
  if (limit >= 999999) return '∞';
  if (limit === 0) return 'LOCKED';
  const today = new Date().toDateString();
  const usage = JSON.parse(localStorage.getItem('reyy_usage') || '{}');
  if (!usage[feature] || usage[feature].date !== today) return limit;
  return Math.max(0, limit - usage[feature].count);
}

function showLimitModal(feature, used, limit) {
  const modal = document.getElementById('limitModal');
  const desc = document.getElementById('limitModalDesc');
  if (!modal || !desc) return;
  const label = FEATURE_LABELS[feature] || feature;
  if (limit === 0) {
    desc.innerHTML = `Fitur <b>${label}</b> hanya tersedia untuk <b>Premium</b> dan <b>VIP+</b>.<br><br>Upgrade sekarang untuk mengakses semua tools!`;
  } else {
    desc.innerHTML = `Kamu sudah menggunakan <b>${label} ${used}/${limit}</b> hari ini.<br><br>Upgrade ke <b>Premium</b> (20x/hari) atau <b>VIP+</b> (unlimited).`;
  }
  modal.classList.add('show');
}

function closeLimitModal() {
  const modal = document.getElementById('limitModal');
  if (modal) modal.classList.remove('show');
}

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

function autoResetDailyLimits() {
  const today = new Date().toDateString();
  const lastReset = localStorage.getItem('reyy_last_reset');
  if (lastReset !== today) {
    localStorage.removeItem('reyy_usage');
    localStorage.setItem('reyy_last_reset', today);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  autoResetDailyLimits();
  setTimeout(updateUsageDisplay, 800);
});