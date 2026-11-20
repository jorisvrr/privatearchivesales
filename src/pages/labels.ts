// For labels: the offer on the first screen, then three steps, with an email-only enquiry.
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
      h('p', { class: 'lede__copy', 'data-reveal': 'lines' }, 'Give past collections and samples a dedicated sale on the website your customers already know. You choose the pieces and approve the prices. Orvel builds the page, coordinates the invitations, and removes the page when the drop ends.'),
      h('p', { class: 'lede__price', 'data-reveal': 'lines' }, 'A small upfront fee covers setup. Orvel then earns a percentage of sales made through the archive event.'),
      cta,
    ),
    h('section', { class: 'steps', 'aria-label': 'How an archive sale works' },
      chapter('I', 'Step one', 'Select the archive', 'The label chooses the pieces, prices and sale window.'),
      chapter('II', 'Step two', 'Open the page', 'Orvel builds a dedicated page on the label’s existing website. The label invites past customers first. Orvel’s mailing list receives the second invitation.'),
      chapter('III', 'Step three', 'Close the sale', 'Once the drop ends, Orvel removes the dedicated page and reviews event sales with the label. The percentage applies only to sales attributable to that event.'),
    ),
    h('footer', { class: 'foot' }, 'Orvel — Private archive sales'),
  );
  const el = h('main', { class: 'page page--labels', id: 'main' }, scroll);

  const form = h('form', { class: 'fp-form', method: 'post', action: '/api/enquiry', novalidate: '' },
    h('p', { class: 'fp-alert', 'data-alert': '', hidden: '' }),
    h('div', { class: 'fp-field' },
      h('label', { for: 'enq-email', class: 'fp-label' }, 'Work email'),
      h('div', { class: 'fp-inline' },
        h('input', { id: 'enq-email', name: 'email', type: 'email', required: '', autocomplete: 'email', inputmode: 'email', spellcheck: 'false', class: 'fp-input' }),
        h('button', { type: 'submit', class: 'fp-button' }, 'Contact Orvel'),
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
    title: 'For labels — Orvel',
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
