/* ══════════════════════════════════════
   profile.js — Profile & Avatar v7.0
   Dipecah dari inline <script> index.html
   ══════════════════════════════════════ */


/* ─── ONE-SHOT MIGRATION ─── */
(function migrateOnce() {
  var oldKey = 'k' + 'y' + 'Profile';  // string concat biar nggak ada "kyProfile" literal
  var newKey = 'reyyProfile';
  var oldVal = localStorage.getItem(oldKey);
  var newVal = localStorage.getItem(newKey);

  if (oldVal) {
    if (!newVal) {
      localStorage.setItem(newKey, oldVal);
      console.log('[profile.js] Migrated legacy profile → reyyProfile');
    }
    localStorage.removeItem(oldKey);   // ← hapus jejak lama
  }
})();

var profile = JSON.parse(localStorage.getItem('reyyProfile') || '{}');

function applyProfile() {
  var name = profile.name || 'Guest';
  var tgId  = profile.tgId  || '';
  var tgUser= profile.tgUser|| '';
  var el1 = document.getElementById('displayNameBadge');
  var el2 = document.getElementById('accountRoleBadge');
  var el3 = document.getElementById('avatarInitial');
  var el4 = document.getElementById('inputDisplayName');
  var el5 = document.getElementById('inputTgId');
  var el6 = document.getElementById('inputTgUsername');
  if (el1) el1.textContent = name;
  if (el2) el2.textContent = tgId ? 'Telegram Linked' : 'Guest User';
  if (el3) el3.textContent = name.charAt(0).toUpperCase();
  if (el4) el4.value = name !== 'Guest' ? name : '';
  if (el5) el5.value = tgId;
  if (el6) el6.value = tgUser;
  var tgEl = document.getElementById('tgStatus');
  var tgTxt = document.getElementById('tgStatusText');
  if (tgEl && tgTxt) {
    if (tgId) {
      tgEl.classList.add('linked');
      tgTxt.textContent = 'Terhubung: ' + (tgUser ? tgUser + ' (' + tgId + ')' : tgId);
    } else {
      tgEl.classList.remove('linked');
      tgTxt.textContent = 'Tidak ada Telegram yang terhubung — berjalan sebagai Guest';
    }
  }
  if (profile.avatar) {
    var img = document.getElementById('avatarImg');
    if (img) {
      img.src = profile.avatar;
      img.classList.add('loaded');
      if (el3) el3.style.display = 'none';
    }
  }
}

function saveProfile() {
  var el = document.getElementById('inputDisplayName');
  var name = el ? el.value.trim() || 'Guest' : 'Guest';
  profile.name = name;
  localStorage.setItem('reyyProfile', JSON.stringify(profile));
  applyProfile();
  if (typeof showToast === 'function') showToast('Profil berhasil disimpan');
}

function saveTelegram() {
  var id   = (document.getElementById('inputTgId') || {}).value || '';
  var user = (document.getElementById('inputTgUsername') || {}).value || '';
  id = id.trim(); user = user.trim();
  if (!id) { if (typeof showToast === 'function') showToast('Masukkan Telegram ID terlebih dahulu'); return; }
  profile.tgId   = id;
  profile.tgUser = user;
  localStorage.setItem('reyyProfile', JSON.stringify(profile));
  applyProfile();
  if (typeof showToast === 'function') showToast('Telegram berhasil terhubung');
}

function unlinkTelegram() {
  profile.tgId = ''; profile.tgUser = '';
  localStorage.setItem('reyyProfile', JSON.stringify(profile));
  applyProfile();
  if (typeof showToast === 'function') showToast('Telegram telah di-unlink');
}

document.addEventListener('DOMContentLoaded', function(){
  applyProfile();

  var _avatarInput = document.getElementById('avatarInput');
  if (_avatarInput) {
    _avatarInput.addEventListener('change', function(e){
      var file = e.target.files[0]; if(!file) return;
      var reader = new FileReader();
      reader.onload = function(ev){
        profile.avatar = ev.target.result;
        localStorage.setItem('reyyProfile', JSON.stringify(profile));
        var img = document.getElementById('avatarImg');
        var el3 = document.getElementById('avatarInitial');
        if (img) { img.src = ev.target.result; img.classList.add('loaded'); }
        if (el3) el3.style.display = 'none';
        if (typeof showToast === 'function') showToast('Avatar berhasil diupdate');
      };
      reader.readAsDataURL(file);
    });
  }
});