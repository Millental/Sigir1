import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, NotificationItem } from "../api/client";

function targetUrl(item: NotificationItem): string | null {
  switch (item.type) {
    case "DEADLINE_APPROACHING":
    case "NEEDS_REVISION":
      return `/slides?cycle=${item.weeklyCycleId}&template=${item.templateId}`;
    case "ALL_SUBMITTED":
      return `/review?cycle=${item.weeklyCycleId}`;
    case "CYCLE_ASSEMBLED":
      return `/presentation?cycle=${item.weeklyCycleId}`;
    case "CYCLE_ARCHIVED":
      // Заархивированная презентация недоступна SPEAKER на просмотр (см.
      // server/src/utils/presentationAccess.ts) — переход на /presentation гарантированно
      // упёрся бы в 403, так что для этого типа уведомление чисто информационное, без перехода.
      return null;
  }
}

export function NotificationBell() {
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api
      .listNotifications()
      .then((r) => {
        setItems(r.items);
        setUnreadCount(r.unreadCount);
      })
      .catch(() => {});
  }, []);

  function handleClick(item: NotificationItem) {
    if (item.kind === "PERSISTED" && item.readAt === null) {
      api.markNotificationRead(item.id).catch(() => {});
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, readAt: new Date().toISOString() } : i)));
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    setOpen(false);
    const url = targetUrl(item);
    if (url) navigate(url);
  }

  function handleHide(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    api.hideNotification(id).catch(() => {});
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function handleMarkAllRead() {
    api.markAllNotificationsRead().catch(() => {});
    setItems((prev) => prev.map((i) => (i.kind === "PERSISTED" ? { ...i, readAt: new Date().toISOString() } : i)));
    setUnreadCount(0);
  }

  return (
    <div className="notification-bell">
      <button
        className="notification-bell-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-label="Уведомления"
        type="button"
      >
        🔔
        {unreadCount > 0 && <span className="badge notification-badge">{unreadCount}</span>}
      </button>
      {open && (
        <>
          <div className="notification-backdrop" onClick={() => setOpen(false)} />
          <div className="notification-panel">
            <div className="notification-panel-header">
              <span>Уведомления</span>
              {unreadCount > 0 && (
                <button className="link" onClick={handleMarkAllRead} type="button">
                  Прочитать все
                </button>
              )}
            </div>
            {items.length === 0 && <p className="hint-text">Уведомлений нет</p>}
            <ul className="notification-list">
              {items.map((item) => (
                <li
                  key={item.id}
                  className={item.kind === "PERSISTED" && !item.readAt ? "notification-item unread" : "notification-item"}
                >
                  <button className="notification-item-body" onClick={() => handleClick(item)} type="button">
                    {item.message}
                  </button>
                  {item.kind === "PERSISTED" && (
                    <button
                      className="notification-item-hide"
                      onClick={(e) => handleHide(item.id, e)}
                      aria-label="Скрыть"
                      type="button"
                    >
                      ×
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
