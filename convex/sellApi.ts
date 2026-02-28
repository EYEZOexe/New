type SellApiResponse<T> = {
  data: T;
};

function getSellApiToken(): string {
  const token = process.env.SELLAPP_API_TOKEN?.trim() ?? "";
  if (!token) {
    throw new Error("sell_api_token_missing");
  }
  return token;
}

async function parseSellError(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) return `sell_api_error_${response.status}`;
  try {
    const parsed = JSON.parse(text) as { message?: string };
    if (parsed.message && parsed.message.trim()) return parsed.message.trim();
    return `sell_api_error_${response.status}`;
  } catch {
    return `sell_api_error_${response.status}`;
  }
}

export async function sellRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getSellApiToken();
  const response = await fetch(`https://sell.app/api/v2${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const message = await parseSellError(response);
    throw new Error(message);
  }

  const json = (await response.json()) as SellApiResponse<T>;
  return json.data;
}
