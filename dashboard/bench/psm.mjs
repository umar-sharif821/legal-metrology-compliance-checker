import { createWorker } from 'tesseract.js';
const T = {name:/product\s*name/i,qty:/net\s*quantity/i,mrp:/mrp/i,incl:/inclusive of all taxes/i,
           date:/packed on/i,mfr:/manufactured by|marketed by/i,care:/customer care/i};
const w = await createWorker('eng');
for (const img of ['specimens/spec1.png','specimens/spec2.png','specimens/spec3.png']) {
  const out = [];
  for (const psm of ['3','6']) {
    await w.setParameters({ tessedit_pageseg_mode: psm });
    const r = await w.recognize(`./dashboard/public/${img}`, {}, { blocks:true, text:true });
    const lines=[];
    for (const b of r.data.blocks??[]) for (const p of b.paragraphs??[]) for (const l of p.lines??[]) {
      const t=(l.text??'').trim(); if(t) lines.push(t);
    }
    const txt=lines.join('\n');
    const hits=Object.entries(T).filter(([,re])=>re.test(txt)).map(([k])=>k);
    out.push(`psm${psm}: ${hits.length}/7 lines=${lines.length} [${hits.join(' ')}]`);
  }
  console.log(img.padEnd(22), '|', out.join('   ||   '));
}
await w.terminate();
