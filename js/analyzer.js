/* ═══════════════════════════════════════════════════════════════════
   js/analyzer.js — TikTok Video Analyzer
   v2.1
   ─────────────────────────────────────────────────────────────────
   FIX:
   - Quota dicek SETELAH validasi input (bug #1)
   - Binding analyzeBtn dihapus (sudah di ui.js) — bug #2
   - Quota decrement HANYA saat fetch sukses (anti-rugi)
   - Fetch timeout 8 detik (anti-hang)
   ═══════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════
   HELPER — Fetch with timeout
   ═══════════════════════════════════════════════════════════════ */

function _fetchT(url, opts, ms) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms || 8000);
  return fetch(url, { ...opts, signal: ctrl.signal })
    .finally(() => clearTimeout(timer));
}

/* ═══════════════════════════════════════════════════════════════
   MAIN ANALYZER FUNCTION
   ═══════════════════════════════════════════════════════════════ */

function analyzeTikTok() {
  const rawUrl  = document.getElementById('tiktokUrlInput').value.trim();
  const loading = document.getElementById('analyzerLoading');
  const errBox  = document.getElementById('analyzerError');
  const errMsg  = document.getElementById('analyzerErrorMsg');
  const results = document.getElementById('analyzerResults');
  const btn     = document.getElementById('analyzeBtn');

  /* ─── Validasi input DULU ─── */
  if (!rawUrl) {
    if (typeof showToast === 'function') showToast('Tempelkan link TikTok terlebih dahulu');
    return;
  }
  if (!rawUrl.match(/tiktok\.com/i)) {
    if (typeof showToast === 'function') showToast('Harus berupa link TikTok');
    return;
  }

  /* ─── Cek quota (read-only, JANGAN decrement dulu) ─── */
  if (typeof getRemainingQuota === 'function') {
    const rem = getRemainingQuota('analyzer');
    if (rem === 'LOCKED' || rem === 0) {
      if (typeof showLimitModal === 'function') showLimitModal('analyzer', 0, 0);
      return;
    }
  }

  /* ─── Set UI state: loading ─── */
  loading.style.display = 'block';
  errBox.style.display  = 'none';
  results.classList.remove('show');
  btn.disabled = true;

  const encoded = encodeURIComponent(rawUrl);

  /* ─── CORS Proxy Attempts (waterfall) ─── */
  const attempts = [
    // 1. allorigins + tikwm
    function () {
      const t = 'https://www.tikwm.com/api/?url=' + encoded + '&hd=1';
      return _fetchT('https://api.allorigins.win/get?url=' + encodeURIComponent(t), {}, 8000)
        .then(r => r.json())
        .then(p => {
          const d = JSON.parse(p.contents);
          if (!d || d.code !== 0 || !d.data) throw new Error(d.msg || 'no data');
          return d.data;
        });
    },
    // 2. corsproxy + tikwm
    function () {
      const t = 'https://www.tikwm.com/api/?url=' + encoded + '&hd=1';
      return _fetchT('https://corsproxy.io/?' + encodeURIComponent(t), {}, 8000)
        .then(r => r.json())
        .then(d => {
          if (!d || d.code !== 0 || !d.data) throw new Error(d.msg || 'no data');
          return d.data;
        });
    },
    // 3. allorigins + tikwm (web=1)
    function () {
      const t = 'https://tikwm.com/api/?url=' + encoded + '&hd=1&web=1';
      return _fetchT('https://api.allorigins.win/get?url=' + encodeURIComponent(t), {}, 8000)
        .then(r => r.json())
        .then(p => {
          const d = JSON.parse(p.contents);
          if (!d || d.code !== 0 || !d.data) throw new Error(d.msg || 'no data');
          return d.data;
        });
    },
    // 4. direct (CORS mode)
    function () {
      return _fetchT('https://www.tikwm.com/api/?url=' + encoded + '&hd=1', { mode: 'cors' }, 8000)
        .then(r => r.json())
        .then(d => {
          if (!d || d.code !== 0 || !d.data) throw new Error(d.msg || 'no data');
          return d.data;
        });
    }
  ];

  function tryNext(i) {
    if (i >= attempts.length) {
      loading.style.display = 'none';
      btn.disabled = false;
      errMsg.textContent = 'Semua metode gagal. Pastikan link benar dan video tidak privat.';
      errBox.style.display = 'block';
      return;
    }
    attempts[i]()
      .then(data => {
        /* ─── Baru decrement quota SETELAH sukses ─── */
        if (typeof checkQuota === 'function') checkQuota('analyzer');

        loading.style.display = 'none';
        btn.disabled = false;
        renderAnalyzerResults(data, 'tikwm');
      })
      .catch(() => tryNext(i + 1));
  }

  tryNext(0);
}

/* ═══════════════════════════════════════════════════════════════
   RENDER ANALYZER RESULTS
   ═══════════════════════════════════════════════════════════════ */

function renderAnalyzerResults(d, src) {
  const metaGrid = document.getElementById('metaGrid');

  /* ─── Detect HD ─── */
  let isHD = !!(d.hdplay && d.hdplay.length > 10);
  let w = parseInt(d.width)  || 0;
  let h = parseInt(d.height) || 0;

  if (!w || !h) {
    const urlsToCheck = [d.hdplay || '', d.play || '', d.wmplay || '', d.origin_cover || '', d.cover || ''];
    for (const pu of urlsToCheck) {
      const rm = pu.match(/[_~\/=]([0-9]{3,4})x([0-9]{3,4})/)
              || pu.match(/ratio[_=]([0-9]{3,4})[x%]([0-9]{3,4})/i)
              || pu.match(/([0-9]{3,4})%[xX]([0-9]{3,4})/);
      if (rm) {
        const pw = parseInt(rm[1]);
        const ph = parseInt(rm[2]);
        w = Math.min(pw, ph);
        h = Math.max(pw, ph);
        break;
      }
    }
  }

  if ((!w || !h) && d.ratio) {
    const ratioMatch = String(d.ratio).match(/([0-9]+)[xX:]([0-9]+)/);
    if (ratioMatch) { w = 0; h = 0; }
  }

  if (w >= 1080 || h >= 1080) isHD = true;

  /* ─── HD Badge ─── */
  const hdBadge = document.getElementById('hdBadgeWrap');
  if (isHD) {
    hdBadge.innerHTML = `
      <div class="hd-badge hd-ok">
        <span class="hd-badge-icon">✓</span>
        <div>
          <div class="hd-badge-title">HD Upload Terdeteksi</div>
          <div class="hd-badge-sub">Video kamu diproses dalam kualitas HD oleh TikTok.</div>
        </div>
      </div>`;
  } else {
    hdBadge.innerHTML = `
      <div class="hd-badge hd-no">
        <span class="hd-badge-icon">!</span>
        <div>
          <div class="hd-badge-title">Kualitas Standard</div>
          <div class="hd-badge-sub">Video kamu dikompres oleh TikTok. Coba re-upload dengan Magic Patch Engine.</div>
        </div>
      </div>`;
  }

  /* ─── Thumbnail ─── */
  const thumb    = document.getElementById('analyzerThumb');
  const coverUrl = d.cover || d.origin_cover || '';
  if (coverUrl) {
    thumb.src = 'https://wsrv.nl/?url=' + encodeURIComponent(coverUrl) + '&w=120&h=160&fit=cover';
    thumb.onload  = () => thumb.classList.add('loaded');
    thumb.onerror = () => { thumb.style.display = 'none'; };
  }

  /* ─── Caption & Author ─── */
  document.getElementById('videoCaption').textContent = d.title || '(tanpa caption)';
  const authorName = (d.author && d.author.nickname)
    ? d.author.nickname + (d.author.unique_id ? ' (@' + d.author.unique_id + ')' : '')
    : 'Unknown';
  document.getElementById('videoAuthor').textContent = authorName;
  document.getElementById('videoInfoRow').style.display = 'flex';

  /* ─── Formatters ─── */
  function fmtDur(s) {
    s = parseInt(s) || 0;
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m + 'm ' + (sec < 10 ? '0' : '') + sec + 's';
  }
  function fmtSize(bytes) {
    if (!bytes || bytes <= 0) return 'N/A';
    if (bytes > 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
    return (bytes / 1024).toFixed(0) + ' KB';
  }

  const fpsHint = (d.duration && d.duration <= 60) ? (isHD ? '30-60 fps' : '30 fps') : 'N/A';

  /* ─── Resolution String ─── */
  let resStr, resCls;
  if (w && h) {
    resStr = w + ' × ' + h;
    resCls = (w >= 1080 || h >= 1080) ? 'green' : (w >= 720 || h >= 720) ? 'yellow' : '';
  } else if (d.ratio) {
    resStr = 'Ratio ' + d.ratio;
    resCls = '';
  } else {
    resStr = isHD ? '≥1080p (HD)' : '720p atau lebih rendah';
    resCls = isHD ? 'green' : 'yellow';
  }

  /* ─── Meta Grid Items ─── */
  const items = [
    { label: 'Resolution',   val: resStr,                                              cls: resCls   },
    { label: 'Duration',     val: d.duration ? fmtDur(d.duration) : 'N/A',             cls: 'yellow' },
    { label: 'Est. FPS',     val: fpsHint,                                              cls: ''       },
    { label: 'HD Stream',    val: isHD ? 'Tersedia ✓' : 'Tidak Tersedia ✗',             cls: isHD ? 'green' : '', style: isHD ? '' : 'color:#f87171' },
    { label: 'File Size',    val: fmtSize(d.size),                                     cls: ''       },
    { label: 'HD File Size', val: fmtSize(d.hd_size),                                  cls: ''       },
    { label: 'Likes',        val: d.digg_count    ? Number(d.digg_count).toLocaleString()    : 'N/A', cls: 'accent' },
    { label: 'Views',        val: d.play_count    ? Number(d.play_count).toLocaleString()    : 'N/A', cls: 'accent' },
    { label: 'Comments',     val: d.comment_count ? Number(d.comment_count).toLocaleString() : 'N/A', cls: '' },
    { label: 'Shares',       val: d.share_count   ? Number(d.share_count).toLocaleString()   : 'N/A', cls: '' },
  ];

  metaGrid.innerHTML = items.map(it => {
    const extraStyle = it.style || '';
    return `<div class="meta-item">
      <div class="meta-label">${it.label}</div>
      <div class="meta-val ${it.cls}" style="${extraStyle}">${it.val}</div>
    </div>`;
  }).join('');

  document.getElementById('analyzerResults').classList.add('show');
}

/* ═══════════════════════════════════════════════════════════════
   EVENT BINDING — ONLY Enter key
   (analyzeBtn click di-handle oleh ui.js)
   ═══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function () {
  const inp = document.getElementById('tiktokUrlInput');
  if (inp) {
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') analyzeTikTok();
    });
  }
});