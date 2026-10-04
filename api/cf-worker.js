/* ═══════════════════════════════════════════════════════════════════
   api/cf-worker.js
   Vercel Serverless Function — Serve CF Worker JS as text.
   v2.1 — Fix hdlr box spec + cleanup formatting.
   ═══════════════════════════════════════════════════════════════════ */

const CF_WORKER_SOURCE = `(function(){
  'use strict';

  /* ─── MP4 Container Boxes ─── */
  const CONTAINER_BOXES = new Set([
    'moov', 'trak', 'mdia', 'minf', 'stbl',
    'edts', 'dinf', 'udta', 'meta', 'ilst'
  ]);

  /* ─── Low-Level Helpers ─── */
  function u32(dv, o)         { return dv.getUint32(o, false); }
  function w32(dv, o, v)      { dv.setUint32(o, v >>> 0, false); }
  function fcc(arr, o)        { return String.fromCharCode(arr[o], arr[o+1], arr[o+2], arr[o+3]); }
  function setFcc(arr, o, s)  { for (let i = 0; i < 4; i++) arr[o + i] = s.charCodeAt(i); }

  function concat(arrays) {
    const total = arrays.reduce((s, a) => s + a.length, 0);
    const out   = new Uint8Array(total);
    let off = 0;
    for (const a of arrays) { out.set(a, off); off += a.length; }
    return out;
  }

  /* ─── Box Parser ─── */
  function parseBoxes(arr, dv, start, end) {
    const list = [];
    let off = start;
    while (off + 8 <= end) {
      let size = u32(dv, off);
      const type = fcc(arr, off + 4);
      let hdr = 8;

      if (size === 1) {
        size = u32(dv, off + 8) * 0x100000000 + u32(dv, off + 12);
        hdr = 16;
      } else if (size === 0) {
        size = end - off;
      }

      if (size < hdr || off + size > end) break;

      const cs  = off + hdr;
      const box = { type, off, size, hdr, cs, end: off + size, children: [] };

      if (CONTAINER_BOXES.has(type)) {
        const innerStart = (type === 'meta') ? cs + 4 : cs;
        box.children = parseBoxes(arr, dv, innerStart, box.end);
      }

      list.push(box);
      off += size;
    }
    return list;
  }

  function findBox(list, type)    { return list.find(b => b.type === type) || null; }
  function findPath(list, path) {
    let node = list, res = null;
    for (const p of path) {
      const b = findBox(node, p);
      if (!b) return null;
      res = b; node = b.children;
    }
    return res;
  }
  function rawOf(arr, box)        { return arr.slice(box.off, box.end); }

  /* ─── Box Rebuilder ─── */
  function rebuild(arr, box, repl) {
    if (repl.has(box)) return repl.get(box);
    if (!box.children.length) return rawOf(arr, box);

    const prefix = (box.type === 'meta') ? arr.slice(box.cs, box.cs + 4) : new Uint8Array(0);
    const parts  = [prefix];
    for (const c of box.children) parts.push(rebuild(arr, c, repl));

    const body = concat(parts);
    const out  = new Uint8Array(8 + body.length);
    const dv   = new DataView(out.buffer);
    w32(dv, 0, 8 + body.length);
    setFcc(out, 4, box.type);
    out.set(body, 8);
    return out;
  }

  /* ─── stco (Sample Table Chunk Offsets) ─── */
  function readStco(arr, dv, box) {
    const cnt = u32(dv, box.cs + 4);
    const out = [];
    for (let i = 0; i < cnt; i++) out.push(u32(dv, box.cs + 8 + i * 4));
    return out;
  }

  function buildStco(offsets, delta) {
    const body = new Uint8Array(4 + 4 + offsets.length * 4);
    const dv   = new DataView(body.buffer);
    dv.setUint32(4, offsets.length, false);
    let off = 8;
    for (const o of offsets) {
      dv.setUint32(off, (o + delta) >>> 0, false);
      off += 4;
    }
    const out  = new Uint8Array(8 + body.length);
    const odv  = new DataView(out.buffer);
    odv.setUint32(0, 8 + body.length, false);
    setFcc(out, 4, 'stco');
    out.set(body, 8);
    return out;
  }

  /* ─── mvhd (Movie Header) — rebuild with 64-bit duration ─── */
  function buildMvhd(arr, dv, box) {
    const v = arr[box.cs];
    if (v === 1) {
      const out = rawOf(arr, box).slice();
      const odv = new DataView(out.buffer);
      odv.setUint32(32, 0xFFFFFFFF, false);
      odv.setUint32(36, 0xFFFFFFFF, false);
      return out;
    }

    const ct      = u32(dv, box.cs + 4);
    const mt      = u32(dv, box.cs + 8);
    const ts      = u32(dv, box.cs + 12);
    const restSrc = box.cs + 20;
    const restLen = box.size - 8 - 20;
    const newSize = box.size + 12;

    const out = new Uint8Array(newSize);
    const odv = new DataView(out.buffer);
    odv.setUint32(0, newSize, false);
    setFcc(out, 4, 'mvhd');
    out[8] = 1; // version 1

    odv.setUint32(12, 0, false);
    odv.setUint32(16, ct, false);
    odv.setUint32(20, 0, false);
    odv.setUint32(24, mt, false);
    odv.setUint32(28, ts, false);
    odv.setUint32(32, 0xFFFFFFFF, false);
    odv.setUint32(36, 0xFFFFFFFF, false);
    out.set(arr.slice(restSrc, restSrc + restLen), 40);
    return out;
  }

  /* ─── Tag Box Builder (for udta/meta/ilst) ─── */
  function buildTagBox(fourcc, text) {
    const enc  = new TextEncoder();
    const tb   = enc.encode(text);
    const data = new Uint8Array(4 + 4 + 4 + 4 + tb.length);
    const ddv  = new DataView(data.buffer);

    ddv.setUint32(0, data.length, false);
    setFcc(data, 4, 'data');
    ddv.setUint32(8, 1, false);
    ddv.setUint32(12, 0, false);
    data.set(tb, 16);

    const box = new Uint8Array(4 + 4 + data.length);
    const bdv = new DataView(box.buffer);
    bdv.setUint32(0, box.length, false);
    setFcc(box, 4, fourcc);
    box.set(data, 8);
    return box;
  }

  /* ─── Proper hdlr Box (33 bytes minimum per ISO spec) ─── */
  function buildHdlrBox() {
    // Structure per ISO/IEC 14496-12:
    // size(4) + type(4) + version(1) + flags(3) + pre_defined(4)
    // + handler_type(4) + reserved(12) + name(variable, null-terminated)
    const bodyLen = 4 + 4 + 4 + 12 + 1;
    const body    = new Uint8Array(bodyLen);

    // version(1) + flags(3) — zeroed
    body[0] = 0; body[1] = 0; body[2] = 0; body[3] = 0;

    // pre_defined (4 bytes) — zeroed
    body[4] = 0; body[5] = 0; body[6] = 0; body[7] = 0;

    // handler_type = 'mdir' (metadata handler)
    body[8]  = 0x6d; // m
    body[9]  = 0x64; // d
    body[10] = 0x69; // i
    body[11] = 0x72; // r

    // reserved (4 bytes) — 'appl' (Apple ecosystem convention)
    body[12] = 0x61; // a
    body[13] = 0x70; // p
    body[14] = 0x70; // p
    body[15] = 0x6c; // l

    // reserved (8 bytes) — zeroed (offset 16-23)

    // name — null-terminated string (offset 24)
    body[24] = 0;

    const box = new Uint8Array(8 + bodyLen);
    const bdv = new DataView(box.buffer);
    bdv.setUint32(0, box.length, false);
    setFcc(box, 4, 'hdlr');
    box.set(body, 8);
    return box;
  }

  /* ─── Build Signature udta/meta/ilst ─── */
  function buildSignatureUdta() {
    const cpyTag = buildTagBox('\\xa9cpy', 'reyy tools');
    const encTag = buildTagBox('\\xa9enc', 'reyy tools upload');
    const tooTag = buildTagBox('\\xa9too', 'reyy tools | reyytools.my.id');

    // ilst
    const ilstBody = concat([cpyTag, encTag, tooTag]);
    const ilst     = new Uint8Array(8 + ilstBody.length);
    const idv      = new DataView(ilst.buffer);
    idv.setUint32(0, 8 + ilstBody.length, false);
    setFcc(ilst, 4, 'ilst');
    ilst.set(ilstBody, 8);

    // hdlr (proper spec)
    const hdlr = buildHdlrBox();

    // meta (fullbox — 4 bytes version/flags prefix)
    const metaBody = concat([new Uint8Array(4), hdlr, ilst]);
    const meta     = new Uint8Array(8 + metaBody.length);
    const mdv      = new DataView(meta.buffer);
    mdv.setUint32(0, 8 + metaBody.length, false);
    setFcc(meta, 4, 'meta');
    meta.set(metaBody, 8);

    // udta
    const udta = new Uint8Array(8 + meta.length);
    const udv  = new DataView(udta.buffer);
    udv.setUint32(0, 8 + meta.length, false);
    setFcc(udta, 4, 'udta');
    udta.set(meta, 8);

    return udta;
  }

  /* ═══════════════════════════════════════════════════════════════
     MAIN FUNCTION — reyyPatchMP4
     Rewrites MP4 structure: injects signature metadata + fixes
     stco offsets after moov insertion.
     ═══════════════════════════════════════════════════════════════ */
  function reyyPatchMP4(srcBuf) {
    const buf = srcBuf instanceof ArrayBuffer ? srcBuf : srcBuf.buffer;
    const arr = new Uint8Array(buf.slice(0));
    const dv  = new DataView(arr.buffer);

    const boxes   = parseBoxes(arr, dv, 0, arr.length);
    const ftypBox = findBox(boxes, 'ftyp');
    const moovBox = findBox(boxes, 'moov');
    const mdatBox = findBox(boxes, 'mdat');

    if (!moovBox) throw new Error('moov not found');
    if (!mdatBox) throw new Error('mdat not found');

    const repl = new Map();

    // Rebuild mvhd
    const mvhdBox = findBox(moovBox.children, 'mvhd');
    if (!mvhdBox) throw new Error('mvhd not found');
    repl.set(mvhdBox, buildMvhd(arr, dv, mvhdBox));

    // Collect all stco boxes
    const allStco = [];
    for (const trak of moovBox.children) {
      if (trak.type !== 'trak') continue;
      const s = findPath(trak.children, ['mdia', 'minf', 'stbl']);
      if (!s) continue;
      const co = findBox(s.children, 'stco');
      if (co) allStco.push(co);
    }

    // Inject signature udta
    const signatureUdta = buildSignatureUdta();
    const existingUdta  = findBox(moovBox.children, 'udta');
    if (existingUdta) {
      repl.set(existingUdta, signatureUdta);
    } else {
      repl.set('__appendUdta__', signatureUdta);
    }

    // Local rebuild helper (with udta append support)
    function rebuildMoov(arr, box, repl) {
      if (repl.has(box)) return repl.get(box);
      if (!box.children.length) return rawOf(arr, box);
      const prefix = (box.type === 'meta') ? arr.slice(box.cs, box.cs + 4) : new Uint8Array(0);
      const parts  = [prefix];
      for (const c of box.children) parts.push(rebuildMoov(arr, c, repl));
      if (box.type === 'moov' && repl.has('__appendUdta__')) {
        parts.push(repl.get('__appendUdta__'));
      }
      const body = concat(parts);
      const out  = new Uint8Array(8 + body.length);
      const odv  = new DataView(out.buffer);
      odv.setUint32(0, 8 + body.length, false);
      setFcc(out, 4, box.type);
      out.set(body, 8);
      return out;
    }

    // Pass 1 — build moov placeholder (delta=0)
    for (const co of allStco) repl.set(co, buildStco(readStco(arr, dv, co), 0));
    const ftypBytes = ftypBox ? rawOf(arr, ftypBox) : new Uint8Array(0);
    const moov1     = rebuildMoov(arr, moovBox, repl);

    // Cleanup append marker (prevent double-append)
    repl.delete('__appendUdta__');

    // Calculate delta
    const newMdatDataStart = ftypBytes.length + moov1.length + 8;
    const oldMdatDataStart = mdatBox.cs;
    const delta            = newMdatDataStart - oldMdatDataStart;

    // Pass 2 — rebuild with correct delta
    for (const co of allStco) repl.set(co, buildStco(readStco(arr, dv, co), delta));
    const moovFinal = rebuildMoov(arr, moovBox, repl);

    // Final assembly: ftyp + moov + mdat
    const mdatFull = rawOf(arr, mdatBox);
    const output   = concat([ftypBytes, moovFinal, mdatFull]);

    return { output: output.buffer, realSamples: 0, fakeSamples: 0 };
  }

  // Expose globally
  window.reyyPatchMP4 = reyyPatchMP4;
})();`;

/* ═══════════════════════════════════════════════════════════════
   VERCEL SERVERLESS HANDLER
   ═══════════════════════════════════════════════════════════════ */
module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.statusCode = 200;
  res.end(CF_WORKER_SOURCE);
};