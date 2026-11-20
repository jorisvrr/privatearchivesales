// Centred navigation (AUDIT.md §2.1–2.2): wordmark placeholder + three pills.
// Label widths are measured from the rendered fonts, so the group re-centres for any wording.
import { gsap } from 'gsap';
import { name as brandName } from './config/brand';
import { isDemo } from './content/sale';
import { prefersReduced } from './ui/reveal';

export type NavName = 'archive' | 'about' | 'labels';
const ITEMS: { name: NavName; label: string; href: string }[] = [
  { name: 'archive', label: 'Archive', href: '/' },
  { name: 'about', label: 'About', href: '/about' },
  { name: 'labels', label: 'For labels', href: '/for-labels' },
];

interface Pill { name: NavName; a: HTMLAnchorElement; spacer: HTMLElement; label: HTMLElement; sup: HTMLElement; labelW: number; supW: number }

export class Nav {
  readonly el: HTMLElement;
  readonly logo: HTMLAnchorElement;
  readonly demo: HTMLElement | null;
  private row: HTMLElement;
  private slot: HTMLElement;
  private pills: Pill[] = [];
  private active: NavName | null = null;
  private shown = false;

  constructor() {
    this.el = document.createElement('nav');
    this.el.className = 'nav';
    this.el.setAttribute('aria-label', 'Main');
    this.row = document.createElement('div');
    this.row.className = 'nav__row';
    this.slot = document.createElement('span');
    this.slot.className = 'nav__slot';
    this.slot.setAttribute('aria-hidden', 'true');
    this.row.append(this.slot);
    ITEMS.forEach((it, i) => {
      const a = document.createElement('a');
      a.className = 'pill';
      a.href = it.href;
      a.dataset.nav = it.name;
      a.setAttribute('aria-label', it.label);
      const spacer = document.createElement('span');
      spacer.className = 'pill__spacer';
      const label = document.createElement('span');
      label.className = 'pill__label';
      label.textContent = it.label;
      const sup = document.createElement('sup');
      sup.className = 'pill__num';
      sup.textContent = String(i + 1);
      const clip = document.createElement('span');
      clip.className = 'pill__clip';
      clip.append(label);
      a.append(spacer, clip, sup);
      this.row.append(a);
      this.pills.push({ name: it.name, a, spacer, label, sup, labelW: 0, supW: 0 });
      a.addEventListener('pointerenter', () => this.hover(a, true));
      a.addEventListener('pointerleave', () => this.hover(a, false));
    });
    this.el.append(this.row);

    this.logo = document.createElement('a');
    this.logo.className = 'logo';
    this.logo.href = '/';
    this.logo.textContent = brandName;
    this.logo.setAttribute('aria-label', `${brandName}, Archive`);
    this.logo.addEventListener('click', (e) => {
      if (this.active === 'archive' && location.pathname === '/') e.preventDefault();
    });

    if (isDemo()) {
      this.demo = document.createElement('p');
      this.demo.className = 'demo-chip';
      this.demo.textContent = 'Demo';
      this.demo.title = 'Demo content: the label, pieces, dates and prices are not confirmed.';
      const sr = document.createElement('span');
      sr.className = 'sr-only';
      sr.textContent = ' content. The label, pieces, dates and prices shown are not confirmed.';
      this.demo.append(sr);
    } else this.demo = null;

    document.body.append(this.el, this.logo);
    if (this.demo) document.body.append(this.demo);
    gsap.ticker.add(() => this.track());
    gsap.set([this.el, this.logo, this.demo].filter(Boolean), { visibility: 'hidden' });
  }

  /** Measure the wordmark and labels with the loaded fonts. */
  measure() {
    this.slot.style.width = `${this.logo.getBoundingClientRect().width}px`;
    for (const p of this.pills) {
      p.labelW = p.label.getBoundingClientRect().width;
      p.supW = p.sup.getBoundingClientRect().width;
    }
    if (this.active) this.setActive(this.active, false);
  }

  setActive(name: NavName, animate = true) {
    this.active = name;
    const d = animate && !prefersReduced() ? 0.6 : 0;
    for (const p of this.pills) {
      const on = p.name === name;
      p.a.classList.toggle('is-active', on);
      if (on) p.a.setAttribute('aria-current', 'page');
      else p.a.removeAttribute('aria-current');
      const pad = on ? 12 : Math.max(0, (20 - p.supW) / 2);
      const vars = {
        spacer: { width: on ? p.labelW : 0, marginRight: on ? 3 : 0 },
        label: { left: on ? 12 : -(12 + p.labelW) },
        a: { paddingLeft: pad, paddingRight: pad },
      };
      const common = { duration: d, ease: 'power4.out', overwrite: true };
      gsap.to(p.spacer, { ...vars.spacer, ...common });
      gsap.to(p.label, { ...vars.label, ...common });
      gsap.to(p.a, { ...vars.a, ...common });
    }
  }

  /** The wordmark is its own fixed link; every tick it rides onto the placeholder. */
  private track() {
    if (!this.shown) return;
    const r = this.slot.getBoundingClientRect();
    const h = this.logo.offsetHeight;
    this.logo.style.transform = `translate3d(${r.left}px, ${r.top + (r.height - h) / 2}px, 0)`;
  }

  private hover(a: HTMLElement, on: boolean) {
    if (!matchMedia('(min-width: 1025px) and (hover: hover)').matches) return;
    gsap.to(a, on
      ? { backgroundColor: 'rgba(216,216,216,0.5)', duration: 0.35, ease: 'power2.out' }
      : { backgroundColor: 'rgba(237,237,237,0.5)', duration: 0.5, ease: 'power3.inOut' });
  }

  show() {
    this.shown = true;
    gsap.set([this.el, this.logo, this.demo].filter(Boolean), { visibility: 'visible' });
    this.track();
  }

  /** Entrance: yPercent −250 → 0, 1.2 s power4.out. The wordmark rides along. */
  dropIn() {
    this.show();
    if (prefersReduced()) return;
    gsap.fromTo(this.row, { yPercent: -250 }, { yPercent: 0, duration: 1.2, ease: 'power4.out' });
    if (this.demo) gsap.fromTo(this.demo, { yPercent: -250 }, { yPercent: 0, duration: 1.2, ease: 'power4.out' });
  }

  pillRects() {
    return {
      logo: this.logo.getBoundingClientRect().toJSON(),
      pills: this.pills.map((p) => ({ name: p.name, ...p.a.getBoundingClientRect().toJSON() })),
    };
  }
}
