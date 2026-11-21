// Archive: the signature sphere (AUDIT.md §3) plus its DOM overlays.
import { gsap } from 'gsap';
import { descriptor, name as brandName, siteTitle } from '../config/brand';
import { collection, groupOf, imageHref, images, INTRO_RING, type StudyImage as Plate } from '../content/study';
import type { Nav } from '../nav';
import { SphereScene, webglAvailable } from '../scene/sphere';
import { sound } from '../sound';
import { icon, icons } from '../ui/icons';
import { maskedIn, maskedOut, prefersReduced } from '../ui/reveal';
import { h, type EnterInfo, type Page, type Route } from './types';

const plateHref = imageHref;

export class ArchivePage implements Page {
  route: Route = { name: 'archive', path: '/' };
  title = siteTitle;
  el: HTMLElement;
  chrome: HTMLElement;
  ready: Promise<void> = Promise.resolve();
  scene: SphereScene | null = null;
  private slot: HTMLElement;
  private action: HTMLButtonElement;
  private cursor: HTMLElement;
  private live: HTMLElement;
  private intro: HTMLElement | null = null;
  private fallback: HTMLElement | null = null;
  private rowKey: string | null = null;
  private rowEl: HTMLElement | null = null;
  private hovered: Plate | null = null;
  private expanded: Plate | null = null;
  private kbFocus: Plate | null = null;
  private restShown = false;
  private started = false;
  private cx: gsap.QuickToFunc;
  private cy: gsap.QuickToFunc;
  private cursorOn = false;
  private cursorText: string | null = null;
  private promptLayer: HTMLElement | null = null;
  private prompt: HTMLElement | null = null;
  private promptOff: (() => void) | null = null;
  /** performance.now() when the intro began (QA: aligns timestamps with the reference). */
  introAt: number | null = null;

  constructor(private nav: Nav, private go: (path: string) => void) {
    this.el = h('main', { class: 'page page--archive', id: 'main' },
      h('h1', { class: 'sr-only', tabindex: '-1' }, `Archive: ${collection.title}`),
      h('p', { class: 'sr-only' }, `${collection.credit}. Eighteen photographs in six groups. Browse them below, or open the list of photographs with the Tab key.`),
    );
    this.slot = h('div', { class: 'title-slot' });
    this.action = h('button', { type: 'button', class: 'title-action' }, 'View piece') as HTMLButtonElement;
    this.action.hidden = true;
    this.action.addEventListener('click', () => this.expanded && this.go(plateHref(this.expanded)));
    this.cursor = h('div', { class: 'cursor-label', 'aria-hidden': 'true' });
    this.live = h('p', { class: 'sr-only', role: 'status', 'aria-live': 'polite' });
    const kb = h('nav', { class: 'kb-list', 'aria-label': `Photographs in ${collection.title}` },
      h('ul', {}, ...images.map((p, i) => {
        const a = h('a', { href: plateHref(p), 'data-plate': String(i) }, `${p.caption}, ${groupOf(p).name}`);
        a.addEventListener('focus', () => { this.kbFocus = p; this.refreshRow(); });
        a.addEventListener('blur', () => { if (this.kbFocus === p) { this.kbFocus = null; this.refreshRow(); } });
        return h('li', {}, a);
      })),
    );
    this.chrome = h('div', { class: 'chrome chrome--archive' }, this.slot, this.action, this.live, kb);
    // The cursor label blends (difference) with the page, so it must live outside the chrome's stacking context.
    document.body.append(this.cursor);
    this.cx = gsap.quickTo(this.cursor, 'x', { duration: 0.5, ease: 'power3.out' });
    this.cy = gsap.quickTo(this.cursor, 'y', { duration: 0.5, ease: 'power3.out' });
    gsap.set(this.cursor, { scale: 0.6, opacity: 0, transformOrigin: '0 0' });

    if (webglAvailable()) {
      try {
        this.scene = new SphereScene({
          onHover: (p) => { this.hovered = p; this.refreshRow(); },
          onExpand: (p) => { if (p) sound.cue('click'); this.onExpand(p); },
          onOpen: (p) => this.go(plateHref(p)),
          onCursor: (label, x, y) => this.setCursor(label, x, y),
          onInteract: () => {},
        }, images, INTRO_RING);
        this.scene.contextLost = () => this.showFallback();
        this.el.append(this.scene.canvas);
        window.addEventListener('resize', () => this.scene?.resize());
      } catch {
        this.scene = null;
      }
    }
    if (!this.scene) this.showFallback();
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.scene?.expandedPlate && this.el.isConnected) this.scene.collapse();
    });
    this.ready = new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
  }

  // ------------------------------------------------------------ title slot

  private refreshRow() {
    const p = this.expanded ?? this.hovered ?? this.kbFocus;
    if (p) this.setRow(p.id, p.caption, groupOf(p).name);
    else if (this.restShown) this.setRow('rest', collection.title, collection.credit);
    else this.setRow(null);
  }

  private setRow(key: string | null, a = '', b = '') {
    if (key === this.rowKey) return;
    this.rowKey = key;
    const old = this.rowEl;
    if (old) maskedOut([...old.querySelectorAll('.mask > span')], () => old.remove());
    this.rowEl = null;
    if (!key) return;
    const row = h('div', { class: 'title-row' },
      h('span', { class: 'mask' }, h('span', { class: 'title-a' }, a)),
      b ? h('span', { class: 'mask' }, h('span', { class: 'title-b' }, b)) : '',
    );
    this.slot.append(row);
    this.rowEl = row;
    maskedIn([...row.querySelectorAll('.mask > span')]);
  }

  private onExpand(p: Plate | null) {
    this.expanded = p;
    if (p) this.hovered = null;
    this.refreshRow();
    const touch = this.scene?.touchUI ?? false;
    if (p && touch) {
      this.action.hidden = false;
      gsap.fromTo(this.action, { opacity: 0, y: prefersReduced() ? 0 : 24 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power4.out', overwrite: true });
    } else if (!this.action.hidden) {
      gsap.to(this.action, { opacity: 0, duration: 0.3, overwrite: true, onComplete: () => { if (!this.expanded) this.action.hidden = true; } });
    }
    this.live.textContent = p ? `${p.caption}, ${groupOf(p).name}, enlarged.` : '';
  }

  /**
   * Cursor label beside the native pointer: Drag / View / Details, or an X for Close.
   * It trails the pointer slightly (none with reduced motion) and flips sides near the viewport edges.
   */
  private setCursor(label: string | null, x: number, y: number) {
    const desktop = matchMedia('(min-width: 1025px) and (hover: hover)').matches;
    const overTitle = y > innerHeight - 70 && Math.abs(x - innerWidth / 2) < 200;
    const show = !!label && desktop && !overTitle;
    if (label && label !== this.cursorText) {
      this.cursorText = label;
      this.cursor.dataset.label = label;
      this.cursor.replaceChildren(label === 'Close' ? icon(icons.close) : document.createTextNode(label));
    }
    if (!show) this.cursor.dataset.label = '';
    else this.cursor.dataset.label = this.cursorText ?? '';
    const off = 14;
    const w = this.cursor.offsetWidth;
    const hgt = this.cursor.offsetHeight;
    const tx = x + off + w > innerWidth - 8 ? x - off - w : x + off;
    const ty = y + off + hgt > innerHeight - 8 ? y - off - hgt : y + off;
    const reduced = prefersReduced();
    if (reduced || (show && !this.cursorOn)) gsap.set(this.cursor, { x: tx, y: ty });
    else { this.cx(tx); this.cy(ty); }
    if (show !== this.cursorOn) {
      this.cursorOn = show;
      gsap.to(this.cursor, reduced
        ? { opacity: show ? 1 : 0, scale: 1, duration: 0.12, overwrite: 'auto' }
        : { opacity: show ? 1 : 0, scale: show ? 1 : 0.6, duration: 0.45, ease: 'power3.out', overwrite: 'auto' });
    }
  }

  // ------------------------------------------------------------ "Click to enable audio" (desktop intro)

  /**
   * A transparent layer over the sphere for the length of the intro. The first pointer move fades in
   * the prompt 14 px below-right of the arrow; it follows with the audit's 0.5 s power3.out lag. A click
   * while it is visible turns sound on and does nothing else: the layer takes that click, so it can never
   * open a piece, even if the pointer is over one as the intro ends.
   */
  private startAudioPrompt() {
    if (sound.enabled || !matchMedia('(min-width: 1025px) and (hover: hover) and (pointer: fine)').matches) return;
    const layer = h('div', { class: 'audio-layer', 'aria-hidden': 'true' });
    const prompt = h('div', { class: 'audio-prompt', 'aria-hidden': 'true' }, icon(icons.volumeOn, 12), h('span', {}, 'Click to enable audio'));
    this.chrome.append(layer);
    document.body.append(prompt); // outside the chrome's stacking context, so difference blending reaches the page
    this.promptLayer = layer;
    this.prompt = prompt;
    gsap.set(prompt, { opacity: 0 });
    const px = gsap.quickTo(prompt, 'x', { duration: 0.5, ease: 'power3.out' });
    const py = gsap.quickTo(prompt, 'y', { duration: 0.5, ease: 'power3.out' });
    let shown = false;
    layer.addEventListener('pointermove', (e) => {
      if (!shown) {
        shown = true;
        prompt.dataset.visible = 'true';
        gsap.set(prompt, { x: e.clientX + 14, y: e.clientY + 14 });
        gsap.to(prompt, { opacity: 1, duration: 0.3 });
      }
      px(e.clientX + 14);
      py(e.clientY + 14);
    });
    layer.addEventListener('pointerdown', (e) => e.stopPropagation());
    layer.addEventListener('click', (e) => {
      e.stopPropagation();
      if (shown && !sound.enabled) sound.enable(); // the toggle updates through its subscription
    });
    this.promptOff = sound.subscribe((on) => { if (on) this.dismissAudioPrompt(0.4); });
  }

  private dismissAudioPrompt(duration: number) {
    const prompt = this.prompt;
    const layer = this.promptLayer;
    if (!prompt || !layer) return;
    this.prompt = null;
    this.promptLayer = null;
    this.promptOff?.();
    this.promptOff = null;
    const wasShown = prompt.dataset.visible === 'true';
    delete prompt.dataset.visible;
    gsap.killTweensOf(prompt);
    // Never shown (no pointer movement): nothing to consume, so the sphere takes input straight away.
    if (duration === 0 || !wasShown) { prompt.remove(); layer.remove(); return; }
    // The layer stays for the fade so a late click is still consumed rather than opening a piece.
    gsap.to(prompt, { opacity: 0, duration, onComplete: () => { prompt.remove(); layer.remove(); } });
  }

  // ------------------------------------------------------------ fallback

  private showFallback() {
    if (this.fallback) return;
    this.scene?.canvas.remove();
    this.scene = null;
    this.restShown = false;
    this.setRow(null);
    this.intro?.remove();
    this.fallback = h('div', { class: 'page__scroll fallback' },
      h('header', { class: 'fallback__head' },
        h('p', {}, h('span', { class: 't-sans' }, collection.title), ' ', h('span', { class: 't-serif' }, collection.credit)),
      ),
      h('ul', { class: 'grid' }, ...images.map((p) => h('li', { class: 'tile' },
        h('a', { href: plateHref(p) },
          h('img', { src: p.medium, srcset: `${p.small} 300w, ${p.medium} 640w, ${p.large} 1086w`, sizes: '(max-width: 640px) calc(100vw - 16px), (max-width: 1024px) calc(50vw - 12px), calc(33vw - 11px)', alt: p.alt, width: '640', height: '853', loading: 'lazy', decoding: 'async' }),
          h('span', { class: 'tile__title' }, p.caption),
          h('span', { class: 'tile__sub' }, groupOf(p).name),
        ),
      ))),
    );
    this.el.append(this.fallback);
    this.nav.show();
  }

  // ------------------------------------------------------------ intro

  private playIntro() {
    const s = this.scene!;
    this.introAt = performance.now();
    const letters = brandName.split('').map((c) => h('span', { class: 'mask' }, h('span', {}, c)));
    const logo = h('div', { class: 'intro__logo' }, ...letters);
    const num = h('span', {}, '001');
    const counter = h('div', { class: 'intro__counter' }, h('span', { class: 'mask' }, num));
    const wl = h('div', { class: 'intro__word intro__word--l' }, h('span', { class: 'mask' }, h('span', { class: 't-sans' }, brandName)));
    const wr = h('div', { class: 'intro__word intro__word--r' }, h('span', { class: 'mask' }, h('span', { class: 't-serif' }, descriptor)));
    this.intro = h('div', { class: 'intro', 'aria-hidden': 'true' }, logo, counter, wl, wr);
    this.el.prepend(this.intro);

    const letterEls = letters.map((m) => m.firstElementChild!);
    const words = [wl, wr].map((w) => w.querySelector('.mask > span')!);
    gsap.set([...letterEls, num, ...words], { yPercent: 100 });
    gsap.set(words, { opacity: 0 });
    // Preloader mark assembles from the last letter to the first over 1.7 s, then holds.
    [...letterEls].reverse().forEach((el, i) => gsap.to(el, { yPercent: 0, duration: 0.7, ease: 'power4.out', delay: i * 0.25 }));
    gsap.to(num, { yPercent: 0, duration: 0.75, ease: 'power4.out', delay: 0.25 });
    gsap.to(words, { yPercent: 0, opacity: 1, duration: 0.9, ease: 'power4.out', stagger: 0.07, delay: 0.86 });
    const count = { v: 1 };
    const paint = () => { num.textContent = String(Math.round(count.v)).padStart(3, '0'); };
    // Real load progress, paced like the reference (029 at ≈1.36 s, 099 at ≈1.76 s after the intro starts), capped at 099 until the gate.
    const t0 = performance.now();
    let frac = 0;
    let shown = 1;
    const pace = () => {
      const ramp = Math.min(1, Math.max(0, ((performance.now() - t0) / 1000 - 1.15) / 0.4));
      const target = Math.round(Math.min(99, 1 + 98 * Math.min(frac, ramp)));
      if (target > shown) {
        shown = target;
        gsap.to(count, { v: target, duration: 0.5, ease: 'power1.out', onUpdate: paint });
      }
    };
    gsap.ticker.add(pace);

    this.startAudioPrompt();
    void s.playIntro({
      onProgress: (loaded, total) => { frac = loaded / total; },
      onGate: () => {
        gsap.ticker.remove(pace);
        gsap.to(count, { v: 100, duration: 0.5, ease: 'power1.out', overwrite: true, onUpdate: paint, onComplete: () => {
          gsap.to(num, { yPercent: -200, duration: 0.7, ease: 'power4.out' });
        } });
      },
      onCollapse: () => {
        gsap.to(logo, { opacity: 0, duration: 0.75, ease: 'power2.inOut' });
        gsap.to(words, { yPercent: -100, opacity: 0, duration: 0.75, ease: 'power4.out', stagger: 0.07 });
      },
      onStackMeet: () => { sound.cue('paper'); },
      onExplode: () => {
        sound.cue('fabric');
        this.nav.dropIn();
        this.restShown = true;
        this.refreshRow();
      },
      onDone: () => {
        this.dismissAudioPrompt(0.5); // no click: the intro ends silently and the prompt goes
        this.intro?.remove();
        this.intro = null;
      },
    });
  }

  // ------------------------------------------------------------ Page

  enter(info: EnterInfo) {
    gsap.to(this.chrome, { opacity: 1, duration: info.instant ? 0 : 0.6, delay: info.instant ? 0 : info.duration * 0.5, overwrite: true });
    if (!this.scene) {
      this.nav.show();
      return;
    }
    const firstTime = !this.started;
    this.started = true;
    this.scene.activate(!firstTime);
    this.hovered = null;
    this.expanded = null;
    this.action.hidden = true;
    if (firstTime && info.initial && !prefersReduced()) {
      this.playIntro();
    } else {
      if (firstTime) this.scene.settle();
      this.restShown = true;
      this.nav.show();
    }
    this.rowKey = '__reset';
    this.refreshRow();
  }

  leave(info: { instant: boolean; duration: number }) {
    this.setCursor(null, 0, 0);
    this.dismissAudioPrompt(0);
    gsap.to(this.chrome, { opacity: 0, duration: info.instant ? 0 : 0.3, overwrite: true });
  }

  destroy() {
    this.scene?.deactivate();
  }

  focusTarget() {
    return this.el.querySelector('h1');
  }
}
