export const API_BASE =
  import.meta.env.DEV ? "http://127.0.0.1:8787/api" : "/api";

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    throw new Error(errorBody?.error?.message ?? "request failed");
  }

  return (await response.json()) as T;
}
