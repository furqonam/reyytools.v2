/* ══════════════════════════════════════
   ui.js — reyy tools (2026 SaaS Updates)
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

  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        
        // If it's the stats section, animate the counters
        if (entry.target.classList.contains('stats-section')) {
          animateCounters();
        }
        
        // Optional: stop observing once animated
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  document.querySelectorAll('.fade-up, .fade-left, .fade-right').forEach(el => {
    observer.observe(el);
  });

  // 3. Mobile Hamburger Logic (App Workspace)
  const hamburger = document.getElementById('burger');
  const navLinks = document.getElementById('navLinks');
  
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      navLinks.classList.toggle('open');
    });
  }

  // Initialize AI Engines purely on interaction/scroll to achieve 100/100 PageSpeed
  const triggerAILoad = () => {
    loadAIEngines();
    window.removeEventListener('scroll', triggerAILoad);
    window.removeEventListener('mousemove', triggerAILoad);
    window.removeEventListener('touchstart', triggerAILoad);
  };
  window.addEventListener('scroll', triggerAILoad, { passive: true });
  window.addEventListener('mousemove', triggerAILoad, { passive: true });
  window.addEventListener('touchstart', triggerAILoad, { passive: true });

  // Initialize workspace to default tool (SmartPatch)
  if (typeof switchSection === 'function') {
    switchSection('patcher');
  }
});

/* ── Counter Animation ── */
let countersAnimated = false;
function animateCounters() {
  if (countersAnimated) return;
  countersAnimated = true;

  const counters = document.querySelectorAll('.stat-num');
  counters.forEach(counter => {
    const target = +counter.getAttribute('data-target');
    const duration = 2000; // 2 seconds
    const increment = target / (duration / 16); // 60fps

    let current = 0;
    const updateCounter = () => {
      current += increment;
      if (current < target) {
        // Format with commas
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

/* ── Workspace Section Switching ── */
function switchSection(sectionId) {
  document.querySelectorAll('.tool-content .section').forEach(sec => sec.classList.remove('active'));
  document.querySelectorAll('.tool-tabs .tool-tab').forEach(btn => btn.classList.remove('active'));
  
  const target = document.getElementById(`section-${sectionId}`);
  if (target) target.classList.add('active');
  
  document.querySelectorAll(`.tool-tabs .tool-tab[data-section="${sectionId}"]`).forEach(btn => btn.classList.add('active'));
}

/* ── Tool Modes (Patch, Ky60, Speed) ── */
function setMode(mode) {
  curMode = mode;
  document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('active'));
  const targetCard = document.querySelector(`.mode-card[data-mode="${mode}"]`);
  if (targetCard) targetCard.classList.add('active');

  const itsPanel = document.getElementById('itsPanel');
  if (itsPanel) itsPanel.style.display = (mode === 'its') ? 'block' : 'none';

  const patchBtn = document.getElementById('patchBtn');
  if(patchBtn) {
    patchBtn.disabled = !selectedFile;
    if(mode === 'its') patchBtn.innerText = currentLang === 'en' ? 'Start Frame Boosting' : 'Mulai Frame Boost';
    else if(mode === 'ky60') patchBtn.innerText = currentLang === 'en' ? 'Apply 60fps HD Stamp' : 'Terapkan Stamp 60fps HD';
    else patchBtn.innerText = currentLang === 'en' ? 'Start Smart Patch' : 'Mulai Smart Patch';
  }
}

function selectItsScale(el) {
  document.querySelectorAll('.its-pill').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
}

/* ── Upscale Tabs ── */
function switchUpscaleTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');

  document.getElementById('panelLocalPhoto').style.display = (tabId === 'local') ? 'block' : 'none';
  document.getElementById('panelCloudVideo').style.display = (tabId === 'cloud') ? 'block' : 'none';
}

/* ── File Selection & Drag Drop ── */
const dropZ = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');

if(dropZ && fileInput) {
  dropZ.addEventListener('dragover', e => { e.preventDefault(); dropZ.style.borderColor = 'var(--accent)'; dropZ.style.background = 'var(--accent-dim)'; });
  dropZ.addEventListener('dragleave', () => { dropZ.style.borderColor = 'var(--border)'; dropZ.style.background = 'transparent'; });
  dropZ.addEventListener('drop', e => { 
    e.preventDefault(); 
    dropZ.style.borderColor = 'var(--border)'; 
    dropZ.style.background = 'transparent';
    const f = e.dataTransfer.files[0]; 
    if (f) setFile(f); 
  });
}

function handleFileSelect(e) {
  if (e.target.files[0]) setFile(e.target.files[0]);
}

async function setFile(f) {
  selectedFile = f;
  const d = document.getElementById('fileName'); 
  if(d) {
    d.textContent = '📄 ' + f.name; 
    d.style.color = 'var(--accent)';
  }
  
  const patchBtn = document.getElementById('patchBtn');
  if(patchBtn) patchBtn.disabled = false;
  
  const encBtn = document.getElementById('encBtn');
  if(encBtn) encBtn.disabled = false;

  const status = document.getElementById('statusText');
  if(status) status.textContent = currentLang === 'en' ? 'File ready to process.' : 'File siap diproses.';
  
  const vid = document.getElementById('videoPreview');
  const ph = document.getElementById('previewPlaceholder');
  if(vid && ph) {
    vid.src = URL.createObjectURL(f); 
    vid.style.display = 'block'; 
    ph.style.display = 'none';
  }

  document.querySelectorAll('.upload-zone').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.preview-box').forEach(el => el.style.display = 'block');
}

/* ── Before/After Slider Logic ── */
function updateSlider(rangeId, thumbId, lineId, containerId) {
  const range = document.getElementById(rangeId);
  const thumb = document.getElementById(thumbId);
  const line = document.getElementById(lineId);
  const container = document.getElementById(containerId);
  
  if(range && thumb && line && container) {
    const val = range.value;
    const itemAfter = container.querySelector('.slider-after');
    if(itemAfter) itemAfter.style.clipPath = `polygon(0 0, ${val}% 0, ${val}% 100%, 0 100%)`;
    line.style.left = `${val}%`;
    thumb.style.left = `${val}%`;
  }
}

/* ── Status & Progress Overrides for main.js ── */
function setStatus(msg, type) {
  const t = document.getElementById('statusText');
  if (t) t.textContent = msg;
}

function setProgress(pct, label, show = true) {
  const wrap = document.getElementById('progressWrap');
  const fill = document.getElementById('progressFill');
  const lbl = document.getElementById('progressLabel');
  
  if(wrap) wrap.classList.toggle('show', show);
  if(fill) fill.style.width = pct + '%';
  if(lbl) lbl.textContent = label;
}

function showResult(fname, elapsed, sb, sa) {
  const fmt = n => (n / 1048576).toFixed(2) + ' MB';
  const c = document.getElementById('resultCard');
  if(c) c.classList.add('show');
  
  if(document.getElementById('resFileName')) document.getElementById('resFileName').textContent = fname;
  if(document.getElementById('resTime')) document.getElementById('resTime').textContent = elapsed.toFixed(1) + 's';
  if(document.getElementById('resBefore')) document.getElementById('resBefore').textContent = fmt(sb);
  if(document.getElementById('resAfter')) document.getElementById('resAfter').textContent = fmt(sa);
}