// Glass panel in the reference's Project Info treatment (AUDIT.md §5.3):
// a toggle pill at the top left that grows to 470 px wide, or an inset bottom sheet at ≤1024 px.
import { gsap } from 'gsap';
import { prefersReduced, revealIn, revealOut } from './reveal';

export interface PanelOptions {
  id: string;
  label: string;
  closedLabel: string;
  body: HTMLElement;
}

const SHEET = '(max-width: 1024px)';

export class Panel {
  readonly el: HTMLElement;
  readonly toggle: HTMLButtonElement;
  readonly body: HTMLElement;
  private bar: HTMLElement;
  private open_ = false;
  private tl: gsap.core.Timeline | null = null;
  private mql = matchMedia(SHEET);
  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.open_) {
      e.preventDefault();
      this.close();
      this.toggle.focus();
    }
  };
  private onResize = () => this.layout(true);

  constructor(private o: PanelOptions) {
    this.el = document.createElement('section');
    this.el.className = 'panel';
    this.el.setAttribute('aria-label', o.label);
    this.bar = document.createElement('span');
    this.bar.className = 'panel__bar';
    this.bar.setAttribute('aria-hidden', 'true');
    this.toggle = document.createElement('button');
    this.toggle.type = 'button';
    this.toggle.className = 'panel__toggle';
    this.toggle.textContent = o.closedLabel;
    this.toggle.setAttribute('aria-expanded', 'false');
    this.toggle.setAttribute('aria-controls', o.id);
    this.body = o.body;
    this.body.id = o.id;
    this.body.classList.add('panel__body');
    this.body.inert = true;
    this.el.append(this.bar, this.toggle, this.body);
    this.toggle.addEventListener('click', () => (this.open_ ? this.close() : this.open(true)));
    this.toggle.addEventListener('pointerenter', () => !this.mql.matches && gsap.to(this.el, { backgroundColor: 'rgba(216,216,216,0.5)', duration: 0.35, ease: 'power2.out' }));
    this.toggle.addEventListener('pointerleave', () => gsap.to(this.el, { backgroundColor: 'rgba(230,230,230,0.5)', duration: 0.5, ease: 'power3.inOut' }));
  }

  get isOpen() {
    return this.open_;
  }

  /** Call after the element is in the document. */
  mount(startOpen: boolean) {
    document.addEventListener('keydown', this.onKey);
    window.addEventListener('resize', this.onResize);
    this.el.classList.toggle('is-sheet', this.mql.matches);
    if (startOpen) this.open(false, true);
    else this.layout(true);
  }

  unmount() {
    document.removeEventListener('keydown', this.onKey);
    window.removeEventListener('resize', this.onResize);
    this.tl?.kill();
  }

  private openSize() {
    const sheet = this.mql.matches;
    const w = Math.min(470, innerWidth - 16);
    this.body.style.width = `${w}px`;
    this.body.style.maxHeight = '';
    const head = sheet ? 40 : 30;
    const max = innerHeight - 16 - (sheet ? 48 : 0);
    const h = Math.min(head + this.body.scrollHeight, max);
    this.body.style.maxHeight = `${h - head}px`;
    return { w, h };
  }

  private closedSize() {
    return { w: this.toggle.offsetWidth, h: 30 };
  }

  private layout(set: boolean) {
    this.el.classList.toggle('is-sheet', this.mql.matches);
    const s = this.open_ ? this.openSize() : this.closedSize();
    if (set) gsap.set(this.el, { width: s.w, height: s.h });
    return s;
  }

  open(focus: boolean, instantText = false) {
    if (this.open_) return;
    this.open_ = true;
    this.tl?.kill();
    this.el.classList.add('is-open');
    this.toggle.textContent = 'Close';
    this.toggle.setAttribute('aria-expanded', 'true');
    this.body.inert = false;
    this.body.style.visibility = 'visible';
    const s = this.layout(false);
    const rm = prefersReduced();
    this.tl = gsap.timeline();
    this.tl.to(this.el, { width: s.w, height: s.h, duration: rm ? 0 : 0.7, ease: 'power4.out' }, 0);
    this.tl.add(revealIn(this.body, instantText ? 0.35 : 0), 0);
    if (focus) {
      const first = this.body.querySelector<HTMLElement>('[data-autofocus], input:not([type=hidden]):not([tabindex="-1"]), textarea, select, a, button');
      first?.focus({ preventScroll: true });
    }
  }

  close() {
    if (!this.open_) return;
    this.open_ = false;
    this.tl?.kill();
    this.toggle.textContent = this.o.closedLabel;
    this.toggle.setAttribute('aria-expanded', 'false');
    this.body.inert = true;
    const s = this.closedSize();
    const rm = prefersReduced();
    this.tl = gsap.timeline({
      onComplete: () => {
        this.body.style.visibility = 'hidden';
        this.el.classList.remove('is-open');
      },
    });
    this.tl.add(revealOut(this.body), 0);
    this.tl.to(this.el, { width: s.w, height: s.h, duration: rm ? 0 : 0.5, ease: 'power3.inOut' }, rm ? 0 : 0.1);
  }

  /** Re-measure after the body's content changes (e.g. a form is replaced by its confirmation). */
  refit() {
    if (!this.open_) return;
    const s = this.openSize();
    gsap.to(this.el, { width: s.w, height: s.h, duration: prefersReduced() ? 0 : 0.6, ease: 'power4.out' });
  }

  /** Ride in with the page slide: from above on desktop, from below as a sheet. */
  rideIn(duration = 1.2) {
    const from = this.mql.matches ? 160 : -160;
    if (prefersReduced() || duration === 0) return gsap.set(this.el, { y: 0 });
    return gsap.fromTo(this.el, { y: from }, { y: 0, duration, ease: 'expo.inOut' });
  }

  rideOut(duration = 1.2) {
    const to = this.mql.matches ? 160 : -160;
    if (prefersReduced() || duration === 0) return gsap.set(this.el, { y: to });
    return gsap.to(this.el, { y: to, duration, ease: 'expo.inOut' });
  }
}
