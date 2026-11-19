// Procedural, PBR-ready models. Units: metres. Vehicles face +Z.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';
import { corrugationNormal, brandSide, windows, rng } from './textures.js';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
// Smooth 1D profile through (u, v) control points (u monotonic).
function profile(points) {
  const spline = new THREE.SplineCurve(points.map(([u, v]) => new THREE.Vector2(u, v)));
  const pts = spline.getPoints(600);
  return (u) => {
    if (u <= pts[0].x) return pts[0].y;
    if (u >= pts[pts.length - 1].x) return pts[pts.length - 1].y;
    let lo = 0, hi = pts.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pts[m].x < u) lo = m; else hi = m; }
    const a = pts[lo], b = pts[hi];
    return a.y + (b.y - a.y) * ((u - a.x) / Math.max(1e-6, b.x - a.x));
  };
}

const sgnPow = (v, e) => Math.sign(v) * Math.abs(v) ** e;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

/**
 * Loft a closed superellipse tube along Z.
 * sec(u) -> { yb, yt, w, wt, n, x0 } ; u in [0,1], z = z0 + (z1 - z0) * u
 * Returns indexed BufferGeometry; optional groupFn(u, sy) -> 0|1 for two material groups.
 */
function loft({ N = 80, M = 40, z0, z1, sec, caps = true, groupFn = null }) {
  const pos = [], idx = [[], []], flag = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, z = z0 + (z1 - z0) * u;
    const s = sec(u);
    const mid = (s.yb + s.yt) / 2, half = (s.yt - s.yb) / 2, e = 2 / s.n;
    for (let j = 0; j < M; j++) {
      const th = (j / M) * Math.PI * 2;
      const cx = sgnPow(Math.cos(th), e), sy = sgnPow(Math.sin(th), e);
      const t = (sy + 1) / 2;
      const hw = s.w + (s.wt - s.w) * t * t + ((s.wb ?? s.w) - s.w) * (1 - t) ** 3;
      pos.push((s.x0 || 0) + hw * cx, mid + half * sy, z);
      flag.push(groupFn ? groupFn(u, sy, cx) : 0);
    }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
    const a = i * M + j, b = i * M + ((j + 1) % M), c = (i + 1) * M + j, d = (i + 1) * M + ((j + 1) % M);
    const g = flag[a] && flag[b] && flag[c] && flag[d] ? 1 : 0;
    idx[g].push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const all = idx[0].concat(idx[1]);
  geo.setIndex(all);
  geo.addGroup(0, idx[0].length, 0);
  if (idx[1].length) geo.addGroup(idx[0].length, idx[1].length, 1);
  geo.computeVertexNormals();
  if (!caps) return geo;
  // flat end caps as separate geometry (keeps crisp edges)
  const capGeos = [0, N].map((i) => {
    const ring = [];
    for (let j = 0; j < M; j++) ring.push(new THREE.Vector3().fromArray(pos, (i * M + j) * 3));
    const c = ring.reduce((a, v) => a.add(v), new THREE.Vector3()).multiplyScalar(1 / M);
    const p = [], ix = [];
    p.push(c.x, c.y, c.z);
    ring.forEach((v) => p.push(v.x, v.y, v.z));
    for (let j = 0; j < M; j++) {
      const a = 1 + j, b = 1 + ((j + 1) % M);
      if (i === 0) ix.push(0, a, b); else ix.push(0, b, a);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setIndex(ix); g.computeVertexNormals();
    return g;
  });
  return { body: geo, caps: capGeos };
}

function box(w, h, d, x = 0, y = 0, z = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}
function cyl(rt, rb, h, seg, x = 0, y = 0, z = 0, axis = 'y') {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  if (axis === 'x') g.rotateZ(Math.PI / 2);
  if (axis === 'z') g.rotateX(Math.PI / 2);
  g.translate(x, y, z);
  return g;
}
const strip = (g) => { g.deleteAttribute('uv'); return g; };
function merge(list) {
  const l = list.filter(Boolean).map((g) => {
    let gg = g.index ? g.toNonIndexed() : g;
    if (gg.getAttribute('uv') === undefined) {
      gg.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(gg.getAttribute('position').count * 2), 2));
    }
    gg.clearGroups();
    return gg;
  });
  return mergeGeometries(l, false);
}

/* ------------------------------------------------------------------ */
/* Materials                                                           */
/* ------------------------------------------------------------------ */
export function makeMaterials() {
  const M = {
    paint: new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0.3, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.04 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x0c1116, metalness: 0.1, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0, envMapIntensity: 1.6 }),
    trim: new THREE.MeshStandardMaterial({ color: 0x121315, roughness: 0.62, metalness: 0.1 }),
    tire: new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.92, metalness: 0 }),
    alloy: new THREE.MeshStandardMaterial({ color: 0xc9ccd0, roughness: 0.28, metalness: 1 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.12, metalness: 1 }),
    head: new THREE.MeshPhysicalMaterial({ color: 0xdfe6ee, roughness: 0.05, metalness: 0.2, emissive: 0xffffff, emissiveIntensity: 0, clearcoat: 1 }),
    tail: new THREE.MeshPhysicalMaterial({ color: 0x5a0a0e, roughness: 0.15, emissive: 0xff1a1a, emissiveIntensity: 0.15, clearcoat: 1 }),
    plate: new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.5 }),
    well: new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xd3d6d9, roughness: 0.55, metalness: 0.45 }),
    darkSteel: new THREE.MeshStandardMaterial({ color: 0x2c2f33, roughness: 0.6, metalness: 0.6 }),
    rail: new THREE.MeshStandardMaterial({ color: 0x8a8d90, roughness: 0.35, metalness: 1 }),
    red: new THREE.MeshStandardMaterial({ color: 0xb3242b, roughness: 0.5, metalness: 0.2 }),
    yellow: new THREE.MeshStandardMaterial({ color: 0xd4a31c, roughness: 0.5, metalness: 0.3 }),
    white: new THREE.MeshStandardMaterial({ color: 0xe9e9e4, roughness: 0.6, metalness: 0.05 }),
    cable: new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.5, metalness: 0.6 }),
  };
  const corr = corrugationNormal();
  M.container = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, metalness: 0.35, normalMap: corr, normalScale: new THREE.Vector2(1.1, 1.1) });
  return M;
}

/* ------------------------------------------------------------------ */
/* Cars                                                                */
/* ------------------------------------------------------------------ */
const CAR_TYPES = {
  // Compact hybrid hatchback (the most common import)
  hatch: {
    L: 4.54, W: 1.76, r: 0.315, track: 0.755, uF: 0.19, uR: 0.785, n: 5, cab: [0.305, 0.955], roofU: [0.47, 0.8],
    top: [[0, 0.56], [0.015, 0.68], [0.05, 0.775], [0.13, 0.83], [0.25, 0.9], [0.31, 0.94], [0.6, 0.985], [0.86, 1.02], [0.94, 1.0], [0.98, 0.86], [1, 0.62]],
    bot: [[0, 0.44], [0.04, 0.31], [0.1, 0.25], [0.9, 0.25], [0.97, 0.33], [1, 0.47]],
    roof: [[0.305, 0.94], [0.36, 1.13], [0.43, 1.37], [0.5, 1.475], [0.62, 1.49], [0.72, 1.45], [0.84, 1.27], [0.92, 1.09], [0.955, 1.0]],
    wid: [[0, 0.62], [0.03, 0.8], [0.09, 0.87], [0.5, 0.88], [0.9, 0.87], [0.97, 0.8], [1, 0.66]],
    roofW: 0.6, beltW: 0.83,
  },
  // Body-on-frame SUV
  suv: {
    L: 4.82, W: 1.885, r: 0.385, track: 0.8, uF: 0.185, uR: 0.775, n: 7, cab: [0.29, 0.985], roofU: [0.42, 0.95],
    top: [[0, 0.78], [0.02, 0.93], [0.06, 1.03], [0.2, 1.1], [0.29, 1.13], [0.6, 1.16], [0.95, 1.16], [0.985, 1.06], [1, 0.82]],
    bot: [[0, 0.56], [0.05, 0.42], [0.1, 0.38], [0.9, 0.38], [0.96, 0.44], [1, 0.58]],
    roof: [[0.29, 1.13], [0.34, 1.42], [0.39, 1.74], [0.46, 1.83], [0.9, 1.83], [0.96, 1.77], [0.985, 1.16]],
    wid: [[0, 0.78], [0.025, 0.9], [0.07, 0.94], [0.5, 0.945], [0.93, 0.94], [0.98, 0.9], [1, 0.8]],
    roofW: 0.76, beltW: 0.88,
  },
  // Mid-size sedan
  sedan: {
    L: 4.69, W: 1.78, r: 0.32, track: 0.765, uF: 0.2, uR: 0.79, n: 5, cab: [0.325, 0.79], roofU: [0.47, 0.7],
    top: [[0, 0.56], [0.02, 0.69], [0.06, 0.79], [0.3, 0.9], [0.34, 0.93], [0.66, 0.97], [0.72, 1.0], [0.92, 1.01], [0.975, 0.92], [1, 0.64]],
    bot: [[0, 0.43], [0.04, 0.3], [0.1, 0.24], [0.9, 0.24], [0.97, 0.32], [1, 0.46]],
    roof: [[0.325, 0.93], [0.4, 1.2], [0.47, 1.39], [0.55, 1.44], [0.64, 1.41], [0.72, 1.22], [0.79, 1.0]],
    wid: [[0, 0.62], [0.03, 0.8], [0.09, 0.88], [0.5, 0.89], [0.9, 0.88], [0.97, 0.81], [1, 0.66]],
    roofW: 0.61, beltW: 0.83,
  },
};

function wheelParts(r, side, lod = 0) {
  // tire (lathe around X), rim, spokes, brake disc
  const tw = r * 0.66, ri = r * 0.6;
  const prof = [
    [ri, -tw / 2], [r - 0.04, -tw / 2], [r - 0.012, -tw / 2 + 0.012], [r, -tw / 2 + 0.04],
    [r, tw / 2 - 0.04], [r - 0.012, tw / 2 - 0.012], [r - 0.04, tw / 2], [ri, tw / 2],
  ].map(([a, b]) => new THREE.Vector2(a, b));
  const tire = new THREE.LatheGeometry(lod ? prof.filter((_, i) => i % 2 === 0 || i === prof.length - 1) : prof, lod ? 12 : 40);
  tire.rotateZ(Math.PI / 2);
  const rimR = ri * 0.98;
  const rim = cyl(rimR, rimR, tw * 0.9, lod ? 12 : 36, 0, 0, 0, 'x');
  if (lod) {
    const capL = cyl(rimR * 0.95, rimR * 0.95, 0.01, 12, side * tw * 0.42, 0, 0, 'x');
    return { tire, alloy: capL, dark: rim };
  }
  const face = side * tw * 0.42;
  const spokes = [];
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    const s = box(0.03, rimR * 0.92, 0.055, face, 0, 0);
    s.translate(0, rimR * 0.46, 0);
    s.rotateX(a);
    spokes.push(s);
  }
  const hub = cyl(rimR * 0.22, rimR * 0.22, 0.05, 16, face, 0, 0, 'x');
  const lip = new THREE.TorusGeometry(rimR * 0.97, 0.012, 6, 36); lip.rotateY(Math.PI / 2); lip.translate(face, 0, 0);
  const dish = cyl(rimR * 0.95, rimR * 0.95, 0.01, 36, face - side * 0.03, 0, 0, 'x');
  const disc = cyl(rimR * 0.78, rimR * 0.78, 0.025, 28, face - side * 0.07, 0, 0, 'x');
  return { tire, alloy: merge([...spokes, hub, lip]), dark: merge([rim, dish, disc]) };
}

/** Build car parts keyed by material, in car-local space (ground at y=0, front +Z). */
const _carCache = {};
export function carParts(typeName, lod = 0) {
  const key = typeName + lod;
  if (_carCache[key]) return _carCache[key];
  const T = CAR_TYPES[typeName];
  const { L, r } = T;
  const top = profile(T.top), bot = profile(T.bot), roof = profile(T.roof), wid = profile(T.wid);
  const halfW = T.W / 2 / 0.88;
  const ra = r + 0.075;
  const arch = (u) => {
    let y = -1;
    for (const uc of [T.uF, T.uR]) {
      const dz = (u - uc) * L;
      if (Math.abs(dz) < ra) y = Math.max(y, r + Math.sqrt(ra * ra - dz * dz) * 0.92);
    }
    return y;
  };
  const secBody = (u) => {
    const yt = top(u);
    const yb = Math.min(yt - 0.06, Math.max(bot(u), arch(u)));
    const w = wid(u) * halfW;
    return { yb, yt, w, wt: w * 0.86, wb: w * 0.9, n: T.n };
  };
  // x on the body surface for a given (u, y)
  const surfX = (u, y) => {
    const sc = secBody(u);
    const mid = (sc.yb + sc.yt) / 2, half = (sc.yt - sc.yb) / 2;
    const sy = THREE.MathUtils.clamp((y - mid) / half, -0.995, 0.995);
    const cx = (1 - Math.abs(sy) ** sc.n) ** (1 / sc.n);
    const t = (sy + 1) / 2;
    return (sc.w + (sc.wt - sc.w) * t * t + (sc.wb - sc.w) * (1 - t) ** 3) * cx;
  };
  const zAt = (u) => L / 2 - u * L;
  const bodyL = loft({ N: lod ? 40 : 120, M: lod ? 20 : 48, z0: L / 2, z1: -L / 2, sec: secBody });

  // greenhouse: group 1 = painted (roof + A/C pillars), group 0 = glass
  const [c0, c1] = T.cab;
  const cab = loft({
    N: lod ? 26 : 80, M: lod ? 20 : 48, z0: zAt(c0), z1: zAt(c1), caps: false,
    sec: (v) => {
      const u = c0 + (c1 - c0) * v;
      const yb = top(u) - 0.05, yt = Math.max(yb + 0.002, roof(u));
      const w = surfX(u, top(u) - 0.02) * T.beltW / 0.88 * 1.04;
      return { yb, yt, w, wt: T.roofW * (T.W / 1.76), n: 4.6 };
    },
    groupFn: (v, sy, cx) => {
      const u = c0 + (c1 - c0) * v;
      const side = Math.abs(cx) > 0.7 && sy > -0.7;
      if (u > T.roofU[0] && u < T.roofU[1] && sy > 0.86) return 1;
      if (side && u < T.roofU[0] + 0.015) return 1;
      if (side && u > T.roofU[1] - 0.03) return 1;
      return 0;
    },
  });
  const splitGroup = (g) => {
    if (!g) return null;
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', cab.getAttribute('position'));
    gg.setAttribute('normal', cab.getAttribute('normal'));
    gg.setIndex(new THREE.BufferAttribute(cab.index.array.slice(g.start, g.start + g.count), 1));
    return gg;
  };
  const glass = splitGroup(cab.groups[0]), painted = splitGroup(cab.groups[1]);

  const parts = { paint: [], glass: [], trim: [], tire: [], alloy: [], wheelDark: [], head: [], tail: [], plate: [], well: [] };
  parts.paint.push(bodyL.body, ...bodyL.caps);
  if (painted) parts.paint.push(painted);
  parts.glass.push(glass);

  const tube = (pts, r, closed = false) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed, 'centripetal'), lod ? pts.length * 2 : Math.max(16, pts.length * 6), r, lod ? 4 : 8, closed);

  // wheel wells + wheels
  const zF = zAt(T.uF), zR = zAt(T.uR);
  for (const z of [zF, zR]) {
    parts.well.push(cyl(ra * 0.98, ra * 0.98, T.W * 0.8, lod ? 10 : 24, 0, r, z, 'x'));
    for (const side of [-1, 1]) {
      const w = wheelParts(r, side, lod);
      const x = side * T.track * (T.W / 1.76) * 0.99;
      [w.tire, w.alloy, w.dark].forEach((g) => g.translate(x, r, z));
      parts.tire.push(w.tire); parts.alloy.push(w.alloy); parts.wheelDark.push(w.dark);
    }
  }

  for (const s of [-1, 1]) {
    // headlight: smoked housing + bright strip following the front corner
    const yH = top(0.03) - 0.075;
    const hp = [], hp2 = [];
    for (let k = 0; k <= 8; k++) {
      const u = 0.006 + k * 0.009, y = yH + k * 0.008;
      hp.push(V3(s * (surfX(u, y) + 0.004), y, zAt(u) + 0.004));
      hp2.push(V3(s * (surfX(u, y - 0.03) + 0.002), y - 0.03, zAt(u) + 0.002));
    }
    hp.unshift(V3(s * (surfX(0.006, yH) * 0.55), yH - 0.005, zAt(0.0) + 0.006));
    hp2.unshift(V3(s * (surfX(0.006, yH) * 0.55), yH - 0.035, zAt(0.0) + 0.004));
    parts.glass.push(tube(hp2, 0.042));
    parts.head.push(tube(hp, 0.018));
    // fog / lower intake accent
    // taillight: wraps from the rear quarter across the tailgate
    const yT = top(0.975) - 0.075;
    const tp = [];
    for (let k = 0; k <= 5; k++) {
      const u = 0.94 + k * 0.011, y = yT;
      tp.push(V3(s * (surfX(u, y) + 0.004), y, zAt(u) - 0.004));
    }
    tp.push(V3(s * surfX(0.999, yT) * 0.5, yT, zAt(1) - 0.008));
    parts.tail.push(tube(tp, 0.03));
    // side window trim along the belt line
    const bp = [];
    for (let k = 0; k <= 16; k++) {
      const u = c0 + 0.02 + (c1 - c0 - 0.04) * (k / 16);
      const y = top(u) + 0.006;
      bp.push(V3(s * (surfX(u, y - 0.02) * T.beltW / 0.88 * 1.04 + 0.004), y, zAt(u)));
    }
    parts.trim.push(tube(bp, 0.011));
    // mirror on a short stalk
    const mu = c0 + 0.055, my = top(mu) + 0.09, mx = surfX(mu, top(mu) - 0.02) + 0.12;
    const mir = new THREE.SphereGeometry(1, lod ? 6 : 16, lod ? 4 : 10); mir.scale(0.1, 0.065, 0.13); mir.translate(s * mx, my, zAt(mu));
    parts.paint.push(mir);
    parts.trim.push(box(0.1, 0.03, 0.06, s * (mx - 0.08), my - 0.04, zAt(mu)));
    // door handles (flush, dark)
    for (const u of [0.43, 0.63]) {
      const y = top(u) - 0.12;
      parts.trim.push(box(0.02, 0.028, 0.15, s * (surfX(u, y) + 0.004), y, zAt(u)));
    }
  }
  // grille + lower intake, plates, rocker
  const yG = bot(0.02) + 0.14;
  parts.trim.push(box(surfX(0.01, yG) * 1.3, 0.13, 0.04, 0, yG, zAt(0.0) - 0.0));
  parts.trim.push(box(surfX(0.01, yG + 0.16) * 0.9, 0.05, 0.03, 0, yG + 0.17, zAt(0.0) + 0.002));
  parts.plate.push(box(0.52, 0.11, 0.015, 0, yG, zAt(0) + 0.03));
  parts.plate.push(box(0.36, 0.18, 0.015, 0, top(0.99) - 0.24, zAt(1) - 0.012));
  parts.trim.push(box(T.W * 0.86, 0.06, L * 0.6, 0, bot(0.5) + 0.03, 0));
  parts.trim.push(box(T.W * 0.8, 0.09, 0.05, 0, bot(0.99) + 0.08, zAt(1) + 0.03));

  const out = {};
  for (const k in parts) if (parts[k].length) out[k] = merge(parts[k]);
  return (_carCache[key] = { parts: out, spec: T });
}

/** Hero car as a Group with spinnable wheels. */
export function heroCar(M, color = 0xe9e8e3, typeName = 'hatch') {
  const { parts, spec } = carParts(typeName);
  const g = new THREE.Group();
  const paint = M.paint.clone(); paint.color.set(color);
  const head = M.head.clone(), tail = M.tail.clone();
  const mats = { paint, glass: M.glass, trim: M.trim, tire: M.tire, alloy: M.alloy, head, tail, plate: M.plate, well: M.well };
  for (const k of ['paint', 'glass', 'trim', 'head', 'tail', 'plate', 'well']) {
    if (!parts[k]) continue;
    const m = new THREE.Mesh(parts[k], mats[k]); m.castShadow = k !== 'glass'; m.receiveShadow = true; g.add(m);
  }
  const T = spec;
  const wheels = [];
  for (const z of [T.L / 2 - T.uF * T.L, T.L / 2 - T.uR * T.L]) for (const side of [-1, 1]) {
    const w = wheelParts(T.r, side);
    const wg = new THREE.Group();
    wg.add(new THREE.Mesh(w.tire, M.tire), new THREE.Mesh(w.alloy, M.alloy), new THREE.Mesh(w.dark, M.darkSteel));
    wg.children.forEach((c) => { c.castShadow = true; });
    wg.position.set(side * T.track * (T.W / 1.76) * 0.99, T.r, z);
    g.add(wg); wheels.push(wg);
  }
  // contact shadow
  const cs = new THREE.Mesh(new THREE.PlaneGeometry(T.W * 1.25, T.L * 1.12), new THREE.MeshBasicMaterial({ map: contactShadowTex(), transparent: true, depthWrite: false, opacity: 0.85 }));
  cs.rotation.x = -Math.PI / 2; cs.position.y = 0.012; cs.renderOrder = -1;
  g.add(cs);
  g.userData = { wheels, radius: T.r, head, tail, spec: T };
  return g;
}

let _cst;
export function contactShadowTex() {
  if (_cst) return _cst;
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 64, 4, 32, 64, 64);
  grd.addColorStop(0, 'rgba(0,0,0,0.75)'); grd.addColorStop(0.55, 'rgba(0,0,0,0.35)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 128);
  _cst = new THREE.CanvasTexture(c);
  return _cst;
}

/** Instanced parked cars. placements: [{x,z,ry,type,color}] */
export function parkedCars(M, placements) {
  const group = new THREE.Group();
  const byType = {};
  placements.forEach((p) => (byType[p.type] = byType[p.type] || []).push(p));
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  for (const type in byType) {
    const { parts } = carParts(type, 1);
    const list = byType[type];
    for (const k in parts) {
      const mat = k === 'wheelDark' ? M.darkSteel : M[k];
      const im = new THREE.InstancedMesh(parts[k], mat, list.length);
      list.forEach((p, i) => {
        dummy.position.set(p.x, 0, p.z); dummy.rotation.set(0, p.ry, 0); dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);
        if (k === 'paint') im.setColorAt(i, col.set(p.color));
      });
      im.castShadow = k !== 'glass'; im.receiveShadow = true;
      group.add(im);
    }
    // contact shadows
    const cs = new THREE.InstancedMesh(new THREE.PlaneGeometry(2.1, 5.0).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: contactShadowTex(), transparent: true, depthWrite: false }), list.length);
    list.forEach((p, i) => { dummy.position.set(p.x, 0.011, p.z); dummy.rotation.set(0, p.ry, 0); dummy.updateMatrix(); cs.setMatrixAt(i, dummy.matrix); });
    group.add(cs);
  }
  return group;
}

/* ------------------------------------------------------------------ */
/* Containers                                                          */
/* ------------------------------------------------------------------ */
export const CONT = { L: 12.19, W: 2.44, H: 2.59 };

function remapCorrugationUV(g, rib = 0.29) {
  const p = g.getAttribute('position'), n = g.getAttribute('normal'), uv = g.getAttribute('uv');
  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i));
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (nx > 0.5) uv.setXY(i, z / rib, y);
    else if (ny > 0.5) uv.setXY(i, z / rib, x);
    else uv.setXY(i, x / rib, y);
  }
  uv.needsUpdate = true;
  return g;
}

export function containerGeometry(open = false) {
  const { L, W, H } = CONT;
  const parts = [];
  if (!open) parts.push(remapCorrugationUV(box(W - 0.06, H - 0.16, L - 0.1, 0, H / 2, 0)));
  else {
    parts.push(box(0.05, H - 0.16, L - 0.1, -(W / 2 - 0.06), H / 2, 0), box(0.05, H - 0.16, L - 0.1, W / 2 - 0.06, H / 2, 0));
    parts.push(box(W - 0.06, 0.05, L - 0.1, 0, H - 0.1, 0), box(W - 0.06, 0.05, L - 0.1, 0, 0.1, 0), box(W - 0.06, H - 0.16, 0.05, 0, H / 2, L / 2 - 0.06));
  }
  const post = 0.16;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(box(post, H, post, sx * (W / 2 - post / 2), H / 2, sz * (L / 2 - post / 2)));
  for (const sx of [-1, 1]) for (const y of [0.08, H - 0.08]) parts.push(box(0.14, 0.16, L, sx * (W / 2 - 0.07), y, 0));
  for (const sz of [-1, 1]) for (const y of [0.1, H - 0.1]) parts.push(box(W, 0.2, 0.14, 0, y, sz * (L / 2 - 0.07)));
  // door locking bars (rear, -Z)
  if (!open) for (const x of [-0.85, -0.35, 0.35, 0.85]) parts.push(cyl(0.022, 0.022, H - 0.3, 6, x, H / 2, -L / 2 - 0.02));
  parts.forEach((g) => remapCorrugationUV(g));
  return merge(parts);
}

export const CONTAINER_COLORS = ['#8b3a2b', '#1f3b5a', '#7d8287', '#2f5d46', '#b0582a', '#d4d4cf', '#5a2d2a', '#264e70', '#9a9c98', '#3b4b3f', '#a33b2f', '#c9a227'];

export function containerField(M, list) {
  // list: [{x,y,z,ry,color}]
  const geo = containerGeometry();
  const im = new THREE.InstancedMesh(geo, M.container, list.length);
  const d = new THREE.Object3D(), c = new THREE.Color();
  list.forEach((p, i) => {
    d.position.set(p.x, p.y, p.z); d.rotation.set(0, p.ry || 0, 0); d.updateMatrix();
    im.setMatrixAt(i, d.matrix);
    im.setColorAt(i, c.set(p.color));
  });
  im.castShadow = true; im.receiveShadow = true;
  return im;
}

/** Branded hero container with opening doors (doors at -Z). */
export function heroContainer(M) {
  const { L, W, H } = CONT;
  const g = new THREE.Group();
  const mat = M.container.clone(); mat.color.set('#16294a');
  const body = new THREE.Mesh(containerGeometry(true), mat); body.castShadow = true; body.receiveShadow = true;
  // hide original rear wall (doors replace it): open box variant
  g.add(body);
  const brand = brandSide();
  const nm = M.container.normalMap.clone(); nm.repeat.set((L - 0.5) / 0.29, 1); nm.needsUpdate = true;
  const sideMat = new THREE.MeshStandardMaterial({ map: brand, roughness: 0.6, metalness: 0.3, normalMap: nm, normalScale: new THREE.Vector2(0.9, 0.9) });
  for (const s of [-1, 1]) {
    const pg = new THREE.PlaneGeometry(L - 0.5, H - 0.3);
    const pl = new THREE.Mesh(pg, sideMat);
    pl.rotation.y = s * Math.PI / 2;
    pl.position.set(s * (W / 2 + 0.012), H / 2, 0);
    g.add(pl);
  }
  // doors
  const doorMat = mat.clone();
  const doors = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * (W / 2 - 0.05), 0, -L / 2 - 0.04);
    const dg = remapCorrugationUV(box(W / 2 - 0.06, H - 0.2, 0.06, -s * (W / 4 - 0.03), H / 2, 0));
    const door = new THREE.Mesh(dg, doorMat); door.castShadow = true;
    pivot.add(door);
    for (const x of [0.25, 0.75]) {
      const bar = new THREE.Mesh(cyl(0.022, 0.022, H - 0.3, 6, -s * x, H / 2, -0.05), M.chrome);
      pivot.add(bar);
    }
    g.add(pivot); doors.push({ pivot, s });
  }
  // dark interior so the opened container reads as hollow
  const inner = new THREE.Mesh(new THREE.BoxGeometry(W - 0.12, H - 0.22, L - 0.2), new THREE.MeshStandardMaterial({ color: 0x0d0f12, roughness: 1, side: THREE.BackSide }));
  inner.position.set(0, H / 2, 0);
  g.add(inner);
  g.userData.setDoors = (t) => { doors.forEach(({ pivot, s }) => { pivot.rotation.y = -s * t * Math.PI * 0.62; }); };
  g.userData.body = body;
  return g;
}

/* ------------------------------------------------------------------ */
/* Container ship                                                      */
/* ------------------------------------------------------------------ */
export const SHIP = { L: 118, B: 19, deck: 6.2, bays: [31, 18.1, 5.2, -7.7, -20.6], rows: 7, tiers: 3, slot: { bay: 2, row: 3 } };

export function ship(M) {
  const g = new THREE.Group();
  const { L, B, deck } = SHIP;
  const top = profile([[0, 8.4], [0.06, 7.2], [0.2, 6.4], [0.5, 6.2], [1, 6.6]]);
  const bot = profile([[0, 4.5], [0.03, -1.5], [0.1, -7.6], [0.3, -8.5], [0.9, -8.5], [0.97, -6], [1, -1.5]]);
  const wid = profile([[0, 0.03], [0.04, 0.3], [0.12, 0.72], [0.25, 0.97], [0.32, 1], [0.86, 1], [0.95, 0.97], [1, 0.9]]);
  const hullL = loft({
    N: 120, M: 48, z0: L / 2, z1: -L / 2,
    sec: (u) => { const w = (B / 2) * wid(u); const nn = 2.4 + 6 * Math.min(1, u * 4); return { yb: bot(u), yt: top(u), w, wt: w, n: nn }; },
  });
  const colorize = (geo) => {
    const p = geo.getAttribute('position'); const cols = [];
    const red = new THREE.Color('#7e2a22'), navy = new THREE.Color('#18263a'), white = new THREE.Color('#d9d9d4'), grey = new THREE.Color('#4f5559');
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const c = y < -0.25 ? red : y < 0.15 ? white : y > 5.95 ? grey : navy;
      cols.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    return geo;
  };
  const hullMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.35 });
  const hull = new THREE.Mesh(colorize(hullL.body), hullMat);
  hull.castShadow = true; hull.receiveShadow = true;
  g.add(hull);
  hullL.caps.forEach((c) => { const m = new THREE.Mesh(colorize(c), hullMat); m.castShadow = true; g.add(m); });

  // hatch covers
  const hatchMat = new THREE.MeshStandardMaterial({ color: 0x46524c, roughness: 0.7, metalness: 0.3 });
  SHIP.bays.forEach((z) => {
    const h = new THREE.Mesh(new THREE.BoxGeometry(B * 0.86, 0.5, 12.6), hatchMat);
    h.position.set(0, deck + 0.25, z); h.castShadow = true; h.receiveShadow = true; g.add(h);
  });
  // deck containers
  const list = [];
  const r = rng(77);
  SHIP.bays.forEach((z, bi) => {
    for (let row = 0; row < SHIP.rows; row++) {
      const x = (row - (SHIP.rows - 1) / 2) * 2.5;
      const tiers = SHIP.tiers - (r() < 0.25 ? 1 : 0);
      for (let t = 0; t < tiers; t++) {
        if (bi === SHIP.slot.bay && row === SHIP.slot.row && t === SHIP.tiers - 1) continue;
        list.push({ x, y: deck + 0.5 + t * CONT.H, z, color: CONTAINER_COLORS[(r() * CONTAINER_COLORS.length) | 0] });
      }
    }
  });
  // make sure slot has supporting stack
  g.add(containerField(M, list));

  // superstructure (stern)
  const winTex = windows({ cols: 10, rows: 6, lit: 0.05, seed: 4, base: '#e6e6e1', glass: '#2a3540' });
  winTex.repeat.set(1, 1);
  const supMat = [M.white, M.white, M.white, M.white, new THREE.MeshStandardMaterial({ map: winTex, roughness: 0.4 }), M.white];
  const sup = new THREE.Mesh(new THREE.BoxGeometry(15, 16, 9), supMat);
  sup.position.set(0, deck + 8, -L / 2 + 15); sup.castShadow = true; sup.receiveShadow = true; g.add(sup);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(B * 1.02, 1.2, 4), M.white);
  wing.position.set(0, deck + 15.4, -L / 2 + 17.5); wing.castShadow = true; g.add(wing);
  const bridgeWin = new THREE.Mesh(new THREE.BoxGeometry(B * 0.98, 1.1, 0.1), M.glass);
  bridgeWin.position.set(0, deck + 14.6, -L / 2 + 19.55); g.add(bridgeWin);
  const funnel = new THREE.Mesh(new THREE.BoxGeometry(4, 7, 5), new THREE.MeshStandardMaterial({ color: 0x18263a, roughness: 0.6 }));
  funnel.position.set(0, deck + 19, -L / 2 + 10); funnel.castShadow = true; g.add(funnel);
  const band = new THREE.Mesh(new THREE.BoxGeometry(4.05, 1.1, 5.05), M.red);
  band.position.set(0, deck + 20.5, -L / 2 + 10); g.add(band);
  const mast = new THREE.Mesh(cyl(0.18, 0.25, 9, 8), M.white);
  mast.position.set(0, deck + 20.5, -L / 2 + 16); mast.castShadow = true; g.add(mast);
  const foremast = new THREE.Mesh(cyl(0.2, 0.3, 10, 8), M.white);
  foremast.position.set(0, deck + 7, L / 2 - 9); foremast.castShadow = true; g.add(foremast);
  // forecastle bulwark
  const fc = new THREE.Mesh(new THREE.BoxGeometry(B * 0.55, 1.6, 8), new THREE.MeshStandardMaterial({ color: 0x18263a, roughness: 0.6, metalness: 0.3 }));
  fc.position.set(0, deck + 1.6, L / 2 - 10); fc.castShadow = true; g.add(fc);

  g.userData.slotLocal = new THREE.Vector3((SHIP.slot.row - (SHIP.rows - 1) / 2) * 2.5, deck + 0.5 + (SHIP.tiers - 1) * CONT.H, SHIP.bays[SHIP.slot.bay]);
  return g;
}

/* ------------------------------------------------------------------ */
/* Ship-to-shore gantry crane (spans along X, legs at x=-16 / -2)      */
/* ------------------------------------------------------------------ */
export function crane(M) {
  const g = new THREE.Group();
  const add = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  const st = [];
  const legX = [-16, -2], legZ = [-9, 9], topY = 44;
  for (const x of legX) for (const z of legZ) st.push(box(1.3, topY, 1.3, x, topY / 2, z));
  for (const x of legX) st.push(box(1.1, 1.6, 19.3, x, 15, 0), box(1.0, 1.4, 19.3, x, topY - 1, 0));
  for (const z of legZ) st.push(box(15.3, 1.6, 1.1, -9, 15, z));
  // diagonal braces on landside frame
  for (const z of legZ) {
    const d = box(0.5, 31, 0.5); d.rotateZ(Math.atan2(14, 29)); d.translate(-9, 29.5, z);
    st.push(d);
  }
  // main girders (boom + backreach)
  for (const z of [-4.6, 4.6]) st.push(box(78, 2.8, 1.5, 8, topY + 1, z));
  for (const x of [-30, -16, -2, 20, 46]) st.push(box(1.2, 1.2, 10.6, x, topY + 2.2, 0));
  // girder-to-leg cross beams
  for (const x of legX) st.push(box(1.4, 1.4, 19.3, x, topY + 0.6, 0));
  // A-frame
  const apex = new THREE.Vector3(-8, 72, 0);
  const strut = (a, b, r = 0.45) => {
    const len = a.distanceTo(b);
    const c = cyl(r, r, len, 8);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    c.applyQuaternion(q); c.translate(mid.x, mid.y, mid.z);
    return c;
  };
  for (const z of [-4.6, 4.6]) {
    st.push(strut(new THREE.Vector3(-16, topY + 2, z), apex.clone().setZ(z * 0.6), 0.6));
    st.push(strut(new THREE.Vector3(-2, topY + 2, z), apex.clone().setZ(z * 0.6), 0.6));
  }
  add(merge(st), M.steel);
  // stays
  const stays = [];
  for (const z of [-4.6, 4.6]) {
    stays.push(strut(apex.clone().setZ(z * 0.6), new THREE.Vector3(46, topY + 2.4, z), 0.12));
    stays.push(strut(apex.clone().setZ(z * 0.6), new THREE.Vector3(24, topY + 2.4, z), 0.12));
    stays.push(strut(apex.clone().setZ(z * 0.6), new THREE.Vector3(-30, topY + 2.4, z), 0.14));
  }
  add(merge(stays), M.darkSteel);
  // machinery house + stripe
  add(box(9, 5.5, 11, -24, topY + 5.2, 0), M.white);
  add(box(9.05, 0.9, 11.05, -24, topY + 3.4, 0), M.red);
  // bogies / sill
  const bog = [];
  for (const x of legX) for (const z of legZ) bog.push(box(2.2, 1.6, 5, x, 0.8, z));
  add(merge(bog), M.darkSteel);
  // trolley + cab + spreader
  const trolley = new THREE.Group();
  const tb = new THREE.Mesh(new THREE.BoxGeometry(5.5, 2.4, 7.5), M.steel); tb.position.y = topY - 0.4; tb.castShadow = true; trolley.add(tb);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(3, 2.6, 3), M.white); cabin.position.set(1, topY - 3.2, 4.6); trolley.add(cabin);
  const cabWin = new THREE.Mesh(new THREE.BoxGeometry(3.05, 1.2, 3.05), M.glass); cabWin.position.set(1, topY - 3, 4.6); trolley.add(cabWin);
  g.add(trolley);
  const spreader = new THREE.Group();
  const sp = new THREE.Mesh(merge([box(2.3, 0.45, CONT.L, 0, 0.22, 0), box(2.5, 0.8, 1.4, 0, 0.6, 0), box(0.3, 0.3, CONT.L + 0.4, 1.0, 0.25, 0), box(0.3, 0.3, CONT.L + 0.4, -1.0, 0.25, 0)]), M.yellow);
  sp.castShadow = true; spreader.add(sp);
  g.add(spreader);
  const cables = [];
  for (const sx of [-0.9, 0.9]) for (const sz of [-2.5, 2.5]) {
    const c = new THREE.Mesh(cyl(0.04, 0.04, 1, 4), M.cable); c.userData.o = [sx, sz]; g.add(c); cables.push(c);
  }
  g.userData.set = (tx, sy) => {
    trolley.position.x = tx;
    spreader.position.set(tx, sy, 0);
    const len = topY - 1.6 - (sy + 0.9);
    cables.forEach((c) => { c.scale.y = Math.max(0.1, len); c.position.set(tx + c.userData.o[0], sy + 0.9 + len / 2, c.userData.o[1]); });
  };
  g.userData.set(-9, 30);
  return g;
}

/* ------------------------------------------------------------------ */
/* Train                                                               */
/* ------------------------------------------------------------------ */
export const TRAIN = { locoL: 18.2, wagonL: 14.6, deckY: 1.42, wagons: 7 };

function bogie(M, axles, spacing) {
  const parts = [], wheels = [];
  parts.push(box(2.3, 0.45, spacing * (axles - 1) + 1.4, 0, 0.62, 0));
  for (let a = 0; a < axles; a++) {
    const z = (a - (axles - 1) / 2) * spacing;
    for (const s of [-1, 1]) wheels.push(cyl(0.46, 0.46, 0.14, 20, s * 0.76, 0.46, z, 'x'));
    parts.push(cyl(0.08, 0.08, 1.7, 8, 0, 0.46, z, 'x'));
  }
  return { frame: merge(parts), wheels: merge(wheels) };
}

export function train(M, wagonColors) {
  const g = new THREE.Group();
  const add = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x24433a, roughness: 0.45, metalness: 0.35 });
  const cream = new THREE.MeshStandardMaterial({ color: 0xe0d5b4, roughness: 0.5, metalness: 0.2 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x5a5f63, roughness: 0.6, metalness: 0.4 });
  // locomotive: centred at z=0, front at +z
  const LL = TRAIN.locoL;
  // body via extruded rounded profile (cross-section) along length
  const shape = new THREE.Shape();
  const hw = 1.55, h0 = 1.6, h1 = 4.55, rr = 0.45;
  shape.moveTo(-hw, h0); shape.lineTo(hw, h0); shape.lineTo(hw, h1 - rr);
  shape.quadraticCurveTo(hw, h1, hw - rr, h1); shape.lineTo(-hw + rr, h1); shape.quadraticCurveTo(-hw, h1, -hw, h1 - rr); shape.closePath();
  const ext = new THREE.ExtrudeGeometry(shape, { depth: LL - 1.2, bevelEnabled: true, bevelThickness: 0.6, bevelSize: 0.08, bevelSegments: 6, curveSegments: 10 });
  ext.translate(0, 0, -(LL - 1.2) / 2);
  add(ext, bodyMat);
  add(box(3.16, 0.38, LL - 1.0, 0, 2.55, 0), cream);
  add(box(2.6, 0.5, LL - 3, 0, 4.75, 0), roofMat);
  for (const z of [-5, -1, 3]) add(box(2.2, 0.35, 2.4, 0, 5.1, z), M.darkSteel);
  // cab windows (front, +z) and side windows
  add(box(2.5, 0.9, 0.1, 0, 3.75, LL / 2 + 0.05), M.glass);
  for (const s of [-1, 1]) add(box(0.1, 0.8, 1.4, s * 1.62, 3.8, LL / 2 - 1.6), M.glass);
  add(box(3.2, 0.25, 0.1, 0, 3.15, LL / 2 + 0.08), M.red);
  for (const s of [-1, 1]) add(cyl(0.13, 0.13, 0.1, 14, s * 0.9, 2.2, LL / 2 + 0.12, 'z'), M.head);
  add(box(3.1, 0.35, LL - 0.4, 0, 1.45, 0), M.darkSteel); // frame
  add(box(2.2, 0.9, 6, 0, 1.1, 0), M.darkSteel); // fuel tank
  for (const z of [-5.6, 5.6]) {
    const b = bogie(M, 3, 1.85);
    add(b.frame.clone().translate(0, 0, z), M.darkSteel); add(b.wheels.clone().translate(0, 0, z), M.rail);
  }
  add(box(0.4, 0.4, 0.5, 0, 1.2, LL / 2 + 0.3), M.darkSteel);
  // wagons
  const wagonZ = [];
  let z = -LL / 2 - 0.9 - TRAIN.wagonL / 2;
  const deckParts = [], frameParts = [], wheelParts2 = [];
  for (let i = 0; i < TRAIN.wagons; i++) {
    wagonZ.push(z);
    deckParts.push(box(2.9, 0.22, TRAIN.wagonL - 0.6, 0, TRAIN.deckY - 0.11, z));
    frameParts.push(box(0.3, 0.55, TRAIN.wagonL - 0.6, -1.25, TRAIN.deckY - 0.45, z), box(0.3, 0.55, TRAIN.wagonL - 0.6, 1.25, TRAIN.deckY - 0.45, z));
    frameParts.push(box(0.35, 0.35, 0.8, 0, 1.0, z + TRAIN.wagonL / 2 - 0.2), box(0.35, 0.35, 0.8, 0, 1.0, z - TRAIN.wagonL / 2 + 0.2));
    for (const bz of [-4.9, 4.9]) {
      const b = bogie(M, 2, 1.8);
      frameParts.push(b.frame.clone().translate(0, 0, z + bz)); wheelParts2.push(b.wheels.clone().translate(0, 0, z + bz));
    }
    z -= TRAIN.wagonL + 0.6;
  }
  add(merge(deckParts), new THREE.MeshStandardMaterial({ color: 0x3a2f28, roughness: 0.8, metalness: 0.3 }));
  add(merge(frameParts), M.darkSteel);
  add(merge(wheelParts2), M.rail);
  // containers on wagons 1.. (wagon 0 is reserved for the hero container)
  const list = [];
  for (let i = 1; i < TRAIN.wagons; i++) list.push({ x: 0, y: TRAIN.deckY, z: wagonZ[i], color: wagonColors[i % wagonColors.length] });
  g.add(containerField(M, list));
  g.userData.wagonZ = wagonZ;
  return g;
}

export function track(M, z0, z1, x) {
  const g = new THREE.Group();
  const len = z1 - z0, zc = (z0 + z1) / 2;
  const ballast = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.45, len), new THREE.MeshStandardMaterial({ color: 0x6d6862, roughness: 1 }));
  ballast.position.set(x, 0.1, zc); ballast.receiveShadow = true; g.add(ballast);
  const n = Math.floor(len / 0.65);
  const sl = new THREE.InstancedMesh(new THREE.BoxGeometry(2.6, 0.18, 0.26), new THREE.MeshStandardMaterial({ color: 0x8a847c, roughness: 0.9 }), n);
  const d = new THREE.Object3D();
  for (let i = 0; i < n; i++) { d.position.set(x, 0.38, z0 + i * 0.65); d.updateMatrix(); sl.setMatrixAt(i, d.matrix); }
  sl.receiveShadow = true; g.add(sl);
  for (const s of [-1, 1]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, len), M.rail);
    r.position.set(x + s * 0.76, 0.55, zc); r.castShadow = true; g.add(r);
  }
  return g;
}

/* ------------------------------------------------------------------ */
/* Buildings (merged boxes with window texture)                        */
/* ------------------------------------------------------------------ */
export function buildings(list, seed = 3) {
  const geos = [];
  list.forEach((b) => {
    const g = new THREE.BoxGeometry(b.w, b.h, b.d);
    const uv = g.getAttribute('uv'), n = g.getAttribute('normal');
    for (let i = 0; i < uv.count; i++) {
      const isTop = Math.abs(n.getY(i)) > 0.5;
      const span = Math.abs(n.getX(i)) > 0.5 ? b.d : b.w;
      uv.setXY(i, isTop ? 0.02 : uv.getX(i) * span / 24, isTop ? 0.02 : uv.getY(i) * b.h / 48);
    }
    g.translate(b.x, b.h / 2, b.z);
    geos.push(g);
  });
  const t = windows({ cols: 8, rows: 16, lit: 0.04, seed, base: '#bdb6aa', glass: '#6c7780' });
  const m = new THREE.Mesh(mergeGeometries(geos, false), new THREE.MeshStandardMaterial({ map: t, roughness: 0.45, metalness: 0.35 }));
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
