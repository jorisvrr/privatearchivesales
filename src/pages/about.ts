// About: what Mino is, and the way into the current drop's waitlist.
import { name, pageTitle, siteTitle } from '../config/brand';
import { isDemo, waitlistHref } from '../content/sale';
import { revealIn } from '../ui/reveal';
import { h, type EnterInfo, type Page, type Route } from './types';

export function aboutPage(route: Route): Page {
  const href = waitlistHref();
  // Confirmed drop: the label's own waitlist link. Demo: Mino's preview of the drop page. Neither: a note.
  const action = href
    ? h('a', { class: 'cta', href, 'data-reveal': 'block' }, isDemo() ? 'Preview the waitlist' : 'Join the waitlist')
    : h('p', { class: 'lede__price', 'data-reveal': 'lines' }, 'The next waitlist link will be shared here.');
  const scroll = h('div', { class: 'page__scroll' },
    h('header', { class: 'lede' },
      h('h1', { class: 'lede__title', tabindex: '-1', 'data-reveal': 'lines' }, 'Private archive sales for independent labels.'),
      h('p', { class: 'lede__copy', 'data-reveal': 'lines' }, `${name} helps independent labels open their archives for a limited time. Each label shares a waitlist link for its sale. Bought from the label before? Verify a previous order for first access. Everyone else on the waitlist receives the second invitation.`),
      action,
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
