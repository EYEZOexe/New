export function getCorrelationId(request: Request): string {
  const fromHeader = request.headers.get("x-correlation-id");
  if (fromHeader && fromHeader.trim()) return fromHeader.trim();
  return crypto.randomUUID();
}

export function jsonResponse(
  body: unknown,
  init?: ResponseInit & { headers?: Record<string, string> },
): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

export function jsonError(args: {
  status: number;
  correlationId: string;
  errorCode: string;
  message: string;
}): Response {
  return jsonResponse(
    {
      ok: false,
      error_code: args.errorCode,
      message: args.message,
      correlation_id: args.correlationId,
    },
    { status: args.status },
  );
}

