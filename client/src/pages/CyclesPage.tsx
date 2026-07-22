import { useEffect, useState } from "react";
import { AppHeader } from "../components/AppHeader";
import { api, WeeklyCycle, WeeklyCycleStatus } from "../api/client";

const statusLabels: Record<WeeklyCycleStatus, string> = {
  COLLECTING: "Сбор",
  ASSEMBLED: "Собран",
  ARCHIVED: "Архив",
};

function toDateInputValue(iso: string): string {
  return iso.slice(0, 10);
}

function toDateTimeInputValue(iso: string | null): string {
  if (!iso) return "";
  // datetime-local ожидает локальное время, а не сырой UTC ISO — иначе при повторном открытии
  // формы значение "уезжает" на величину часового пояса (и может тихо пересохраниться со сдвигом).
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDeadline(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function CyclesPage() {
  const [cycles, setCycles] = useState<WeeklyCycle[]>([]);
  const [weekLabel, setWeekLabel] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editWeekLabel, setEditWeekLabel] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  function loadCycles() {
    api.listCycles().then(setCycles).catch(() => setError("Не удалось загрузить список циклов"));
  }

  useEffect(() => {
    loadCycles();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!weekLabel.trim() || !startDate || !endDate) {
      setError("Заполните название недели и обе даты");
      return;
    }

    setSaving(true);
    try {
      await api.createCycle({ weekLabel: weekLabel.trim(), startDate, endDate });
      setWeekLabel("");
      setStartDate("");
      setEndDate("");
      loadCycles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать цикл");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(cycle: WeeklyCycle) {
    setError(null);
    setArchivingId(cycle.id);
    try {
      await api.archiveCycle(cycle.id);
      loadCycles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось архивировать презентацию");
    } finally {
      setArchivingId(null);
    }
  }

  function startEdit(c: WeeklyCycle) {
    setEditingId(c.id);
    setEditWeekLabel(c.weekLabel);
    setEditStartDate(toDateInputValue(c.startDate));
    setEditEndDate(toDateInputValue(c.endDate));
    setEditDeadline(toDateTimeInputValue(c.deadline));
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function handleSaveEdit(id: string) {
    setError(null);
    if (!editWeekLabel.trim() || !editStartDate || !editEndDate) {
      setError("Заполните название недели и обе даты");
      return;
    }
    setEditSaving(true);
    try {
      await api.updateCycle(id, {
        weekLabel: editWeekLabel.trim(),
        startDate: editStartDate,
        endDate: editEndDate,
        deadline: editDeadline ? new Date(editDeadline).toISOString() : null,
      });
      setEditingId(null);
      loadCycles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить изменения");
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <div className="content">
        <div className="card">
          <h2>Недельные циклы</h2>
          {error && <p className="error-text">{error}</p>}
          <table className="data-table">
            <thead>
              <tr>
                <th>Неделя</th>
                <th>Начало</th>
                <th>Окончание</th>
                <th>Дедлайн</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {cycles.map((c) =>
                editingId === c.id ? (
                  <tr key={c.id}>
                    <td>
                      <input value={editWeekLabel} onChange={(e) => setEditWeekLabel(e.target.value)} />
                    </td>
                    <td>
                      <input type="date" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)} />
                    </td>
                    <td>
                      <input type="date" value={editEndDate} onChange={(e) => setEditEndDate(e.target.value)} />
                    </td>
                    <td>
                      <input
                        type="datetime-local"
                        value={editDeadline}
                        onChange={(e) => setEditDeadline(e.target.value)}
                      />
                    </td>
                    <td>
                      <span className="badge">{statusLabels[c.status]}</span>
                    </td>
                    <td>
                      <button className="primary" disabled={editSaving} onClick={() => handleSaveEdit(c.id)}>
                        {editSaving ? "Сохраняем…" : "Сохранить"}
                      </button>
                      <button className="secondary" disabled={editSaving} onClick={cancelEdit}>
                        Отмена
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={c.id}>
                    <td>{c.weekLabel}</td>
                    <td>{toDateInputValue(c.startDate)}</td>
                    <td>{toDateInputValue(c.endDate)}</td>
                    <td>{formatDeadline(c.deadline)}</td>
                    <td>
                      <span className="badge">{statusLabels[c.status]}</span>
                      {c.status === "ASSEMBLED" && (
                        <button
                          className="secondary"
                          disabled={archivingId === c.id}
                          onClick={() => handleArchive(c)}
                        >
                          {archivingId === c.id ? "Архивируем…" : "В архив"}
                        </button>
                      )}
                    </td>
                    <td>
                      <button className="secondary" onClick={() => startEdit(c)}>
                        Изменить
                      </button>
                    </td>
                  </tr>
                )
              )}
              {cycles.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted-cell">
                    Циклов пока нет
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <form className="card" onSubmit={handleSubmit}>
          <h2>Новый цикл</h2>
          <div className="field">
            <label htmlFor="weekLabel">Название недели</label>
            <input id="weekLabel" value={weekLabel} onChange={(e) => setWeekLabel(e.target.value)} placeholder="Например, 2026-W29" />
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="startDate">Начало</label>
              <input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="endDate">Окончание</label>
              <input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <button className="primary" type="submit" disabled={saving}>
            {saving ? "Создаём…" : "Создать цикл"}
          </button>
        </form>
      </div>
    </div>
  );
}
