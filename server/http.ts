// Shared request/response helpers for the form endpoints (Web-standard Request → Response).

export type Env = Record<string, string | undefined>;
export type Fetch = typeof fetch;

const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;
export const isEmail = (v: string) => v.length <= 254 && EMAIL.test(v);
export const clean = (v: string | undefined, max: number) => (v ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, max);

/** The local "mock" providers are for tests only and are refused on Vercel. */
export const mockAllowed = (env: Env) => env.MINO_ALLOW_MOCK === '1' && !env.VERCEL;

export async function readBody(req: Request): Promise<{ data: Record<string, string>; form: boolean }> {
  const type = req.headers.get('content-type') ?? '';
  const data: Record<string, string> = {};
  if (type.includes('application/json')) {
    const json = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    for (const [k, v] of Object.entries(json ?? {})) if (typeof v === 'string') data[k] = v;
    return { data, form: false };
  }
  const fd = await req.formData().catch(() => null);
  fd?.forEach((v, k) => { if (typeof v === 'string') data[k] = v; });
  return { data, form: true };
}

export const methodNotAllowed = () => new Response('Method not allowed', { status: 405, headers: { allow: 'POST' } });

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}

/** No-JavaScript fallback: a minimal page with the outcome and a link back. */
export function htmlPage(status: number, message: string, back: string): Response {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mino — Private archive sales</title>
<style>body{margin:0;font:400 17px/1.45 Georgia,serif;color:#000;background:#fff}main{max-width:460px;margin:22vh auto 0;padding:0 16px}p.b{font:500 14px Arial,sans-serif;margin-bottom:40px}a{font:500 13px Arial,sans-serif;color:#000}</style></head>
<body><main><p class="b">Mino</p><p role="status">${esc(message)}</p><p><a href="${esc(back)}">Back</a></p></main></body></html>`;
  return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
