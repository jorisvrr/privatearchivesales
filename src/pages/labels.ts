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
  const scroll = h('div', { class: 'page__scroll' },
    h('header', { class: 'lede' },
      h('h1', { class: 'lede__title', tabindex: '-1', 'data-reveal': 'lines' }, 'Open your archive on your own site.'),
      h('p', { class: 'lede__copy', 'data-reveal': 'lines' }, `${name} builds the archive page on your website. You share one waitlist link, your verified customers shop first, and the rest of your waitlist follows.`),
      h('p', { class: 'lede__price', 'data-reveal': 'lines' }, `A small upfront fee covers setup. ${name} then earns a percentage of sales made through the archive event.`),
      cta,
    ),
    h('section', { class: 'steps', 'aria-label': 'How an archive sale works' },
      chapter('I', 'Step one', 'Select the archive', 'You choose the pieces, prices and sale window.'),
      chapter('II', 'Step two', 'Share one link', `${name} builds the archive page on your website. You post one waitlist link, and anyone can sign up for the drop.`),
      chapter('III', 'Step three', 'Open in two rounds', `Customers who verify a previous order shop first. The rest of your waitlist follows. When the drop ends, ${name} removes the page and reviews event sales with you. The percentage applies only to sales attributable to that event.`),
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
