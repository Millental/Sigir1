import { useAuth } from "../context/AuthContext";
import { AppHeader } from "../components/AppHeader";

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="app-shell">
      <AppHeader />

      <div className="content">
        <div className="card">
          <h2>Этап 2 готов</h2>
          {user?.role === "ADMIN" ? (
            <p>
              Создавайте шаблоны слайдов на странице «Шаблоны» и управляйте недельными циклами на странице
              «Циклы» — они появляются в верхней навигации.
            </p>
          ) : (
            <p>
              Заполните слайд на странице «Заполнить слайд» — выберите недельный цикл и шаблон, а форма
              покажет живой предпросмотр по мере заполнения.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
