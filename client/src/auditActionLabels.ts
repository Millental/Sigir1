export const auditActionLabels: Record<string, string> = {
  LOGIN: "Вход выполнен",
  LOGIN_FAILED: "Неудачная попытка входа",
  LOGOUT: "Выход",
  TEMPLATE_CREATE: "Создание шаблона",
  TEMPLATE_UPDATE: "Изменение шаблона",
  CYCLE_CREATE: "Создание цикла",
  CYCLE_UPDATE: "Изменение цикла",
  CYCLE_ARCHIVE: "Архивирование цикла",
  USER_CREATE: "Создание пользователя",
  USER_UPDATE: "Изменение пользователя",
  USER_PASSWORD_RESET: "Сброс пароля",
  SLIDE_CREATE: "Создание слайда",
  SLIDE_SUBMIT: "Отправка слайда",
  SLIDE_APPROVE: "Утверждение слайда",
  SLIDE_REQUEST_REVISION: "Возврат слайда на доработку",
  PRESENTATION_ASSEMBLE: "Сборка презентации",
  PRESENTATION_SLIDE_ADD: "Добавление слайда в презентацию",
  PRESENTATION_PLACEHOLDER_ADD: "Добавление заглушки",
  PRESENTATION_REORDER: "Изменение порядка в презентации",
  PRESENTATION_SLIDE_REMOVE: "Удаление слайда из презентации",
  PRESENTATION_PLACEHOLDER_REMOVE: "Удаление заглушки",
  PRESENTATION_DISASSEMBLE: "Разбор презентации",
  NOTIFICATION_READ: "Прочтение уведомления",
  NOTIFICATION_READ_ALL: "Прочтение всех уведомлений",
  NOTIFICATION_HIDE: "Скрытие уведомления",
};

export function auditActionLabel(action: string): string {
  return auditActionLabels[action] ?? action;
}

export const auditTargetTypeLabels: Record<string, string> = {
  Template: "Шаблон",
  WeeklyCycle: "Цикл",
  User: "Пользователь",
  Slide: "Слайд",
  Presentation: "Презентация",
  Notification: "Уведомление",
};

export function auditTargetTypeLabel(targetType: string | null): string {
  if (!targetType) return "—";
  return auditTargetTypeLabels[targetType] ?? targetType;
}
