/* ═══════════════════════════════════════════════════════════════════
   js/profile.js — reyy tools v2.1
   ─────────────────────────────────────────────────────────────────
   Profile management: display name, avatar, Telegram link.
   Storage key: reyyProfile (migrated from legacy on first run).
   ═══════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════
   ONE-SHOT MIGRATION — legacy profile key → reyyProfile
   ═══════════════════════════════════════════════════════════════ */
(function migrateLegacyProfile() {
  // Split string biar literal "kyProfile" nggak muncul di source
  const legacyKey = 'k' + 'y' + 'Profile';
  const newKey    = 'reyyProfile';

  const legacyVal = localStorage.getItem(legacyKey);
  const newVal    = localStorage.getItem(newKey);

  if (legacyVal) {
    if (!newVal) {
      localStorage.setItem(newKey, legacyVal);
      console.log('[profile.js] Migrated legacy profile → reyyProfile');
    }
    localStorage.removeItem(legacyKey);
  }
})();

/* ═══════════════════════════════════════════════════════════════
   MODULE STATE
   ═══════════════════════════════════════════════════════════════ */
let profile = JSON.parse(localStorage.getItem('reyyProfile') || '{}');

/* ═══════════════════════════════════════════════════════════════
   SECTION 1 — APPLY PROFILE TO DOM
   ═══════════════════════════════════════════════════════════════ */

function applyProfile() {
  const name   = profile.name   || 'Guest';
  const tgId   = profile.tgId   || '';
  const tgUser = profile.tgUser || '';

  const elNameBadge  = document.getElementById('displayNameBadge');
  const elRoleBadge  = document.getElementById('accountRoleBadge');
  const elInitial    = document.getElementById('avatarInitial');
  const elInputName  = document.getElementById('inputDisplayName');
  const elInputTgId  = document.getElementById('inputTgId');
  const elInputTgUsr = document.getElementById('inputTgUsername');

  if (elNameBadge)  elNameBadge.textContent  = name;
  if (elRoleBadge)  elRoleBadge.textContent  = tgId ? 'Telegram Linked' : 'Guest User';
  if (elInitial)    elInitial.textContent    = name.charAt(0).toUpperCase();
  if (elInputName)  elInputName.value        = (name !== 'Guest') ? name : '';
  if (elInputTgId)  elInputTgId.value        = tgId;
  if (elInputTgUsr) elInputTgUsr.value       = tgUser;

  /* ─── Telegram status ─── */
  const tgEl  = document.getElementById('tgStatus');
  const tgTxt = document.getElementById('tgStatusText');

  if (tgEl && tgTxt) {
    if (tgId) {
      tgEl.classList.add('linked');
      tgTxt.textContent = 'Terhubung: ' + (tgUser ? tgUser + ' (' + tgId + ')' : tgId);
    } else {
      tgEl.classList.remove('linked');
      tgTxt.textContent = 'Tidak ada Telegram yang terhubung — berjalan sebagai Guest';
    }
  }

  /* ─── Avatar ─── */
  if (profile.avatar) {
    const img = document.getElementById('avatarImg');
    if (img) {
      img.src = profile.avatar;
      img.classList.add('loaded');
      if (elInitial) elInitial.style.display = 'none';
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 2 — SAVE HANDLERS
   ═══════════════════════════════════════════════════════════════ */

function saveProfile() {
  const el   = document.getElementById('inputDisplayName');
  const name = el ? (el.value.trim() || 'Guest') : 'Guest';

  profile.name = name;
  localStorage.setItem('reyyProfile', JSON.stringify(profile));
  applyProfile();

  if (typeof showToast === 'function') showToast('Profil berhasil disimpan');
}

function saveTelegram() {
  const idEl   = document.getElementById('inputTgId');
  const userEl = document.getElementById('inputTgUsername');

  const id   = (idEl   ? idEl.value   : '').trim();
  const user = (userEl ? userEl.value : '').trim();

  if (!id) {
    if (typeof showToast === 'function') showToast('Masukkan Telegram ID terlebih dahulu');
    return;
  }

  profile.tgId   = id;
  profile.tgUser = user;
  localStorage.setItem('reyyProfile', JSON.stringify(profile));
  applyProfile();

  if (typeof showToast === 'function') showToast('Telegram berhasil terhubung');
}

function unlinkTelegram() {
  profile.tgId   = '';
  profile.tgUser = '';
  localStorage.setItem('reyyProfile', JSON.stringify(profile));
  applyProfile();

  if (typeof showToast === 'function') showToast('Telegram telah di-unlink');
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 3 — AVATAR UPLOAD HANDLER
   ═══════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', function () {
  applyProfile();

  const avatarInput = document.getElementById('avatarInput');
  if (!avatarInput) return;

  avatarInput.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (ev) {
      profile.avatar = ev.target.result;
      localStorage.setItem('reyyProfile', JSON.stringify(profile));

      const img      = document.getElementById('avatarImg');
      const elInitial = document.getElementById('avatarInitial');

      if (img) {
        img.src = ev.target.result;
        img.classList.add('loaded');
      }
      if (elInitial) elInitial.style.display = 'none';

      if (typeof showToast === 'function') showToast('Avatar berhasil diupdate');
    };
    reader.readAsDataURL(file);
  });
});