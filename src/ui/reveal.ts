// Masked text reveals (AUDIT.md §5.3): words for single-line fields, lines for prose.
import { gsap } from 'gsap';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(SplitText);

export const prefersReduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

type Group = { targets: Element[]; stagger: number };
const splits = new WeakMap<HTMLElement, SplitText[]>();

/** Splits every [data-reveal] inside root. Call when root has its final width. */
function groups(root: HTMLElement): Group[] {
  for (const s of splits.get(root) ?? []) s.revert();
  const made: SplitText[] = [];
  const out: Group[] = [];
  root.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
    const kind = el.dataset.reveal;
    if (kind === 'words' || kind === 'lines') {
      const s = SplitText.create(el, { type: kind, mask: kind, [kind === 'words' ? 'wordsClass' : 'linesClass']: 'split-' + kind });
      made.push(s);
      out.push({ targets: kind === 'words' ? s.words : s.lines, stagger: kind === 'words' ? 0.07 : 0.1 });
    } else {
      out.push({ targets: [el], stagger: 0 });
    }
  });
  splits.set(root, made);
  return out;
}

export function revealIn(root: HTMLElement, delay = 0): gsap.core.Timeline {
  const tl = gsap.timeline({ delay });
  if (prefersReduced()) {
    tl.fromTo(root.querySelectorAll('[data-reveal]'), { opacity: 0 }, { opacity: 1, duration: 0.2 });
    return tl;
  }
  groups(root).forEach((g, i) => {
    tl.fromTo(g.targets, { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.9, ease: 'power4.out', stagger: g.stagger }, 0.08 + 0.05 * i);
  });
  return tl;
}

export function revealOut(root: HTMLElement): gsap.core.Timeline {
  const tl = gsap.timeline();
  const all = [...root.querySelectorAll('.split-words, .split-lines, [data-reveal]:not(:has(.split-words, .split-lines))')];
  if (prefersReduced()) {
    tl.to(root.querySelectorAll('[data-reveal]'), { opacity: 0, duration: 0.15 });
    return tl;
  }
  tl.to(all, { yPercent: -100, opacity: 0, duration: 0.4, ease: 'power4.out', stagger: { amount: 0.24, from: 'end' } });
  return tl;
}

/** Keyed masked row swap, used by the bottom title slot. */
export function maskedIn(targets: Element[], stagger = 0.07) {
  if (prefersReduced()) return gsap.fromTo(targets, { opacity: 0 }, { opacity: 1, duration: 0.2 });
  return gsap.fromTo(targets, { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.9, ease: 'power4.out', stagger });
}

export function maskedOut(targets: Element[], onComplete?: () => void, stagger = 0.07) {
  if (prefersReduced()) return gsap.to(targets, { opacity: 0, duration: 0.15, onComplete });
  return gsap.to(targets, { yPercent: -100, opacity: 0, duration: 0.75, ease: 'power4.out', stagger, onComplete });
}
