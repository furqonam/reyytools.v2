/* ══════════════════════════════════════
   analyzer.js — TikTok Video Analyzer
   Dipecah dari inline <script> index.html
   ══════════════════════════════════════ */

function analyzeTikTok() {
  if (typeof checkQuota === 'function' && !checkQuota('analyzer')) return;
  var rawUrl = document.getElementById('tiktokUrlInput').value.trim();
  var loading = document.getElementById('analyzerLoading');
  var errBox  = document.getElementById('analyzerError');
  var errMsg  = document.getElementById('analyzerErrorMsg');
  var results = document.getElementById('analyzerResults');

  if (!rawUrl) { showToast('Tempelkan link TikTok terlebih dahulu'); return; }
  if (!rawUrl.match(/tiktok\.com/i)) { showToast('Harus berupa link TikTok'); return; }

  loading.style.display = 'block';
  errBox.style.display  = 'none';
  results.classList.remove('show');
  document.getElementById('analyzeBtn').disabled = true;

  var encoded = encodeURIComponent(rawUrl);

  var attempts = [
    function() {
      var t = 'https://www.tikwm.com/api/?url=' + encoded + '&hd=1';
      return fetch('https://api.allorigins.win/get?url=' + encodeURIComponent(t))
        .then(function(r){ return r.json(); })
        .then(function(p){
          var d = JSON.parse(p.contents);
          if (!d || d.code !== 0 || !d.data) throw new Error(d.msg || 'no data');
          return d.data;
        });
    },
    function() {
      var t = 'https://www.tikwm.com/api/?url=' + encoded + '&hd=1';
      return fetch('https://corsproxy.io/?' + encodeURIComponent(t))
        .then(function(r){ return r.json(); })
        .then(function(d){
          if (!d || d.code !== 0 || !d.data) throw new Error(d.msg || 'no data');
          return d.data;
        });
    },
    function() {
      var t = 'https://tikwm.com/api/?url=' + encoded + '&hd=1&web=1';
      return fetch('https://api.allorigins.win/get?url=' + encodeURIComponent(t))
        .then(function(r){ return r.json(); })
        .then(function(p){
          var d = JSON.parse(p.contents);
          if (!d || d.code !== 0 || !d.data) throw new Error(d.msg || 'no data');
          return d.data;
        });
    },
    function() {
      return fetch('https://www.tikwm.com/api/?url=' + encoded + '&hd=1', {mode:'cors'})
        .then(function(r){ return r.json(); })
        .then(function(d){
          if (!d || d.code !== 0 || !d.data) throw new Error(d.msg || 'no data');
          return d.data;
        });
    }
  ];

  function tryNext(i) {
    if (i >= attempts.length) {
      loading.style.display = 'none';
      document.getElementById('analyzeBtn').disabled = false;
      errMsg.textContent = 'Semua metode gagal. Pastikan link benar dan video tidak privat.';
      errBox.style.display = 'block';
      return;
    }
    attempts[i]()
      .then(function(data) {
        loading.style.display = 'none';
        document.getElementById('analyzeBtn').disabled = false;
        renderAnalyzerResults(data, 'tikwm');
      })
      .catch(function() { tryNext(i + 1); });
  }

  tryNext(0);
}

function renderAnalyzerResults(d, src) {
  var results  = document.getElementById('analyzerResults');
  var metaGrid = document.getElementById('metaGrid');

  var isHD = !!(d.hdplay && d.hdplay.length > 10);
  var w = parseInt(d.width)  || 0;
  var h = parseInt(d.height) || 0;

  if (!w || !h) {
    var urlsToCheck = [d.hdplay||'', d.play||'', d.wmplay||'', d.origin_cover||'', d.cover||''];
    for (var ui = 0; ui < urlsToCheck.length; ui++) {
      var pu = urlsToCheck[ui];
      var rm = pu.match(/[_~\/=]([0-9]{3,4})x([0-9]{3,4})/)
            || pu.match(/ratio[_=]([0-9]{3,4})[x%]([0-9]{3,4})/i)
            || pu.match(/([0-9]{3,4})%[xX]([0-9]{3,4})/);
      if (rm) {
        var pw = parseInt(rm[1]), ph = parseInt(rm[2]);
        w = Math.min(pw, ph); h = Math.max(pw, ph);
        break;
      }
    }
  }

  if ((!w || !h) && d.ratio) {
    var ratioMatch = String(d.ratio).match(/([0-9]+)[xX:]([0-9]+)/);
    if (ratioMatch) { w = 0; h = 0; }
  }

  if (w >= 1080 || h >= 1080) isHD = true;

  var hdBadge = document.getElementById('hdBadgeWrap');
  if (isHD) {
    hdBadge.innerHTML = '<div class="hd-badge hd-ok">'
      + '<span class="hd-badge-icon">✓</span>'
      + '<div><div class="hd-badge-title">HD Upload Terdeteksi</div>'
      + '<div class="hd-badge-sub">Video kamu diproses dalam kualitas HD oleh TikTok.</div></div></div>';
  } else {
    hdBadge.innerHTML = '<div class="hd-badge hd-no">'
      + '<span class="hd-badge-icon">!</span>'
      + '<div><div class="hd-badge-title">Kualitas Standard</div>'
      + '<div class="hd-badge-sub">Video kamu dikompres oleh TikTok. Coba re-upload dengan Magic Patch Engine.</div></div></div>';
  }

  var thumb = document.getElementById('analyzerThumb');
  var coverUrl = d.cover || d.origin_cover || '';
  if (coverUrl) {
    thumb.src = 'https://wsrv.nl/?url=' + encodeURIComponent(coverUrl) + '&w=120&h=160&fit=cover';
    thumb.onload  = function(){ thumb.classList.add('loaded'); };
    thumb.onerror = function(){ thumb.style.display = 'none'; };
  }

  document.getElementById('videoCaption').textContent = d.title || '(tanpa caption)';
  var authorName = (d.author && d.author.nickname)
    ? d.author.nickname + (d.author.unique_id ? ' (@' + d.author.unique_id + ')' : '')
    : 'Unknown';
  document.getElementById('videoAuthor').textContent = authorName;
  document.getElementById('videoInfoRow').style.display = 'flex';

  function fmtDur(s) {
    s = parseInt(s) || 0;
    var m = Math.floor(s / 60), sec = s % 60;
    return m + 'm ' + (sec < 10 ? '0' : '') + sec + 's';
  }
  function fmtSize(bytes) {
    if (!bytes || bytes <= 0) return 'N/A';
    if (bytes > 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
    return (bytes / 1024).toFixed(0) + ' KB';
  }

  var fpsHint = 'N/A';
  if (d.duration && d.duration <= 60) fpsHint = isHD ? '30-60 fps' : '30 fps';

  var resStr, resCls;
  if (w && h) {
    resStr = w + ' × ' + h;
    resCls = (w >= 1080 || h >= 1080) ? 'green' : (w >= 720 || h >= 720) ? 'yellow' : '';
  } else if (d.ratio) {
    resStr = 'Ratio ' + d.ratio; resCls = '';
  } else {
    resStr = isHD ? '≥1080p (HD)' : '720p atau lebih rendah';
    resCls = isHD ? 'green' : 'yellow';
  }

  var items = [
    { label: 'Resolution',    val: resStr,                                              cls: resCls   },
    { label: 'Duration',      val: d.duration ? fmtDur(d.duration) : 'N/A',            cls: 'yellow' },
    { label: 'Est. FPS',      val: fpsHint,                                             cls: ''       },
    { label: 'HD Stream',     val: isHD ? 'Tersedia ✓' : 'Tidak Tersedia ✗', cls: isHD ? 'green' : '', style: isHD ? '' : 'color:#f87171' },
    { label: 'File Size',     val: fmtSize(d.size),                                    cls: ''       },
    { label: 'HD File Size',  val: fmtSize(d.hd_size),                                 cls: ''       },
    { label: 'Likes',         val: d.digg_count    ? Number(d.digg_count).toLocaleString()    : 'N/A', cls: 'accent' },
    { label: 'Views',         val: d.play_count    ? Number(d.play_count).toLocaleString()    : 'N/A', cls: 'accent' },
    { label: 'Comments',      val: d.comment_count ? Number(d.comment_count).toLocaleString() : 'N/A', cls: '' },
    { label: 'Shares',        val: d.share_count   ? Number(d.share_count).toLocaleString()   : 'N/A', cls: '' },
  ];

  metaGrid.innerHTML = items.map(function(it) {
    var extraStyle = it.style || '';
    return '<div class="meta-item">'
      + '<div class="meta-label">' + it.label + '</div>'
      + '<div class="meta-val ' + it.cls + '" style="' + extraStyle + '">' + it.val + '</div>'
      + '</div>';
  }).join('');

  results.classList.add('show');
}

// ─── Bind enter key ───
document.addEventListener('DOMContentLoaded', function(){
  var inp = document.getElementById('tiktokUrlInput');
  if (inp) inp.addEventListener('keydown', function(e){ if(e.key==='Enter') analyzeTikTok(); });
  var btn = document.getElementById('analyzeBtn');
  if (btn) btn.addEventListener('click', analyzeTikTok);
});
