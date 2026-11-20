// For labels: onboarding for founders, with the stock enquiry in the glass panel.
import { ENQUIRY, wireForm } from '../forms';
import { FormPanel } from '../ui/form-panel';
import { revealIn } from '../ui/reveal';
import { chapter } from './invitations';
import { h, type EnterInfo, type Page, type Route } from './types';

const QUANTITIES = ['Fewer than 50 pieces', '50 to 150 pieces', '150 to 400 pieces', 'More than 400 pieces'];

export function labelsPage(route: Route): Page {
  const cta = (cls: string) => h('button', { type: 'button', class: `cta ${cls}`, 'aria-controls': 'enquiry', 'aria-haspopup': 'dialog', 'data-reveal': 'block' }, h('span', { class: 'cta__pill' }, 'Tell us about your stock'));
  const scroll = h('div', { class: 'page__scroll' },
    h('header', { class: 'lede' },
      h('h1', { class: 'lede__title', tabindex: '-1', 'data-reveal': 'lines' }, 'Host a private archive sale.'),
      h('p', { class: 'lede__copy', 'data-reveal': 'lines' }, 'You choose the pieces and approve the prices. Orvel organizes the invitations, bookings, and event.'),
      cta('cta--lede'),
    ),
    h('section', { class: 'steps', 'aria-label': 'What happens after you get in touch' },
      chapter('I', 'Step one', 'Stock review', 'We discuss the pieces, quantities, sizes, and city with you.'),
      chapter('II', 'Step two', 'Sale proposal', 'We agree on the venue, costs, responsibilities, and what the sale needs to earn to make sense for your label.'),
      chapter('III', 'Step three', 'Final approval', 'You review the inventory, prices, preview, and invitation schedule before anything goes out.'),
      h('p', { class: 'waves__note', 'data-reveal': 'lines' }, 'No item-by-item inventory sheet yet. That comes after the first conversation.'),
      cta('cta--end'),
    ),
    h('footer', { class: 'foot' }, 'Orvel — Private archive sales'),
  );
  const el = h('main', { class: 'page page--labels', id: 'main' }, scroll);

  const field = (id: string, label: (Node | string)[], input: HTMLElement) =>
    h('div', { class: 'fp-field' }, h('label', { for: id, class: 'fp-label' }, ...label), input);
  const select = h('select', { id: 'enq-quantity', name: 'quantity', required: '', class: 'fp-input fp-select' },
    h('option', { value: '' }, 'Choose a range'),
    ...QUANTITIES.map((q) => h('option', { value: q }, q)),
  );
  const form = h('form', { class: 'fp-form', method: 'post', action: '/api/enquiry', novalidate: '' },
    field('enq-label', ['Label name'], h('input', { id: 'enq-label', name: 'label', type: 'text', required: '', autocomplete: 'organization', maxlength: '120', class: 'fp-input' })),
    field('enq-email', ['Contact email'], h('input', { id: 'enq-email', name: 'email', type: 'email', required: '', autocomplete: 'email', inputmode: 'email', spellcheck: 'false', class: 'fp-input' })),
    h('div', { class: 'fp-row' },
      field('enq-city', ['City'], h('input', { id: 'enq-city', name: 'city', type: 'text', required: '', autocomplete: 'address-level2', maxlength: '80', class: 'fp-input' })),
      field('enq-quantity', ['Approximate quantity'], select),
    ),
    field('enq-note', ['Note ', h('span', { class: 'fp-label__hint' }, '(optional)')], h('textarea', { id: 'enq-note', name: 'note', rows: '3', maxlength: '2000', class: 'fp-input fp-textarea' })),
    h('input', { type: 'text', name: 'website', class: 'hp', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true' }),
    h('p', { class: 'fp-alert', 'data-alert': '', hidden: '' }),
    h('div', { class: 'fp-actions' }, h('button', { type: 'submit', class: 'fp-button' }, 'Send enquiry')),
  );
  const body = h('div', {},
    h('p', { class: 'fp-copy' }, 'A rough outline is enough. We’ll email you to arrange a stock review.'),
    form,
  );
  const panel = new FormPanel({ id: 'enquiry', title: 'Tell us about your stock', triggerLabel: 'Tell us about your stock', body });
  const chrome = h('div', { class: 'chrome' }, panel.el);
  el.querySelectorAll<HTMLButtonElement>('.cta').forEach((b) => b.addEventListener('click', () => panel.open({ opener: b })));

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
    title: 'Host a private archive sale — Orvel',
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
