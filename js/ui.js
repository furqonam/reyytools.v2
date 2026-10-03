/* ══════════════════════════════════════
   ui.js — reyy tools (2026 SaaS Updates)
   
   FIXED:
   - Hapus handler burger duplikat (udah ada onclick="toggleMenu()" di HTML)
   - Hapus observer class yang gak dipake (.fade-up, dll)
   - Hapus animateCounters (gak ada .stat-num di HTML)
   - Keep splash, lazy-load AI engines
   ══════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Hide splash screen (kalo belum di-hidden oleh main.js)
  setTimeout(() => {
    const splash = document.getElementById('welcomeOverlay');
    if (splash && splash.parentNode) {
      splash.style.opacity = '0';
      setTimeout(() => {
        if (splash.parentNode) splash.remove();
      }, 500);
    }
  }, 2500);

  // 2. Lazy-load AI Engines on first interaction
  const triggerAILoad = () => {
    loadAIEngines();
    window.removeEventListener('scroll', triggerAILoad);
    window.removeEventListener('mousemove', triggerAILoad);
    window.removeEventListener('touchstart', triggerAILoad);
  };
  window.addEventListener('scroll', triggerAILoad, { passive: true });
  window.addEventListener('mousemove', triggerAILoad, { passive: true });
  window.addEventListener('touchstart', triggerAILoad, { passive: true });
});

/* ── Load AI Engines (FFmpeg + TF.js + ONNX) ── */
let aiEnginesLoaded = false;
function loadAIEngines() {
  if (aiEnginesLoaded) return;
  aiEnginesLoaded = true;
  const scriptsToLoad = [
    "https://unpkg.com/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js",
    "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.21.0/dist/tf.min.js",
    "https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.min.js"
  ];
  scriptsToLoad.forEach(src => {
    const script = document.createElement('script');
    script.src = src;
    script.defer = true;
    document.body.appendChild(script);
  });
  console.log("reyy tools: AI Engines Loaded.");
}

/* ══════════════════════════════════════
   UI UTILITIES — v6.2 FIX
   Fungsi ini tadinya inline di index.html.
   Dipindahin ke sini biar bersih & modular.
   ══════════════════════════════════════ */

/* ─── Toast Notification ─── */
function showToast(msg, dur) {
  var t = document.getElementById('kyToast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(function(){ t.classList.remove('show'); }, dur || 2600);
}

/* ─── Switch Main Tab (bottom nav + navbar) ─── */
function switchMain(tab) {
  document.querySelectorAll('.page-view').forEach(function(p){ p.classList.remove('active'); });
  document.querySelectorAll('.mtab').forEach(function(b){ b.classList.remove('active'); });
  var page = document.getElementById('page-' + tab);
  var btn  = document.getElementById('mtab-' + tab);
  if (page) page.classList.add('active');
  if (btn)  btn.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'instant' });
}

/* ─── Burger Menu Toggle ─── */
function toggleMenu() {
  var nav = document.getElementById('navLinks');
  if (nav) nav.classList.toggle('open');
}

/* ─── FAQ Accordion Toggle ─── */
function toggleGrimoire(btn) {
  var item = btn.parentElement;
  item.classList.toggle('open');
  var icon = btn.querySelector('.grimoire-icon');
  if (icon) icon.textContent = item.classList.contains('open') ? '−' : '+';
}

/* ─── Home Tool Tabs (MAGIC PATCH / ENCODER / UPSCALE) ─── */
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.home-tool-tab').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.home-tool-tab').forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
    });
  });

  // Bind burger menu
  var burger = document.getElementById('burger');
  if (burger) burger.addEventListener('click', toggleMenu);

  // Bind profile buttons
  var saveProfileBtn = document.getElementById('saveProfileBtn');
  if (saveProfileBtn) saveProfileBtn.addEventListener('click', saveProfile);

  var saveTelegramBtn = document.getElementById('saveTelegramBtn');
  if (saveTelegramBtn) saveTelegramBtn.addEventListener('click', saveTelegram);

  var unlinkTelegramBtn = document.getElementById('unlinkTelegramBtn');
  if (unlinkTelegramBtn) unlinkTelegramBtn.addEventListener('click', unlinkTelegram);

  // Bind analyze button
  var analyzeBtn = document.getElementById('analyzeBtn');
  if (analyzeBtn) analyzeBtn.addEventListener('click', analyzeTikTok);
});

/* ─── Particles Canvas (ambient background) ─── */
(function initParticles(){
  document.addEventListener('DOMContentLoaded', function() {
    var c = document.getElementById('kyParticles');
    if (!c) return;
    var ctx = c.getContext('2d');
    var W, H, particles = [];
    function resize(){ W = c.width = window.innerWidth; H = c.height = window.innerHeight; }
    window.addEventListener('resize', resize); resize();
    function Particle(){
      this.x = Math.random()*W; this.y = Math.random()*H;
      this.r = 0.5 + Math.random()*1.2;
      this.dx = (Math.random()-.5)*.15; this.dy = (Math.random()-.5)*.15;
      this.opa = 0.1 + Math.random()*.3;
    }
    Particle.prototype.update = function(){
      this.x += this.dx; this.y += this.dy;
      if(this.x<0||this.x>W||this.y<0||this.y>H){ this.x=Math.random()*W; this.y=Math.random()*H; }
    };
    Particle.prototype.draw = function(){
      ctx.beginPath(); ctx.arc(this.x,this.y,this.r,0,Math.PI*2);
      ctx.fillStyle = 'rgba(0,217,255,'+this.opa+')';
      ctx.fill();
    };
    for(var i=0;i<50;i++) particles.push(new Particle());
    (function loop(){ ctx.clearRect(0,0,W,H); particles.forEach(function(p){p.update();p.draw();}); requestAnimationFrame(loop); })();
  });
})();

console.log('[ui.js] UI utilities loaded ✓');