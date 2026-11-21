// Interface icons from Lucide (the framework-free `lucide` package; the site has no React).
import { ArrowLeft, createElement, Volume2, VolumeX, X } from 'lucide';

type IconNode = typeof X;
export interface IconDef { node: IconNode; name: string }

export const icons = {
  volumeOn: { node: Volume2, name: 'volume-2' },
  volumeOff: { node: VolumeX, name: 'volume-x' },
  close: { node: X, name: 'x' },
  back: { node: ArrowLeft, name: 'arrow-left' },
} satisfies Record<string, IconDef>;

/** 16 px, 1.5 px stroke, decorative (the control around it carries the label). */
export function icon(def: IconDef, size = 16): SVGElement {
  const svg = createElement(def.node, { width: size, height: size, 'stroke-width': 1.5, 'aria-hidden': 'true', focusable: 'false' });
  svg.classList.add('icon', 'lucide', `lucide-${def.name}`);
  return svg;
}
