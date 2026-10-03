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