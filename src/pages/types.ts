export type RouteName = 'archive' | 'invitations' | 'labels' | 'piece' | 'notfound';

export interface Route {
  name: RouteName;
  path: string;
  slug?: string;
}

export interface EnterInfo {
  /** No slide: first load, browser Back/Forward, or reduced motion. */
  instant: boolean;
  /** First page of this page session (a direct load or reload). */
  initial: boolean;
  from: Route | null;
  /** Slide duration in seconds (0 when instant). */
  duration: number;
}

export interface Page {
  route: Route;
  title: string;
  /** Slides with the page transition. */
  el: HTMLElement;
  /** Fixed overlays (panels, title slot) that ride in and out instead of sliding. */
  chrome: HTMLElement | null;
  /** Resolves when the new page can be shown (the slide waits ≤ 800 ms for it). */
  ready: Promise<void>;
  enter(info: EnterInfo): void;
  leave(info: { instant: boolean; duration: number; to: Route }): void;
  /** Removed from the document. Cached pages (Archive) stay alive. */
  destroy(): void;
  /** Element to focus after an in-app route change. */
  focusTarget(): HTMLElement | null;
}

export function parseRoute(pathname: string): Route {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/' || path === '/archive') return { name: 'archive', path: '/' };
  if (path === '/invitations') return { name: 'invitations', path };
  if (path === '/for-labels') return { name: 'labels', path };
  const m = path.match(/^\/archive\/([a-z0-9-]+)$/);
  if (m) return { name: 'piece', path, slug: m[1] };
  return { name: 'notfound', path };
}

export const h = <K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...children: (Node | string)[]) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else el.setAttribute(k, v);
  }
  el.append(...children);
  return el;
};
