// Mino — app shell, router and page transitions (AUDIT.md §6).
import '@fontsource-variable/geist';
import '@fontsource-variable/newsreader/opsz.css';
import './styles.css';
import { gsap } from 'gsap';
import { Nav, type NavName } from './nav';
import { ArchivePage } from './pages/archive';
import { aboutPage } from './pages/about';
import { labelsPage } from './pages/labels';
import { notFoundPage, piecePage } from './pages/piece';
import { parseRoute, retiredRedirect, type Page, type Route } from './pages/types';
import { sound } from './sound';
import { prefersReduced } from './ui/reveal';
import { createSoundToggle } from './ui/sound-toggle';

const SLIDE = 1.2;
const ORDER: Record<string, number> = { archive: 0, about: 1, labels: 2 };

const root = document.getElementById('pages')!;
const chromeRoot = document.getElementById('chrome')!;
const nav = new Nav();
// Sound control on every page; the visitor's choice lasts while they move between pages.
document.body.append(createSoundToggle());
sound.preload();
let archive: ArchivePage | null = null;
let current: Page | null = null;
let running: { tween: gsap.core.Tween | null; finish: () => void } | null = null;

const navName = (r: Route): NavName => (r.name === 'about' ? 'about' : r.name === 'labels' ? 'labels' : 'archive');

function makePage(route: Route): Page {
  switch (route.name) {
    case 'archive':
      return (archive ??= new ArchivePage(nav, (p) => go(p, 'push')));
    case 'about':
      return aboutPage(route);
    case 'labels':
      return labelsPage(route);
    case 'piece':
      return piecePage(route) ?? notFoundPage(route);
    default:
      return notFoundPage(route);
  }
}

function mount(p: Page) {
  root.append(p.el);
  if (p.chrome) chromeRoot.append(p.chrome);
}

function unmount(p: Page) {
  p.el.remove();
  if (p.chrome && p.chrome.parentNode === chromeRoot) p.chrome.remove();
  p.destroy();
}

async function go(href: string, kind: 'push' | 'pop' | 'initial') {
  const url = new URL(href, location.href);
  const route = parseRoute(url.pathname);
  // Old URLs (signup pages → /about, demo garments → /): the server answers with a 301; this covers in-app and dev.
  const moved = retiredRedirect(url.pathname);
  if (moved) {
    url.pathname = moved;
    if (kind !== 'push') history.replaceState(null, '', url.pathname + url.search + url.hash);
  }
  if (kind === 'push') {
    if (current && route.path === current.route.path) {
      if (url.hash !== location.hash) history.replaceState(null, '', url.pathname + url.hash);
      return;
    }
    history.pushState(null, '', url.pathname + url.search + url.hash);
  }
  // A click during a running slide cuts it short, then starts a fresh slide (AUDIT.md §6).
  running?.finish();

  const old = current;
  const page = makePage(route);
  current = page;
  document.title = page.title;
  nav.setActive(navName(route), kind !== 'initial');
  const instant = kind !== 'push' || !old || prefersReduced();

  if (instant) {
    if (old) {
      old.leave({ instant: true, duration: 0, to: route });
      unmount(old);
    }
    mount(page);
    page.enter({ instant: true, initial: kind === 'initial', from: old?.route ?? null, duration: 0 });
    if (kind === 'pop') page.focusTarget()?.focus({ preventScroll: true });
    if (prefersReduced() && kind === 'push') page.focusTarget()?.focus({ preventScroll: true });
    return;
  }

  // Piece pages sit a level deeper: they slide vertically.
  const deep = (n: string) => n === 'piece';
  const toDeeper = deep(route.name) && !deep(old!.route.name);
  const fromDeeper = deep(old!.route.name) && !deep(route.name);
  const axis = toDeeper || fromDeeper ? 'y' : 'x';
  const forward = toDeeper ? true : fromDeeper ? false : (ORDER[route.name] ?? 0) >= (ORDER[old!.route.name] ?? 0);

  const track = document.createElement('div');
  track.className = `track track--${axis}`;
  root.append(track);
  track.append(...(forward ? [old!.el, page.el] : [page.el, old!.el]));
  if (page.chrome) chromeRoot.append(page.chrome);
  const prop = axis === 'x' ? 'xPercent' : 'yPercent';
  gsap.set(track, { [prop]: forward ? 0 : -50 });
  old!.leave({ instant: false, duration: SLIDE, to: route });
  page.enter({ instant: false, initial: false, from: old!.route, duration: SLIDE });

  const state = { tween: null as gsap.core.Tween | null, finish: () => {} };
  let done = false;
  state.finish = () => {
    if (done) return;
    done = true;
    state.tween?.kill();
    running = null;
    unmount(old!);
    root.append(page.el);
    track.remove();
    page.focusTarget()?.focus({ preventScroll: true });
  };
  running = state;
  // Wait for the new page to be ready, at most 800 ms.
  await Promise.race([page.ready, new Promise((r) => setTimeout(r, 800))]);
  if (done) return;
  state.tween = gsap.to(track, { [prop]: forward ? -50 : 0, duration: SLIDE, ease: 'expo.inOut', onComplete: state.finish });
}

document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = (e.target as Element).closest?.('a[href]') as HTMLAnchorElement | null;
  if (!a || a.target || a.hasAttribute('download')) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/media/')) return;
  e.preventDefault();
  void go(url.pathname + url.hash, 'push');
});

window.addEventListener('popstate', () => void go(location.pathname + location.hash, 'pop'));

async function boot() {
  document.documentElement.classList.add('js');
  await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]);
  nav.measure();
  const route = parseRoute(location.pathname);
  await go(location.pathname + location.hash, 'initial');
  if (route.name !== 'archive') nav.dropIn();
  window.addEventListener('resize', () => nav.measure());
}

// Read-only hooks for the test suite and verification sheets.
declare global {
  interface Window { __mino: { sound: typeof sound; nav: Nav; archive: () => ArchivePage | null; current: () => Page | null; running: () => boolean } }
}
window.__mino = { sound, nav, archive: () => archive, current: () => current, running: () => !!running };

void boot();
