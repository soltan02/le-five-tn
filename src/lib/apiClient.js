// Thin fetch wrapper around the /api/* serverless functions. Every call
// normalizes to the same `{ok, ...}` / `{ok:false, error}` shape the store's
// callers already expect (matching the old localStorage version's return
// values), so page-level code barely needs to change beyond adding
// async/await.

const SESSION_KEY = "lefive.session.v1";

export function getStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function storeSession(session) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* quota / private mode — session just won't survive a reload */
  }
}

export function clearStoredSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

async function request(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  const session = getStoredSession();
  if (session?.token) headers.Authorization = `Bearer ${session.token}`;

  try {
    const res = await fetch(`/api/${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      return { ok: false, error: json?.error || `Erreur serveur (${res.status}).` };
    }
    return json;
  } catch {
    return { ok: false, error: "Connexion impossible. Vérifie ta connexion internet." };
  }
}

export function apiGet(path, params) {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
  return request(`${path}${qs}`, { method: "GET" });
}

export function apiPost(path, body) {
  return request(path, { method: "POST", body });
}
