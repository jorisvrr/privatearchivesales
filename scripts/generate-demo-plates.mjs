// Generates the 18 clearly-marked demo plates used until real garment photography is supplied.
// Each garment contributes up to four views: full silhouette, detail, sample tag and lookbook.
// Output: public/media/demo/<id>-l.jpg (960×1280) and <id>-s.jpg (300×400), plus plates.json.
// Run: node scripts/generate-demo-plates.mjs
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'public/media/demo');
const tmp = resolve(root, '.cache/plates');
mkdirSync(out, { recursive: true });
mkdirSync(tmp, { recursive: true });

const fontSans = pathToFileURL(resolve(root, 'node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2')).href;
const fontSerif = pathToFileURL(resolve(root, 'node_modules/@fontsource-variable/newsreader/files/newsreader-latin-opsz-normal.woff2')).href;

const rad = (d) => (d * Math.PI) / 180;
const f = (n) => Math.round(n * 10) / 10;

/** Symmetric top-garment outline (jacket, knit, coat, shirt). */
function topPath(o) {
  const { cx, ny, nw, nd, sw, sd, bw, ay, hy, hw, sl, sa, cw, hemCurve = 0 } = o;
  const dir = [Math.sin(rad(sa)), Math.cos(rad(sa))];
  const inner = [-Math.cos(rad(sa)), Math.sin(rad(sa))];
  const S = [sw, ny + sd];
  const C1 = [S[0] + dir[0] * sl, S[1] + dir[1] * sl];
  const C2 = [C1[0] + inner[0] * cw, C1[1] + inner[1] * cw];
  const A = [bw, ay];
  const H = [hw, hy];
  const R = (p) => `${f(cx + p[0])} ${f(p[1])}`;
  const Lf = (p) => `${f(cx - p[0])} ${f(p[1])}`;
  return [
    `M ${Lf([nw, ny])}`,
    `Q ${f(cx)} ${f(ny + nd * 2)} ${R([nw, ny])}`,
    `L ${R(S)} L ${R(C1)} L ${R(C2)}`,
    `Q ${R([A[0] + 6, A[1] - 20])} ${R(A)}`,
    `Q ${R([A[0] + 8, (A[1] + H[1]) / 2])} ${R(H)}`,
    hemCurve ? `Q ${f(cx)} ${f(hy + hemCurve)} ${Lf(H)}` : `L ${Lf(H)}`,
    `Q ${Lf([A[0] + 8, (A[1] + H[1]) / 2])} ${Lf(A)}`,
    `Q ${Lf([A[0] + 6, A[1] - 20])} ${Lf(C2)}`,
    `L ${Lf(C1)} L ${Lf(S)} Z`,
  ].join(' ');
}

function trouserPath(cx) {
  return [
    `M ${cx - 128} 168 L ${cx + 128} 168`,
    `Q ${cx + 140} 420 ${cx + 172} 712 L ${cx + 22} 718`,
    `Q ${cx + 10} 470 ${cx} 352`,
    `Q ${cx - 10} 470 ${cx - 22} 718 L ${cx - 172} 712`,
    `Q ${cx - 140} 420 ${cx - 128} 168 Z`,
  ].join(' ');
}

const garments = {
  jacket: {
    title: 'Chore jacket', color: '#36425f', light: '#5a6788', dark: '#1d2438', stitch: '#c9b98f', bg: '#ecebe7', wall: '#1f2124',
    shape: () => topPath({ cx: 300, ny: 172, nw: 50, nd: 24, sw: 128, sd: 24, bw: 120, ay: 302, hy: 640, hw: 124, sl: 372, sa: 17, cw: 80 }),
    extras: (c) => `
      <path d="M 250 172 L 300 230 L 350 172 L 368 182 L 300 262 L 232 182 Z" fill="${c.dark}" opacity=".55"/>
      <line x1="300" y1="232" x2="300" y2="640" stroke="${c.dark}" stroke-width="2.4" opacity=".7"/>
      <line x1="308" y1="240" x2="308" y2="636" stroke="${c.stitch}" stroke-width="1.6" stroke-dasharray="6 5" opacity=".75"/>
      ${[290, 360, 430, 500, 570].map((y) => `<circle cx="300" cy="${y}" r="7.5" fill="#d8d2c2"/><circle cx="300" cy="${y}" r="7.5" fill="none" stroke="#7d7564" stroke-width="1.2"/>`).join('')}
      ${[[200, 440], [330, 440]].map(([x, y]) => `<rect x="${x}" y="${y}" width="72" height="84" rx="3" fill="${c.dark}" opacity=".18"/><rect x="${x + 5}" y="${y + 5}" width="62" height="74" rx="2" fill="none" stroke="${c.stitch}" stroke-width="1.6" stroke-dasharray="6 5" opacity=".75"/>`).join('')}
      <rect x="208" y="292" width="58" height="62" rx="2" fill="${c.dark}" opacity=".16"/><rect x="212" y="296" width="50" height="54" rx="2" fill="none" stroke="${c.stitch}" stroke-width="1.6" stroke-dasharray="6 5" opacity=".75"/>
      <path d="M 180 626 L 420 626" stroke="${c.stitch}" stroke-width="1.6" stroke-dasharray="6 5" opacity=".75"/>`,
    focus: [300, 330],
  },
  trouser: {
    title: 'Wide-leg trouser', color: '#cdc4b1', light: '#e3dccd', dark: '#9c927d', stitch: '#8c826d', bg: '#efeeea', wall: '#7b7468',
    shape: () => trouserPath(300),
    extras: (c) => `
      <rect x="172" y="168" width="256" height="34" fill="${c.dark}" opacity=".35"/>
      <path d="M 172 196 L 428 196" stroke="${c.stitch}" stroke-width="1.5" stroke-dasharray="6 5" opacity=".8"/>
      ${[200, 262, 338, 400].map((x) => `<rect x="${x - 4}" y="164" width="8" height="40" rx="2" fill="${c.dark}" opacity=".45"/>`).join('')}
      <circle cx="300" cy="185" r="7" fill="#efe9dc" stroke="#857a62" stroke-width="1.2"/>
      <path d="M 300 202 L 300 330" stroke="${c.stitch}" stroke-width="1.5" stroke-dasharray="6 5" opacity=".8"/>
      <path d="M 238 202 L 232 340 M 362 202 L 368 340" stroke="${c.dark}" stroke-width="2" opacity=".45"/>
      <path d="M 180 210 Q 200 250 196 290 M 420 210 Q 400 250 404 290" stroke="${c.dark}" stroke-width="2" fill="none" opacity=".5"/>
      <path d="M 218 360 Q 205 540 196 712 M 382 360 Q 395 540 404 712" stroke="${c.light}" stroke-width="3" fill="none" opacity=".6"/>`,
    focus: [300, 230],
  },
  knit: {
    title: 'Ribbed jumper', color: '#404145', light: '#5d5f64', dark: '#26272a', stitch: '#6d6f74', bg: '#ebeae6', wall: '#8a877f',
    shape: () => topPath({ cx: 300, ny: 186, nw: 46, nd: 18, sw: 132, sd: 30, bw: 128, ay: 312, hy: 618, hw: 120, sl: 360, sa: 15, cw: 70 }),
    extras: (c) => `
      <path d="M 254 186 Q 300 236 346 186" stroke="${c.dark}" stroke-width="16" fill="none" opacity=".7"/>
      <rect x="180" y="580" width="240" height="38" fill="url(#rib)" opacity=".9"/>
      <rect x="0" y="0" width="600" height="800" fill="url(#knitTex)" opacity=".55" clip-path="url(#shapeClip)"/>`,
    focus: [300, 470],
  },
  coat: {
    title: 'Long coat', color: '#a8865d', light: '#c4a47b', dark: '#7b5f3d', stitch: '#5e4528', bg: '#eeece8', wall: '#25221e',
    shape: () => topPath({ cx: 300, ny: 150, nw: 52, nd: 20, sw: 136, sd: 26, bw: 128, ay: 290, hy: 742, hw: 156, sl: 410, sa: 14, cw: 84 }),
    extras: (c) => `
      <path d="M 248 150 L 300 372 L 236 300 L 214 170 Z" fill="${c.dark}" opacity=".5"/>
      <path d="M 352 150 L 300 372 L 364 300 L 386 170 Z" fill="${c.dark}" opacity=".42"/>
      <line x1="300" y1="372" x2="300" y2="742" stroke="${c.dark}" stroke-width="2.4" opacity=".6"/>
      ${[400, 470, 540].map((y) => `<circle cx="270" cy="${y}" r="9" fill="#3c2c19"/><circle cx="330" cy="${y}" r="9" fill="#3c2c19"/>`).join('')}
      <rect x="172" y="430" width="256" height="30" fill="${c.dark}" opacity=".35"/>
      <path d="M 220 600 L 238 690 M 380 600 L 362 690" stroke="${c.dark}" stroke-width="2.4" opacity=".55"/>`,
    focus: [300, 300],
  },
  shirt: {
    title: 'Poplin shirt', color: '#eef0f2', light: '#ffffff', dark: '#c9d0d8', stitch: '#9aa6b4', bg: '#e4e3df', wall: '#465566',
    shape: () => topPath({ cx: 300, ny: 176, nw: 42, nd: 16, sw: 122, sd: 26, bw: 112, ay: 300, hy: 640, hw: 116, sl: 372, sa: 13, cw: 62, hemCurve: 40 }),
    extras: (c) => `
      <rect x="0" y="0" width="600" height="800" fill="url(#stripes)" opacity=".85" clip-path="url(#shapeClip)"/>
      <path d="M 256 176 L 300 214 L 344 176 L 352 214 L 314 240 L 300 222 L 286 240 L 248 214 Z" fill="#f7f8f9" stroke="${c.dark}" stroke-width="1.5"/>
      <rect x="292" y="222" width="16" height="430" fill="#f3f5f7" opacity=".9"/>
      ${[262, 322, 382, 442, 502, 562].map((y) => `<circle cx="300" cy="${y}" r="5" fill="#fbfbfb" stroke="#a9b1bb" stroke-width="1"/>`).join('')}`,
    focus: [300, 250],
  },
};

const defs = (g) => `
  <defs>
    <clipPath id="shapeClip"><path d="${g.shape()}"/></clipPath>
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" result="n"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.22 0"/>
      <feComposite in2="SourceGraphic" operator="in"/>
    </filter>
    <filter id="soft"><feGaussianBlur stdDeviation="16"/></filter>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter>
    <pattern id="rib" width="7" height="38" patternUnits="userSpaceOnUse"><rect width="7" height="38" fill="${g.color}"/><rect width="3" height="38" fill="${g.dark}"/></pattern>
    <pattern id="knitTex" width="10" height="12" patternUnits="userSpaceOnUse"><path d="M 0 0 L 5 8 L 10 0" stroke="${g.dark}" stroke-width="1.6" fill="none"/></pattern>
    <pattern id="stripes" width="11" height="10" patternUnits="userSpaceOnUse"><rect x="0" width="3" height="10" fill="#8ea6c6"/></pattern>
    <linearGradient id="fold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></linearGradient>
  </defs>`;

function garmentGroup(g) {
  const p = g.shape();
  return `
    <path d="${p}" transform="translate(0 14)" fill="#000" opacity=".2" filter="url(#shadow)"/>
    <path d="${p}" fill="${g.color}"/>
    <g clip-path="url(#shapeClip)">
      ${g.extras(g)}
      <ellipse cx="230" cy="470" rx="40" ry="190" fill="${g.light}" opacity=".35" filter="url(#soft)"/>
      <ellipse cx="380" cy="520" rx="34" ry="170" fill="${g.dark}" opacity=".35" filter="url(#soft)"/>
      <rect width="600" height="800" fill="url(#fold)"/>
      <rect width="600" height="800" fill="#808080" filter="url(#grain)"/>
    </g>`;
}

const mark = (n, dark) => `<text x="28" y="772" font-family="Sans" font-weight="500" font-size="15" fill="${dark ? '#ffffff' : '#000000'}" opacity=".5">Demo plate ${String(n).padStart(2, '0')}</text>`;

const views = {
  full: (g, n) => `<rect width="600" height="800" fill="${g.bg}"/>${garmentGroup(g)}${mark(n)}`,
  detail: (g, n) => {
    const [fx, fy] = g.focus; const s = 2.7;
    return `<rect width="600" height="800" fill="${g.bg}"/><g transform="translate(${300 - fx * s} ${400 - fy * s}) scale(${s})">${garmentGroup(g)}</g>
      <rect width="600" height="800" fill="#808080" filter="url(#grain)" opacity=".5"/>${mark(n, g.color !== '#eef0f2' && g.color !== '#cdc4b1')}`;
  },
  tag: (g, n) => `
    <rect width="600" height="800" fill="${g.color}"/>
    <g transform="translate(-300 -420) scale(2)">${garmentGroup(g)}</g>
    <rect width="600" height="800" fill="#808080" filter="url(#grain)" opacity=".6"/>
    <path d="M 318 0 C 300 120 340 160 300 214" stroke="#d9d2bf" stroke-width="2.4" fill="none"/>
    <g transform="rotate(-7 300 420)">
      <rect x="168" y="196" width="264" height="400" rx="6" fill="#000" opacity=".25" filter="url(#shadow)"/>
      <rect x="168" y="190" width="264" height="400" rx="6" fill="#f4efe3"/>
      <rect x="168" y="190" width="264" height="400" rx="6" fill="#808080" filter="url(#grain)" opacity=".5"/>
      <circle cx="300" cy="224" r="10" fill="none" stroke="#bdb39c" stroke-width="5"/>
      <text x="196" y="290" font-family="Sans" font-weight="500" font-size="18" letter-spacing="3" fill="#1c1b19">SAMPLE</text>
      <text x="196" y="340" font-family="Serif" font-size="34" fill="#1c1b19">${g.title}</text>
      <line x1="196" y1="372" x2="404" y2="372" stroke="#1c1b19" stroke-width="1" opacity=".4"/>
      <text x="196" y="408" font-family="Sans" font-weight="500" font-size="15" fill="#1c1b19" opacity=".7">Size</text><text x="300" y="408" font-family="Serif" font-size="18" fill="#1c1b19" opacity=".7">—</text>
      <text x="196" y="440" font-family="Sans" font-weight="500" font-size="15" fill="#1c1b19" opacity=".7">Season</text><text x="300" y="440" font-family="Serif" font-size="18" fill="#1c1b19" opacity=".7">—</text>
      <text x="196" y="550" font-family="Serif" font-style="italic" font-size="20" fill="#1c1b19">Demo plate ${String(n).padStart(2, '0')}</text>
    </g>`,
  lookbook: (g, n) => `
    <rect width="600" height="800" fill="${g.wall}"/>
    <radialGradient id="spot" cx="50%" cy="38%" r="60%"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></radialGradient>
    <rect width="600" height="800" fill="url(#spot)"/>
    <rect y="690" width="600" height="110" fill="#000" opacity=".22"/>
    <line x1="0" y1="690" x2="600" y2="690" stroke="#fff" stroke-opacity=".08"/>
    <ellipse cx="300" cy="712" rx="170" ry="12" fill="#000" opacity=".3" filter="url(#soft)"/>
    <g transform="translate(75 120) scale(0.75)">
      <path d="M 300 0 Q 330 0 330 26 Q 330 46 300 56 L 300 76" stroke="#b9b4aa" stroke-width="7" fill="none"/>
      <path d="M 300 76 L 150 170 L 450 170 Z" stroke="#b9b4aa" stroke-width="9" fill="none" stroke-linejoin="round"/>
      ${garmentGroup(g)}
    </g>
    <rect width="600" height="800" fill="#808080" filter="url(#grain)" opacity=".4"/>
    ${mark(n, true)}`,
};

const plan = [
  ['jacket', 'full'], ['coat', 'lookbook'], ['shirt', 'full'], ['knit', 'detail'], ['trouser', 'full'],
  ['jacket', 'tag'], ['knit', 'full'], ['coat', 'full'], ['trouser', 'lookbook'], ['shirt', 'detail'],
  ['jacket', 'detail'], ['knit', 'lookbook'], ['trouser', 'detail'], ['coat', 'detail'], ['shirt', 'tag'],
  ['jacket', 'lookbook'], ['trouser', 'tag'], ['knit', 'tag'],
];

const browser = await chromium.launch();
const manifest = [];
for (const [i, [gk, vk]] of plan.entries()) {
  const g = garments[gk];
  const n = i + 1;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" width="600" height="800">${defs(g)}${views[vk](g, n)}</svg>`;
  const html = `<!doctype html><html><head><style>
    @font-face{font-family:Sans;src:url(${fontSans}) format('woff2');font-weight:100 900}
    @font-face{font-family:Serif;src:url(${fontSerif}) format('woff2');font-style:normal}
    html,body{margin:0;background:#fff}svg{display:block}</style></head><body>${svg}</body></html>`;
  const file = resolve(tmp, `${i}.html`);
  writeFileSync(file, html);
  const id = `${String(n).padStart(2, '0')}-${gk}-${vk}`;
  for (const [suffix, scale] of [['l', 1.6], ['s', 0.5]]) {
    const page = await browser.newPage({ viewport: { width: 600, height: 800 }, deviceScaleFactor: scale });
    await page.goto(pathToFileURL(file).href);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: resolve(out, `${id}-${suffix}.jpg`), type: 'jpeg', quality: suffix === 'l' ? 82 : 86 });
    await page.close();
  }
  manifest.push({ id, garment: gk, view: vk, n });
  process.stdout.write(`${id} `);
}
await browser.close();
writeFileSync(resolve(out, 'plates.json'), JSON.stringify(manifest, null, 2));
console.log('\ndone');
