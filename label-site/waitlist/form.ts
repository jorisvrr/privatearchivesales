// LABEL-SITE KIT — builds and wires the waitlist form inside a container on the label's own website.
// Not imported by Mino's public site. Styling: the .fp-* classes from src/styles.css.
import { h } from '../../src/pages/types';
import { wireWaitlist } from './client';
import type { DropInfo } from './drops';

export function mountWaitlist(container: HTMLElement, drop: DropInfo) {
  const label = drop.label;
  const form = h('form', { class: 'fp-form', method: 'post', action: '/api/waitlist', novalidate: '' },
    h('input', { type: 'hidden', name: 'drop', value: drop.id }),
    h('div', { class: 'fp-field' },
      h('label', { for: 'wl-email', class: 'fp-label' }, 'Email address'),
      h('input', { id: 'wl-email', name: 'email', type: 'email', required: '', autocomplete: 'email', inputmode: 'email', spellcheck: 'false', class: 'fp-input' }),
    ),
    h('details', { class: 'fp-disclosure' },
      h('summary', { class: 'fp-disclosure__summary' }, `Bought from ${label} before? Get first access.`),
      h('div', { class: 'fp-field' },
        h('label', { for: 'wl-order', class: 'fp-label' }, 'Order number'),
        h('input', { id: 'wl-order', name: 'order', type: 'text', autocomplete: 'off', spellcheck: 'false', maxlength: '40', class: 'fp-input', 'aria-describedby': 'wl-order-help' }),
        h('p', { id: 'wl-order-help', class: 'fp-help' }, 'Use the email address from your original order.'),
      ),
    ),
    h('input', { type: 'text', name: 'company', class: 'hp', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true' }),
    h('p', { class: 'fp-alert', 'data-alert': '', hidden: '' }),
    h('div', { class: 'fp-actions' }, h('button', { type: 'submit', class: 'fp-button' }, 'Join the waitlist')),
  ) as HTMLFormElement;
  const heading = h('h2', { class: 'fp-title' }, `Join the ${label} archive waitlist`);
  container.append(heading, form);
  wireWaitlist(form, {
    dropId: drop.id,
    onDone: (message, extra) => {
      const done = h('div', { class: 'fp-success', role: 'status', tabindex: '-1' },
        h('p', { class: 'fp-success__text' }, message),
        extra ? h('p', { class: 'fp-success__text' }, extra) : '',
      );
      form.replaceWith(done);
      done.focus({ preventScroll: true });
    },
  });
  return form;
}
