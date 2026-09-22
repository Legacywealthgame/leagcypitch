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

   Optional, for a notification email on each new signup. Leave either unset
   and notifications are simply skipped:
     RESEND_API_KEY      a Resend API key
     NOTIFY_EMAIL        where to send it; separate several with commas
     NOTIFY_FROM         optional sender; defaults to Resend's shared address

   Optional, to mirror each signup into a Google Sheet. Leave either unset and
   the mirror is skipped:
     SHEET_WEBHOOK_URL     the Apps Script web app URL (see docs/sheet-sync.gs)
     SHEET_WEBHOOK_SECRET  shared token that URL checks before writing
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

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/* Mirror the signup into a Google Sheet.

   Same posture as the notification below: it runs after the row is stored, is
   handed to waitUntil rather than awaited, and a failure is logged and
   dropped. The sheet is a convenience copy — D1 is the record — so a Google
   outage must never cost a signup.

   The receiving end is an Apps Script web app, which is a public URL, hence
   the shared secret. Sending it in the body rather than the query string
   keeps it out of Google's request logs. */
function toSheet(env, waitUntil, signup) {
  const url = env.SHEET_WEBHOOK_URL;
  const secret = env.SHEET_WEBHOOK_SECRET;
  if (!url || !secret) return;

  const send = fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, ...signup })
  })
    .then(async (response) => {
      /* Apps Script answers 302 to its own redirect chain and fetch follows it,
         so only a non-ok final response is worth shouting about. */
      if (!response.ok) {
        console.error('waitlist sheet failed', response.status, (await response.text()).slice(0, 200));
      }
    })
    .catch((err) => console.error('waitlist sheet threw', err));

  if (typeof waitUntil === 'function') waitUntil(send);
}

/* Tell the owner a signup came in.

   Deliberately fire-and-forget. The person has already been written to the
   database by the time this runs, so a slow or broken mail provider must not
   delay their response and must never turn a saved signup into an error on
   their screen. Everything here is wrapped, and a failure is logged and
   dropped. */
function notify(env, waitUntil, signup, position) {
  const key = env.RESEND_API_KEY;
  /* One address or several. Commas, semicolons and spaces all separate, so a
     value pasted from a contacts app works without reformatting. */
  const to = String(env.NOTIFY_EMAIL || '')
    .split(/[,;\s]+/)
    .map((address) => address.trim())
    .filter(Boolean)
    .slice(0, 50);                    /* Resend's per-message ceiling */
  if (!key || !to.length) return;     /* not set up: nothing to do */

  const place = position ? ` &middot; signup #${position}` : '';
  const body = {
    from: env.NOTIFY_FROM || 'Legacy Wealth <onboarding@resend.dev>',
    to,
    subject: `New waitlist signup: ${signup.name}`,
    html:
      `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:#1a1a1c">` +
      `<p style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#8B6F2E;margin:0 0 14px">` +
      `Legacy Wealth waitlist${place}</p>` +
      `<p style="margin:0 0 6px"><strong>${escapeHtml(signup.name)}</strong></p>` +
      `<p style="margin:0 0 6px">${escapeHtml(signup.email)}</p>` +
      (signup.phone ? `<p style="margin:0 0 6px">${escapeHtml(signup.phone)}</p>` : '') +
      `<p style="margin:16px 0 0;font-size:13px;color:#6b6b6e">${escapeHtml(signup.joined_at)}</p>` +
      `</div>`
  };

  const send = fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
    .then(async (response) => {
      if (!response.ok) {
        console.error('waitlist notify failed', response.status, await response.text());
      }
    })
    .catch((err) => console.error('waitlist notify threw', err));

  /* waitUntil keeps the worker alive for the send without holding up the
     response. Not every runtime provides it, so fall back to letting the
     promise run loose rather than awaiting it. */
  if (typeof waitUntil === 'function') waitUntil(send);
}

export async function onRequestPost({ request, env, waitUntil }) {
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

  const joined_at = new Date().toISOString();

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
      .bind(email, name, phone, joined_at, 'site')
      .run();
  } catch {
    return json(500, { error: 'store', message: 'Could not save that. Please try again.' });
  }

  /* Only after the row is safely stored. A count is nice to have in the email
     and cheap to read, but it must not be able to fail the request either. */
  let position = 0;
  try {
    const row = await env.WAITLIST.prepare('SELECT COUNT(*) AS n FROM signups').first();
    position = (row && row.n) || 0;
  } catch { /* count is decoration; carry on without it */ }

  const signup = { name, email, phone, joined_at, source: 'site' };
  toSheet(env, waitUntil, signup);
  notify(env, waitUntil, signup, position);

  return json(200, { ok: true });
}
