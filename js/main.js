// ==========================================
// 3. VIDEO ENGINE PIPELINE (PATCH/ENCODE)
// ==========================================
async function runProcess() {
  if (!selectedFile) return;

  const btn = document.getElementById(curMode === 'encoder' ? 'encBtn' : 'patchBtn');
  if (btn) btn.disabled = true;

  const t0 = Date.now();
  const sb = selectedFile.size;
  const base = selectedFile.name.replace(/\.[^/.]+$/, '');
  const patchType = document.getElementById('patchType')?.value || 'patch_only';

  // ═══════════════════════════════════════════
  // MODE 1: PATCH ONLY (Instant Metadata)
  // ═══════════════════════════════════════════
  if (curMode === 'patch' && patchType === 'patch_only') {
    setStatus('⚙️ SmartPatch: Applying Sample Table Patch...', 'working');
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
  }

  // ═══════════════════════════════════════════
  // MODE 2: ENCODE + PATCH (HD Optimization)
  // ═══════════════════════════════════════════
  else if (curMode === 'patch' && patchType === 'encode_patch') {
    setStatus('⏳ Encode + Patch: Re-encoding H.264...', 'working');
    setProgress(0, 'Loading FFmpeg engine...', true);

    try {
      const ff = await loadFFmpeg();
      setProgress(15, 'Writing input file...');
      ff.FS('writeFile', 'input.mp4', await ff._fetchFile(selectedFile));

      setProgress(35, 'Encoding H.264 (CRF 18, medium)...');
      ff.setLogger(({ type, message }) => console.log(`[FFmpeg ${type}] ${message}`));
      ff.setProgress(({ ratio }) => {
        if (ratio >= 0 && ratio <= 1) {
          setProgress(35 + (Math.round(ratio * 100) * 0.40), `Encoding H.264: ${Math.round(ratio * 100)}%`);
        }
      });

      await ff.run(
        '-i', 'input.mp4',
        '-c:v', 'libx264',
        '-crf', '18',
        '-preset', 'medium',
        '-c:a', 'copy',
        '-metadata', 'copyright=reyy tools',
        '-metadata', 'encoded_by=reyy tools encode+patch',
        'enc_out.mp4'
      );

      ff.setProgress(() => {});
      ff.setLogger(() => {});

      setProgress(75, 'Applying reyy metadata stamp...');
      const encData = ff.FS('readFile', 'enc_out.mp4');
      let ab = encData.buffer.slice(encData.byteOffset, encData.byteOffset + encData.byteLength);

      if (typeof applyMetadataStamp === 'function') {
        ab = applyMetadataStamp(ab);
      }

      setProgress(95, 'Downloading...');
      downloadBlob(ab, base + '_reyy_encoded.mp4');
      try { ff.FS('unlink', 'input.mp4'); ff.FS('unlink', 'enc_out.mp4'); } catch (e) {}

      setProgress(100, 'Complete!');
      const elapsed = (Date.now() - t0) / 1000;
      setStatus('✅ Encode + Patch Complete!', 'success');
      showResult(selectedFile.name, elapsed, sb, ab.byteLength);
      recordSuccess();
      setTimeout(() => setProgress(0, '', false), 3000);
    } catch (err) {
      setStatus('❌ Error: ' + err.message, 'error');
      setProgress(0, '', false);
    }
  }

  // ═══════════════════════════════════════════
  // MODE 3: KY60 (reyy 60fps Stamp)
  // ═══════════════════════════════════════════
  else if (curMode === 'ky60') {
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
  }

  // ═══════════════════════════════════════════
  // MODE 4: ITS (Speed Booster / Frame Timing)
  // ═══════════════════════════════════════════
  else if (curMode === 'its') {
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
  }

  // ═══════════════════════════════════════════
  // MODE 5: ENCODER TAB (Standalone Encoder)
  // ═══════════════════════════════════════════
  else if (curMode === 'encoder') {
    const args = buildEncoderArgs();
    const applyStamp = document.getElementById('encApplyStamp')?.checked;
    setStatus('⏳ Advanced Encoder: Encoding video...', 'working');
    setProgress(0, 'Loading engine...', true);
    try {
      const ff = await loadFFmpeg();
      args.ffmpegArgs.push('-threads', String(ff._multiThread ? (typeof ffmpegThreadCount === 'function' ? ffmpegThreadCount() : 1) : 1));
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