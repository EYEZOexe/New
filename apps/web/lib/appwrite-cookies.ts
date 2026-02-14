export function extractCookieValue(setCookieHeader: string, nameStartsWith: string): string | null {
  // A single Set-Cookie header value looks like:
  //   a_session_<projectId>=<value>; Path=/; HttpOnly; Secure; SameSite=None
  // We only need the cookie VALUE.
  const firstPart = setCookieHeader.split(";")[0] ?? "";
  const eqIndex = firstPart.indexOf("=");
  if (eqIndex === -1) return null;
  const name = firstPart.slice(0, eqIndex);
  const value = firstPart.slice(eqIndex + 1);
  if (!name.startsWith(nameStartsWith)) return null;
  return value || null;
}

