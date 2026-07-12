import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FACILITY } from "../config/facility.js";
import { longDate, isPast } from "../lib/dates.js";
import { useSession, useStore } from "../store/hooks.js";
import { myBookings, cancelBooking, pitchById, requestNotifPermission } from "../store/store.js";
import { Button, Card, StatusBadge, EmptyState, useToast } from "../components/ui.jsx";

function NotifyPrompt() {
  const supported = typeof Notification !== "undefined";
  const [perm, setPerm] = useState(supported ? Notification.permission : "unsupported");
  if (!supported || perm === "granted" || perm === "denied") return null;
  return (
    <Card style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ fontSize: 22 }}>🔔</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>Être prévenu à la confirmation</div>
        <div className="muted" style={{ fontSize: 12.5 }}>Reçois une notif dès que le gérant valide ta réservation.</div>
      </div>
      <Button size="sm" onClick={async () => { await requestNotifPermission(); setPerm(Notification.permission); }}>
        Activer
      </Button>
    </Card>
  );
}

export default function MyBookings() {
  const session = useSession();
  useStore();
  const toast = useToast();
  const nav = useNavigate();

  if (!session) {
    return (
      <EmptyState
        glyph="🔒"
        title="Connecte-toi pour voir tes réservations"
        message="La connexion se fait par SMS, en quelques secondes."
        action={<Button onClick={() => nav("/connexion")}>Se connecter</Button>}
      />
    );
  }

  const all = myBookings(session.phone);
  const upcoming = all.filter((b) => !isPast(b.dayKey, b.slotStart) && (b.status === "pending" || b.status === "confirmed"));
  const history = all.filter((b) => !upcoming.includes(b));

  function onCancel(b) {
    cancelBooking(b.id);
    toast("Réservation annulée.");
  }

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em", margin: "4px 0 16px" }}>Mes réservations</h1>

      <NotifyPrompt />

      <div className="spread" style={{ marginBottom: 10 }}>
        <span className="muted" style={{ fontSize: 13 }}>À venir</span>
        <span className="muted" style={{ fontSize: 12 }}>
          {upcoming.length}/{FACILITY.maxActiveBookingsPerUser} actives
        </span>
      </div>

      {upcoming.length === 0 ? (
        <EmptyState glyph="📅" title="Aucune réservation à venir" message="Réserve un créneau depuis l'onglet Réserver."
          action={<Button onClick={() => nav("/")}>Réserver</Button>} />
      ) : (
        <div className="col" style={{ gap: 12 }}>
          {upcoming.map((b) => (
            <BookingCard key={b.id} b={b} onCancel={() => onCancel(b)} />
          ))}
        </div>
      )}

      {history.length > 0 && (
        <>
          <div className="muted" style={{ fontSize: 13, margin: "24px 0 10px" }}>Historique</div>
          <div className="col" style={{ gap: 12 }}>
            {history.map((b) => (
              <BookingCard key={b.id} b={b} past />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function BookingCard({ b, onCancel, past }) {
  const pitch = pitchById(b.pitchId);
  return (
    <Card style={{ opacity: past ? 0.7 : 1 }}>
      <div className="spread">
        <div className="row" style={{ gap: 14 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 12, display: "grid", placeItems: "center",
            background: "var(--pitch-ghost)", color: "var(--pitch)", fontWeight: 800, fontFamily: "var(--mono)", fontSize: 13,
          }}>
            {b.slotStart}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{longDate(b.dayKey)}</div>
            <div className="muted" style={{ fontSize: 12.5 }}>
              {pitch?.name} · {b.slotStart}→{b.slotEnd}
            </div>
          </div>
        </div>
        <div className="col" style={{ alignItems: "flex-end", gap: 8 }}>
          <StatusBadge status={b.status} />
          {onCancel && (b.status === "pending" || b.status === "confirmed") && (
            <Button variant="danger" size="sm" onClick={onCancel}>Annuler</Button>
          )}
        </div>
      </div>
      {b.status === "pending" && !past && (
        <div style={{
          marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)",
          fontSize: 12.5, color: "var(--amber)", display: "flex", gap: 8, alignItems: "center",
        }}>
          <span>⏳</span>
          <span>En attente de confirmation du gérant — reviens vérifier dans ~5 min.</span>
        </div>
      )}
    </Card>
  );
}
