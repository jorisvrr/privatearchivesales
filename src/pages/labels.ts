// For labels: the offer on the first screen, then three steps, with an email-only enquiry.
import { name, pageTitle, siteTitle } from '../config/brand';
import { ENQUIRY, wireForm } from '../forms';
import { FormPanel } from '../ui/form-panel';
import { revealIn } from '../ui/reveal';
import { h, type EnterInfo, type Page, type Route } from './types';

export function chapter(num: string, left: string, right: string, text: string) {
  return h('div', { class: 'chapter' },
    h('div', { class: 'chapter__row' },
      h('span', { class: 'chapter__side chapter__side--l', 'data-reveal': 'words' }, left),
      h('span', { class: 'chapter__num', 'aria-hidden': 'true', 'data-reveal': 'words' }, num),
      h('h2', { class: 'chapter__side chapter__side--r', 'data-reveal': 'words' }, right),
    ),
    h('p', { class: 'chapter__text', 'data-reveal': 'lines' }, text),
  );
}

export function labelsPage(route: Route): Page {
  const cta = h('button', { type: 'button', class: 'cta', 'aria-controls': 'enquiry', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'data-reveal': 'block' }, 'Plan an archive sale') as HTMLButtonElement;
  const list = (title: string, items: string[], numbered: boolean) =>
    h('div', { class: 'offer__col' },
      h('h2', { class: 'offer__title', 'data-reveal': 'words' }, title),
      h('ol', { class: 'offer__list' }, ...items.map((text, i) =>
        h('li', { 'data-reveal': 'block' }, h('span', { class: 'offer__num', 'aria-hidden': 'true' }, numbered ? String(i + 1).padStart(2, '0') : '+'), h('span', {}, text)))),
    );
  const scroll = h('div', { class: 'page__scroll' },
    h('header', { class: 'lede' },
      h('h1', { class: 'lede__title', tabindex: '-1', 'data-reveal': 'lines' }, 'Your archive. A new source of revenue.'),
      h('p', { class: 'lede__copy', 'data-reveal': 'lines' }, `Turn past collections and samples into a limited sale on your own website. ${name} builds the experience and manages the launch. You choose the pieces, approve the prices, and fulfil the orders.`),
      h('p', { class: 'lede__access', 'data-reveal': 'lines' }, 'Your past customers shop first. Your wider audience follows.'),
      h('p', { class: 'lede__price', 'data-reveal': 'lines' }, `A small upfront fee covers setup. ${name} then earns an agreed percentage of sales generated through the archive sale.`),
      cta,
    ),
    h('section', { class: 'offer', 'aria-label': 'What’s included' },
      list('Included', [
        'A temporary archive page designed for your label',
        'A brand-specific waitlist and two access rounds',
        'Launch coordination',
        'Reporting on sales attributed to the drop',
        'Page removal after the sale',
      ], true),
      list('Also included', [
        'Ready-to-use announcement and invitation copy',
        'A simple launch schedule',
        'A post-sale review with recommendations for the next drop',
      ], false),
    ),
    h('section', { class: 'steps', 'aria-label': 'How an archive sale works' },
      chapter('I', 'Step one', 'Select the archive', 'You choose the pieces and approve the prices. Together we agree the drop’s opening and closing dates.'),
      chapter('II', 'Step two', 'Open in two rounds', `${name} builds the temporary page on your website. You share your drop’s waitlist link. Past customers verify a previous order and shop first; your wider audience follows.`),
      chapter('III', 'Step three', 'Close and review', `You fulfil the orders. When the drop closes, ${name} removes the page, reports the sales attributed to it, and reviews the results with you.`),
    ),
    h('section', { class: 'pricing', 'aria-label': 'Pricing' },
      h('h2', { class: 'offer__title', 'data-reveal': 'words' }, 'Pricing'),
      h('p', { class: 'pricing__text', 'data-reveal': 'lines' }, `A small upfront fee covers setup. ${name} then earns an agreed percentage of sales generated through the archive sale. The percentage applies only to sales attributed to the drop.`),
    ),
    h('footer', { class: 'foot' }, siteTitle),
  );
  const el = h('main', { class: 'page page--labels', id: 'main' }, scroll);

  const form = h('form', { class: 'fp-form', method: 'post', action: '/api/enquiry', novalidate: '' },
    h('p', { class: 'fp-alert', 'data-alert': '', hidden: '' }),
    h('div', { class: 'fp-field' },
      h('label', { for: 'enq-email', class: 'fp-label' }, 'Work email'),
      h('div', { class: 'fp-inline' },
        h('input', { id: 'enq-email', name: 'email', type: 'email', required: '', autocomplete: 'email', inputmode: 'email', spellcheck: 'false', class: 'fp-input' }),
        h('button', { type: 'submit', class: 'fp-button' }, `Contact ${name}`),
      ),
    ),
    h('input', { type: 'text', name: 'website', class: 'hp', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true' }),
  );
  const panel = new FormPanel({ id: 'enquiry', title: 'Plan an archive sale', triggerLabel: 'Plan an archive sale', body: h('div', {}, form), showTrigger: false });
  const chrome = h('div', { class: 'chrome' }, panel.el);
  cta.addEventListener('click', () => panel.open({ opener: cta }));

  wireForm(form, {
    endpoint: '/api/enquiry',
    busy: ENQUIRY.busy,
    fields: ENQUIRY.fields,
    alerts: ENQUIRY.alerts,
    onSuccess: () => {
      const done = h('div', { class: 'fp-success', role: 'status', tabindex: '-1' }, h('p', { class: 'fp-success__text' }, ENQUIRY.success));
      form.replaceWith(done);
      done.focus({ preventScroll: true });
    },
  });

  return {
    route,
    title: pageTitle('For labels'),
    el,
    chrome,
    ready: Promise.resolve(),
    enter(info: EnterInfo) {
      panel.mount();
      revealIn(scroll, info.instant ? 0.1 : 0.45);
    },
    leave() {
      panel.close({ restore: false });
    },
    destroy() {
      panel.unmount();
    },
    focusTarget: () => el.querySelector('h1'),
  };
}
