// About: what Mino is. Mino's site takes no shopper signups; each label announces its own drop.
import { name, pageTitle, siteTitle } from '../config/brand';
import { revealIn } from '../ui/reveal';
import { h, type EnterInfo, type Page, type Route } from './types';

export function aboutPage(route: Route): Page {
  const scroll = h('div', { class: 'page__scroll' },
    h('header', { class: 'lede lede--text' },
      h('h1', { class: 'lede__title', tabindex: '-1', 'data-reveal': 'lines' }, 'Private archive sales for independent labels.'),
      h('p', { class: 'lede__copy', 'data-reveal': 'lines' }, `${name} works with independent labels to bring past collections and samples back for a limited sale on the label’s own website. When a drop is announced, the label shares its waitlist link. Past customers can verify a previous order for first access. Everyone else who signs up is invited in the second round.`),
    ),
    h('footer', { class: 'foot' }, siteTitle),
  );
  const el = h('main', { class: 'page page--about', id: 'main' }, scroll);

  return {
    route,
    title: pageTitle('About'),
    el,
    chrome: null,
    ready: Promise.resolve(),
    enter(info: EnterInfo) {
      revealIn(scroll, info.instant ? 0.1 : 0.45);
    },
    leave() {},
    destroy() {},
    focusTarget: () => el.querySelector('h1'),
  };
}
