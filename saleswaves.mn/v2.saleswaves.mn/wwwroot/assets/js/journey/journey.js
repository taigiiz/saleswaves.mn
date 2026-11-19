// Saleswaves — scroll-driven 3D journey: Japan auction yard → port → sea → rail → Ulaanbaatar.
import * as THREE from 'three';
import { Sky } from 'three/addons/Sky.js';
import { RGBELoader } from 'three/addons/RGBELoader.js';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';
import * as T from './textures.js';
import {
  makeMaterials, heroCar, parkedCars, containerField, heroContainer, CONT, CONTAINER_COLORS,
  ship as makeShip, SHIP, crane as makeCrane, train as makeTrain, TRAIN, track, buildings,
} from './models.js';

const S = (window.SWState = window.SWState || {});
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const seg = (p, a, b) => clamp01((p - a) / (b - a));
const ease = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function initJourney(canvas, { onReady, onProgress } = {}) {
  const small = Math.min(innerWidth, innerHeight) < 700;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, small ? 1.5 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.62;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xc8d2da, 180, 1700);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.3, 8000);

  /* ---------------- Environment & light ---------------- */
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  new RGBELoader().load('assets/env/sky_1k.hdr', (hdr) => {
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = pmrem.fromEquirectangular(hdr).texture;
    hdr.dispose();
    scene.environmentIntensity = 0.7;
  });

  const sky = new Sky();
  sky.scale.setScalar(30000);
  const su = sky.material.uniforms;
  su.turbidity.value = 4.5; su.rayleigh.value = 1.1; su.mieCoefficient.value = 0.004; su.mieDirectionalG.value = 0.86;
  scene.add(sky);

  const sun = new THREE.DirectionalLight(0xffffff, 2.8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xcfdcff, 0x5d5446, 0.35);
  scene.add(hemi);

  const M = makeMaterials();

  /* ---------------- Ground, water, terrain ---------------- */
  const grassTex = T.grass();
  const landMat = new THREE.MeshStandardMaterial({ color: 0x9a9a86, map: grassTex, roughness: 1 });
  const land = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3045), landMat);
  land.rotation.x = -Math.PI / 2; land.position.set(-1500, -0.03, 0); land.receiveShadow = true;
  scene.add(land);

  const concreteTex = T.concrete();
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: concreteTex, roughness: 0.92 });
  const slab = (x0, x1, z0, z1) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 3.3, z1 - z0), concreteMat);
    m.position.set((x0 + x1) / 2, -1.65, (z0 + z1) / 2); m.receiveShadow = true; scene.add(m);
    // concrete texture repeat in world metres
    return m;
  };
  slab(-80, 0, -120, 120);
  slab(-80, 0, 1285, 1548);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.4, 3050), new THREE.MeshStandardMaterial({ color: 0x77736b, roughness: 1 }));
  wall.position.set(-0.6, -1.7, 22); scene.add(wall);

  const asphaltTex = T.asphalt();
  const asphaltMat = new THREE.MeshStandardMaterial({ map: asphaltTex, roughness: 0.95 });
  const patch = (x0, x1, z0, z1, y = 0.012) => {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
    const uv = g.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (x1 - x0) / 25, uv.getY(i) * (z1 - z0) / 25);
    const m = new THREE.Mesh(g, asphaltMat);
    m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); m.receiveShadow = true; scene.add(m);
    return m;
  };
  asphaltTex.repeat.set(1, 1);
  patch(-66, -16, -100, -24);  // auction yard
  patch(-14, -4, -100, 20);    // quay lane
  patch(-46, -12, 2950, 3060); // UB terminal

  // painted markings (instanced)
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xe8e6df, roughness: 0.8 });
  const lines = [];
  for (let r = 0; r < 4; r++) for (let i = 0; i <= 26; i++) lines.push([-22 - r * 11.5, -96 + i * 2.75, 0, 4.8]);
  for (let i = 0; i < 24; i++) lines.push([-9, -98 + i * 5, Math.PI / 2, 2.4]);
  const lineIM = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.12, 1).rotateX(-Math.PI / 2), lineMat, lines.length);
  const d0 = new THREE.Object3D();
  lines.forEach(([x, z, ry, len], i) => { d0.position.set(x - (ry ? 0 : 2.4), 0.02, z); d0.rotation.set(0, ry ? 0 : Math.PI / 2, 0); d0.scale.set(1, 1, len); d0.updateMatrix(); lineIM.setMatrixAt(i, d0.matrix); });
  lineIM.receiveShadow = true; scene.add(lineIM);

  // water
  const waterN = T.waterNormal();
  waterN.repeat.set(260, 190);
  const waterMat = new THREE.MeshPhysicalMaterial({ color: 0x14303f, roughness: 0.07, metalness: 0, normalMap: waterN, normalScale: new THREE.Vector2(0.45, 0.45), envMapIntensity: 1.2 });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(5000, 3700), waterMat);
  water.rotation.x = -Math.PI / 2; water.position.set(1000, -3, -200); water.receiveShadow = true;
  scene.add(water);

  // terrain (steppe, mountains near Ulaanbaatar)
  const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
  const vnoise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const fbm = (x, y) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < 5; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= 0.5; } return s; };
  const TZ0 = 1545, TZ1 = 4900, TX0 = -1800, TX1 = 1800;
  const tGeo = new THREE.PlaneGeometry(TX1 - TX0, TZ1 - TZ0, small ? 160 : 260, small ? 160 : 260);
  tGeo.rotateX(-Math.PI / 2);
  tGeo.translate((TX0 + TX1) / 2, 0, (TZ0 + TZ1) / 2);
  const tp = tGeo.getAttribute('position');
  const tcol = [];
  const dry = new THREE.Color('#b9a679'), green = new THREE.Color('#8f9262'), rock = new THREE.Color('#77705a'), dirt = new THREE.Color('#8f7f60');
  const ctmp = new THREE.Color();
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i), z = tp.getZ(i);
    const corr = THREE.MathUtils.smoothstep(Math.abs(x + 9), 22, 260);
    let h = corr * (fbm(x / 420, z / 420) * 34 - 10 + fbm(x / 90, z / 90) * 5);
    const ridge = THREE.MathUtils.smoothstep(z, 3500, 4300);
    h += ridge * (fbm(x / 260 + 7, z / 260) * 260 + 40) * THREE.MathUtils.smoothstep(Math.abs(x + 9), 40, 400);
    const ub = (1 - THREE.MathUtils.smoothstep(Math.hypot(x + 480, z - 3340), 380, 640));
    h = lerp(h, 0, ub);
    if (x > 0) h = lerp(-6, h, THREE.MathUtils.smoothstep(z, 1555, 1680));
    h = Math.max(h, -6);
    tp.setY(i, h);
    const n = fbm(x / 140, z / 140);
    ctmp.copy(dry).lerp(green, THREE.MathUtils.smoothstep(n, 0.35, 0.75) * 0.7);
    ctmp.lerp(rock, clamp01((h - 30) / 160));
    if (Math.abs(x + 9) < 8) ctmp.lerp(dirt, 0.5);
    tcol.push(ctmp.r, ctmp.g, ctmp.b);
  }
  tGeo.setAttribute('color', new THREE.Float32BufferAttribute(tcol, 3));
  tGeo.computeVertexNormals();
  const terrain = new THREE.Mesh(tGeo, new THREE.MeshStandardMaterial({ vertexColors: true, map: grassTex, roughness: 1 }));
  terrain.receiveShadow = true;
  scene.add(terrain);

  /* ---------------- Port A (Japan) ---------------- */
  const rnd = T.rng(2024);
  const pick = (arr, w) => { let r = rnd() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < arr.length; i++) { r -= w[i]; if (r <= 0) return arr[i]; } return arr[0]; };
  const carColors = ['#ecebe6', '#b9bcc0', '#17191c', '#55595f', '#22324f', '#5a1c22', '#cbbfa6', '#8fa6b8'];
  const carW = [36, 20, 15, 10, 6, 4, 5, 4];
  const yard = [];
  for (let r = 0; r < 4; r++) {
    for (let side = 0; side < 2; side++) {
      for (let i = 0; i < 26; i++) {
        if (rnd() < 0.08) continue;
        const x = -22 - r * 11.5 - (side ? 5.6 : 0) - 2.4 + (side ? 0 : 0);
        yard.push({ x: -22 - r * 11.5 - (side ? 7.4 : 2.4), z: -94.6 + i * 2.75, ry: side ? Math.PI / 2 : -Math.PI / 2, type: pick(['hatch', 'sedan', 'suv'], [50, 25, 25]), color: pick(carColors, carW) });
      }
    }
  }
  scene.add(parkedCars(M, small ? yard.filter((_, i) => i % 2 === 0) : yard));

  const stacks = [];
  const stackBlock = (x0, z0, rows, bays, maxT, zStep = 12.9) => {
    for (let b = 0; b < bays; b++) for (let r = 0; r < rows; r++) {
      const t = 1 + Math.floor(rnd() * maxT);
      for (let k = 0; k < t; k++) stacks.push({ x: x0 - r * 2.6, y: k * CONT.H, z: z0 + b * zStep, color: CONTAINER_COLORS[(rnd() * CONTAINER_COLORS.length) | 0] });
    }
  };
  stackBlock(-24, -12, 6, 8, 4);
  stackBlock(-44, -12, 6, 8, 4);
  stackBlock(-64, -12, 5, 8, 3);
  stackBlock(-24, 1300, 6, 9, 3, 13.2);
  stackBlock(-44, 1300, 6, 9, 4, 13.2);
  scene.add(containerField(M, stacks));

  // quay furniture
  const bollards = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.28, 0.7, 12), M.darkSteel, 30);
  for (let i = 0; i < 30; i++) { d0.position.set(-0.9, 0.35, i < 15 ? -105 + i * 15 : 1295 + (i - 15) * 16); d0.rotation.set(0, 0, 0); d0.scale.set(1, 1, 1); d0.updateMatrix(); bollards.setMatrixAt(i, d0.matrix); }
  bollards.castShadow = true; scene.add(bollards);
  const fenders = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.6, 0.6, 2.2, 16).rotateZ(Math.PI / 2).rotateY(Math.PI / 2), M.tire, 30);
  for (let i = 0; i < 30; i++) { d0.position.set(0.2, -1.6, i < 15 ? -100 + i * 15 : 1300 + (i - 15) * 16); d0.updateMatrix(); fenders.setMatrixAt(i, d0.matrix); }
  scene.add(fenders);
  // light masts
  const mastGeo = new THREE.CylinderGeometry(0.25, 0.45, 32, 10); mastGeo.translate(0, 16, 0);
  const masts = new THREE.InstancedMesh(mastGeo, M.steel, 8);
  [[-36, -104], [-60, -104], [-60, -40], [-34, 40], [-54, 40], [-34, 1350], [-54, 1450], [-30, 3010]].forEach(([x, z], i) => { d0.position.set(x, 0, z); d0.updateMatrix(); masts.setMatrixAt(i, d0.matrix); });
  masts.castShadow = true; scene.add(masts);

  const craneA = makeCrane(M); scene.add(craneA);
  const craneB = makeCrane(M); craneB.position.z = 1400; scene.add(craneB);

  /* ---------------- Ship ---------------- */
  const ship = makeShip(M);
  ship.position.set(14, -3, -5.2);
  scene.add(ship);
  const wake = new THREE.Mesh(new THREE.PlaneGeometry(26, 170), new THREE.MeshBasicMaterial({ map: T.wakeTexture(), transparent: true, depthWrite: false, opacity: 0, fog: true }));
  wake.rotation.x = -Math.PI / 2; wake.position.y = -2.96;
  scene.add(wake);

  /* ---------------- Rail + train ---------------- */
  scene.add(track(M, 1290, 3260, -9));
  const train = makeTrain(M, CONTAINER_COLORS);
  train.position.set(-9, 0.63, 1417.3);
  scene.add(train);
  const W0 = train.userData.wagonZ[0];
  // power poles along the line
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 9, 6); poleGeo.translate(0, 4.5, 0);
  const cross = new THREE.BoxGeometry(1.8, 0.12, 0.12); cross.translate(0, 8.4, 0);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x5b4a3a, roughness: 0.9 });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, 40), crosses = new THREE.InstancedMesh(cross, poleMat, 40);
  for (let i = 0; i < 40; i++) { d0.position.set(-17, 0, 1600 + i * 55); d0.updateMatrix(); poles.setMatrixAt(i, d0.matrix); crosses.setMatrixAt(i, d0.matrix); }
  poles.castShadow = true; scene.add(poles, crosses);
  // gers on the steppe
  const gerBody = new THREE.CylinderGeometry(3.2, 3.2, 2.1, 24); gerBody.translate(0, 1.05, 0);
  const gerRoof = new THREE.ConeGeometry(3.45, 1.4, 24); gerRoof.translate(0, 2.8, 0);
  const gerMat = new THREE.MeshStandardMaterial({ color: 0xece7dc, roughness: 0.95 });
  const gerSpots = [[-120, 1900], [-128, 1912], [160, 2250], [-260, 2480], [-250, 2470], [90, 2720]];
  const gb = new THREE.InstancedMesh(gerBody, gerMat, gerSpots.length), gr = new THREE.InstancedMesh(gerRoof, gerMat, gerSpots.length);
  gerSpots.forEach(([x, z], i) => { d0.position.set(x, 0, z); d0.updateMatrix(); gb.setMatrixAt(i, d0.matrix); gr.setMatrixAt(i, d0.matrix); });
  gb.castShadow = gr.castShadow = true; scene.add(gb, gr);
  // terrain heights under gers (approximate: steppe near track is gentle) — raise slightly
  gb.position.y = gr.position.y = 0;

  /* ---------------- Ulaanbaatar ---------------- */
  const city = [];
  const r2 = T.rng(9);
  for (let i = 0; i < 70; i++) {
    const x = -230 - r2() * 560, z = 3120 + r2() * 460;
    const tall = r2() < 0.12;
    city.push({ x, z, w: 20 + r2() * 30, d: 16 + r2() * 24, h: tall ? 55 + r2() * 50 : 12 + r2() * 30 });
  }
  city.push({ x: -300, z: 3180, w: 30, d: 30, h: 105 });
  scene.add(buildings(city, 5));
  const lampGeo = new THREE.CylinderGeometry(0.08, 0.12, 7, 8); lampGeo.translate(0, 3.5, 0);
  const lamps = new THREE.InstancedMesh(lampGeo, M.darkSteel, 6);
  for (let i = 0; i < 6; i++) { d0.position.set(-14, 0, 2965 + i * 16); d0.updateMatrix(); lamps.setMatrixAt(i, d0.matrix); }
  scene.add(lamps);

  /* ---------------- Hero objects ---------------- */
  const car = heroCar(M, 0x8c1c22, 'hatch');
  scene.add(car);
  const cont = heroContainer(M);
  scene.add(cont);
  const contUB = heroContainer(M);
  contUB.position.set(-26, 0.02, 2996);
  scene.add(contUB);

  /* ---------------- Timeline ---------------- */
  const P = {
    yardEnd: 0.10, driveEnd: 0.195, doorsClose: 0.214,
    lift0: 0.22, lift1: 0.27, slide1: 0.31, lower1: 0.355,
    sail0: 0.36, sail1: 0.555,
    bLift0: 0.565, bLift1: 0.595, bSlide1: 0.625, bLower1: 0.66,
    rail0: 0.665, rail1: 0.85,
    swap: 0.875, doorsUB0: 0.882, doorsUB1: 0.9, out0: 0.9, out1: 0.955,
  };
  const SH = { x: 14, y: -3, z0: -5.2, z1: 1394.8 };
  const slotY = SH.y + ship.userData.slotLocal.y;
  const deckY = 0.63 + TRAIN.deckY;
  const topY = 27.4;
  const TZ = { z0: 1400 - W0, z1: 3000 - W0 };

  const shipZ = (p) => lerp(SH.z0, SH.z1, ease(seg(p, P.sail0, P.sail1)));
  const trainZ = (p) => lerp(TZ.z0, TZ.z1, ease(seg(p, P.rail0, P.rail1)));

  function containerPos(p, out) {
    if (p < P.lift0) return out.set(-9, 0, 0);
    if (p < P.lower1) {
      if (p < P.lift1) return out.set(-9, lerp(0, topY, ease(seg(p, P.lift0, P.lift1))), 0);
      if (p < P.slide1) return out.set(lerp(-9, SH.x, ease(seg(p, P.lift1, P.slide1))), topY, 0);
      return out.set(SH.x, lerp(topY, slotY, ease(seg(p, P.slide1, P.lower1))), 0);
    }
    if (p < P.bLift0) return out.copy(ship.userData.slotLocal).applyMatrix4(ship.matrixWorld);
    if (p < P.bLower1) {
      if (p < P.bLift1) return out.set(SH.x, lerp(slotY, topY, ease(seg(p, P.bLift0, P.bLift1))), 1400);
      if (p < P.bSlide1) return out.set(lerp(SH.x, -9, ease(seg(p, P.bLift1, P.bSlide1))), topY, 1400);
      return out.set(-9, lerp(topY, deckY, ease(seg(p, P.bSlide1, P.bLower1))), 1400);
    }
    return out.set(-9, deckY, trainZ(p) + W0);
  }

  const carPos = (p, out) => {
    if (p < P.swap) return out.set(-9, 0, lerp(-45, 0, ease(seg(p, P.yardEnd, P.driveEnd))));
    return out.set(-26, 0.02, lerp(2996, 2981, ease(seg(p, P.out0, P.out1))));
  };

  /* ---------------- Camera path ---------------- */
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
  const anchors = {
    world: () => tmpA.set(0, 0, 0),
    car: (p) => carPos(p, tmpA),
    cont: (p) => containerPos(p, tmpA),
    ship: (p) => tmpA.set(SH.x, SH.y, shipZ(p)),
    train: (p) => tmpA.set(-9, 0, trainZ(p) + W0),
  };
  // [p, anchor, offset, lookOffset]
  const KEYS = [
    [0.000, 'car', V(4.4, 1.1, 6.0), V(0, 0.65, 0.2)],
    [0.040, 'car', V(-3.2, 1.6, 6.6), V(0, 0.7, 0)],
    [0.085, 'car', V(-6.8, 2.6, -1.5), V(0, 0.8, 1.5)],
    [0.140, 'car', V(-2.6, 2.6, -10.5), V(0, 0.9, 5)],
    [0.195, 'world', V(-9.6, 5.2, -27), V(-9, 1.5, 0)],
    [0.245, 'world', V(-62, 26, -64), V(-2, 14, 0)],
    [0.300, 'world', V(-80, 30, 48), V(2, 18, 0)],
    [0.355, 'world', V(-30, 34, 58), V(10, 10, 0)],
    [0.400, 'ship', V(-120, 62, -95), V(0, 6, 15)],
    [0.450, 'ship', V(175, 80, -150), V(0, 2, 20)],
    [0.505, 'ship', V(-130, 34, 175), V(0, 5, 0)],
    [0.560, 'world', V(-64, 34, 1325), V(4, 14, 1402)],
    [0.615, 'world', V(-58, 42, 1460), V(-2, 16, 1400)],
    [0.665, 'world', V(-34, 14, 1440), V(-9, 3, 1404)],
    [0.710, 'train', V(-15, 3.4, 26), V(0, 2.4, 4)],
    [0.760, 'train', V(-9.5, 2.4, -6), V(0, 2.8, 24)],
    [0.815, 'train', V(70, 85, -110), V(0, 0, 70)],
    [0.875, 'world', V(-140, 60, 2890), V(-26, 3, 2996)],
    [0.915, 'world', V(-36, 4.2, 2968), V(-26, 1.6, 2990)],
    [0.960, 'car', V(4.6, 1.3, -7.6), V(0, 0.8, 0.4)],
    [1.000, 'car', V(3.4, 1.0, -5.2), V(0, 0.72, 0)],
  ];
  const camCurve = new THREE.CatmullRomCurve3(KEYS.map(() => new THREE.Vector3()), false, 'centripetal');
  const lookCurve = new THREE.CatmullRomCurve3(KEYS.map(() => new THREE.Vector3()), false, 'centripetal');
  let fit = 1;

  function cameraAt(p) {
    KEYS.forEach(([, a, off, look], i) => {
      const base = anchors[a](p);
      camCurve.points[i].copy(base).addScaledVector(off, fit);
      lookCurve.points[i].copy(base).add(look);
    });
    let i = 0;
    while (i < KEYS.length - 2 && p > KEYS[i + 1][0]) i++;
    const w = clamp01((p - KEYS[i][0]) / (KEYS[i + 1][0] - KEYS[i][0]));
    const t = (i + w) / (KEYS.length - 1);
    camCurve.getPoint(t, camera.position);
    lookCurve.getPoint(t, tmpB);
    camera.lookAt(tmpB);
    return tmpB;
  }

  /* ---------------- Atmosphere keys ---------------- */
  const ATM = [
    // p, elevation, azimuth, sun color, fog color, exposure
    [0.00, 26, 128, '#ffe2bf', '#c3ced8', 0.6],
    [0.36, 46, 150, '#fff1de', '#c9d5de', 0.56],
    [0.62, 40, 205, '#fff0da', '#d3d4cc', 0.57],
    [0.84, 20, 236, '#ffd8a6', '#d9cbb3', 0.6],
    [1.00, 10, 248, '#ffbf86', '#dcc0a0', 0.62],
  ];
  const cA = new THREE.Color(), cB = new THREE.Color(), sunDir = new THREE.Vector3();
  function atmosphere(p) {
    let i = 0; while (i < ATM.length - 2 && p > ATM[i + 1][0]) i++;
    const a = ATM[i], b = ATM[i + 1], t = clamp01((p - a[0]) / (b[0] - a[0]));
    const el = THREE.MathUtils.degToRad(lerp(a[1], b[1], t)), az = THREE.MathUtils.degToRad(lerp(a[2], b[2], t));
    sunDir.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
    su.sunPosition.value.copy(sunDir);
    sun.color.copy(cA.set(a[3]).lerp(cB.set(b[3]), t));
    sun.intensity = 1.6 + 1.4 * Math.sin(el);
    scene.fog.color.copy(cA.set(a[4]).lerp(cB.set(b[4]), t));
    renderer.toneMappingExposure = lerp(a[5], b[5], t);
    // haze dip that hides the rail→city time skip
    const dip = Math.sin(Math.PI * seg(p, 0.85, 0.9)) ** 2;
    scene.fog.near = lerp(160, 5, dip);
    scene.fog.far = lerp(small ? 1300 : 1800, 160, dip);
  }

  /* ---------------- Resize ---------------- */
  let lastW = 0, lastH = 0;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    if (w === lastW && Math.abs(h - lastH) < 120) return;
    lastW = w; lastH = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = camera.aspect < 0.8 ? 50 : camera.aspect < 1.2 ? 42 : 34;
    fit = camera.aspect < 0.8 ? 1.3 : 1;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  /* ---------------- Frame ---------------- */
  const clock = new THREE.Clock();
  const cPos = new THREE.Vector3(), lastCar = new THREE.Vector3(-9, 0, -45);
  let p = S.journey || 0, t = 0, wheelRot = 0, first = true, shadowSpan = 0;

  function update(dt, rawDt) {
    t += dt;
    const target = S.journey || 0;
    p += (target - p) * (1 - Math.exp(-rawDt * 5));
    if (Math.abs(target - p) < 1e-5) p = target;
    onProgress && onProgress(p);

    // ship (+ gentle motion while sailing)
    const sailing = Math.sin(Math.PI * seg(p, P.sail0, P.sail1));
    ship.position.z = shipZ(p);
    ship.rotation.z = Math.sin(t * 0.6) * 0.012 * sailing;
    ship.rotation.x = Math.sin(t * 0.43) * 0.006 * sailing;
    ship.updateMatrixWorld();
    wake.position.set(SH.x, -2.95, ship.position.z - SHIP.L / 2 - 80);
    wake.material.opacity = 0.55 * sailing;

    train.position.z = trainZ(p);

    // container
    containerPos(p, cPos);
    const onTrainVisible = p < P.swap;
    cont.visible = onTrainVisible;
    cont.position.copy(cPos);
    cont.rotation.set(p >= P.lower1 && p < P.bLift0 ? ship.rotation.x : 0, 0, p >= P.lower1 && p < P.bLift0 ? ship.rotation.z : 0);
    cont.userData.setDoors(p < P.driveEnd ? 1 : 1 - ease(seg(p, P.driveEnd + 0.002, P.doorsClose)));
    contUB.visible = p >= P.swap;
    contUB.userData.setDoors(ease(seg(p, P.doorsUB0, P.doorsUB1)));

    // cranes
    const H = CONT.H;
    if (p < P.lift0) craneA.userData.set(-9, lerp(30, H, ease(seg(p, 0.2, P.lift0))));
    else if (p < P.lower1) craneA.userData.set(cPos.x, cPos.y + H);
    else craneA.userData.set(SH.x, lerp(slotY + H, 30, ease(seg(p, P.lower1, P.lower1 + 0.02))));
    if (p < P.bLift0) craneB.userData.set(SH.x, lerp(30, slotY + H, ease(seg(p, 0.545, P.bLift0))));
    else if (p < P.bLower1) craneB.userData.set(cPos.x, cPos.y + H);
    else craneB.userData.set(-9, lerp(deckY + H, 30, ease(seg(p, P.bLower1, P.bLower1 + 0.02))));

    // hero car
    carPos(p, car.position);
    car.rotation.y = p < P.swap ? 0 : Math.PI;
    car.visible = p < P.doorsClose + 0.004 || p >= P.swap;
    const dist = car.position.distanceTo(lastCar);
    if (dist < 5) wheelRot += dist / car.userData.radius * (p < P.swap ? 1 : 1);
    lastCar.copy(car.position);
    car.userData.wheels.forEach((w) => { w.rotation.x = wheelRot; });
    const lightsOn = p > 0.06 && p < P.doorsClose || p > P.doorsUB0;
    car.userData.head.emissiveIntensity = lightsOn ? 2.2 : 0.0;
    car.userData.tail.emissiveIntensity = lightsOn ? 1.2 : 0.15;

    // water motion
    waterN.offset.x = t * 0.004; waterN.offset.y = t * 0.0025;

    atmosphere(p);
    const look = cameraAt(p);

    // shadows follow what the camera looks at
    const span = THREE.MathUtils.clamp(camera.position.distanceTo(look) * 0.75, 12, 150);
    sun.target.position.copy(look);
    sun.position.copy(look).addScaledVector(sunDir, 400);
    if (Math.abs(span - shadowSpan) > 1) {
      shadowSpan = span;
      const sc = sun.shadow.camera;
      sc.left = sc.bottom = -span; sc.right = sc.top = span; sc.near = 1; sc.far = 900;
      sc.updateProjectionMatrix();
    }
  }

  let running = true;
  function loop() {
    const raw = Math.min(clock.getDelta(), 0.5), dt = Math.min(raw, 0.05);
    if (S.journeyVisible !== false || first) {
      update(dt, raw);
      renderer.render(scene, camera);
      if (first) { first = false; onReady && onReady(); }
    }
    if (running) requestAnimationFrame(loop);
  }
  // Fonts used on the container are canvas-drawn: wait a moment for webfonts.
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => requestAnimationFrame(loop));

  return {
    stop() { running = false; },
    keys: KEYS.map((k) => k[0]),
  };
}
