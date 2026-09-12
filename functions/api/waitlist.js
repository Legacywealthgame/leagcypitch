/* ==========================================================================
   Waitlist signup — Cloudflare Pages Function
   POST /api/waitlist
   Body: { name, email, phone, company }   (company is the honeypot)
   Returns: { ok: true } on success

   Replaces the Netlify Form the signup page used to post to. Netlify Forms
   only exist on Netlify, so after the move the form still looked like it
   worked while recording nobody.

   Required Cloudflare settings:
     WAITLIST            D1 database binding
     RATE_LIMIT          KV namespace (optional, shared with the pitch endpoint)
     WAITLIST_EXPORT_KEY secret (only used by the export endpoint)
   ========================================================================== */

const FIELD_LIMITS = { name: 120, email: 254, phone: 40 };

/* Deliberately permissive. The job here is to catch a typo or a junk string,
   not to adjudicate the email RFCs — a real address wrongly rejected is a
   lost customer, which costs more than a bad row. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function clean(value, limit) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\x00-\x1F\x7F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
}

/* Best-effort only. Unlike the pitch endpoint, this one must not fail closed:
   no paid API sits behind it, so a missing counter store is a reason to accept
   the signup, not to drop it. */
async function rateLimited(kv, ip) {
  if (!kv) return false;
  try {
    const key = `wl:${ip}:${Math.floor(Date.now() / 3600000)}`;
    const seen = parseInt((await kv.get(key)) || '0', 10);
    if (seen >= 12) return true;
    await kv.put(key, String(seen + 1), { expirationTtl: 3700 });
  } catch {
    return false;
  }
  return false;
}

export async function onRequestPost({ request, env }) {
  if (!env.WAITLIST) {
    return json(500, { error: 'config', message: 'The waitlist is not configured yet.' });
  }

  let body;
  const type = request.headers.get('content-type') || '';
  try {
    if (type.includes('application/json')) {
      body = await request.json();
    } else {
      body = Object.fromEntries((await request.formData()).entries());
    }
  } catch {
    return json(400, { error: 'body', message: 'Could not read that submission.' });
  }

  /* Honeypot: a field hidden from people, irresistible to bots. Answer 200 so
     a bot cannot tell it was caught and retry with the field left blank. */
  if (clean(body.company, 100)) return json(200, { ok: true });

  const name = clean(body.name, FIELD_LIMITS.name);
  const email = clean(body.email, FIELD_LIMITS.email).toLowerCase();
  const phone = clean(body.phone, FIELD_LIMITS.phone);

  if (!name) return json(400, { error: 'name', message: 'Please enter your name.' });
  if (!EMAIL.test(email)) {
    return json(400, { error: 'email', message: 'Please enter a valid email address.' });
  }

  const ip = (request.headers.get('cf-connecting-ip') || 'unknown').trim();
  if (await rateLimited(env.RATE_LIMIT, ip)) {
    return json(429, { error: 'rate', message: 'Too many signups from here. Try again later.' });
  }

  try {
    /* Signing up twice is a normal thing for a person to do — they forget, or
       they resubmit. Keep the first joined_at so list order stays honest, and
       take the newer name and phone in case the first attempt had a typo. */
    await env.WAITLIST.prepare(
      `INSERT INTO signups (email, name, phone, joined_at, source)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET
         name  = excluded.name,
         phone = CASE WHEN excluded.phone <> '' THEN excluded.phone ELSE signups.phone END`
    )
      .bind(email, name, phone, new Date().toISOString(), 'site')
      .run();
  } catch {
    return json(500, { error: 'store', message: 'Could not save that. Please try again.' });
  }

  return json(200, { ok: true });
}
