import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collection, groupOf, groups, images, imagesIn, INTRO_RING } from '../../src/content/study';

const root = join(__dirname, '../..');
/** WebP stores width/height in its header; read them without a decoder. */
function webpSize(file: string): [number, number] {
  const b = readFileSync(file);
  const chunk = b.toString('ascii', 12, 16);
  if (chunk === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (chunk === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  const bits = b.readUInt32LE(21);
  return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1];
}

describe('Mino Study 001', () => {
  it('collection title, credit and disclosure', () => {
    expect(collection).toEqual({ title: 'Mino Study 001', credit: 'An editorial study by Mino', disclosure: 'An AI-generated editorial study.' });
  });

  it('six groups of three, with the agreed captions', () => {
    const byGroup = Object.fromEntries(groups.map((g) => [g.name, imagesIn(g.slug).map((i) => i.caption)]));
    expect(byGroup).toEqual({
      Corduroy: ['Bomber on plaster', 'Worn from behind', 'Turned cuff'],
      'Ecru denim': ['Jeans laid flat', 'Inside the waistband', 'Hem over boot'],
      'Nubuck boots': ['Side profile', 'Unlaced pair', 'Brass eyelets'],
      Invitation: ['Sealed envelope', 'Mino Study 001', 'Invitation in hand'],
      'Archive record': ['Corduroy swatch card', 'Jacket contact prints', 'Shoulder measurement'],
      Packing: ['Bomber in tissue', 'Tied parcel', 'Empty hanger'],
    });
  });

  it('all 18 images appear exactly once in the sphere, and the intro ring follows the agreed order', () => {
    expect(images).toHaveLength(18);
    expect(new Set(images.map((i) => i.id)).size).toBe(18);
    expect(INTRO_RING.map((id) => images.find((i) => i.id === id)!.caption)).toEqual([
      'Sealed envelope', 'Mino Study 001', 'Corduroy swatch card', 'Bomber on plaster', 'Jeans laid flat',
      'Side profile', 'Brass eyelets', 'Bomber in tissue', 'Tied parcel', 'Empty hanger',
    ]);
  });

  it('the front cluster after the intro: garment silhouette, light paper object, texture detail', () => {
    // Slots 6, 11 and 14 are the nearest three right after the explode (AUDIT placement table).
    expect([images[6].caption, images[11].caption, images[14].caption]).toEqual(['Bomber on plaster', 'Mino Study 001', 'Turned cuff']);
  });

  it('every image has descriptive alt text, no shop wording, and three 3:4 WebP sizes on disk', () => {
    for (const img of images) {
      expect(img.alt.length, img.id).toBeGreaterThan(40);
      expect(`${img.caption} ${img.alt}`).not.toMatch(/price|€|\$|in stock|sold out|buy|demo|illustrat/i);
      expect(groupOf(img)).toBeTruthy();
      for (const [file, w, h] of [[img.small, 300, 400], [img.medium, 640, 853], [img.large, 1086, 1448]] as const) {
        const p = join(root, 'public', file);
        expect(existsSync(p), file).toBe(true);
        expect(webpSize(p), file).toEqual([w, h]);
      }
    }
  });
});
