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

export function CyclesPage() {
  const [cycles, setCycles] = useState<WeeklyCycle[]>([]);
  const [weekLabel, setWeekLabel] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  async function handleStatusChange(cycle: WeeklyCycle, status: WeeklyCycleStatus) {
    setError(null);
    try {
      await api.updateCycle(cycle.id, { status });
      loadCycles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось изменить статус цикла");
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
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {cycles.map((c) => (
                <tr key={c.id}>
                  <td>{c.weekLabel}</td>
                  <td>{toDateInputValue(c.startDate)}</td>
                  <td>{toDateInputValue(c.endDate)}</td>
                  <td>
                    <select value={c.status} onChange={(e) => handleStatusChange(c, e.target.value as WeeklyCycleStatus)}>
                      {Object.entries(statusLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {cycles.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted-cell">
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
