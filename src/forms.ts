// Form helpers for /plan and the label-site waitlist kit. Without JavaScript the forms post directly to /api.
// Success is shown only after the server confirms that the provider accepted the request (2xx).

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
