/**
 * Procedural 3D anatomical heart + particle / HUD layers, rendered with plain three.js.
 *
 * Why procedural? No licensed heart model could be bundled in this build, and a hand-authored mesh
 * needs no download, no decoder (Draco/KTX) and no extra request. The geometry is built from
 * deformed ellipsoids (ventricles, atria, appendages) and tube curves (aorta + arch branches,
 * pulmonary trunk and arteries, vena cavae, pulmonary veins, coronary arteries) merged into ONE
 * mesh = one draw call. Colours are the existing MDQ tokens (tokens.css) – nothing new.
 *
 * This module is loaded lazily (dynamic import) so three.js never blocks the first render.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  ColorManagement,
  DoubleSide,
  Euler,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
  WebGLRenderer,
  CircleGeometry,
} from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// The shaders output the MDQ token colours as written in tokens.css (raw sRGB): no conversion.
ColorManagement.enabled = false;

const hsl = (h: number, s: number, l: number) => new Color().setHSL(h / 360, s, l);
/** Existing MDQ tokens (src/styles/tokens.css), expressed as three.js colours. */
export const PALETTE = {
  bgDeep: hsl(159, 1, 0.06), // --dark-background
  surface2: hsl(156, 0.6, 0.13), // --surface-2
  surface3: hsl(150, 0.45, 0.17), // --surface-3
  cta: hsl(139, 0.45, 0.24), // --cta-color
  accent: hsl(152, 0.7, 0.52), // --accent
  accent2: hsl(160, 0.75, 0.62), // --accent-2
  gold: hsl(43, 0.92, 0.62), // --gold
};

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* ------------------------------------------------------------------------------------------ */
/* Geometry                                                                                   */
/* ------------------------------------------------------------------------------------------ */

const KIND = { muscle: 0, vessel: 1, coronary: 2 } as const;

function pseudoNoise(x: number, y: number, z: number) {
  return (
    Math.sin(x * 3.1 + Math.sin(y * 2.3 + z)) * Math.sin(y * 2.9 + z * 2.3 + x * 0.7) * Math.sin(z * 3.3 + x * 1.3 + y) * 0.7 +
    Math.sin(x * 6.7 + y * 5.1 + z * 4.3) * 0.3
  );
}

function finish(geometry: BufferGeometry, kind: number): BufferGeometry {
  geometry.deleteAttribute("uv");
  geometry.deleteAttribute("normal");
  const merged = mergeVertices(geometry, 1e-4);
  merged.computeVertexNormals();
  const count = merged.getAttribute("position").count;
  merged.setAttribute("aKind", new BufferAttribute(new Float32Array(count).fill(kind), 1));
  return merged;
}

interface BlobSpec {
  c: [number, number, number];
  r: [number, number, number];
  rot?: [number, number, number];
  taper?: number;
  amp?: number;
  seed?: number;
}

function blob(spec: BlobSpec, seg: number): BufferGeometry {
  const g = new SphereGeometry(1, seg, Math.round(seg * 0.75));
  const pos = g.getAttribute("position");
  const euler = new Euler(...(spec.rot ?? [0, 0, 0]));
  const v = new Vector3();
  const seed = spec.seed ?? 0;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = pseudoNoise(v.x * 2 + seed, v.y * 2 + seed * 0.7, v.z * 2 - seed);
    const grow = 1 + (spec.amp ?? 0.035) * n;
    // Taper toward the bottom so the ventricles end in an apex.
    const down = smooth(-0.15, 1, -v.y);
    const s = 1 - (spec.taper ?? 0) * Math.pow(down, 1.15);
    v.x *= s * grow;
    v.z *= s * grow;
    v.y *= grow;
    v.set(v.x * spec.r[0], v.y * spec.r[1], v.z * spec.r[2]).applyEuler(euler).add(new Vector3(...spec.c));
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  return finish(g, KIND.muscle);
}

function tube(points: [number, number, number][], radius: number, kind: number, seg: number): BufferGeometry[] {
  // Coronary vessels hug the myocardium: pull them slightly toward the heart's axis so they sit on the surface.
  const inset = kind === KIND.coronary ? 0.9 : 1;
  points = points.map(([x, y, z]) => [x * inset, y, z * inset] as [number, number, number]);
  const curve = new CatmullRomCurve3(points.map((p) => new Vector3(...p)), false, "catmullrom", 0.5);
  const radial = seg >= 48 ? 14 : 8;
  const body = finish(new TubeGeometry(curve, Math.max(24, Math.round(points.length * 14)), radius, radial, false), kind);
  const capA = new SphereGeometry(radius, radial, 8).translate(...points[0]!);
  const capB = new SphereGeometry(radius, radial, 8).translate(...points[points.length - 1]!);
  return [body, finish(capA, kind), finish(capB, kind)];
}

export function buildHeartGeometry(quality: "high" | "low"): BufferGeometry {
  const seg = quality === "high" ? 64 : 40;
  const parts: BufferGeometry[] = [];

  // Muscle: left & right ventricles, atria and the two auricles.
  parts.push(blob({ c: [0.3, -0.18, -0.08], r: [0.64, 1.0, 0.6], rot: [0, 0, 0.34], taper: 0.62, seed: 1 }, seg)); // LV
  parts.push(blob({ c: [-0.3, -0.22, 0.3], r: [0.56, 0.86, 0.46], rot: [0.1, 0, 0.26], taper: 0.55, seed: 2 }, seg)); // RV
  parts.push(blob({ c: [-0.78, 0.28, 0.02], r: [0.4, 0.52, 0.4], rot: [0, 0, 0.1], amp: 0.05, seed: 3 }, seg)); // RA
  parts.push(blob({ c: [-0.55, 0.62, 0.38], r: [0.2, 0.24, 0.18], rot: [0, 0, 0.5], amp: 0.06, seed: 4 }, 24)); // RA appendage
  parts.push(blob({ c: [0.34, 0.6, -0.52], r: [0.6, 0.38, 0.4], amp: 0.04, seed: 5 }, seg)); // LA
  parts.push(blob({ c: [0.74, 0.5, 0.12], r: [0.2, 0.28, 0.16], rot: [0, 0, -0.5], amp: 0.06, seed: 6 }, 24)); // LA appendage

  // Great vessels.
  parts.push(...tube([[0.02, 0.5, -0.02], [0.02, 1.05, -0.04], [0.2, 1.48, -0.1], [0.56, 1.58, -0.24], [0.88, 1.32, -0.4], [0.98, 0.8, -0.5], [0.98, 0.2, -0.56]], 0.2, KIND.vessel, seg)); // aorta
  parts.push(...tube([[0.02, 1.4, -0.08], [-0.08, 1.8, -0.06], [-0.1, 2.0, -0.06]], 0.085, KIND.vessel, seg)); // brachiocephalic
  parts.push(...tube([[0.28, 1.52, -0.14], [0.32, 1.86, -0.12], [0.34, 2.0, -0.12]], 0.07, KIND.vessel, seg)); // L carotid
  parts.push(...tube([[0.5, 1.58, -0.22], [0.66, 1.84, -0.2], [0.78, 1.94, -0.2]], 0.07, KIND.vessel, seg)); // L subclavian
  parts.push(...tube([[0.08, 0.3, 0.4], [0.1, 0.62, 0.38], [0.2, 0.92, 0.3]], 0.17, KIND.vessel, seg)); // pulmonary trunk
  parts.push(...tube([[0.2, 0.92, 0.3], [0.58, 1.1, 0.12], [0.98, 1.08, -0.16]], 0.12, KIND.vessel, seg)); // L pulmonary artery
  parts.push(...tube([[0.2, 0.92, 0.3], [-0.2, 1.0, -0.12], [-0.6, 0.98, -0.3], [-0.98, 0.94, -0.34]], 0.11, KIND.vessel, seg)); // R pulmonary artery
  parts.push(...tube([[-0.74, 0.6, 0.02], [-0.76, 1.1, -0.02], [-0.76, 1.62, -0.06]], 0.16, KIND.vessel, seg)); // SVC
  parts.push(...tube([[-0.7, -0.06, -0.02], [-0.68, -0.5, -0.08], [-0.66, -0.9, -0.1]], 0.16, KIND.vessel, seg)); // IVC
  parts.push(...tube([[0.7, 0.6, -0.66], [1.05, 0.72, -0.76], [1.32, 0.8, -0.82]], 0.075, KIND.vessel, seg)); // pulmonary veins
  parts.push(...tube([[0.62, 0.4, -0.7], [1.0, 0.3, -0.82], [1.3, 0.26, -0.9]], 0.075, KIND.vessel, seg));
  parts.push(...tube([[0.0, 0.7, -0.8], [-0.36, 0.78, -0.96], [-0.66, 0.86, -1.04]], 0.075, KIND.vessel, seg));
  parts.push(...tube([[0.04, 0.46, -0.78], [-0.32, 0.4, -0.96], [-0.62, 0.36, -1.04]], 0.075, KIND.vessel, seg));

  // Coronary arteries and cardiac veins (thin, bright).
  parts.push(...tube([[0.04, 0.46, 0.42], [0.1, 0.1, 0.62], [0.2, -0.38, 0.58], [0.36, -0.82, 0.38], [0.44, -1.02, 0.2]], 0.021, KIND.coronary, seg)); // LAD
  parts.push(...tube([[-0.14, 0.52, 0.36], [-0.52, 0.5, 0.5], [-0.9, 0.18, 0.42], [-1.0, -0.2, 0.2], [-0.8, -0.66, -0.02]], 0.022, KIND.coronary, seg)); // RCA
  parts.push(...tube([[0.3, 0.52, 0.2], [0.7, 0.32, 0.2], [1.0, -0.02, -0.12], [0.98, -0.4, -0.34]], 0.019, KIND.coronary, seg)); // circumflex
  parts.push(...tube([[0.36, -0.2, 0.58], [0.62, -0.28, 0.46], [0.84, -0.4, 0.2]], 0.015, KIND.coronary, seg)); // diagonal

  const merged = mergeGeometries(parts, false)!;
  parts.forEach((g) => g.dispose());
  merged.computeBoundingBox();
  const center = new Vector3();
  merged.boundingBox!.getCenter(center);
  merged.translate(-center.x, -center.y, -center.z);
  merged.computeBoundingSphere();
  return merged;
}

/* ------------------------------------------------------------------------------------------ */
/* Shaders                                                                                    */
/* ------------------------------------------------------------------------------------------ */

const NOISE_GLSL = /* glsl */ `
float hash31(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash31(i), hash31(i + vec3(1,0,0)), f.x), mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x), mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y), f.z);
}`;

const HEART_VERT = /* glsl */ `
attribute float aKind;
uniform float uBeat;
varying vec3 vN; varying vec3 vW; varying vec3 vP; varying float vKind;
void main(){
  vec3 p = position + normal * uBeat * 0.02;
  vec4 w = modelMatrix * vec4(p, 1.0);
  vW = w.xyz; vP = position; vKind = aKind;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const HEART_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uBase; uniform vec3 uRim; uniform vec3 uAccent; uniform vec3 uGold; uniform vec3 uCam;
uniform float uTime; uniform float uBeat; uniform float uOpacity; uniform float uDissolve; uniform float uScanY; uniform float uScanOn; uniform float uDim;
varying vec3 vN; varying vec3 vW; varying vec3 vP; varying float vKind;
${NOISE_GLSL}
void main(){
  vec3 N = normalize(vN);
  vec3 V = normalize(uCam - vW);
  if (!gl_FrontFacing) N = -N;
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  float fres = pow(1.0 - ndv, 2.3);
  vec3 L1 = normalize(vec3(-0.55, 0.8, 0.75));
  vec3 L2 = normalize(vec3(0.85, -0.25, 0.35));
  float d1 = max(dot(N, L1), 0.0);
  float d2 = max(dot(N, L2), 0.0);
  float spec = pow(max(dot(reflect(-L1, N), V), 0.0), 26.0);
  float fiber = vnoise(vP * vec3(8.0, 12.0, 8.0));
  float stripes = 0.5 + 0.5 * sin((vP.x * 0.7 + vP.y * 1.5 + fiber * 0.55) * 30.0);
  float muscle = vKind < 0.5 ? 1.0 : 0.35;
  vec3 col = uBase * (0.32 + d1 * 0.95 + d2 * 0.4);
  col *= 0.92 + 0.14 * stripes * muscle;
  float contour = smoothstep(0.455, 0.5, abs(fract(vP.y * 13.0) - 0.5));
  col += uAccent * contour * 0.2;
  col += uRim * fres * (0.95 + 0.7 * uBeat);
  col += vec3(0.75, 1.0, 0.88) * spec * 0.35;
  float sb = exp(-pow((vW.y - uScanY) * 5.2, 2.0)) * uScanOn;
  col += uAccent * sb * 0.9;
  if (vKind > 1.5) col = mix(col, uGold, 0.82) + uGold * 0.12;
  else if (vKind > 0.5) col = mix(col, uAccent * 0.7, 0.18);
  col *= uDim;

  float dn = vnoise(vP * 3.4 + 4.0) * 0.8 + (1.0 - (vP.y * 0.4 + 0.5)) * 0.2;
  float t = dn - uDissolve * 1.25;
  if (t < 0.0) discard;
  float edge = (1.0 - smoothstep(0.0, 0.09, t)) * step(0.001, uDissolve);
  col += uGold * edge * 1.6;
  gl_FragColor = vec4(col, uOpacity);
}`;

const PARTICLE_VERT = /* glsl */ `
attribute vec4 aSeed; attribute vec3 aHeart; attribute vec3 aRing;
uniform float uTime; uniform float uAssemble; uniform float uRing; uniform float uSize; uniform float uPx; uniform float uRotY;
uniform vec3 uHeartPos; uniform float uHeartScale; uniform float uAssembleFrac; uniform float uSpread;
varying float vA; varying float vGold; varying float vMix;
void main(){
  vec3 free = (aSeed.xyz * 2.0 - 1.0) * vec3(6.2, 3.4, 3.4) * uSpread;
  free += vec3(sin(uTime * 0.3 + aSeed.x * 6.283), cos(uTime * 0.25 + aSeed.y * 6.283), sin(uTime * 0.2 + aSeed.z * 6.283)) * 0.3;
  free.y += sin(uTime * 0.18 + aSeed.w * 12.0) * 0.18;
  float c = cos(uRotY), s = sin(uRotY);
  vec3 h = vec3(aHeart.x * c + aHeart.z * s, aHeart.y, -aHeart.x * s + aHeart.z * c) * uHeartScale + uHeartPos;
  h += vec3(sin(uTime * 1.3 + aSeed.x * 20.0), cos(uTime * 1.1 + aSeed.y * 20.0), 0.0) * 0.012;
  float role = step(aSeed.w, uAssembleFrac);
  float a = smoothstep(0.0, 1.0, clamp(uAssemble * 1.7 - aSeed.x * 0.7, 0.0, 1.0)) * role;
  vec3 pos = mix(free, h, a);
  float r = smoothstep(0.0, 1.0, clamp(uRing * 1.6 - aSeed.y * 0.6, 0.0, 1.0));
  float ang = uTime * 0.5 * uRing;
  float rc = cos(ang), rs = sin(ang);
  vec3 ringP = vec3(aRing.x * rc - aRing.y * rs, aRing.x * rs + aRing.y * rc, aRing.z);
  pos = mix(pos, ringP, r);
  pos += vec3(-pos.y, pos.x, 0.0) * 0.28 * sin(r * 3.14159);
  vec4 mv = viewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  float tw = 0.65 + 0.35 * sin(uTime * (1.5 + aSeed.z * 2.0) + aSeed.x * 40.0);
  float big = mix(1.0, 2.1, r);
  gl_PointSize = clamp(uSize * uPx * (0.45 + aSeed.w * 0.9) * big * 34.0 / -mv.z, 1.5 * uPx, 22.0 * uPx);
  vA = tw * (0.35 + 0.65 * aSeed.z);
  vGold = step(0.92, aSeed.z);
  vMix = aSeed.x;
}`;

const PARTICLE_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uColA; uniform vec3 uColB; uniform vec3 uGold; uniform float uAlpha;
varying float vA; varying float vGold; varying float vMix;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d); a *= a;
  vec3 col = mix(uColA, uColB, vMix);
  col = mix(col, uGold, vGold * 0.85);
  gl_FragColor = vec4(col * a * vA * uAlpha, a * vA * uAlpha);
}`;

/* ------------------------------------------------------------------------------------------ */
/* Scene                                                                                      */
/* ------------------------------------------------------------------------------------------ */

export type HeartMode = "intro" | "hero";

export interface HeartScene {
  /** Render one intro frame for time t (seconds). */
  renderIntro(t: number): void;
  /** Render one hero frame. */
  renderHero(timeSec: number): void;
  setPointer(x: number, y: number): void;
  resize(): void;
  dispose(): void;
}

export interface HeartSceneOptions {
  canvas: HTMLCanvasElement;
  mode: HeartMode;
  /** Mobile / low-end: fewer particles, lower pixel ratio, lighter geometry. */
  lowPower: boolean;
  onContextLost?: () => void;
}

export const INTRO_TOTAL = 7.8;

function beatCurve(t: number, period: number) {
  // "lub-dub": two quick pulses followed by rest.
  const p = (t % period) / period;
  const lub = Math.exp(-Math.pow((p - 0.08) / 0.045, 2));
  const dub = 0.6 * Math.exp(-Math.pow((p - 0.27) / 0.05, 2));
  return Math.min(1, lub + dub);
}

export function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    const ok = !!gl;
    (gl as WebGLRenderingContext | null)?.getExtension("WEBGL_lose_context")?.loseContext();
    return ok;
  } catch {
    return false;
  }
}

export function createHeartScene({ canvas, mode, lowPower, onContextLost }: HeartSceneOptions): HeartScene | null {
  // Probe first so a device without WebGL falls back silently (three.js would otherwise log errors).
  if (!hasWebGL()) return null;
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: !lowPower, alpha: true, powerPreference: lowPower ? "default" : "high-performance" });
  } catch {
    return null;
  }
  renderer.setClearColor(0x000000, 0);
  const maxDpr = lowPower ? 1.5 : 2;
  const scene = new Scene();
  const camera = new PerspectiveCamera(38, 1, 0.1, 60);
  const quality = lowPower ? "low" : "high";

  /* Heart */
  const heartGeometry = buildHeartGeometry(quality);
  const heartMaterial = new ShaderMaterial({
    vertexShader: HEART_VERT,
    fragmentShader: HEART_FRAG,
    transparent: true,
    uniforms: {
      uBase: { value: PALETTE.surface3.clone().lerp(PALETTE.cta, 0.45).multiplyScalar(1.5) },
      uRim: { value: PALETTE.accent.clone().multiplyScalar(0.78) },
      uAccent: { value: PALETTE.accent2.clone() },
      uGold: { value: PALETTE.gold.clone() },
      uCam: { value: new Vector3() },
      uTime: { value: 0 },
      uBeat: { value: 0 },
      uOpacity: { value: 1 },
      uDissolve: { value: 0 },
      uScanY: { value: 0 },
      uScanOn: { value: 0 },
      uDim: { value: 1 },
    },
  });
  const heart = new Mesh(heartGeometry, heartMaterial);
  const heartGroup = new Group();
  heart.rotation.set(0.12, 0, -0.1);
  heartGroup.add(heart);
  scene.add(heartGroup);

  /* Particles */
  const count = mode === "hero" ? (lowPower ? 220 : 520) : lowPower ? 520 : 1300;
  const seeds = new Float32Array(count * 4);
  const heartPts = new Float32Array(count * 3);
  const ringPts = new Float32Array(count * 3);
  const base = new Float32Array(count * 3); // positions attribute (unused but required)
  const hp = heartGeometry.getAttribute("position");
  const hn = heartGeometry.getAttribute("normal");
  const rot = new Euler(0.12, 0, -0.1);
  const tmp = new Vector3();
  const nrm = new Vector3();
  let rngState = 1337;
  const rand = () => {
    rngState = (rngState * 1664525 + 1013904223) >>> 0;
    return rngState / 4294967296;
  };
  const ringR = 1.75;
  for (let i = 0; i < count; i++) {
    seeds.set([rand(), rand(), rand(), rand()], i * 4);
    const vi = Math.floor(rand() * hp.count);
    tmp.fromBufferAttribute(hp, vi);
    nrm.fromBufferAttribute(hn, vi);
    tmp.addScaledVector(nrm, 0.03 + rand() * 0.07).applyEuler(rot);
    heartPts.set([tmp.x, tmp.y, tmp.z], i * 3);
    const a = rand() * Math.PI * 2;
    const rr = ringR + (rand() - 0.5) * 0.16;
    ringPts.set([Math.cos(a) * rr, Math.sin(a) * rr, (rand() - 0.5) * 0.18], i * 3);
  }
  const particleGeometry = new BufferGeometry();
  particleGeometry.setAttribute("position", new Float32BufferAttribute(base, 3));
  particleGeometry.setAttribute("aSeed", new Float32BufferAttribute(seeds, 4));
  particleGeometry.setAttribute("aHeart", new Float32BufferAttribute(heartPts, 3));
  particleGeometry.setAttribute("aRing", new Float32BufferAttribute(ringPts, 3));
  const particleMaterial = new ShaderMaterial({
    vertexShader: PARTICLE_VERT,
    fragmentShader: PARTICLE_FRAG,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uAssemble: { value: 0 },
      uRing: { value: 0 },
      uSize: { value: lowPower ? 1.15 : 1 },
      uPx: { value: 1 },
      uRotY: { value: 0 },
      uHeartPos: { value: new Vector3() },
      uHeartScale: { value: 1 },
      uAssembleFrac: { value: 0.38 },
      uSpread: { value: 1 },
      uColA: { value: PALETTE.accent2.clone() },
      uColB: { value: PALETTE.accent.clone() },
      uGold: { value: PALETTE.gold.clone() },
      uAlpha: { value: 1 },
    },
  });
  const particles = new Points(particleGeometry, particleMaterial);
  particles.frustumCulled = false;
  scene.add(particles);

  /* Holographic scan ring + data nodes */
  const hud = new Group();
  const hudMats: (MeshBasicMaterial | LineBasicMaterial)[] = [];
  const addMesh = (geo: BufferGeometry, color: Color, opacity: number, double = false) => {
    const m = new MeshBasicMaterial({ color, transparent: true, opacity, blending: AdditiveBlending, depthWrite: false });
    if (double) m.side = DoubleSide;
    m.userData.base = opacity;
    hudMats.push(m);
    const mesh = new Mesh(geo, m);
    hud.add(mesh);
    return mesh;
  };
  const scanGroup = new Group();
  scanGroup.rotation.x = Math.PI / 2 - 0.22;
  hud.add(scanGroup);
  const ringGeos: BufferGeometry[] = [];
  const torusA = new TorusGeometry(1.72, 0.012, 8, lowPower ? 96 : 160);
  const torusB = new TorusGeometry(1.5, 0.005, 6, 128);
  const disc = new CircleGeometry(1.72, 64);
  ringGeos.push(torusA, torusB, disc);
  const mA = addMesh(torusA, PALETTE.accent2, 0.9);
  const mB = addMesh(torusB, PALETTE.accent, 0.5);
  const mD = addMesh(disc, PALETTE.accent, 0.07, true);
  [mA, mB, mD].forEach((m) => {
    hud.remove(m);
    scanGroup.add(m);
  });
  // tick marks
  const tickPos: number[] = [];
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    const r0 = 1.8;
    const r1 = i % 8 === 0 ? 1.97 : 1.88;
    tickPos.push(Math.cos(a) * r0, Math.sin(a) * r0, 0, Math.cos(a) * r1, Math.sin(a) * r1, 0);
  }
  const tickGeo = new BufferGeometry().setAttribute("position", new Float32BufferAttribute(tickPos, 3));
  const tickMat = new LineBasicMaterial({ color: PALETTE.accent2, transparent: true, opacity: 0.55, blending: AdditiveBlending, depthWrite: false });
  tickMat.userData.base = 0.55;
  hudMats.push(tickMat);
  scanGroup.add(new LineSegments(tickGeo, tickMat));

  // floating data nodes + constellation lines
  const nodeCount = lowPower ? 10 : 16;
  const nodePos: Vector3[] = [];
  for (let i = 0; i < nodeCount; i++) {
    const a = rand() * Math.PI * 2;
    const y = (rand() - 0.5) * 3.2;
    const r = 1.95 + rand() * 0.6;
    nodePos.push(new Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
  }
  const linePos: number[] = [];
  nodePos.forEach((p, i) => {
    const near = nodePos
      .map((q, j) => ({ j, d: p.distanceTo(q) }))
      .filter((o) => o.j !== i)
      .sort((x, y) => x.d - y.d)
      .slice(0, 2);
    near.forEach((o) => {
      if (o.j > i) linePos.push(p.x, p.y, p.z, nodePos[o.j]!.x, nodePos[o.j]!.y, nodePos[o.j]!.z);
    });
  });
  const lineGeo = new BufferGeometry().setAttribute("position", new Float32BufferAttribute(linePos, 3));
  const lineMat = new LineBasicMaterial({ color: PALETTE.accent, transparent: true, opacity: 0.35, blending: AdditiveBlending, depthWrite: false });
  lineMat.userData.base = 0.35;
  hudMats.push(lineMat);
  const nodeGeo = new BufferGeometry().setFromPoints(nodePos);
  const nodeMat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uPx: { value: 1 }, uAlpha: { value: 0 }, uCol: { value: PALETTE.accent2.clone() }, uGold: { value: PALETTE.gold.clone() }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `uniform float uPx; uniform float uTime; varying float vI;
      void main(){ vI = fract(sin(dot(position, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = (7.0 + 4.0 * sin(uTime * 2.0 + vI * 30.0)) * uPx * 4.2 / -mv.z; }`,
    fragmentShader: /* glsl */ `precision highp float; uniform vec3 uCol; uniform vec3 uGold; uniform float uAlpha; varying float vI;
      void main(){ float d = length(gl_PointCoord - 0.5); float core = smoothstep(0.5, 0.0, d); float ring = smoothstep(0.5, 0.42, d) * smoothstep(0.3, 0.4, d);
        vec3 c = vI > 0.85 ? uGold : uCol; gl_FragColor = vec4(c * (core * core + ring * 0.8) * uAlpha, (core + ring) * uAlpha); }`,
  });
  const nodes = new Points(nodeGeo, nodeMat);
  nodes.frustumCulled = false;
  hud.add(nodes);
  hud.add(new LineSegments(lineGeo, lineMat));
  scene.add(hud);

  // Portal: a thin luminous ring (plus soft halo) that the particles gather around in scene 4.
  const portalGeo = new TorusGeometry(ringR, 0.016, 8, 200);
  const haloGeo = new TorusGeometry(ringR, 0.16, 8, 200);
  const portalMat = new MeshBasicMaterial({ color: PALETTE.accent2, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false });
  const haloMat = new MeshBasicMaterial({ color: PALETTE.accent, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false });
  const portal = new Group();
  portal.add(new Mesh(portalGeo, portalMat), new Mesh(haloGeo, haloMat));
  portal.visible = false;
  scene.add(portal);

  /* Sizing */
  let width = 1;
  let height = 1;
  let fitZ = 6;
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // Keep the whole heart (≈ 3.4 wide, 3.4 tall incl. HUD ring) inside the frame at any aspect ratio.
    const t = Math.tan((camera.fov * Math.PI) / 360);
    fitZ = Math.max(7.2, 4.1 / (2 * t * Math.min(1, camera.aspect)) + 0.4);
    if (mode === "hero") fitZ = Math.max(6.2, 5.2 / (2 * t * Math.min(1.15, camera.aspect)) + 0.3);
    camera.updateProjectionMatrix();
    particleMaterial.uniforms.uPx!.value = dpr;
    nodeMat.uniforms.uPx!.value = dpr;
  };
  resize();

  const lost = (e: Event) => {
    e.preventDefault();
    onContextLost?.();
  };
  canvas.addEventListener("webglcontextlost", lost);

  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  const setHud = (alpha: number) => {
    hudMats.forEach((m) => (m.opacity = (m.userData.base as number) * alpha));
    nodeMat.uniforms.uAlpha!.value = alpha;
    hud.visible = alpha > 0.002;
  };

  const camPos = new Vector3();
  const look = new Vector3();

  const draw = (time: number) => {
    camera.lookAt(look);
    camera.updateMatrixWorld();
    camPos.copy(camera.position);
    (heartMaterial.uniforms.uCam!.value as Vector3).copy(camPos);
    heartMaterial.uniforms.uTime!.value = time;
    particleMaterial.uniforms.uTime!.value = time;
    nodeMat.uniforms.uTime!.value = time;
    renderer.render(scene, camera);
  };

  const applyHeartTransform = (opts: { y: number; z: number; scale: number; beat: number; rotY: number; tiltX: number }) => {
    const squeeze = 1 + opts.beat * 0.035;
    heartGroup.position.set(0, opts.y, opts.z);
    heartGroup.scale.setScalar(opts.scale * squeeze);
    heartGroup.rotation.set(opts.tiltX, opts.rotY, 0);
    heartMaterial.uniforms.uBeat!.value = opts.beat;
    particleMaterial.uniforms.uRotY!.value = opts.rotY;
    (particleMaterial.uniforms.uHeartPos!.value as Vector3).set(0, opts.y, opts.z);
    particleMaterial.uniforms.uHeartScale!.value = opts.scale;
  };

  return {
    setPointer(x, y) {
      pointer.x = x;
      pointer.y = y;
    },
    resize,

    renderIntro(t) {
      const assemble = smooth(0.1, 2.3, t);
      const emerge = smooth(0.7, 2.3, t);
      const beatOn = smooth(1.3, 2.2, t);
      const beat = beatCurve(Math.max(0, t - 1.3), 0.96) * beatOn;
      const back = smooth(3.9, 5.2, t);
      const dissolve = smooth(6.1, 7.2, t);
      const ring = smooth(6.0, 7.05, t);
      const fly = smooth(6.75, 7.75, t);
      const flyE = fly * fly * (3 - 2 * fly);

      const scanOn = smooth(1.9, 2.5, t) * (1 - smooth(4.1, 4.7, t));
      heartMaterial.uniforms.uScanOn!.value = scanOn;
      heartMaterial.uniforms.uScanY!.value = Math.sin((t - 2) * 2.1) * 0.85;
      heartMaterial.uniforms.uOpacity!.value = emerge * (1 - 0.35 * back);
      heartMaterial.uniforms.uDissolve!.value = dissolve;
      heartMaterial.uniforms.uDim!.value = 1 - 0.38 * back;
      particleMaterial.uniforms.uAssemble!.value = assemble;
      particleMaterial.uniforms.uRing!.value = ring;
      particleMaterial.uniforms.uAlpha!.value = 0.35 + 0.65 * smooth(0, 1.2, t);

      applyHeartTransform({
        y: lerp(0.0, 0.15, back),
        z: lerp(0, -2.6, back),
        scale: lerp(0.84, 1, emerge) * lerp(1, 0.9, back),
        beat,
        rotY: 0.5 + t * 0.42,
        tiltX: 0.06,
      });

      const portalA = smooth(6.35, 7.0, t) * (1 - smooth(7.35, 7.7, t));
      portal.visible = portalA > 0.002;
      portalMat.opacity = portalA * 0.9;
      haloMat.opacity = portalA * 0.07;
      portal.rotation.z = t * 0.5;
      portal.scale.setScalar(1 + 0.04 * Math.sin(t * 6));

      // HUD: scanning ring + data nodes during scene 2, fading as the heart recedes.
      const hudAlpha = smooth(2.0, 2.7, t) * (1 - smooth(4.6, 5.6, t));
      setHud(hudAlpha);
      scanGroup.position.y = Math.sin((t - 2) * 2.1) * 0.85;
      scanGroup.scale.setScalar(1 - 0.12 * Math.abs(Math.sin((t - 2) * 2.1)));
      scanGroup.rotation.z = t * 0.6;
      hud.rotation.y = t * 0.18;

      // Camera: slow dolly-in with a little sway; then flies through the portal ring at z = 0.
      const dolly = fitZ - 0.7 * smooth(0, 6, t);
      camera.position.set(Math.sin(t * 0.5) * 0.28 * (1 - flyE), 0.12 + Math.cos(t * 0.4) * 0.08, lerp(dolly, -1.4, flyE));
      look.set(0, 0, lerp(-1, -6, flyE));
      draw(t);
    },

    renderHero(time) {
      pointer.sx += (pointer.x - pointer.sx) * 0.06;
      pointer.sy += (pointer.y - pointer.sy) * 0.06;
      const beat = beatCurve(time, 1.05);
      heartMaterial.uniforms.uScanOn!.value = 0.55 * smooth(0, 1, 0.5 + 0.5 * Math.sin(time * 0.8));
      heartMaterial.uniforms.uScanY!.value = Math.sin(time * 0.8) * 0.9;
      heartMaterial.uniforms.uOpacity!.value = 1;
      heartMaterial.uniforms.uDissolve!.value = 0;
      heartMaterial.uniforms.uDim!.value = 1;
      particleMaterial.uniforms.uAssemble!.value = 1;
      particleMaterial.uniforms.uRing!.value = 0;
      particleMaterial.uniforms.uSpread!.value = 0.55;
      particleMaterial.uniforms.uAlpha!.value = 0.85;
      applyHeartTransform({
        y: Math.sin(time * 0.7) * 0.06,
        z: 0,
        scale: 1,
        beat,
        rotY: -0.35 + Math.sin(time * 0.22) * 0.55 + pointer.sx * 0.5,
        tiltX: 0.06 - pointer.sy * 0.22,
      });
      setHud(0.55);
      scanGroup.position.y = Math.sin(time * 0.8) * 0.9;
      scanGroup.scale.setScalar(1 - 0.12 * Math.abs(Math.sin(time * 0.8)));
      scanGroup.rotation.z = time * 0.25;
      hud.rotation.y = time * 0.1;
      camera.position.set(pointer.sx * 0.25, pointer.sy * 0.18, fitZ);
      look.set(0, 0, 0);
      draw(time);
    },

    dispose() {
      canvas.removeEventListener("webglcontextlost", lost);
      heartGeometry.dispose();
      heartMaterial.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
      ringGeos.forEach((g) => g.dispose());
      tickGeo.dispose();
      lineGeo.dispose();
      nodeGeo.dispose();
      nodeMat.dispose();
      portalGeo.dispose();
      haloGeo.dispose();
      portalMat.dispose();
      haloMat.dispose();
      hudMats.forEach((m) => m.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
