// About: what Orvel is, and the mailing list (the second invitation to each archive).
import { SUBSCRIBE, wireForm } from '../forms';
import { FormPanel } from '../ui/form-panel';
import { revealIn } from '../ui/reveal';
import { h, type EnterInfo, type Page, type Route } from './types';

export function aboutPage(route: Route): Page {
  const cta = h('button', { type: 'button', class: 'cta', 'aria-controls': 'signup', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'data-reveal': 'block' }, 'Join the mailing list') as HTMLButtonElement;
  const scroll = h('div', { class: 'page__scroll' },
    h('header', { class: 'lede' },
      h('h1', { class: 'lede__title', tabindex: '-1', 'data-reveal': 'lines' }, 'Private archive sales for independent labels.'),
      h('p', { class: 'lede__copy', 'data-reveal': 'lines' }, 'Orvel works with independent labels to bring past collections and samples back for a limited sale. Each archive opens on the label’s own website. The label invites its past customers first, then Orvel sends the second invitation to its mailing list.'),
      cta,
    ),
    h('footer', { class: 'foot' }, 'Orvel — Private archive sales'),
  );
  const el = h('main', { class: 'page page--about', id: 'main' }, scroll);

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
    form,
    h('p', { class: 'fp-foot' }, 'Orvel uses your address only for archive invitations. Every email has an unsubscribe link.'),
  );
  const panel = new FormPanel({ id: 'signup', title: 'Join the mailing list', triggerLabel: 'Mailing list', body, showTrigger: false });
  const chrome = h('div', { class: 'chrome' }, panel.el);
  cta.addEventListener('click', () => panel.open({ opener: cta }));

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
    title: 'About — Orvel',
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
