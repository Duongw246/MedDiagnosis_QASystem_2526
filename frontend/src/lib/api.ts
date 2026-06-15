const DEFAULT_BACKEND_URL = "http://localhost:8000";

export function getBackendUrl(backendUrl?: string): string {
  const resolved = backendUrl || process.env.NEXT_PUBLIC_BACKEND_URL || DEFAULT_BACKEND_URL;
  return resolved.replace(/\/$/, "");
}

export function buildApiUrl(endpoint: string, backendUrl?: string): string {
  if (/^https?:\/\//i.test(endpoint)) {
    return endpoint;
  }
  const base = getBackendUrl(backendUrl);
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${base}${normalizedEndpoint}`;
}

export function extractApiErrorMessage(
  payload: unknown,
  fallbackMessage: string,
  statusCode?: number,
): string {
  if (payload && typeof payload === "object") {
    const data = payload as Record<string, unknown>;
    const detail = data.detail;
    const error = data.error;
    const message = data.message;

    if (typeof detail === "string" && detail.trim()) return detail;
    if (typeof error === "string" && error.trim()) return error;
    if (typeof message === "string" && message.trim()) return message;
  }

  if (statusCode) {
    return `${fallbackMessage} (HTTP ${statusCode})`;
  }
  return fallbackMessage;
}

async function parseJsonSafe(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit & { backendUrl?: string; fallbackError?: string } = {},
): Promise<T> {
  const { backendUrl, fallbackError = "Yêu cầu thất bại", ...fetchOptions } = options;
  const url = buildApiUrl(endpoint, backendUrl);
  const response = await fetch(url, fetchOptions);
  const payload = await parseJsonSafe(response);

  if (!response.ok) {
    throw new Error(extractApiErrorMessage(payload, fallbackError, response.status));
  }

  return payload as T;
}

export async function fetchAvailableModels(backendUrl?: string): Promise<string[]> {
  const payload = await apiRequest<{ weights?: unknown }>("/models/weights", {
    backendUrl,
    fallbackError: "Không thể tải danh sách model",
  });

  return Array.isArray(payload?.weights)
    ? payload.weights.filter((item): item is string => typeof item === "string")
    : [];
}

export async function approveHistoryItem(id: number | string, backendUrl?: string): Promise<void> {
  await apiRequest(`/history/${id}/approve`, {
    backendUrl,
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    fallbackError: "Phê duyệt thất bại",
  });
}
