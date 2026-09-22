# legacywealthgame.com

Static site plus one serverless function. No build step, no dependencies.

```
netlify.toml                     build config, clean URLs, security headers
assets/css/base.css              design tokens — every page loads this
legacypitch.html                Legacy Pitch tool (chrome-free QR page)
netlify/functions/pitch.js       server-side pitch generator, holds the API key
```

## Deploying

1. Push this folder to a GitHub repo.
2. Netlify → **Add new site** → **Import an existing project** → pick the repo.
   Leave the build command blank; publish directory is `.`.
3. Netlify → **Site configuration** → **Environment variables** → add:

   | Key | Value |
   |---|---|
   | `ANTHROPIC_API_KEY` | your key from console.anthropic.com |
   | `PITCH_MODEL` | optional — defaults to `claude-sonnet-4-6` |

   The key must be on an account with billing enabled. This is separate from a
   Claude subscription.
4. Netlify → **Domain management** → add `legacywealthgame.com` and follow the
   DNS instructions.

Redeploy after adding the environment variable — functions only pick up new
variables on a fresh deploy.

## The waitlist

The signup form on the homepage posts JSON to `/api/waitlist`. That endpoint
exists twice, once for each host this site has run on:

| File | Host | Store |
|---|---|---|
| `netlify/functions/waitlist.js` | Netlify | Netlify Blobs |
| `functions/api/waitlist.js` | Cloudflare Pages | D1 |

Both accept the same request and return the same responses, so the page works
unchanged on either host and nothing has to be swapped when DNS moves. The
Netlify function claims the path with `export const config = { path: ... }`;
the Cloudflare one gets it from the `functions/` directory layout.

This duplication is deliberate. The signup was rewritten to post to
`/api/waitlist` as a Cloudflare Pages Function while the domain was still
served by Netlify, which does not read that directory — so the endpoint
answered 404 and every signup was lost without anything visibly failing.

### Setup on Netlify

Netlify Blobs needs no configuration; the store is created on first write.
To download the list, set one environment variable:

| Key | Value |
|---|---|
| `WAITLIST_EXPORT_KEY` | any long random string |

Then `https://legacywealthgame.com/api/waitlist-export?key=...` returns a CSV.
Without the variable set, the export endpoint answers 404 — it never runs
unprotected.

### Setup on Cloudflare Pages

Needs a D1 database bound as `WAITLIST`, the schema in `db/waitlist-schema.sql`
run once against it, and the same `WAITLIST_EXPORT_KEY` secret.

The binding's **variable name** must be exactly `WAITLIST`, in capitals. It is
the name the function looks the database up by, and it is unrelated to what the
database itself is called — any database name is fine. A binding named
`waitlist` leaves `env.WAITLIST` undefined and the endpoint answers "The
waitlist is not configured yet." Cloudflare will not let you rename a binding
after it is created, so fixing the case means deleting it and adding it again.

Binding changes only reach a build that starts after the change. After adding
or editing one, retry the deployment or push a commit, or the running site
carries on without it.

### Checking it works

Submit the form on the live site. The page shows whatever the server says
rather than failing silently, so the message names the problem:

| Message | Meaning |
|---|---|
| "You're on the list" | Working |
| "Could not save that. Please try again." | Endpoint reached, store failed |
| "Could not reach the server…" | Endpoint not running on this host |

## Testing locally

```bash
npm install -g netlify-cli
netlify dev
```

Runs the site and the function together at `http://localhost:8888`. Create a
`.env` file with `ANTHROPIC_API_KEY=...` — and make sure `.env` is gitignored.

Opening `legacy-pitch.html` directly as a file will not work. The function only
exists when the site is served, so use `netlify dev` or a deploy preview.

## Abuse protection on the pitch endpoint

The function is the only paid thing on the site, so it has four guards:

- **Origin check** — requests must come from `legacywealthgame.com` or a
  `.netlify.app` preview. Blocks casual scraping of the endpoint.
- **Rate limits** — 6 per minute and 40 per hour per IP, plus a global ceiling
  of 600 per hour as a cost circuit breaker.
- **Input caps** — every field is truncated server-side, so bypassing the form's
  `maxlength` does not buy a longer prompt.
- **Low `max_tokens`** — 700, so even a call that slips through costs a fraction
  of a cent.

The rate limit counters live in the function container's memory. Netlify keeps a
container warm between calls, so this catches the realistic case of one script
hammering the endpoint, but a burst spread across cold starts can slip a few
extra calls through. If that ever becomes a real problem, move the counters to
Netlify's built-in rate limiting or an external store — the logic is isolated in
one block at the top of `pitch.js`.

To adjust the limits, edit `PER_IP_PER_MINUTE`, `PER_IP_PER_HOUR` and
`GLOBAL_PER_HOUR` in `netlify/functions/pitch.js`.

## Editing the pitch wording

The prompt lives in `SYSTEM_PROMPT` in `netlify/functions/pitch.js`. Changing it
changes how every pitch reads. It must keep returning the four keys `hook`,
`problem`, `solution` and `value` — the page renders one card per key and the
function rejects any other shape.

## Restyling later

Every color, typeface and corner radius is a variable at the top of
`assets/css/base.css`. When the final branding and photography arrive, edit that
block and the whole site follows. No page hardcodes a color.
