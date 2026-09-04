// netlify/functions/state.js
//
// The persistent memory for the Venture Legacy agent team.
// GET  /.netlify/functions/state          -> current state
// POST /.netlify/functions/state          -> update metrics, tracks, or log
//
// Data lives in Netlify Blobs, attached to the site, not to any chat session.
// Seeded from state.json in the repo root the first time it runs.

import { getStore } from "@netlify/blobs";
import seed from "../../state.json" with { type: "json" };

// Same shared secret the /command edge gate checks. Accepts either a
// browser's cached Basic Auth credentials (after logging into /command) or
// the exact same header sent server-to-server, e.g. by sync-email-list.js.
function isAuthorized(req) {
  const expected = process.env.COMMAND_PASSWORD;
  if (!expected) return false;
  const header = req.headers.get("authorization");
  if (!header || !header.startsWith("Basic ")) return false;
  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const sep = decoded.indexOf(":");
    const password = sep === -1 ? decoded : decoded.slice(sep + 1);
    return password === expected;
  } catch {
    return false;
  }
}

export default async (req) => {
  if (!isAuthorized(req)) {
    return new Response("Authentication required.", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Command", charset="UTF-8"' }
    });
  }

  const store = getStore("venture-legacy");

  if (req.method === "GET") {
    const saved = await store.get("state", { type: "json" });
    return json(saved || seed);
  }

  if (req.method === "POST") {
    let incoming;
    try {
      incoming = await req.json();
    } catch (e) {
      return json({ error: "That update was not valid JSON." }, 400);
    }

    const current = (await store.get("state", { type: "json" })) || seed;
    const now = new Date().toISOString();

    // Merge metrics
    const metrics = { ...current.metrics, ...(incoming.metrics || {}), lastUpdated: now };

    // Merge track status changes by id
    let tracks = current.tracks;
    if (Array.isArray(incoming.tracks)) {
      tracks = current.tracks.map(t => {
        const update = incoming.tracks.find(u => u.id === t.id);
        return update ? { ...t, ...update } : t;
      });
    }

    // Append to the log so agents can see what changed
    const log = [...(current.log || [])];
    if (incoming.note) {
      log.push({ at: now, note: incoming.note });
    }

    const next = {
      ...current,
      metrics,
      tracks,
      openQuestions: incoming.openQuestions || current.openQuestions,
      log: log.slice(-100)
    };

    await store.setJSON("state", next);
    return json(next);
  }

  return json({ error: "Use GET to read state or POST to update it." }, 405);
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" }
  });
}
