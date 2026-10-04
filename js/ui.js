/* ═══════════════════════════════════════════════════════════════════
   js/ui.js — reyy tools v2.1
   ─────────────────────────────────────────────────────────────────
   UI utilities: toast, tab switching, burger menu, FAQ accordion,
   splash screen, lazy-load AI engines, particles canvas.
   ═══════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════
   SECTION 1 — TOAST NOTIFICATION
   ═══════════════════════════════════════════════════════════════ */

function showToast(msg, dur) {
  const t = document.getElementById('reyyToast');
  if (!t) return;

  t.textContent = msg;
  t.classList.add('show');

  setTimeout(() => t.classList.remove('show'), dur || 2600);
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 2 — MAIN TAB SWITCHER (Bottom Nav + Navbar)
   ═══════════════════════════════════════════════════════════════ */

function switchMain(tab) {
  document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.mtab').forEach(b => b.classList.remove('active'));

  const page = document.getElementById('page-' + tab);
  const btn  = document.getElementById('mtab-' + tab);

  if (page) page.classList.add('active');
  if (btn)  btn.classList.add('active');

  window.scrollTo({ top: 0, behavior: 'instant' });
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 3 — BURGER MENU TOGGLE
   ═══════════════════════════════════════════════════════════════ */

function toggleMenu() {
  const nav = document.getElementById('navLinks');
  if (nav) nav.classList.toggle('open');
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 4 — FAQ ACCORDION TOGGLE
   ═══════════════════════════════════════════════════════════════ */

function toggleGrimoire(btn) {
  const item = btn.parentElement;
  item.classList.toggle('open');

  const icon = btn.querySelector('.grimoire-icon');
  if (icon) icon.textContent = item.classList.contains('open') ? '−' : '+';
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 5 — DOMContentLoaded: SPLASH + EVENT BINDINGS + LAZY LOAD
   ═══════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  /* ─── Hide splash ─── */
  setTimeout(() => {
    const splash = document.getElementById('welcomeOverlay');
    if (splash && splash.parentNode) {
      splash.style.opacity = '0';
      setTimeout(() => {
        if (splash.parentNode) splash.remove();
      }, 500);
    }
  }, 2500);

  /* ─── Burger menu ─── */
  const burger = document.getElementById('burger');
  if (burger) burger.addEventListener('click', toggleMenu);

  /* ─── Profile buttons ─── */
  const saveProfileBtn = document.getElementById('saveProfileBtn');
  if (saveProfileBtn) saveProfileBtn.addEventListener('click', saveProfile);

  const saveTelegramBtn = document.getElementById('saveTelegramBtn');
  if (saveTelegramBtn) saveTelegramBtn.addEventListener('click', saveTelegram);

  const unlinkTelegramBtn = document.getElementById('unlinkTelegramBtn');
  if (unlinkTelegramBtn) unlinkTelegramBtn.addEventListener('click', unlinkTelegram);

  /* ─── Analyze button (single binding — analyzer.js nggak bind lagi) ─── */
  const analyzeBtn = document.getElementById('analyzeBtn');
  if (analyzeBtn) analyzeBtn.addEventListener('click', analyzeTikTok);

  /* ─── Home tool tabs — visual active state ─── */
  document.querySelectorAll('.home-tool-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.home-tool-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  /* ─── Lazy-load AI Engines on first interaction ─── */
  const triggerAILoad = () => {
    loadAIEngines();
    window.removeEventListener('scroll',      triggerAILoad);
    window.removeEventListener('mousemove',   triggerAILoad);
    window.removeEventListener('touchstart',  triggerAILoad);
  };
  window.addEventListener('scroll',     triggerAILoad, { passive: true });
  window.addEventListener('mousemove',  triggerAILoad, { passive: true });
  window.addEventListener('touchstart', triggerAILoad, { passive: true });
});

/* ═══════════════════════════════════════════════════════════════
   SECTION 6 — LOAD AI ENGINES (FFmpeg + TensorFlow.js + ONNX)
   ═══════════════════════════════════════════════════════════════ */

let aiEnginesLoaded = false;

function loadAIEngines() {
  if (aiEnginesLoaded) return;
  aiEnginesLoaded = true;

  const scriptsToLoad = [
    'https://unpkg.com/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js',
    'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.21.0/dist/tf.min.js',
    'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.min.js'
  ];

  scriptsToLoad.forEach(src => {
    const script  = document.createElement('script');
    script.src    = src;
    script.defer  = true;
    document.body.appendChild(script);
  });

  console.log('reyy tools: AI Engines Loaded.');
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 7 — PARTICLES CANVAS (Ambient Background)
   ═══════════════════════════════════════════════════════════════ */

(function initParticles() {
  document.addEventListener('DOMContentLoaded', function () {
    const c = document.getElementById('reyyParticles');
    if (!c) return;

    const ctx = c.getContext('2d');
    let W, H;
    const particles = [];

    function resize() {
      W = c.width  = window.innerWidth;
      H = c.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    function Particle() {
      this.x   = Math.random() * W;
      this.y   = Math.random() * H;
      this.r   = 0.5 + Math.random() * 1.2;
      this.dx  = (Math.random() - 0.5) * 0.15;
      this.dy  = (Math.random() - 0.5) * 0.15;
      this.opa = 0.1 + Math.random() * 0.3;
    }

    Particle.prototype.update = function () {
      this.x += this.dx;
      this.y += this.dy;
      if (this.x < 0 || this.x > W || this.y < 0 || this.y > H) {
        this.x = Math.random() * W;
        this.y = Math.random() * H;
      }
    };

    Particle.prototype.draw = function () {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,217,255,' + this.opa + ')';
      ctx.fill();
    };

    for (let i = 0; i < 50; i++) particles.push(new Particle());

    (function loop() {
      ctx.clearRect(0, 0, W, H);
      particles.forEach(p => { p.update(); p.draw(); });
      requestAnimationFrame(loop);
    })();
  });
})();

console.log('[ui.js] UI utilities loaded ✓');