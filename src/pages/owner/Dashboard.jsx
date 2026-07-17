import { useNavigate } from "react-router-dom";
import "./Dashboard.css";
import { useState } from "react";
import { FACILITY } from "../../config/facility.js";
import { longDate } from "../../lib/dates.js";
import { useSession, useStore } from "../../store/hooks.js";
import {
  ownerStats, confirmBooking, declineBooking, resolveSuggestion,
  pitchById, getPitches, addPitch, removePitch, setPitchStatus,
  requestNotifPermission, smsOutbox,
  pastConfirmedBookings, setBookingOutcome, setBookingPayment,
  financeSummary, setFinancePeriod, addExpense, deleteExpense, unpaidPlayedBookings,
} from "../../store/store.js";
import { Button, Card, EmptyState, StatusBadge, useToast, Modal, Field } from "../../components/ui.jsx";
import PitchPhoto from "../../components/PitchPhoto.jsx";

const PERIODS = [
  { value: "week7", label: "7 derniers jours" },
  { value: "month30", label: "30 derniers jours" },
  { value: "thisMonth", label: "Ce mois-ci" },
  { value: "lastMonth", label: "Mois dernier" },
];

export default function OwnerDashboard() {
  const session = useSession();
  const state = useStore();
  const toast = useToast();
  const nav = useNavigate();
  const [addOpen, setAddOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [period, setPeriod] = useState("week7");

  if (!session || session.role !== "owner") {
    return (
      <EmptyState glyph="🔐" title="Espace réservé au gérant"
        message={`Connecte-toi avec le numéro gérant (${FACILITY.ownerPhone}).`}
        action={<Button onClick={() => nav("/connexion")}>Se connecter</Button>} />
    );
  }

  const stats = ownerStats();
  const finance = financeSummary();
  const unpaid = unpaidPlayedBookings();
  const maxDay = Math.max(1, ...stats.perDay.map((d) => d.count));
  const maxHour = Math.max(1, ...Object.values(stats.perHour));
  const openSuggestions = state.suggestions.filter((s) => s.status === "open");
  const pitches = getPitches();
  const recentNotifs = state.notifications.slice(0, 6);

  async function onPeriodChange(next) {
    setPeriod(next);
    await setFinancePeriod(next);
  }

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

      {/* SMS outbox (simulated) */}
      <Card style={{ marginBottom: 16 }}>
        <div className="spread">
          <strong style={{ fontSize: 15 }}>💬 SMS envoyés</strong>
          <StatusBadge status="pending" label="Simulation" />
        </div>
        {smsOutbox().length === 0 ? (
          <p className="muted" style={{ fontSize: 13, marginBottom: 0, marginTop: 8 }}>
            Aucun SMS pour l'instant. Confirme une réservation → le client reçoit un SMS de confirmation,
            puis un rappel 1h avant le match.
          </p>
        ) : (
          <div style={{ marginTop: 8 }}>
            {smsOutbox().slice(0, 6).map((m) => (
              <div key={m.id} className="pending-item" style={{ alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <StatusBadge status={m.kind === "confirmation" ? "confirmed" : "free"}
                      label={m.kind === "confirmation" ? "Confirmation" : "Rappel 1h"} />
                    <span className="muted mono" style={{ fontSize: 12 }}>{m.to}</span>
                  </div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>{m.body}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="muted" style={{ fontSize: 11.5, marginBottom: 0, marginTop: 10 }}>
          Simulation — aucun SMS n'est réellement envoyé. L'envoi réel nécessite une passerelle SMS
          (payante) + un serveur pour les rappels programmés.
        </p>
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
      <div className="stat-grid" style={{ marginBottom: 12 }}>
        <div className="stat"><div className="k">Taux d'occupation (7j)</div><div className="v">{stats.occupancy}<small>%</small></div></div>
        <div className="stat"><div className="k">Réservations (7j)</div><div className="v">{stats.weekCount}</div></div>
        <div className="stat"><div className="k">Revenu prévisionnel (7j)</div><div className="v">{stats.revenueProjected}<small> {FACILITY.currency}</small></div></div>
        <div className="stat"><div className="k">À confirmer</div><div className="v" style={{ color: stats.pendingCount ? "var(--amber)" : "var(--ink)" }}>{stats.pendingCount}</div></div>
      </div>

      {/* Financial period selector + real collected/expenses/net figures */}
      <Card style={{ marginBottom: 16 }}>
        <div className="spread" style={{ marginBottom: 12 }}>
          <strong style={{ fontSize: 15 }}>Finances</strong>
          <select
            className="input"
            style={{ width: "auto", fontSize: 13, padding: "6px 10px" }}
            value={period}
            onChange={(e) => onPeriodChange(e.target.value)}
          >
            {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        {finance ? (
          <div className="stat-grid">
            <div className="stat"><div className="k">Encaissé</div><div className="v">{finance.collected}<small> {FACILITY.currency}</small></div></div>
            <div className="stat"><div className="k">Dépenses</div><div className="v">{finance.expensesTotal}<small> {FACILITY.currency}</small></div></div>
            <div className="stat">
              <div className="k">Bénéfice net</div>
              <div className="v" style={{ color: finance.netProfit < 0 ? "var(--danger, #dc2626)" : "var(--ink)" }}>
                {finance.netProfit}<small> {FACILITY.currency}</small>
              </div>
            </div>
          </div>
        ) : (
          <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>Chargement…</p>
        )}
      </Card>

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

      {/* Unpaid — played matches with no amount recorded yet, a queue to clear */}
      <Card style={{ marginBottom: 16 }}>
        <div className="spread">
          <strong style={{ fontSize: 15 }}>Impayés</strong>
          {unpaid.length > 0 && <StatusBadge status="pending" label={`${unpaid.length}`} />}
        </div>
        {unpaid.length === 0 ? (
          <p className="muted" style={{ fontSize: 13, marginBottom: 0, marginTop: 8 }}>Rien à réclamer. 👍</p>
        ) : (
          <div style={{ marginTop: 8 }}>
            {unpaid.map((b) => (
              <UnpaidRow key={b.id} b={b} toast={toast} />
            ))}
          </div>
        )}
      </Card>

      {/* Expenses */}
      <Card style={{ marginBottom: 16 }}>
        <div className="spread" style={{ marginBottom: 12 }}>
          <strong style={{ fontSize: 15 }}>Dépenses ({PERIODS.find((p) => p.value === period)?.label.toLowerCase()})</strong>
          <Button size="sm" onClick={() => setExpenseOpen(true)}>+ Ajouter</Button>
        </div>
        {!finance || finance.expenses.length === 0 ? (
          <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>Aucune dépense sur cette période.</p>
        ) : (
          <div className="col" style={{ gap: 8 }}>
            {finance.expenses.map((ex) => (
              <div key={ex.id} className="pending-item">
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    {CATEGORY_LABELS[ex.category] || ex.category} · {Number(ex.amount)} {FACILITY.currency}
                  </div>
                  <div className="muted" style={{ fontSize: 12.5 }}>
                    {ex.expenseDate}{ex.description ? ` · ${ex.description}` : ""}
                  </div>
                </div>
                <Button size="sm" variant="danger" onClick={async () => { await deleteExpense(ex.id); toast("Dépense supprimée."); }}>
                  Supprimer
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Past matches — outcome (joué/annulé) + actual amount paid, since the
          pitch's listed price is only a default and doesn't always match what
          was actually collected. */}
      <Card style={{ marginBottom: 16 }}>
        <strong style={{ fontSize: 15 }}>Matchs passés</strong>
        <PastMatches toast={toast} />
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
      <AddExpenseModal open={expenseOpen} onClose={() => setExpenseOpen(false)} onAdded={() => toast("Dépense ajoutée.")} />
    </div>
  );
}

function PastMatches({ toast }) {
  const matches = pastConfirmedBookings();
  if (matches.length === 0) {
    return <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>Aucun match passé pour l'instant.</p>;
  }
  return (
    <div style={{ marginTop: 8 }}>
      {matches.map((b) => (
        <PastMatchRow key={b.id} b={b} toast={toast} />
      ))}
    </div>
  );
}

function PastMatchRow({ b, toast }) {
  const pitch = pitchById(b.pitchId);
  // Defaults to the pitch's listed price until the owner overrides it —
  // exceptions (discounts, split payments, no-shows) are common enough that
  // this must stay editable per booking, not just read from the pitch.
  const [amount, setAmount] = useState(b.amountPaid ?? pitch?.price ?? 0);
  const dirty = Number(amount) !== (b.amountPaid ?? pitch?.price ?? 0);

  async function saveAmount() {
    await setBookingPayment(b.id, amount);
    toast("Montant enregistré.");
  }

  return (
    <div className="pending-item" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{b.name} · <span className="mono">{b.phone}</span></div>
        <div className="muted" style={{ fontSize: 12.5 }}>
          {longDate(b.dayKey)} · {b.slotStart} · {pitch?.name}
        </div>
      </div>
      <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div className="row" style={{ gap: 6 }}>
          <Button
            size="sm"
            variant={b.outcome === "played" ? "primary" : "ghost"}
            onClick={() => { setBookingOutcome(b.id, "played"); toast("Marqué comme joué."); }}
          >
            Joué
          </Button>
          <Button
            size="sm"
            variant={b.outcome === "cancelled" ? "danger" : "ghost"}
            onClick={() => { setBookingOutcome(b.id, "cancelled"); toast("Marqué comme annulé."); }}
          >
            Annulé
          </Button>
        </div>
        <div className="row" style={{ gap: 6, alignItems: "center" }}>
          <input
            className="input mono"
            inputMode="numeric"
            style={{ width: 84 }}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <span className="muted" style={{ fontSize: 12.5 }}>{FACILITY.currency}</span>
          {dirty && <Button size="sm" onClick={saveAmount}>Enregistrer</Button>}
        </div>
      </div>
    </div>
  );
}

function UnpaidRow({ b, toast }) {
  const pitch = pitchById(b.pitchId);
  const [amount, setAmount] = useState(pitch?.price ?? 0);

  async function save() {
    await setBookingPayment(b.id, amount);
    toast("Montant enregistré.");
  }

  return (
    <div className="pending-item" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{b.name} · <span className="mono">{b.phone}</span></div>
        <div className="muted" style={{ fontSize: 12.5 }}>
          {longDate(b.dayKey)} · {b.slotStart} · {pitch?.name}
        </div>
      </div>
      <div className="row" style={{ gap: 6, alignItems: "center" }}>
        <input
          className="input mono"
          inputMode="numeric"
          style={{ width: 84 }}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <span className="muted" style={{ fontSize: 12.5 }}>{FACILITY.currency}</span>
        <Button size="sm" onClick={save}>Enregistrer</Button>
      </div>
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

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    await addPitch({ name, players: fmt.players, perSide: fmt.perSide, price, covered, tint });
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

const CATEGORIES = [
  { value: "rent", label: "Loyer" },
  { value: "electricity", label: "Électricité" },
  { value: "water", label: "Eau" },
  { value: "staff", label: "Personnel" },
  { value: "maintenance", label: "Entretien" },
  { value: "equipment", label: "Équipement" },
  { value: "other", label: "Autre" },
];
const CATEGORY_LABELS = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]));

function AddExpenseModal({ open, onClose, onAdded }) {
  const [category, setCategory] = useState(CATEGORIES[0].value);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));

  async function submit(e) {
    e.preventDefault();
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return;
    await addExpense({ category, amount: n, description, expenseDate });
    setAmount(""); setDescription("");
    onAdded?.();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose}>
      <h2 style={{ margin: "0 0 16px", fontSize: 20, letterSpacing: "-0.02em" }}>Ajouter une dépense</h2>
      <form className="col" style={{ gap: 14 }} onSubmit={submit}>
        <Field label="Catégorie">
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            {CATEGORIES.map((c) => (
              <button type="button" key={c.value} onClick={() => setCategory(c.value)}
                className={`btn ${category === c.value ? "btn-primary" : "btn-ghost"} btn-sm`}>
                {c.label}
              </button>
            ))}
          </div>
        </Field>
        <Field label={`Montant (${FACILITY.currency})`}>
          <input className="input mono" inputMode="numeric" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
        </Field>
        <Field label="Date">
          <input className="input mono" type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
        </Field>
        <Field label="Description (optionnel)">
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex : Facture STEG juillet" />
        </Field>
        <div className="row" style={{ gap: 10 }}>
          <Button type="button" variant="ghost" block onClick={onClose}>Annuler</Button>
          <Button type="submit" block disabled={!amount || Number(amount) <= 0}>Ajouter</Button>
        </div>
      </form>
    </Modal>
  );
}
