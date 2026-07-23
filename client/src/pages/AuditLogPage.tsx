import { useEffect, useState } from "react";
import { AppHeader } from "../components/AppHeader";
import { api, AuditLogItem, UserListItem } from "../api/client";
import { auditActionLabels, auditActionLabel, auditTargetTypeLabels, auditTargetTypeLabel } from "../auditActionLabels";

interface AppliedFilters {
  from?: string;
  to?: string;
  action?: string;
  targetType?: string;
  userId?: string;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function AuditLogPage() {
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserListItem[]>([]);

  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");
  const [actionInput, setActionInput] = useState("");
  const [targetTypeInput, setTargetTypeInput] = useState("");
  const [userIdInput, setUserIdInput] = useState("");
  const [appliedFilters, setAppliedFilters] = useState<AppliedFilters>({});

  function fetchPage(filters: AppliedFilters, cursor?: string) {
    const setLoadingFlag = cursor ? setLoadingMore : setLoading;
    setLoadingFlag(true);
    setError(null);
    api
      .getAuditLog({ ...filters, cursor })
      .then((res) => {
        setItems((prev) => (cursor ? [...prev, ...res.items] : res.items));
        setNextCursor(res.nextCursor);
        setHasMore(res.hasMore);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Не удалось загрузить журнал"))
      .finally(() => setLoadingFlag(false));
  }

  useEffect(() => {
    fetchPage({});
    api.listUsers().then(setUsers).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleApplyFilters(e: React.FormEvent) {
    e.preventDefault();
    const filters: AppliedFilters = {
      from: fromInput ? new Date(`${fromInput}T00:00:00`).toISOString() : undefined,
      to: toInput ? new Date(`${toInput}T23:59:59.999`).toISOString() : undefined,
      action: actionInput || undefined,
      targetType: targetTypeInput || undefined,
      userId: userIdInput || undefined,
    };
    setAppliedFilters(filters);
    setItems([]);
    setNextCursor(null);
    fetchPage(filters);
  }

  function handleResetFilters() {
    setFromInput("");
    setToInput("");
    setActionInput("");
    setTargetTypeInput("");
    setUserIdInput("");
    setAppliedFilters({});
    setItems([]);
    setNextCursor(null);
    fetchPage({});
  }

  function handleLoadMore() {
    if (nextCursor) fetchPage(appliedFilters, nextCursor);
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <div className="content">
        <form className="card" onSubmit={handleApplyFilters}>
          <h2>Фильтры</h2>
          <div className="field-row">
            <div className="field">
              <label htmlFor="af-from">Дата с</label>
              <input id="af-from" type="date" value={fromInput} onChange={(e) => setFromInput(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="af-to">Дата по</label>
              <input id="af-to" type="date" value={toInput} onChange={(e) => setToInput(e.target.value)} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="af-action">Тип действия</label>
              <select id="af-action" value={actionInput} onChange={(e) => setActionInput(e.target.value)}>
                <option value="">Все</option>
                {Object.entries(auditActionLabels).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="af-target">Тип объекта</label>
              <select id="af-target" value={targetTypeInput} onChange={(e) => setTargetTypeInput(e.target.value)}>
                <option value="">Все</option>
                {Object.entries(auditTargetTypeLabels).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="af-user">Пользователь</label>
              <select id="af-user" value={userIdInput} onChange={(e) => setUserIdInput(e.target.value)}>
                <option value="">Все</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button className="primary" type="submit">
            Применить
          </button>
          <button className="secondary" type="button" onClick={handleResetFilters}>
            Сбросить
          </button>
        </form>

        <div className="card">
          <h2>Журнал действий</h2>
          {error && <p className="error-text">{error}</p>}
          <table className="data-table">
            <thead>
              <tr>
                <th>Дата и время</th>
                <th>Пользователь</th>
                <th>Действие</th>
                <th>Объект</th>
                <th>ID объекта</th>
                <th>Детали</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td>{formatDateTime(it.createdAt)}</td>
                  <td>{it.user?.fullName ?? "—"}</td>
                  <td>{auditActionLabel(it.action)}</td>
                  <td>{auditTargetTypeLabel(it.targetType)}</td>
                  <td className="muted-cell">{it.targetId ?? "—"}</td>
                  <td className="muted-cell">{it.details ?? "—"}</td>
                </tr>
              ))}
              {items.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="muted-cell">
                    Записей не найдено
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {loading && <p className="hint-text">Загрузка…</p>}
          {hasMore && (
            <button className="secondary" disabled={loadingMore} onClick={handleLoadMore}>
              {loadingMore ? "Загружаем…" : "Загрузить ещё"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
