# Legacy Wealth — developer handoff

Static site plus a few Cloudflare Pages Functions. No build step, no
framework, no bundler. `index.html` is one file containing its own CSS and
JS. Edit it and push; Cloudflare rebuilds and deploys.

Preorders open **8 November 2026**. The waitlist is live and collecting real
signups today, so treat `/api/waitlist` as production.

---

## 1. Where it runs

**Cloudflare Pages**, project `leagcypitch`, serving `legacywealthgame.com`.
Deploys on push to `main`.

**The `netlify/` directory is dead code.** It is a parallel implementation of
the same endpoints from when the site was on Netlify. Nothing in it runs.
`package.json` depends on `@netlify/blobs` only because of it. Safe to delete
the whole directory and that dependency; left in place only because deleting
it was never the priority.

One genuine exception: `/command` and `/command.html` still redirect to
`join.legacywealthgame.com`, because that dashboard is gated by a Netlify
edge function. Serving a copy from Cloudflare would publish it with no
password. See `_redirects`, which explains this inline.

## 2. Layout

```
index.html                     the homepage: markup, CSS and JS in one file
functions/api/waitlist.js      POST — the signup endpoint
functions/api/waitlist-export.js   GET — CSV of every signup
functions/api/pitch.js         POST — powers legacypitch.html
db/waitlist-schema.sql         the signups table
docs/sheet-sync.gs             Apps Script that receives the Sheet webhook
assets/images/                 ~36 files, about 4 MB
careers/ habits/ wealthiq/     220 static pages reached by QR code from cards
_redirects  _headers           Cloudflare routing and security headers
netlify/                       dead, see above
```

## 3. How a signup flows

`POST /api/waitlist` with `{name, email, phone, company}`.

1. `company` is a honeypot. If filled, the endpoint returns **200** so bots
   cannot detect the rejection, and saves nothing.
2. Writes to D1. Upsert on email, so a repeat signup updates rather than
   duplicates, and keeps a phone number already on file if the new one is
   blank.
3. **Only after the write succeeds**, two fire-and-forget side effects run
   through `waitUntil`: a row to the Google Sheet, and an email via Resend.

Both side effects are deliberately non-blocking and non-fatal. A slow or
broken mail provider can never delay a signup or turn a saved one into an
error on the visitor's screen. The tradeoff: if the Sheet write or the email
fails, it fails **silently**. D1 is the source of truth; the Sheet is a
convenience view and the email is a notification. Deletions never sync.

Error strings are deliberately distinct so a failure names itself:

| What the visitor sees | What is actually wrong |
|---|---|
| "The waitlist is not configured yet." | the `WAITLIST` D1 binding is missing |
| "Could not save that." | binding exists, the table does not |
| "Could not reach the server." | wrong host, or not deployed |

## 4. Environment variables

Set on the Pages project under Settings → Variables and Secrets. **Values are
not in this document** — get them from the owner.

| Name | Type | Used by | Required |
|---|---|---|---|
| `WAITLIST` | D1 binding | waitlist, export | yes |
| `RESEND_API_KEY` | secret | waitlist | for email |
| `NOTIFY_EMAIL` | text | waitlist | for email |
| `NOTIFY_FROM` | text | waitlist | optional |
| `SHEET_WEBHOOK_URL` | text | waitlist | for the Sheet |
| `SHEET_WEBHOOK_SECRET` | secret | waitlist | for the Sheet |
| `WAITLIST_EXPORT_KEY` | secret | export | for CSV export |
| `ANTHROPIC_API_KEY` | secret | pitch | for legacypitch |
| `PITCH_MODEL`, `PITCH_DAILY_CAP`, `RATE_LIMIT` | text | pitch | optional |

`NOTIFY_EMAIL` accepts several addresses separated by commas, semicolons or
spaces, capped at 50.

`NOTIFY_FROM` must be an address on a domain **verified in Resend**. Set it to
an unverified domain and Resend rejects every send, which presents as mail
silently not arriving rather than as an error. Unset, it falls back to
Resend's shared sender, which only delivers to the Resend account holder.

## 5. Two traps that have already cost this project a day each

**Binding names are case-sensitive and cannot be renamed.** The D1 binding was
created as lowercase `waitlist`; the code reads `env.WAITLIST`, so it was
`undefined` and every signup failed with "not configured yet" for weeks.
Cloudflare offers no rename — delete the binding and add it again.

**Variables only apply to builds started after they are saved.** Saving a
variable changes nothing until a fresh build runs. Retry deployment hides
behind a hover-only `⋯` at the right edge of a deployment row; pushing any
commit is the reliable way to trigger one.

## 6. Open items

- **`WAITLIST_EXPORT_KEY` does not currently work.** `/api/waitlist-export`
  returns 404 with the key on file. The endpoint returns 404 rather than 403
  for wrong keys deliberately, so the list is not discoverable by probing —
  which also means a wrong key and a missing endpoint look identical. Delete
  the variable and re-add it to fix.
- **Rotate the export key before launch.** It has been shared in plain text
  in a chat transcript. Anyone with it can download every name, email and
  phone number.
- **`netlify/functions/sync-email-list.js` is doubly stale**: it reads Netlify
  Forms, which this site no longer uses, and it is a Netlify function on a
  Cloudflare host. Delete it.
- **No lifestyle photography.** The "Who It Is For" section names its
  audiences but has no photograph of anyone playing. It is the weakest part
  of the page and the highest-leverage thing to fix.
- **The hero product shot is a composite of flat artwork**, not a photograph.
  The box has no real thickness and the cards no edges. Replace it with a
  real render or photo when one exists.

## 7. Unmerged work

Branch **`claude/brave-goldberg-5yfh5t`** holds a full homepage rebuild that
is **not live**: a product-led hero with a staged shot, the page reordered
around a customer journey, the gameplay mechanics as a grid, a sticky mobile
CTA, and a contents section. It is self-contained in `index.html` plus a few
images. Review it before continuing on `main`, or you will duplicate work.

`assets/images/hero-room.webp` on that branch is a study background supplied
by the owner for the next hero pass. Nothing references it yet.
