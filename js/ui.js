/* ══════════════════════════════════════
   ui.js — reyy tools (2026 SaaS Updates)
   FIXED: Duplikat fungsi dengan main.js sudah dihapus.
   File ini HANYA handle UI murni: splash, observer,
   counter animation, dan lazy-load AI engines.
   ══════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Hide splash screen
  setTimeout(() => {
    const splash = document.getElementById('welcomeOverlay');
    if (splash) {
      splash.style.opacity = '0';
      setTimeout(() => splash.remove(), 500);
    }
  }, 1000);

  // 2. Intersection Observer for Scroll Animations
  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.15
  };

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        if (entry.target.classList.contains('stats-section')) {
          animateCounters();
        }
        obs.unobserve(entry.target);
      }
    });
  }, observerOptions);

  document.querySelectorAll('.fade-up, .fade-left, .fade-right').forEach(el => {
    observer.observe(el);
  });

  // 3. Mobile Hamburger Logic
  const hamburger = document.getElementById('burger');
  const navLinks = document.getElementById('navLinks');
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      navLinks.classList.toggle('open');
    });
  }

  // 4. Lazy-load AI Engines on first interaction
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

/* ── Counter Animation ── */
let countersAnimated = false;
function animateCounters() {
  if (countersAnimated) return;
  countersAnimated = true;

  const counters = document.querySelectorAll('.stat-num');
  counters.forEach(counter => {
    const target = +counter.getAttribute('data-target');
    const duration = 2000;
    const increment = target / (duration / 16);

    let current = 0;
    const updateCounter = () => {
      current += increment;
      if (current < target) {
        counter.innerText = Math.ceil(current).toLocaleString();
        requestAnimationFrame(updateCounter);
      } else {
        counter.innerText = target.toLocaleString() + (target === 99 ? '%' : '+');
      }
    };
    updateCounter();
  });
}

/* ── Load AI Engines ── */
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