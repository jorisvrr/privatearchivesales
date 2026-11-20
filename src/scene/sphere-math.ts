// Pure geometry for the Archive sphere. No three.js and no DOM, so it can be unit-tested against AUDIT.md.
//
// Verified against the audit's placement table (1440×900, explode +1.5 s and +6.0 s):
// - slot i of N sits at y = 1 − (2i + 1)/N, r = √(1 − y²), θ = i·π(3 − √5)
// - the layout's y axis is mirrored when drawn (slot 0 is at the bottom of the sphere)
// - ambient spin is about (−sin 23°, cos 23°, 0) in layout space at 0.001 rad per 60 Hz frame
// Mean error against the table is 0.43 px on screen and 0.003 units in depth.

export const FOV = 60;
export const CAMERA_Z = 12;
export const AMBIENT_RAD_PER_S = 0.06; // 0.001 rad × 60 fps, normalised to time
export const AMBIENT_TILT = (23 * Math.PI) / 180;
export const AMBIENT_AXIS: Vec3 = [-Math.sin(AMBIENT_TILT), Math.cos(AMBIENT_TILT), 0];
export const SLOT_MIN = 18;

export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number]; // x, y, z, w

export function fibonacciSlots(count: number): Vec3[] {
  const n = Math.max(count, SLOT_MIN);
  const golden = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: n }, (_, i) => {
    const y = 1 - (2 * i + 1) / n;
    const r = Math.sqrt(1 - y * y);
    const t = i * golden;
    return [Math.cos(t) * r, y, Math.sin(t) * r] as Vec3;
  });
}

export interface SphereLayout {
  vw: number;
  vh: number;
  /** Sphere radius in css px at the sphere's centre depth. */
  radiusPx: number;
  /** Nominal plane height in css px at the sphere's centre depth. */
  planePx: number;
  /** Intro ring radius in css px. */
  ringPx: number;
  /** Focal length in css px. */
  focal: number;
  /** World units per css px at the sphere's centre depth. */
  wpp: number;
  /** Size of the expanded plane in css px. */
  expandedH: number;
  expandedW: number;
}

/** Responsive rules from AUDIT.md §9 / REBUILD.md §3. */
export function sphereLayout(vw: number, vh: number): SphereLayout {
  let radiusPx = 250;
  let planePx = 82;
  if (vw <= 640) {
    radiusPx = (vw - 48) / 2 - 30;
    planePx = 60;
  } else if (vw >= 1025 && vw <= 1440) {
    radiusPx = 200;
    planePx = 65.6;
  }
  const tan = Math.tan((FOV / 2) * (Math.PI / 180));
  const focal = vh / 2 / tan;
  const wpp = (2 * CAMERA_Z * tan) / vh;
  let expandedH = 0.7 * vh;
  let expandedW = expandedH * 0.75;
  if (vw <= 640 && expandedW > vw - 16) {
    expandedW = vw - 16;
    expandedH = expandedW / 0.75;
  }
  return { vw, vh, radiusPx, planePx, ringPx: vw <= 640 ? 180 : 240, focal, wpp, expandedH, expandedW };
}

export function quatFromAxisAngle(axis: Vec3, angle: number): Quat {
  const len = Math.hypot(axis[0], axis[1], axis[2]) || 1;
  const s = Math.sin(angle / 2) / len;
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(angle / 2)];
}

/** a · b (apply b first, then a). */
export function quatMul(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

export function quatNormalize(q: Quat): Quat {
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}

export function rotate(v: Vec3, q: Quat): Vec3 {
  const [x, y, z] = v;
  const [qx, qy, qz, qw] = q;
  const ix = qw * x + qy * z - qz * y;
  const iy = qw * y + qz * x - qx * z;
  const iz = qw * z + qx * y - qy * x;
  const iw = -qx * x - qy * y - qz * z;
  return [
    ix * qw + iw * -qx + iy * -qz - iz * -qy,
    iy * qw + iw * -qy + iz * -qx - ix * -qz,
    iz * qw + iw * -qz + ix * -qy - iy * -qx,
  ];
}

/** Layout-space direction → world direction (the layout's y is mirrored). */
export const toWorld = (v: Vec3): Vec3 => [v[0], -v[1], v[2]];

/**
 * A rotation about a world axis, expressed as a rotation to pre-multiply onto the layout quaternion.
 * The y mirror is a reflection, so it maps the axis and reverses the angle.
 */
export function worldRotationInLayout(axis: Vec3, angle: number): Quat {
  return quatFromAxisAngle(toWorld(axis), -angle);
}

export interface Projected {
  /** Centre in css px. */
  x: number;
  y: number;
  /** Camera-space depth (negative = in front of the camera). */
  z: number;
  /** Plane height and width on screen, css px. */
  h: number;
  w: number;
}

/** World position (sphere centred on the origin, camera at z = 12) → screen. */
export function project(world: Vec3, heightWorld: number, L: SphereLayout): Projected {
  const depth = CAMERA_Z - world[2];
  const k = L.focal / depth;
  return { x: L.vw / 2 + world[0] * k, y: L.vh / 2 - world[1] * k, z: -depth, h: heightWorld * k, w: heightWorld * 0.75 * k };
}

/** Settled sphere at a given orientation: each slot's world position. */
export function slotWorld(slot: Vec3, q: Quat, L: SphereLayout, push = 1): Vec3 {
  const d = toWorld(rotate(slot, q));
  const r = L.radiusPx * L.wpp * push;
  return [d[0] * r, d[1] * r, d[2] * r];
}

/** Orientation after `seconds` of ambient spin from identity. */
export const ambientQuat = (seconds: number): Quat => quatFromAxisAngle(AMBIENT_AXIS, AMBIENT_RAD_PER_S * seconds);

/** Frame-rate independent decay: a per-60Hz-frame factor applied over dt seconds. */
export const decay = (perFrame: number, dt: number) => Math.pow(perFrame, dt * 60);
