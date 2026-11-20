// Piece detail, in the reference's case template: header at y 200, image blocks, and a Details panel.
import { pageTitle } from '../config/brand';
import { EVENT_CREDIT, eventTitle, garmentBySlug, isDemo, labelName, platesFor, VIEW_NAMES } from '../content/sale';
import { Panel } from '../ui/panel';
import { revealIn } from '../ui/reveal';
import { h, type EnterInfo, type Page, type Route } from './types';

export function piecePage(route: Route): Page | null {
  const g = garmentBySlug(route.slug ?? '');
  if (!g) return null;
  const plates = platesFor(g.slug);
  const head = h('header', { class: 'head' },
    h('h1', { class: 'head__name', tabindex: '-1', 'data-reveal': 'words' }, g.title),
    h('p', { class: 'head__sub', 'data-reveal': 'words' }, eventTitle()),
  );
  const imgs: HTMLImageElement[] = [];
  const blocks = h('div', { class: 'blocks' }, ...plates.map((p, i) => {
    const img = h('img', { src: p.large, alt: p.alt, width: '960', height: '1280', loading: i < 2 ? 'eager' : 'lazy', decoding: 'async' }) as HTMLImageElement;
    imgs.push(img);
    return h('figure', { class: 'block', id: `plate-${p.id.slice(0, 2)}` }, img, h('figcaption', { class: 'block__cap' }, VIEW_NAMES[p.view]));
  }));
  const scroll = h('div', { class: 'page__scroll' }, head, blocks, h('footer', { class: 'foot' }, EVENT_CREDIT));
  const el = h('main', { class: 'page page--piece', id: 'main' }, scroll);

  const facts: [string, string | null][] = [['Season', g.season], ['Size', g.size], ['Condition', g.condition], ['Archive price', g.price]];
  const supplied = facts.filter(([, v]) => v);
  const list = (title: string, ...items: (Node | string)[]) =>
    h('div', { class: 'panel__list' }, h('h3', { class: 'panel__list-title', 'data-reveal': 'words' }, title), ...items);
  const body = h('div', {},
    h('h2', { class: 'panel__name', 'data-reveal': 'words' }, g.title),
    h('p', { class: 'panel__type', 'data-reveal': 'words' }, labelName()),
    g.note
      ? h('p', { class: 'panel__desc', 'data-reveal': 'lines' }, g.note)
      : isDemo()
        ? h('p', { class: 'panel__desc', 'data-reveal': 'lines' }, 'Demo piece. Once the label confirms it, this space holds the founder’s note, with the season, size, condition and archive price.')
        : '',
    list('Details', ...(supplied.length
      ? supplied.map(([k, v]) => h('p', { class: 'panel__item', 'data-reveal': 'words' }, `${k}: ${v}`))
      : [h('p', { class: 'panel__item', 'data-reveal': 'words' }, 'To be confirmed by the label')])),
    list('Availability',
      h('p', { class: 'panel__item', 'data-reveal': 'lines' }, 'Sold on the label’s own website while its archive is open.'),
    ),
  );
  const panel = new Panel({ id: 'details', label: 'Piece details', closedLabel: 'Details', body });
  const chrome = h('div', { class: 'chrome' }, panel.el);
  const first = imgs[0];
  const ready = first ? Promise.race([first.decode().catch(() => undefined), new Promise((r) => setTimeout(r, 800))]).then(() => undefined) : Promise.resolve();

  return {
    route,
    title: pageTitle(`${g.title} — ${labelName()}`),
    el,
    chrome,
    ready,
    enter(info: EnterInfo) {
      panel.mount(false);
      panel.rideIn(info.instant ? 0 : info.duration);
      revealIn(head, info.instant ? 0.1 : 0.5);
    },
    leave(info) {
      panel.close();
      panel.rideOut(info.instant ? 0 : info.duration);
    },
    destroy() {
      panel.unmount();
    },
    focusTarget: () => el.querySelector('h1'),
  };
}

export function notFoundPage(route: Route): Page {
  const el = h('main', { class: 'page page--notfound', id: 'main' },
    h('div', { class: 'page__scroll' },
      h('header', { class: 'head' },
        h('h1', { class: 'head__name', tabindex: '-1' }, 'This page isn’t part of the sale.'),
        h('p', { class: 'head__sub' }, h('a', { href: '/' }, 'Back to the Archive')),
      ),
    ),
  );
  return { route, title: pageTitle('Not found'), el, chrome: null, ready: Promise.resolve(), enter() {}, leave() {}, destroy() {}, focusTarget: () => el.querySelector('h1') };
}
