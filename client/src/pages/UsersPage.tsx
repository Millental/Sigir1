import { FormEvent, useEffect, useState } from "react";
import { AppHeader } from "../components/AppHeader";
import { ConfirmModal } from "../components/ConfirmModal";
import { useAuth } from "../context/AuthContext";
import { api, Department, UserListItem } from "../api/client";

const roleLabels: Record<"ADMIN" | "SPEAKER", string> = {
  ADMIN: "Администратор",
  SPEAKER: "Спикер",
};

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<{ login: string; password: string } | null>(null);

  const [newFullName, setNewFullName] = useState("");
  const [newLogin, setNewLogin] = useState("");
  const [newRole, setNewRole] = useState<"ADMIN" | "SPEAKER">("SPEAKER");
  const [newDepartmentId, setNewDepartmentId] = useState("");
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editRole, setEditRole] = useState<"ADMIN" | "SPEAKER">("SPEAKER");
  const [editDepartmentId, setEditDepartmentId] = useState("");
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<UserListItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function loadUsers() {
    api.listUsers().then(setUsers).catch(() => setError("Не удалось загрузить список пользователей"));
  }

  useEffect(() => {
    loadUsers();
    api.listDepartments().then(setDepartments).catch(() => {});
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!newFullName.trim() || !newLogin.trim()) {
      setError("Укажите ФИО и логин");
      return;
    }
    setCreating(true);
    try {
      const created = await api.createUser({
        fullName: newFullName.trim(),
        login: newLogin.trim(),
        role: newRole,
        departmentId: newDepartmentId || null,
      });
      setTempPassword({ login: newLogin.trim(), password: created.tempPassword });
      setNewFullName("");
      setNewLogin("");
      setNewRole("SPEAKER");
      setNewDepartmentId("");
      loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать пользователя");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(u: UserListItem) {
    setEditingId(u.id);
    setEditFullName(u.fullName);
    setEditRole(u.role);
    setEditDepartmentId(u.departmentId ?? "");
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(u: UserListItem) {
    setSaving(true);
    setError(null);
    const isSelf = currentUser?.id === u.id;
    try {
      await api.updateUser(u.id, {
        fullName: editFullName.trim(),
        // Роль недоступна для правки в своей строке (select задизейблен) — не отправляем её вовсе,
        // иначе backend-защита от самопонижения (role !== undefined -> 400) заблокирует даже
        // безобидное сохранение одного только ФИО.
        ...(isSelf ? {} : { role: editRole }),
        departmentId: editDepartmentId || null,
      });
      setEditingId(null);
      loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить изменения");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(u: UserListItem) {
    setBusyId(u.id);
    setError(null);
    try {
      await api.updateUser(u.id, { isActive: !u.isActive });
      loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось изменить статус");
    } finally {
      setBusyId(null);
    }
  }

  async function handleResetPassword(u: UserListItem) {
    setBusyId(u.id);
    setError(null);
    try {
      const res = await api.resetUserPassword(u.id);
      setTempPassword({ login: u.login, password: res.tempPassword });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сбросить пароль");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setBusyId(target.id);
    setError(null);
    try {
      await api.deleteUser(target.id);
      setDeleteTarget(null);
      loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить пользователя");
      setDeleteTarget(null);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <div className="content">
        <form className="card" onSubmit={handleCreate}>
          <h2>Новый пользователь</h2>
          {error && <p className="error-text">{error}</p>}
          {tempPassword && (
            <p className="hint-text">
              Временный пароль для «{tempPassword.login}»: <strong>{tempPassword.password}</strong> (показывается один
              раз, сохраните сейчас)
            </p>
          )}
          <div className="field-row">
            <div className="field">
              <label htmlFor="new-fullname">ФИО</label>
              <input id="new-fullname" value={newFullName} onChange={(e) => setNewFullName(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="new-login">Логин</label>
              <input id="new-login" value={newLogin} onChange={(e) => setNewLogin(e.target.value)} required />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="new-role">Роль</label>
              <select id="new-role" value={newRole} onChange={(e) => setNewRole(e.target.value as "ADMIN" | "SPEAKER")}>
                <option value="SPEAKER">Спикер</option>
                <option value="ADMIN">Администратор</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="new-department">Отдел</label>
              <select id="new-department" value={newDepartmentId} onChange={(e) => setNewDepartmentId(e.target.value)}>
                <option value="">Без отдела</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button className="primary" type="submit" disabled={creating}>
            {creating ? "Создаём…" : "Создать пользователя"}
          </button>
        </form>

        <div className="card">
          <h2>Пользователи</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>ФИО</th>
                <th>Логин</th>
                <th>Роль</th>
                <th>Отдел</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = currentUser?.id === u.id;
                const isEditing = editingId === u.id;
                return (
                  <tr key={u.id}>
                    {isEditing ? (
                      <>
                        <td>
                          <input value={editFullName} onChange={(e) => setEditFullName(e.target.value)} />
                        </td>
                        <td className="muted-cell">{u.login}</td>
                        <td>
                          <select
                            value={editRole}
                            disabled={isSelf}
                            onChange={(e) => setEditRole(e.target.value as "ADMIN" | "SPEAKER")}
                          >
                            <option value="SPEAKER">Спикер</option>
                            <option value="ADMIN">Администратор</option>
                          </select>
                        </td>
                        <td>
                          <select value={editDepartmentId} onChange={(e) => setEditDepartmentId(e.target.value)}>
                            <option value="">Без отдела</option>
                            {departments.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <span className="badge">{u.isActive ? "Активен" : "Деактивирован"}</span>
                        </td>
                        <td>
                          <button type="button" className="primary" disabled={saving} onClick={() => saveEdit(u)}>
                            Сохранить
                          </button>{" "}
                          <button type="button" className="secondary" onClick={cancelEdit}>
                            Отмена
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>
                          {u.fullName}
                          {isSelf && <span className="hint-text"> (вы)</span>}
                        </td>
                        <td className="muted-cell">{u.login}</td>
                        <td>
                          <span className="badge">{roleLabels[u.role]}</span>
                        </td>
                        <td>{u.department?.name ?? "—"}</td>
                        <td>
                          <span className="badge">{u.isActive ? "Активен" : "Деактивирован"}</span>
                        </td>
                        <td>
                          <button type="button" className="secondary" onClick={() => startEdit(u)}>
                            Редактировать
                          </button>{" "}
                          {!isSelf && (
                            <button
                              type="button"
                              className="secondary"
                              disabled={busyId === u.id}
                              onClick={() => toggleActive(u)}
                            >
                              {u.isActive ? "Деактивировать" : "Активировать"}
                            </button>
                          )}{" "}
                          <button
                            type="button"
                            className="secondary"
                            disabled={busyId === u.id}
                            onClick={() => handleResetPassword(u)}
                          >
                            Сбросить пароль
                          </button>{" "}
                          {!isSelf && (
                            <button
                              type="button"
                              className="danger-outline"
                              disabled={busyId === u.id}
                              onClick={() => setDeleteTarget(u)}
                            >
                              Удалить
                            </button>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted-cell">
                    Пользователей нет
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {deleteTarget && (
        <ConfirmModal
          title="Удалить пользователя"
          message={`Удалить учётную запись «${deleteTarget.fullName}»? Действие необратимо. Если учётная запись уже использовалась в системе (есть слайды или уведомления), удаление будет отклонено — используйте деактивацию.`}
          confirmLabel="Удалить"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
