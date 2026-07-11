import { NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import "./Layout.css";
import { FACILITY } from "../config/facility.js";
import { useSession, useStore } from "../store/hooks.js";
import { ownerStats, unreadCount, markNotificationsRead } from "../store/store.js";

function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem("lefive.theme") || "dark");
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("lefive.theme", theme);
  }, [theme]);
  return [theme, () => setTheme((t) => (t === "dark" ? "light" : "dark"))];
}

export default function Layout({ children }) {
  const session = useSession();
  const [theme, toggleTheme] = useTheme();
  const nav = useNavigate();
  useStore(); // subscribe so the owner's badges stay live
  const isOwner = session?.role === "owner";
  const pendingCount = isOwner ? ownerStats().pendingCount : 0;
  const unread = isOwner ? unreadCount() : 0;

  const initials = session?.name?.[0]?.toUpperCase() || "?";

  // Role-based navigation. The owner manages the facility (planning + dashboard);
  // they don't have personal reservations or submit suggestions.
  const tabs = isOwner
    ? [
        { to: "/", ic: "📅", label: "Planning", end: true },
        { to: "/proprietaire", ic: "📊", label: "Gérer", count: pendingCount },
      ]
    : [
        { to: "/", ic: "📅", label: "Réserver", end: true },
        { to: "/mes-reservations", ic: "🎟️", label: "Mes résas" },
        { to: "/suggestions", ic: "💡", label: "Idées" },
      ];

  return (
    <>
      <div className="app-aura" />
      <header className="topbar">
        <div className="wrap">
          <div className="brand">
            <span className="mark">⚽</span>
            <span>{FACILITY.name}</span>
            <span className="loc">· {FACILITY.city}</span>
          </div>
          <div className="right">
            {isOwner && (
              <button className="icon-btn bell" onClick={() => { markNotificationsRead(); nav("/proprietaire"); }} aria-label="Notifications">
                🔔
                {unread > 0 && <span className="bell-badge">{unread > 9 ? "9+" : unread}</span>}
              </button>
            )}
            <button className="icon-btn" onClick={toggleTheme} aria-label="Thème">
              {theme === "dark" ? "☀" : "☾"}
            </button>
            {session ? (
              <button className="account-pill" onClick={() => nav("/compte")}>
                <span className="av">{initials}</span>
                {session.name}
              </button>
            ) : (
              <button className="account-pill" onClick={() => nav("/connexion")}>
                <span className="av">→</span>
                Se connecter
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="content">
        <div className="wrap">{children}</div>
      </main>

      <nav className="tabbar">
        <div className="inner">
          {tabs.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `tab ${isActive ? "on" : ""}`}>
              <span className="ic">{t.ic}</span>
              {t.label}
              {t.count > 0 && <span className="count">{t.count}</span>}
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
}
