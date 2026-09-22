// netlify/functions/waitlist.js
//
// POST /api/waitlist
// Body: { name, email, phone, company }   (company is the honeypot)
// Returns: { ok: true }
//
// The signup page was moved onto a Cloudflare Pages Function at /api/waitlist
// while the site itself is still served by Netlify. Netlify does not read the
// functions/ directory that Cloudflare uses, so that path answered 404 and
// every signup was lost at the door. This is the same endpoint, same request
// and response shape, implemented where this site actually runs.
//
// Storage is Netlify Blobs — already a dependency, and already how
// state.js persists data for this site. One blob per signup, keyed by the
// lowercased email, so signing up twice updates the row instead of adding a
// second one.
//
// Optional env var:
//   WAITLIST_EXPORT_KEY  only used by waitlist-export.js

import { getStore } from "@netlify/blobs";

export const config = { path: "/api/waitlist" };

const FIELD_LIMITS = { name: 120, email: 254, phone: 40 };

/* Deliberately permissive. The job is to catch a typo or a junk string, not to
   adjudicate the email RFCs — a real address wrongly rejected is a lost
   customer, which costs more than a bad row. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" }
  });
}

function clean(value, limit) {
  if (typeof value !== "string") return "";
  return value.replace(/[\x00-\x1F\x7F]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

/* Best effort only, and deliberately so. The counters live in this container's
   memory, so a burst spread across cold starts slips through — but nothing paid
   sits behind this endpoint, and a missing counter must never be a reason to
   drop a real signup. */
const seen = new Map();
function rateLimited(ip) {
  const hour = Math.floor(Date.now() / 3600000);
  const key = `${ip}:${hour}`;
  const count = seen.get(key) || 0;
  if (count >= 12) return true;
  seen.set(key, count + 1);
  if (seen.size > 5000) seen.clear();
  return false;
}

export default async (req) => {
  if (req.method !== "POST") {
    return json(405, { error: "method", message: "Use POST to join the waitlist." });
  }

  let body;
  const type = req.headers.get("content-type") || "";
  try {
    if (type.includes("application/json")) {
      body = await req.json();
    } else {
      body = Object.fromEntries((await req.formData()).entries());
    }
  } catch {
    return json(400, { error: "body", message: "Could not read that submission." });
  }

  /* Honeypot: a field hidden from people, irresistible to bots. Answer 200 so a
     bot cannot tell it was caught and retry with the field left blank. */
  if (clean(body.company, 100)) return json(200, { ok: true });

  const name = clean(body.name, FIELD_LIMITS.name);
  const email = clean(body.email, FIELD_LIMITS.email).toLowerCase();
  const phone = clean(body.phone, FIELD_LIMITS.phone);

  if (!name) return json(400, { error: "name", message: "Please enter your name." });
  if (!EMAIL.test(email)) {
    return json(400, { error: "email", message: "Please enter a valid email address." });
  }

  const ip = (req.headers.get("x-nf-client-connection-ip") ||
              req.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
  if (rateLimited(ip)) {
    return json(429, { error: "rate", message: "Too many signups from here. Try again later." });
  }

  try {
    const store = getStore("waitlist");

    /* Signing up twice is a normal thing for a person to do — they forget, or
       they resubmit. Keep the first joined_at so list order stays honest, and
       take the newer name and phone in case the first attempt had a typo. */
    const existing = await store.get(email, { type: "json" });
    await store.setJSON(email, {
      email,
      name,
      phone: phone || existing?.phone || "",
      joined_at: existing?.joined_at || new Date().toISOString(),
      source: "site"
    });
  } catch (err) {
    console.error("waitlist: could not write to blobs", err);
    return json(500, { error: "store", message: "Could not save that. Please try again." });
  }

  return json(200, { ok: true });
};
