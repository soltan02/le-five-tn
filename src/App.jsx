import { useEffect, useRef } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import { ToastProvider, useToast } from "./components/ui.jsx";
import { useSession, useStore } from "./store/hooks.js";
import { sendDueReminders, pitchById } from "./store/store.js";
import { longDate } from "./lib/dates.js";
import Schedule from "./pages/Schedule.jsx";
import MyBookings from "./pages/MyBookings.jsx";
import Login from "./pages/Login.jsx";
import Account from "./pages/Account.jsx";
import Suggestions from "./pages/Suggestions.jsx";
import OwnerDashboard from "./pages/owner/Dashboard.jsx";

// Fires 1h-before reminders while the app is open. In production this belongs
// on the server (a scheduler) so it works when no tab is open.
function ReminderScheduler() {
  useEffect(() => {
    sendDueReminders();
    const t = setInterval(() => sendDueReminders(), 30000);
    return () => clearInterval(t);
  }, []);
  return null;
}

// Notifies the logged-in player when one of THEIR bookings is confirmed by the
// owner. Uses the browser's Notification API (real OS notification if allowed)
// while the app is open. Push-when-closed needs the backend + a push service.
function AcceptedNotifier() {
  const session = useSession();
  const state = useStore();
  const toast = useToast();
  const seen = useRef(null);

  useEffect(() => {
    if (!session) { seen.current = null; return; }
    const confirmed = state.bookings.filter((b) => b.phone === session.phone && b.status === "confirmed");
    const ids = new Set(confirmed.map((b) => b.id));
    if (seen.current === null) { seen.current = ids; return; } // baseline on first run
    for (const b of confirmed) {
      if (!seen.current.has(b.id)) {
        const body = `${pitchById(b.pitchId)?.name || ""} · ${longDate(b.dayKey)} à ${b.slotStart}`;
        toast(`✅ Réservation confirmée — ${body}`);
        try {
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            new Notification("Réservation confirmée ✅", { body, tag: b.id });
          }
        } catch { /* notifications unsupported */ }
      }
    }
    seen.current = ids;
  }, [state, session, toast]);

  return null;
}

export default function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <ReminderScheduler />
        <AcceptedNotifier />
        <Layout>
          <Routes>
            <Route path="/" element={<Schedule />} />
            <Route path="/mes-reservations" element={<MyBookings />} />
            <Route path="/suggestions" element={<Suggestions />} />
            <Route path="/proprietaire" element={<OwnerDashboard />} />
            <Route path="/connexion" element={<Login />} />
            <Route path="/compte" element={<Account />} />
            <Route path="*" element={<Schedule />} />
          </Routes>
        </Layout>
      </ToastProvider>
    </HashRouter>
  );
}
