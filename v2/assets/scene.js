/* Saleswaves v2 — WebGL scene
   1) "Sales waves": an animated particle ocean that reacts to the pointer.
   2) A dotted Earth that rises during the #route section and draws the
      Japan → Tianjin → Ulaanbaatar shipping route as the user scrolls.
   Scroll state is written into window.SWState by ui.js. */
import * as THREE from './vendor/three.module.min.js';

const S = (window.SWState = window.SWState || { scroll: 0, hero: 0, route: 0, globe: 0 });
const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const small = Math.min(innerWidth, innerHeight) < 700 || (navigator.maxTouchPoints > 0 && innerWidth < 1100);

function ready() {
  window.SWSceneReady = true;
  window.dispatchEvent(new Event('sw:ready'));
}

function canWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) { return false; }
}

const C = {
  red: new THREE.Color('#ef3340'),
  redHot: new THREE.Color('#ff7a5c'),
  blue: new THREE.Color('#4f86ff'),
  deep: new THREE.Color('#1b3f9e'),
  ice: new THREE.Color('#bcd2ff'),
};

const deg = Math.PI / 180;
function ll2v(lat, lon, r) {
  const p = lat * deg, l = lon * deg;
  return new THREE.Vector3(r * Math.cos(p) * Math.sin(l), r * Math.sin(p), r * Math.cos(p) * Math.cos(l));
}

function init() {
  if (!canWebGL()) { root.classList.add('no-webgl'); ready(); return; }

  const canvas = document.getElementById('scene');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !small, alpha: false, powerPreference: 'high-performance' });
  } catch (e) { root.classList.add('no-webgl'); ready(); return; }

  const DPR = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.75);
  renderer.setPixelRatio(DPR);
  renderer.setClearColor(0x050b17, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 120);
  camera.position.set(0, 0, 8);

  /* ------------------------------------------------------------------ */
  /* Waves                                                                */
  /* ------------------------------------------------------------------ */
  const COLS = small ? 120 : 210, ROWS = small ? 80 : 130, SP = 0.15;
  const wPos = new Float32Array(COLS * ROWS * 3);
  let k = 0;
  for (let j = 0; j < ROWS; j++) {
    for (let i = 0; i < COLS; i++) {
      wPos[k++] = (i - COLS / 2) * SP;
      wPos[k++] = 0;
      wPos[k++] = (j - ROWS / 2) * SP;
    }
  }
  const wGeo = new THREE.BufferGeometry();
  wGeo.setAttribute('position', new THREE.BufferAttribute(wPos, 3));
  const wMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 }, uMouse: { value: new THREE.Vector2(99, 99) }, uPixel: { value: DPR },
      uAmp: { value: 1 }, uOpacity: { value: 1 },
      uC1: { value: C.deep }, uC2: { value: C.blue }, uC3: { value: C.red },
    },
    vertexShader: /* glsl */`
      uniform float uTime; uniform vec2 uMouse; uniform float uPixel; uniform float uAmp;
      varying float vH; varying float vFog;
      void main() {
        vec3 p = position; float t = uTime;
        float h = sin(p.x * 0.42 + t * 0.8) * 0.34
                + sin(p.z * 0.68 + t * 1.05) * 0.22
                + sin(p.x * 0.55 - p.z * 0.38 + t * 0.55) * 0.30
                + sin(p.x * 1.7 + p.z * 1.3 + t * 1.8) * 0.05;
        float d = distance(p.xz, uMouse);
        h += 0.55 * exp(-d * d * 0.16) * sin(d * 2.4 - t * 3.6);
        p.y += h * uAmp;
        vH = h;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uPixel * (1.0 + max(h, 0.0) * 1.1) * (30.0 / -mv.z);
        vFog = smoothstep(30.0, 7.0, -mv.z) * smoothstep(2.0, 5.0, -mv.z);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3; uniform float uOpacity;
      varying float vH; varying float vFog;
      void main() {
        vec2 c = gl_PointCoord - 0.5; float r = length(c);
        if (r > 0.5) discard;
        float a = smoothstep(0.5, 0.05, r);
        vec3 col = mix(uC1, uC2, smoothstep(-0.5, 0.25, vH));
        col = mix(col, uC3, smoothstep(0.42, 0.85, vH));
        gl_FragColor = vec4(col, a * vFog * uOpacity * (0.75 + 0.6 * smoothstep(-0.6, 0.6, vH)));
      }`,
  });
  const waves = new THREE.Points(wGeo, wMat);
  const wavesGroup = new THREE.Group();
  wavesGroup.add(waves);
  wavesGroup.position.set(0, -2.1, -5);
  scene.add(wavesGroup);

  /* ------------------------------------------------------------------ */
  /* Star dust                                                            */
  /* ------------------------------------------------------------------ */
  const SN = small ? 500 : 1100;
  const sPos = new Float32Array(SN * 3), sSeed = new Float32Array(SN);
  for (let i = 0; i < SN; i++) {
    const r = 18 + Math.random() * 30, th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 1.6 - 0.6);
    sPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    sPos[i * 3 + 1] = r * Math.cos(ph) * 0.8 + 2;
    sPos[i * 3 + 2] = -Math.abs(r * Math.sin(ph) * Math.sin(th)) - 4;
    sSeed[i] = Math.random();
  }
  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  sGeo.setAttribute('aSeed', new THREE.BufferAttribute(sSeed, 1));
  const sMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPixel: { value: DPR } },
    vertexShader: /* glsl */`
      attribute float aSeed; uniform float uTime; uniform float uPixel; varying float vA;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        vA = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * (0.6 + aSeed * 1.4) + aSeed * 40.0));
        gl_PointSize = uPixel * (1.0 + aSeed * 1.8);
      }`,
    fragmentShader: /* glsl */`
      varying float vA;
      void main() {
        float r = length(gl_PointCoord - 0.5); if (r > 0.5) discard;
        gl_FragColor = vec4(vec3(0.75, 0.83, 1.0), vA * smoothstep(0.5, 0.0, r) * 0.7);
      }`,
  });
  const stars = new THREE.Points(sGeo, sMat);
  scene.add(stars);

  /* ------------------------------------------------------------------ */
  /* Globe                                                                */
  /* ------------------------------------------------------------------ */
  const R = 2;
  const globe = new THREE.Group();     // positioned / scaled in layout()
  const spin = new THREE.Group();      // oriented toward the active region
  globe.add(spin);
  scene.add(globe);
  globe.visible = false;

  const fresnelVert = /* glsl */`
    varying vec3 vN; varying vec3 vV;
    void main() {
      vN = normalize(normalMatrix * normal);
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vV = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }`;

  const coreMat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { uOpacity: { value: 0 } },
    vertexShader: fresnelVert,
    fragmentShader: /* glsl */`
      uniform float uOpacity; varying vec3 vN; varying vec3 vV;
      void main() {
        float f = pow(1.0 - max(dot(vN, vV), 0.0), 3.2);
        vec3 col = mix(vec3(0.016, 0.04, 0.09), vec3(0.3, 0.5, 1.0), f * 0.6);
        gl_FragColor = vec4(col, uOpacity);
      }`,
  });
  const core = new THREE.Mesh(new THREE.SphereGeometry(R * 0.985, 64, 48), coreMat);
  spin.add(core);

  const atmoMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
    uniforms: { uOpacity: { value: 0 } },
    vertexShader: fresnelVert,
    fragmentShader: /* glsl */`
      uniform float uOpacity; varying vec3 vN; varying vec3 vV;
      void main() {
        float d = clamp(-dot(vN, vV), 0.0, 1.0);
        float a = pow(smoothstep(0.0, 0.62, d), 2.2);
        gl_FragColor = vec4(vec3(0.3, 0.52, 1.0), a * 0.55 * uOpacity);
      }`,
  });
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.12, 64, 48), atmoMat);
  globe.add(atmo);

  const JP = { lat: 35.44, lon: 139.64 };   // Yokohama port
  const TJ = { lat: 38.99, lon: 117.72 };   // Tianjin port (transit)
  const EL = { lat: 43.65, lon: 111.98 };   // Erenhot / Zamyn-Uud border
  const UB = { lat: 47.92, lon: 106.92 };   // Ulaanbaatar

  const dotMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: {
      uPixel: { value: DPR }, uOpacity: { value: 0 }, uScale: { value: 1 },
      uA: { value: ll2v(JP.lat, JP.lon, R) }, uB: { value: ll2v(UB.lat, UB.lon, R) },
      uBase: { value: new THREE.Color('#5f7fc4') }, uHotA: { value: C.red }, uHotB: { value: C.ice },
    },
    vertexShader: /* glsl */`
      uniform float uPixel; uniform float uScale; uniform vec3 uA; uniform vec3 uB;
      varying float vA; varying float vB;
      void main() {
        vA = smoothstep(0.75, 0.0, distance(position, uA));
        vB = smoothstep(0.85, 0.0, distance(position, uB));
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uPixel * uScale * (17.0 / -mv.z) * (1.0 + 0.5 * max(vA, vB));
      }`,
    fragmentShader: /* glsl */`
      uniform float uOpacity; uniform vec3 uBase; uniform vec3 uHotA; uniform vec3 uHotB;
      varying float vA; varying float vB;
      void main() {
        float r = length(gl_PointCoord - 0.5); if (r > 0.5) discard;
        vec3 col = mix(uBase, uHotB, vB);
        col = mix(col, uHotA, vA);
        gl_FragColor = vec4(col, smoothstep(0.5, 0.2, r) * uOpacity * (0.7 + 0.3 * max(vA, vB)));
      }`,
  });

  fetch('assets/land.b64').then((r) => r.text()).then((b64) => {
    const bin = atob(b64.trim());
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const u16 = new Uint16Array(bytes.buffer);
    const n = u16.length / 2;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const v = ll2v(u16[i * 2] / 100 - 90, u16[i * 2 + 1] / 100 - 180, R);
      pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(g, dotMat);
    pts.renderOrder = 2;
    spin.add(pts);
  }).catch(() => { /* globe still renders without land dots */ });

  // Route curve: sea leg (arched) + rail leg (low arch)
  function leg(a, b, lift, steps) {
    const va = ll2v(a.lat, a.lon, 1), vb = ll2v(b.lat, b.lon, 1), out = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const v = va.clone().lerp(vb, t).normalize();
      out.push(v.multiplyScalar(R * (1.005 + lift * Math.sin(Math.PI * t))));
    }
    return out;
  }
  const pts = [...leg(JP, TJ, 0.16, 40), ...leg(TJ, EL, 0.05, 20).slice(1), ...leg(EL, UB, 0.04, 16).slice(1)];
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');

  const arcMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uProgress: { value: 0 }, uOpacity: { value: 0 }, uRed: { value: C.red }, uBlue: { value: C.blue } },
    vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */`
      uniform float uProgress; uniform float uOpacity; uniform vec3 uRed; uniform vec3 uBlue; varying vec2 vUv;
      void main() {
        if (vUv.x > uProgress) discard;
        float head = smoothstep(uProgress - 0.1, uProgress, vUv.x);
        vec3 col = mix(uRed, uBlue, smoothstep(0.0, 1.0, vUv.x)) + head * 0.6;
        gl_FragColor = vec4(col, uOpacity * (0.6 + 0.4 * head));
      }`,
  });
  const trackMat = new THREE.MeshBasicMaterial({ color: 0x8fb0ff, transparent: true, opacity: 0, depthWrite: false });
  const tubeGeo = new THREE.TubeGeometry(curve, 240, 0.011, 8, false);
  const arc = new THREE.Mesh(tubeGeo, arcMat);
  const track = new THREE.Mesh(new THREE.TubeGeometry(curve, 240, 0.004, 6, false), trackMat);
  arc.renderOrder = 3; track.renderOrder = 3;
  spin.add(track, arc);

  // Glow sprite texture (shared)
  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();

  function makeMarker(loc, color, size) {
    const grp = new THREE.Group();
    const p = ll2v(loc.lat, loc.lon, R * 1.01);
    grp.position.copy(p);
    grp.lookAt(p.clone().multiplyScalar(2));
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.035 * size, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false }));
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.06 * size, 0.072 * size, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.setScalar(0.35 * size);
    grp.add(dot, ring, glow);
    grp.renderOrder = 4;
    spin.add(grp);
    return { grp, dot, ring, glow };
  }
  const mJP = makeMarker(JP, C.red, 1.2);
  const mTJ = makeMarker(TJ, new THREE.Color('#ffffff'), 0.6);
  const mUB = makeMarker(UB, C.blue, 1.35);
  const markers = [mJP, mTJ, mUB];

  const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: C.redHot, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  head.scale.setScalar(0.32);
  head.renderOrder = 5;
  spin.add(head);

  /* ------------------------------------------------------------------ */
  /* Layout / input                                                       */
  /* ------------------------------------------------------------------ */
  const layout = { gx: 0, gy: 0, gs: 1 };
  let lastW = 0, lastH = 0;
  function resize(force) {
    const w = innerWidth, h = innerHeight;
    if (!force && w === lastW && Math.abs(h - lastH) < 140) return; // ignore mobile URL-bar jitter
    lastW = w; lastH = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const visH = 2 * camera.position.z * Math.tan((camera.fov * deg) / 2);
    const visW = visH * camera.aspect;
    if (camera.aspect > 1.05) {
      layout.gs = Math.min(1.1, (visH * 0.31) / R);
      layout.gx = visW * 0.22;
      layout.gy = -visH * 0.02;
    } else {
      layout.gs = Math.min((visW * 0.42) / R, (visH * 0.25) / R);
      layout.gx = 0;
      layout.gy = visH * 0.17;
    }
  }
  resize(true);
  addEventListener('resize', () => resize(false));

  const mouse = { x: 0, y: 0, sx: 0, sy: 0, active: false };
  addEventListener('pointermove', (e) => {
    mouse.x = (e.clientX / innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / innerHeight) * 2 + 1;
    mouse.active = true;
  }, { passive: true });

  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 2.3);
  const hit = new THREE.Vector3();

  /* ------------------------------------------------------------------ */
  /* Loop                                                                 */
  /* ------------------------------------------------------------------ */
  const clock = new THREE.Clock();
  let t = 0, globeMix = 0, routeP = 0, first = true;
  const lerp = (a, b, f) => a + (b - a) * f;
  const camTarget = new THREE.Vector3();

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    t += dt * (reduce ? 0.25 : 1);

    mouse.sx = lerp(mouse.sx, mouse.x, 0.06);
    mouse.sy = lerp(mouse.sy, mouse.y, 0.06);
    globeMix = lerp(globeMix, S.globe || 0, reduce ? 1 : 0.06);
    routeP = lerp(routeP, S.route || 0, reduce ? 1 : 0.12);

    // camera: subtle parallax + gentle dip as the hero scrolls away
    const heroP = Math.min(1, S.hero || 0);
    camera.position.x = lerp(camera.position.x, mouse.sx * 0.45, 0.08);
    camera.position.y = lerp(camera.position.y, mouse.sy * 0.25 + heroP * 0.6, 0.08);
    camTarget.set(0, -0.35 + heroP * 0.25, 0);
    camera.lookAt(camTarget);

    // waves
    wMat.uniforms.uTime.value = t;
    wMat.uniforms.uOpacity.value = (1 - heroP * 0.55) * (1 - globeMix * 0.75);
    wMat.uniforms.uAmp.value = 1 + heroP * 0.3;
    wavesGroup.position.y = -2.1 - heroP * 0.5;
    if (mouse.active && !reduce) {
      ray.setFromCamera({ x: mouse.sx, y: mouse.sy }, camera);
      plane.constant = -wavesGroup.position.y;
      if (ray.ray.intersectPlane(plane, hit)) {
        wMat.uniforms.uMouse.value.set(hit.x - wavesGroup.position.x, hit.z - wavesGroup.position.z);
      }
    }
    sMat.uniforms.uTime.value = t;
    stars.rotation.y = t * 0.008;

    // globe
    globe.visible = globeMix > 0.003;
    if (globe.visible) {
      const e = globeMix * globeMix * (3 - 2 * globeMix);
      globe.position.set(layout.gx, layout.gy - (1 - e) * 1.6, 0);
      globe.scale.setScalar(layout.gs * (0.75 + 0.25 * e));
      const focusLon = lerp(136, 110, routeP), focusLat = lerp(33, 40, routeP);
      spin.rotation.y = -focusLon * deg + Math.sin(t * 0.25) * 0.05 + mouse.sx * 0.12 - (1 - e) * 0.8;
      spin.rotation.x = focusLat * deg - mouse.sy * 0.06;

      coreMat.uniforms.uOpacity.value = 0.96 * e;
      atmoMat.uniforms.uOpacity.value = 0.9 * e;
      dotMat.uniforms.uOpacity.value = e;
      dotMat.uniforms.uScale.value = Math.max(0.95, layout.gs);
      trackMat.opacity = 0.18 * e;
      const drawn = Math.min(1, Math.max(0, (routeP - 0.04) / 0.8));
      arcMat.uniforms.uProgress.value = drawn;
      arcMat.uniforms.uOpacity.value = e;

      const pulse = (t * 0.9) % 1;
      markers.forEach((m, i) => {
        const on = i === 0 ? 1 : i === 1 ? (drawn > 0.55 ? 1 : 0.25) : (drawn > 0.97 ? 1 : 0.35);
        m.dot.material.opacity = e * on;
        m.glow.material.opacity = e * on * 0.9;
        const ph = (pulse + i * 0.33) % 1;
        m.ring.scale.setScalar(1 + ph * 1.8);
        m.ring.material.opacity = e * on * (1 - ph) * 0.9;
      });
      if (drawn > 0.001 && drawn < 0.999) {
        head.position.copy(curve.getPointAt(drawn));
        head.material.opacity = e;
      } else if (drawn >= 0.999) {
        // arrived: a gentle traveling pulse loops along the route
        head.position.copy(curve.getPointAt((t * 0.18) % 1));
        head.material.opacity = e * 0.7;
      } else head.material.opacity = 0;
    }

    renderer.render(scene, camera);
    if (first) { first = false; ready(); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

try { init(); } catch (e) { console.error(e); root.classList.add('no-webgl'); ready(); }
