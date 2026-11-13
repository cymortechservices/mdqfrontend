import { useEffect, useRef, useState } from "react";
import { buildHeart } from "./heartGeometry";

/**
 * Real-time 3D heart in raw WebGL (no three.js / R3F: the project ships with zero 3D dependencies
 * and this keeps the whole renderer ≈ 9 kB). Two passes share one program family:
 *   mesh   – lit, fresnel-rimmed, hologram-scanned heart in the MDQ emerald palette
 *   points – ambient dust, the heart dissolving into particles, the scan ring and the portal ring
 * The loop only runs while the canvas is on screen and the tab is visible.
 */
export interface HeartControls {
  /** 0 = solid heart, 1 = fully dissolved into particles */
  dissolve: number;
  /** 0 = scattered, 1 = particles gathered into a vertical portal ring */
  ring: number;
  /** portal ring radius multiplier */
  ringScale: number;
  /** hologram scan band amount (0–1) and its world-space height */
  scan: number;
  scanY: number;
  /** horizontal scan ring amount (0–1) */
  scanRing: number;
  opacity: number;
  camZ: number;
  /** vertical offset of the camera target */
  lookY: number;
  /** extra yaw (rad); autoRotate adds on top */
  yaw: number;
  /** radians per second of automatic spin, or a sway amplitude when `sway` */
  spin: number;
  sway: boolean;
  beat: boolean;
  /** pointer parallax offsets, −1…1 */
  px: number;
  py: number;
}

export const defaultControls = (): HeartControls => ({
  dissolve: 0,
  ring: 0,
  ringScale: 1,
  scan: 0,
  scanY: 0,
  scanRing: 0,
  opacity: 1,
  camZ: 4.0,
  lookY: 0.12,
  yaw: 0,
  spin: 0.5,
  sway: true,
  beat: true,
  px: 0,
  py: 0,
});

const VERT = `
attribute vec3 aPos; attribute vec3 aNorm; attribute vec2 aAttr;
uniform mat4 uVP; uniform mat4 uModel; uniform float uBeat;
varying vec3 vN; varying vec3 vW; varying float vTint; varying float vRand;
void main(){
  vec3 p = aPos * (1.0 + uBeat * 0.035) + aNorm * uBeat * 0.012;
  vec4 w = uModel * vec4(p, 1.0);
  vW = w.xyz; vN = mat3(uModel) * aNorm; vTint = aAttr.y; vRand = aAttr.x;
  gl_Position = uVP * w;
}`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec3 uCam; uniform float uTime; uniform float uOpacity; uniform float uDissolve;
uniform float uScan; uniform float uScanY; uniform float uBeat;
varying vec3 vN; varying vec3 vW; varying float vTint; varying float vRand;
void main(){
  if (vRand < uDissolve) discard;
  vec3 V = normalize(uCam - vW);
  // tissue relief: a cheap procedural bump so the surface catches light like wet muscle
  float n1 = sin(vW.x * 47.0 + sin(vW.y * 31.0)) * sin(vW.z * 43.0 + sin(vW.x * 29.0));
  float n2 = sin(vW.y * 71.0 + vW.z * 23.0) * sin(vW.x * 59.0 - vW.y * 17.0);
  vec3 N = normalize(vN);
  if (dot(N, V) < 0.0) N = -N;
  float bump = vTint < 1.5 ? (vTint < 0.5 ? 0.035 : 0.015) : 0.0;
  N = normalize(N + bump * vec3(n1, n2, n1 * n2));
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  float fres = pow(1.0 - ndv, 2.6);
  vec3 L1 = normalize(vec3(-0.45, 0.8, 0.75));
  vec3 L2 = normalize(vec3(0.8, -0.2, 0.35));
  vec3 L3 = normalize(vec3(0.0, 0.2, -1.0));
  float d1 = clamp((dot(N, L1) + 0.35) / 1.35, 0.0, 1.0);   // wrapped diffuse = soft translucency
  float d2 = max(dot(N, L2), 0.0);
  float back = pow(clamp(dot(N, L3) * 0.5 + 0.5, 0.0, 1.0), 2.0) * (1.0 - ndv);
  vec3 deep = vec3(0.016, 0.15, 0.092); vec3 mid = vec3(0.075, 0.43, 0.27);
  vec3 accent = vec3(0.16, 0.88, 0.55); vec3 accent2 = vec3(0.335, 0.905, 0.715);
  vec3 gold = vec3(0.96, 0.72, 0.24);
  float mott = 0.5 + 0.5 * n1 * n2;                         // fat / muscle mottling
  vec3 tissue = mix(deep, mid, 0.35 + 0.45 * mott);
  tissue = mix(tissue, mid * 1.25, clamp(vTint, 0.0, 1.0) * 0.55);
  vec3 col = tissue * (0.28 + 1.05 * d1 + 0.35 * d2);
  col += accent * 0.35 * back;                              // light scattering through the walls
  vec3 H = normalize(L1 + V);
  float sp = pow(max(dot(N, H), 0.0), 70.0);
  col += accent2 * (sp * 0.95 + pow(max(dot(N, H), 0.0), 14.0) * 0.12);
  col += accent * fres * 0.8;
  if (vTint > 1.5) col = gold * (0.45 + 0.9 * d1) + gold * sp * 0.7;   // coronary arteries
  col += accent * 0.035 * smoothstep(0.94, 1.0, sin(vW.y * 62.0 + uTime * 1.2));
  col += accent2 * exp(-pow((vW.y - uScanY) * 7.5, 2.0)) * uScan * 0.8;
  col += accent * uBeat * 0.07;
  float edge = smoothstep(uDissolve, uDissolve + 0.05, vRand);
  col += accent2 * (1.0 - edge) * 1.4;
  float a = uOpacity * (0.9 + 0.1 * fres);
  gl_FragColor = vec4(col * a, a);
}`;

const PVERT = `
attribute vec3 aPos; attribute vec2 aAttr;
uniform mat4 uVP; uniform mat4 uModel; uniform float uMode; uniform float uTime; uniform float uDissolve;
uniform float uRing; uniform float uRingScale; uniform float uPx; uniform float uScanY; uniform float uBeat;
varying float vA;
float h(float n){ return fract(sin(n * 91.3458) * 47453.5453); }
void main(){
  float r = aAttr.x; vec3 p; float size = 5.0; float alpha = 0.0;
  if (uMode < 0.5) {            // heart particles
    vec3 base = (uModel * vec4(aPos * (1.0 + uBeat * 0.035), 1.0)).xyz;
    vec3 dir = normalize(base + vec3(h(r * 3.0) - 0.5, h(r * 5.0) - 0.5, h(r * 7.0) - 0.5) * 1.4);
    float d = uDissolve * (0.35 + 1.8 * h(r * 11.0));
    float ang = uDissolve * (1.5 + 3.0 * h(r)) ;
    vec3 sw = vec3(cos(ang) * base.x - sin(ang) * base.z, base.y, sin(ang) * base.x + cos(ang) * base.z);
    vec3 scattered = mix(base, sw, step(0.001, uDissolve)) + dir * d;
    float a2 = h(r * 17.0) * 6.2831853;
    vec3 ringP = vec3(cos(a2), sin(a2), 0.0) * (1.35 + 0.1 * (h(r * 23.0) - 0.5)) * uRingScale;
    float k = smoothstep(h(r * 29.0) * 0.5, h(r * 29.0) * 0.5 + 0.5, uRing);
    p = mix(scattered, ringP, k);
    alpha = smoothstep(0.0, 0.22, uDissolve) * (1.0 - 0.0 * k) + 0.18 * step(0.93, r);
    size = 5.0 + 5.0 * h(r * 31.0);
  } else if (uMode < 1.5) {     // ambient dust
    p = (aPos * vec3(3.2, 2.4, 2.2)) + vec3(sin(uTime * 0.25 + r * 40.0), cos(uTime * 0.2 + r * 31.0), sin(uTime * 0.17 + r * 17.0)) * 0.18;
    p.y += mod(uTime * (0.03 + 0.05 * r) + r * 5.0, 2.4) - 1.2;
    alpha = (0.25 + 0.5 * h(r * 7.0)) * (0.6 + 0.4 * sin(uTime * 1.5 + r * 80.0));
    size = 3.0 + 4.0 * h(r * 13.0);
  } else {                      // horizontal scan ring
    float a3 = r * 6.2831853;
    p = vec3(cos(a3) * 1.28, uScanY, sin(a3) * 0.95);
    alpha = 0.9; size = 5.5;
  }
  gl_Position = uVP * vec4(p, 1.0);
  gl_PointSize = max(1.0, size * uPx * 2.4 / gl_Position.w);
  vA = alpha;
}`;

const PFRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform float uPAlpha; varying float vA;
void main(){
  vec2 c = gl_PointCoord - 0.5; float d = length(c);
  float soft = smoothstep(0.5, 0.0, d);
  float a = soft * soft * vA * uPAlpha;
  gl_FragColor = vec4(vec3(0.335, 0.905, 0.715) * a, a);
}`;

type Mat = Float32Array;
function perspective(fov: number, aspect: number, near: number, far: number): Mat {
  const f = 1 / Math.tan(fov / 2);
  const m = new Float32Array(16);
  m[0] = f / aspect; m[5] = f; m[10] = (far + near) / (near - far); m[11] = -1; m[14] = (2 * far * near) / (near - far);
  return m;
}
function mul(a: Mat, b: Mat): Mat {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + r]! * b[c * 4 + k]!;
    o[c * 4 + r] = s;
  }
  return o;
}
function translation(x: number, y: number, z: number): Mat {
  const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; m[12] = x; m[13] = y; m[14] = z; return m;
}
function rotY(a: number): Mat {
  const m = new Float32Array(16); const c = Math.cos(a), s = Math.sin(a);
  m[0] = c; m[2] = -s; m[5] = 1; m[8] = s; m[10] = c; m[15] = 1; return m;
}
function rotX(a: number): Mat {
  const m = new Float32Array(16); const c = Math.cos(a), s = Math.sin(a);
  m[0] = 1; m[5] = c; m[6] = s; m[9] = -s; m[10] = c; m[15] = 1; return m;
}
function rotZ(a: number): Mat {
  const m = new Float32Array(16); const c = Math.cos(a), s = Math.sin(a);
  m[0] = c; m[1] = s; m[4] = -s; m[5] = c; m[10] = 1; m[15] = 1; return m;
}

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? "shader error");
  return sh;
}
function program(gl: WebGLRenderingContext, v: string, f: string) {
  const p = gl.createProgram()!;
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, v));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, f));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? "link error");
  return p;
}

/** True when a hardware-accelerated WebGL context is available. Software rasterisers (SwiftShader, llvmpipe) are
 *  treated as unavailable: they would make the intro and hero janky, so those visitors get the static heart. */
export function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl") || c.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) return false;
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return !/swiftshader|llvmpipe|software|softpipe/i.test(renderer);
  } catch {
    return false;
  }
}

interface Props {
  controls: HeartControls;
  className?: string;
  /** lighter geometry + fewer particles + lower pixel ratio */
  lite?: boolean;
  /** render a single frame and stop (prefers-reduced-motion) */
  still?: boolean;
  onUnsupported?: () => void;
  /** called each frame before drawing so a parent can drive `controls` */
  onFrame?: (time: number) => void;
}

export default function HeartCanvas({ controls, className, lite = false, still = false, onUnsupported, onFrame }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [lost, setLost] = useState(false);
  const live = useRef({ controls, onFrame, still });
  live.current = { controls, onFrame, still };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const gl = (canvas.getContext("webgl", { antialias: !lite, alpha: true, premultipliedAlpha: true, powerPreference: "low-power" }) as WebGLRenderingContext | null);
    if (!gl) {
      onUnsupported?.();
      return undefined;
    }

    let meshProg: WebGLProgram, ptProg: WebGLProgram;
    try {
      meshProg = program(gl, VERT, FRAG);
      ptProg = program(gl, PVERT, PFRAG);
    } catch (error) {
      console.warn("Heart renderer disabled:", error);
      onUnsupported?.();
      return undefined;
    }

    const heart = buildHeart(lite ? 0.6 : 1);
    const mk = (data: ArrayBufferView, target: number = gl.ARRAY_BUFFER) => {
      const b = gl.createBuffer()!;
      gl.bindBuffer(target, b);
      gl.bufferData(target, data, gl.STATIC_DRAW);
      return b;
    };
    const bPos = mk(heart.positions), bNorm = mk(heart.normals), bAttr = mk(heart.attrs), bIdx = mk(heart.indices, gl.ELEMENT_ARRAY_BUFFER);
    // ambient dust + scan ring share the point program (mode 1 / 2)
    const dustN = lite ? 70 : 150, ringN = 220;
    const dust = new Float32Array(dustN * 3), dustA = new Float32Array(dustN * 2);
    for (let i = 0; i < dustN; i++) {
      dust.set([Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1], i * 3);
      dustA.set([Math.random(), 0], i * 2);
    }
    const ringA = new Float32Array(ringN * 2);
    for (let i = 0; i < ringN; i++) ringA.set([i / ringN, 0], i * 2);
    const ringPos = new Float32Array(ringN * 3);
    const bDust = mk(dust), bDustA = mk(dustA), bRingPos = mk(ringPos), bRingA = mk(ringA);

    const loc = (p: WebGLProgram, n: string) => gl.getUniformLocation(p, n);
    const U = {
      mVP: loc(meshProg, "uVP"), mModel: loc(meshProg, "uModel"), mBeat: loc(meshProg, "uBeat"), mCam: loc(meshProg, "uCam"), mTime: loc(meshProg, "uTime"),
      mOpacity: loc(meshProg, "uOpacity"), mDissolve: loc(meshProg, "uDissolve"), mScan: loc(meshProg, "uScan"), mScanY: loc(meshProg, "uScanY"),
      pVP: loc(ptProg, "uVP"), pModel: loc(ptProg, "uModel"), pMode: loc(ptProg, "uMode"), pTime: loc(ptProg, "uTime"), pDissolve: loc(ptProg, "uDissolve"),
      pRing: loc(ptProg, "uRing"), pRingScale: loc(ptProg, "uRingScale"), pPx: loc(ptProg, "uPx"), pScanY: loc(ptProg, "uScanY"), pBeat: loc(ptProg, "uBeat"), pAlpha: loc(ptProg, "uPAlpha"),
    };
    const A = {
      mPos: gl.getAttribLocation(meshProg, "aPos"), mNorm: gl.getAttribLocation(meshProg, "aNorm"), mAttr: gl.getAttribLocation(meshProg, "aAttr"),
      pPos: gl.getAttribLocation(ptProg, "aPos"), pAttr: gl.getAttribLocation(ptProg, "aAttr"),
    };

    const maxDpr = lite ? 1.5 : 2;
    let width = 0, height = 0, dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width * dpr));
      height = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    };

    let angle = 0, last = performance.now(), start = last, raf = 0, visible = true, destroyed = false;

    const attrib = (loc: number, buf: WebGLBuffer, size: number) => {
      if (loc < 0) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    };

    const draw = (now: number) => {
      const c = live.current.controls;
      const t = (now - start) / 1000;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      live.current.onFrame?.(t);
      resize();
      if (c.sway) angle = Math.sin(t * 0.45) * (0.55 * c.spin * 2) + c.yaw;
      else angle += dt * c.spin;
      const yaw = (c.sway ? angle : angle + c.yaw) + c.px * 0.3;
      const ph = t % 1.05;
      const beat = c.beat ? Math.exp(-Math.pow((ph - 0.1) * 13, 2)) + 0.55 * Math.exp(-Math.pow((ph - 0.34) * 13, 2)) : 0;

      const aspect = width / height;
      const proj = perspective(0.8, aspect, 0.05, 40);
      const view = translation(0, -c.lookY - c.py * 0.12, -c.camZ);
      const vp = mul(proj, view);
      const model = mul(mul(rotX(0.22 + c.py * 0.12), rotY(yaw)), rotZ(-0.1));
      const camPos = [0, c.lookY + c.py * 0.12, c.camZ];

      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      // --- mesh
      if (c.dissolve < 0.995 && c.opacity > 0.01) {
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.useProgram(meshProg);
        attrib(A.mPos, bPos, 3); attrib(A.mNorm, bNorm, 3); attrib(A.mAttr, bAttr, 2);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bIdx);
        gl.uniformMatrix4fv(U.mVP, false, vp); gl.uniformMatrix4fv(U.mModel, false, model);
        gl.uniform1f(U.mBeat, beat); gl.uniform3f(U.mCam, camPos[0]!, camPos[1]!, camPos[2]!); gl.uniform1f(U.mTime, t);
        gl.uniform1f(U.mOpacity, c.opacity); gl.uniform1f(U.mDissolve, c.dissolve);
        gl.uniform1f(U.mScan, c.scan); gl.uniform1f(U.mScanY, c.scanY);
        gl.drawElements(gl.TRIANGLES, heart.indices.length, gl.UNSIGNED_SHORT, 0);
      }

      // --- points (additive)
      gl.disable(gl.DEPTH_TEST);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(ptProg);
      gl.uniformMatrix4fv(U.pVP, false, vp); gl.uniformMatrix4fv(U.pModel, false, model);
      gl.uniform1f(U.pTime, t); gl.uniform1f(U.pDissolve, c.dissolve); gl.uniform1f(U.pRing, c.ring); gl.uniform1f(U.pRingScale, c.ringScale);
      gl.uniform1f(U.pPx, dpr); gl.uniform1f(U.pScanY, c.scanY); gl.uniform1f(U.pBeat, beat);
      // heart particles
      if (c.dissolve > 0.001 || c.opacity > 0.01) {
        attrib(A.pPos, bPos, 3); attrib(A.pAttr, bAttr, 2);
        gl.uniform1f(U.pMode, 0); gl.uniform1f(U.pAlpha, 1);
        gl.drawArrays(gl.POINTS, 0, heart.positions.length / 3);
      }
      // ambient dust
      attrib(A.pPos, bDust, 3); attrib(A.pAttr, bDustA, 2);
      gl.uniform1f(U.pMode, 1); gl.uniform1f(U.pAlpha, Math.max(0.15, c.opacity));
      gl.drawArrays(gl.POINTS, 0, dustN);
      // scan ring
      if (c.scanRing > 0.01) {
        attrib(A.pPos, bRingPos, 3); attrib(A.pAttr, bRingA, 2);
        gl.uniform1f(U.pMode, 2); gl.uniform1f(U.pAlpha, c.scanRing);
        gl.drawArrays(gl.POINTS, 0, ringN);
      }
    };

    const loop = (now: number) => {
      raf = 0;
      if (destroyed) return;
      draw(now);
      if (!live.current.still && visible && !document.hidden) raf = requestAnimationFrame(loop);
    };
    const kick = () => { if (!raf && !destroyed) raf = requestAnimationFrame(loop); };

    const io = typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver(([entry]) => { visible = !!entry?.isIntersecting; if (visible) kick(); }, { threshold: 0.01 })
      : null;
    io?.observe(canvas);
    const onVis = () => { if (!document.hidden) kick(); };
    document.addEventListener("visibilitychange", onVis);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => { if (live.current.still) kick(); }) : null;
    ro?.observe(canvas);
    const onLost = (event: Event) => { event.preventDefault(); destroyed = true; setLost(true); onUnsupported?.(); };
    canvas.addEventListener("webglcontextlost", onLost);

    // Wait one frame so the canvas has layout before the first draw.
    raf = requestAnimationFrame(loop);

    return () => {
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      io?.disconnect(); ro?.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      canvas.removeEventListener("webglcontextlost", onLost);
      [bPos, bNorm, bAttr, bIdx, bDust, bDustA, bRingPos, bRingA].forEach((b) => gl.deleteBuffer(b));
      gl.deleteProgram(meshProg); gl.deleteProgram(ptProg);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
    // Controls / callbacks are read through `live`, so the GL context is created exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lite]);

  if (lost) return null;
  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
