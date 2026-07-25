import { FormEvent, useState } from "react";
import { api } from "../api/client";

export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordRepeat, setNewPasswordRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError("Новый пароль должен быть не короче 8 символов");
      return;
    }
    if (newPassword !== newPasswordRepeat) {
      setError("Новый пароль и повтор не совпадают");
      return;
    }
    setSaving(true);
    try {
      await api.changePassword({ currentPassword, newPassword });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сменить пароль");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3>Смена пароля</h3>
        {success ? (
          <>
            <p className="saved-hint">Пароль изменён.</p>
            <div className="modal-actions">
              <button type="button" className="primary" onClick={onClose}>
                Закрыть
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && <p className="error-text">{error}</p>}
            <div className="field">
              <label htmlFor="currentPassword">Текущий пароль</label>
              <input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="newPassword">Новый пароль</label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="newPasswordRepeat">Повторите новый пароль</label>
              <input
                id="newPasswordRepeat"
                type="password"
                value={newPasswordRepeat}
                onChange={(e) => setNewPasswordRepeat(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="secondary" onClick={onClose}>
                Отмена
              </button>
              <button type="submit" className="primary" disabled={saving}>
                {saving ? "Сохраняем…" : "Сменить пароль"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
