import { createWorker } from 'tesseract.js';
const T = {
  'product name': /product\s*name/i,
  'net quantity': /net\s*quantity/i,
  mrp: /mrp/i,
  inclusive: /inclusive of all taxes/i,
  'packed on': /packed on/i,
  'manufactured by': /manufactured by/i,
  'customer care': /customer care/i,
  '250 g': /250\s*g\b/i,
  'rs 45': /45[.,]00/,
  '08/2026': /08\/2026/,
};
const imgs = ['hard1.png', 'v1.png', 'v2.png', 'v3.png'];
const psms = ['3', '4', '6', '11', '12'];
const w = await createWorker('eng');
const rows = [];
for (const img of imgs)
  for (const psm of psms) {
    await w.setParameters({ tessedit_pageseg_mode: psm });
    const t0 = Date.now();
    const r = await w.recognize(`./dashboard/bench/${img}`, {}, { blocks: true, text: true });
    const ms = Date.now() - t0;
    const lines = [];
    for (const b of r.data.blocks ?? [])
      for (const p of b.paragraphs ?? [])
        for (const l of p.lines ?? []) {
          const t = (l.text ?? '').trim();
          if (t) lines.push(t);
        }
    const txt = lines.join('\n');
    const hits = Object.entries(T)
      .filter(([, re]) => re.test(txt))
      .map(([k]) => k);
    rows.push({ img, psm, hits: hits.length, lines: lines.length, ms, list: hits });
    console.log(
      `${img.padEnd(10)} psm=${psm.padEnd(2)} hits=${hits.length}/10 lines=${String(lines.length).padStart(3)} ${ms}ms`,
    );
  }
rows.sort((a, b) => b.hits - a.hits || a.ms - b.ms);
console.log('\nBEST:');
rows
  .slice(0, 5)
  .forEach((r) =>
    console.log(`  ${r.img} psm=${r.psm} -> ${r.hits}/10 (${r.ms}ms)  [${r.list.join(' | ')}]`),
  );
await w.terminate();
