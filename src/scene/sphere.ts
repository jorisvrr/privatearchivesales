// Archive sphere: 18 camera-facing 3:4 planes on a deterministic Fibonacci sphere (AUDIT.md §3).
// One instance lives for the whole page session, so orientation survives route changes.
import * as THREE from 'three';
import { gsap } from 'gsap';
import type { Plate } from '../content/sale';
import {
  AMBIENT_AXIS, AMBIENT_RAD_PER_S, CAMERA_Z, FOV, decay, fibonacciSlots, project, quatFromAxisAngle, quatMul,
  quatNormalize, slotWorld, sphereLayout, worldRotationInLayout, type Quat, type SphereLayout, type Vec3,
} from './sphere-math';

export interface SceneHooks {
  onHover(plate: Plate | null): void;
  onExpand(plate: Plate | null): void;
  onOpen(plate: Plate): void;
  onCursor(label: string | null, x: number, y: number): void;
  onInteract(): void;
}

export interface IntroHooks {
  onProgress(loaded: number, total: number): void;
  onGate(): void;
  onCollapse(): void;
  onExplode(): void;
  onDone(): void;
}

type Phase = 'idle' | 'ring' | 'explode' | 'live';

interface PlaneObj {
  plate: Plate;
  index: number;
  slot: Vec3;
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  large: THREE.Texture | null;
  largeLoading: boolean;
  ready: Promise<void>;
  /** Intro state, in css px at the sphere's centre depth. */
  intro: { opacity: number; size: number; cp: number };
}

const RING_COUNT = 10;
const RING_SPEED = (30 * Math.PI) / 180; // rad/s, 0.5°/frame at 60 fps
const STACK_PX = 96;
const DRAG_GAIN = 0.001;
const WHEEL_GAIN = 0.0002;
const FRICTION = 0.94;
const SMOOTHING = 0.11;
const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export class SphereScene {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private scene = new THREE.Scene();
  private raycaster = new THREE.Raycaster();
  private loader = new THREE.TextureLoader();
  private planes: PlaneObj[] = [];
  L: SphereLayout;
  q: Quat = [0, 0, 0, 1];
  phase: Phase = 'idle';
  ambient = true;
  private vel: [number, number] = [0, 0];
  private tgt: [number, number] = [0, 0];
  private ring = { rot: 0, mult: 1 };
  private explode = { p: 0 };
  explodeAt: number | null = null;
  private focus: PlaneObj | null = null;
  private ex = { e: 0 };
  private isOpen = false;
  private hovered: PlaneObj | null = null;
  private candidate: PlaneObj | null = null;
  private dwell = 0;
  private leave = 0;
  private pointers = new Map<number, { x: number; y: number }>();
  private press: { id: number; x: number; y: number; travel: number; max: number; lx: number; ly: number } | null = null;
  private pinch = 0;
  private mouse = { x: -1, y: -1, inside: false };
  private active = false;
  private reduced = matchMedia('(prefers-reduced-motion: reduce)');
  private lastT = performance.now();
  private tick = () => this.frame();

  constructor(private hooks: SceneHooks, plates: Plate[]) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'sphere-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, preserveDrawingBuffer: false });
    this.renderer.setClearColor(0xffffff, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.L = sphereLayout(innerWidth, innerHeight);
    this.camera = new THREE.PerspectiveCamera(FOV, innerWidth / innerHeight, 0.1, 100);
    this.camera.position.set(0, 0, CAMERA_Z);
    const geo = new THREE.PlaneGeometry(0.75, 1);
    const slots = fibonacciSlots(plates.length);
    this.planes = plates.map((plate, index) => {
      const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, color: 0xe9e9e9 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      const ready = new Promise<void>((resolve) => {
        this.loader.load(plate.small, (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = 4;
          mat.map = tex;
          mat.color.set(0xffffff);
          mat.needsUpdate = true;
          resolve();
        }, undefined, () => resolve());
      });
      return { plate, index, slot: slots[index], mesh, mat, large: null, largeLoading: false, ready, intro: { opacity: 0, size: 0.01, cp: 0 } };
    });
    this.resize();
    this.bind();
    this.canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.contextLost?.(); });
  }

  contextLost?: () => void;

  get touchUI() {
    return innerWidth <= 1024 || matchMedia('(hover: none)').matches;
  }

  resize() {
    const w = innerWidth;
    const h = innerHeight;
    this.L = sphereLayout(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(w, h, false);
  }

  // ---------------------------------------------------------------- lifecycle

  /** Called when the Archive route becomes active. `fresh` = arrived from another route. */
  activate(fresh: boolean) {
    if (fresh) {
      this.ambient = true;
      this.vel = [0, 0];
      this.tgt = [0, 0];
      gsap.killTweensOf(this.ex);
      this.ex.e = 0;
      this.focus = null;
      this.isOpen = false;
      this.setHover(null, true);
      this.candidate = null;
    }
    if (!this.active) {
      this.active = true;
      this.lastT = performance.now();
      gsap.ticker.add(this.tick);
    }
  }

  deactivate() {
    this.active = false;
    gsap.ticker.remove(this.tick);
    this.hooks.onCursor(null, 0, 0);
  }

  /** Settled sphere without the intro (in-app arrival, reduced motion). */
  settle() {
    this.phase = 'live';
    this.explode.p = 1;
    this.explodeAt ??= performance.now();
    for (const p of this.planes) {
      p.intro.opacity = 1;
      p.mesh.visible = true;
    }
  }

  /** First-visit sequence, AUDIT.md §3.2. Times are relative to the gate. */
  async playIntro(h: IntroHooks) {
    this.phase = 'ring';
    const start = performance.now();
    const ring = this.planes.slice(0, RING_COUNT);
    let loaded = 0;
    h.onProgress(0, ring.length);
    const loads = ring.map((p) => p.ready.then(() => h.onProgress(++loaded, ring.length)));
    const minGate = new Promise((r) => setTimeout(r, 1750));
    const maxWait = new Promise((r) => setTimeout(r, 30000));
    await Promise.race([Promise.all([Promise.all(loads), minGate]), maxWait]);
    h.onGate();
    void start;

    const tl = gsap.timeline();
    ring.forEach((p, i) => {
      p.mesh.visible = true;
      tl.to(p.intro, { opacity: 1, duration: 1, ease: 'power3.out' }, i * 0.1);
      tl.fromTo(p.intro, { size: 0.01 }, { size: 70, duration: 1, ease: 'back.out(1.7)' }, i * 0.1);
    });
    tl.to(this.ring, { mult: 7.3, duration: 1, ease: 'power2.in' }, 1.3);
    tl.call(() => h.onCollapse(), [], 2.1);
    ring.forEach((p, i) => tl.to(p.intro, { cp: 1, duration: 1.25, ease: 'power2.inOut' }, 2.1 + i * 0.05));
    tl.call(() => {
      this.phase = 'explode';
      this.explodeAt = performance.now();
      this.q = [0, 0, 0, 1];
      for (const p of this.planes) {
        p.mesh.visible = true;
        p.intro.opacity = 1;
      }
      h.onExplode();
    }, [], 4.0);
    tl.to(this.explode, { p: 1, duration: 1, ease: 'power3.out' }, 4.0);
    tl.call(() => {
      this.phase = 'live';
      h.onDone();
    }, [], 5.0);
  }

  // ---------------------------------------------------------------- frame

  private frame() {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastT) / 1000);
    this.lastT = now;
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  private update(dt: number) {
    const L = this.L;
    if ((this.phase === 'explode' || this.phase === 'live') && this.ambient && !this.reduced.matches) {
      this.q = quatNormalize(quatMul(quatFromAxisAngle(AMBIENT_AXIS, AMBIENT_RAD_PER_S * dt), this.q));
    }
    // Inertia: input feeds a target velocity that decays by 0.94 per 60 Hz frame; the applied velocity
    // follows it with 0.11 smoothing. Total rotation ≈ 16.7 × the input (AUDIT.md §9.1).
    const k = dt * 60;
    const s = 1 - decay(1 - SMOOTHING, dt);
    this.vel[0] += (this.tgt[0] - this.vel[0]) * s;
    this.vel[1] += (this.tgt[1] - this.vel[1]) * s;
    this.tgt[0] *= decay(FRICTION, dt);
    this.tgt[1] *= decay(FRICTION, dt);
    if (Math.abs(this.vel[0]) > 1e-7) this.q = quatNormalize(quatMul(worldRotationInLayout([1, 0, 0], this.vel[0] * k), this.q));
    if (Math.abs(this.vel[1]) > 1e-7) this.q = quatNormalize(quatMul(worldRotationInLayout([0, 1, 0], this.vel[1] * k), this.q));

    if (this.phase === 'ring') this.ring.rot += RING_SPEED * this.ring.mult * dt;

    const e = this.ex.e;
    const planeH = L.planePx * L.wpp;
    for (const p of this.planes) {
      const m = p.mesh;
      m.renderOrder = 0;
      p.mat.depthTest = true;
      if (this.phase === 'ring') {
        const isRing = p.index < RING_COUNT;
        if (!isRing) { m.visible = false; continue; }
        // Counter-clockwise on screen, starting at the top, 36° apart.
        const a = -Math.PI / 2 + (p.index * 2 * Math.PI) / RING_COUNT - this.ring.rot;
        const cp = p.intro.cp;
        const rx = Math.cos(a) * L.ringPx * (1 - cp);
        const ry = Math.sin(a) * L.ringPx * (1 - cp);
        const size = lerp(p.intro.size, STACK_PX, cp);
        m.position.set(rx * L.wpp, -ry * L.wpp, p.index * 1.5 * cp * L.wpp);
        m.scale.setScalar(Math.max(size, 0.01) * L.wpp);
        p.mat.opacity = p.intro.opacity;
        continue;
      }
      if (this.phase === 'explode') {
        const t = this.explode.p;
        const bulge = 1 + 0.1 * Math.sin(Math.PI * t);
        const w = slotWorld(p.slot, this.q, L, bulge);
        const sz = p.index < RING_COUNT ? p.index * 1.5 * L.wpp : 0;
        m.position.set(w[0] * t, w[1] * t, lerp(sz, w[2], t));
        m.scale.setScalar(lerp(STACK_PX * L.wpp, planeH, t));
        p.mat.opacity = 1;
        continue;
      }
      if (this.phase !== 'live') continue;
      if (p === this.focus && e > 0) {
        const base = slotWorld(p.slot, this.q, L, 1);
        const pr = project(base, planeH, L);
        const d0 = -pr.z;
        const depth = lerp(d0, CAMERA_Z, e);
        const cx = lerp(pr.x, L.vw / 2, e);
        const cy = lerp(pr.y, L.vh / 2, e);
        const h = lerp(pr.h, L.expandedH, e);
        m.position.set(((cx - L.vw / 2) * depth) / L.focal, (-(cy - L.vh / 2) * depth) / L.focal, CAMERA_Z - depth);
        m.scale.setScalar((h * depth) / L.focal);
        m.renderOrder = 2;
        p.mat.depthTest = false;
        p.mat.opacity = 1;
      } else {
        const w = slotWorld(p.slot, this.q, L, 1 + 0.8 * e);
        m.position.set(w[0], w[1], w[2]);
        m.scale.setScalar(planeH);
        p.mat.opacity = 1 - smoothstep(0.35, 0.9, e);
      }
      m.visible = p.mat.opacity > 0.001;
    }
  }

  // ---------------------------------------------------------------- input

  private bind() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (ev) => this.down(ev));
    window.addEventListener('pointermove', (ev) => this.move(ev));
    window.addEventListener('pointerup', (ev) => this.up(ev));
    window.addEventListener('pointercancel', (ev) => { this.pointers.delete(ev.pointerId); if (this.press?.id === ev.pointerId) this.press = null; });
    c.addEventListener('pointerleave', () => {
      this.mouse.inside = false;
      if (!this.touchUI) this.hoverTo(null);
      this.updateCursor();
    });
    c.addEventListener('wheel', (ev) => this.wheel(ev), { passive: false });
  }

  private get interactive() {
    return this.active && this.phase === 'live';
  }

  private stopAmbient() {
    if (this.ambient) {
      this.ambient = false;
      this.hooks.onInteract();
    }
  }

  private down(ev: PointerEvent) {
    if (!this.interactive) return;
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    this.pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinch = Math.hypot(a.x - b.x, a.y - b.y);
      this.press = null;
      return;
    }
    this.press = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, lx: ev.clientX, ly: ev.clientY, travel: 0, max: 0 };
    try { this.canvas.setPointerCapture(ev.pointerId); } catch { /* not capturable */ }
  }

  private move(ev: PointerEvent) {
    this.mouse = { x: ev.clientX, y: ev.clientY, inside: ev.target === this.canvas };
    if (!this.interactive) return;
    if (this.pointers.has(ev.pointerId)) this.pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      this.tgt[1] += (d - this.pinch) * WHEEL_GAIN * 3;
      this.pinch = d;
      this.stopAmbient();
      return;
    }
    const pr = this.press;
    if (pr && pr.id === ev.pointerId) {
      const dx = ev.clientX - pr.lx;
      const dy = ev.clientY - pr.ly;
      pr.lx = ev.clientX;
      pr.ly = ev.clientY;
      pr.travel += Math.hypot(dx, dy);
      pr.max = Math.max(pr.max, Math.hypot(ev.clientX - pr.x, ev.clientY - pr.y));
      if (pr.max >= 6 || pr.travel >= 10) {
        if (!this.isOpen) {
          this.tgt[1] += dx * DRAG_GAIN;
          this.tgt[0] += dy * DRAG_GAIN;
          this.stopAmbient();
        }
        this.canvas.style.cursor = 'grabbing';
      }
      return;
    }
    if (ev.pointerType === 'mouse' && this.mouse.inside && !this.touchUI && !this.isOpen) this.hoverTo(this.pick(ev.clientX, ev.clientY));
    this.updateCursor();
  }

  private up(ev: PointerEvent) {
    this.pointers.delete(ev.pointerId);
    const pr = this.press;
    if (!pr || pr.id !== ev.pointerId) return;
    this.press = null;
    if (!this.interactive) return;
    if (pr.max < 6 && pr.travel < 10) this.click(ev.clientX, ev.clientY);
    this.updateCursor();
  }

  private wheel(ev: WheelEvent) {
    ev.preventDefault();
    if (!this.interactive || this.isOpen) return;
    // Horizontal wheel is ignored (AUDIT.md §3.3).
    const dy = ev.deltaMode === 1 ? ev.deltaY * 16 : ev.deltaY;
    if (!dy) return;
    this.tgt[1] += dy * WHEEL_GAIN;
    this.stopAmbient();
  }

  private click(x: number, y: number) {
    const hit = this.pick(x, y);
    this.stopAmbient();
    if (this.isOpen && this.focus) {
      if (hit === this.focus && !this.touchUI) this.hooks.onOpen(this.focus.plate);
      else this.collapse();
      return;
    }
    if (hit) this.expand(hit);
  }

  private pick(x: number, y: number): PlaneObj | null {
    const ndc = new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const candidates = this.isOpen && this.focus ? [this.focus] : this.planes.filter((p) => p.mesh.visible && p.mat.opacity > 0.5);
    const hits = this.raycaster.intersectObjects(candidates.map((p) => p.mesh), false);
    if (!hits.length) return null;
    // Planes don't write depth; the expanded plane is drawn on top regardless of distance.
    const meshes = hits.map((h) => h.object);
    if (this.focus && meshes.includes(this.focus.mesh) && this.ex.e > 0.05) return this.focus;
    return this.planes.find((p) => p.mesh === meshes[0]) ?? null;
  }

  private hoverTo(hit: PlaneObj | null) {
    if (hit === this.candidate) {
      if (hit === this.hovered) clearTimeout(this.leave);
      return;
    }
    this.candidate = hit;
    clearTimeout(this.dwell);
    if (hit) {
      clearTimeout(this.leave);
      if (hit !== this.hovered) this.dwell = window.setTimeout(() => this.setHover(hit), 90);
    } else {
      this.leave = window.setTimeout(() => this.setHover(null), 200);
    }
  }

  private setHover(p: PlaneObj | null, silent = false) {
    clearTimeout(this.dwell);
    clearTimeout(this.leave);
    if (p === this.hovered) return;
    this.hovered = p;
    if (!silent) this.hooks.onHover(p?.plate ?? null);
  }

  private updateCursor() {
    const { x, y, inside } = this.mouse;
    if (!inside || !this.interactive) {
      this.canvas.style.cursor = '';
      this.hooks.onCursor(null, x, y);
      return;
    }
    if (this.press && (this.press.max >= 6 || this.press.travel >= 10)) return;
    if (this.isOpen) {
      const over = this.pick(x, y) === this.focus;
      this.canvas.style.cursor = 'pointer';
      this.hooks.onCursor(this.touchUI ? null : over ? 'View' : 'Close', x, y);
      return;
    }
    this.hooks.onCursor(null, x, y);
    const hit = this.candidate;
    const near = Math.hypot(x - innerWidth / 2, y - innerHeight / 2) < 250;
    this.canvas.style.cursor = hit ? 'pointer' : near ? 'grab' : 'default';
  }

  // ---------------------------------------------------------------- expand

  expandIndex(i: number) {
    const p = this.planes[i];
    if (p && this.interactive) this.expand(p);
  }

  private expand(p: PlaneObj) {
    if (this.focus && this.focus !== p) {
      gsap.killTweensOf(this.ex);
      this.ex.e = 0;
    }
    this.focus = p;
    this.isOpen = true;
    this.setHover(null, true);
    this.candidate = null;
    this.loadLarge(p);
    this.hooks.onExpand(p.plate);
    const rm = this.reduced.matches;
    gsap.to(this.ex, { e: 1, duration: rm ? 0.25 : 0.8, ease: rm ? 'power1.out' : 'power4.out', overwrite: true });
    this.updateCursor();
  }

  collapse(instant = false) {
    if (!this.focus) return;
    this.isOpen = false;
    this.hooks.onExpand(null);
    const done = () => { if (!this.isOpen) this.focus = null; };
    if (instant) {
      gsap.killTweensOf(this.ex);
      this.ex.e = 0;
      done();
    } else {
      const rm = this.reduced.matches;
      gsap.to(this.ex, { e: 0, duration: rm ? 0.25 : 0.8, ease: rm ? 'power1.out' : 'power4.out', overwrite: true, onComplete: done });
    }
    this.updateCursor();
  }

  get expandedPlate() {
    return this.isOpen ? this.focus?.plate ?? null : null;
  }

  private loadLarge(p: PlaneObj) {
    if (p.large || p.largeLoading) return;
    p.largeLoading = true;
    this.loader.load(p.plate.large, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      p.large = tex;
      p.mat.map = tex;
      p.mat.needsUpdate = true;
    });
  }

  // ---------------------------------------------------------------- QA

  /** Screen rects of every plane, for tests and the verification sheets. */
  snapshot() {
    const L = this.L;
    const rows = this.planes.map((p) => {
      const m = p.mesh;
      const pr = project([m.position.x, m.position.y, m.position.z], m.scale.x, L);
      return { i: p.index, id: p.plate.id, cx: pr.x, cy: pr.y, w: pr.w, h: pr.h, z: pr.z, opacity: p.mat.opacity, visible: m.visible };
    });
    const order = [...rows].sort((a, b) => a.z - b.z);
    return {
      phase: this.phase,
      ambient: this.ambient,
      sinceExplode: this.explodeAt == null ? null : (performance.now() - this.explodeAt) / 1000,
      q: this.q,
      expanded: this.expandedPlate?.id ?? null,
      e: this.ex.e,
      planes: rows.map((r) => ({ ...r, layer: order.indexOf(r) + 1 })),
    };
  }
}
