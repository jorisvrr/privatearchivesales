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

/** How a drop checks that someone bought from the label before (order number + checkout email). */
export type OrderVerification = 'shopify' | 'webhook' | null;

export interface Drop {
  /** Stable id used in the waitlist link and in every waitlist entry, e.g. "studio-name-archive-001". */
  id: string;
  /** Where the label posts the waitlist: the archive page Mino builds on the label's own website. Null until it exists. */
  waitlistUrl: string | null;
  /** Order-record source for first access. Null until the label's store is connected. */
  verification: OrderVerification;
}

export interface Sale {
  /** "demo": preview content. "confirmed": a label confirmed the drop. "none": no drop is confirmed right now. */
  status: 'demo' | 'confirmed' | 'none';
  number: string;
  /** Featured label name, e.g. "Studio Name". Null until a partner is confirmed. */
  label: string | null;
  city: string | null;
  date: string | null;
  garments: Garment[];
  plates: Plate[];
  drop: Drop;
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
  drop: { id: 'demo-archive-001', waitlistUrl: null, verification: null },
};

/** Every drop the waitlist API accepts. One per sale; add confirmed drops here. */
export const drops = (): (Drop & { label: string; status: Sale['status'] })[] => [{ ...sale.drop, label: labelName(), status: sale.status }];
export const dropById = (id: string) => drops().find((d) => d.id === id) ?? null;

/**
 * Where "Join the waitlist" points. Confirmed drop: the label's own waitlist link.
 * Demo: Mino's preview of the drop page. No confirmed drop: null (show "The next waitlist link will be shared here.").
 */
export function waitlistHref(): string | null {
  if (sale.status === 'confirmed') return sale.drop.waitlistUrl;
  if (sale.status === 'demo') return `/waitlist/${sale.drop.id}`;
  return null;
}

export const isDemo = () => sale.status === 'demo';
export const labelName = () => sale.label ?? 'Featured label';
export const eventTitle = () => `${labelName()} — Archive Sale ${sale.number}`;
export const BRAND = 'Mino';
export const EVENT_CREDIT = 'Organized by Mino';
export const SITE_TITLE = 'Mino — Private archive sales';
export const garmentBySlug = (slug: string) => sale.garments.find((g) => g.slug === slug) ?? null;
export const platesFor = (slug: string) => sale.plates.filter((p) => p.garment === slug);
export const garmentOf = (plate: Plate) => garmentBySlug(plate.garment)!;

/** Subtitle used in the bottom title slot: view, then any supplied size and price. */
export function plateSubtitle(plate: Plate): string {
  const g = garmentOf(plate);
  return [VIEW_NAMES[plate.view], g.size, g.price].filter(Boolean).join(' · ');
}
