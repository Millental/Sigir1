import { SlideStatus } from "./api/client";

export const statusLabels: Record<SlideStatus, string> = {
  DRAFT: "Черновик",
  SUBMITTED: "На проверке",
  NEEDS_REVISION: "Требует доработки",
  IN_PRESENTATION: "В презентации",
};
