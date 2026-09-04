// netlify/functions/sync-email-list.js
//
// Runs once a day. Pulls the real submission count from every Netlify Form
// on this site (today that is just "waitlist"; once the Wealth IQ Check
// quiz is deployed as its own Netlify Form, it is picked up automatically,
// no code change needed) and writes the total into Command's emailList
// metric via a POST to /.netlify/functions/state.
//
// Requires env var: NETLIFY_ACCESS_TOKEN
//   A personal access token, set in Netlify dashboard under
//   Site configuration -> Environment variables (same place as
//   ANTHROPIC_API_KEY). Generate the token itself at
//   app.netlify.com -> User settings -> Applications -> Personal access tokens.
//
// Known limitation: if someone submits both the waitlist and the quiz,
// they are counted twice. There is no shared identifier (like email) to
// de-duplicate on across separate Netlify Forms.

const SITE_ID = "b6549702-aa5e-44e1-9dc6-b538d1b00249";
const SITE_URL = "https://legacywealthgame.com";

export default async () => {
  const token = process.env.NETLIFY_ACCESS_TOKEN;
  if (!token) {
    return json({ error: "NETLIFY_ACCESS_TOKEN is not set on this site." }, 500);
  }

  let forms;
  try {
    const r = await fetch(`https://api.netlify.com/api/v1/sites/${SITE_ID}/forms`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!r.ok) {
      const detail = await r.text();
      return json({ error: "Could not list Netlify forms.", detail }, 502);
    }
    forms = await r.json();
  } catch (e) {
    return json({ error: "Could not reach the Netlify API." }, 502);
  }

  const total = (forms || []).reduce((sum, f) => sum + (f.submission_count || 0), 0);

  try {
    const r = await fetch(`${SITE_URL}/.netlify/functions/state`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        metrics: { emailList: total },
        note: `Auto-synced email list from Netlify Forms: ${total} total submission(s) across ${forms.length} form(s).`
      })
    });
    const next = await r.json();
    return json({
      ok: true,
      total,
      forms: forms.map(f => ({ name: f.name, submission_count: f.submission_count })),
      state: next
    });
  } catch (e) {
    return json({ error: "Could not write the updated count to state." }, 502);
  }
};

export const config = { schedule: "@daily" };

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" }
  });
}
