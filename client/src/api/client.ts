// Хост берём из текущей страницы (не хардкодим "localhost"): на Windows-машинах, где dev-сервер
// приходится поднимать на 127.0.0.1 (см. README), "localhost" и "127.0.0.1" — разные сайты для
// SameSite-кук, и жёстко прописанный "localhost" ломал бы авторизованные запросы после логина.
export const API_BASE = (import.meta as any).env?.VITE_API_BASE || `http://${window.location.hostname}:4000/api`;

async function request(path: string, options: RequestInit = {}) {
  const isFormData = options.body instanceof FormData;
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { ...(isFormData ? {} : { "Content-Type": "application/json" }), ...(options.headers || {}) },
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

export type LayoutKind = "QUADRANT" | "FINANCIAL_CHART" | "SIMPLE_COLUMN";
export type BlockType = "METRIC_TILE" | "RICH_TEXT_SECTION" | "TABLE" | "FOOTER_STATS" | "CHART_IMAGE";

export interface TemplateBlock {
  id: string;
  templateId: string;
  blockType: BlockType;
  label: string;
  isRequired: boolean;
  order: number;
  config: { columns?: string[] } | null;
}

export interface Template {
  id: string;
  name: string;
  isShared: boolean;
  version: number;
  fields: TemplateField[];
  layoutKind: LayoutKind | null;
  blocks: TemplateBlock[];
  _count?: { slides: number };
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

export interface SlideBlockValue {
  id: string;
  templateBlockId: string;
  value: unknown;
}

export interface Slide {
  id: string;
  weeklyCycleId: string;
  templateId: string;
  ownerId: string;
  status: SlideStatus;
  reviewComment: string | null;
  fieldValues: SlideFieldValue[];
  blockValues: SlideBlockValue[];
  template: Template;
  weeklyCycle: WeeklyCycle;
  owner: { id: string; fullName: string; login: string };
}

export interface PresentationSlide {
  id: string;
  order: number;
  placeholderLabel: string | null;
  slide: Slide | null;
}

export interface Presentation {
  id: string;
  weeklyCycleId: string;
  assembledAt: string;
  slides: PresentationSlide[];
}

export interface PresentationCycleView {
  weeklyCycle: WeeklyCycle;
  presentation: Presentation | null;
  candidateSlides: Slide[];
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
  createBlockTemplate: (data: {
    name: string;
    isShared: boolean;
    layoutKind: LayoutKind;
    blocks: Array<{ blockType: BlockType; label: string; isRequired: boolean; order: number; config?: { columns?: string[] } }>;
  }): Promise<Template> => request("/templates", { method: "POST", body: JSON.stringify(data) }),
  updateTemplate: (
    id: string,
    data: {
      name?: string;
      isShared?: boolean;
      fields?: Array<{ id?: string; label: string; isRequired: boolean; order: number }>;
    }
  ): Promise<Template> => request(`/templates/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  updateBlockTemplate: (
    id: string,
    data: {
      name?: string;
      isShared?: boolean;
      blocks?: Array<{
        id?: string;
        blockType: BlockType;
        label: string;
        isRequired: boolean;
        order: number;
        config?: { columns?: string[] };
      }>;
    }
  ): Promise<Template> => request(`/templates/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  listCycles: (): Promise<WeeklyCycle[]> => request("/weekly-cycles"),
  createCycle: (data: { weekLabel: string; startDate: string; endDate: string }): Promise<WeeklyCycle> =>
    request("/weekly-cycles", { method: "POST", body: JSON.stringify(data) }),
  updateCycle: (id: string, data: Partial<Pick<WeeklyCycle, "weekLabel" | "startDate" | "endDate">>): Promise<WeeklyCycle> =>
    request(`/weekly-cycles/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  archiveCycle: (id: string): Promise<WeeklyCycle> => request(`/weekly-cycles/${id}/archive`, { method: "POST" }),

  getOrCreateSlide: (weeklyCycleId: string, templateId: string): Promise<Slide> =>
    request("/slides", { method: "POST", body: JSON.stringify({ weeklyCycleId, templateId }) }),
  getSlide: (id: string): Promise<Slide> => request(`/slides/${id}`),
  updateSlideFields: (id: string, values: Array<{ templateFieldId: string; value: string }>): Promise<Slide> =>
    request(`/slides/${id}`, { method: "PATCH", body: JSON.stringify({ values }) }),
  updateSlideBlocks: (id: string, blockValues: Array<{ templateBlockId: string; value: unknown }>): Promise<Slide> =>
    request(`/slides/${id}`, { method: "PATCH", body: JSON.stringify({ blockValues }) }),
  submitSlide: (id: string): Promise<Slide> => request(`/slides/${id}/submit`, { method: "POST" }),

  listCycleSlides: (weeklyCycleId: string): Promise<Slide[]> => request(`/slides/cycle/${weeklyCycleId}`),
  approveSlide: (id: string): Promise<Slide> =>
    request(`/slides/${id}/review`, { method: "PATCH", body: JSON.stringify({ action: "approve" }) }),
  requestRevision: (id: string, comment: string): Promise<Slide> =>
    request(`/slides/${id}/review`, { method: "PATCH", body: JSON.stringify({ action: "request_revision", comment }) }),

  getPresentation: (weeklyCycleId: string): Promise<PresentationCycleView> =>
    request(`/presentations/cycle/${weeklyCycleId}`),
  addSlideToPresentation: (weeklyCycleId: string, slideId: string): Promise<Presentation> =>
    request(`/presentations/cycle/${weeklyCycleId}/slides`, { method: "POST", body: JSON.stringify({ slideId }) }),
  addPlaceholderToPresentation: (weeklyCycleId: string, label: string): Promise<Presentation> =>
    request(`/presentations/cycle/${weeklyCycleId}/placeholders`, { method: "POST", body: JSON.stringify({ label }) }),
  removePresentationSlot: (presentationSlideId: string): Promise<Presentation> =>
    request(`/presentations/slots/${presentationSlideId}`, { method: "DELETE" }),
  reorderPresentation: (weeklyCycleId: string, order: string[]): Promise<Presentation> =>
    request(`/presentations/cycle/${weeklyCycleId}/order`, { method: "PATCH", body: JSON.stringify({ order }) }),
  exportPresentationPdfUrl: (weeklyCycleId: string): string =>
    `${API_BASE}/presentations/cycle/${weeklyCycleId}/export.pdf`,
  exportSlidePdfUrl: (presentationSlideId: string): string =>
    `${API_BASE}/presentations/slots/${presentationSlideId}/export.pdf`,

  parsePptx: (file: File): Promise<{
    slides: Array<{
      index: number;
      textSnippet: string;
      layoutKind: LayoutKind;
      blocks: Array<{
        blockType: BlockType;
        label: string;
        order: number;
        config?: { columns?: string[] };
        previewImageBase64?: string;
      }>;
    }>;
  }> => {
    const fd = new FormData();
    fd.append("file", file);
    return request("/pptx-import/parse", { method: "POST", body: fd });
  },

  uploadChartImage: (
    slideId: string,
    templateBlockId: string,
    file: File
  ): Promise<{ templateBlockId: string; value: { path: string } }> => {
    const fd = new FormData();
    fd.append("file", file);
    return request(`/slides/${slideId}/blocks/${templateBlockId}/chart-image`, { method: "POST", body: fd });
  },
  deleteChartImage: (
    slideId: string,
    templateBlockId: string
  ): Promise<{ templateBlockId: string; value: { path: null } }> =>
    request(`/slides/${slideId}/blocks/${templateBlockId}/chart-image`, { method: "DELETE" }),
  chartImageUrl: (assetId: string): string => `${API_BASE}/uploads/chart-images/${assetId}`,
};
