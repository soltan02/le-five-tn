import { useNavigate } from "react-router-dom";
import "./Dashboard.css";
import { useState } from "react";
import { FACILITY } from "../../config/facility.js";
import { longDate } from "../../lib/dates.js";
import { useSession, useStore } from "../../store/hooks.js";
import {
  ownerStats, confirmBooking, declineBooking, resolveSuggestion,
  pitchById, getPitches, addPitch, removePitch, setPitchStatus,
  requestNotifPermission,
} from "../../store/store.js";
import { Button, Card, EmptyState, StatusBadge, useToast, Modal, Field } from "../../components/ui.jsx";
import PitchPhoto from "../../components/PitchPhoto.jsx";

export default function OwnerDashboard() {
  const session = useSession();
  const state = useStore();
  const toast = useToast();
  const nav = useNavigate();
  const [addOpen, setAddOpen] = useState(false);

  if (!session || session.role !== "owner") {
    return (
      <EmptyState glyph="🔐" title="Espace réservé au gérant"
        message={`Connecte-toi avec le numéro gérant (${FACILITY.ownerPhone}).`}
        action={<Button onClick={() => nav("/connexion")}>Se connecter</Button>} />
    );
  }

  const stats = ownerStats();
  const maxDay = Math.max(1, ...stats.perDay.map((d) => d.count));
  const maxHour = Math.max(1, ...Object.values(stats.perHour));
  const openSuggestions = state.suggestions.filter((s) => s.status === "open");
  const pitches = getPitches();
  const recentNotifs = state.notifications.slice(0, 6);

  return (
    <div>
      <div className="spread" style={{ margin: "4px 0 16px" }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em", margin: 0 }}>Tableau de bord</h1>
        <Button size="sm" variant="ghost" onClick={() => nav("/")}>Réserver pour un client</Button>
      </div>

      {/* Notifications */}
      <Card style={{ marginBottom: 16 }}>
        <div className="spread">
          <strong style={{ fontSize: 15 }}>🔔 Notifications</strong>
          {typeof Notification !== "undefined" && Notification.permission !== "granted" && (
            <Button size="sm" variant="soft" onClick={requestNotifPermission}>Activer</Button>
          )}
        </div>
        {recentNotifs.length === 0 ? (
          <p className="muted" style={{ fontSize: 13, marginBottom: 0, marginTop: 8 }}>Aucune notification.</p>
        ) : (
          <div style={{ marginTop: 8 }}>
            {recentNotifs.map((n) => (
              <div key={n.id} className="pending-item">
                <span style={{ fontSize: 13.5, fontWeight: n.read ? 400 : 700 }}>
                  {!n.read && <span style={{ color: "var(--pitch)" }}>● </span>}{n.text}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Your stadiums — management */}
      <Card style={{ marginBottom: 16 }}>
        <div className="spread" style={{ marginBottom: 12 }}>
          <strong style={{ fontSize: 15 }}>Vos terrains</strong>
          <Button size="sm" onClick={() => setAddOpen(true)}>+ Ajouter</Button>
        </div>
        <div className="col" style={{ gap: 10 }}>
          {pitches.map((p) => (
            <div key={p.id} className="card" style={{ padding: 10, display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ width: 84, flex: "0 0 auto" }}><PitchPhoto pitch={p} height={54} radius={10} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</div>
                <div className="muted" style={{ fontSize: 12 }}>{p.players} · {p.price} {FACILITY.currency}</div>
                {p.status === "maintenance" && <StatusBadge status="pending" label="Maintenance" />}
              </div>
              <div className="col" style={{ gap: 6 }}>
                <Button size="sm" variant={p.status === "maintenance" ? "soft" : "ghost"}
                  onClick={() => { setPitchStatus(p.id, p.status === "maintenance" ? "active" : "maintenance"); toast(p.status === "maintenance" ? "Terrain réactivé." : "Terrain en maintenance."); }}>
                  {p.status === "maintenance" ? "Réactiver" : "Maintenance"}
                </Button>
                <Button size="sm" variant="danger"
                  onClick={() => { if (window.confirm(`Retirer ${p.name} ?`)) { removePitch(p.id); toast("Terrain retiré."); } }}>
                  Retirer
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* KPIs */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat"><div className="k">Taux d'occupation (7j)</div><div className="v">{stats.occupancy}<small>%</small></div></div>
        <div className="stat"><div className="k">Réservations (7j)</div><div className="v">{stats.weekCount}</div></div>
        <div className="stat"><div className="k">Revenu estimé (7j)</div><div className="v">{stats.revenue}<small> {FACILITY.currency}</small></div></div>
        <div className="stat"><div className="k">À confirmer</div><div className="v" style={{ color: stats.pendingCount ? "var(--amber)" : "var(--ink)" }}>{stats.pendingCount}</div></div>
      </div>

      {/* Bookings per day */}
      <Card style={{ marginBottom: 16 }}>
        <div className="spread" style={{ marginBottom: 4 }}>
          <strong style={{ fontSize: 15 }}>Réservations par jour</strong>
          <span className="muted" style={{ fontSize: 12 }}>7 prochains jours</span>
        </div>
        <div className="bars">
          {stats.perDay.map((d) => (
            <div className="bar-col" key={d.key}>
              <span className="num">{d.count || ""}</span>
              <div className={`bar ${d.count === 0 ? "dim" : ""}`} style={{ height: `${(d.count / maxDay) * 100}%` }} />
              <span className="lbl">{d.isToday ? "Auj." : d.weekday}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Popular hours → what to improve */}
      <Card style={{ marginBottom: 16 }}>
        <div className="spread" style={{ marginBottom: 12 }}>
          <strong style={{ fontSize: 15 }}>Créneaux les plus demandés</strong>
          <span className="muted" style={{ fontSize: 12 }}>où concentrer les efforts</span>
        </div>
        {Object.entries(stats.perHour).map(([h, n]) => (
          <div className="hour-row" key={h}>
            <span className="h">{h}</span>
            <span className="track"><span className="fill" style={{ width: `${(n / maxHour) * 100}%` }} /></span>
            <span className="n">{n}</span>
          </div>
        ))}
        <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>
          Astuce : les créneaux vides en journée peuvent être bradés pour attirer plus de matchs.
        </p>
      </Card>

      {/* Pending confirmations */}
      <Card style={{ marginBottom: 16 }}>
        <strong style={{ fontSize: 15 }}>Demandes à confirmer</strong>
        {stats.pending.length === 0 ? (
          <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>Tout est à jour. 👍</p>
        ) : (
          <div style={{ marginTop: 8 }}>
            {stats.pending.map((b) => (
              <div className="pending-item" key={b.id}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{b.name} · <span className="mono">{b.phone}</span></div>
                  <div className="muted" style={{ fontSize: 12.5 }}>
                    {longDate(b.dayKey)} · {b.slotStart} · {pitchById(b.pitchId)?.name}
                  </div>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <Button size="sm" variant="danger" onClick={() => { declineBooking(b.id); toast("Demande refusée."); }}>Refuser</Button>
                  <Button size="sm" onClick={() => { confirmBooking(b.id); toast("Réservation confirmée."); }}>Confirmer</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Suggestions inbox */}
      <Card>
        <div className="spread">
          <strong style={{ fontSize: 15 }}>Suggestions des joueurs</strong>
          <StatusBadge status={openSuggestions.length ? "pending" : "confirmed"} label={`${openSuggestions.length} ouvertes`} />
        </div>
        {openSuggestions.length === 0 ? (
          <p className="muted" style={{ fontSize: 13, marginBottom: 0, marginTop: 8 }}>Aucune suggestion en attente.</p>
        ) : (
          <div style={{ marginTop: 8 }}>
            {openSuggestions.map((s) => (
              <div className="pending-item" key={s.id}>
                <div>
                  <div style={{ fontSize: 14 }}>{s.text}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{s.name}</div>
                </div>
                <Button size="sm" variant="soft" onClick={() => { resolveSuggestion(s.id); toast("Marquée comme traitée."); }}>Traité</Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <AddPitchModal open={addOpen} onClose={() => setAddOpen(false)} onAdded={() => toast("Terrain ajouté.")} />
    </div>
  );
}

const FORMATS = [
  { perSide: 5, players: "5 vs 5" },
  { perSide: 6, players: "6 vs 6" },
  { perSide: 7, players: "7 vs 7" },
  { perSide: 11, players: "11 vs 11" },
];
const TINTS = ["#1F7A46", "#166b3c", "#0E5A34", "#0f766e", "#3f6212"];

function AddPitchModal({ open, onClose, onAdded }) {
  const [name, setName] = useState("");
  const [fmt, setFmt] = useState(FORMATS[1]);
  const [price, setPrice] = useState("100");
  const [covered, setCovered] = useState(false);
  const [tint, setTint] = useState(TINTS[0]);

  function submit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    addPitch({ name, players: fmt.players, perSide: fmt.perSide, price, covered, tint });
    setName(""); setPrice("100"); setCovered(false);
    onAdded?.();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose}>
      <h2 style={{ margin: "0 0 16px", fontSize: 20, letterSpacing: "-0.02em" }}>Ajouter un terrain</h2>
      <form className="col" style={{ gap: 14 }} onSubmit={submit}>
        <Field label="Nom du terrain">
          <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Terrain C" />
        </Field>
        <Field label="Format">
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            {FORMATS.map((f) => (
              <button type="button" key={f.perSide} onClick={() => setFmt(f)}
                className={`btn ${fmt.perSide === f.perSide ? "btn-primary" : "btn-ghost"} btn-sm`}>
                {f.players}
              </button>
            ))}
          </div>
        </Field>
        <Field label={`Prix (${FACILITY.currency})`}>
          <input className="input mono" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <Field label="Couleur (illustration)">
          <div className="row" style={{ gap: 8 }}>
            {TINTS.map((t) => (
              <button type="button" key={t} onClick={() => setTint(t)} aria-label={t}
                style={{ width: 30, height: 30, borderRadius: 8, background: t, cursor: "pointer",
                  border: tint === t ? "2px solid var(--ink)" : "2px solid transparent" }} />
            ))}
          </div>
        </Field>
        <label className="row" style={{ gap: 8, cursor: "pointer", fontSize: 14 }}>
          <input type="checkbox" checked={covered} onChange={(e) => setCovered(e.target.checked)} />
          Terrain couvert
        </label>
        <div className="row" style={{ gap: 10 }}>
          <Button type="button" variant="ghost" block onClick={onClose}>Annuler</Button>
          <Button type="submit" block disabled={!name.trim()}>Ajouter</Button>
        </div>
      </form>
    </Modal>
  );
}
