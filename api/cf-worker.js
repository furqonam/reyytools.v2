// api/cf-worker.js
// Vercel serverless function — serve cf-worker JS as text
// Adapted for reyy tools

const CF_WORKER_SOURCE = `(function(){
  const CONTAINER_BOXES = new Set(['moov','trak','mdia','minf','stbl','edts','dinf','udta','meta','ilst']);

  function u32(dv,o){ return dv.getUint32(o,false); }
  function w32(dv,o,v){ dv.setUint32(o,v>>>0,false); }
  function fcc(arr,o){ return String.fromCharCode(arr[o],arr[o+1],arr[o+2],arr[o+3]); }
  function setFcc(arr,o,s){ for(let i=0;i<4;i++) arr[o+i]=s.charCodeAt(i); }

  function concat(arrays){
    const total=arrays.reduce((s,a)=>s+a.length,0);
    const out=new Uint8Array(total);
    let off=0;
    for(const a of arrays){ out.set(a,off); off+=a.length; }
    return out;
  }

  function parseBoxes(arr,dv,start,end){
    const list=[]; let off=start;
    while(off+8<=end){
      let size=u32(dv,off);
      const type=fcc(arr,off+4);
      let hdr=8;
      if(size===1){ size=u32(dv,off+8)*0x100000000+u32(dv,off+12); hdr=16; }
      else if(size===0){ size=end-off; }
      if(size<hdr||off+size>end) break;
      const cs=off+hdr;
      const box={type,off,size,hdr,cs,end:off+size,children:[]};
      if(CONTAINER_BOXES.has(type)){
        const innerStart=type==='meta'?cs+4:cs;
        box.children=parseBoxes(arr,dv,innerStart,box.end);
      }
      list.push(box);
      off+=size;
    }
    return list;
  }

  function findBox(list,type){ return list.find(b=>b.type===type)||null; }
  function findPath(list,path){
    let node=list,res=null;
    for(const p of path){ const b=findBox(node,p); if(!b) return null; res=b; node=b.children; }
    return res;
  }

  function rawOf(arr,box){ return arr.slice(box.off,box.end); }

  function rebuild(arr,box,repl){
    if(repl.has(box)) return repl.get(box);
    if(!box.children.length) return rawOf(arr,box);
    const prefix=box.type==='meta'?arr.slice(box.cs,box.cs+4):new Uint8Array(0);
    const parts=[prefix];
    for(const c of box.children) parts.push(rebuild(arr,c,repl));
    const body=concat(parts);
    const out=new Uint8Array(8+body.length);
    const dv=new DataView(out.buffer);
    w32(dv,0,8+body.length);
    setFcc(out,4,box.type);
    out.set(body,8);
    return out;
  }

  function readStco(arr,dv,box){
    const cnt=u32(dv,box.cs+4);
    const out=[];
    for(let i=0;i<cnt;i++) out.push(u32(dv,box.cs+8+i*4));
    return out;
  }

  function buildStco(offsets,delta){
    const body=new Uint8Array(4+4+offsets.length*4);
    const dv=new DataView(body.buffer);
    dv.setUint32(4,offsets.length,false);
    let off=8;
    for(const o of offsets){ dv.setUint32(off,(o+delta)>>>0,false); off+=4; }
    const out=new Uint8Array(8+body.length);
    const odv=new DataView(out.buffer);
    odv.setUint32(0,8+body.length,false);
    setFcc(out,4,'stco');
    out.set(body,8);
    return out;
  }

  function buildMvhd(arr,dv,box){
    const v=arr[box.cs];
    if(v===1){
      const out=rawOf(arr,box).slice();
      const odv=new DataView(out.buffer);
      odv.setUint32(32,0xFFFFFFFF,false);
      odv.setUint32(36,0xFFFFFFFF,false);
      return out;
    }
    const ct=u32(dv,box.cs+4);
    const mt=u32(dv,box.cs+8);
    const ts=u32(dv,box.cs+12);
    const restSrc=box.cs+20;
    const restLen=box.size-8-20;
    const newSize=box.size+12;
    const out=new Uint8Array(newSize);
    const odv=new DataView(out.buffer);
    odv.setUint32(0,newSize,false); setFcc(out,4,'mvhd');
    out[8]=1;
    odv.setUint32(12,0,false); odv.setUint32(16,ct,false);
    odv.setUint32(20,0,false); odv.setUint32(24,mt,false);
    odv.setUint32(28,ts,false);
    odv.setUint32(32,0xFFFFFFFF,false);
    odv.setUint32(36,0xFFFFFFFF,false);
    out.set(arr.slice(restSrc,restSrc+restLen),40);
    return out;
  }

  function buildTagBox(fourcc, text){
    const enc = new TextEncoder();
    const tb  = enc.encode(text);
    const data= new Uint8Array(4+4+4+4+tb.length);
    const ddv = new DataView(data.buffer);
    ddv.setUint32(0,data.length,false);
    setFcc(data,4,'data');
    ddv.setUint32(8,1,false);
    ddv.setUint32(12,0,false);
    data.set(tb,16);
    const box=new Uint8Array(4+4+data.length);
    const bdv=new DataView(box.buffer);
    bdv.setUint32(0,box.length,false);
    setFcc(box,4,fourcc);
    box.set(data,8);
    return box;
  }

  function buildSignatureUdta(){
    const cpyTag = buildTagBox('\\xa9cpy', 'reyy tools');
    const encTag = buildTagBox('\\xa9enc', 'reyy tools upload');
    const tooTag = buildTagBox('\\xa9too', 'reyy tools | reyytools.my.id');

    const ilstBody = concat([cpyTag, encTag, tooTag]);
    const ilst = new Uint8Array(8+ilstBody.length);
    const idv  = new DataView(ilst.buffer);
    idv.setUint32(0,8+ilstBody.length,false);
    setFcc(ilst,4,'ilst');
    ilst.set(ilstBody,8);

    const hdlrBody = new Uint8Array(4+4+4+4+1);
    hdlrBody[8]=0x6d; hdlrBody[9]=0x64; hdlrBody[10]=0x69; hdlrBody[11]=0x72;
    hdlrBody[12]=0x61; hdlrBody[13]=0x70; hdlrBody[14]=0x70; hdlrBody[15]=0x6c;
    const hdlr = new Uint8Array(8+hdlrBody.length);
    const hddv = new DataView(hdlr.buffer);
    hddv.setUint32(0,8+hdlrBody.length,false);
    setFcc(hdlr,4,'hdlr');
    hdlr.set(hdlrBody,8);

    const metaBody = concat([new Uint8Array(4), hdlr, ilst]);
    const meta = new Uint8Array(8+metaBody.length);
    const mdv  = new DataView(meta.buffer);
    mdv.setUint32(0,8+metaBody.length,false);
    setFcc(meta,4,'meta');
    meta.set(metaBody,8);

    const udta = new Uint8Array(8+meta.length);
    const udv  = new DataView(udta.buffer);
    udv.setUint32(0,8+meta.length,false);
    setFcc(udta,4,'udta');
    udta.set(meta,8);

    return udta;
  }

  function reyyPatchMP4(srcBuf){
    const buf = srcBuf instanceof ArrayBuffer ? srcBuf : srcBuf.buffer;
    const arr = new Uint8Array(buf.slice(0));
    const dv  = new DataView(arr.buffer);

    const boxes   = parseBoxes(arr,dv,0,arr.length);
    const ftypBox = findBox(boxes,'ftyp');
    const moovBox = findBox(boxes,'moov');
    const mdatBox = findBox(boxes,'mdat');

    if(!moovBox) throw new Error('moov not found');
    if(!mdatBox) throw new Error('mdat not found');

    const repl = new Map();

    const mvhdBox = findBox(moovBox.children,'mvhd');
    if(!mvhdBox) throw new Error('mvhd not found');
    const newMvhd = buildMvhd(arr,dv,mvhdBox);
    repl.set(mvhdBox, newMvhd);

    const allStco = [];
    for(const trak of moovBox.children){
      if(trak.type!=='trak') continue;
      const s=findPath(trak.children,['mdia','minf','stbl']);
      if(!s) continue;
      const co=findBox(s.children,'stco');
      if(co) allStco.push(co);
    }

    const signatureUdta = buildSignatureUdta();
    const existingUdta  = findBox(moovBox.children,'udta');
    if(existingUdta){
      repl.set(existingUdta, signatureUdta);
    } else {
      repl.set('__appendUdta__', signatureUdta);
    }

    function rebuildMoov(arr,box,repl){
      if(repl.has(box)) return repl.get(box);
      if(!box.children.length) return rawOf(arr,box);
      const prefix=box.type==='meta'?arr.slice(box.cs,box.cs+4):new Uint8Array(0);
      const parts=[prefix];
      for(const c of box.children) parts.push(rebuildMoov(arr,c,repl));
      if(box.type==='moov' && repl.has('__appendUdta__')){
        parts.push(repl.get('__appendUdta__'));
      }
      const body=concat(parts);
      const out=new Uint8Array(8+body.length);
      const odv=new DataView(out.buffer);
      odv.setUint32(0,8+body.length,false);
      setFcc(out,4,box.type);
      out.set(body,8);
      return out;
    }

    for(const co of allStco) repl.set(co, buildStco(readStco(arr,dv,co),0));
    const ftypBytes = ftypBox ? rawOf(arr,ftypBox) : new Uint8Array(0);
    const moov1     = rebuildMoov(arr,moovBox,repl);

    repl.delete('__appendUdta__');

    const newMdatDataStart = ftypBytes.length + moov1.length + 8;
    const oldMdatDataStart = mdatBox.cs;
    const delta = newMdatDataStart - oldMdatDataStart;

    for(const co of allStco) repl.set(co, buildStco(readStco(arr,dv,co), delta));
    const moovFinal = rebuildMoov(arr,moovBox,repl);

    const mdatFull = rawOf(arr,mdatBox);

    const output = concat([ftypBytes, moovFinal, mdatFull]);
    return { output: output.buffer, realSamples: 0, fakeSamples: 0 };
  }

  // Expose ONLY as reyyPatchMP4
  window.reyyPatchMP4 = reyyPatchMP4;
})();`;

module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.statusCode = 200;
  res.end(CF_WORKER_SOURCE);
};
