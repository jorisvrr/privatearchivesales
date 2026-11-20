// Progressive enhancement for the two native forms. Without JavaScript they post directly to /api.
// Success is shown only after the server confirms that the provider accepted the request (2xx).

export type Outcome = 'ok' | 'duplicate' | 'invalid' | 'not_configured' | 'failed';
export interface PostResult { outcome: Outcome; fields?: string[]; confirm?: boolean }

export async function post(url: string, data: Record<string, string>): Promise<PostResult> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(data),
    });
    let body: { error?: string; fields?: string[]; confirm?: boolean } = {};
    try { body = await res.json(); } catch { /* not JSON */ }
    if (res.ok) return { outcome: 'ok', confirm: body.confirm === true };
    if (res.status === 409) return { outcome: 'duplicate' };
    if (res.status === 422) return { outcome: 'invalid', fields: body.fields };
    if (res.status === 503 && body.error === 'not_configured') return { outcome: 'not_configured' };
    return { outcome: 'failed' };
  } catch {
    return { outcome: 'failed' };
  }
}

const EMAIL_INVALID = 'Enter a valid email address, like name@example.com.';

export interface FieldCopy { missing: string; invalid?: string }

export const SUBSCRIBE = {
  busy: 'Joining…',
  fields: { email: { missing: 'Enter your email address.', invalid: EMAIL_INVALID } } as Record<string, FieldCopy>,
  alerts: {
    duplicate: 'This address is already on Orvel’s list. We’ll email you when the next archive opens.',
    not_configured: 'The mailing list isn’t open yet. Your address wasn’t saved. Please try again soon.',
    failed: 'Your address wasn’t added. Please try again in a moment.',
  },
  success: { title: 'You’re on the list.', text: 'We’ll email you when the next archive opens.' },
  /** When the provider sends a confirmation email first (double opt-in). */
  confirm: { title: 'Check your email', text: 'Confirm your address from the email Orvel just sent. After that, we’ll email you when the next archive opens.' },
};

/** Archive-sale enquiries from founders: one work email, routed separately from the mailing list. */
export const ENQUIRY = {
  busy: 'Sending…',
  fields: { email: { missing: 'Enter your work email.', invalid: EMAIL_INVALID } } as Record<string, FieldCopy>,
  alerts: {
    not_configured: 'Enquiries can’t be sent from this page yet. Nothing was sent. Please try again soon.',
    failed: 'Your enquiry wasn’t sent. Please try again in a moment.',
  } as Record<string, string>,
  success: 'Thanks. Orvel will follow up personally about stock, timing and terms.',
};

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

interface WireOptions {
  endpoint: string;
  busy: string;
  fields: Record<string, FieldCopy>;
  alerts: Record<string, string>;
  onSuccess(r: PostResult): void;
  /** Called after errors appear or clear, so the panel can re-measure. */
  onChange?(): void;
}

function describedBy(el: Element, id: string, add: boolean) {
  const ids = new Set((el.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean));
  if (add) ids.add(id);
  else ids.delete(id);
  if (ids.size) el.setAttribute('aria-describedby', [...ids].join(' '));
  else el.removeAttribute('aria-describedby');
}

export function wireForm(form: HTMLFormElement, o: WireOptions) {
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
  const say = (msg: string | null, kind: 'error' | 'info' = 'error') => {
    alert.hidden = !msg;
    alert.textContent = msg ?? '';
    alert.dataset.kind = kind;
    alert.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  };

  form.addEventListener('input', (e) => {
    const el = e.target as Control;
    if (el.getAttribute('aria-invalid')) { clearError(el); o.onChange?.(); }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (button.disabled) return;
    say(null);
    const invalid: Control[] = [];
    for (const [name, copy] of Object.entries(o.fields)) {
      const el = control(name);
      if (!el) continue;
      clearError(el);
      if (!el.checkValidity()) {
        setError(el, el.validity.valueMissing ? copy.missing : copy.invalid ?? copy.missing);
        invalid.push(el);
      }
    }
    if (invalid.length) {
      o.onChange?.();
      invalid[0].focus();
      return;
    }
    const data: Record<string, string> = {};
    new FormData(form).forEach((v, k) => { data[k] = String(v); });
    const label = button.textContent;
    button.disabled = true;
    button.textContent = o.busy;
    form.setAttribute('aria-busy', 'true');
    o.onChange?.();
    const r = await post(o.endpoint, data);
    button.disabled = false;
    button.textContent = label;
    form.removeAttribute('aria-busy');
    if (r.outcome === 'ok') return o.onSuccess(r);
    if (r.outcome === 'invalid') {
      const bad = (r.fields ?? Object.keys(o.fields)).map(control).filter((x): x is Control => !!x);
      bad.forEach((el) => setError(el, o.fields[el.name]?.invalid ?? o.fields[el.name]?.missing ?? 'Check this field.'));
      o.onChange?.();
      bad[0]?.focus();
      return;
    }
    say(o.alerts[r.outcome] ?? o.alerts.failed, r.outcome === 'duplicate' ? 'info' : 'error');
    o.onChange?.();
  });
}
