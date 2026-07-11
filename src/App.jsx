import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import { ToastProvider } from "./components/ui.jsx";
import Schedule from "./pages/Schedule.jsx";
import MyBookings from "./pages/MyBookings.jsx";
import Login from "./pages/Login.jsx";
import Account from "./pages/Account.jsx";
import Suggestions from "./pages/Suggestions.jsx";
import OwnerDashboard from "./pages/owner/Dashboard.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
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
    </BrowserRouter>
  );
}
