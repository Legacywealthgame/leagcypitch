/**
 * Legacy Wealth — waitlist to Google Sheet
 *
 * Paste this into a Google Sheet's Apps Script editor and deploy it as a web
 * app. Each signup on legacywealthgame.com then appears as a row here, and a
 * second signup from the same email updates that person's row rather than
 * adding a duplicate — matching how the database behaves.
 *
 * Setup
 * -----
 * 1. Make a Google Sheet. Name it whatever you like.
 * 2. Extensions -> Apps Script. Delete whatever is in the editor and paste
 *    this file in.
 * 3. Deploy -> New deployment -> type "Web app".
 *      Execute as:      Me
 *      Who has access:  Anyone
 *    "Anyone" is required — Cloudflare calls this anonymously. The SECRET
 *    below is what actually protects it, which is why it must not be shared.
 * 4. Authorise when Google asks. The warning screen is expected for your own
 *    script: Advanced -> Go to (project name).
 * 5. Copy the deployment URL and, in Cloudflare Pages -> Settings ->
 *    Variables and Secrets, add:
 *      SHEET_WEBHOOK_URL     the URL you just copied      (Text)
 *      SHEET_WEBHOOK_SECRET  the SECRET below             (Secret)
 * 6. Retry the deployment so the variables take effect, then submit the form.
 *
 * Changing this script later needs Deploy -> Manage deployments -> edit ->
 * New version. A plain save does not update the live web app.
 */

var SECRET = 'xe00W32XIuG5Dbkx9sllxFpYfgdidwKqMIhrFpLP';

var HEADERS = ['Email', 'Name', 'Phone', 'Joined', 'Source'];

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);

    /* Constant-time-ish compare. This URL is public by necessity, so the
       secret is the only thing standing between it and a stranger's rows. */
    if (!body.secret || body.secret.length !== SECRET.length) return deny();
    var diff = 0;
    for (var i = 0; i < SECRET.length; i++) {
      diff |= body.secret.charCodeAt(i) ^ SECRET.charCodeAt(i);
    }
    if (diff !== 0) return deny();

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
      sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
      /* Phone as plain text, so a leading zero or + survives and Excel does
         not decide it is a number in scientific notation. */
      sheet.getRange('C:C').setNumberFormat('@');
    }

    var email = String(body.email || '').toLowerCase();
    if (!email) return deny();

    var row = [email, body.name || '', body.phone || '', body.joined_at || '', body.source || 'site'];

    /* Somebody signing up twice is normal. Update their row rather than
       leaving two, so this sheet keeps matching the database. */
    var existing = sheet.getLastRow() > 1
      ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues()
      : [];
    for (var r = 0; r < existing.length; r++) {
      if (String(existing[r][0]).toLowerCase() === email) {
        sheet.getRange(r + 2, 1, 1, row.length).setValues([row]);
        return ok('updated');
      }
    }

    sheet.appendRow(row);
    return ok('added');
  } catch (err) {
    return ContentService.createTextOutput('error: ' + err)
      .setMimeType(ContentService.MimeType.TEXT);
  }
}

function ok(what) {
  return ContentService.createTextOutput(what).setMimeType(ContentService.MimeType.TEXT);
}

function deny() {
  return ContentService.createTextOutput('no').setMimeType(ContentService.MimeType.TEXT);
}
