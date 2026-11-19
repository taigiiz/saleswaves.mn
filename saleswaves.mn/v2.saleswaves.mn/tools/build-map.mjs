// Saleswaves v2 — builds the relief-map textures used by the 3D journey.
// Sources: Terrarium elevation tiles (AWS Open Data / Mapzen: SRTM, GMTED2010, ETOPO1 …) and
// NASA Blue Marble Next Generation (GIBS). Output: shaded colour textures + a height map.
//
//   npm i sharp            (in any scratch folder, not inside the web project)
//   node build-map.mjs <output dir>      e.g. …/wwwroot/assets/map
//
// Downloads are cached in ./cache next to where the script is run.
import fs from 'node:fs'; import { execFileSync } from 'node:child_process'; import { createRequire } from 'node:module';
const sharp = createRequire(process.cwd() + '/')('sharp'); // resolved from the folder the script is run in

const OUT = process.argv[2] || 'out'; fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync('cache', { recursive: true });
const LAYERS = [
  // detailed patch: Japan → Mongolia
  { name: 'relief', lon0: 96, lon1: 150, lat0: 24, lat1: 56, z: 7, W: 4096, keyline: true, sizes: [[4096, 'relief_4k.jpg'], [2048, 'relief_2k.jpg']], height: 1024 },
  // low-resolution surroundings (rest of the visible hemisphere)
  { name: 'far', lon0: 60, lon1: 180, lat0: 0, lat1: 72, z: 5, W: 2048, keyline: false, sizes: [[2048, 'far.jpg']] },
];
const R = 6378137, rad = Math.PI / 180;
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + lat * rad / 2));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v)), mix = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const t0 = Date.now(), log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(1) + 's', ...a);
const curl = (args) => execFileSync('curl', ['-sS', '--fail', '--retry', '4', '--retry-delay', '2', ...args], { stdio: 'inherit' });

for (const C of LAYERS) {
  const n = 2 ** C.z, tx = (lon) => (lon + 180) / 360 * n, ty = (lat) => (1 - mercY(lat) / Math.PI) / 2 * n;
  const W = C.W, Hh = Math.round(W * (mercY(C.lat1) - mercY(C.lat0)) / ((C.lon1 - C.lon0) * rad)), N = W * Hh;
  const dens = (W / (C.lon1 - C.lon0)) / (4096 / 54); // pixel density relative to the detailed patch

  /* ---- 0. download ---- */
  const X0 = tx(C.lon0) * 256, X1 = tx(C.lon1) * 256, Y0 = ty(C.lat1) * 256, Y1 = ty(C.lat0) * 256;
  const tx0 = Math.floor(X0 / 256), tx1 = Math.floor((X1 - 1e-6) / 256), ty0 = Math.floor(Y0 / 256), ty1 = Math.floor((Y1 - 1e-6) / 256);
  const tile = (x, y) => `cache/t${C.z}_${x}_${y}.png`, jobs = [];
  for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) if (!fs.existsSync(tile(x, y))) jobs.push(`url = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${C.z}/${x}/${y}.png"\noutput = "${tile(x, y)}"`);
  if (jobs.length) { fs.writeFileSync('cache/jobs.txt', jobs.join('\n')); curl(['-Z', '--parallel-max', '12', '-K', 'cache/jobs.txt']); }
  const bm = `cache/bm_${C.name}.png`;
  if (!fs.existsSync(bm)) {
    const bbox = [R * C.lon0 * rad, R * mercY(C.lat0), R * C.lon1 * rad, R * mercY(C.lat1)].map((v) => v.toFixed(2)).join(',');
    curl(['-m', '240', '-o', bm, `https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=BlueMarble_NextGeneration&STYLES=&FORMAT=image/png&CRS=EPSG:3857&BBOX=${bbox}&WIDTH=${W}&HEIGHT=${Hh}&TIME=2004-08-01`]);
  }
  log(C.name, 'downloaded', W, Hh);

  /* ---- 1. stitch elevation tiles, resample to W x Hh (metres) ---- */
  const SW = (tx1 - tx0 + 1) * 256, SH = (ty1 - ty0 + 1) * 256, src = new Float32Array(SW * SH);
  for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) {
    const { data, info } = await sharp(tile(x, y)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let j = 0; j < 256; j++) for (let i = 0; i < 256; i++) {
      const k = (j * 256 + i) * info.channels;
      src[((y - ty0) * 256 + j) * SW + (x - tx0) * 256 + i] = data[k] * 256 + data[k + 1] + data[k + 2] / 256 - 32768;
    }
  }
  const E = new Float32Array(N);
  { const ox = X0 - tx0 * 256, oy = Y0 - ty0 * 256, sx = (X1 - X0) / W, sy = (Y1 - Y0) / Hh;
    for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
      const fx = ox + (i + 0.5) * sx - 0.5, fy = oy + (j + 0.5) * sy - 0.5;
      const x = clamp(Math.floor(fx), 0, SW - 2), y = clamp(Math.floor(fy), 0, SH - 2), u = fx - x, v = fy - y, k = y * SW + x;
      E[j * W + i] = mix(mix(src[k], src[k + 1], u), mix(src[k + SW], src[k + SW + 1], u), v);
    } }

  function blur(a, r0, passes = 3) { // separable box blur ≈ gaussian
    const r = Math.max(1, Math.round(r0 * dens)); const s = Float32Array.from(a), d = new Float32Array(N);
    for (let p = 0; p < passes; p++) {
      for (let j = 0; j < Hh; j++) { let acc = 0; const o = j * W; for (let i = -r; i <= r; i++) acc += s[o + clamp(i, 0, W - 1)];
        for (let i = 0; i < W; i++) { d[o + i] = acc / (2 * r + 1); acc += s[o + clamp(i + r + 1, 0, W - 1)] - s[o + clamp(i - r, 0, W - 1)]; } }
      for (let i = 0; i < W; i++) { let acc = 0; for (let j = -r; j <= r; j++) acc += d[clamp(j, 0, Hh - 1) * W + i];
        for (let j = 0; j < Hh; j++) { s[j * W + i] = acc / (2 * r + 1); acc += d[clamp(j + r + 1, 0, Hh - 1) * W + i] - d[clamp(j - r, 0, Hh - 1) * W + i]; } }
    }
    return s;
  }
  const yTop = mercY(C.lat1), yBot = mercY(C.lat0), mpp = new Float32Array(Hh); // ground metres per pixel, per row
  for (let j = 0; j < Hh; j++) { const lat = 2 * Math.atan(Math.exp(mix(yTop, yBot, (j + 0.5) / Hh))) - Math.PI / 2; mpp[j] = 2 * Math.PI * R * Math.cos(lat) / (360 / (C.lon1 - C.lon0) * W); }

  /* ---- 2. lighting: NW sun, weak fill, soft cast shadows, multi-scale occlusion ---- */
  const EX = 9, AZ = 318 * rad, ALT = 34 * rad;
  const L = [Math.sin(AZ) * Math.cos(ALT), -Math.cos(AZ) * Math.cos(ALT), Math.sin(ALT)]; // x east, y south, z up
  const Lf = [-L[0] * 0.55, L[1] * 0.2, 0.83];
  const sea = new Uint8Array(N); for (let i = 0; i < N; i++) sea[i] = E[i] <= 0 ? 1 : 0;
  const Hs = new Float32Array(N); for (let i = 0; i < N; i++) Hs[i] = Math.max(E[i], 0);
  const lit = new Float32Array(N), litSea = new Float32Array(N);
  for (let j = 0; j < Hh; j++) { const s = EX / (2 * mpp[j]); for (let i = 0; i < W; i++) {
    const k = j * W + i, l = j * W + Math.max(i - 1, 0), r = j * W + Math.min(i + 1, W - 1), u = Math.max(j - 1, 0) * W + i, d = Math.min(j + 1, Hh - 1) * W + i;
    let nx = -(Hs[r] - Hs[l]) * s, ny = -(Hs[d] - Hs[u]) * s, nz = 1, q = 1 / Math.hypot(nx, ny, nz); nx *= q; ny *= q; nz *= q;
    lit[k] = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]) / L[2] * 0.82 + Math.max(0, nx * Lf[0] + ny * Lf[1] + nz * Lf[2]) / Lf[2] * 0.18;
    nx = -(E[r] - E[l]) * s * 0.35; ny = -(E[d] - E[u]) * s * 0.35; q = 1 / Math.hypot(nx, ny, 1);
    litSea[k] = Math.max(0, (nx * L[0] + ny * L[1] + L[2]) * q) / L[2];
  } }
  const shadow = new Float32Array(N).fill(1);
  { const hl = Math.hypot(L[0], L[1]), dx = L[0] / hl, dy = L[1] / hl, tanA = Math.tan(ALT), STEPS = Math.round(56 * Math.max(0.4, dens));
    for (let j = 0; j < Hh; j++) { const rise = tanA * mpp[j] / EX; for (let i = 0; i < W; i++) {
      const k = j * W + i, h0 = Hs[k]; let m = 1, t = 1.5;
      for (let s = 0; s < STEPS; s++) { const x = Math.round(i + dx * t), y = Math.round(j + dy * t); if (x < 0 || y < 0 || x >= W || y >= Hh) break;
        const clear = (h0 + rise * t - Hs[y * W + x]) / (rise * t); if (clear < m) { m = clear; if (m <= -0.4) break; } t += 1 + t * 0.07; }
      shadow[k] = sstep(-0.35, 0.5, m);
    } } }
  const b1 = blur(Hs, 3), b2 = blur(Hs, 14), b3 = blur(Hs, 60), landSoft = blur(Float32Array.from(sea, (v) => 1 - v), 5);
  log(C.name, 'lit');

  /* ---- 3. compose: graded satellite colour × relief; bathymetric sea ---- */
  const sat = await sharp(bm).removeAlpha().raw().toBuffer(), out = Buffer.alloc(N * 3);
  const lin = (v) => (v / 255) ** 2.2, enc = (v) => Math.round(255 * clamp(v, 0, 1) ** (1 / 2.2));
  const deep = [0.008, 0.027, 0.07], shelf = [0.04, 0.118, 0.195];
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i; let r = lin(sat[k * 3]), g = lin(sat[k * 3 + 1]), b = lin(sat[k * 3 + 2]);
    if (!sea[k]) {
      const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = mix(y, r, 0.86) * 2.05 + 0.012; g = mix(y, g, 0.82) * 2.05 + 0.012; b = mix(y, b, 0.86) * 2.05 + 0.01;
      const ao = clamp(1 + (Hs[k] - b1[k]) * 0.0016 + (Hs[k] - b2[k]) * 0.00075 + (Hs[k] - b3[k]) * 0.00022, 0.55, 1.4);
      const l = lit[k] * mix(0.38, 1, shadow[k]), f = (0.30 + 0.78 * l) * ao, w = clamp(l, 0, 1);
      r *= f * mix(0.90, 1.05, w); g *= f; b *= f * mix(1.14, 0.95, w); // cool shadows, warm light
    } else {
      const d = sstep(0, 1, Math.sqrt(clamp(-E[k], 0, 6500) / 6500));
      let sr = mix(shelf[0], deep[0], d), sg = mix(shelf[1], deep[1], d), sb = mix(shelf[2], deep[2], d);
      const sed = clamp((r + g - 0.02) * 3.2, 0, 1) * (1 - sstep(0.02, 0.22, d)) * 0.6; // real sediment plumes on the shelf
      sr = mix(sr, r * 1.5 + 0.02, sed); sg = mix(sg, g * 1.5 + 0.03, sed); sb = mix(sb, b * 1.4 + 0.04, sed);
      const f = mix(1, litSea[k], 0.55) * (1 + 0.44 * landSoft[k]);
      r = sr * f; g = sg * f; b = sb * f;
    }
    if (C.keyline && !sea[k] && ((i > 0 && sea[k - 1]) || (i < W - 1 && sea[k + 1]) || (j > 0 && sea[k - W]) || (j < Hh - 1 && sea[k + W]))) { r *= 0.62; g *= 0.64; b *= 0.68; }
    out[k * 3] = enc(r); out[k * 3 + 1] = enc(g); out[k * 3 + 2] = enc(b);
  }
  const img = sharp(out, { raw: { width: W, height: Hh, channels: 3 } });
  for (const [w, file] of C.sizes) await img.clone().resize(w).jpeg({ quality: 84, mozjpeg: true }).toFile(`${OUT}/${file}`);
  if (C.height) { // 0 = sea, 16..255 = sqrt-encoded land elevation (0..6000 m)
    const hb = Buffer.alloc(N); for (let i = 0; i < N; i++) hb[i] = sea[i] ? 0 : Math.round(16 + 239 * Math.sqrt(clamp(E[i], 0, 6000) / 6000));
    await sharp(hb, { raw: { width: W, height: Hh, channels: 1 } }).resize(C.height, Math.round(C.height * Hh / W), { kernel: 'cubic' }).toColourspace('b-w').png({ compressionLevel: 9 }).toFile(`${OUT}/height.png`);
  }
  log(C.name, 'written', W + 'x' + Hh);
}
for (const f of fs.readdirSync(OUT)) console.log(f, (fs.statSync(`${OUT}/${f}`).size / 1024).toFixed(0) + ' KB');
