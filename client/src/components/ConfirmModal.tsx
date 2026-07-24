interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// Единственная confirm-модалка в проекте — сознательно используется только для
// безвозвратного жёсткого удаления пользователя (UsersPage.tsx). Остальные разрушительные
// действия в проекте (архивирование, разбор презентации, удаление отдела) выполняются сразу
// по клику, без подтверждения — не расширять этот компонент на них.
export function ConfirmModal({ title, message, confirmLabel, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onCancel}>
            Отмена
          </button>
          <button type="button" className="danger-outline" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
