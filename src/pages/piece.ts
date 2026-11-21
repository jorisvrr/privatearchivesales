// Detail page for one photograph of the study, in the reference's case template: header at y 200,
// the photograph, the rest of its group, and a Details panel with the collection details.
import { pageTitle } from '../config/brand';
import { collection, groupOf, imageById, imageHref, imagesIn, type StudyImage } from '../content/study';
import { Panel } from '../ui/panel';
import { revealIn } from '../ui/reveal';
import { h, type EnterInfo, type Page, type Route } from './types';

const SIZES_HALF = '(max-width: 640px) calc(100vw - 16px), calc(50vw - 12px)';
const figure = (image: StudyImage, eager: boolean) => {
  const img = h('img', {
    src: image.large, srcset: `${image.medium} 640w, ${image.large} 1086w`, sizes: SIZES_HALF,
    alt: image.alt, width: '1086', height: '1448', loading: eager ? 'eager' : 'lazy', decoding: 'async',
  }) as HTMLImageElement;
  return { img, el: h('figure', { class: 'block' }, img, h('figcaption', { class: 'block__cap' }, image.caption)) };
};

export function piecePage(route: Route): Page | null {
  const image = imageById(route.slug ?? '');
  if (!image) return null;
  const group = groupOf(image);
  const others = imagesIn(image.group).filter((i) => i.id !== image.id);
  const head = h('header', { class: 'head' },
    h('h1', { class: 'head__name', tabindex: '-1', 'data-reveal': 'words' }, image.caption),
    h('p', { class: 'head__sub', 'data-reveal': 'words' }, `${group.name} · ${collection.title}`),
  );
  const hero = figure(image, true);
  const rest = others.map((o) => figure(o, false));
  const scroll = h('div', { class: 'page__scroll' }, head,
    h('div', { class: 'blocks blocks--hero' }, hero.el),
    h('section', { class: 'blocks', 'aria-label': `Also in ${group.name}` }, ...rest.map((r) => r.el)),
    h('footer', { class: 'foot' }, collection.credit),
  );
  const el = h('main', { class: 'page page--piece', id: 'main' }, scroll);

  const list = (title: string, ...items: (Node | string)[]) =>
    h('div', { class: 'panel__list' }, h('h3', { class: 'panel__list-title', 'data-reveal': 'words' }, title), ...items);
  const item = (text: Node | string, reveal = 'words') => h('p', { class: 'panel__item', 'data-reveal': reveal }, text);
  const body = h('div', {},
    h('h2', { class: 'panel__name', 'data-reveal': 'words' }, image.caption),
    h('p', { class: 'panel__type', 'data-reveal': 'words' }, group.name),
    h('p', { class: 'panel__desc', 'data-reveal': 'lines' }, image.alt),
    list('Collection', item(collection.title), item(collection.credit), item(collection.disclosure)),
    list(`Also in ${group.name}`, ...others.map((o) => item(h('a', { href: imageHref(o), class: 'panel__link' }, o.caption), 'block'))),
  );
  const panel = new Panel({ id: 'details', label: 'Photograph details', closedLabel: 'Details', body });
  const chrome = h('div', { class: 'chrome' }, panel.el);
  const ready = Promise.race([hero.img.decode().catch(() => undefined), new Promise((r) => setTimeout(r, 800))]).then(() => undefined);

  return {
    route,
    title: pageTitle(`${image.caption} — ${collection.title}`),
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
        h('h1', { class: 'head__name', tabindex: '-1' }, 'This page isn’t part of the archive.'),
        h('p', { class: 'head__sub' }, h('a', { href: '/' }, 'Back to the Archive')),
      ),
    ),
  );
  return { route, title: pageTitle('Not found'), el, chrome: null, ready: Promise.resolve(), enter() {}, leave() {}, destroy() {}, focusTarget: () => el.querySelector('h1') };
}
