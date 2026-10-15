/**
 * Centralised API client.
 *
 * - Same-origin by default (VITE_API_BASE_URL empty), exactly like the original site.
 * - Always sends cookies (`credentials: "include"`) because authentication is a session cookie.
 * - Never throws for HTTP errors in `request()`; `api()` throws `ApiError` for non-2xx.
 * - Does not assume bodies are JSON: it reads text first, like the original `readJsonResponse`.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly data: Record<string, unknown>;
  constructor(message: string, status: number, data: Record<string, unknown> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export const NETWORK_ERROR_MESSAGE = "Unable to connect right now. Check your connection and try again.";

export function apiBase(): string {
  const base = import.meta.env.VITE_API_BASE_URL?.trim() ?? "";
  return base.replace(/\/+$/, "");
}

export function apiUrl(path: string): string {
  return `${apiBase()}${path}`;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** JSON body (sets Content-Type). */
  json?: unknown;
  /** Multipart body (the browser sets the boundary). */
  form?: FormData;
  signal?: AbortSignal;
}

export interface ApiResult<T = Record<string, any>> {
  ok: boolean;
  status: number;
  data: T;
}

/** Parse a response body defensively. Mirrors the original `readJsonResponse` messages. */
export async function readBody(response: Response): Promise<Record<string, any>> {
  const text = await response.text();
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? parsed : { value: parsed };
  } catch {
    const isHtml = response.headers.get("content-type")?.includes("text/html");
    throw new ApiError(
      isHtml
        ? `The server returned an HTML error (HTTP ${response.status}). Check the backend logs and try again.`
        : `The server returned an invalid response (HTTP ${response.status}).`,
      response.status,
    );
  }
}

export async function request<T = Record<string, any>>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {};
  let body: BodyInit | undefined;
  if (options.form) {
    body = options.form;
  } else if (options.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.json);
  }

  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      method: options.method ?? (body ? "POST" : "GET"),
      credentials: "include",
      headers,
      body,
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(NETWORK_ERROR_MESSAGE, 0);
  }

  const data = (await readBody(response)) as T;
  return { ok: response.ok, status: response.status, data };
}

export async function api<T = Record<string, any>>(
  path: string,
  options: RequestOptions & { fallbackMessage?: string } = {},
): Promise<T> {
  const result = await request<T>(path, options);
  if (!result.ok) {
    const data = result.data as Record<string, unknown>;
    const message =
      (typeof data?.error === "string" && data.error) ||
      options.fallbackMessage ||
      `Request failed (HTTP ${result.status}).`;
    throw new ApiError(message, result.status, data);
  }
  return result.data;
}

export function errorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
