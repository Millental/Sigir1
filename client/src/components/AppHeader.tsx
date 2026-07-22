import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { NotificationBell } from "./NotificationBell";

const adminLinks = [
  { to: "/", label: "Дашборд" },
  { to: "/templates", label: "Шаблоны" },
  { to: "/cycles", label: "Циклы" },
  { to: "/review", label: "Проверка" },
  { to: "/presentation", label: "Презентация" },
];

const speakerLinks = [
  { to: "/", label: "Дашборд" },
  { to: "/slides", label: "Заполнить слайд" },
  { to: "/presentation", label: "Презентация" },
];

export function AppHeader() {
  const { user, logout } = useAuth();
  const links = user?.role === "ADMIN" ? adminLinks : speakerLinks;

  return (
    <header className="app-header">
      <div className="app-header-left">
        <span className="title">Еженедельная отчётность</span>
        <nav className="app-nav">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              className={({ isActive }) => (isActive ? "app-nav-link active" : "app-nav-link")}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <span className="who">
        <NotificationBell />
        {user?.fullName} <span className="badge">{user?.role === "ADMIN" ? "Администратор" : "Спикер"}</span>
        <button className="link" onClick={logout}>
          Выйти
        </button>
      </span>
    </header>
  );
}
