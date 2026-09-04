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

export default async (req) => {
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
