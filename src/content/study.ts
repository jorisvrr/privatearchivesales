// Mino Study 001: the image collection on the Archive. One source for the intro, the sphere, hover captions,
// the expanded view, detail pages, the keyboard list and the no-WebGL grid.
// Images are built by scripts/build-study-images.py into public/media/study-001/<slug>-{s,m,l}.webp.
import { name } from '../config/brand';

export const collection = {
  title: `${name} Study 001`,
  credit: `An editorial study by ${name}`,
  /** Stated once, in the collection details on each detail page. */
  disclosure: 'An AI-generated editorial study.',
} as const;

export interface StudyGroup { slug: string; name: string }

export interface StudyImage {
  /** URL slug and asset name. */
  id: string;
  group: string;
  caption: string;
  alt: string;
  /** Sphere + intro texture (300×400). */
  small: string;
  /** Grid and thumbnails (640×853). */
  medium: string;
  /** Expanded plane and detail page (1086×1448). */
  large: string;
}

export const groups: StudyGroup[] = [
  { slug: 'corduroy', name: 'Corduroy' },
  { slug: 'ecru-denim', name: 'Ecru denim' },
  { slug: 'nubuck-boots', name: 'Nubuck boots' },
  { slug: 'invitation', name: 'Invitation' },
  { slug: 'archive-record', name: 'Archive record' },
  { slug: 'packing', name: 'Packing' },
];

const img = (id: string, group: string, caption: string, alt: string): StudyImage => ({
  id, group, caption, alt,
  small: `/media/study-001/${id}-s.webp`,
  medium: `/media/study-001/${id}-m.webp`,
  large: `/media/study-001/${id}-l.webp`,
});

const all: Record<string, StudyImage> = Object.fromEntries([
  img('bomber-on-plaster', 'corduroy', 'Bomber on plaster', 'A dark brown corduroy bomber jacket with a silver zip and ribbed cuffs, hanging from a wire hanger against a warm plaster wall in window light.'),
  img('worn-from-behind', 'corduroy', 'Worn from behind', 'Seen from behind, a person with curly hair wears the oversized brown corduroy bomber with olive trousers, beside a window.'),
  img('turned-cuff', 'corduroy', 'Turned cuff', 'Close-up of a brown corduroy cuff turned back to show its cotton lining, resting on a dark surface.'),
  img('jeans-laid-flat', 'ecru-denim', 'Jeans laid flat', 'Ecru five-pocket jeans laid flat on a dark surface, a window shadow falling across the waistband.'),
  img('inside-the-waistband', 'ecru-denim', 'Inside the waistband', 'Close-up of an ecru denim waistband: brass button, zip fly and tan topstitching.'),
  img('hem-over-boot', 'ecru-denim', 'Hem over boot', 'The hem of ecru jeans falling over a worn tan nubuck boot on a concrete floor.'),
  img('side-profile', 'nubuck-boots', 'Side profile', 'A worn tan nubuck lace-up boot in side profile, with a padded dark leather collar, standing on a plaster plinth.'),
  img('unlaced-pair', 'nubuck-boots', 'Unlaced pair', 'A pair of worn tan nubuck boots with loose laces, seen from above on a dark floor.'),
  img('brass-eyelets', 'nubuck-boots', 'Brass eyelets', 'Close-up of a nubuck boot’s lacing: brass eyelets, waxed laces and double stitching.'),
  img('sealed-envelope', 'invitation', 'Sealed envelope', 'A sealed cream envelope of textured paper on a dark surface, crossed by window light.'),
  img('mino-study-001', 'invitation', collection.title, `A cream card printed “${collection.title}” standing in an open envelope on a dark surface.`),
  img('invitation-in-hand', 'invitation', 'Invitation in hand', `A hand holding a cream card printed “${collection.title}” against a plaster wall in window light.`),
  img('corduroy-swatch-card', 'archive-record', 'Corduroy swatch card', 'A brown corduroy swatch clipped to an aged card labelled “001 Corduroy jacket” in pencil.'),
  img('jacket-contact-prints', 'archive-record', 'Jacket contact prints', 'A strip of three black-and-white contact prints of a corduroy chore jacket: on its hanger, the collar, and a pocket with the cuff.'),
  img('shoulder-measurement', 'archive-record', 'Shoulder measurement', 'A tape measure laid along the shoulder of the brown corduroy bomber on a dark table.'),
  img('bomber-in-tissue', 'packing', 'Bomber in tissue', 'The brown corduroy bomber folded in crumpled tissue paper, its zip and ribbed collar showing.'),
  img('tied-parcel', 'packing', 'Tied parcel', 'A parcel wrapped in translucent tissue and tied with a cream herringbone ribbon, on a dark table by a window.'),
  img('empty-hanger', 'packing', 'Empty hanger', 'An empty black wire hanger on a wooden peg against a plaster wall, window light falling across it.'),
].map((i) => [i.id, i]));

/**
 * Sphere order: index = Fibonacci slot. Art-directed so the front cluster right after the intro holds a garment
 * silhouette (slot 6, nearest), a light paper object (slot 11) and a texture detail (slot 14), with pale paper
 * and ecru images alternating with the darker corduroy and charcoal ones.
 */
const SLOTS = [
  'empty-hanger', 'sealed-envelope', 'shoulder-measurement', 'jeans-laid-flat', 'tied-parcel', 'brass-eyelets',
  'bomber-on-plaster', 'corduroy-swatch-card', 'unlaced-pair', 'side-profile', 'jacket-contact-prints', 'mino-study-001',
  'inside-the-waistband', 'bomber-in-tissue', 'turned-cuff', 'hem-over-boot', 'worn-from-behind', 'invitation-in-hand',
];

/** The ten-image intro ring, clockwise from the top. These planes then fly to their own sphere slots. */
export const INTRO_RING = [
  'sealed-envelope', 'mino-study-001', 'corduroy-swatch-card', 'bomber-on-plaster', 'jeans-laid-flat',
  'side-profile', 'brass-eyelets', 'bomber-in-tissue', 'tied-parcel', 'empty-hanger',
];

export const images: StudyImage[] = SLOTS.map((id) => all[id]);

export const imageById = (id: string) => all[id] ?? null;
export const groupOf = (image: StudyImage) => groups.find((g) => g.slug === image.group)!;
export const imagesIn = (group: string) => groups.find((g) => g.slug === group) ? Object.values(all).filter((i) => i.group === group) : [];
/** Detail page for one photograph. */
export const imageHref = (image: StudyImage) => `/archive/${image.id}`;
