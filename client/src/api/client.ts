const API_BASE = (import.meta as any).env?.VITE_API_BASE || "http://localhost:4000/api";

async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Ошибка запроса: ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

export interface CurrentUser {
  id: string;
  fullName: string;
  role: "ADMIN" | "SPEAKER";
  login: string;
}

export const api = {
  login: (login: string, password: string): Promise<CurrentUser> =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ login, password }) }),
  logout: () => request("/auth/logout", { method: "POST" }),
  me: (): Promise<CurrentUser> => request("/auth/me"),
  listUsers: () => request("/users"),
  createUser: (data: { fullName: string; login: string; role: "ADMIN" | "SPEAKER" }) =>
    request("/users", { method: "POST", body: JSON.stringify(data) }),
};
