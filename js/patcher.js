/* ══════════════════════════════════════
   patcher.js — reyy tools  (v6.2)
   The actual byte-level MP4 manipulation. Depends on atom-utils.js.

   FIX v6.2:
   - patchZPayload() sekarang pakai parseBoxes + findTopLevel,
     bukan raw 4-byte scan (yang bisa nemu "mdat" palsu di payload).
   - applyMetadataStamp() diperjelas urutan operasinya.
   - patchSharkSampleTableMethod() dibersihin dari legacy reference.
   ══════════════════════════════════════ */

/* ── Z-Payload: 0x5A-fill a small window right after mdat content starts ── */
function patchZPayload(data) {
  // FIX v6.2: pakai parser box, bukan raw byte scan
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const top = parseBoxes(data, view);
  const mdat = findTopLevel(top, 'mdat');
  if (!mdat) {
    throw new Error('Struktur video tidak valid. Pastikan file MP4 tidak corrupt.');
  }
  const zt = mdat.contentStart + 2;
  const limit = Math.min(zt + 128, data.length);
  for (let i = zt; i < limit; i++) {
    data[i] = 0x5A;
  }
  return true;
}

/* ── Rewrite an existing "Lavf..." encoder string to a target version ── */
function patchEncoderStr(data) {
  const enc = new TextEncoder();
  const lavf = enc.encode('Lavf');
  const target = enc.encode('Lavf59.16.100');
  for (let i = 0; i <= data.length - 16; i++) {
    if (
      data[i] === lavf[0] &&
      data[i + 1] === lavf[1] &&
      data[i + 2] === lavf[2] &&
      data[i + 3] === lavf[3]
    ) {
      if (data[i + 4] >= 0x30 && data[i + 4] <= 0x39) {
        let end = i + 4;
        while (end < data.length && data[end] >= 0x20 && data[end] < 0x7F) end++;
        const ol = end - i;
        for (let j = 0; j < ol; j++) {
          data[i + j] = j < target.length ? target[j] : 0x00;
        }
        return true;
      }
    }
  }
  return false;
}

/* ── Inject a custom "MTLib" freeform metadata atom under moov/udta ── */
function injectMTLib(origBuffer) {
  const enc = new TextEncoder();
  const origData = new Uint8Array(origBuffer);
  const origView = new DataView(origBuffer);

  const domain = enc.encode('com.apple.quicktime');
  const keyBytes = enc.encode('MTLib');
  const valBytes = enc.encode('PyPVGCodec');

  // mean box
  const meanBox = new Uint8Array(4 + 4 + 4 + domain.length);
  new DataView(meanBox.buffer).setUint32(0, meanBox.length, false);
  meanBox.set(enc.encode('mean'), 4);
  meanBox.set(domain, 12);

  // name box
  const nameBox = new Uint8Array(4 + 4 + 4 + keyBytes.length);
  new DataView(nameBox.buffer).setUint32(0, nameBox.length, false);
  nameBox.set(enc.encode('name'), 4);
  nameBox.set(keyBytes, 12);

  // data box
  const dataBox = new Uint8Array(4 + 4 + 4 + valBytes.length);
  const dataView = new DataView(dataBox.buffer);
  dataView.setUint32(0, dataBox.length, false);
  dataBox.set(enc.encode('data'), 4);
  dataView.setUint32(8, 1, false);
  dataBox.set(valBytes, 12);

  // ---- freeform (parent)
  const freeformSize = 4 + 4 + meanBox.length + nameBox.length + dataBox.length;
  const freeform = new Uint8Array(freeformSize);
  const ffView = new DataView(freeform.buffer);
  ffView.setUint32(0, freeformSize, false);
  freeform.set(enc.encode('----'), 4);
  let pos = 8;
  freeform.set(meanBox, pos); pos += meanBox.length;
  freeform.set(nameBox, pos); pos += nameBox.length;
  freeform.set(dataBox, pos);

  // ---- find moov
  let moovPos = -1;
  let moovSz = 0;
  pos = 0;
  while (pos + 8 <= origData.length) {
    const sz = origView.getUint32(pos, false);
    const t = String.fromCharCode(
      origData[pos + 4], origData[pos + 5], origData[pos + 6], origData[pos + 7]
    );
    if (t === 'moov') { moovPos = pos; moovSz = sz; break; }
    if (sz < 8) break;
    pos += sz;
  }
  if (moovPos === -1) return { buffer: origBuffer, injected: false };

  // ---- find udta inside moov
  let udtaPos = -1;
  let udtaSz = 0;
  pos = moovPos + 8;
  const moovEnd = moovPos + moovSz;
  while (pos + 8 <= moovEnd) {
    const sz = origView.getUint32(pos, false);
    const t = String.fromCharCode(
      origData[pos + 4], origData[pos + 5], origData[pos + 6], origData[pos + 7]
    );
    if (t === 'udta') { udtaPos = pos; udtaSz = sz; break; }
    if (sz < 8) break;
    pos += sz;
  }

  let newBuf;
  if (udtaPos !== -1) {
    // append freeform at end of udta
    const insertAt = udtaPos + udtaSz;
    newBuf = new ArrayBuffer(origData.length + freeform.length);
    const nd = new Uint8Array(newBuf);
    const nv = new DataView(newBuf);
    nd.set(origData.subarray(0, insertAt));
    nd.set(freeform, insertAt);
    nd.set(origData.subarray(insertAt), insertAt + freeform.length);
    nv.setUint32(moovPos, moovSz + freeform.length, false);
    nv.setUint32(udtaPos, udtaSz + freeform.length, false);
  } else {
    // create new udta inside moov
    const udtaNew = new Uint8Array(8 + freeform.length);
    new DataView(udtaNew.buffer).setUint32(0, udtaNew.length, false);
    udtaNew.set(enc.encode('udta'), 4);
    udtaNew.set(freeform, 8);
    const insertAt = moovEnd;
    newBuf = new ArrayBuffer(origData.length + udtaNew.length);
    const nd = new Uint8Array(newBuf);
    const nv = new DataView(newBuf);
    nd.set(origData.subarray(0, insertAt));
    nd.set(udtaNew, insertAt);
    nd.set(origData.subarray(insertAt), insertAt + udtaNew.length);
    nv.setUint32(moovPos, moovSz + udtaNew.length, false);
  }
  return { buffer: newBuf, injected: true };
}

/**
 * Z-Payload + MTLib + encoder-string stamp, as one step.
 * Returns the new ArrayBuffer.
 *
 * FIX v6.2: urutan operasi diperjelas:
 *   1. patchZPayload mutasi in-place (return diabaikan)
 *   2. injectMTLib bisa return buffer baru
 *   3. patchEncoderStr mutasi in-place di buffer final
 */
function applyMetadataStamp(arrayBuffer) {
  // Step 1: Z-fill mdat (mutasi in-place)
  patchZPayload(new Uint8Array(arrayBuffer));

  // Step 2: inject MTLib freeform atom (mungkin return buffer baru)
  let buf = arrayBuffer;
  const mt = injectMTLib(buf);
  if (mt.injected) buf = mt.buffer;

  // Step 3: rewrite encoder string (mutasi in-place di buffer final)
  patchEncoderStr(new Uint8Array(buf));

  return buf;
}

function applyreyyPatch(arrayBuffer, originalName) {
  const buf = applyMetadataStamp(arrayBuffer);
  downloadBlob(buf, originalName.replace(/\.[^/.]+$/, '') + '_patched.mp4');
  return buf.byteLength;
}

/* ══════════════════════════════════════
   MODE 2 — SHARK SAMPLE TABLE (via CF Worker)
   ══════════════════════════════════════ */

/* ── CF Worker URL ──────────────────────────────────────────── */
var _REYY_WORKER_URL = '/api/cf-worker';
var _reyyLoaded = false;
var _reyyLoading = null;

function _loadreyyPatcher() {
  if (_reyyLoaded && typeof window.kyPatchMP4 === 'function') {
    return Promise.resolve();
  }
  if (_reyyLoading) return _reyyLoading;

  _reyyLoading = fetch(_REYY_WORKER_URL, { cache: 'no-cache' })
    .then(function (r) { return r.text(); })
    .then(function (src) {
      var s = document.createElement('script');
      s.textContent = src;
      (document.head || document.documentElement).appendChild(s);
      _reyyLoaded = true;
      _reyyLoading = null;
    })
    .catch(function (e) {
      _reyyLoading = null;
      throw new Error('Gagal load reyy tools HD patcher: ' + e.message);
    });
  return _reyyLoading;
}

// Preload patcher saat file ini dimuat
_loadreyyPatcher().catch(function () {});

/**
 * Smart Patch (MODE 2) — pakai reyy tools HD dari CF Worker.
 * Return: Promise<{ output, realSamples, fakeSamples, audioFake }>
 */
function patchSharkSampleTableMethod(arrayBuffer) {
  return _loadreyyPatcher().then(function () {
    if (typeof window.kyPatchMP4 !== 'function') {
      throw new Error('reyy tools HD patcher tidak tersedia. Coba refresh.');
    }
    var result = window.kyPatchMP4(arrayBuffer);
    if (!result || !result.output) {
      throw new Error('Patch gagal: output kosong.');
    }
    return {
      output: result.output,
      realSamples: result.realSamples,
      fakeSamples: result.fakeSamples,
      audioFake: result.audioFake
    };
  });
}

/* ══════════════════════════════════════
   NOTES — legacy SHARK inline method dihapus.
   Semua logic patch sekarang via CF Worker (window.kyPatchMP4).
   File ini cuma jadi bridge + metadata stamper.
   ══════════════════════════════════════ */