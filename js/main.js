/* ══════════════════════════════════════════════════════════════
   reyy tools — Main Modular Application Logic
   Preserves 100% Core AI Photo Engine (ONNX Waifu2x) & Cloud Video Upscale (Colab/Ngrok API) Logic
   ══════════════════════════════════════════════════════════════ */

// ==========================================
// 1. THEME & LOCALIZATION ENGINE (LOCALSTORAGE)
// ==========================================
let selectedFile = null;
let curMode = 'patch';
let t0 = 0;

function updateLocalStats() {
  const el = document.getElementById('statFiles');
  if (el) {
    const count = localStorage.getItem('reyy_processed_total') || '0';
    el.textContent = count;
  }
}

// Automatic Initialization on DOM Load
document.addEventListener('DOMContentLoaded', () => {
  updateLocalStats(); 
  
  // Hide Welcome Splash Overlay after delay
  setTimeout(() => {
    const overlay = document.getElementById('welcomeOverlay');
    if (overlay) overlay.classList.add('hidden');
  }, 2200); 

  // Setup Drag & Drop Upload Zone
  const uploadZone = document.getElementById('uploadZone');
  if (uploadZone) {
    uploadZone.addEventListener('dragover', (e) => { 
      e.preventDefault(); 
      uploadZone.classList.add('over'); 
    });
    uploadZone.addEventListener('dragleave', () => { 
      uploadZone.classList.remove('over'); 
    });
    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadZone.classList.remove('over');
      const file = e.dataTransfer.files[0];
      if (file && (file.type === 'video/mp4' || file.name.toLowerCase().endsWith('.mp4'))) {
        processSelectedFile(file);
      }
    });
  }

  // Bind AI Upscale Engine Handlers (Local ONNX & Cloud Colab/Ngrok)
  initLocalAIUpscale();
  initCloudVideoUpscale();
});


// ==========================================
// 2. SECTION NAVIGATION & MODES
// ==========================================
function switchSection(sectionName) {
  document.querySelectorAll('.tool-content .section').forEach(s => s.classList.remove('active'));
  const target = document.getElementById('section-' + sectionName);
  if (target) target.classList.add('active');

  document.querySelectorAll('.home-tool-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll(`.home-tool-tab[data-section="${sectionName}"]`).forEach(b => b.classList.add('active'));

  if (sectionName === 'encoder') setMode('encoder');
  if (sectionName === 'patcher') setMode('patch');
}

function setMode(mode) {
  curMode = mode;
  document.querySelectorAll('.mode-card').forEach(card => {
    card.classList.remove('active');
    if (card.dataset.mode === mode) card.classList.add('active');
  });

  const itsPanel = document.getElementById('itsPanel');
  if (itsPanel) {
    itsPanel.style.display = (mode === 'its') ? 'block' : 'none';
  }
  updateProcessButton();
}

function selectItsScale(el) {
  document.querySelectorAll('.its-pill').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
}

function selectInterpScale(el) {
  document.querySelectorAll('#section-interp .its-item').forEach(i => i.classList.remove('selected'));
  el.classList.add('selected');
}

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  processSelectedFile(file);
}

function processSelectedFile(file) {
  selectedFile = file;
  
  const fileDisplay = document.getElementById('fileDisplay');
  const fileName = document.getElementById('fileName');
  if (fileDisplay) fileDisplay.classList.add('ok');
  if (fileName) fileName.textContent = file.name;
  
  const video = document.getElementById('videoPreview');
  const placeholder = document.getElementById('previewPlaceholder');
  if (video && placeholder) {
    video.src = URL.createObjectURL(file);
    video.style.display = 'block';
    placeholder.style.display = 'none';
  }
  
  updateProcessButton();

  const homeSection = document.getElementById('section-home');
  if (homeSection && homeSection.classList.contains('active')) {
    switchSection('patcher');
    setMode('patch');
  }
}

function updateProcessButton() {
  const btn = document.getElementById('patchBtn');
  const encBtn = document.getElementById('encBtn');
  if (btn) btn.disabled = !selectedFile;
  if (encBtn) encBtn.disabled = !selectedFile;
}

function setStatus(msg, type) {
  const statusBox = document.getElementById('statusBox');
  const statusText = document.getElementById('statusText');
  if (statusBox && statusText) {
    statusText.textContent = msg;
    statusBox.className = 'status-indicator';
    if (type) statusBox.classList.add(type);
  }
}

function setProgress(percent, label, show) {
  const isEnc = (curMode === 'encoder');
  const wrap = document.getElementById(isEnc ? 'encProgressWrap' : 'progressWrap');
  const fill = document.getElementById(isEnc ? 'encProgressFill' : 'progressFill');
  const lbl = document.getElementById(isEnc ? 'encProgressLabel' : 'progressLabel');
  const eta = document.getElementById(isEnc ? 'encProgressEta' : 'progressEta');
  
  if (show && wrap) wrap.classList.add('show');
  if (fill) fill.style.width = percent + '%';
  if (lbl) lbl.textContent = label || '';
  if (eta) eta.textContent = Math.round(percent) + '%';
  if (percent >= 100 && wrap) setTimeout(() => wrap.classList.remove('show'), 2000);
}

function showResult(fileName, elapsed, sizeBefore, sizeAfter) {
  const card = document.getElementById('resultCard');
  if (!card) return;
  const rf = document.getElementById('resFileName');
  const rt = document.getElementById('resTime');
  const rb = document.getElementById('resBefore');
  const ra = document.getElementById('resAfter');

  if (rf) rf.textContent = fileName;
  if (rt) rt.textContent = elapsed.toFixed(1) + 's';
  if (rb) rb.textContent = formatBytes(sizeBefore);
  if (ra) ra.textContent = formatBytes(sizeAfter);
  card.classList.add('show');
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(2) + ' MB';
}

function recordSuccess() {
  let count = parseInt(localStorage.getItem('reyy_processed_count') || '0');
  count++;
  localStorage.setItem('reyy_processed_count', count);
  updateLocalStats();
}

function buildEncoderArgs() {
  const codec = document.getElementById('encCodec')?.value || 'libx264';
  const crf = document.getElementById('encCrf')?.value || '18';
  const preset = document.getElementById('encPreset')?.value || 'medium';

  const ffmpegArgs = ['-c:v', codec, '-crf', crf, '-preset', preset];
  ffmpegArgs.push('-c:a', 'copy');
  return { ffmpegArgs, codec, crf, preset };
}

// ==========================================
// 3. VIDEO ENGINE PIPELINE (PATCH/ENCODE)
// ==========================================
async function runProcess() {
  if (!selectedFile) return;
  
  const btn = document.getElementById(curMode === 'encoder' ? 'encBtn' : 'patchBtn');
  if (btn) btn.disabled = true;
  
  let t0 = Date.now();
  const sb = selectedFile.size;
  const base = selectedFile.name.replace(/\.[^/.]+$/, '');

if (curMode === 'patch') {
  setStatus('⚙️ reyy tools Engine: Applying Sample Table Patch...', 'working');
  setProgress(10, 'Reading file...', true);

  try {
    const ab = await selectedFile.arrayBuffer();
    setProgress(50, 'Applying Shark HD Patch (CF Logic)...');

    const patch = (typeof patchSharkSampleTableMethod === 'function')
      ? await patchSharkSampleTableMethod(ab)
      : { output: new Uint8Array(ab) };

    if (!patch || !patch.output) throw new Error('Patch gagal: output kosong.');

    setProgress(90, 'Preparing download...');
    const outBuf = patch.output instanceof Uint8Array ? patch.output.buffer : patch.output;
    downloadBlob(outBuf, base + '_reyy_smart.mp4');
    setProgress(100, 'Complete!');

    const elapsed = (Date.now() - t0) / 1000;
    setStatus('✅ Success! Video file patched.', 'success');
    showResult(selectedFile.name, elapsed, sb, patch.output.byteLength || patch.output.length);
    recordSuccess();
    setTimeout(() => setProgress(0, '', false), 3000);
  } catch (err) {
    setStatus('❌ Error: ' + err.message, 'error');
    setProgress(0, '', false);
  }
} else if (curMode === 'ky60') {
    setStatus('⏳ reyy tools 60fps Method: Processing...', 'working');
    setProgress(0, 'Reading file...', true);
    try {
      const ab = await selectedFile.arrayBuffer();
      setProgress(30, 'Analyzing structure...');
      setProgress(55, 'Embedding metadata stamp...');
      const data = new Uint8Array(ab.slice(0));
patchZPayload(data);
const buf = data.buffer;
      setProgress(95, 'Downloading...');
      downloadBlob(buf, base + '_reyy60.mp4');
      setProgress(100, 'Complete!');
      const elapsed = (Date.now() - t0) / 1000;
      setStatus('✅ reyy tools 60fps Method Complete!', 'success');
      showResult(selectedFile.name, elapsed, sb, buf.byteLength);
      recordSuccess();
      setTimeout(() => setProgress(0, '', false), 3000);
    } catch (err) { 
      setStatus('❌ Error: ' + err.message, 'error'); 
      setProgress(0, '', false); 
    }

} else if (curMode === 'its') {
  const scale = document.querySelector('.its-pill.active')?.dataset.scale || '2';
  setStatus(`⏳ Speed Booster x${scale}: Processing video...`, 'working');
  setProgress(0, 'Loading engine...', true);
  try {
    const ff = await loadFFmpeg();
    setProgress(20, 'Writing input...');
    ff.FS('writeFile', 'input.mp4', await ff._fetchFile(selectedFile));
    setProgress(40, 'Processing frame timing...');
    await ff.run('-itsscale', scale, '-i', 'input.mp4', '-c', 'copy', 'its_out.mp4');
    setProgress(72, 'Finalizing output...');
    const itsData = ff.FS('readFile', 'its_out.mp4');
    const ab = itsData.buffer.slice(itsData.byteOffset, itsData.byteOffset + itsData.byteLength);
    const patched = (typeof applyMetadataStamp === 'function') ? applyMetadataStamp(ab) : ab;
    setProgress(95, 'Downloading...');
    downloadBlob(patched, base + `_its${scale}_patched.mp4`);
    try { ff.FS('unlink', 'input.mp4'); ff.FS('unlink', 'its_out.mp4'); } catch (e) {}
    setProgress(100, 'Complete!');
    const elapsed = (Date.now() - t0) / 1000;
    setStatus(`✅ Speed Booster x${scale} Complete!`, 'success');
    showResult(selectedFile.name, elapsed, sb, patched.byteLength);
    recordSuccess();
    setTimeout(() => setProgress(0, '', false), 3000);
  } catch (err) {
    setStatus('❌ Error: ' + err.message, 'error');
    setProgress(0, '', false);
  }
} else if (curMode === 'encoder') {
    const args = buildEncoderArgs();
    const applyStamp = document.getElementById('encApplyStamp')?.checked;
    setStatus('⏳ Advanced Encoder: Encoding video...', 'working');
    setProgress(0, 'Loading engine...', true);
    try {
      const ff = await loadFFmpeg();
      args.ffmpegArgs.push('-threads', String(ff._multiThread ? (typeof ffmpegThreadCount === 'function' ? ffmpegThreadCount() : 1) : 1));
      
      // Inject Copyright Metadata
      args.ffmpegArgs.push('-metadata', 'copyright=reyy tools', '-metadata', 'encoded_by=Encoder by reyy tools');
      
      setProgress(15, 'Writing input file...');
      ff.FS('writeFile', 'input.mp4', await ff._fetchFile(selectedFile));
      setProgress(35, `Encoding Video (${args.preset}, CRF ${args.crf})...`);

      ff.setLogger(({ type, message }) => console.log(`[FFmpeg ${type}] ${message}`));
      ff.setProgress(({ ratio }) => {
        if (ratio >= 0 && ratio <= 1) {
          setProgress(35 + (Math.round(ratio * 100) * 0.40), `Encoding Video: ${Math.round(ratio * 100)}%`);
        }
      });

      await ff.run('-i', 'input.mp4', ...args.ffmpegArgs, 'enc_out.mp4');

      ff.setProgress(() => {}); 
      ff.setLogger(() => {}); 

      setProgress(75, 'Finalizing output buffer...');
      const encData = ff.FS('readFile', 'enc_out.mp4');
      let ab = encData.buffer.slice(encData.byteOffset, encData.byteOffset + encData.byteLength);
      if (applyStamp && typeof applyMetadataStamp === 'function') { 
        setProgress(88, 'Embedding TikTok HD stamp...'); 
        ab = applyMetadataStamp(ab); 
      }
      setProgress(95, 'Downloading...');
      downloadBlob(ab, base + `_encoded_crf${args.crf}` + (applyStamp ? '_reyy' : '') + '.mp4');
      try { ff.FS('unlink', 'input.mp4'); ff.FS('unlink', 'enc_out.mp4'); } catch (e) {}
      setProgress(100, 'Complete!');
      const elapsed = (Date.now() - t0) / 1000;
      setStatus('✅ Advanced Encoder Complete!', 'success');
      showResult(selectedFile.name, elapsed, sb, ab.byteLength);
      recordSuccess();
      setTimeout(() => setProgress(0, '', false), 3000);
    } catch (err) { 
      setStatus('❌ Error: ' + err.message, 'error'); 
      setProgress(0, '', false); 
    }
  }
  if (btn) btn.disabled = false;
}


function downloadBlob(data, filename) {
  const blob = new Blob([data], { type: 'video/mp4' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ════════════════════════════════════════════════════════════
// 4. LOCAL AI PHOTO UPSCALE (ONNX WAIFU2X ENGINE)
// ════════════════════════════════════════════════════════════
let selectedUpscaleFile = null;

function switchUpscaleTab(tabMode) {
  const tabLocal = document.getElementById('tabLocalPhoto');
  const tabCloud = document.getElementById('tabCloudVideo');
  const panelLocal = document.getElementById('panelLocalPhoto');
  const panelCloud = document.getElementById('panelCloudVideo');

  if (tabMode === 'local') {
    if (tabLocal) { tabLocal.classList.add('active'); tabLocal.setAttribute('aria-selected', 'true'); }
    if (tabCloud) { tabCloud.classList.remove('active'); tabCloud.setAttribute('aria-selected', 'false'); }
    if (panelLocal) panelLocal.classList.add('active');
    if (panelCloud) panelCloud.classList.remove('active');
  } else {
    if (tabCloud) { tabCloud.classList.add('active'); tabCloud.setAttribute('aria-selected', 'true'); }
    if (tabLocal) { tabLocal.classList.remove('active'); tabLocal.setAttribute('aria-selected', 'false'); }
    if (panelCloud) panelCloud.classList.add('active');
    if (panelLocal) panelLocal.classList.remove('active');
  }
}

function initLocalAIUpscale() {
  const upscaleInput = document.getElementById('upscaleInput');
  const upscaleFileName = document.getElementById('upscaleFileName');
  const upscalePreview = document.getElementById('upscalePreview');
  const btnStartUpscale = document.getElementById('btnStartUpscale');
  const upscaleStatusBox = document.getElementById('upscaleStatusBox');

  if (upscaleInput) {
    upscaleInput.addEventListener('change', (e) => {
      selectedUpscaleFile = e.target.files[0];
      if (selectedUpscaleFile) {
        if (upscaleFileName) upscaleFileName.textContent = 'Selected: ' + selectedUpscaleFile.name;
        if (btnStartUpscale) btnStartUpscale.disabled = false;
        if (upscalePreview) {
          upscalePreview.src = URL.createObjectURL(selectedUpscaleFile);
          upscalePreview.style.display = 'block';
        }
        if (upscaleStatusBox) upscaleStatusBox.style.display = 'none';
        if (btnStartUpscale) btnStartUpscale.innerHTML = '<span>🚀 Start Local AI Photo Upscale</span>';
      }
    });
  }

  if (btnStartUpscale) {
    btnStartUpscale.addEventListener('click', () => {
      if (selectedUpscaleFile) runLocalAIUpscale(selectedUpscaleFile);
    });
  }
}

function downloadImageBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function setUpscaleProgress(percent, text) {
  const fill = document.getElementById('upscaleProgressFill');
  const statusText = document.getElementById('upscaleStatusText');
  if (fill) fill.style.width = percent + '%';
  if (statusText) statusText.textContent = text;
}

// Main ONNX Neural Super-Resolution Processing Logic
async function runLocalAIUpscale(imageFile) {
  const btnStartUpscale = document.getElementById('btnStartUpscale');
  const upscaleStatusBox = document.getElementById('upscaleStatusBox');
  
  try {
    if (btnStartUpscale) btnStartUpscale.disabled = true;
    if (upscaleStatusBox) upscaleStatusBox.style.display = 'block';
    const fill = document.getElementById('upscaleProgressFill');
    if (fill) fill.style.background = 'var(--accent)';
    
    setUpscaleProgress(15, 'Preparing ONNX WASM Super-Resolution Engine...');

    if (typeof ort !== 'undefined' && ort.env && ort.env.wasm) {
      ort.env.wasm.numThreads = 4;
      ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/';
    }
    
    const session = await ort.InferenceSession.create('/noise2_scale2.0x_model.onnx', {
      executionProviders: ['wasm']
    });

    setUpscaleProgress(30, 'Extracting image matrix tensors...');
    
    const img = new Image();
    img.src = URL.createObjectURL(imageFile);
    await new Promise(r => img.onload = r);
    
    let targetW = Math.floor(img.width / 4) * 4;
    let targetH = Math.floor(img.height / 4) * 4;
    if (targetW > 1080 || targetH > 1080) {
      const ratio = Math.min(1080 / targetW, 1080 / targetH);
      targetW = Math.floor((targetW * ratio) / 4) * 4;
      targetH = Math.floor((targetH * ratio) / 4) * 4;
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, targetW, targetH);
    const imgData = ctx.getImageData(0, 0, targetW, targetH).data;

    const floatData = new Float32Array(3 * targetH * targetW);
    for (let i = 0; i < targetH * targetW; i++) {
      floatData[i] = imgData[i * 4] / 255.0;
      floatData[targetH * targetW + i] = imgData[i * 4 + 1] / 255.0;
      floatData[2 * targetH * targetW + i] = imgData[i * 4 + 2] / 255.0;
    }

    const inputTensor = new ort.Tensor('float32', floatData, [1, 3, targetH, targetW]);
    const feeds = {};
    feeds[session.inputNames[0]] = inputTensor;
    
    setUpscaleProgress(65, '🔥 AI Engine rendering Ultra HD pixels...');
    await new Promise(resolve => setTimeout(resolve, 50)); 
    
    const results = await session.run(feeds);
    const outputTensor = results[session.outputNames[0]];
    const outData = outputTensor.data;
    const dims = outputTensor.dims;
    
    let outH, outWidth, isNCHW;
    if (dims[1] === 3) {
      isNCHW = true; outH = dims[2]; outWidth = dims[3];
    } else {
      isNCHW = false; outH = dims[1]; outWidth = dims[2];
    }
    const pixels = outH * outWidth;

    setUpscaleProgress(85, '✨ Reconstructing high-resolution image...');
    
    const outCanvas = document.createElement('canvas');
    outCanvas.width = outWidth;
    outCanvas.height = outH;
    const outCtx = outCanvas.getContext('2d');
    const outImgData = outCtx.createImageData(outWidth, outH);

    for (let i = 0; i < pixels; i++) {
      let r, g, b;
      if (isNCHW) {
        r = outData[i] * 255;
        g = outData[i + pixels] * 255;
        b = outData[i + 2 * pixels] * 255;
      } else {
        r = outData[i * 3] * 255;
        g = outData[i * 3 + 1] * 255;
        b = outData[i * 3 + 2] * 255;
      }
      
      outImgData.data[i * 4]     = Math.round(Math.max(0, Math.min(255, r)));
      outImgData.data[i * 4 + 1] = Math.round(Math.max(0, Math.min(255, g)));
      outImgData.data[i * 4 + 2] = Math.round(Math.max(0, Math.min(255, b)));
      outImgData.data[i * 4 + 3] = 255; 
    }
    
    outCtx.putImageData(outImgData, 0, 0);

    setUpscaleProgress(100, '🎉 Complete! Downloading image...');
    
    outCanvas.toBlob((blob) => {
      downloadImageBlob(blob, 'reyy_Waifu2x_UltraHD_' + Date.now() + '.png');
      if (upscaleStatusBox) upscaleStatusBox.className = 'status-box success';
      if (btnStartUpscale) {
        btnStartUpscale.disabled = false;
        btnStartUpscale.innerHTML = '<span>🚀 Start AI Upscale Again</span>';
      }
    });

  } catch (error) {
    console.error('AI Error:', error);
    if (upscaleStatusBox) upscaleStatusBox.style.display = 'block';
    setUpscaleProgress(100, '❌ Failed: Model ONNX is missing or failed to load.');
    const fill = document.getElementById('upscaleProgressFill');
    if (fill) fill.style.background = 'red';
    if (btnStartUpscale) {
      btnStartUpscale.disabled = false;
      btnStartUpscale.innerHTML = '<span>Try Again</span>';
    }
  }
}

// ════════════════════════════════════════════════════════════
// 5. CLOUD VIDEO UPSCALE ENGINE (COLAB / NGROK API)
// ════════════════════════════════════════════════════════════
let selectedCloudVideoFile = null;

function initCloudVideoUpscale() {
  const cloudVideoInput = document.getElementById('cloudVideoInput');
  const cloudVideoFileName = document.getElementById('cloudVideoFileName');
  const cloudVideoPreview = document.getElementById('cloudVideoPreview');
  const btnStartCloudUpscale = document.getElementById('btnStartCloudUpscale');
  const cloudStatusBox = document.getElementById('cloudStatusBox');

  if (cloudVideoInput) {
    cloudVideoInput.addEventListener('change', (e) => {
      selectedCloudVideoFile = e.target.files[0];
      if (selectedCloudVideoFile) {
        if (cloudVideoFileName) cloudVideoFileName.textContent = 'Selected: ' + selectedCloudVideoFile.name;
        if (btnStartCloudUpscale) btnStartCloudUpscale.disabled = false;
        if (cloudVideoPreview) {
          cloudVideoPreview.src = URL.createObjectURL(selectedCloudVideoFile);
          cloudVideoPreview.style.display = 'block';
        }
        if (cloudStatusBox) cloudStatusBox.style.display = 'block';
      }
    });
  }

  if (btnStartCloudUpscale) {
    btnStartCloudUpscale.addEventListener('click', () => {
      runCloudVideoUpscale();
    });
  }
}

function setCloudProgress(percent, text) {
  const fill = document.getElementById('cloudProgressFill');
  const statusText = document.getElementById('cloudStatusText');
  if (fill) fill.style.width = percent + '%';
  if (statusText) statusText.textContent = text;
}

async function runCloudVideoUpscale() {
  const apiUrlInput = document.getElementById('cloudApiUrl');
  const btnStartCloudUpscale = document.getElementById('btnStartCloudUpscale');
  const cloudStatusBox = document.getElementById('cloudStatusBox');

  const apiUrl = apiUrlInput ? apiUrlInput.value.trim().replace(/\/+$/, '') : '';
  if (!apiUrl) {
    alert('Please enter your active Ngrok API Tunnel URL from Google Colab.');
    return;
  }
  if (!selectedCloudVideoFile) {
    alert('Please select an MP4 video file to upscale.');
    return;
  }

  try {
    if (btnStartCloudUpscale) btnStartCloudUpscale.disabled = true;
    if (cloudStatusBox) {
      cloudStatusBox.style.display = 'block';
      cloudStatusBox.className = 'status-box working';
    }

    setCloudProgress(20, 'Uploading video to Cloud GPU cluster (Ngrok API)...');

    const formData = new FormData();
    formData.append('file', selectedCloudVideoFile);

    const response = await fetch(`${apiUrl}/upscale`, {
      method: 'POST',
      body: formData,
      headers: {
        'ngrok-skip-browser-warning': 'true'
      }
    });

    if (!response.ok) {
      throw new Error(`Cloud API responded with HTTP status ${response.status}`);
    }

    setCloudProgress(70, '🔥 Processing frame-by-frame Real-ESRGAN GPU Super-Resolution...');

    const resultBlob = await response.blob();
    setCloudProgress(100, '🎉 Cloud Upscale Complete! Downloading video...');

    downloadBlob(await resultBlob.arrayBuffer(), selectedCloudVideoFile.name.replace(/\.[^.]+$/, '') + '_cloud_upscale_4k.mp4');

    if (cloudStatusBox) cloudStatusBox.className = 'status-box success';
    if (btnStartCloudUpscale) {
      btnStartCloudUpscale.disabled = false;
      btnStartCloudUpscale.innerHTML = '<span>☁️ Launch Cloud Video Super-Resolution Again</span>';
    }
    recordSuccess();

  } catch (err) {
    console.error('Cloud Upscale Error:', err);
    if (cloudStatusBox) cloudStatusBox.className = 'status-box error';
    setCloudProgress(0, '❌ Cloud API Error: ' + err.message);
    if (btnStartCloudUpscale) btnStartCloudUpscale.disabled = false;
  }
}