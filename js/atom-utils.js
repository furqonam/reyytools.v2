/* ══════════════════════════════════════
   atom-utils.js — v6.2
   Shared low-level MP4 box/atom helpers.
   FIX: isFaststart pakai DataView yang benar.
   ══════════════════════════════════════ */

const CONTAINER_BOXES = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts', 'dinf', 'udta', 'meta', 'ilst']);

function looksLikeMp4(data) {
  if (data.length < 12) return false;
  const type = String.fromCharCode(data[4], data[5], data[6], data[7]);
  return type === 'ftyp' || type === 'moov' || type === 'mdat' || type === 'free' || type === 'wide';
}

function findRawAtomOffset(data, fourCC) {
  const c0 = fourCC.charCodeAt(0), c1 = fourCC.charCodeAt(1), c2 = fourCC.charCodeAt(2), c3 = fourCC.charCodeAt(3);
  for (let i = 0; i <= data.length - 4; i++) {
    if (data[i] === c0 && data[i + 1] === c1 && data[i + 2] === c2 && data[i + 3] === c3) return i;
  }
  return -1;
}

function getBoxType(data, offset) {
  return String.fromCharCode(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
}
function setBoxType(data, offset, type) {
  for (let i = 0; i < 4; i++) data[offset + i] = type.charCodeAt(i);
}
function assertUint32(value, label) {
  if (!Number.isFinite(value) || value < 0 || value > 0xffffffff) throw new Error(`${label} out of uint32: ${value}`);
}

function readBox(view, data, offset, end, parentPath = '') {
  if (offset + 8 > end) throw new Error('MP4 tidak valid: box tidak lengkap.');
  const smallSize = view.getUint32(offset, false), type = getBoxType(data, offset + 4);
  let size = smallSize, headerSize = 8;
  if (smallSize === 1) {
    if (offset + 16 > end) throw new Error(`MP4 tidak valid: box ${type} tidak lengkap.`);
    const high = view.getUint32(offset + 8, false), low = view.getUint32(offset + 12, false);
    size = high * 4294967296 + low; headerSize = 16;
  } else if (smallSize === 0) {
    size = end - offset;
  }
  if (size < headerSize || offset + size > end) throw new Error(`MP4 tidak valid: ukuran salah di box ${type}.`);
  return {
    type, offset, size, headerSize, contentStart: offset + headerSize, end: offset + size,
    path: parentPath ? `${parentPath}/${type}` : type, data, view, children: [],
    prefixStart: offset + headerSize, prefixEnd: offset + headerSize
  };
}
function childStartForBox(box) { return box.type === 'meta' ? box.contentStart + 4 : box.contentStart; }
function parseBoxes(data, view, start = 0, end = data.length, parentPath = '') {
  const boxes = []; let offset = start;
  while (offset + 8 <= end) {
    const box = readBox(view, data, offset, end, parentPath);
    if (CONTAINER_BOXES.has(box.type)) {
      const cs = childStartForBox(box);
      if (cs > box.end) throw new Error(`MP4 tidak valid: container ${box.type} terlalu kecil.`);
      box.prefixStart = box.contentStart; box.prefixEnd = cs;
      box.children = parseBoxes(data, view, cs, box.end, box.path);
    }
    boxes.push(box); offset = box.end;
  }
  return boxes;
}
function findChild(box, type) { return box.children.find(c => c.type === type) || null; }
function findDescendant(box, path) { let cur = box; for (const t of path) { cur = findChild(cur, t); if (!cur) return null; } return cur; }
function findTopLevel(boxes, type) { return boxes.find(b => b.type === type) || null; }
function handlerTypeForTrak(trak) {
  const hdlr = findDescendant(trak, ['mdia', 'hdlr']);
  if (!hdlr || hdlr.offset + 20 > hdlr.end) return null;
  return getBoxType(hdlr.data, hdlr.offset + 16);
}
function parseStsz(stsz) {
  const sampleSize = stsz.view.getUint32(stsz.offset + 12, false), count = stsz.view.getUint32(stsz.offset + 16, false);
  if (sampleSize) return new Array(count).fill(sampleSize);
  const ts = stsz.offset + 20;
  if (ts + count * 4 > stsz.end) throw new Error('MP4 tidak valid: stsz terlalu kecil.');
  const sizes = []; for (let i = 0; i < count; i++) sizes.push(stsz.view.getUint32(ts + i * 4, false));
  return sizes;
}
function parseStco(stco) {
  const count = stco.view.getUint32(stco.offset + 12, false), ts = stco.offset + 16;
  if (ts + count * 4 > stco.end) throw new Error('MP4 tidak valid: stco terlalu kecil.');
  const offsets = []; for (let i = 0; i < count; i++) offsets.push(stco.view.getUint32(ts + i * 4, false));
  return offsets;
}
function parseStsc(stsc) {
  const count = stsc.view.getUint32(stsc.offset + 12, false), ts = stsc.offset + 16;
  if (ts + count * 12 > stsc.end) throw new Error('MP4 tidak valid: stsc terlalu kecil.');
  const rows = [];
  for (let i = 0; i < count; i++) { const o = ts + i * 12; rows.push([stsc.view.getUint32(o, false), stsc.view.getUint32(o + 4, false), stsc.view.getUint32(o + 8, false)]); }
  return rows;
}
function makeBox(type, payload) {
  const size = 8 + payload.length; assertUint32(size, `${type}.size`);
  const box = new Uint8Array(size); const view = new DataView(box.buffer);
  view.setUint32(0, size, false); setBoxType(box, 4, type); box.set(payload, 8);
  return box;
}
function concatBytes(parts) {
  const total = parts.reduce((s, p) => s + p.length, 0); assertUint32(total, 'output_size');
  const out = new Uint8Array(total); let offset = 0;
  parts.forEach(p => { out.set(p, offset); offset += p.length; });
  return out;
}
function boxBytes(box) { return box.data.slice(box.offset, box.end); }
function boxPayload(box) { return box.data.slice(box.contentStart, box.end); }

/**
 * Cheap top-level scan to check if "moov" comes before "mdat" (faststart).
 * FIX: buat DataView langsung dari data.buffer + data.byteOffset.
 */
function isFaststart(data) {
  if (!data || data.length < 8) return false;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let o = 0;
  while (o + 8 <= data.length) {
    const sz = view.getUint32(o, false);
    const t = String.fromCharCode(data[o + 4], data[o + 5], data[o + 6], data[o + 7]);
    if (t === 'moov') return true;
    if (t === 'mdat') return false;
    if (sz < 8 || o + sz > data.length) break;
    o += sz;
  }
  return false;
}