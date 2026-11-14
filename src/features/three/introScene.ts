/**
 * "Ascent" — the 3D layer of the cinematic intro (plain three.js, lazy-loaded).
 *
 *   A 0.0–2.3 s  SPARK      an ECG beat ignites a shock-wave; a star-field wakes up and begins to accelerate
 *   B 2.3–4.7 s  HELIX      full warp: the camera screws down the middle of a giant double helix of light
 *   C 4.7–6.8 s  CONVERGE   speed bleeds off, the helix collapses into a luminous halo ring behind the brand
 *   D 6.8–8.0 s  BREAKTHROUGH the ring detonates outward and the camera punches through it into the homepage
 *
 * Everything is shader-driven: ~1 000 streaks + ~1 500 helix points + rungs = 3 draw calls, all additive.
 * Colours are the existing MDQ tokens (emerald / mint / gold). Time is passed in, so the DOM layers
 * (kinetic type, logo reveal, iris reveal) share one clock with this scene and never drift.
 */
import {
  AdditiveBlending,
  BufferGeometry,
  CircleGeometry,
  Color,
  ColorManagement,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Points,
  RingGeometry,
  Scene,
  ShaderMaterial,
  TorusGeometry,
  WebGLRenderer,
} from "three";

ColorManagement.enabled = false;
const hsl = (h: number, s: number, l: number) => new Color().setHSL(h / 360, s, l);
const C = {
  accent: hsl(152, 0.7, 0.52),
  accent2: hsl(160, 0.75, 0.62),
  gold: hsl(43, 0.92, 0.62),
  deep: hsl(155, 0.7, 0.13),
};

export const ASCENT_TOTAL = 8.0;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Forward speed of the "camera" along the tunnel (world units / s). */
function speedAt(t: number) {
  return 17 * smooth(0.9, 2.3, t) * (1 - smooth(4.5, 5.8, t)) + 24 * smooth(6.8, 7.7, t);
}

// Integrate the speed once so any t maps to a travelled distance (works even if frames are skipped).
const STEP = 1 / 120;
const TRAVEL: number[] = [0];
for (let i = 1; i <= Math.ceil(ASCENT_TOTAL / STEP) + 2; i++) TRAVEL.push(TRAVEL[i - 1]! + speedAt((i - 0.5) * STEP) * STEP);
const travelAt = (t: number) => {
  const f = Math.min(Math.max(t, 0), ASCENT_TOTAL) / STEP;
  const i = Math.floor(f);
  return lerp(TRAVEL[i]!, TRAVEL[i + 1]!, f - i);
};

const HASH = /* glsl */ `float h11(float n){ return fract(sin(n * 127.1) * 43758.5453); }`;

/* Shared vertex math: position in the tunnel for a given depth "d" (0 near … L far), wrapped by travel. */
const COMMON = /* glsl */ `
uniform float uTravel; uniform float uTime; uniform float uPx; uniform float uConv; uniform float uExpand; uniform float uHelix; uniform float uRot; uniform float uLen; uniform float uAlpha;
const float L = 63.0; const float PITCH = 7.0; const float TAU = 6.2831853;
${HASH}
float wrapD(float base){ return mod(base + uTravel, L); }
float nearFar(float z){ float a = abs(z); return smoothstep(0.4, 3.5, a) * (1.0 - smoothstep(L * 0.55, L * 0.98, a)); }
vec3 ringTarget(float seed, float jitter){
  float a = seed * TAU + uTime * 0.35;
  float r = mix(1.95 + jitter * 0.12, 16.0 + jitter * 4.0, uExpand);
  return vec3(cos(a) * r, sin(a) * r, -5.0);
}
`;

const STREAK_VERT = /* glsl */ `
attribute vec4 aSeed; attribute float aEnd;
varying float vA; varying vec3 vCol;
uniform vec3 uColA; uniform vec3 uColB; uniform vec3 uGold;
${COMMON}
void main(){
  float d = wrapD(aSeed.z * L);
  float z = -(L - d);
  float ang = aSeed.x * TAU + uTime * 0.05;
  float r = mix(0.5, 13.0, pow(aSeed.y, 0.7));
  vec3 p = vec3(cos(ang) * r, sin(ang) * r, z);
  p.z -= aEnd * uLen;                 // trailing end of the streak (further from camera)
  // collapse to the ring (soft stagger) and then blow outward with it
  float c = smoothstep(0.0, 1.0, clamp(uConv * 1.5 - aSeed.w * 0.5, 0.0, 1.0));
  vec3 rt = ringTarget(aSeed.x, aSeed.w);
  p = mix(p, rt, c * step(0.55, aSeed.w));      // ~45 % of stars join the ring, the rest keep drifting as stars
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float fade = nearFar(z);
  vA = (0.25 + 0.75 * aSeed.w) * fade * uAlpha * (1.0 - 0.55 * aEnd);
  vCol = mix(uColA, uColB, aSeed.w);
  if (aSeed.w > 0.93) vCol = uGold;
}`;
const STREAK_FRAG = /* glsl */ `precision highp float; varying float vA; varying vec3 vCol; void main(){ gl_FragColor = vec4(vCol * vA, vA); }`;

/* The helix is a classic side-on double helix (axis lies across the screen, tilted), flowing along its own axis. */
const HELIX_COMMON = /* glsl */ `
uniform mat4 uHM; const float HL = 28.0; const float HP = 7.0;
vec3 helixLocal(float base, float strand, float jitter){
  float z = mod(base * HL + uTravel * 0.2, HL) - HL * 0.5;
  float ang = z / HP * TAU + strand * 3.14159265 + uRot;
  float R = mix(6.0, 1.9, uHelix) + jitter;
  return vec3(cos(ang) * R, sin(ang) * R, z);
}
float helixEnds(float z){ return 1.0 - smoothstep(8.5, 14.0, abs(z)); }
`;

const HELIX_VERT = /* glsl */ `
attribute vec4 aSeed; // x: base 0..1, y: strand, z: jitter, w: rand
varying float vA; varying float vMix;
${COMMON}
${HELIX_COMMON}
void main(){
  vec3 l = helixLocal(aSeed.x, aSeed.y, (aSeed.z - 0.5) * 0.28);
  vec3 p = (uHM * vec4(l, 1.0)).xyz;
  float c = smoothstep(0.0, 1.0, clamp(uConv * 1.6 - aSeed.w * 0.6, 0.0, 1.0));
  p = mix(p, ringTarget(aSeed.w * 7.31 + aSeed.y * 0.5, aSeed.z), c);
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float tw = 0.75 + 0.25 * sin(uTime * 3.0 + aSeed.w * 60.0);
  float depthScale = clamp(-mv.z, 1.0, 60.0);
  gl_PointSize = clamp(uPx * (2.6 + aSeed.w * 3.0) * 34.0 / depthScale, 1.4 * uPx, 16.0 * uPx);
  vA = tw * mix(helixEnds(l.z), 1.0, c) * uHelix * uAlpha;
  vMix = aSeed.y;
}`;
const HELIX_FRAG = /* glsl */ `precision highp float; varying float vA; varying float vMix; uniform vec3 uColA; uniform vec3 uColB; uniform vec3 uGold;
void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); a *= a;
  vec3 col = mix(uColA, uGold, vMix * 0.9); col = mix(col, uColB, 0.2); gl_FragColor = vec4(col * a * vA, a * vA); }`;

const RUNG_VERT = /* glsl */ `
attribute vec3 aRung; // x: base, y: side (0|1), z: rand
varying float vA;
${COMMON}
${HELIX_COMMON}
void main(){
  vec3 l = helixLocal(aRung.x, aRung.y, 0.0);
  vec3 p = (uHM * vec4(l, 1.0)).xyz;
  float c = smoothstep(0.0, 1.0, clamp(uConv * 1.6 - aRung.z * 0.6, 0.0, 1.0));
  p = mix(p, vec3(0.0, 0.0, -5.0), c);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  vA = helixEnds(l.z) * uHelix * (1.0 - c) * 0.55 * uAlpha;
}`;
const RUNG_FRAG = /* glsl */ `precision highp float; varying float vA; uniform vec3 uColA; void main(){ gl_FragColor = vec4(uColA * vA, vA); }`;

export interface AscentScene {
  render(t: number): void;
  resize(): void;
  dispose(): void;
}

export function createAscentScene({ canvas, lowPower, onContextLost }: { canvas: HTMLCanvasElement; lowPower: boolean; onContextLost?: () => void }): AscentScene | null {
  try {
    const probe = document.createElement("canvas");
    const gl = probe.getContext("webgl2") || probe.getContext("webgl");
    if (!gl) return null;
    (gl as WebGLRenderingContext).getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    return null;
  }
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: lowPower ? "default" : "high-performance" });
  } catch {
    return null;
  }
  renderer.setClearColor(0x000000, 0);
  const maxDpr = lowPower ? 1.5 : 2;
  const scene = new Scene();
  const camera = new PerspectiveCamera(58, 1, 0.1, 90);

  let seedState = 90210;
  const rand = () => {
    seedState = (seedState * 1664525 + 1013904223) >>> 0;
    return seedState / 4294967296;
  };

  const shared = () => ({
    uTravel: { value: 0 },
    uTime: { value: 0 },
    uPx: { value: 1 },
    uConv: { value: 0 },
    uExpand: { value: 0 },
    uHelix: { value: 0 },
    uRot: { value: 0 },
    uLen: { value: 0.1 },
    uAlpha: { value: 1 },
    uColA: { value: C.accent2.clone() },
    uColB: { value: C.accent.clone() },
    uGold: { value: C.gold.clone() },
    uHM: { value: new Matrix4() },
  });
  const U = shared(); // one uniform set shared by every layer
  const make = (vertexShader: string, fragmentShader: string) =>
    new ShaderMaterial({ vertexShader, fragmentShader, uniforms: U, transparent: true, depthWrite: false, blending: AdditiveBlending });

  /* star streaks: two vertices per streak (aEnd 0 | 1) */
  const streakCount = lowPower ? 520 : 1100;
  const sPos: number[] = [];
  const sSeed: number[] = [];
  const sEnd: number[] = [];
  for (let i = 0; i < streakCount; i++) {
    const s = [rand(), rand(), rand(), rand()];
    for (const e of [0, 1]) {
      sPos.push(0, 0, 0);
      sSeed.push(...s);
      sEnd.push(e);
    }
  }
  const streakGeo = new BufferGeometry();
  streakGeo.setAttribute("position", new Float32BufferAttribute(sPos, 3));
  streakGeo.setAttribute("aSeed", new Float32BufferAttribute(sSeed, 4));
  streakGeo.setAttribute("aEnd", new Float32BufferAttribute(sEnd, 1));
  const streakMat = make(STREAK_VERT, STREAK_FRAG);
  const streaks = new LineSegments(streakGeo, streakMat);
  streaks.frustumCulled = false;
  scene.add(streaks);

  /* helix: two strands of points + rungs */
  const perStrand = lowPower ? 520 : 1000;
  const hPos: number[] = [];
  const hSeed: number[] = [];
  for (let strand = 0; strand < 2; strand++) {
    for (let i = 0; i < perStrand; i++) {
      hPos.push(0, 0, 0);
      hSeed.push(i / perStrand, strand, rand(), rand());
    }
  }
  const helixGeo = new BufferGeometry();
  helixGeo.setAttribute("position", new Float32BufferAttribute(hPos, 3));
  helixGeo.setAttribute("aSeed", new Float32BufferAttribute(hSeed, 4));
  const helixMat = make(HELIX_VERT, HELIX_FRAG);
  const helix = new (Points as unknown as new (g: BufferGeometry, m: ShaderMaterial) => Points)(helixGeo, helixMat);
  helix.frustumCulled = false;
  scene.add(helix);

  const rungCount = lowPower ? 70 : 126;
  const rPos: number[] = [];
  const rAttr: number[] = [];
  for (let i = 0; i < rungCount; i++) {
    const base = i / rungCount;
    const r = rand();
    for (const side of [0, 1]) {
      rPos.push(0, 0, 0);
      rAttr.push(base, side, r);
    }
  }
  const rungGeo = new BufferGeometry();
  rungGeo.setAttribute("position", new Float32BufferAttribute(rPos, 3));
  rungGeo.setAttribute("aRung", new Float32BufferAttribute(rAttr, 3));
  const rungMat = make(RUNG_VERT, RUNG_FRAG);
  const rungs = new LineSegments(rungGeo, rungMat);
  rungs.frustumCulled = false;
  scene.add(rungs);

  /* spark shock-wave + halo ring + lens glow (all at the "brand plane", z = -5) */
  const shock = new Mesh(new RingGeometry(0.96, 1, 128), new MeshBasicMaterial({ color: C.accent2, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }));
  shock.position.z = -4;
  scene.add(shock);
  const glowMat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uI: { value: 0 }, uA: { value: C.accent.clone() }, uG: { value: C.gold.clone() }, uMix: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `precision highp float; varying vec2 vUv; uniform float uI; uniform vec3 uA; uniform vec3 uG; uniform float uMix;
      void main(){ float d = length(vUv - 0.5) * 2.0; float g = pow(max(0.0, 1.0 - d), 2.2); float core = pow(max(0.0, 1.0 - d * 2.2), 3.0);
        vec3 col = mix(uA, uG, uMix) * g + vec3(1.0, 1.0, 0.92) * core * 0.9; gl_FragColor = vec4(col * uI, (g + core) * uI); }`,
  });
  const glow = new Mesh(new CircleGeometry(5, 48), glowMat);
  glow.position.z = -5.6;
  scene.add(glow);

  const halo = new Group();
  halo.position.z = -5;
  const haloMats: MeshBasicMaterial[] = [];
  const haloGeos: BufferGeometry[] = [new TorusGeometry(2.05, 0.011, 8, 200), new TorusGeometry(2.4, 0.005, 6, 160), new TorusGeometry(1.7, 0.006, 6, 160)];
  haloGeos.forEach((g, i) => {
    const m = new MeshBasicMaterial({ color: i === 1 ? C.gold : C.accent2, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false });
    haloMats.push(m);
    const mesh = new Mesh(g, m);
    mesh.rotation.x = [0.9, -0.7, 0.3][i]!;
    mesh.rotation.y = [0.2, 0.9, -0.8][i]!;
    halo.add(mesh);
  });
  scene.add(halo);

  const hm = new Matrix4();
  const rotY = new Matrix4().makeRotationY(Math.PI / 2);

  /* sizing */
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    U.uPx.value = dpr;
  };
  resize();
  const lost = (e: Event) => {
    e.preventDefault();
    onContextLost?.();
  };
  canvas.addEventListener("webglcontextlost", lost);

  return {
    resize,
    render(t) {
      const warp = smooth(1.0, 3.0, t) * (1 - smooth(4.6, 5.8, t));
      U.uTime.value = t;
      U.uTravel.value = travelAt(t);
      U.uAlpha.value = smooth(0.5, 1.6, t);
      U.uLen.value = 0.08 + speedAt(t) * 0.07;
      U.uHelix.value = smooth(1.9, 3.1, t) * (1 - 0.0 * smooth(5.2, 5.8, t));
      U.uRot.value = t * 0.8;
      U.uConv.value = smooth(4.5, 5.9, t);
      U.uExpand.value = smooth(6.8, 7.75, t);

      // helix pose: axis across the screen, tilted; it straightens and recentres as it collapses into the halo
      const off = 1 - U.uConv.value;
      hm.makeRotationZ(0.42 * off - 0.12).multiply(rotY);
      hm.setPosition(0, 1.5 * off, -11 - 2 * (1 - off));
      (U.uHM.value as Matrix4).copy(hm);

      // camera: FOV opens up into warp, gentle roll, then dives through the ring
      const dive = smooth(6.7, 7.9, t);
      camera.fov = lerp(52, 82, warp) + dive * 14;
      camera.updateProjectionMatrix();
      camera.position.set(Math.sin(t * 0.6) * 0.18 * (1 - dive), Math.cos(t * 0.5) * 0.12 * (1 - dive), -dive * 7.2);
      camera.rotation.set(0, 0, Math.sin(t * 0.45) * 0.16 * warp + t * 0.0);
      camera.lookAt(camera.position.x * 0.3, camera.position.y * 0.3, -20);
      camera.rotation.z += Math.sin(t * 0.45) * 0.16 * warp;

      // spark: shock-wave from the ECG beat (≈1.0 s) + heartbeat-style flare behind the logo
      const sw = smooth(1.0, 2.5, t);
      shock.scale.setScalar(0.2 + sw * 16);
      (shock.material as MeshBasicMaterial).opacity = sw > 0 && sw < 1 ? (1 - sw) * 0.85 : 0;
      const beat = (x: number, c: number, w: number) => Math.exp(-Math.pow((x - c) / w, 2));
      const spark = 0.9 * beat(t, 0.95, 0.09) + 0.5 * beat(t, 1.2, 0.08);
      const reveal = smooth(4.7, 5.3, t) * (1 - smooth(6.8, 7.4, t));
      glowMat.uniforms.uI!.value = Math.min(1.4, spark + 0.18 * smooth(0.2, 1.0, t) * (1 - smooth(1.4, 2.2, t)) + 0.9 * beat(t, 4.95, 0.28) + 0.3 * reveal + 0.9 * beat(t, 6.95, 0.25));
      glowMat.uniforms.uMix!.value = smooth(4.7, 5.4, t) * 0.55;
      glow.scale.setScalar(1 + 0.5 * dive);

      const ringA = smooth(5.0, 5.9, t) * (1 - smooth(6.9, 7.5, t));
      haloMats.forEach((m, i) => (m.opacity = ringA * [0.9, 0.5, 0.45][i]!));
      halo.visible = ringA > 0.003;
      halo.rotation.z = t * 0.5;
      halo.children.forEach((c, i) => {
        c.rotation.x += 0.004 * (i + 1);
        c.rotation.y += 0.003 * (3 - i);
      });
      halo.scale.setScalar(1 + 0.6 * smooth(6.8, 7.6, t));

      renderer.render(scene, camera);
    },
    dispose() {
      canvas.removeEventListener("webglcontextlost", lost);
      [streakGeo, helixGeo, rungGeo, ...haloGeos, shock.geometry, glow.geometry].forEach((g) => g.dispose());
      [streakMat, helixMat, rungMat, glowMat, shock.material as MeshBasicMaterial, ...haloMats].forEach((m) => m.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
