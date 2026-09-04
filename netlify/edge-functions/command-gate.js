// netlify/edge-functions/command-gate.js
//
// Real access control for /command. Runs at the CDN edge before the static
// command.html is ever served, so an unauthenticated request never even
// sees the page. Uses standard HTTP Basic Auth, checked against a secret
// only Jordan knows.
//
// Requires env var: COMMAND_PASSWORD
//   Set in Netlify dashboard under Site configuration -> Environment
//   variables. Pick any passphrase, the longer the better. The username
//   is not checked, only the password, so anything typed for username works.
//
// Fails closed: if COMMAND_PASSWORD is not set, the page refuses to load
// at all rather than silently letting everyone in.

export default async (request, context) => {
  const expected = Netlify.env.get("COMMAND_PASSWORD");

  if (!expected) {
    return new Response(
      "Command is not password protected yet. Set COMMAND_PASSWORD in Netlify site configuration → Environment variables before using this page.",
      { status: 500 }
    );
  }

  if (isAuthorized(request.headers.get("authorization"), expected)) {
    return context.next();
  }

  return new Response("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Command", charset="UTF-8"' }
  });
};

function isAuthorized(header, expected) {
  if (!header || !header.startsWith("Basic ")) return false;
  try {
    const decoded = atob(header.slice(6));
    const sep = decoded.indexOf(":");
    const password = sep === -1 ? decoded : decoded.slice(sep + 1);
    return password === expected;
  } catch {
    return false;
  }
}

export const config = { path: ["/command", "/command.html"] };
