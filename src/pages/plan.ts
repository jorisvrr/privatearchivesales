// /plan: a short, focused enquiry for labels. Three steps, one primary action each, explicit Continue,
// Back and Exit always available, answers kept when moving back. Success only after the server confirms.
// A business enquiry only: never a drop waitlist, never marketing.
import { gsap } from 'gsap';
import { track } from '../analytics';
import { name } from '../config/brand';
import { EMAIL_INVALID, formUI, post } from '../forms';
import { icon, icons } from '../ui/icons';
import { prefersReduced } from '../ui/reveal';
import { h, type EnterInfo, type Page, type Route } from './types';

export const RELEASE_OPTIONS = ['Past collections', 'Samples', 'Both', 'Still exploring'];
export const TIMING_OPTIONS = ['Next month', 'Within three months', 'Exploring'];
type Step = 1 | 2 | 3;

const options = (field: string, values: string[]) =>
  h('div', { class: 'plan__options' }, ...values.map((v, i) =>
    h('label', { class: 'plan__option', for: `${field}-${i}` },
      h('input', { type: 'radio', name: field, id: `${field}-${i}`, value: v }),
      h('span', {}, v))));

const backButton = () => h('button', { type: 'button', class: 'plan__back', 'data-back': '' }, icon(icons.back), h('span', {}, 'Back'));
const stepUrl = (s: Step) => (s === 1 ? '/plan' : `/plan?step=${s}`);

export function planPage(route: Route): Page {
  const progress = h('p', { class: 'plan__progress', 'aria-live': 'polite' }, '1 of 3');
  const meter = h('div', { class: 'plan__meter', 'aria-hidden': 'true' }, h('span', {}), h('span', {}), h('span', {}));
  const exit = h('a', { class: 'plan__exit', href: '/for-labels' }, icon(icons.close), h('span', {}, 'Exit'));

  const q1 = h('h1', { class: 'plan__q', tabindex: '-1', id: 'q-release' }, 'What would you like to release?');
  const q2 = h('h1', { class: 'plan__q', tabindex: '-1', id: 'q-timing' }, 'When are you considering a sale?');
  const q3 = h('h1', { class: 'plan__q', tabindex: '-1' }, 'Let’s shape your archive sale.');
  const err1 = h('p', { class: 'fp-error', id: 'release-error', hidden: '' }, 'Choose one option to continue.');
  const err2 = h('p', { class: 'fp-error', id: 'timing-error', hidden: '' }, 'Choose one option to continue.');
  const next1 = h('button', { type: 'button', class: 'fp-button', 'data-next': '1' }, 'Continue');
  const next2 = h('button', { type: 'button', class: 'fp-button', 'data-next': '2' }, 'Continue');
  const summary = h('p', { class: 'plan__answers' });

  const step1 = h('section', { class: 'plan__step', 'data-step': '1' },
    h('fieldset', { class: 'plan__set', 'aria-describedby': 'release-error' }, h('legend', {}, q1), options('release', RELEASE_OPTIONS), err1),
    h('div', { class: 'plan__actions' }, next1));
  const step2 = h('section', { class: 'plan__step', 'data-step': '2', hidden: '' },
    h('fieldset', { class: 'plan__set', 'aria-describedby': 'timing-error' }, h('legend', {}, q2), options('timing', TIMING_OPTIONS), err2),
    h('div', { class: 'plan__actions' }, backButton(), next2));
  const step3 = h('section', { class: 'plan__step', 'data-step': '3', hidden: '' },
    q3,
    h('p', { class: 'plan__lead' }, 'Send your enquiry. We’ll review your plans and follow up by email to discuss the sale structure, scope, and fees.'),
    summary,
    h('div', { class: 'fp-field' },
      h('label', { for: 'plan-email', class: 'fp-label' }, 'Work email'),
      h('input', { id: 'plan-email', name: 'email', type: 'email', required: '', autocomplete: 'email', inputmode: 'email', spellcheck: 'false', class: 'fp-input' })),
    h('div', { class: 'fp-field' },
      h('label', { for: 'plan-brand', class: 'fp-label' }, 'Brand website or Instagram ', h('span', { class: 'fp-label__hint' }, '(optional)')),
      h('input', { id: 'plan-brand', name: 'brand', type: 'text', autocomplete: 'url', spellcheck: 'false', maxlength: '200', class: 'fp-input', placeholder: 'yourlabel.com or @yourlabel' })),
    h('input', { type: 'text', name: 'fax', class: 'hp', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true' }),
    h('p', { class: 'fp-alert', 'data-alert': '', hidden: '' }),
    h('div', { class: 'plan__actions' }, backButton(), h('button', { type: 'submit', class: 'fp-button' }, 'Send my enquiry')),
    h('p', { class: 'plan__fine' }, 'No commitment. We’ll use your details to respond to this enquiry.'));
  const form = h('form', { class: 'plan__form', method: 'post', action: '/api/enquiry', novalidate: '' }, step1, step2, step3) as HTMLFormElement;

  const sentTo = h('strong', {});
  const done = h('section', { class: 'plan__step plan__done', hidden: '', 'aria-labelledby': 'plan-done' },
    h('h1', { class: 'plan__q', tabindex: '-1', id: 'plan-done' }, `Your enquiry is with ${name}.`),
    h('p', { class: 'plan__lead' }, 'We’ll review your answers and follow up at ', sentTo, ' to discuss your archive and the next steps.'),
    h('h2', { class: 'plan__label' }, 'What happens next'),
    h('ol', { class: 'plan__process' }, h('li', {}, 'Review'), h('li', {}, 'Proposed scope and fees'), h('li', {}, 'Agreed launch plan')),
    h('a', { class: 'plan__link', href: '/for-labels' }, 'Back to For labels'));

  const shell = h('div', { class: 'plan' }, h('div', { class: 'plan__bar' }, exit, progress), meter, form, done);
  const scroll = h('div', { class: 'page__scroll' }, shell);
  const el = h('main', { class: 'page page--plan', id: 'main' }, scroll);

  const ui = formUI(form);
  const steps: Record<Step, HTMLElement> = { 1: step1, 2: step2, 3: step3 };
  const heads: Record<Step, HTMLElement> = { 1: q1, 2: q2, 3: q3 };
  let step: Step = 1;
  let sent = false;
  let submitting = false;
  let swapping: gsap.core.Timeline | null = null;

  const value = (field: string) => (form.elements.namedItem(field) as RadioNodeList).value;
  const setProgress = (s: Step) => {
    progress.textContent = `${s} of 3`;
    meter.querySelectorAll('span').forEach((m, i) => m.classList.toggle('is-on', i < s));
  };

  /** Swap the visible screen: ~150 ms out, ~220 ms in; reduced motion swaps instantly. */
  function reveal(from: HTMLElement | null, to: HTMLElement, focus: HTMLElement) {
    swapping?.progress(1).kill();
    const finish = () => { focus.focus({ preventScroll: true }); scroll.scrollTo({ top: 0 }); };
    if (!from || from === to || prefersReduced()) {
      if (from && from !== to) from.hidden = true;
      to.hidden = false;
      finish();
      return;
    }
    swapping = gsap.timeline({ onComplete: () => { swapping = null; } })
      .to(from, { opacity: 0, y: -8, duration: 0.15, ease: 'power2.in' })
      .add(() => { from.hidden = true; gsap.set(from, { clearProps: 'opacity,transform' }); to.hidden = false; finish(); })
      .fromTo(to, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.22, ease: 'power2.out', clearProps: 'opacity,transform' });
  }

  function show(next: Step, how: 'push' | 'replace' | 'none') {
    if (sent) return;
    const from = steps[step];
    step = next;
    setProgress(next);
    if (next === 3) summary.textContent = `${value('release')} · ${value('timing')}`;
    if (how === 'push') history.pushState({ planStep: next }, '', stepUrl(next));
    else if (how === 'replace') history.replaceState({ planStep: next }, '', stepUrl(next));
    reveal(from, steps[next], heads[next]);
  }

  /** The furthest step the current answers allow. */
  const allowed = (wanted: Step): Step => (wanted >= 2 && !value('release') ? 1 : wanted === 3 && !value('timing') ? 2 : wanted);

  function require(field: string, err: HTMLElement): boolean {
    if (value(field)) { err.hidden = true; return true; }
    err.hidden = false;
    form.querySelector<HTMLInputElement>(`input[name=${field}]`)?.focus();
    return false;
  }

  next1.addEventListener('click', () => {
    if (!require('release', err1)) return;
    track('plan_step_complete', { step: 1, choice: value('release') });
    show(2, 'push');
  });
  next2.addEventListener('click', () => {
    if (!require('timing', err2)) return;
    track('plan_step_complete', { step: 2, choice: value('timing') });
    show(3, 'push');
  });
  form.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.name === 'release') err1.hidden = true;
    if (t.name === 'timing') err2.hidden = true;
  });
  form.querySelectorAll<HTMLButtonElement>('[data-back]').forEach((b) => b.addEventListener('click', () => {
    // Our own history entry for this step: step back through history so browser Back stays in sync.
    if (history.state?.planStep === step) history.back();
    else show((step - 1) as Step, 'replace');
  }));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (step !== 3 || submitting || sent) return;
    ui.say(null);
    if (!ui.validate({ email: { missing: 'Enter your work email.', invalid: EMAIL_INVALID } })) return;
    const data: Record<string, string> = {};
    new FormData(form).forEach((v, k) => { data[k] = String(v); });
    submitting = true;
    ui.busy(true, 'Sending…');
    const r = await post('/api/enquiry', data);
    ui.busy(false, 'Sending…');
    submitting = false;
    if (r.ok) {
      sent = true;
      track('plan_submit_success');
      sentTo.textContent = data.email.trim();
      progress.textContent = '';
      meter.hidden = true;
      history.replaceState({ planStep: 'sent' }, '', '/plan');
      reveal(form, done, done.querySelector('h1')!);
      return;
    }
    const reason = r.status === 422 ? 'invalid' : r.status === 503 && r.body.error === 'not_configured' ? 'not_configured' : 'failed';
    track('plan_submit_failure', { reason });
    if (reason === 'invalid') {
      const fields = (r.body.fields as string[] | undefined) ?? [];
      if (fields.includes('release')) { show(1, 'replace'); require('release', err1); return; }
      if (fields.includes('timing')) { show(2, 'replace'); require('timing', err2); return; }
      ui.setError(form.elements.namedItem('email') as HTMLInputElement, EMAIL_INVALID);
      (form.elements.namedItem('email') as HTMLInputElement).focus();
      return;
    }
    // Answers and typed details stay in place; sending again retries.
    ui.say(reason === 'not_configured'
      ? 'Enquiries can’t be sent from this page yet. Nothing was sent, and your answers are still here.'
      : 'Your enquiry wasn’t sent. Your answers are still here: check your connection and send it again.');
  });

  // Keep the focused field and its action above an on-screen keyboard.
  const keepVisible = () => {
    const a = document.activeElement as HTMLElement | null;
    if (!a || !step3.contains(a) || !a.matches('input')) return;
    const vv = window.visualViewport;
    const visibleBottom = vv ? vv.height + vv.offsetTop : innerHeight;
    const target = step3.querySelector('.plan__actions')!.getBoundingClientRect().bottom;
    const fieldTop = a.getBoundingClientRect().top;
    if (target > visibleBottom - 12) scroll.scrollTop += Math.min(target - visibleBottom + 12, fieldTop - 72);
  };
  step3.addEventListener('focusin', () => requestAnimationFrame(keepVisible));
  const onViewport = () => keepVisible();

  return {
    route,
    title: `Plan an archive sale — ${name}`,
    el,
    chrome: null,
    ready: Promise.resolve(),
    enter(info: EnterInfo) {
      // A direct link to a later step without answers starts at the first open question.
      const wanted = Number(new URLSearchParams(location.search).get('step')) as Step;
      const start = allowed(wanted === 2 || wanted === 3 ? wanted : 1);
      if (location.search && start === 1) history.replaceState({ planStep: 1 }, '', '/plan');
      else history.replaceState({ planStep: start }, '', stepUrl(start));
      step = start;
      setProgress(start);
      track('plan_start');
      if (info.initial || info.instant) heads[start].focus({ preventScroll: true });
      window.visualViewport?.addEventListener('resize', onViewport);
    },
    leave() {
      window.visualViewport?.removeEventListener('resize', onViewport);
    },
    destroy() {
      swapping?.kill();
    },
    focusTarget: () => (sent ? done.querySelector('h1') : heads[step]),
    onSameRoutePop() {
      if (sent) { history.replaceState({ planStep: 'sent' }, '', '/plan'); return; }
      const wanted = Number(new URLSearchParams(location.search).get('step')) || 1;
      const next = allowed(wanted as Step);
      if (next !== wanted) history.replaceState({ planStep: next }, '', stepUrl(next));
      show(next, 'none');
    },
  };
}
