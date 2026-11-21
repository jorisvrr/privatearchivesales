import { defineConfig, type Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleEnquiry } from './server/handlers.ts';
import { descriptor, name as brandName, siteTitle } from './src/config/brand.ts';

// Serves /api/* locally (dev and preview) with the same handlers the Vercel functions use.
function api(): Plugin {
  const handle = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = req.url ?? '';
    // Same permanent redirects as vercel.json: old signup URLs → /about, old demo garments → /.
    const path = url.split('?')[0];
    const moved = /^\/(invitations|waitlist)(\/.*)?$/.test(path.replace(/\/+$/, '')) ? '/about'
      : /^\/archive\/(chore-jacket|long-coat|poplin-shirt|ribbed-jumper|wide-leg-trouser)\/?$/.test(path) ? '/' : null;
    if (moved) {
      res.writeHead(301, { location: moved + (url.includes('?') ? url.slice(url.indexOf('?')) : '') });
      return res.end();
    }
    const route = url.startsWith('/api/enquiry') ? handleEnquiry : null;
    if (!route) return next();
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const request = new Request(`http://localhost${url}`, {
      method: req.method,
      headers: req.headers as Record<string, string>,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks),
    });
    const response = await route(request, process.env);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  };
  return {
    name: 'mino-api',
    // Brand (src/config/brand.ts) into title, metadata and the no-JavaScript copy.
    transformIndexHtml: (html) => html
      .replaceAll('%BRAND_SITE_TITLE%', siteTitle).replaceAll('%BRAND_NAME%', brandName).replaceAll('%BRAND_DESCRIPTOR%', descriptor),
    configureServer: (s) => { s.middlewares.use(handle); },
    configurePreviewServer: (s) => { s.middlewares.use(handle); },
  };
}

export default defineConfig({
  plugins: [api()],
  // The project path contains "::", which Vite's dev-server allow-list check mis-parses (every request 403s).
  // Dev server only; it listens on localhost. The production build and preview are unaffected.
  server: { fs: { strict: false } },
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
  preview: { port: 4173 },
});
