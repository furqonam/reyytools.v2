/* ══════════════════════════════════════
   ffmpeg-engine.js — v6.2
   FIX: setProgress pakai 3 argumen (show=true).
   ══════════════════════════════════════ */
let ffmpegLoaded = false, ffmpegInst = null;

function ffmpegThreadCount() {
  const cores = navigator.hardwareConcurrency || 4;
  return Math.max(1, Math.min(8, cores - 1));
}

async function loadFFmpeg() {
  if (ffmpegLoaded) return ffmpegInst;
  setStatus('⏳ Loading FFmpeg.wasm (sekali saja)...', 'working');
  setProgress(5, 'Loading FFmpeg...', true);   // ← FIX: tambah true
  const { createFFmpeg, fetchFile } = FFmpeg;
  const ff = createFFmpeg({
    log: false,
    corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js'
  });
  await ff.load();
  ff._fetchFile = fetchFile;
  ff._multiThread = window.crossOriginIsolated === true;
  ffmpegLoaded = true;
  ffmpegInst = ff;
  return ff;
}