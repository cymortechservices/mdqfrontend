/**
 * Procedural anatomical heart (no external model, no 3D library).
 * Body: a surface of revolution of the classic heart outline, flattened front-to-back, with an
 * asymmetric left-ventricle bulge, a sheared apex, atrioventricular and interventricular grooves.
 * Vessels: aorta + arch branches, pulmonary trunk and branches, venae cavae, pulmonary veins.
 * Everything is generated once on the CPU; vertex counts scale with `detail` for phones.
 */
type V3 = [number, number, number];

export interface HeartMesh {
  /** xyz per vertex */
  positions: Float32Array;
  normals: Float32Array;
  /** x = per-vertex random, y = tint (0 body … 1 vessel) */
  attrs: Float32Array;
  indices: Uint16Array;
}

const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/**
 * Anatomical body = the outer surface of a smooth union of chamber-shaped Gaussian blobs
 * (left/right ventricle, left/right atrium, both auricles) with the atrioventricular and
 * interventricular grooves cut into the field. Each grid vertex is found by marching a ray from
 * the heart's centre to the outermost field crossing, and its normal is the field gradient.
 */
interface Blob { c: V3; r: V3; rot: number; w: number }
const BLOBS: Blob[] = [
  { c: [0.2, -0.28, -0.04], r: [0.4, 0.86, 0.42], rot: 0.5, w: 1 },   // left ventricle (apex down-left)
  { c: [-0.2, -0.12, 0.2], r: [0.4, 0.58, 0.28], rot: -0.12, w: 0.95 }, // right ventricle (anterior)
  { c: [-0.5, 0.36, 0.0], r: [0.3, 0.38, 0.3], rot: 0, w: 0.9 },       // right atrium
  { c: [0.24, 0.46, -0.3], r: [0.34, 0.26, 0.26], rot: 0, w: 0.9 },    // left atrium (posterior)
  { c: [-0.26, 0.58, 0.28], r: [0.2, 0.15, 0.13], rot: 0.5, w: 0.8 },  // right auricle
  { c: [0.36, 0.55, 0.14], r: [0.2, 0.16, 0.13], rot: -0.6, w: 0.8 }, // left auricle
];
const THRESH = 0.42;
const CENTER: V3 = [0.02, 0.06, 0];

function field(x0: number, y0: number, z0: number): number {
  let f = 0;
  for (const b of BLOBS) {
    const x = x0 - b.c[0], y = y0 - b.c[1], z = z0 - b.c[2];
    const cs = Math.cos(b.rot), sn = Math.sin(b.rot);
    const rx = (x * cs + y * sn) / b.r[0], ry = (-x * sn + y * cs) / b.r[1], rz = z / b.r[2];
    f += b.w * Math.exp(-(rx * rx + ry * ry + rz * rz));
  }
  // interventricular groove: a front-facing valley from the base to the apex
  const ax = -0.02, ay = 0.46, bx = 0.2, by = -0.85;
  const dx = bx - ax, dy = by - ay;
  const tt = Math.max(0, Math.min(1, ((x0 - ax) * dx + (y0 - ay) * dy) / (dx * dx + dy * dy)));
  const dIV = Math.hypot(x0 - (ax + dx * tt), y0 - (ay + dy * tt));
  const front = Math.max(0, Math.min(1, (z0 + 0.02) / 0.2));
  f *= 1 - 0.2 * Math.exp(-Math.pow(dIV / 0.055, 2)) * front;
  // atrioventricular groove: a tilted ring between atria and ventricles
  const dAV = y0 - (0.27 + 0.1 * x0 - 0.05 * z0);
  f *= 1 - 0.14 * Math.exp(-Math.pow(dAV / 0.05, 2));
  // fine muscular relief
  f += 0.006 * Math.sin(23 * x0 + 7 * Math.sin(19 * y0)) * Math.sin(21 * z0 + 5 * Math.sin(17 * x0));
  return f;
}

function surfaceAlong(dx: number, dy: number, dz: number): number {
  const l = Math.hypot(dx, dy, dz) || 1;
  dx /= l; dy /= l; dz /= l;
  let hi = 1.5;
  const step = 0.05;
  while (hi > 0.05 && field(CENTER[0] + dx * hi, CENTER[1] + dy * hi, CENTER[2] + dz * hi) < THRESH) hi -= step;
  let lo = hi, up = hi + step;
  for (let i = 0; i < 11; i++) {
    const mid = (lo + up) / 2;
    if (field(CENTER[0] + dx * mid, CENTER[1] + dy * mid, CENTER[2] + dz * mid) >= THRESH) lo = mid; else up = mid;
  }
  return lo;
}

function surfacePoint(dx: number, dy: number, dz: number, lift = 0): V3 {
  const l = Math.hypot(dx, dy, dz) || 1;
  const t = surfaceAlong(dx, dy, dz) + lift;
  return [CENTER[0] + (dx / l) * t, CENTER[1] + (dy / l) * t, CENTER[2] + (dz / l) * t];
}

function gradientNormal(p: V3): V3 {
  const e = 0.012;
  const gx = field(p[0] + e, p[1], p[2]) - field(p[0] - e, p[1], p[2]);
  const gy = field(p[0], p[1] + e, p[2]) - field(p[0], p[1] - e, p[2]);
  const gz = field(p[0], p[1], p[2] + e) - field(p[0], p[1], p[2] - e);
  return norm([-gx, -gy, -gz]);
}

function bodyPoint(t: number, u: number): V3 {
  return surfacePoint(Math.sin(t) * Math.cos(u), Math.cos(t), Math.sin(t) * Math.sin(u));
}

function addGrid(mesh: Acc, rows: number, cols: number, fn: (i: number, j: number) => V3, tint: number, seed: number) {
  const base = mesh.pos.length / 3;
  for (let i = 0; i <= rows; i++) {
    for (let j = 0; j <= cols; j++) {
      const p = fn(i, j);
      mesh.pos.push(p[0], p[1], p[2]);
      mesh.attr.push(hash(base + i * (cols + 1) + j + seed), tint);
    }
  }
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const a = base + i * (cols + 1) + j;
      const b = a + cols + 1;
      mesh.idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
}

interface Acc {
  pos: number[];
  attr: number[];
  idx: number[];
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

function catmull(points: V3[], samples: number): V3[] {
  const out: V3[] = [];
  const n = points.length - 1;
  for (let s = 0; s <= samples; s++) {
    const f = (s / samples) * n;
    const i = Math.min(n - 1, Math.floor(f));
    const t = f - i;
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(n, i + 2)]!;
    const c = (k: 0 | 1 | 2) =>
      0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t * t + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t * t * t);
    out.push([c(0), c(1), c(2)]);
  }
  return out;
}

function addTube(mesh: Acc, path: V3[], r0: number, r1: number, sides: number, seed: number, tint = 1, flare = 0.45) {
  const pts = catmull(path, 22);
  const rows = pts.length - 1;
  // Parallel-transport frame.
  let tan = norm(sub(pts[1]!, pts[0]!));
  let ref: V3 = Math.abs(tan[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  let nrm = norm(cross(tan, ref));
  const frames: { n: V3; b: V3 }[] = [];
  for (let i = 0; i <= rows; i++) {
    const next = pts[Math.min(rows, i + 1)]!;
    const prev = pts[Math.max(0, i - 1)]!;
    tan = norm(sub(next, prev));
    nrm = norm(cross(tan, cross(nrm, tan)));
    frames.push({ n: nrm, b: norm(cross(tan, nrm)) });
  }
  addGrid(
    mesh,
    rows,
    sides,
    (i, j) => {
      const f = frames[i]!;
      const a = (j / sides) * Math.PI * 2;
      const t = i / rows;
      // Flared root where the vessel meets the heart.
      const r = (r0 + (r1 - r0) * t) * (1 + flare * Math.exp(-t * 9));
      const c = pts[i]!;
      return [
        c[0] + (f.n[0] * Math.cos(a) + f.b[0] * Math.sin(a)) * r,
        c[1] + (f.n[1] * Math.cos(a) + f.b[1] * Math.sin(a)) * r,
        c[2] + (f.n[2] * Math.cos(a) + f.b[2] * Math.sin(a)) * r,
      ];
    },
    tint,
    seed,
  );
}

export function buildHeart(detail: 1 | 0.6 = 1): HeartMesh {
  const mesh: Acc = { pos: [], attr: [], idx: [] };
  const rows = Math.round(88 * detail);
  const cols = Math.round(120 * detail);
  addGrid(mesh, rows, cols, (i, j) => bodyPoint((i / rows) * Math.PI, (j / cols) * Math.PI * 2), 0, 0);
  const bodyCount = mesh.pos.length / 3;

  const sides = detail === 1 ? 18 : 10;
  const tubes: { path: V3[]; r0: number; r1: number }[] = [
    // aorta: ascending, arch over the pulmonary artery, descending behind the heart; arch branches
    { path: [[0.02, 0.5, 0.02], [0.03, 0.82, 0.0], [0.04, 1.1, -0.04], [-0.14, 1.34, -0.1], [-0.4, 1.26, -0.14], [-0.52, 0.98, -0.18], [-0.54, 0.55, -0.2]], r0: 0.13, r1: 0.1 },
    { path: [[0.03, 1.18, -0.05], [0.05, 1.4, -0.06], [0.06, 1.62, -0.06]], r0: 0.048, r1: 0.038 },
    { path: [[-0.14, 1.34, -0.1], [-0.18, 1.52, -0.1], [-0.2, 1.7, -0.1]], r0: 0.042, r1: 0.034 },
    { path: [[-0.32, 1.3, -0.12], [-0.35, 1.46, -0.12], [-0.36, 1.6, -0.12]], r0: 0.036, r1: 0.03 },
    // pulmonary trunk rising from the right ventricle, splitting to both lungs
    { path: [[-0.14, 0.5, 0.3], [-0.18, 0.8, 0.3], [-0.3, 1.04, 0.22], [-0.62, 1.1, 0.12], [-0.98, 1.14, 0.02]], r0: 0.115, r1: 0.062 },
    { path: [[-0.24, 0.96, 0.24], [0.08, 1.06, 0.16], [0.44, 1.1, 0.04], [0.8, 1.06, -0.08]], r0: 0.075, r1: 0.05 },
    // venae cavae into the right atrium
    { path: [[-0.5, 0.58, -0.02], [-0.56, 0.9, -0.04], [-0.56, 1.34, -0.06]], r0: 0.085, r1: 0.075 },
    { path: [[-0.46, 0.1, -0.04], [-0.5, -0.25, -0.08], [-0.5, -0.62, -0.1]], r0: 0.08, r1: 0.075 },
    // pulmonary veins into the left atrium
    { path: [[0.44, 0.52, -0.3], [0.76, 0.6, -0.36], [1.04, 0.66, -0.4]], r0: 0.058, r1: 0.046 },
    { path: [[0.42, 0.4, -0.32], [0.74, 0.38, -0.4], [1.0, 0.34, -0.44]], r0: 0.052, r1: 0.044 },
  ];
  tubes.forEach((tube, i) => addTube(mesh, tube.path, tube.r0, tube.r1, sides, 1000 * (i + 1)));

  // Coronary arteries snapped onto the surface (tint 2 → brand gold in the shader).
  const hug = (pts: V3[]): V3[] => pts.map((p) => surfacePoint(p[0] - CENTER[0], p[1] - CENTER[1], p[2] - CENTER[2], 0.012));
  const coronaries: V3[][] = [
    [[0.0, 0.5, 0.3], [0.06, 0.1, 0.4], [0.14, -0.3, 0.3], [0.2, -0.7, 0.14]], // left anterior descending
    [[0.12, 0.46, 0.24], [0.4, 0.4, 0.1], [0.58, 0.2, -0.08], [0.54, -0.05, -0.3]], // circumflex
    [[-0.16, 0.46, 0.3], [-0.5, 0.3, 0.3], [-0.68, 0.0, 0.16], [-0.56, -0.3, -0.1], [-0.34, -0.5, -0.18]], // right coronary
    [[-0.3, 0.1, 0.4], [-0.1, -0.3, 0.4]], // marginal branch
  ];
  coronaries.forEach((path, i) => addTube(mesh, hug(path), 0.02, 0.009, 6, 9000 + i * 100, 2, 0));

  const count = mesh.pos.length / 3;
  const normals = new Float32Array(count * 3);
  for (let i = 0; i < mesh.idx.length; i += 3) {
    const ia = mesh.idx[i]!;
    const ib = mesh.idx[i + 1]!;
    const ic = mesh.idx[i + 2]!;
    const pa: V3 = [mesh.pos[ia * 3]!, mesh.pos[ia * 3 + 1]!, mesh.pos[ia * 3 + 2]!];
    const pb: V3 = [mesh.pos[ib * 3]!, mesh.pos[ib * 3 + 1]!, mesh.pos[ib * 3 + 2]!];
    const pc: V3 = [mesh.pos[ic * 3]!, mesh.pos[ic * 3 + 1]!, mesh.pos[ic * 3 + 2]!];
    const n = cross(sub(pb, pa), sub(pc, pa));
    for (const k of [ia, ib, ic]) {
      normals[k * 3]! += n[0];
      normals[k * 3 + 1]! += n[1];
      normals[k * 3 + 2]! += n[2];
    }
  }
  for (let i = 0; i < count; i++) {
    const n = i < bodyCount
      ? gradientNormal([mesh.pos[i * 3]!, mesh.pos[i * 3 + 1]!, mesh.pos[i * 3 + 2]!])
      : norm([normals[i * 3]!, normals[i * 3 + 1]!, normals[i * 3 + 2]!]);
    normals[i * 3] = n[0];
    normals[i * 3 + 1] = n[1];
    normals[i * 3 + 2] = n[2];
  }
  return {
    positions: new Float32Array(mesh.pos),
    normals,
    attrs: new Float32Array(mesh.attr),
    indices: new Uint16Array(mesh.idx),
  };
}
