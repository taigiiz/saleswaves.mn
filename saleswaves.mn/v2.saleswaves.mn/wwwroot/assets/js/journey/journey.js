// Saleswaves — scroll-driven 3D journey on a relief globe built from real data:
// NASA Blue Marble imagery + SRTM/GMTED/ETOPO1 elevation, and the actual route
// Japan → Tianjin → Zamyn-Uud → Ulaanbaatar. Textures are baked by tools/build-map.mjs.
import * as THREE from 'three';
import * as G from './geo.js';

const S = (window.SWState = window.SWState || {});
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const seg = (p, a, b) => clamp01((p - a) / (b - a));
const smooth = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const D2R = Math.PI / 180;

/* ------------------------------------------------------------------ */
/* Shaders                                                             */
/* ------------------------------------------------------------------ */
const SURF_VERT = /* glsl */`
attribute vec3 aLL; // lon, lat, mercator y
varying vec2 vUv; varying vec3 vW; varying vec3 vLL;
void main() {
  vUv = uv; vLL = aLL;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

// Baked relief colour + live water glint, graticule and aerial perspective.
const SURF_FRAG = /* glsl */`
uniform sampler2D map; uniform sampler2D uNoise;
uniform vec3 uSun; uniform vec3 uHaze; uniform vec3 uDeep;
uniform float uTime; uniform float uFeather; uniform vec4 uHole;
varying vec2 vUv; varying vec3 vW; varying vec3 vLL;
void main() {
  float alpha = 1.0;
  vec3 n = normalize(vW);
  vec3 v = normalize(cameraPosition - vW);
#if defined(IS_BASE)
  vec3 c = uDeep;
  float water = 1.0;
#else
  vec2 fe = min(vUv, 1.0 - vUv);
  #if defined(IS_FAR)
    vec2 pu = vec2((vLL.x - uHole.x) / (uHole.y - uHole.x), (uHole.z - vLL.z) / (uHole.z - uHole.w));
    vec2 pe = min(pu, 1.0 - pu);
    if (min(pe.x, pe.y) > uFeather * 1.15) discard; // the detailed patch covers this area
    alpha = smoothstep(0.0, 0.05, min(fe.x, fe.y));
  #else
    alpha = smoothstep(0.0, uFeather, min(fe.x, fe.y));
  #endif
  vec3 c = texture2D(map, vUv).rgb;
  float water = smoothstep(0.0, 0.03, c.b - max(c.r, c.g) * 1.12);
#endif
  // sun glint + sky reflection on water
  vec2 q = vLL.xy * 0.37;
  vec2 wn = texture2D(uNoise, q + uTime * vec2(0.006, 0.004)).xy + texture2D(uNoise, q * 3.17 + vec2(0.31, 0.67) - uTime * vec2(0.005, 0.008)).xy - 1.0;
  vec3 e = normalize(cross(vec3(0.0, 1.0, 0.0), n));
  vec3 nw = normalize(n + (e * wn.x + cross(n, e) * wn.y) * 0.05);
  float ndv = max(dot(n, v), 0.0);
  float spec = pow(max(dot(reflect(-uSun, nw), v), 0.0), 38.0);
  float fres = pow(1.0 - ndv, 4.0);
  c += water * (spec * vec3(1.0, 0.93, 0.82) * 0.34 + fres * vec3(0.16, 0.26, 0.4) * 0.45);
  // graticule every 10 degrees
  vec2 gq = vLL.xy / 10.0;
  vec2 gl = abs(fract(gq - 0.5) - 0.5) / fwidth(gq);
  c += (1.0 - min(min(gl.x, gl.y), 1.0)) * 0.055;
  // aerial perspective toward the limb
  float hz = pow(1.0 - ndv, 2.4);
  c = mix(c, uHaze, clamp(hz * 0.95, 0.0, 0.9));
  gl_FragColor = vec4(c, alpha);
  #include <colorspace_fragment>
}`;

const ATMO_VERT = /* glsl */`
varying vec3 vN; varying vec3 vP;
void main() {
  vN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vP = mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;
const ATMO_FRAG = /* glsl */`
uniform vec3 uColor; uniform float uEdge;
varying vec3 vN; varying vec3 vP;
void main() {
  float d = -dot(normalize(vN), normalize(-vP));
  float a = pow(clamp(d / uEdge, 0.0, 1.0), 2.6);
  gl_FragColor = vec4(uColor * a, a);
  #include <colorspace_fragment>
}`;

// Screen-space constant-width lines (route, arcs, border).
const LINE_VERT = /* glsl */`
attribute vec3 aPrev; attribute vec3 aNext; attribute float aSide; attribute float aT;
uniform vec2 uRes; uniform float uWidth;
varying float vT; varying float vSide;
void main() {
  mat4 m = projectionMatrix * modelViewMatrix;
  vec4 c = m * vec4(position, 1.0), p = m * vec4(aPrev, 1.0), n = m * vec4(aNext, 1.0);
  vec2 d = (n.xy / n.w - p.xy / p.w) * uRes;
  d = normalize(d + vec2(1e-6, 0.0));
  c.xy += vec2(-d.y, d.x) * aSide * uWidth / uRes * c.w;
  gl_Position = c; vT = aT; vSide = aSide;
}`;
const LINE_FRAG = /* glsl */`
uniform vec3 uColor; uniform vec3 uRestColor; uniform float uHead; uniform float uRest; uniform float uDashes;
uniform float uOpacity; uniform float uGlow; uniform float uPulse; uniform float uPulseN; uniform float uTime;
varying float vT; varying float vSide;
void main() {
  float s = abs(vSide);
  float done = step(vT, uHead);
  float aa = mix(1.0 - smoothstep(0.5, 1.0, s), pow(1.0 - s, 2.0), uGlow);
  float dash = step(0.5, fract(vT * uDashes));
  float a = mix(uRest * dash * (1.0 - uGlow), 1.0, done) * aa * uOpacity;
  vec3 col = mix(uRestColor, uColor, done);
  float tip = smoothstep(uHead - 0.035, uHead, vT) * done;
  col = mix(col, vec3(1.0, 0.86, 0.8), tip * 0.7);
  float pulse = smoothstep(0.9, 1.0, fract(vT * uPulseN - uTime * 0.22)) * uPulse * done;
  col += pulse * 0.9;
  if (a < 0.003) discard;
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}`;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
function loadTexture(url, renderer) {
  return new Promise((res, rej) => new THREE.TextureLoader().load(url, (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
    res(t);
  }, undefined, () => rej(new Error('texture ' + url))));
}

// Height map: 0 = sea, 16..255 = sqrt-encoded land elevation (0..6000 m).
function loadHeight(url) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
      const px = g.getImageData(0, 0, c.width, c.height).data, w = c.width, h = c.height, m = new Float32Array(w * h);
      for (let i = 0; i < m.length; i++) { const v = px[i * 4]; m[i] = v < 12 ? 0 : ((v - 16) / 239) ** 2 * 6000; }
      const P = G.PATCH, yT = G.mercY(P.lat1), yB = G.mercY(P.lat0);
      // metres above sea level at (lon, lat); 0 outside the detailed patch
      res((lon, lat) => {
        const fx = (lon - P.lon0) / (P.lon1 - P.lon0) * (w - 1), fy = (yT - G.mercY(lat)) / (yT - yB) * (h - 1);
        if (fx < 0 || fy < 0 || fx > w - 1 || fy > h - 1) return 0;
        const x = Math.min(w - 2, fx | 0), y = Math.min(h - 2, fy | 0), u = fx - x, v = fy - y, k = y * w + x;
        return lerp(lerp(m[k], m[k + 1], u), lerp(m[k + w], m[k + w + 1], u), v);
      });
    };
    img.onerror = () => rej(new Error('height map'));
    img.src = url;
  });
}

// Small tileable gradient noise used to break up the sun glint on water.
function noiseTexture() {
  const n = 256, h = new Float32Array(n * n), d = new Uint8Array(n * n * 4);
  let s = 7; const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  // smooth random field: a few octaves of wrapped value noise
  for (let o = 0; o < 4; o++) {
    const c = 8 << o, g = new Float32Array(c * c).map(r), a = 1 / (1 << o);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const fx = x / n * c, fy = y / n * c, x0 = fx | 0, y0 = fy | 0, u = smooth(fx - x0), v = smooth(fy - y0), x1 = (x0 + 1) % c, y1 = (y0 + 1) % c;
      h[y * n + x] += a * lerp(lerp(g[y0 * c + x0], g[y0 * c + x1], u), lerp(g[y1 * c + x0], g[y1 * c + x1], u), v);
    }
  }
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = (y * n + x) * 4, dx = h[y * n + (x + 1) % n] - h[y * n + (x + n - 1) % n], dy = h[((y + 1) % n) * n + x] - h[((y + n - 1) % n) * n + x];
    d[i] = 127.5 + Math.max(-127, Math.min(127, dx * 900)); d[i + 1] = 127.5 + Math.max(-127, Math.min(127, dy * 900)); d[i + 2] = 255; d[i + 3] = 255;
  }
  const t = new THREE.DataTexture(d, n, n, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}

/** Grid mesh over a lon / Web-Mercator rectangle, wrapped onto the globe. alt(lon, lat, u, v) in scene units. */
function sphereGrid(B, nx, ny, alt) {
  const yT = G.mercY(B.lat1), yB = G.mercY(B.lat0), nv = (nx + 1) * (ny + 1);
  const pos = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), ll = new Float32Array(nv * 3), v3 = new THREE.Vector3();
  let k = 0;
  for (let j = 0; j <= ny; j++) {
    const v = j / ny, my = lerp(yT, yB, v), lat = G.invMercY(my);
    for (let i = 0; i <= nx; i++, k++) {
      const u = i / nx, lon = lerp(B.lon0, B.lon1, u);
      G.toVec(lon, lat, alt ? alt(lon, lat, u, v) : 0, v3);
      pos[k * 3] = v3.x; pos[k * 3 + 1] = v3.y; pos[k * 3 + 2] = v3.z;
      uv[k * 2] = u; uv[k * 2 + 1] = 1 - v;
      ll[k * 3] = lon; ll[k * 3 + 1] = lat; ll[k * 3 + 2] = my;
    }
  }
  const idx = new Uint32Array(nx * ny * 6); let q = 0;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
    idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('aLL', new THREE.BufferAttribute(ll, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return g;
}

/** Ribbon geometry for LINE_VERT. pts: Vector3[], ts: per-point parameter. Several strips can be merged via `breaks`. */
function lineGeometry(strips) {
  let n = 0; strips.forEach((s) => { n += s.pts.length; });
  const pos = new Float32Array(n * 6), prev = new Float32Array(n * 6), next = new Float32Array(n * 6), side = new Float32Array(n * 2), tt = new Float32Array(n * 2);
  const idx = []; let k = 0;
  for (const { pts, ts } of strips) {
    for (let i = 0; i < pts.length; i++, k++) {
      const p = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      for (let s = 0; s < 2; s++) {
        const o = (k * 2 + s) * 3;
        pos[o] = p.x; pos[o + 1] = p.y; pos[o + 2] = p.z;
        prev[o] = a.x; prev[o + 1] = a.y; prev[o + 2] = a.z;
        next[o] = b.x; next[o + 1] = b.y; next[o + 2] = b.z;
        side[k * 2 + s] = s ? 1 : -1; tt[k * 2 + s] = ts[i];
      }
      if (i > 0) { const c = (k - 1) * 2, d = k * 2; idx.push(c, c + 1, d, d, c + 1, d + 1); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aPrev', new THREE.BufferAttribute(prev, 3));
  g.setAttribute('aNext', new THREE.BufferAttribute(next, 3));
  g.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
  g.setAttribute('aT', new THREE.BufferAttribute(tt, 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

// Monotone-ish cubic through scalar keys [[p, v], …] with non-uniform spacing.
function spline(keys, col, p) {
  const n = keys.length;
  if (p <= keys[0][0]) return keys[0][col];
  if (p >= keys[n - 1][0]) return keys[n - 1][col];
  let i = 0; while (i < n - 2 && p > keys[i + 1][0]) i++;
  const p0 = keys[i][0], p1 = keys[i + 1][0], h = p1 - p0, t = (p - p0) / h;
  const y0 = keys[i][col], y1 = keys[i + 1][col];
  const m = (a, b) => (keys[b][col] - keys[a][col]) / (keys[b][0] - keys[a][0]);
  const d = m(i, i + 1);
  let m0 = i > 0 ? (m(i - 1, i) + d) / 2 : d, m1 = i < n - 2 ? (d + m(i + 1, i + 2)) / 2 : d;
  // limit overshoot
  if (d === 0) { m0 = 0; m1 = 0; } else { const a = m0 / d, b = m1 / d; if (a < 0) m0 = 0; if (b < 0) m1 = 0; const sq = a * a + b * b; if (sq > 9) { const tau = 3 / Math.sqrt(sq); m0 = tau * a * d; m1 = tau * b * d; } }
  const t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * h * m0 + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * h * m1;
}

/* ------------------------------------------------------------------ */
/* Journey                                                             */
/* ------------------------------------------------------------------ */
export function initJourney(canvas, { onReady, onProgress, onError } = {}) {
  const host = canvas.parentElement;
  const small = Math.min(innerWidth, innerHeight) < 700;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, small ? 1.5 : 2));
  renderer.setClearColor(0x050a13, 1);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 8, 9000);
  let running = true;

  Promise.all([
    loadTexture(small || renderer.capabilities.maxTextureSize < 4096 ? 'assets/map/relief_2k.jpg' : 'assets/map/relief_4k.jpg', renderer),
    loadTexture('assets/map/far.jpg', renderer),
    loadHeight('assets/map/height.png'),
  ]).then(([reliefTex, farTex, heightAt]) => { if (running) build(reliefTex, farTex, heightAt); })
    .catch((e) => { console.error(e); onError && onError(e); });

  function build(reliefTex, farTex, heightAt) {
    const altAt = (lon, lat) => heightAt(lon, lat) / 1000 / G.KM * G.EXAG;
    const tmp = new THREE.Vector3(), up = new THREE.Vector3(), east = new THREE.Vector3(), north = new THREE.Vector3();

    /* ---------------- Globe ---------------- */
    G.frame(123, 40, up, east, north);
    const sunDir = new THREE.Vector3().copy(up).multiplyScalar(Math.sin(34 * D2R))
      .addScaledVector(north, Math.cos(318 * D2R) * Math.cos(34 * D2R)).addScaledVector(east, Math.sin(318 * D2R) * Math.cos(34 * D2R)).normalize();
    const FEATHER = 0.035;
    const P = G.PATCH;
    const shared = {
      uNoise: { value: noiseTexture() }, uSun: { value: sunDir }, uHaze: { value: new THREE.Color('#86aede') },
      uDeep: { value: new THREE.Color('#0b1b33') }, uTime: { value: 0 }, uFeather: { value: FEATHER },
      uHole: { value: new THREE.Vector4(P.lon0, P.lon1, G.mercY(P.lat1), G.mercY(P.lat0)) },
    };
    const surf = (map, defines, extra = {}) => new THREE.ShaderMaterial({
      uniforms: { ...shared, map: { value: map } }, vertexShader: SURF_VERT, fragmentShader: SURF_FRAG, defines, ...extra,
    });
    // whole-planet base (open ocean colour), low-res surroundings, detailed relief patch
    const baseGeo = new THREE.SphereGeometry(G.RE - 0.6, 96, 64);
    baseGeo.setAttribute('aLL', new THREE.BufferAttribute(new Float32Array(baseGeo.getAttribute('position').count * 3), 3));
    const base = new THREE.Mesh(baseGeo, surf(null, { IS_BASE: 1 }));
    const far = new THREE.Mesh(sphereGrid(G.FAR, 160, 128, () => -0.3), surf(farTex, { IS_FAR: 1 }, { transparent: true, depthWrite: false }));
    far.renderOrder = 1;
    const edge = (u, v) => smooth(clamp01(Math.min(u, 1 - u, v, 1 - v) / (FEATHER * 1.6)));
    const nx = small ? 320 : 640;
    const patch = new THREE.Mesh(sphereGrid(P, nx, Math.round(nx * 0.8), (lon, lat, u, v) => altAt(lon, lat) * edge(u, v)), surf(reliefTex, {}, { transparent: true }));
    patch.renderOrder = 2;
    scene.add(base, far, patch);

    const atmo = new THREE.Mesh(new THREE.SphereGeometry(G.RE * 1.045, 96, 64), new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color('#5d9cf0') }, uEdge: { value: 0.29 } },
      vertexShader: ATMO_VERT, fragmentShader: ATMO_FRAG, side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    scene.add(atmo);

    // faint stars
    { const n = 700, sp = new Float32Array(n * 3), sc = new Float32Array(n * 3); let s = 11; const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
      for (let i = 0; i < n; i++) { const z = r() * 2 - 1, a = r() * 6.283, q = Math.sqrt(1 - z * z), b = 0.25 + r() ** 3 * 0.75; sp.set([q * Math.cos(a) * 7000, z * 7000, q * Math.sin(a) * 7000], i * 3); sc.set([b, b, b * 1.08], i * 3); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(sp, 3)); g.setAttribute('color', new THREE.BufferAttribute(sc, 3));
      scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false }))); }

    /* ---------------- Route ---------------- */
    // densify each leg with a smooth curve in lon/lat, drape it on the terrain
    const LIFT = 0.55;
    function densify(way, stepKm) {
      const c = new THREE.CatmullRomCurve3(way.map(([lon, lat]) => new THREE.Vector3(lon, lat, 0)), false, 'centripetal');
      let km = 0; for (let i = 1; i < way.length; i++) km += G.haversineKm(way[i - 1], way[i]);
      return c.getSpacedPoints(Math.ceil(km / stepKm)).map((v) => [v.x, v.y]);
    }
    const seaLL = densify(G.SEA, 6), railLL = densify(G.RAIL, 5);
    const routeLL = seaLL.concat(railLL.slice(1)), nSea = seaLL.length;
    const cum = [0]; for (let i = 1; i < routeLL.length; i++) cum.push(cum[i - 1] + G.haversineKm(routeLL[i - 1], routeLL[i]));
    const totalKm = cum[cum.length - 1], seaFrac = cum[nSea - 1] / totalKm, borderFrac = (() => {
      let best = 0, bd = 1e9; routeLL.forEach((q, i) => { const d = G.haversineKm(q, G.PLACES.border); if (d < bd) { bd = d; best = i; } }); return cum[best] / totalKm;
    })();
    const routePts = routeLL.map(([lon, lat], i) => G.toVec(lon, lat, (i < nSea - 2 ? 0 : altAt(lon, lat)) + LIFT, new THREE.Vector3()));
    const routeT = cum.map((k) => k / totalKm);
    const res = new THREE.Vector2(1, 1);
    const lineMat = (u, extra = {}) => new THREE.ShaderMaterial({
      uniforms: {
        uRes: { value: res }, uWidth: { value: 2 }, uColor: { value: new THREE.Color('#ff2b3f') }, uRestColor: { value: new THREE.Color('#ffffff') },
        uHead: { value: 0 }, uRest: { value: 0 }, uDashes: { value: 1 }, uOpacity: { value: 1 }, uGlow: { value: 0 }, uPulse: { value: 0 }, uPulseN: { value: 1 }, uTime: shared.uTime, ...u,
      },
      vertexShader: LINE_VERT, fragmentShader: LINE_FRAG, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide, ...extra,
    });
    const routeGeo = lineGeometry([{ pts: routePts, ts: routeT }]);
    const routeGlow = new THREE.Mesh(routeGeo, lineMat({ uWidth: { value: 11 }, uGlow: { value: 1 }, uOpacity: { value: 0.55 } }, { blending: THREE.AdditiveBlending }));
    const routeLine = new THREE.Mesh(routeGeo, lineMat({ uWidth: { value: 2.4 }, uRest: { value: 0.55 }, uDashes: { value: totalKm / 46 }, uPulse: { value: 0.55 }, uPulseN: { value: 5 } }));
    routeGlow.renderOrder = 5; routeLine.renderOrder = 6; routeGlow.frustumCulled = routeLine.frustumCulled = false;
    scene.add(routeGlow, routeLine);

    // auction regions across Japan → port
    const arcStrips = G.AUCTIONS.map((a) => {
      const b = G.PLACES.yokohama, km = G.haversineKm(a, b), pts = [], ts = [], n = 40;
      for (let i = 0; i <= n; i++) { const t = i / n; pts.push(G.toVec(lerp(a[0], b[0], t), lerp(a[1], b[1], t), Math.sin(Math.PI * t) * km * 0.085 / G.KM + 1.2, new THREE.Vector3())); ts.push(t); }
      return { pts, ts };
    });
    const arcs = new THREE.Mesh(lineGeometry(arcStrips), lineMat({ uWidth: { value: 1.3 }, uColor: { value: new THREE.Color('#ffffff') }, uPulse: { value: 1 }, uOpacity: { value: 0 } }));
    arcs.renderOrder = 4; arcs.frustumCulled = false; scene.add(arcs);

    // Mongolia outline
    const mnPts = G.MONGOLIA.map(([lon, lat]) => G.toVec(lon, lat, altAt(lon, lat) + 0.35, new THREE.Vector3()));
    const border = new THREE.Mesh(lineGeometry([{ pts: mnPts, ts: mnPts.map(() => 0) }]), lineMat({ uWidth: { value: 1.1 }, uColor: { value: new THREE.Color('#ffffff') }, uHead: { value: 1 }, uOpacity: { value: 0.3 } }));
    border.renderOrder = 3; border.frustumCulled = false; scene.add(border);

    // soft glow under the moving marker
    const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,120,130,1)'); gr.addColorStop(0.25, 'rgba(255,50,70,.55)'); gr.addColorStop(1, 'rgba(255,40,60,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    const headGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true }));
    headGlow.renderOrder = 7; scene.add(headGlow);

    /* ---------------- Timeline ---------------- */
    const T = { arcs0: 0.015, arcs1: 0.115, depart: 0.235, seaEnd: 0.555, railStart: 0.575, railEnd: 0.855 };
    const headFrac = (p) => p < T.seaEnd ? seaFrac * smooth(seg(p, T.depart, T.seaEnd)) : lerp(seaFrac, 1, smooth(seg(p, T.railStart, T.railEnd)));
    const headLL = [0, 0];
    function headAt(f) {
      const k = f * totalKm; let lo = 0, hi = cum.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= k) lo = m; else hi = m; }
      const t = clamp01((k - cum[lo]) / Math.max(1e-6, cum[hi] - cum[lo]));
      headLL[0] = lerp(routeLL[lo][0], routeLL[hi][0], t); headLL[1] = lerp(routeLL[lo][1], routeLL[hi][1], t);
      return headLL;
    }

    /* ---------------- Camera ---------------- */
    // [p, Δlon, Δlat (target relative to the moving marker), distance, heading°, tilt°]
    const KEYS = [
      [0.000, -2.4, 1.2, 580, 304, 43],
      [0.070, -2.1, 1.0, 480, 311, 39],
      [0.140, -1.0, 0.5, 330, 330, 41],
      [0.225, -0.2, -0.1, 210, 346, 50],
      [0.300, -1.0, 0.4, 250, 320, 54],
      [0.400, -1.9, 0.8, 320, 303, 56],
      [0.480, -1.6, 1.2, 320, 316, 54],
      [0.555, -0.6, 0.5, 235, 326, 52],
      [0.640, -0.9, 0.9, 225, 334, 56],
      [0.720, -0.6, 0.9, 222, 340, 57],
      [0.800, -0.4, 0.7, 212, 338, 56],
      [0.860, 0.0, 0.2, 180, 350, 50],
      [0.930, 10.5, -5.6, 700, 327, 30],
      [1.000, 13.5, -5.4, 860, 334, 22],
    ];
    const target = new THREE.Vector3(), fwd = new THREE.Vector3();
    let shiftX = 0, shiftY = 0, vw = 1, vh = 1, fit = 1;
    function cameraAt(p, hll) {
      const lon = hll[0] + spline(KEYS, 1, p), lat = hll[1] + spline(KEYS, 2, p);
      const dist = spline(KEYS, 3, p) * fit, hd = spline(KEYS, 4, p) * D2R, tilt = spline(KEYS, 5, p) * D2R;
      G.frame(lon, lat, up, east, north);
      G.toVec(lon, lat, 0, target);
      fwd.copy(north).multiplyScalar(Math.cos(hd)).addScaledVector(east, Math.sin(hd));
      camera.position.copy(target).addScaledVector(up, Math.cos(tilt) * dist).addScaledVector(fwd, -Math.sin(tilt) * dist);
      camera.up.copy(up).multiplyScalar(Math.sin(tilt)).addScaledVector(fwd, Math.cos(tilt));
      camera.lookAt(target);
      // keep the action clear of the text panel (left on desktop, bottom on phones)
      const wide = vw > 900;
      shiftX = wide ? lerp(0.09, -0.16, smooth(seg(p, 0.9, 0.975))) : 0;
      shiftY = wide ? 0 : 0.13;
      camera.setViewOffset(vw, vh, -shiftX * vw, shiftY * vh, vw, vh);
      return dist;
    }

    /* ---------------- DOM overlay: pins, labels, HUD ---------------- */
    const overlay = host.querySelector('#jmap');
    const marks = [];
    if (overlay) {
      G.AUCTIONS.forEach(([lon, lat]) => { const el = document.createElement('i'); el.className = 'jauc'; el.dataset.lon = lon; el.dataset.lat = lat; el.dataset.show = '0.01,0.2'; el.style.animationDelay = (-(lon * 7.3) % 2.4).toFixed(2) + 's'; overlay.prepend(el); });
      overlay.querySelectorAll('[data-lon]').forEach((el) => {
        const lon = +el.dataset.lon, lat = +el.dataset.lat, [a, b] = (el.dataset.show || '0,1').split(',').map(Number);
        marks.push({ el, pos: G.toVec(lon, lat, altAt(lon, lat) + 0.6, new THREE.Vector3()), a, b, on: null, tag: el.querySelector('p'), w: 0, left: false });
      });
    }
    const headEl = host.querySelector('#jhead');
    const head = { el: headEl, pos: new THREE.Vector3(), a: 0.115, b: 2, on: null };
    // labels flip to the left of their pin when they would run under the read-out or off-screen
    const hudBox = { l: 1e9, t: 0, b: 0 };
    function measure() {
      for (const m of marks) if (m.tag) m.w = m.tag.offsetWidth;
      if (hud.box && getComputedStyle(hud.box).opacity !== '0' && vw > 900) { const r = hud.box.getBoundingClientRect(), h = host.getBoundingClientRect(); hudBox.l = r.left - h.left; hudBox.t = r.top - h.top; hudBox.b = r.bottom - h.top; } else hudBox.l = 1e9;
    }
    if (headEl) marks.push(head);
    const hud = { coord: host.querySelector('#jhudCoord'), km: host.querySelector('#jhudKm'), total: host.querySelector('#jhudTotal'), bar: host.querySelector('#jhudBar'), box: host.querySelector('#jhud'), nodes: Array.from(host.querySelectorAll('#jhud [data-node]')), modes: Array.from(host.querySelectorAll('#jhud [data-mode]')) };
    const fmtKm = (v) => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    if (hud.total) hud.total.textContent = fmtKm(Math.round(totalKm / 10) * 10);
    const nodeAt = [0, seaFrac, borderFrac, 1];
    hud.nodes.forEach((n, i) => { n.style.left = (nodeAt[i] * 100).toFixed(2) + '%'; });
    const stops = Array.from(host.querySelectorAll('#jhud [data-stop]'));
    stops.forEach((li, i) => { const em = document.createElement('em'); em.textContent = fmtKm(Math.round(nodeAt[i] * totalKm / 10) * 10); li.insertBefore(em, li.children[1]); });
    let lastCoord = '', lastKm = '', lastMode = -1;
    const ndc = new THREE.Vector3(), toCam = new THREE.Vector3();
    function place(m) {
      toCam.copy(camera.position).sub(m.pos).normalize();
      const facing = toCam.dot(tmp.copy(m.pos).normalize());
      ndc.copy(m.pos).project(camera);
      const x = (ndc.x * 0.5 + 0.5) * vw, y = (-ndc.y * 0.5 + 0.5) * vh;
      const on = pNow >= m.a && pNow <= m.b && facing > 0.12 && ndc.z < 1 && x > -40 && x < vw + 40 && y > -40 && y < vh + 40;
      if (on) {
        m.el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
        if (m.tag) {
          const end = x + 34 + m.w, left = vw > 820 && (end > vw - 8 || (end > hudBox.l - 8 && x < hudBox.l && y > hudBox.t - 24 && y < hudBox.b + 24));
          if (left !== m.left) { m.left = left; m.el.classList.toggle('is-left', left); }
        }
      }
      if (on !== m.on) { m.on = on; m.el.classList.toggle('is-on', on); }
    }

    /* ---------------- Resize ---------------- */
    let lastW = 0, lastH = 0;
    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      if (w === lastW && Math.abs(h - lastH) < 120) return;
      lastW = w; lastH = h; vw = w; vh = h;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.fov = camera.aspect < 0.8 ? 46 : camera.aspect < 1.25 ? 38 : 30;
      fit = camera.aspect < 0.8 ? 1.12 : 1;
      camera.updateProjectionMatrix();
      res.set(w, h);
    }
    new ResizeObserver(resize).observe(canvas);
    resize();

    /* ---------------- Frame ---------------- */
    const clock = new THREE.Clock();
    let pNow = S.journey || 0, t = 0, first = true, frame = 0;
    function update(dt, rawDt) {
      t += dt;
      const goal = S.journey || 0;
      pNow += (goal - pNow) * (1 - Math.exp(-rawDt * 5));
      if (Math.abs(goal - pNow) < 1e-5) pNow = goal;
      const p = pNow;
      onProgress && onProgress(p);
      shared.uTime.value = t;

      const f = headFrac(p), hll = headAt(f);
      const dist = cameraAt(p, hll);

      // route
      routeLine.material.uniforms.uHead.value = f; routeGlow.material.uniforms.uHead.value = f;
      routeLine.material.uniforms.uRest.value = lerp(0.2, 0.6, smooth(seg(p, 0.1, 0.2)));
      arcs.material.uniforms.uHead.value = smooth(seg(p, T.arcs0, T.arcs1));
      arcs.material.uniforms.uOpacity.value = 0.85 * smooth(seg(p, 0, 0.02)) * (1 - smooth(seg(p, 0.17, 0.24)));
      border.material.uniforms.uOpacity.value = lerp(0.28, 0.8, smooth(seg(p, 0.6, 0.7)));

      // moving marker
      const sea = f < seaFrac - 1e-4;
      G.toVec(hll[0], hll[1], (sea ? 0 : altAt(hll[0], hll[1])) + LIFT, head.pos);
      headGlow.position.copy(head.pos);
      const gs = dist * (0.075 + 0.012 * Math.sin(t * 3.2)) * (p > head.a ? 1 : 0);
      headGlow.scale.set(gs, gs, 1);

      camera.updateMatrixWorld();
      if (frame++ % 45 === 0) measure();
      for (const m of marks) place(m);

      // HUD
      const mode = p < 0.13 ? 0 : p < T.depart ? 1 : p < T.seaEnd ? 2 : p < T.railStart ? 3 : p < T.railEnd ? 4 : 5;
      if (mode !== lastMode) { lastMode = mode; hud.modes.forEach((el) => el.classList.toggle('is-on', +el.dataset.mode === mode)); if (headEl) headEl.dataset.mode = mode; if (hud.box) hud.box.dataset.mode = mode; }
      const coord = `${Math.abs(hll[1]).toFixed(3)}° ${hll[1] >= 0 ? 'N' : 'S'}   ${Math.abs(hll[0]).toFixed(3)}° ${hll[0] >= 0 ? 'E' : 'W'}`;
      if (coord !== lastCoord && hud.coord) { lastCoord = coord; hud.coord.textContent = coord; }
      const km = fmtKm(f * totalKm);
      if (km !== lastKm && hud.km) { lastKm = km; hud.km.textContent = km; if (hud.bar) hud.bar.style.transform = `scaleX(${f.toFixed(4)})`; hud.nodes.forEach((n, i) => n.classList.toggle('is-done', f >= nodeAt[i] - 1e-3)); stops.forEach((n, i) => n.classList.toggle('is-done', p > head.a && f >= nodeAt[i] - 1e-3)); }
    }

    function loop() {
      if (!running) return;
      const raw = Math.min(clock.getDelta(), 0.5), dt = Math.min(raw, 0.05);
      if (S.journeyVisible !== false || first) {
        update(dt, raw);
        renderer.render(scene, camera);
        if (first) { first = false; onReady && onReady(); }
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  return { stop() { running = false; } };
}
