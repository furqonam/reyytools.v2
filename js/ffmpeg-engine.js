/* ═══════════════════════════════════════════════════════════════════
   js/ffmpeg-engine.js — reyy tools v2.1
   ─────────────────────────────────────────────────────────────────
   FFmpeg.wasm lazy loader. Multi-thread enabled via crossOriginIsolated.

   CATATAN VERSI:
   - @ffmpeg/ffmpeg@0.11.x → @ffmpeg/core@0.11.0 (compatible)
   - core-mt cuma ada di 0.12.x (nggak kompatibel — jangan ganti)
   - Multi-thread di 0.11.x udah otomatis kalau crossOriginIsolated
   ═══════════════════════════════════════════════════════════════════ */

let ffmpegLoaded = false;
let ffmpegInst   = null;

/* ═══════════════════════════════════════════════════════════════
   THREAD COUNT
   Reserve 1 core for UI thread. Cap at 8.
   ═══════════════════════════════════════════════════════════════ */

function ffmpegThreadCount() {
  const cores = navigator.hardwareConcurrency || 4;
  return Math.max(1, Math.min(8, cores - 1));
}

/* ═══════════════════════════════════════════════════════════════
   LOAD FFMPEG (singleton)
   ═══════════════════════════════════════════════════════════════ */

async function loadFFmpeg() {
  if (ffmpegLoaded) return ffmpegInst;

  setStatus('⏳ Loading FFmpeg.wasm (sekali saja)...', 'working');
  setProgress(5, 'Loading FFmpeg...', true);

  const { createFFmpeg, fetchFile } = FFmpeg;

  const ff = createFFmpeg({
    log:      false,
    corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js'
  });

  await ff.load();

  ff._fetchFile   = fetchFile;
  ff._multiThread = window.crossOriginIsolated === true;

  ffmpegLoaded = true;
  ffmpegInst   = ff;

  return ff;
}