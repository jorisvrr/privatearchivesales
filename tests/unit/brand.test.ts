import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { brand, eventCredit, name, pageTitle, siteTitle } from '../../src/config/brand';

const root = join(__dirname, '../..');
const files = (dir: string): string[] =>
  readdirSync(join(root, dir)).flatMap((f) => {
    const p = join(dir, f);
    return statSync(join(root, p)).isDirectory() ? files(p) : [p];
  });
/** Source without comments, so only real strings count. */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

describe('brand config', () => {
  it('derives every visible form of the name from one value', () => {
    expect(siteTitle).toBe(`${name} — Private archive sales`);
    expect(eventCredit).toBe(`Organized by ${name}`);
    expect(pageTitle('About')).toBe(`About — ${name}`);
    expect(brand.name).toBe(name);
  });

  it('no visitor-facing source hardcodes the brand name', () => {
    const scanned = [...files('src'), ...files('server'), ...files('api'), 'index.html', ...files('label-site').filter((f) => !f.includes('rendered'))]
      .filter((f) => /\.(ts|html)$/.test(f) && relative('src/config', f).startsWith('..'));
    expect(scanned.length).toBeGreaterThan(20);
    const hits = scanned.filter((f) => new RegExp(`\\b${name}\\b`).test(code(readFileSync(join(root, f), 'utf8'))));
    expect(hits).toEqual([]);
  });
});
