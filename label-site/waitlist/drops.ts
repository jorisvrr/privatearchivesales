// Drops served by a label-site waitlist deployment. Not used by Mino's public website.
import { labelName, sale } from '../../src/content/sale.ts';

/** How a drop checks that someone bought from the label before (order number + checkout email). */
export type OrderVerification = 'shopify' | 'webhook' | null;

export interface Drop {
  /** Stable id used in the label's waitlist link and in every waitlist entry, e.g. "studio-name-archive-001". */
  id: string;
  /** The label's own waitlist link, on its website. */
  waitlistUrl: string | null;
  /** Order-record source for first access. Null until the label's store is connected. */
  verification: OrderVerification;
}

export type DropInfo = Drop & { label: string; status: 'demo' | 'confirmed' | 'none' };

export const DROPS: Drop[] = [{ id: 'demo-archive-001', waitlistUrl: null, verification: null }];

export const drops = (): DropInfo[] => DROPS.map((d) => ({ ...d, label: labelName(), status: sale.status }));
export const dropById = (id: string) => drops().find((d) => d.id === id) ?? null;
