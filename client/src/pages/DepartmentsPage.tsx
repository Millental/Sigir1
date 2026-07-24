import { FormEvent, useEffect, useState } from "react";
import { AppHeader } from "../components/AppHeader";
import { api, Department } from "../api/client";

export function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  function loadDepartments() {
    api.listDepartments().then(setDepartments).catch(() => setError("Не удалось загрузить список отделов"));
  }

  useEffect(() => {
    loadDepartments();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!newName.trim()) {
      setError("Укажите название отдела");
      return;
    }
    setCreating(true);
    try {
      await api.createDepartment(newName.trim());
      setNewName("");
      loadDepartments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать отдел");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(d: Department) {
    setEditingId(d.id);
    setEditName(d.name);
    setError(null);
  }

  async function saveEdit(d: Department) {
    setBusyId(d.id);
    setError(null);
    try {
      await api.updateDepartment(d.id, editName.trim());
      setEditingId(null);
      loadDepartments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить изменения");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(d: Department) {
    setBusyId(d.id);
    setError(null);
    try {
      await api.deleteDepartment(d.id);
      loadDepartments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить отдел");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <div className="content">
        <form className="card" onSubmit={handleCreate}>
          <h2>Новый отдел</h2>
          {error && <p className="error-text">{error}</p>}
          <div className="field-row">
            <div className="field">
              <label htmlFor="new-department-name">Название</label>
              <input id="new-department-name" value={newName} onChange={(e) => setNewName(e.target.value)} required />
            </div>
          </div>
          <button className="primary" type="submit" disabled={creating}>
            {creating ? "Создаём…" : "Создать отдел"}
          </button>
        </form>

        <div className="card">
          <h2>Отделы</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Название</th>
                <th>Сотрудников</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((d) => {
                const isEditing = editingId === d.id;
                return (
                  <tr key={d.id}>
                    {isEditing ? (
                      <>
                        <td>
                          <input value={editName} onChange={(e) => setEditName(e.target.value)} />
                        </td>
                        <td className="muted-cell">{d._count?.users ?? 0}</td>
                        <td>
                          <button
                            type="button"
                            className="primary"
                            disabled={busyId === d.id}
                            onClick={() => saveEdit(d)}
                          >
                            Сохранить
                          </button>{" "}
                          <button type="button" className="secondary" onClick={() => setEditingId(null)}>
                            Отмена
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{d.name}</td>
                        <td className="muted-cell">{d._count?.users ?? 0}</td>
                        <td>
                          <button type="button" className="secondary" onClick={() => startEdit(d)}>
                            Переименовать
                          </button>{" "}
                          <button
                            type="button"
                            className="danger-outline"
                            disabled={busyId === d.id}
                            onClick={() => handleDelete(d)}
                          >
                            Удалить
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
              {departments.length === 0 && (
                <tr>
                  <td colSpan={3} className="muted-cell">
                    Отделов нет
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
