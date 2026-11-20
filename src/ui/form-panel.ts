// Form popup used by the drop waitlist (/waitlist/<drop>) and "Plan an archive sale" (/for-labels).
// ≥641 px: a nonmodal card anchored top-left (role=dialog, aria-modal=false; no trap, no scroll lock).
// ≤640 px: a modal bottom sheet (aria-modal=true; focus trapped, page inert, background scroll locked).
// Escape and × close it; focus returns to whichever trigger opened it.
import { gsap } from 'gsap';

const SHEET = '(max-width: 640px)';
const FINE = '(hover: hover) and (pointer: fine)';
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([type=hidden]):not([tabindex="-1"]), select, textarea, [tabindex]:not([tabindex="-1"])';

export interface FormPanelOptions {
  id: string;
  title: string;
  /** Text on the corner pill that reopens the panel when it is closed. */
  triggerLabel: string;
  /** Everything under the header row: supporting copy, form, footer line. */
  body: HTMLElement;
  /** Show the corner pill that reopens the panel. Off when the page has its own call to action. */
  showTrigger?: boolean;
}

export class FormPanel {
  readonly el: HTMLElement;
  readonly trigger: HTMLButtonElement;
  readonly dialog: HTMLElement;
  readonly heading: HTMLHeadingElement;
  readonly body: HTMLElement;
  private closeBtn: HTMLButtonElement;
  private open_ = false;
  private opener: HTMLElement | null = null;
  private inerted: HTMLElement[] = [];
  private sheetMql = matchMedia(SHEET);
  private tween: gsap.core.Tween | null = null;

  constructor(o: FormPanelOptions) {
    this.el = document.createElement('div');
    this.el.className = 'fp';

    this.trigger = document.createElement('button');
    this.trigger.type = 'button';
    this.trigger.className = 'fp-trigger';
    this.trigger.setAttribute('aria-haspopup', 'dialog');
    this.trigger.setAttribute('aria-expanded', 'false');
    this.trigger.setAttribute('aria-controls', o.id);
    const pill = document.createElement('span');
    pill.className = 'fp-trigger__pill';
    pill.textContent = o.triggerLabel;
    this.trigger.append(pill);
    this.trigger.addEventListener('click', () => this.open({ opener: this.trigger }));
    this.trigger.hidden = o.showTrigger === false;

    this.dialog = document.createElement('section');
    this.dialog.className = 'fp-panel';
    this.dialog.id = o.id;
    this.dialog.setAttribute('role', 'dialog');
    this.dialog.setAttribute('aria-labelledby', `${o.id}-title`);
    this.dialog.hidden = true;

    const head = document.createElement('header');
    head.className = 'fp-head';
    this.heading = document.createElement('h2');
    this.heading.className = 'fp-title';
    this.heading.id = `${o.id}-title`;
    this.heading.tabIndex = -1;
    this.heading.textContent = o.title;
    this.closeBtn = document.createElement('button');
    this.closeBtn.type = 'button';
    this.closeBtn.className = 'fp-close';
    this.closeBtn.setAttribute('aria-label', 'Close');
    this.closeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" fill="none"/></svg>';
    this.closeBtn.addEventListener('click', () => this.close());
    head.append(this.heading, this.closeBtn);

    this.body = o.body;
    this.body.classList.add('fp-body');
    this.dialog.append(head, this.body);
    this.el.append(this.trigger, this.dialog);
    this.applyMode();
  }

  get isOpen() {
    return this.open_;
  }

  get isSheet() {
    return this.sheetMql.matches;
  }

  // ------------------------------------------------------------ lifecycle

  mount() {
    document.addEventListener('keydown', this.onKey, true);
    this.sheetMql.addEventListener('change', this.onMode);
    window.visualViewport?.addEventListener('resize', this.onViewport);
    window.visualViewport?.addEventListener('scroll', this.onViewport);
    this.dialog.addEventListener('focusin', this.onFocusIn);
  }

  unmount() {
    this.close({ restore: false, instant: true });
    document.removeEventListener('keydown', this.onKey, true);
    this.sheetMql.removeEventListener('change', this.onMode);
    window.visualViewport?.removeEventListener('resize', this.onViewport);
    window.visualViewport?.removeEventListener('scroll', this.onViewport);
    this.dialog.removeEventListener('focusin', this.onFocusIn);
  }

  // ------------------------------------------------------------ open / close

  /**
   * @param opener element that gets focus back on close (defaults to the corner trigger)
   * @param focus 'auto': first field on desktop, heading on touch / sheet. 'none': leave focus alone.
   */
  open({ opener = null as HTMLElement | null, focus = 'auto' as 'auto' | 'none', delay = 0 } = {}) {
    this.opener = opener ?? this.trigger;
    this.opener.setAttribute('aria-expanded', 'true');
    if (this.open_) {
      if (focus === 'auto') this.focusInitial();
      return;
    }
    this.open_ = true;
    this.tween?.kill();
    this.dialog.hidden = false;
    this.el.classList.add('is-open');
    this.trigger.setAttribute('aria-expanded', 'true');
    this.applyMode();
    this.onViewport();
    const from = this.isSheet ? 10 : -10;
    const rm = reduced();
    this.tween = gsap.fromTo(this.dialog, { opacity: 0, y: rm ? 0 : from }, { opacity: 1, y: 0, duration: 0.2, delay, ease: 'power2.out' });
    if (focus === 'auto') {
      if (delay) gsap.delayedCall(delay, () => this.open_ && this.focusInitial());
      else this.focusInitial();
    }
  }

  close({ restore = true, instant = false } = {}) {
    if (!this.open_) return;
    this.open_ = false;
    this.tween?.kill();
    this.trigger.setAttribute('aria-expanded', 'false');
    this.opener?.setAttribute('aria-expanded', 'false');
    this.releaseModal();
    const finish = () => {
      this.dialog.hidden = true;
      this.el.classList.remove('is-open');
      gsap.set(this.dialog, { clearProps: 'opacity,transform' });
    };
    // Show the trigger again first, so focus can return to it.
    this.el.classList.remove('is-open');
    if (restore) {
      const target = this.opener && this.opener.isConnected && this.opener.offsetParent !== null ? this.opener : this.trigger;
      target.focus({ preventScroll: true });
    }
    if (instant) return finish();
    this.el.classList.add('is-closing');
    const to = this.isSheet ? 10 : -10;
    this.tween = gsap.to(this.dialog, {
      opacity: 0, y: reduced() ? 0 : to, duration: 0.15, ease: 'power2.in',
      onComplete: () => { this.el.classList.remove('is-closing'); finish(); },
    });
  }

  /** First field on desktop (usable immediately); the heading on touch, so no keyboard pops up uninvited. */
  focusInitial() {
    const fine = matchMedia(FINE).matches && !this.isSheet;
    const field = this.body.querySelector<HTMLElement>('input:not([type=hidden]):not([tabindex="-1"]), select, textarea');
    (fine && field ? field : this.heading).focus({ preventScroll: true });
  }

  /** Element to focus after an in-app route change, when the panel opened on arrival. */
  initialFocusTarget(): HTMLElement {
    const fine = matchMedia(FINE).matches && !this.isSheet;
    const field = this.body.querySelector<HTMLElement>('input:not([type=hidden]):not([tabindex="-1"])');
    return fine && field ? field : this.heading;
  }

  // ------------------------------------------------------------ modes

  private onMode = () => {
    this.applyMode();
    this.onViewport();
  };

  private applyMode() {
    const sheet = this.isSheet;
    this.el.dataset.mode = sheet ? 'sheet' : 'card';
    this.dialog.setAttribute('aria-modal', sheet ? 'true' : 'false');
    if (this.open_ && sheet) this.holdModal();
    else this.releaseModal();
  }

  /** Mobile: make everything outside the sheet inert and lock background scroll. */
  private holdModal() {
    if (this.inerted.length) return;
    let node: HTMLElement = this.dialog;
    while (node.parentElement && node !== document.body) {
      for (const sib of Array.from(node.parentElement.children) as HTMLElement[]) {
        if (sib !== node && !sib.inert && sib.tagName !== 'SCRIPT') {
          sib.inert = true;
          this.inerted.push(sib);
        }
      }
      node = node.parentElement;
    }
    document.documentElement.classList.add('fp-locked');
  }

  private releaseModal() {
    for (const el of this.inerted) el.inert = false;
    this.inerted = [];
    document.documentElement.classList.remove('fp-locked');
  }

  private onKey = (e: KeyboardEvent) => {
    if (!this.open_) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.close();
      return;
    }
    if (e.key === 'Tab' && this.isSheet) {
      const items = [...this.dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => x.offsetParent !== null && !x.closest('[hidden]'));
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === this.heading || !this.dialog.contains(active))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (active === last || !this.dialog.contains(active))) { e.preventDefault(); first.focus(); }
    }
  };

  /** Follow the on-screen keyboard: keep the sheet above it and inside the visible area. */
  private onViewport = () => {
    const vv = window.visualViewport;
    if (!vv || !this.isSheet) {
      this.dialog.style.removeProperty('--fp-kb');
      this.dialog.style.removeProperty('--fp-vh');
      return;
    }
    const keyboard = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    this.dialog.style.setProperty('--fp-kb', `${keyboard}px`);
    this.dialog.style.setProperty('--fp-vh', `${vv.height}px`);
    this.keepFocusedVisible();
  };

  private onFocusIn = () => requestAnimationFrame(() => this.keepFocusedVisible());

  /** Scroll the sheet body (only) so the focused field is fully visible. */
  private keepFocusedVisible() {
    const el = document.activeElement as HTMLElement | null;
    if (!el || !this.body.contains(el) || this.body.scrollHeight <= this.body.clientHeight) return;
    const field = (el.closest('.fp-field, .fp-actions, .fp-row') as HTMLElement | null) ?? el;
    const b = this.body.getBoundingClientRect();
    const r = field.getBoundingClientRect();
    if (r.bottom > b.bottom - 8) this.body.scrollTop += r.bottom - b.bottom + 8;
    else if (r.top < b.top + 8) this.body.scrollTop -= b.top + 8 - r.top;
  }
}
