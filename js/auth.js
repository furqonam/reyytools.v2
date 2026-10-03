/* ═══════════════════════════════════════════════════════════════
   auth.js — Login via Username / Telegram ID
   Integrasi dengan bot: reyystecu-bot.workers.dev
   ═══════════════════════════════════════════════════════════════ */

const API_BASE = 'https://reyystecu-bot.furqonalmughni95.workers.dev';
const BOT_URL = 'https://t.me/reyystecuu_bot';

// ─── State ───
let currentUser = null;
let currentTier = 'free';
let currentRemaining = 0;

// ─── Init: cek user yang udah login ───
function initAuth() {
  const savedUser = localStorage.getItem('reyy_user');
  if (savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
      currentTier = currentUser.tier || 'free';
      currentRemaining = currentUser.remaining || 0;
      
      // Verify ulang ke API (biar data fresh)
      verifyUser(currentUser.username || currentUser.tg);
    } catch (e) {
      showGate();
    }
  } else {
    showGate();
  }
}

// ─── Verify user ke bot API ───
async function verifyUser(identifier) {
  try {
    const isTgId = /^\d+$/.test(identifier);
    const param = isTgId ? `tg=${identifier}` : `username=${identifier}`;
    
    const res = await fetch(`${API_BASE}/api/auth?${param}`);
    const data = await res.json();
    
    if (data.ok) {
      currentUser = {
        username: data.username || identifier,
        tg: data.tg,
        tier: data.tier,
        remaining: data.remaining,
        expiry: data.expiry,
        registered: data.registered
      };
      currentTier = data.tier;
      currentRemaining = data.remaining;
      
      localStorage.setItem('reyy_user', JSON.stringify(currentUser));
      hideGate();
      updateUserBadge();
      console.log('[Auth] Verified:', currentUser);
    } else {
      // Username gak ketemu
      if (data.reason === 'username_not_found' || !data.registered) {
        showGate('Username tidak terdaftar. Daftar dulu di bot.');
      } else {
        // Guest mode (fallback)
        hideGate();
        updateUserBadge();
      }
    }
  } catch (e) {
    console.error('[Auth] Verify error:', e);
    // Network error → pake data lama
    if (currentUser) {
      hideGate();
      updateUserBadge();
    } else {
      showGate('Gagal konek server. Coba lagi.');
    }
  }
}

// ─── Login handler ───
async function doLogin() {
  const input = document.getElementById('gateInput');
  const errEl = document.getElementById('gateError');
  const btn = document.getElementById('gateBtn');
  
  const val = (input?.value || '').trim().toLowerCase().replace(/^@/, '');
  
  if (!val || val.length < 3) {
    showGateError('Masukkan username atau Telegram ID yang valid');
    return;
  }
  
  if (errEl) errEl.classList.remove('show');
  if (btn) { btn.disabled = true; btn.textContent = 'Memeriksa...'; }
  
  try {
    const isTgId = /^\d+$/.test(val);
    const param = isTgId ? `tg=${val}` : `username=${val}`;
    
    const res = await fetch(`${API_BASE}/api/auth?${param}`);
    const data = await res.json();
    
    if (btn) { btn.disabled = false; btn.textContent = 'Masuk'; }
    
    if (!data.ok) {
      showGateError('Terjadi kesalahan. Coba lagi.');
      return;
    }
    
    if (!data.registered) {
      showGateError('Username tidak terdaftar. Daftar dulu di bot @reyystecuu_bot');
      return;
    }
    
    // Login sukses
    currentUser = {
      username: data.username || val,
      tg: data.tg,
      tier: data.tier,
      remaining: data.remaining,
      expiry: data.expiry,
      registered: true
    };
    currentTier = data.tier;
    currentRemaining = data.remaining;
    
    localStorage.setItem('reyy_user', JSON.stringify(currentUser));
    hideGate();
    updateUserBadge();
    showToast('Login berhasil');
    
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = 'Masuk'; }
    showGateError('Gagal konek server. Coba lagi.');
  }
}

// ─── Show / hide gate ───
function showGate(errorMsg) {
  const gate = document.getElementById('gateScreen');
  if (gate) gate.classList.add('show');
  
  if (errorMsg) showGateError(errorMsg);
}

function hideGate() {
  const gate = document.getElementById('gateScreen');
  if (gate) gate.classList.remove('show');
}

function showGateError(msg) {
  const errEl = document.getElementById('gateError');
  if (errEl) {
    errEl.textContent = msg;
    errEl.classList.add('show');
  }
}

// ─── Update badge user ───
function updateUserBadge() {
  const badge = document.getElementById('tierBadge');
  if (!badge || !currentUser) return;
  
  const tier = currentUser.tier;
  const username = currentUser.username || 'Guest';
  
  if (tier === 'pro') {
    badge.innerHTML = `<span style="color:#fbbf5a;">👑 VIP+</span> · ${username}`;
    badge.className = 'user-badge pro';
  } else if (tier === 'basic') {
    badge.innerHTML = `<span style="color:#00d9ff;">⭐ Premium</span> · ${username}`;
    badge.className = 'user-badge basic';
  } else {
    badge.innerHTML = `<span style="color:#8a95a5;">🎁 Basic</span> · ${username}`;
    badge.className = 'user-badge free';
  }
}

// ─── Logout ───
function logout() {
  localStorage.removeItem('reyy_user');
  localStorage.removeItem('reyy_usage');
  location.reload();
}

// ─── Upgrade button → bot ───
function goToBot() {
  window.open(BOT_URL, '_blank');
}

// ─── Auto init ───
document.addEventListener('DOMContentLoaded', initAuth);
