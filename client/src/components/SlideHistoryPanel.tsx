import { useState } from "react";
import { api, SlideHistoryItem } from "../api/client";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function chartImagePathOf(value: unknown): string | null {
  if (value && typeof value === "object" && "path" in value) {
    const path = (value as { path: unknown }).path;
    return typeof path === "string" ? path : null;
  }
  return null;
}

function chartImageEventText(item: SlideHistoryItem): string {
  const hadOld = chartImagePathOf(item.oldValue) !== null;
  const hasNew = chartImagePathOf(item.newValue) !== null;
  if (!hadOld && hasNew) return "изображение загружено";
  if (hadOld && hasNew) return "изображение заменено";
  if (hadOld && !hasNew) return "изображение удалено";
  return "изменение изображения";
}

function renderValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value || "—";
  return JSON.stringify(value);
}

export function SlideHistoryPanel({ slideId }: { slideId: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SlideHistoryItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleToggle() {
    if (!open && items === null) {
      setLoading(true);
      setError(null);
      api
        .getSlideHistory(slideId)
        .then((r) => setItems(r.items))
        .catch((err) => setError(err instanceof Error ? err.message : "Не удалось загрузить историю"))
        .finally(() => setLoading(false));
    }
    setOpen((o) => !o);
  }

  return (
    <div className="slide-history-panel">
      <button type="button" className="secondary" onClick={handleToggle}>
        {open ? "Скрыть историю изменений" : "Показать историю изменений"}
      </button>
      {open && (
        <div className="slide-history-list">
          {loading && <p className="hint-text">Загрузка истории…</p>}
          {error && <p className="error-text">{error}</p>}
          {items && items.length === 0 && <p className="hint-text">Изменений пока не было.</p>}
          {items && items.length > 0 && (
            <ul>
              {items.map((item, i) => (
                <li key={i} className="slide-history-item">
                  <div className="slide-history-item-label">{item.label}</div>
                  {item.kind === "block" && item.blockType === "CHART_IMAGE" ? (
                    <div className="slide-history-item-value">{chartImageEventText(item)}</div>
                  ) : (
                    <div className="slide-history-item-value">
                      {renderValue(item.oldValue)} → {renderValue(item.newValue)}
                    </div>
                  )}
                  <div className="slide-history-item-meta">
                    {item.changedBy.fullName}, {formatDateTime(item.changedAt)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
