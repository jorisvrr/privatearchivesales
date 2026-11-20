// Sale content. Everything a partner has not supplied stays `null` and is never shown.
// Replace the demo plates and fill these fields only with information the featured label has confirmed.

export type View = 'full' | 'detail' | 'tag' | 'lookbook';

export interface Garment {
  slug: string;
  title: string;
  /** Supplied by the label only. Shown when present. */
  season: string | null;
  size: string | null;
  condition: string | null;
  /** Archive price as the label approved it, e.g. "€ 180". */
  price: string | null;
  /** A short note from the founder. */
  note: string | null;
}

export interface Plate {
  id: string;
  garment: string;
  view: View;
  /** Small texture for the sphere and the intro ring. */
  small: string;
  /** Large texture for the expanded plane and the piece page. */
  large: string;
  alt: string;
}

export interface Sale {
  /** "demo" until a label has confirmed the sale, its pieces and its prices. */
  status: 'demo' | 'confirmed';
  number: string;
  /** Featured label name, e.g. "Studio Name". Null until a partner is confirmed. */
  label: string | null;
  city: string | null;
  date: string | null;
  garments: Garment[];
  plates: Plate[];
}

export const VIEW_NAMES: Record<View, string> = {
  full: 'Full silhouette',
  detail: 'Detail',
  tag: 'Sample tag',
  lookbook: 'Lookbook',
};

const demoGarment = (slug: string, title: string): Garment => ({
  slug, title, season: null, size: null, condition: null, price: null, note: null,
});

const garments: Garment[] = [
  demoGarment('chore-jacket', 'Chore jacket'),
  demoGarment('long-coat', 'Long coat'),
  demoGarment('poplin-shirt', 'Poplin shirt'),
  demoGarment('ribbed-jumper', 'Ribbed jumper'),
  demoGarment('wide-leg-trouser', 'Wide-leg trouser'),
];

const plateKeys: Record<string, string> = {
  jacket: 'chore-jacket', coat: 'long-coat', shirt: 'poplin-shirt', knit: 'ribbed-jumper', trouser: 'wide-leg-trouser',
};

// Order matters: it is the Fibonacci slot order, and plates 1–10 form the intro ring.
const order: [string, View][] = [
  ['jacket', 'full'], ['coat', 'lookbook'], ['shirt', 'full'], ['knit', 'detail'], ['trouser', 'full'],
  ['jacket', 'tag'], ['knit', 'full'], ['coat', 'full'], ['trouser', 'lookbook'], ['shirt', 'detail'],
  ['jacket', 'detail'], ['knit', 'lookbook'], ['trouser', 'detail'], ['coat', 'detail'], ['shirt', 'tag'],
  ['jacket', 'lookbook'], ['trouser', 'tag'], ['knit', 'tag'],
];

const plates: Plate[] = order.map(([key, view], i) => {
  const n = String(i + 1).padStart(2, '0');
  const garment = garments.find((g) => g.slug === plateKeys[key])!;
  const id = `${n}-${key}-${view}`;
  return {
    id,
    garment: garment.slug,
    view,
    small: `/media/demo/${id}-s.jpg`,
    large: `/media/demo/${id}-l.jpg`,
    alt: `Demo plate ${n}: illustrated ${garment.title.toLowerCase()}, ${VIEW_NAMES[view].toLowerCase()}. Not a real piece.`,
  };
});

export const sale: Sale = {
  status: 'demo',
  number: '001',
  label: null,
  city: null,
  date: null,
  garments,
  plates,
};

export const isDemo = () => sale.status === 'demo';
export const labelName = () => sale.label ?? 'Featured label';
export const eventTitle = () => `${labelName()} — Archive Sale ${sale.number}`;
export const EVENT_CREDIT = 'Organized by Orvel';
export const SITE_TITLE = 'Orvel — Private archive sales';
export const garmentBySlug = (slug: string) => sale.garments.find((g) => g.slug === slug) ?? null;
export const platesFor = (slug: string) => sale.plates.filter((p) => p.garment === slug);
export const garmentOf = (plate: Plate) => garmentBySlug(plate.garment)!;

/** Subtitle used in the bottom title slot: view, then any supplied size and price. */
export function plateSubtitle(plate: Plate): string {
  const g = garmentOf(plate);
  return [VIEW_NAMES[plate.view], g.size, g.price].filter(Boolean).join(' · ');
}
