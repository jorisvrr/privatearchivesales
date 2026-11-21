// For labels: the offer, what's included, and an illustrative preview, before the /plan enquiry.
import { name, pageTitle, siteTitle } from '../config/brand';
import { collection, imageById } from '../content/study';
import { revealIn } from '../ui/reveal';
import { h, type EnterInfo, type Page, type Route } from './types';

const INCLUDED = [
  'Temporary archive page on your existing website',
  'Brand-specific waitlist and two access rounds',
  'Launch coordination',
  'Announcement and invitation copy',
  'Launch schedule',
  'Sales reporting and page removal after the drop',
];

/** A small mock of an archive page, built from the study imagery and labelled as an illustration. */
function preview() {
  const pics = ['bomber-on-plaster', 'jeans-laid-flat', 'side-profile'].map((id) => imageById(id)!);
  return h('figure', { class: 'preview', 'data-reveal': 'block' },
    h('div', { class: 'preview__frame', 'aria-hidden': 'true' },
      h('div', { class: 'preview__bar' }, h('span', {}, 'yourlabel.com/archive'), h('span', { class: 'preview__tag' }, 'Illustration')),
      h('p', { class: 'preview__title' }, 'The archive'),
      h('p', { class: 'preview__rounds' }, h('span', {}, 'First access · Past customers'), h('span', {}, 'Then · Waitlist')),
      h('div', { class: 'preview__grid' }, ...pics.map((p) => h('div', {},
        h('img', { src: p.medium, alt: '', width: '640', height: '853', loading: 'lazy', decoding: 'async' }),
        h('span', {}, p.caption))))),
    h('figcaption', { class: 'preview__cap' }, `Illustrative preview of a label’s archive page, using ${collection.title} imagery (an AI-generated study). Not client work.`),
  );
}

export function labelsPage(route: Route): Page {
  const scroll = h('div', { class: 'page__scroll' },
    h('header', { class: 'lede' },
      h('h1', { class: 'lede__title', tabindex: '-1', 'data-reveal': 'lines' }, 'Give your archive its next release.'),
      h('p', { class: 'lede__copy', 'data-reveal': 'lines' }, 'A limited sale on your own website, with first access for your past customers.'),
      h('p', { class: 'lede__access', 'data-reveal': 'lines' }, `${name} builds the page and coordinates the launch. You choose the pieces, approve the prices, and fulfil the orders.`),
      h('p', { class: 'lede__price', 'data-reveal': 'lines' }, 'A small setup fee, plus an agreed percentage of archive-sale revenue.'),
      h('a', { class: 'cta', href: '/plan', 'data-reveal': 'block' }, 'Plan an archive sale'),
      h('p', { class: 'cta-note', 'data-reveal': 'lines' }, 'Two quick questions and your email. No commitment.'),
    ),
    h('section', { class: 'offer', 'aria-label': 'What’s included' },
      h('div', { class: 'offer__col' },
        h('h2', { class: 'offer__title', 'data-reveal': 'words' }, 'Included'),
        h('ol', { class: 'offer__list' }, ...INCLUDED.map((text, i) =>
          h('li', { 'data-reveal': 'block' }, h('span', { class: 'offer__num', 'aria-hidden': 'true' }, String(i + 1).padStart(2, '0')), h('span', {}, text))))),
      h('div', { class: 'offer__col' }, preview()),
    ),
    h('footer', { class: 'foot' }, siteTitle),
  );
  const el = h('main', { class: 'page page--labels', id: 'main' }, scroll);

  return {
    route,
    title: pageTitle('For labels'),
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
