/* ═══════════════════════════════════════════════════════════════════
   js/patcher.js — reyy tools v2.1
   ─────────────────────────────────────────────────────────────────
   Byte-level MP4 manipulation: Z-Payload, encoder string patch,
   MTLib injection, and CF Worker lazy loader.
   ═══════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════
   SECTION 1 — Z-PAYLOAD
   Fill a small 0x5A window right after mdat starts.
   ═══════════════════════════════════════════════════════════════ */

function patchZPayload(data) {
  const mdatIdx = findRawAtomOffset(data, 'mdat');
  if (mdatIdx === -1) {
    throw new Error('Struktur video tidak valid. Pastikan file MP4 tidak corrupt.');
  }

  const zt = mdatIdx + 10;
  for (let i = 0; i < 128; i++) {
    if (zt + i < data.length) data[zt + i] = 0x5A;
  }
  return true;
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 2 — ENCODER STRING PATCH
   Rewrite existing "Lavf..." string to a target version.
   ═══════════════════════════════════════════════════════════════ */

function patchEncoderStr(data) {
  const enc    = new TextEncoder();
  const lavf   = enc.encode('Lavf');
  const target = enc.encode('Lavf59.16.100');

  for (let i = 0; i <= data.length - 16; i++) {
    if (data[i]     === lavf[0] &&
        data[i + 1] === lavf[1] &&
        data[i + 2] === lavf[2] &&
        data[i + 3] === lavf[3]) {

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

/* ═══════════════════════════════════════════════════════════════
   SECTION 3 — MTLIB INJECTION
   Inject custom "MTLib" freeform metadata atom under moov/udta.
   ═══════════════════════════════════════════════════════════════ */

function injectMTLib(origBuffer) {
  const enc      = new TextEncoder();
  const origData = new Uint8Array(origBuffer);
  const origView = new DataView(origBuffer);

  const domain   = enc.encode('com.apple.quicktime');
  const keyBytes = enc.encode('MTLib');
  const valBytes = enc.encode('PyPVGCodec');

  /* ─── Build freeform sub-boxes: mean + name + data ─── */
  const meanBox = new Uint8Array(4 + 4 + 4 + domain.length);
  new DataView(meanBox.buffer).setUint32(0, meanBox.length, false);
  meanBox.set(enc.encode('mean'), 4);
  meanBox.set(domain, 12);

  const nameBox = new Uint8Array(4 + 4 + 4 + keyBytes.length);
  new DataView(nameBox.buffer).setUint32(0, nameBox.length, false);
  nameBox.set(enc.encode('name'), 4);
  nameBox.set(keyBytes, 12);

  const dataBox  = new Uint8Array(4 + 4 + 4 + valBytes.length);
  const dataView = new DataView(dataBox.buffer);
  dataView.setUint32(0, dataBox.length, false);
  dataBox.set(enc.encode('data'), 4);
  dataView.setUint32(8, 1, false);
  dataBox.set(valBytes, 12);

  /* ─── Wrap in '----' freeform box ─── */
  const freeformSize = 4 + 4 + meanBox.length + nameBox.length + dataBox.length;
  const freeform     = new Uint8Array(freeformSize);
  const ffView       = new DataView(freeform.buffer);
  ffView.setUint32(0, freeformSize, false);
  freeform.set(enc.encode('----'), 4);

  let pos = 8;
  freeform.set(meanBox, pos); pos += meanBox.length;
  freeform.set(nameBox, pos); pos += nameBox.length;
  freeform.set(dataBox, pos);

  /* ─── Find moov box ─── */
  let moovPos = -1, moovSz = 0;
  pos = 0;
  while (pos + 8 <= origData.length) {
    const sz = origView.getUint32(pos, false);
    const t  = String.fromCharCode(origData[pos + 4], origData[pos + 5], origData[pos + 6], origData[pos + 7]);
    if (t === 'moov') { moovPos = pos; moovSz = sz; break; }
    if (sz < 8) break;
    pos += sz;
  }
  if (moovPos === -1) return { buffer: origBuffer, injected: false };

  /* ─── Find existing udta in moov ─── */
  let udtaPos = -1, udtaSz = 0;
  pos = moovPos + 8;
  const moovEnd = moovPos + moovSz;

  while (pos + 8 <= moovEnd) {
    const sz = origView.getUint32(pos, false);
    const t  = String.fromCharCode(origData[pos + 4], origData[pos + 5], origData[pos + 6], origData[pos + 7]);
    if (t === 'udta') { udtaPos = pos; udtaSz = sz; break; }
    if (sz < 8) break;
    pos += sz;
  }

  /* ─── Insert freeform ─── */
  let newBuf;
  if (udtaPos !== -1) {
    // Append inside existing udta
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
    // Create new udta containing freeform
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

/* ═══════════════════════════════════════════════════════════════
   SECTION 4 — METADATA STAMP (COMBINED)
   ═══════════════════════════════════════════════════════════════ */

function applyMetadataStamp(arrayBuffer) {
  let buf = arrayBuffer;

  const firstPass = new Uint8Array(buf);
  patchZPayload(firstPass);

  const mt = injectMTLib(buf);
  if (mt.injected) buf = mt.buffer;

  patchEncoderStr(new Uint8Array(buf));
  return buf;
}

function applyreyyPatch(arrayBuffer, originalName) {
  const buf = applyMetadataStamp(arrayBuffer);
  downloadBlob(buf, originalName.replace(/\.[^/.]+$/, '') + '_patched.mp4');
  return buf.byteLength;
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 5 — CF WORKER LAZY LOADER
   ═══════════════════════════════════════════════════════════════ */

var _REYY_WORKER_URL = '/api/cf-worker';
var _reyyLoaded      = false;
var _reyyLoading     = null;

function _loadreyyPatcher() {
  if (_reyyLoaded && typeof window.reyyPatchMP4 === 'function') return Promise.resolve();
  if (_reyyLoading) return _reyyLoading;

  _reyyLoading = fetch(_REYY_WORKER_URL, { cache: 'no-cache' })
    .then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    })
    .then(src => {
      const s     = document.createElement('script');
      s.textContent = src;
      (document.head || document.documentElement).appendChild(s);
      _reyyLoaded  = true;
      _reyyLoading = null;
    })
    .catch(e => {
      _reyyLoading = null;
      throw new Error('Gagal load reyy tools HD patcher: ' + e.message);
    });

  return _reyyLoading;
}

/* Preload di idle time */
if (typeof requestIdleCallback === 'function') {
  requestIdleCallback(() => _loadreyyPatcher().catch(() => {}));
} else {
  setTimeout(() => _loadreyyPatcher().catch(() => {}), 2000);
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 6 — SMART PATCH (SHARK SAMPLE TABLE)
   Pakai reyyPatchMP4 dari CF Worker.
   ═══════════════════════════════════════════════════════════════ */

function patchSharkSampleTableMethod(arrayBuffer) {
  return _loadreyyPatcher().then(() => {
    if (typeof window.reyyPatchMP4 !== 'function') {
      throw new Error('reyy tools HD patcher tidak tersedia. Coba refresh.');
    }

    const result = window.reyyPatchMP4(arrayBuffer);
    if (!result || !result.output) throw new Error('Patch gagal: output kosong.');

    return {
      output:      result.output,
      realSamples: result.realSamples,
      fakeSamples: result.fakeSamples,
      audioFake:   result.audioFake
    };
  });
}