// Invitations: the two-wave process, with the signup form open in the glass panel on arrival.
import { EVENT_CREDIT, eventTitle, isDemo, sale } from '../content/sale';
import { SUBSCRIBE, wireForm } from '../forms';
import { FormPanel } from '../ui/form-panel';
import { revealIn } from '../ui/reveal';
import { h, type EnterInfo, type Page, type Route } from './types';

export function invitationsPage(route: Route): Page {
  const when = [sale.city, sale.date].filter(Boolean).join(', ');
  const scroll = h('div', { class: 'page__scroll' },
    h('header', { class: 'head' },
      h('h1', { class: 'head__name', tabindex: '-1', 'data-reveal': 'words' }, eventTitle()),
      h('p', { class: 'head__sub', 'data-reveal': 'words' }, EVENT_CREDIT),
      isDemo() ? h('p', { class: 'head__demo', 'data-reveal': 'block' }, 'Demo: no sale has been confirmed yet.') : '',
    ),
    h('section', { class: 'waves', 'aria-label': 'How invitations work' },
      chapter('I', 'First invitation', 'From the label', 'The featured label invites its past customers first, through its own mailing list.'),
      chapter('II', 'Second invitation', 'From Orvel', 'Orvel then invites everyone on its list. Joining the list adds you to this second invitation.'),
      h('p', { class: 'waves__note', 'data-reveal': 'lines' }, 'An invitation is not a place at the sale. Places are confirmed separately, when booking opens.'),
      h('p', { class: 'waves__meta', 'data-reveal': 'words' }, when ? when : 'Date and city to be announced.'),
    ),
    h('footer', { class: 'foot' }, 'Orvel — Private archive sales'),
  );
  const el = h('main', { class: 'page page--invitations', id: 'main' }, scroll);

  const form = h('form', { class: 'fp-form', method: 'post', action: '/api/subscribe', novalidate: '' },
    h('p', { class: 'fp-alert', 'data-alert': '', hidden: '' }),
    h('div', { class: 'fp-field' },
      h('label', { for: 'signup-email', class: 'fp-label' }, 'Email address'),
      h('div', { class: 'fp-inline' },
        h('input', { id: 'signup-email', name: 'email', type: 'email', required: '', autocomplete: 'email', inputmode: 'email', spellcheck: 'false', class: 'fp-input' }),
        h('button', { type: 'submit', class: 'fp-button' }, 'Join the list'),
      ),
    ),
    h('input', { type: 'text', name: 'company', class: 'hp', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true' }),
  );
  const body = h('div', {},
    h('p', { class: 'fp-copy' }, 'The featured label invites past customers first. Join Orvel’s list for the second invitation.'),
    form,
    h('p', { class: 'fp-foot' }, 'Orvel uses your address only for sale invitations. Every email has an unsubscribe link.'),
  );
  const panel = new FormPanel({ id: 'signup', title: 'Join the invitation list', triggerLabel: 'Invitation list', body });
  const chrome = h('div', { class: 'chrome' }, panel.el);

  wireForm(form, {
    endpoint: '/api/subscribe',
    busy: SUBSCRIBE.busy,
    fields: SUBSCRIBE.fields,
    alerts: SUBSCRIBE.alerts,
    onSuccess: (r) => {
      const copy = r.confirm ? SUBSCRIBE.confirm : SUBSCRIBE.success;
      const done = h('div', { class: 'fp-success', role: 'status', tabindex: '-1' },
        h('p', { class: 'fp-success__title' }, copy.title),
        h('p', { class: 'fp-success__text' }, copy.text),
      );
      form.replaceWith(done);
      done.focus({ preventScroll: true });
    },
  });

  return {
    route,
    title: 'Join the invitation list — Orvel',
    el,
    chrome,
    ready: Promise.resolve(),
    enter(info: EnterInfo) {
      panel.mount();
      // Open on arrival, so people coming from Instagram or an email reach the form immediately.
      panel.open({ delay: info.instant ? 0 : info.duration * 0.75 });
      revealIn(scroll, info.instant ? 0.1 : 0.45);
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
