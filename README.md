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
