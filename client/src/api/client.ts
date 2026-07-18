// Хост берём из текущей страницы (не хардкодим "localhost"): на Windows-машинах, где dev-сервер
// приходится поднимать на 127.0.0.1 (см. README), "localhost" и "127.0.0.1" — разные сайты для
// SameSite-кук, и жёстко прописанный "localhost" ломал бы авторизованные запросы после логина.
const API_BASE = (import.meta as any).env?.VITE_API_BASE || `http://${window.location.hostname}:4000/api`;

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

export interface TemplateField {
  id: string;
  templateId: string;
  label: string;
  isRequired: boolean;
  order: number;
}

export interface Template {
  id: string;
  name: string;
  isShared: boolean;
  version: number;
  fields: TemplateField[];
}

export type WeeklyCycleStatus = "COLLECTING" | "ASSEMBLED" | "ARCHIVED";

export interface WeeklyCycle {
  id: string;
  weekLabel: string;
  startDate: string;
  endDate: string;
  status: WeeklyCycleStatus;
}

export type SlideStatus = "DRAFT" | "SUBMITTED" | "NEEDS_REVISION" | "IN_PRESENTATION";

export interface SlideFieldValue {
  id: string;
  templateFieldId: string;
  value: string;
}

export interface Slide {
  id: string;
  weeklyCycleId: string;
  templateId: string;
  ownerId: string;
  status: SlideStatus;
  reviewComment: string | null;
  fieldValues: SlideFieldValue[];
  template: Template;
  weeklyCycle: WeeklyCycle;
  owner: { id: string; fullName: string; login: string };
}

export const api = {
  login: (login: string, password: string): Promise<CurrentUser> =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ login, password }) }),
  logout: () => request("/auth/logout", { method: "POST" }),
  me: (): Promise<CurrentUser> => request("/auth/me"),
  listUsers: () => request("/users"),
  createUser: (data: { fullName: string; login: string; role: "ADMIN" | "SPEAKER" }) =>
    request("/users", { method: "POST", body: JSON.stringify(data) }),

  listTemplates: (): Promise<Template[]> => request("/templates"),
  getTemplate: (id: string): Promise<Template> => request(`/templates/${id}`),
  createTemplate: (data: {
    name: string;
    isShared: boolean;
    fields: Array<{ label: string; isRequired: boolean; order: number }>;
  }): Promise<Template> => request("/templates", { method: "POST", body: JSON.stringify(data) }),
  updateTemplate: (
    id: string,
    data: {
      name?: string;
      isShared?: boolean;
      fields?: Array<{ id?: string; label: string; isRequired: boolean; order: number }>;
    }
  ): Promise<Template> => request(`/templates/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  listCycles: (): Promise<WeeklyCycle[]> => request("/weekly-cycles"),
  createCycle: (data: { weekLabel: string; startDate: string; endDate: string }): Promise<WeeklyCycle> =>
    request("/weekly-cycles", { method: "POST", body: JSON.stringify(data) }),
  updateCycle: (id: string, data: Partial<Pick<WeeklyCycle, "weekLabel" | "startDate" | "endDate" | "status">>): Promise<WeeklyCycle> =>
    request(`/weekly-cycles/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  getOrCreateSlide: (weeklyCycleId: string, templateId: string): Promise<Slide> =>
    request("/slides", { method: "POST", body: JSON.stringify({ weeklyCycleId, templateId }) }),
  getSlide: (id: string): Promise<Slide> => request(`/slides/${id}`),
  updateSlide: (id: string, values: Array<{ templateFieldId: string; value: string }>): Promise<Slide> =>
    request(`/slides/${id}`, { method: "PATCH", body: JSON.stringify({ values }) }),
  submitSlide: (id: string): Promise<Slide> => request(`/slides/${id}/submit`, { method: "POST" }),

  listCycleSlides: (weeklyCycleId: string): Promise<Slide[]> => request(`/slides/cycle/${weeklyCycleId}`),
  approveSlide: (id: string): Promise<Slide> =>
    request(`/slides/${id}/review`, { method: "PATCH", body: JSON.stringify({ action: "approve" }) }),
  requestRevision: (id: string, comment: string): Promise<Slide> =>
    request(`/slides/${id}/review`, { method: "PATCH", body: JSON.stringify({ action: "request_revision", comment }) }),
};
