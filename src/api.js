import { API_URL } from "./config";

export class ApiError extends Error {
  constructor(message, status, payload = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

function humanizeApiFailure(status, payload, path) {
  const backendMessage = payload?.error || payload?.message;

  if (status === 404 && path.startsWith("/v1/public/holder/")) {
    return "The CLOUT holder login API is not available on the deployed backend. Railway is still serving a backend without the holder auth routes.";
  }

  if (backendMessage && backendMessage !== "Not Found") {
    return backendMessage;
  }

  if (status === 401) return "Your CLOUT login has expired. Connect your wallet again.";
  if (status === 403) return "This request was rejected by the CLOUT backend.";
  if (status === 429) return "Too many requests. Try again shortly.";
  if (status >= 500) return "The CLOUT backend is temporarily unavailable.";
  return `CLOUT API request failed (${status}).`;
}

export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });
  } catch (error) {
    throw new ApiError(
      "Could not reach the CLOUT backend. Check the Railway service and frontend CORS origin.",
      0,
      { cause: error instanceof Error ? error.message : String(error) },
    );
  }

  const contentType = response.headers.get("content-type") || "";
  let payload = null;
  if (contentType.includes("application/json")) {
    payload = await response.json().catch(() => null);
  } else {
    const text = await response.text().catch(() => "");
    payload = text ? { message: text } : null;
  }

  if (!response.ok) {
    throw new ApiError(humanizeApiFailure(response.status, payload, path), response.status, payload);
  }

  return payload;
}

export function authHeaders(sessionToken) {
  return sessionToken
    ? { Authorization: `Bearer ${sessionToken}` }
    : {};
}

export function getPublicContent() {
  return api("/v1/public/content", { method: "GET" });
}

export function getBackendVersion() {
  return api("/v1/public/version", { method: "GET" });
}

export function createHolderChallenge(walletAddress) {
  return api("/v1/public/holder/challenge", {
    method: "POST",
    body: JSON.stringify({ walletAddress }),
  });
}

export function verifyHolderChallenge(payload) {
  return api("/v1/public/holder/verify", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getHolderSession(sessionToken) {
  return api("/v1/public/holder/session", {
    method: "GET",
    headers: authHeaders(sessionToken),
  });
}

export function getHolderDashboard(sessionToken) {
  return api("/v1/public/holder/dashboard", {
    method: "GET",
    headers: authHeaders(sessionToken),
  });
}

export function updateHolderPreferences(sessionToken, payoutPreference) {
  return api("/v1/public/holder/preferences", {
    method: "PATCH",
    headers: authHeaders(sessionToken),
    body: JSON.stringify({ payoutPreference }),
  });
}

export function logoutHolder(sessionToken) {
  return api("/v1/public/holder/logout", {
    method: "POST",
    headers: authHeaders(sessionToken),
  });
}
