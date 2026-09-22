// netlify/functions/waitlist-export.js
//
// GET /api/waitlist-export?key=SECRET
// Returns: text/csv of every signup, oldest first
//
// This exists for the ordinary case: getting the list onto your computer as a
// file you can hand to an email provider.
//
// Requires env var:
//   WAITLIST_EXPORT_KEY  the ?key= value this checks against

import { getStore } from "@netlify/blobs";

export const config = { path: "/api/waitlist-export" };

/* 404 rather than 403, so probing cannot confirm the endpoint exists. */
function deny() {
  return new Response("Not found", { status: 404 });
}

/* Constant-time compare. A plain === leaks the key one character at a time to
   anyone willing to measure how long the answer took. */
function sameSecret(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function csvCell(value) {
  const s = String(value ?? "");
  /* A leading =, +, - or @ makes a spreadsheet treat the cell as a formula, so
     a signup could run something on the machine that opens the file. Prefix a
     quote to keep it text; it stays readable and inert. */
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export default async (req) => {
  const expected = process.env.WAITLIST_EXPORT_KEY;
  if (!expected) return deny();

  const key = new URL(req.url).searchParams.get("key") || "";
  if (!sameSecret(key, expected)) return deny();

  const store = getStore("waitlist");
  const { blobs } = await store.list();

  const rows = await Promise.all(
    blobs.map((blob) => store.get(blob.key, { type: "json" }).catch(() => null))
  );

  const signups = rows
    .filter(Boolean)
    .sort((a, b) => String(a.joined_at).localeCompare(String(b.joined_at)));

  const header = ["email", "name", "phone", "joined_at", "source"];
  const lines = [header.join(",")];
  for (const row of signups) {
    lines.push(header.map((column) => csvCell(row[column])).join(","));
  }

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(lines.join("\r\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="waitlist-${stamp}.csv"`,
      "cache-control": "no-store",
      "x-robots-tag": "noindex"
    }
  });
};
