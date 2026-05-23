type AnyRecord = Record<string, unknown>;

function sanitizeHeaders(headers: AnyRecord | undefined): AnyRecord | null {
  if (!headers || typeof headers !== "object") return null;
  const redacted = new Set([
    "authorization",
    "cookie",
    "set-cookie",
    "x-api-key",
    "appkey",
    "appsecret",
    "api-secret",
  ]);
  const out: AnyRecord = {};
  for (const [k, v] of Object.entries(headers)) {
    out[k] = redacted.has(String(k).toLowerCase()) ? "[REDACTED]" : v;
  }
  return out;
}

function toSafeJson(value: unknown): unknown {
  if (value == null) return value;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
  }
}

export function extractErrorDiagnostics(error: unknown): AnyRecord {
  const e = error as any;
  const response = e?.response;
  const config = e?.config;
  const request = e?.request;

  const diagnostics: AnyRecord = {
    name: e?.name ?? null,
    message: e?.message ?? String(error),
    code: e?.code ?? null,
    status: response?.status ?? e?.status ?? null,
    statusText: response?.statusText ?? null,
    isAxiosError: Boolean(e?.isAxiosError),
    stack: typeof e?.stack === "string" ? e.stack.split("\n").slice(0, 8).join("\n") : null,
    responseData: toSafeJson(response?.data),
    responseHeaders: sanitizeHeaders(response?.headers as AnyRecord | undefined),
    request: request
      ? {
          method: request?.method ?? config?.method ?? null,
          path: request?.path ?? null,
        }
      : null,
    requestConfig: config
      ? {
          method: config?.method ?? null,
          url: config?.url ?? null,
          baseURL: config?.baseURL ?? null,
          timeout: config?.timeout ?? null,
          headers: sanitizeHeaders(config?.headers as AnyRecord | undefined),
        }
      : null,
    at: new Date().toISOString(),
  };

  if (typeof e?.toJSON === "function") {
    diagnostics.toJSON = toSafeJson(e.toJSON());
  }

  return diagnostics;
}
