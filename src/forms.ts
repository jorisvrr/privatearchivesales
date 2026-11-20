// Progressive enhancement for the native forms. Without JavaScript they post directly to /api.
// Success is shown only after the server confirms that the provider accepted the request (2xx).
import { name } from './config/brand';

export interface PostResult { ok: boolean; status: number; body: Record<string, unknown> }

export async function post(url: string, data: Record<string, string>): Promise<PostResult> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(data),
    });
    let body: Record<string, unknown> = {};
    try { body = await res.json(); } catch { /* not JSON */ }
    return { ok: res.ok, status: res.status, body };
  } catch {
    return { ok: false, status: 0, body: { error: 'network' } };
  }
}

export const EMAIL_INVALID = 'Enter a valid email address, like name@example.com.';

export interface FieldCopy { missing: string; invalid?: string }

/** Archive-sale enquiries from founders: one work email, routed separately from the waitlist. */
export const ENQUIRY = {
  busy: 'Sending…',
  fields: { email: { missing: 'Enter your work email.', invalid: EMAIL_INVALID } } as Record<string, FieldCopy>,
  alerts: {
    not_configured: 'Enquiries can’t be sent from this page yet. Nothing was sent. Please try again soon.',
    failed: 'Your enquiry wasn’t sent. Please try again in a moment.',
  } as Record<string, string>,
  success: `Thanks. ${name} will follow up personally about stock, timing and terms.`,
};

/** Per-drop waitlist. Round 1: verified past customers. Round 2: everyone else who signed up. */
export const WAITLIST = {
  busy: 'Joining…',
  verified: 'Your order is verified. We’ll email you when first access opens.',
  public: 'You’re on the waitlist. We’ll email you when the second round opens.',
  confirm: `Confirm your email address from the message ${name} just sent.`,
  emailOnly: 'Join the second round with email only',
  alerts: {
    duplicate: 'This email is already on the waitlist. We’ll email you when the second round opens.',
    no_match: 'We couldn’t match that order number to this email address. Check both, or join the second round with your email alone.',
    unavailable: 'Order verification isn’t available right now. You can join the second round with your email alone.',
    preview: 'This is a preview. Sign-ups open when the drop is confirmed.',
    not_configured: 'The waitlist isn’t open yet. Your email wasn’t saved. Please try again soon.',
    unknown_drop: 'This waitlist link isn’t active.',
    failed: 'You weren’t added to the waitlist. Please try again in a moment.',
  } as Record<string, string>,
};

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function describedBy(el: Element, id: string, add: boolean) {
  const ids = new Set((el.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean));
  if (add) ids.add(id);
  else ids.delete(id);
  if (ids.size) el.setAttribute('aria-describedby', [...ids].join(' '));
  else el.removeAttribute('aria-describedby');
}

/** Field errors under each field (aria-describedby), and one alert slot for server errors. */
export function formUI(form: HTMLFormElement, onChange?: () => void) {
  const alert = form.querySelector<HTMLElement>('[data-alert]')!;
  const button = form.querySelector<HTMLButtonElement>('button[type=submit]')!;
  const control = (name: string) => form.elements.namedItem(name) as Control | null;
  const setError = (el: Control, msg: string) => {
    const id = `${el.id}-error`;
    let err = form.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
    if (!err) {
      err = document.createElement('p');
      err.id = id;
      err.className = 'fp-error';
      (el.closest('.fp-inline') ?? el.closest('.fp-field') ?? el.parentElement)!.append(err);
    }
    err.textContent = msg;
    el.setAttribute('aria-invalid', 'true');
    describedBy(el, id, true);
  };
  const clearError = (el: Control) => {
    form.querySelector(`#${CSS.escape(`${el.id}-error`)}`)?.remove();
    el.removeAttribute('aria-invalid');
    describedBy(el, `${el.id}-error`, false);
  };
  /** Show a server message above the button, optionally with a secondary action. */
  const say = (msg: string | null, kind: 'error' | 'info' = 'error', action?: { label: string; run: () => void }) => {
    alert.hidden = !msg;
    alert.replaceChildren();
    if (msg) {
      alert.append(document.createTextNode(msg));
      if (action) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'fp-text-button';
        b.textContent = action.label;
        b.addEventListener('click', action.run);
        alert.append(b);
      }
    }
    alert.dataset.kind = kind;
    alert.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  };
  const busy = (on: boolean, label: string) => {
    if (on) button.dataset.label = button.textContent ?? '';
    button.disabled = on;
    button.textContent = on ? label : button.dataset.label ?? '';
    if (on) form.setAttribute('aria-busy', 'true');
    else form.removeAttribute('aria-busy');
  };
  /** Validates the listed fields natively; shows errors, focuses the first invalid one. */
  const validate = (fields: Record<string, FieldCopy>) => {
    const invalid: Control[] = [];
    for (const [name, copy] of Object.entries(fields)) {
      const el = control(name);
      if (!el) continue;
      clearError(el);
      if (!el.checkValidity()) {
        setError(el, el.validity.valueMissing ? copy.missing : copy.invalid ?? copy.missing);
        invalid.push(el);
      }
    }
    if (invalid.length) { onChange?.(); invalid[0].focus(); }
    return invalid.length === 0;
  };
  form.addEventListener('input', (e) => {
    const el = e.target as Control;
    if (el.getAttribute('aria-invalid')) { clearError(el); onChange?.(); }
  });
  return { alert, button, control, setError, clearError, say, busy, validate };
}

interface WireOptions {
  endpoint: string;
  busy: string;
  fields: Record<string, FieldCopy>;
  alerts: Record<string, string>;
  onSuccess(r: PostResult): void;
  onChange?(): void;
}

/** Simple one-shot form (the founder enquiry). */
export function wireForm(form: HTMLFormElement, o: WireOptions) {
  const ui = formUI(form, o.onChange);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (ui.button.disabled) return;
    ui.say(null);
    if (!ui.validate(o.fields)) return;
    const data: Record<string, string> = {};
    new FormData(form).forEach((v, k) => { data[k] = String(v); });
    ui.busy(true, o.busy);
    const r = await post(o.endpoint, data);
    ui.busy(false, o.busy);
    if (r.ok) return o.onSuccess(r);
    if (r.status === 422) {
      const names = (r.body.fields as string[] | undefined) ?? Object.keys(o.fields);
      const bad = names.map(ui.control).filter((x): x is Control => !!x);
      bad.forEach((el) => ui.setError(el, o.fields[el.name]?.invalid ?? o.fields[el.name]?.missing ?? 'Check this field.'));
      bad[0]?.focus();
      return;
    }
    const key = r.status === 503 && r.body.error === 'not_configured' ? 'not_configured' : 'failed';
    ui.say(o.alerts[key] ?? o.alerts.failed);
    o.onChange?.();
  });
}
