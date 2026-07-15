import { useAuth } from "../context/AuthContext";

export function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="title">Еженедельная отчётность</span>
        <span className="who">
          {user?.fullName} <span className="badge">{user?.role === "ADMIN" ? "Администратор" : "Спикер"}</span>
          <button className="link" onClick={logout}>
            Выйти
          </button>
        </span>
      </header>

      <div className="content">
        <div className="card">
          <h2>Каркас Этапа 1 готов</h2>
          <p>
            Вход по логину/паролю и ролевая модель на бэкенде работают. Форма заполнения слайда, предпросмотр,
            сборка презентации и остальные экраны появятся на следующих этапах (см. план-график).
          </p>
        </div>
      </div>
    </div>
  );
}
