import type { Doc } from "./_generated/dataModel";

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function parseBearerToken(value: string | null): string | null {
  if (!value) return null;
  const match = /^\s*bearer\s+(.+?)\s*$/i.exec(value);
  if (!match) return null;
  const token = match[1]?.trim();
  return token ? token : null;
}

export type ConnectorAuthResult = {
  connector: Doc<"connectors">;
};

export async function computeConnectorTokenHashFromRequest(
  request: Request,
): Promise<string | null> {
  const token = parseBearerToken(request.headers.get("authorization"));
  if (!token) return null;
  return await sha256Hex(token);
}
