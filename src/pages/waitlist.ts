// Drop page: the waitlist for one archive sale. This is the page behind the label's shareable link.
import { pageTitle } from '../config/brand';
import { dropById, EVENT_CREDIT, eventTitle } from '../content/sale';
import { FormPanel } from '../ui/form-panel';
import { revealIn } from '../ui/reveal';
import { wireWaitlist } from '../waitlist';
import { h, type EnterInfo, type Page, type Route } from './types';

export function waitlistPage(route: Route): Page | null {
  const drop = dropById(route.slug ?? '');
  if (!drop || drop.status === 'none') return null;
  const label = drop.label;

  const head = h('header', { class: 'head' },
    h('h1', { class: 'head__name', tabindex: '-1', 'data-reveal': 'words' }, eventTitle()),
    h('p', { class: 'head__sub', 'data-reveal': 'words' }, EVENT_CREDIT),
    drop.status === 'demo' ? h('p', { class: 'head__demo', 'data-reveal': 'block' }, 'Preview: this drop is not confirmed yet.') : '',
  );
  const el = h('main', { class: 'page page--waitlist', id: 'main' }, h('div', { class: 'page__scroll' }, head));

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
  );
  const panel = new FormPanel({ id: 'waitlist', title: `Join the ${label} archive waitlist`, triggerLabel: 'Join the waitlist', body: h('div', {}, form) });
  const chrome = h('div', { class: 'chrome' }, panel.el);

  wireWaitlist(form as HTMLFormElement, {
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

  return {
    route,
    title: pageTitle(`Join the ${label} archive waitlist`),
    el,
    chrome,
    ready: Promise.resolve(),
    enter(info: EnterInfo) {
      panel.mount();
      // The shareable link should land on the form: open it on arrival.
      panel.open({ delay: info.instant ? 0 : info.duration * 0.75 });
      revealIn(head, info.instant ? 0.1 : 0.5);
    },
    leave() {
      panel.close({ restore: false });
    },
    destroy() {
      panel.unmount();
    },
    focusTarget: () => (panel.isOpen ? panel.initialFocusTarget() : el.querySelector('h1')),
  };
}
