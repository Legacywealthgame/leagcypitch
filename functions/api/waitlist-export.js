/* ==========================================================================
   Waitlist export — Cloudflare Pages Function
   GET /api/waitlist-export?key=SECRET
   Returns: text/csv of every signup

   The Cloudflare dashboard can already run a query against the database, so
   this exists for the ordinary case: getting the list onto your computer as a
   file you can hand to an email provider, without logging in.

   Required Cloudflare settings:
     WAITLIST            D1 database binding
     WAITLIST_EXPORT_KEY secret — the ?key= value this checks against
   ========================================================================== */

function deny() {
  /* 404 rather than 403, so probing cannot confirm the endpoint exists. */
  return new Response('Not found', { status: 404 });
}

/* Constant-time compare. A plain === leaks the key one character at a time to
   anyone willing to measure how long the answer took. */
function sameSecret(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function csvCell(value) {
  const s = String(value ?? '');
  /* A leading =, +, - or @ makes a spreadsheet treat the cell as a formula, so
     a signup could run something on the machine that opens the file. Prefix a
     quote to keep it text; it stays readable and inert. */
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function onRequestGet({ request, env }) {
  if (!env.WAITLIST || !env.WAITLIST_EXPORT_KEY) return deny();

  const key = new URL(request.url).searchParams.get('key') || '';
  if (!sameSecret(key, env.WAITLIST_EXPORT_KEY)) return deny();

  const { results } = await env.WAITLIST.prepare(
    'SELECT email, name, phone, joined_at, source FROM signups ORDER BY joined_at ASC'
  ).all();

  const header = ['email', 'name', 'phone', 'joined_at', 'source'];
  const rows = [header.join(',')];
  for (const row of results || []) {
    rows.push(header.map((column) => csvCell(row[column])).join(','));
  }

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(rows.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="waitlist-${stamp}.csv"`,
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}
