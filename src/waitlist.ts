// The drop waitlist form: email (required) plus an optional order number for first access.
// The server checks the order number and checkout email together against the label's order records.
// A verified state is shown only when the server says round 1; failures offer the email-only second round.
import { EMAIL_INVALID, formUI, post, WAITLIST } from './forms';

export function wireWaitlist(form: HTMLFormElement, opts: { dropId: string; onDone(message: string, extra: string | null): void; onChange?(): void }) {
  const ui = formUI(form, opts.onChange);
  const details = form.querySelector<HTMLDetailsElement>('details')!;
  const order = form.elements.namedItem('order') as HTMLInputElement;

  const submit = async (withOrder: boolean) => {
    if (ui.button.disabled) return;
    ui.say(null);
    if (!ui.validate({ email: { missing: 'Enter your email address.', invalid: EMAIL_INVALID } })) return;
    const email = (form.elements.namedItem('email') as HTMLInputElement).value;
    const orderNumber = withOrder && details.open ? order.value.trim() : '';
    const company = (form.elements.namedItem('company') as HTMLInputElement | null)?.value ?? '';
    ui.busy(true, WAITLIST.busy);
    const r = await post('/api/waitlist', { drop: opts.dropId, email, order: orderNumber, company });
    ui.busy(false, WAITLIST.busy);
    const confirm = r.body.confirm === true ? WAITLIST.confirm : null;
    if (r.ok) {
      // Only a round-1 answer from the server may show the verified confirmation.
      return opts.onDone(r.body.round === 1 ? WAITLIST.verified : WAITLIST.public, confirm);
    }
    const error = String(r.body.error ?? 'failed');
    const emailOnly = { label: WAITLIST.emailOnly, run: () => void submit(false) };
    if (error === 'invalid') {
      ui.setError(form.elements.namedItem('email') as HTMLInputElement, EMAIL_INVALID);
      (form.elements.namedItem('email') as HTMLInputElement).focus();
    } else if (error === 'no_match') {
      ui.setError(order, 'Check the order number and the email address you used for that order.');
      ui.say(WAITLIST.alerts.no_match, 'error', emailOnly);
      order.focus();
    } else if (error === 'unavailable') {
      ui.say(WAITLIST.alerts.unavailable, 'error', emailOnly);
    } else {
      ui.say(WAITLIST.alerts[error] ?? WAITLIST.alerts.failed, error === 'duplicate' || error === 'preview' ? 'info' : 'error');
    }
    opts.onChange?.();
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    void submit(true);
  });
  details.addEventListener('toggle', () => {
    if (details.open) order.focus({ preventScroll: true });
    opts.onChange?.();
  });
}
