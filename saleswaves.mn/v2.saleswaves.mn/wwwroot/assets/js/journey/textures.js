// Procedural textures (canvas-generated, no downloads).
import * as THREE from 'three';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function tex(c, { repeat = [1, 1], srgb = false, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = aniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// deterministic PRNG
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// Tileable value noise built from integer-frequency sines (seamless).
function tileNoise(w, h, octaves, seed) {
  const r = rng(seed);
  const waves = [];
  for (let o = 0; o < octaves; o++) {
    const f = 1 << o;
    for (let k = 0; k < 4; k++) {
      waves.push({ fx: Math.round((r() * 2 - 1) * f * 2) || 1, fy: Math.round((r() * 2 - 1) * f * 2), ph: r() * 6.283, a: 1 / (o + 1) ** 1.3 });
    }
  }
  const out = new Float32Array(w * h);
  let mn = Infinity, mx = -Infinity;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = 0;
    for (const q of waves) v += q.a * Math.sin(6.2832 * (q.fx * x / w + q.fy * y / h) + q.ph);
    out[y * w + x] = v; mn = Math.min(mn, v); mx = Math.max(mx, v);
  }
  for (let i = 0; i < out.length; i++) out[i] = (out[i] - mn) / (mx - mn);
  return out;
}

function heightToNormal(hgt, w, h, strength) {
  const [c, g] = canvas(w, h);
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const l = hgt[y * w + ((x - 1 + w) % w)], rr = hgt[y * w + ((x + 1) % w)];
    const u = hgt[((y - 1 + h) % h) * w + x], d = hgt[((y + 1) % h) * w + x];
    let nx = (l - rr) * strength, ny = (d - u) * strength, nz = 1;
    const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
    const i = (y * w + x) * 4;
    img.data[i] = (nx * 0.5 + 0.5) * 255; img.data[i + 1] = (ny * 0.5 + 0.5) * 255; img.data[i + 2] = (nz * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

// Corrugated steel: trapezoidal profile across U.
export function corrugationNormal() {
  const w = 64, h = 4;
  const hgt = new Float32Array(w * h);
  for (let x = 0; x < w; x++) {
    const t = x / w;
    const v = t < 0.15 ? t / 0.15 : t < 0.5 ? 1 : t < 0.65 ? 1 - (t - 0.5) / 0.15 : 0;
    for (let y = 0; y < h; y++) hgt[y * w + x] = v;
  }
  return tex(heightToNormal(hgt, w, h, 6));
}

export function noiseMap(size, seed, lo, hi, octaves = 6, opts = {}) {
  const n = tileNoise(size, size, octaves, seed);
  const [c, g] = canvas(size, size);
  const img = g.createImageData(size, size);
  const r = rng(seed + 7);
  for (let i = 0; i < n.length; i++) {
    const v = (lo + (hi - lo) * (n[i] * 0.8 + r() * 0.2)) | 0;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return tex(c, opts);
}

export function asphalt() {
  const s = 512;
  const n = tileNoise(s, s, 6, 11);
  const [c, g] = canvas(s, s);
  const img = g.createImageData(s, s);
  const r = rng(5);
  for (let i = 0; i < n.length; i++) {
    const grain = r();
    let v = 52 + n[i] * 22 + (grain > 0.985 ? 40 : grain * 14);
    img.data[i * 4] = v; img.data[i * 4 + 1] = v + 1; img.data[i * 4 + 2] = v + 3; img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return tex(c, { srgb: true, repeat: [40, 40] });
}

export function concrete() {
  const s = 512;
  const n = tileNoise(s, s, 6, 23);
  const [c, g] = canvas(s, s);
  const img = g.createImageData(s, s);
  const r = rng(9);
  for (let i = 0; i < n.length; i++) {
    const v = 150 + n[i] * 30 + r() * 12;
    img.data[i * 4] = v; img.data[i * 4 + 1] = v - 2; img.data[i * 4 + 2] = v - 6; img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  g.strokeStyle = 'rgba(70,70,70,.55)'; g.lineWidth = 2;
  g.strokeRect(0, 0, s, s);
  return tex(c, { srgb: true, repeat: [30, 30] });
}

export function waterNormal() {
  const s = 256;
  return tex(heightToNormal(tileNoise(s, s, 5, 77), s, s, 3.2), { repeat: [1, 1] });
}

export function grass() {
  const s = 512;
  const n = tileNoise(s, s, 6, 31), m = tileNoise(s, s, 3, 41);
  const [c, g] = canvas(s, s);
  const img = g.createImageData(s, s);
  const r = rng(3);
  for (let i = 0; i < n.length; i++) {
    const k = n[i] * 0.6 + r() * 0.4, d = m[i];
    img.data[i * 4] = 128 + k * 50 - d * 30;
    img.data[i * 4 + 1] = 120 + k * 40 - d * 10;
    img.data[i * 4 + 2] = 70 + k * 25 - d * 20;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return tex(c, { srgb: true, repeat: [120, 120] });
}

// Office / bridge windows.
export function windows({ cols = 8, rows = 16, lit = 0.25, seed = 1, base = '#2b3440', glass = '#5d7184' } = {}) {
  const [c, g] = canvas(256, 512);
  const r = rng(seed);
  g.fillStyle = base; g.fillRect(0, 0, 256, 512);
  const cw = 256 / cols, rh = 512 / rows;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const on = r() < lit;
    const v = r();
    g.fillStyle = on ? `rgba(255,${210 + v * 30 | 0},${150 + v * 50 | 0},.9)` : glass;
    g.globalAlpha = on ? 0.8 : 0.78 + v * 0.18;
    g.fillRect(x * cw + 5, y * rh + 7, cw - 10, rh - 16);
  }
  g.globalAlpha = 1;
  return tex(c, { srgb: true });
}

// Saleswaves-branded container side.
export function brandSide() {
  const [c, g] = canvas(2048, 448);
  g.fillStyle = '#16294a'; g.fillRect(0, 0, 2048, 448);
  // subtle weathering
  const r = rng(12);
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = `rgba(255,255,255,${r() * 0.035})`;
    g.fillRect(r() * 2048, r() * 448, 2 + r() * 30, 1 + r() * 3);
  }
  g.fillStyle = '#ffffff';
  g.font = '800 168px "Onest", "Arial Black", Arial, sans-serif';
  g.textBaseline = 'middle';
  g.fillText('SALESWAVES', 150, 200);
  g.fillStyle = '#d0202e';
  g.fillRect(150, 300, 1180, 16);
  g.fillStyle = 'rgba(255,255,255,.75)';
  g.font = '600 46px "IBM Plex Mono", monospace';
  g.fillText('JAPAN  →  MONGOLIA', 150, 370);
  g.font = '600 38px "IBM Plex Mono", monospace';
  g.fillText('SWVU 207118 4', 1580, 80);
  g.fillText('45G1', 1580, 130);
  return tex(c, { srgb: true });
}

export function wakeTexture() {
  const [c, g] = canvas(128, 512);
  const grd = g.createLinearGradient(0, 0, 0, 512);
  grd.addColorStop(0, 'rgba(255,255,255,0.85)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 512);
  const img = g.getImageData(0, 0, 128, 512);
  const r = rng(4);
  for (let i = 0; i < img.data.length; i += 4) {
    const x = (i / 4) % 128, edge = Math.abs(x - 64) / 64;
    img.data[i + 3] *= Math.max(0, 1 - edge ** 2) * (0.55 + r() * 0.45);
  }
  g.putImageData(img, 0, 0);
  return tex(c, { srgb: true });
}
