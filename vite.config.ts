import { defineConfig, type Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleEnquiry, handleWaitlist } from './server/handlers.ts';
import { labelName, sale } from './src/content/sale.ts';

// Serves /api/* locally (dev and preview) with the same handlers the Vercel functions use.
function api(): Plugin {
  const handle = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = req.url ?? '';
    // Same permanent redirect as vercel.json.
    if (/^\/invitations\/?(\?|$)/.test(url)) {
      res.writeHead(301, { location: '/about' + (url.includes('?') ? url.slice(url.indexOf('?')) : '') });
      return res.end();
    }
    const route = url.startsWith('/api/waitlist') ? handleWaitlist : url.startsWith('/api/enquiry') ? handleEnquiry : null;
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
    // The no-JavaScript waitlist form needs the current drop.
    transformIndexHtml: (html) => html.replaceAll('%MINO_DROP_ID%', sale.drop.id).replaceAll('%MINO_LABEL%', labelName()),
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
