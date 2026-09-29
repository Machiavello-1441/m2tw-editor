// Small line diff: trims common head/tail, then LCS on the middle.
// Returns [{ t: ' ' | '+' | '-', s }] with only changed lines and 2 lines of context.
export function diffLines(aText, bText, context = 2) {
  const a = aText.split(/\r?\n/);
  const b = bText.split(/\r?\n/);
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
  const am = a.slice(head, a.length - tail);
  const bm = b.slice(head, b.length - tail);
  let ops = [];
  if (am.length * bm.length > 6e6) {
    ops = [...am.map((s) => ({ t: '-', s })), ...bm.map((s) => ({ t: '+', s }))];
  } else {
    const w = bm.length + 1;
    const L = new Uint32Array((am.length + 1) * w);
    for (let i = am.length - 1; i >= 0; i--) {
      for (let j = bm.length - 1; j >= 0; j--) {
        L[i * w + j] = am[i] === bm[j] ? L[(i + 1) * w + j + 1] + 1 : Math.max(L[(i + 1) * w + j], L[i * w + j + 1]);
      }
    }
    let i = 0, j = 0;
    while (i < am.length && j < bm.length) {
      if (am[i] === bm[j]) { ops.push({ t: ' ', s: am[i] }); i++; j++; }
      else if (L[(i + 1) * w + j] >= L[i * w + j + 1]) ops.push({ t: '-', s: am[i++] });
      else ops.push({ t: '+', s: bm[j++] });
    }
    while (i < am.length) ops.push({ t: '-', s: am[i++] });
    while (j < bm.length) ops.push({ t: '+', s: bm[j++] });
  }
  const all = [
    ...a.slice(Math.max(0, head - context), head).map((s) => ({ t: ' ', s })),
    ...ops,
    ...a.slice(a.length - tail, a.length - tail + context).map((s) => ({ t: ' ', s })),
  ];
  // Collapse long unchanged runs inside the middle
  const out = [];
  let run = [];
  const flush = () => {
    if (run.length > context * 2 + 1) {
      out.push(...run.slice(0, context), { t: '…', s: `${run.length - context * 2} unchanged lines` }, ...run.slice(-context));
    } else out.push(...run);
    run = [];
  };
  for (const o of all) { if (o.t === ' ') run.push(o); else { flush(); out.push(o); } }
  flush();
  return {
    lines: out,
    added: ops.filter((o) => o.t === '+').length,
    removed: ops.filter((o) => o.t === '-').length,
  };
}