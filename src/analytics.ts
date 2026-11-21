// Aggregate funnel events. The project has no analytics provider installed yet: events go to
// Vercel Web Analytics custom events if its script is added later (window.va), and are always
// dispatched as a `mino:analytics` DOM event (useful for tests and a future provider).
// Never pass email addresses or anything a visitor typed; only event names, step numbers and the
// fixed answer options.

export type FunnelEvent = 'plan_start' | 'plan_step_complete' | 'plan_submit_success' | 'plan_submit_failure';
type Props = Record<string, string | number>;

declare global {
  interface Window { va?: (kind: 'event', payload: { name: string; data?: Props }) => void }
}

export function track(name: FunnelEvent, data?: Props) {
  window.dispatchEvent(new CustomEvent('mino:analytics', { detail: { name, ...data } }));
  try {
    window.va?.('event', { name, data });
  } catch {
    /* analytics must never break the funnel */
  }
}
